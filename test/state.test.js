import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createLocalGit } from '../lib/git.js'
import { createEngine } from '../lib/engine.js'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-state')
const REPO = path.join(ROOT, `repo-${Date.now()}`)

function sh(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr)))
  })
}

async function main() {
  await fs.mkdir(REPO, { recursive: true })
  await sh('git', ['init', '-q'], REPO)
  await sh('git', ['config', 'user.email', 'test@example.com'], REPO)
  await sh('git', ['config', 'user.name', 'Test'], REPO)
  await fs.writeFile(path.join(REPO, 'README.md'), 'base\n')
  await sh('git', ['add', '-A'], REPO)
  await sh('git', ['commit', '-qm', 'init'], REPO)

  const legacyFile = path.join(REPO, '.git', 'dsh-worktree', 'tasks.json')
  await fs.mkdir(path.dirname(legacyFile), { recursive: true })
  await fs.writeFile(legacyFile, `${JSON.stringify({
    version: 1,
    repo: REPO,
    tasks: {
      legacy: {
        name: 'legacy',
        branch: 'worktree/legacy',
        worktree: path.join(REPO, 'does-not-exist'),
        status: 'active',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
    },
    preview: null,
  }, null, 2)}\n`)

  const engine = createEngine({ git: createLocalGit(), sessionQuery: null })
  const local = await engine.list({ cwd: REPO })
  assert.equal(local.data.stateFile, legacyFile)
  assert.equal(local.data.tasks.length, 1)
  assert.equal(local.data.tasks[0].name, 'legacy')
  assert.equal(local.data.tasks[0].exists, false)

  // Opting into the home layout imports the repo-local file once.
  const homeState = path.join(ROOT, 'home-state')
  process.env.WORKTREE_STATE = homeState
  const home = await engine.list({ cwd: REPO })
  assert.ok(!home.data.stateFile.includes(`${path.sep}.git${path.sep}`), home.data.stateFile)
  assert.ok(home.data.stateFile.startsWith(homeState), home.data.stateFile)
  assert.equal(home.data.tasks.length, 1)
  await fs.access(home.data.stateFile)

  console.log('STATE MIGRATION TEST PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
