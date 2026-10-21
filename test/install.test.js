import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-install')
const HOME = path.join(ROOT, `home-${Date.now()}`)
const SKILLS = path.join(ROOT, `skills-${Date.now()}`)
const RUNTIME = path.join(ROOT, `runtime-${Date.now()}`)
const INSTALLER = fileURLToPath(new URL('../scripts/install.mjs', import.meta.url))

const result = spawnSync(process.execPath, [
  INSTALLER,
  '--skills-root', SKILLS,
  '--runtime-dir', RUNTIME,
], {
  env: { ...process.env, HOME },
  encoding: 'utf8',
})

assert.equal(result.status, 0, result.stderr)
assert.ok(result.stdout.includes(SKILLS))
assert.ok(result.stdout.includes(RUNTIME))

const skill = fs.readFileSync(path.join(SKILLS, 'worktree-end', 'SKILL.md'), 'utf8')
assert.ok(skill.includes('worktree-task.mjs'))
assert.ok(!skill.includes('{{CLI}}'))
assert.ok(skill.includes(RUNTIME))
assert.ok(fs.existsSync(path.join(SKILLS, 'worktree-end', '.dsh-worktree-owned')))
assert.ok(fs.existsSync(path.join(SKILLS, 'worktree-commit', 'SKILL.md')))
assert.equal(fs.existsSync(path.join(SKILLS, 'dsh-worktree')), false)

for (const file of ['engine.js', 'git.js', 'state.js', 'dsh-sessions.js', 'errors.js']) {
  assert.ok(fs.existsSync(path.join(RUNTIME, 'lib', file)), file)
}
assert.ok(fs.existsSync(path.join(RUNTIME, 'scripts', 'worktree-task.mjs')))

const help = spawnSync(process.execPath, [path.join(RUNTIME, 'scripts', 'worktree-task.mjs'), 'help'], {
  env: { ...process.env, HOME, DSH_HOME: path.join(HOME, '.dsh') },
  encoding: 'utf8',
})
assert.equal(help.status, 0, help.stderr)
assert.ok(help.stdout.includes('/worktree-new'))

console.log('INSTALL TEST PASSED')
