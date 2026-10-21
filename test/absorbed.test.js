import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createLocalGit } from '../lib/git.js'
import { createEngine } from '../lib/engine.js'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-absorbed')
const REPO = path.join(ROOT, `repo-${Date.now()}`)

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

async function main() {
  await fs.mkdir(REPO, { recursive: true })
  await sh('git', ['init', '-q'], REPO)
  await sh('git', ['config', 'user.email', 'test@example.com'], REPO)
  await sh('git', ['config', 'user.name', 'Test'], REPO)
  await sh('git', ['config', 'commit.gpgsign', 'false'], REPO)
  await write(path.join(REPO, 'CHANGELOG.md'), '# log\n\n## old\n- old\n')
  await write(path.join(REPO, 'code.txt'), 'base\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'init'], REPO)

  const git = createLocalGit()
  const engine = createEngine({ git, sessionQuery: null })

  const created = await engine.newTask({ cwd: REPO, name: 'seedhub-like' })
  const taskPath = created.data.task.worktree
  const taskHead = (await sh('git', ['rev-parse', 'HEAD'], taskPath)).trim()

  // The task's uncommitted work, exactly as it would look after development.
  await write(path.join(taskPath, 'CHANGELOG.md'), '# log\n\n## task\n- t\n\n## old\n- old\n')
  await write(path.join(taskPath, 'code.txt'), 'base\ntask\n')
  await write(path.join(taskPath, 'new-file.txt'), 'brand new\n')

  // The user merged it by hand in main and committed: main carries the task
  // entry plus its own newer entry at the top, so a three-way replay conflicts
  // even though nothing from the task is missing.
  await write(path.join(REPO, 'CHANGELOG.md'), '# log\n\n## PT\n- p\n\n## task\n- t\n\n## old\n- old\n')
  await write(path.join(REPO, 'code.txt'), 'base\ntask\n')
  await write(path.join(REPO, 'new-file.txt'), 'brand new\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'manual merge of task'], REPO)
  const mainHead = (await sh('git', ['rev-parse', 'HEAD'], REPO)).trim()
  await sh('git', ['merge-base', '--is-ancestor', taskHead, mainHead], REPO)

  const listed = await engine.list({ cwd: REPO })
  assert.equal(listed.data.tasks[0].dirty, '已被主线吸收')

  // Merge must not replay the patch into a duplicate conflict.
  const merged = await engine.mergeTask({ cwd: REPO, name: 'seedhub-like' })
  assert.ok(merged.text.includes('已包含在主项目当前提交中'), merged.text)
  assert.ok(!merged.text.includes('冲突'), merged.text)
  assert.equal((await sh('git', ['status', '--porcelain'], taskPath)).trim(), '')
  assert.equal((await sh('git', ['rev-parse', 'HEAD'], taskPath)).trim(), mainHead)
  assert.equal(await fs.readFile(path.join(REPO, 'CHANGELOG.md'), 'utf8'), '# log\n\n## PT\n- p\n\n## task\n- t\n\n## old\n- old\n')

  // End must now succeed without --force.
  const ended = await engine.endTask({ cwd: REPO, name: 'seedhub-like', force: false })
  assert.ok(ended.text.includes('已清理 worktree 任务'))
  assert.equal((await fs.access(taskPath).then(() => true, () => false)), false)
  assert.equal((await sh('git', ['branch', '--list', created.data.task.branch], REPO)).trim(), '')
  assert.deepEqual((await engine.list({ cwd: REPO })).data.tasks, [])

  // Ending a previewed task must restore the main slot before refusing, not
  // leave the copied preview changes behind without a record.
  const previewTask = await engine.newTask({ cwd: REPO, name: 'preview-task' })
  const previewPath = previewTask.data.task.worktree
  await write(path.join(previewPath, 'code.txt'), 'base\npreview only\n')
  await engine.switchTask({ cwd: REPO, name: 'preview-task' })
  assert.equal((await sh('git', ['status', '--porcelain'], REPO)).trim(), 'M code.txt')
  await assert.rejects(
    engine.endTask({ cwd: REPO, name: 'preview-task', force: false }),
    /未合并改动/,
  )
  assert.equal((await sh('git', ['status', '--porcelain'], REPO)).trim(), '')
  assert.equal((await engine.list({ cwd: REPO })).data.main.preview, null)
  await engine.endTask({ cwd: REPO, name: 'preview-task', force: true })
  assert.equal((await fs.access(previewPath).then(() => true, () => false)), false)

  // A genuine divergent change must still be blocked, and force must override.
  const conflictTask = await engine.newTask({ cwd: REPO, name: 'real-conflict' })
  const conflictPath = conflictTask.data.task.worktree
  await write(path.join(conflictPath, 'CHANGELOG.md'), '# log\n\n## task version\n- x\n\n## old\n- old\n')
  await write(path.join(REPO, 'CHANGELOG.md'), '# log\n\n## main version\n- y\n\n## old\n- old\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'main diverges'], REPO)

  const blocked = await engine.list({ cwd: REPO })
  assert.equal(blocked.data.tasks[0].dirty, '有未合并改动')
  await assert.rejects(
    engine.endTask({ cwd: REPO, name: 'real-conflict', force: false }),
    /未合并改动/,
  )
  await engine.endTask({ cwd: REPO, name: 'real-conflict', force: true })
  assert.equal((await fs.access(conflictPath).then(() => true, () => false)), false)

  // A locked worktree must still be removable by force.
  const lockedTask = await engine.newTask({ cwd: REPO, name: 'locked-task' })
  await sh('git', ['worktree', 'lock', lockedTask.data.task.worktree], REPO)
  const lockedEnd = await engine.endTask({ cwd: REPO, name: 'locked-task', force: true })
  assert.ok(lockedEnd.text.includes('已清理 worktree 任务'))
  assert.equal((await fs.access(lockedTask.data.task.worktree).then(() => true, () => false)), false)
  assert.deepEqual((await engine.list({ cwd: REPO })).data.tasks, [])

  console.log('ABSORBED TEST PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
