import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { WorktreeError } from './errors.js'

const MAX_OUT = 64 * 1024 * 1024
const BASE_ENV = {
  GIT_OPTIONAL_LOCKS: '0',
  GIT_TERMINAL_PROMPT: '0',
}

function trim(s, max = 4000) {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}\n…(输出已截断)` : s
}

function failure(args, code, stdout, stderr) {
  return [
    `命令失败 (exit ${code}): git ${args.join(' ')}`,
    stdout ? `stdout:\n${trim(stdout)}` : '',
    stderr ? `stderr:\n${trim(stderr)}` : '',
  ].filter(Boolean).join('\n')
}

/** Git runner over the DSH subprocess service, used by the installed plugin. */
export function createHostGit(ctx) {
  return async function git(args, cwd, options = {}) {
    const { env, check = true, graceMs = 15000 } = options
    let handle
    try {
      handle = ctx.subprocess.spawn({
        argv: ['git', ...args],
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: MAX_OUT, spill: { maxBytes: MAX_OUT } },
          stderr: { maxBytes: 4 * 1024 * 1024, spill: { maxBytes: 8 * 1024 * 1024 } },
        },
        graceMs,
        env: { ...process.env, ...BASE_ENV, ...(env ?? {}) },
      })
    } catch (error) {
      throw new WorktreeError(`无法启动 git: ${error?.message ?? error}`)
    }
    let outcome
    try {
      outcome = await handle.done
    } catch (error) {
      throw new WorktreeError(`git 进程失败: ${error?.message ?? error}`)
    }
    const stdout = handle.collected.stdout?.readFrom(0).text ?? ''
    const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
    const code = outcome?.exitCode ?? 1
    if (check && code !== 0) throw new WorktreeError(failure(args, code, stdout, stderr))
    return { code, stdout, stderr }
  }
}

/** Local child-process runner for tests and for running the engine outside a Harness. */
export function createLocalGit() {
  return async function git(args, cwd, options = {}) {
    const { env, check = true } = options
    const result = await new Promise((resolve) => {
      const child = spawn('git', args, {
        cwd,
        env: { ...process.env, ...BASE_ENV, ...(env ?? {}) },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
      child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
      child.on('error', (error) => resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` }))
      child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
    })
    if (check && result.code !== 0) {
      throw new WorktreeError(failure(args, result.code, result.stdout, result.stderr))
    }
    return result
  }
}

export async function text(git, args, cwd) {
  return (await git(args, cwd)).stdout.trim()
}

export async function repoRoot(git, cwd) {
  try {
    return await text(git, ['rev-parse', '--show-toplevel'], cwd)
  } catch {
    throw new WorktreeError(`当前目录不在 Git 工作区中: ${cwd}`)
  }
}

export async function commonDir(git, cwd) {
  const out = await text(git, ['rev-parse', '--git-common-dir'], cwd)
  return path.resolve(cwd, out)
}

export async function headCommit(git, cwd) {
  return text(git, ['rev-parse', 'HEAD'], cwd)
}

export async function headTree(git, cwd) {
  return text(git, ['rev-parse', 'HEAD^{tree}'], cwd)
}

export async function statusPorcelain(git, cwd) {
  return (await git(['status', '--porcelain'], cwd, { check: false })).stdout.replace(/\n$/, '')
}

export async function branchExists(git, cwd, branch) {
  return (await text(git, ['branch', '--list', branch], cwd)).length > 0
}

export async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}
