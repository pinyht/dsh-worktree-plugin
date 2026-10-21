import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { apply } from '../lib/plugin.js'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-plugin')
const DSH_HOME = path.join(ROOT, `dsh-${Date.now()}`)
const SKILLS = path.join(DSH_HOME, 'skills')
const RUNTIME = path.join(DSH_HOME, 'dsh-worktree')
process.env.DSH_HOME = DSH_HOME

const logs = []
apply({
  logger: {
    info(message) { logs.push(message) },
    warn(message) { logs.push(message) },
  },
})

const expected = [
  'worktree-commit',
  'worktree-current',
  'worktree-end',
  'worktree-help',
  'worktree-info',
  'worktree-list',
  'worktree-merge',
  'worktree-new',
  'worktree-push-sql',
  'worktree-status',
  'worktree-switch',
  'worktree-sync',
  'worktree-take-sql',
]

assert.deepEqual(
  fs.readdirSync(SKILLS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(),
  expected,
)
assert.equal(logs.length, 1)
assert.ok(logs[0].includes(`installed 13 worktree skills into ${SKILLS}`), logs[0])

for (const skill of expected) {
  const target = path.join(SKILLS, skill)
  const text = fs.readFileSync(path.join(target, 'SKILL.md'), 'utf8')
  if (skill === 'worktree-commit') {
    assert.ok(!text.includes('disable-model-invocation: true'), skill)
  } else {
    assert.ok(text.includes('disable-model-invocation: true'), skill)
  }
  assert.ok(text.includes(path.join(RUNTIME, 'scripts', 'worktree-task.mjs')), skill)
  assert.ok(!text.includes('{{CLI}}'), skill)
  assert.ok(fs.existsSync(path.join(target, '.dsh-worktree-owned')), skill)
}

for (const file of ['engine.js', 'git.js', 'state.js', 'dsh-sessions.js', 'errors.js']) {
  assert.ok(fs.existsSync(path.join(RUNTIME, 'lib', file)), file)
}

const help = spawnSync(process.execPath, [path.join(RUNTIME, 'scripts', 'worktree-task.mjs'), 'help'], {
  env: { ...process.env, DSH_HOME },
  encoding: 'utf8',
})
assert.equal(help.status, 0, help.stderr)
assert.ok(help.stdout.includes('/worktree-new'))

console.log('PLUGIN INSTALL TEST PASSED')
