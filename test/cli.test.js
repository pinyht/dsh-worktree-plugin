import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-cli')
const REPO = path.join(ROOT, `repo-${Date.now()}`)
const HOME = path.join(ROOT, `home-${Date.now()}`)
const CLI = fileURLToPath(new URL('../scripts/worktree-task.mjs', import.meta.url))

function sh(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0
      ? resolve(stdout)
      : reject(new Error(`${command} ${args.join(' ')}: ${stderr || stdout}`)))
  })
}

function cli(args, cwd = REPO) {
  const env = {
    ...process.env,
    HOME,
    DSH_HOME: path.join(HOME, '.dsh'),
    WORKTREE_STATE: path.join(HOME, '.dsh-worktree', 'state'),
  }
  return spawnSync(process.execPath, [CLI, ...args], { cwd, env, encoding: 'utf8' })
}

async function main() {
  fs.mkdirSync(REPO, { recursive: true })
  await sh('git', ['init', '-q'], REPO)
  await sh('git', ['config', 'user.email', 'test@example.com'], REPO)
  await sh('git', ['config', 'user.name', 'Test'], REPO)
  await sh('git', ['config', 'commit.gpgsign', 'false'], REPO)
  fs.writeFileSync(path.join(REPO, 'README.md'), 'base\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'init'], REPO)

  const help = cli(['help'])
  assert.equal(help.status, 0, help.stderr)
  assert.ok(help.stdout.includes('/worktree-new'))
  assert.ok(help.stdout.includes('/worktree-end'))

  const created = cli(['new', 'cli-task'])
  assert.equal(created.status, 0, created.stderr)
  const worktree = created.stdout.split('\n').find((line) => line.startsWith('目录: '))?.slice('目录: '.length).trim()
  assert.ok(worktree, created.stdout)
  assert.ok(created.stdout.includes('已创建 worktree 任务: cli-task'))
  assert.ok(fs.existsSync(path.join(worktree, 'README.md')))
  assert.ok(fs.existsSync(path.join(HOME, '.dsh-worktree', 'state')))

  const listed = cli(['list'])
  assert.equal(listed.status, 0, listed.stderr)
  assert.ok(listed.stdout.includes('cli-task'))
  assert.ok(listed.stdout.includes(worktree))

  const inTask = cli(['current'], worktree)
  assert.equal(inTask.status, 0, inTask.stderr)
  assert.ok(inTask.stdout.includes('当前窗口位于任务 worktree: cli-task'))

  const status = cli(['status'])
  assert.equal(status.status, 0, status.stderr)
  assert.ok(status.stdout.includes('当前位于主项目目录'))

  const missing = cli(['end', 'missing'])
  assert.equal(missing.status, 1)
  assert.ok(missing.stderr.includes('未找到任务'))

  const ended = cli(['end', 'cli-task', '--force'])
  assert.equal(ended.status, 0, ended.stderr)
  assert.ok(ended.stdout.includes('已清理 worktree 任务: cli-task'))
  assert.equal(fs.existsSync(worktree), false)

  const empty = cli(['list'])
  assert.equal(empty.status, 0, empty.stderr)
  assert.ok(!empty.stdout.includes('- cli-task'))

  console.log('CLI TEST PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
