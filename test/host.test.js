import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { apply } from '../lib/plugin.js'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-test')
const REPO = path.join(ROOT, `host-${Date.now()}`)

function sh(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || stdout)))
  })
}

function fakeSubprocess() {
  return {
    spawn(spec) {
      const child = spawn(spec.argv[0], spec.argv.slice(1), {
        cwd: spec.cwd,
        env: spec.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
      child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
      const done = new Promise((resolve) => {
        child.on('error', (error) => resolve({ exitCode: 1, signal: null, error }))
        child.on('close', (code, signal) => resolve({ exitCode: code ?? 1, signal }))
      })
      const reader = (get) => ({ readFrom: () => ({ text: get(), nextOffset: 0, lossy: false }) })
      return {
        done,
        collected: { stdout: reader(() => stdout), stderr: reader(() => stderr) },
        terminate: () => child.kill(),
      }
    },
  }
}

async function main() {
  await fs.mkdir(ROOT, { recursive: true })
  await fs.mkdir(REPO, { recursive: true })
  await sh('git', ['init', '-q'], REPO)
  await sh('git', ['config', 'user.email', 'test@example.com'], REPO)
  await sh('git', ['config', 'user.name', 'Test'], REPO)
  await fs.writeFile(path.join(REPO, 'README.md'), 'base\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'init'], REPO)

  const commands = new Map()
  const followups = []
  const agent = { session: {}, followup: (message) => followups.push(message) }
  const ctx = {
    subprocess: fakeSubprocess(),
    workingDirectory: { get: () => REPO },
    commands: { register: (definition) => { commands.set(definition.name, definition); return () => {} } },
    effect: (fn) => { fn() },
    get: () => undefined,
    logger: { info: () => {} },
  }
  apply(ctx)
  assert.equal(commands.size, 12)

  const call = async (name, rawInput) => {
    const result = await commands.get(name).handler({ agent, rawInput })
    assert.equal(result.kind, 'success', result.text)
    return result.text
  }

  const created = JSON.parse(await call('worktree-new', 'host-task --json'))
  assert.ok(created.task.worktree.includes('host-task'))
  const listed = JSON.parse(await call('worktree-list', '--json'))
  assert.equal(listed.tasks.length, 1)
  assert.ok((await call('worktree-help', '')).includes('/worktree-new'))
  assert.ok((await call('worktree-current', '')).includes('主项目目录'))
  assert.ok((await call('worktree-status', '')).includes('当前位于主项目目录'))

  await fs.writeFile(path.join(created.task.worktree, 'README.md'), 'base\nhost change\n')
  assert.ok((await call('worktree-switch', 'host-task')).includes('预览'))
  assert.ok((await fs.readFile(path.join(REPO, 'README.md'), 'utf8')).includes('host change'))
  await call('worktree-switch', '--clear')
  assert.equal(await fs.readFile(path.join(REPO, 'README.md'), 'utf8'), 'base\n')

  const merged = await call('worktree-merge', 'host-task')
  assert.ok(merged.includes('已把任务改动三方合并'))
  assert.ok((await fs.readFile(path.join(REPO, 'README.md'), 'utf8')).includes('host change'))
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'merge'], REPO)
  await call('worktree-sync', 'host-task')
  await call('worktree-end', 'host-task --force')
  const empty = JSON.parse(await call('worktree-list', '--json'))
  assert.equal(empty.tasks.length, 0)

  const conflictTask = JSON.parse(await call('worktree-new', 'conflict-task --json'))
  await fs.writeFile(path.join(conflictTask.task.worktree, 'README.md'), 'base\nconflict task\n')
  await fs.writeFile(path.join(REPO, 'README.md'), 'base\nconflict main\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'conflict main'], REPO)
  const conflictResult = await call('worktree-merge', 'conflict-task')
  assert.ok(conflictResult.includes('已交给 Agent 分析'))
  assert.equal(followups.length, 1)
  assert.equal(followups[0].role, 'user')
  assert.ok(followups[0].content[0].text.includes('系统自动触发'))
  assert.ok(followups[0].content[0].text.includes('冲突'))
  await sh('git', ['reset', '--hard', 'HEAD'], REPO)
  await sh('git', ['clean', '-fd'], REPO)
  await call('worktree-end', 'conflict-task --force')

  console.log('HOST PLUGIN TEST PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
