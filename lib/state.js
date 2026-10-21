import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { WorktreeError } from './errors.js'
import { commonDir, mainWorktreeRoot, repoRoot } from './git.js'

export const STATE_VERSION = 1
export const STATE_FILE = 'tasks.json'

/** Per-repository state id used by the optional home-state layout. */
export function repoStateId(root) {
  const digest = crypto.createHash('sha1').update(root).digest('hex').slice(0, 12)
  const slug = path.basename(root).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `${slug || 'repo'}-${digest}`
}

/**
 * DSH's agent bash runs under the session workspace sandbox. The default
 * state therefore lives inside the repository's `.git` (writable from the
 * main session). Setting `DSH_WORKTREE_STATE` opts into the Claude/Codex-style
 * home layout, which may require a wider sandbox.
 */
export function stateRoot() {
  return process.env.WORKTREE_STATE || process.env.DSH_WORKTREE_STATE || ''
}

export function repoStateDir(root, common) {
  const override = stateRoot()
  return override ? path.join(path.resolve(override), repoStateId(root)) : path.join(common, 'dsh-worktree')
}

export function statePath(stateDir) {
  return path.join(stateDir, STATE_FILE)
}

export function emptyState(repo) {
  return {
    version: STATE_VERSION,
    repo,
    tasks: {},
    preview: null,
  }
}

function parseState(raw, file, repo) {
  let state
  try {
    state = JSON.parse(raw)
  } catch (error) {
    throw new WorktreeError(`任务状态不是合法 JSON: ${file}\n${error.message}`)
  }
  if (!state || state.version !== STATE_VERSION || typeof state.tasks !== 'object' || state.tasks === null) {
    throw new WorktreeError(`任务状态格式不兼容: ${file}`)
  }
  if (!state.repo) state.repo = repo
  state.preview ??= null
  return state
}

/**
 * Read one repository's state.
 *
 * The default `stateDir` is the repo-local `.git/dsh-worktree`, writable from
 * the main session without sandbox escalation. When `DSH_WORKTREE_STATE`
 * selects a home layout, a pre-existing repo-local file is imported once so
 * existing tasks survive the switch.
 */
export async function readState(stateDir, repo, legacyPath = null) {
  const file = statePath(stateDir)
  let raw
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw new WorktreeError(`无法读取任务状态: ${file}\n${error.message}`)
    }
    if (!legacyPath) return emptyState(repo)
    try {
      raw = await fs.readFile(legacyPath, 'utf8')
    } catch (legacyError) {
      if (legacyError?.code === 'ENOENT') return emptyState(repo)
      throw new WorktreeError(`无法读取旧任务状态: ${legacyPath}\n${legacyError.message}`)
    }
    const migrated = parseState(raw, legacyPath, repo)
    await writeState(stateDir, migrated)
    return migrated
  }
  return parseState(raw, file, repo)
}

export async function writeState(stateDir, state) {
  const file = statePath(stateDir)
  await fs.mkdir(stateDir, { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await fs.rename(tmp, file)
}

/** Resolve the current checkout, its shared .git, task state, and task binding. */
export async function repoContext(git, cwd) {
  const root = await repoRoot(git, cwd)
  const common = await commonDir(git, cwd)
  const mainRoot = await mainWorktreeRoot(git, cwd)
  const stateDir = repoStateDir(mainRoot, common)
  const repoLocalState = path.join(common, 'dsh-worktree')
  const legacyPath = path.resolve(stateDir) === path.resolve(repoLocalState)
    ? null
    : path.join(repoLocalState, STATE_FILE)
  const state = await readState(stateDir, mainRoot, legacyPath)
  let task = null
  for (const candidate of Object.values(state.tasks)) {
    if (candidate?.worktree && path.resolve(candidate.worktree) === path.resolve(root)) {
      task = candidate
      break
    }
  }
  return {
    root,
    common,
    mainRoot,
    stateDir,
    stateFile: statePath(stateDir),
    state,
    task,
    taskName: task?.name ?? null,
    repo: state.repo || mainRoot,
  }
}

export function requireMainContext(context) {
  if (context.task) {
    throw new WorktreeError(
      `该操作必须在主项目目录执行。\n当前目录是任务 worktree: ${context.taskName}\n主项目目录: ${context.repo}`,
    )
  }
}

export function getTask(context, name) {
  const task = context.state.tasks[name]
  if (!task) throw new WorktreeError(`未找到任务: ${name}`)
  return task
}
