import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-cli-memory')
const HOME = path.join(ROOT, `home-${Date.now()}`)
const DSH_HOME = path.join(HOME, '.dsh')
const REPO = path.join(ROOT, `repo-${Date.now()}`)
const CLI = fileURLToPath(new URL('../scripts/worktree-task.mjs', import.meta.url))

function sh(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr)))
  })
}

function cli(args, cwd = REPO) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    env: {
      ...process.env,
      HOME,
      DSH_HOME,
      WORKTREE_STATE: path.join(ROOT, 'state'),
    },
    encoding: 'utf8',
  })
}

function frame(event) {
  return zlib.zstdCompressSync(Buffer.from(`${JSON.stringify(event)}\n`))
}

async function main() {
  fs.mkdirSync(REPO, { recursive: true })
  await sh('git', ['init', '-q'], REPO)
  await sh('git', ['config', 'user.email', 'test@example.com'], REPO)
  await sh('git', ['config', 'user.name', 'Test'], REPO)
  fs.writeFileSync(path.join(REPO, 'README.md'), 'base\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'init'], REPO)

  const created = cli(['new', 'mem-task'])
  assert.equal(created.status, 0, created.stderr)
  const taskPath = created.stdout.split('\n').find((line) => line.startsWith('目录: '))?.slice('目录: '.length).trim()
  assert.ok(taskPath, created.stdout)

  const sessionDir = path.join(DSH_HOME, 'sessions', '--project--', 'session-memory')
  fs.mkdirSync(sessionDir, { recursive: true })
  fs.writeFileSync(
    path.join(sessionDir, 'session.v4.jsonl.zstd'),
    Buffer.concat([
      frame({ type: 'session', version: 4, id: 'memory', createdAt: 1790000000000, cwd: taskPath }),
      frame({
        type: 'user/message',
        data: { source: { kind: 'user' }, content: [{ type: 'text', text: '请修复登录跳转' }] },
      }),
      frame({
        type: 'assistant/message',
        data: { message: { content: [{ type: 'text', text: '已完成登录修复' }] } },
      }),
    ]),
  )

  fs.writeFileSync(path.join(taskPath, 'README.md'), 'base\ntask change\n')
  const merged = cli(['merge', 'mem-task'])
  assert.equal(merged.status, 0, merged.stderr)
  assert.ok(merged.stdout.includes('任务会话记忆'), merged.stdout)
  assert.ok(merged.stdout.includes('请修复登录跳转'), merged.stdout)
  assert.ok(merged.stdout.includes('已完成登录修复'), merged.stdout)
  assert.ok(fs.readFileSync(path.join(REPO, 'README.md'), 'utf8').includes('task change'))

  const commitContext = cli(['commit-context'])
  assert.equal(commitContext.status, 0, commitContext.stderr)
  assert.ok(commitContext.stdout.includes('任务: mem-task'), commitContext.stdout)
  assert.ok(commitContext.stdout.includes('任务会话记忆'), commitContext.stdout)
  assert.ok(commitContext.stdout.includes('请修复登录跳转'), commitContext.stdout)
  assert.ok(commitContext.stdout.includes('本次合并文件'), commitContext.stdout)
  assert.ok(commitContext.stdout.includes('README.md'), commitContext.stdout)
  assert.ok(commitContext.stdout.includes('主项目 diff'), commitContext.stdout)

  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'test commit'], REPO)
  const marked = cli(['mark-committed', 'mem-task'])
  assert.equal(marked.status, 0, marked.stderr)
  assert.ok(marked.stdout.includes('已记录任务提交: mem-task'))
  assert.ok(cli(['list']).stdout.includes('状态: active'))

  const ended = cli(['end', 'mem-task', '--force'])
  assert.equal(ended.status, 0, ended.stderr)

  console.log('CLI MEMORY TEST PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
