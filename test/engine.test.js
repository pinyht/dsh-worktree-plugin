import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createLocalGit } from '../lib/git.js'
import { createEngine, taskMemory } from '../lib/engine.js'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-test')
const REPO = path.join(ROOT, `repo-${Date.now()}`)
const REMOTE = path.join(ROOT, `remote-${Date.now()}.git`)

function sh(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`${command} ${args.join(' ')}: ${stderr || stdout}`)))
  })
}

async function write(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, content)
}

async function read(file) {
  return fs.readFile(file, 'utf8')
}

async function main() {
  await fs.mkdir(ROOT, { recursive: true })
  await fs.mkdir(REPO, { recursive: true })
  await sh('git', ['init', '-q'], REPO)
  await sh('git', ['config', 'user.email', 'test@example.com'], REPO)
  await sh('git', ['config', 'user.name', 'Test'], REPO)
  await sh('git', ['config', 'commit.gpgsign', 'false'], REPO)
  await write(path.join(REPO, 'README.md'), 'base\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'init'], REPO)

  await fs.mkdir(REMOTE, { recursive: true })
  await sh('git', ['init', '--bare', '-q'], REMOTE)
  await sh('git', ['remote', 'add', 'origin', REMOTE], REPO)
  await sh('git', ['push', '-q', '-u', 'origin', 'HEAD'], REPO)

  const git = createLocalGit()
  const engine = createEngine({ git, sessionQuery: null })

  const created = await engine.newTask({ cwd: REPO, name: '修复登录' })
  const taskPath = created.data.task.worktree
  assert.ok(taskPath.startsWith(path.join(REPO, '.agents', 'worktrees')))
  assert.equal((await sh('git', ['status', '--porcelain'], REPO)).trim(), '')
  assert.ok((await read(path.join(taskPath, 'README.md'))).includes('base'))

  const listing = await engine.list({ cwd: REPO })
  assert.equal(listing.data.tasks.length, 1)
  assert.equal(listing.data.tasks[0].dirty, '干净')

  await write(path.join(taskPath, 'README.md'), 'base\ntask change\n')
  await write(path.join(taskPath, 'src', 'login.js'), 'export const login = true\n')
  const dirty = await engine.list({ cwd: REPO })
  assert.equal(dirty.data.tasks[0].dirty, '有未合并改动')
  assert.equal(dirty.data.tasks[0].changes.length, 2)

  const switched = await engine.switchTask({ cwd: REPO, name: '修复登录' })
  assert.ok(switched.text.includes('预览'))
  assert.ok((await read(path.join(REPO, 'README.md'))).includes('task change'))
  assert.ok((await read(path.join(REPO, 'src', 'login.js'))).includes('login'))
  const previewCurrent = await engine.current({ cwd: REPO })
  assert.equal(previewCurrent.data.preview?.task, '修复登录')

  await engine.switchClear({ cwd: REPO })
  assert.equal((await read(path.join(REPO, 'README.md'))), 'base\n')
  assert.equal((await sh('git', ['status', '--porcelain'], REPO)).trim(), '')

  const merged = await engine.mergeTask({ cwd: REPO, name: '修复登录' })
  assert.ok(merged.text.includes('待合并文件'))
  assert.ok((await read(path.join(REPO, 'README.md'))).includes('task change'))
  assert.ok((await read(path.join(REPO, 'src', 'login.js'))).includes('login'))
  assert.equal((await sh('git', ['status', '--porcelain'], REPO)).trim().split('\n').length, 2)
  const afterMerge = await engine.list({ cwd: REPO })
  assert.equal(afterMerge.data.tasks[0].dirty, '干净')
  assert.equal(afterMerge.data.tasks[0].status, 'merged-to-main-pending-user-commit')

  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'merge login'], REPO)
  const synced = await engine.syncTasks({ cwd: REPO, name: '修复登录', all: false })
  assert.ok(synced.text.includes('已带入主项目最新提交') || synced.text.includes('已包含主项目最新提交'))
  assert.equal(
    (await sh('git', ['rev-parse', 'HEAD'], taskPath)).trim(),
    (await sh('git', ['rev-parse', 'HEAD'], REPO)).trim(),
  )

  await write(path.join(taskPath, 'migrations', '18.sql'), 'create table t(id int);\n')
  const taken = await engine.takeSql({ cwd: REPO, name: '修复登录', sqlPaths: ['migrations/18.sql'] })
  assert.ok(taken.text.includes('migrations/18.sql'))
  assert.ok((await read(path.join(REPO, 'migrations', '18.sql'))).includes('create table'))
  await assert.rejects(fs.access(path.join(taskPath, 'migrations', '18.sql')))
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'sql'], REPO)
  await engine.syncTasks({ cwd: REPO, name: '修复登录', all: false })

  await write(path.join(taskPath, 'migrations', '19.sql'), 'create table u(id int);\n')
  const pushed = await engine.pushSql({ cwd: REPO, name: '修复登录', sqlPaths: ['migrations/19.sql'] })
  assert.ok(pushed.text.includes('已执行 git push'))
  assert.ok((await read(path.join(REPO, 'migrations', '19.sql'))).includes('create table u'))
  assert.ok((await sh('git', ['log', '--oneline', '-1'], REPO)).includes('add migrations/19.sql'))

  const memory = await taskMemory({
    filterSessions: async () => [{ header: { id: 's1', cwd: taskPath } }],
    readSession: async () => ({
      events: [
        { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '请修复登录跳转' }] } },
        { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '已完成登录修复' }] } } },
      ],
    }),
  }, taskPath)
  assert.deepEqual(memory.prompts, ['请修复登录跳转'])
  assert.equal(memory.summary, '已完成登录修复')

  await write(path.join(taskPath, 'README.md'), 'base\nconflict from task\n')
  await write(path.join(REPO, 'README.md'), 'base\nconflict from main\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'main conflict'], REPO)
  await assert.rejects(
    engine.mergeTask({ cwd: REPO, name: '修复登录' }),
    /冲突/,
  )
  await sh('git', ['reset', '--hard', 'HEAD'], REPO)
  await sh('git', ['clean', '-fd'], REPO)

  await assert.rejects(engine.endTask({ cwd: REPO, name: '修复登录', force: false }), /未合并改动/)
  await engine.endTask({ cwd: REPO, name: '修复登录', force: true })
  await assert.rejects(engine.info({ cwd: REPO, name: '修复登录' }), /未找到任务/)

  console.log('ENGINE TEST PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
