import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { startWorkspaceSync } from '../lib/workspace-sync.js'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-workspace-sync')
const REPO = path.join(ROOT, `repo-${Date.now()}`)
const TASK = path.join(REPO, '.agents', 'worktrees', 'task-demo')

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(predicate, timeoutMs = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return true
    await delay(10)
  }
  return false
}

async function main() {
  await fs.mkdir(path.join(REPO, '.git', 'dsh-worktree'), { recursive: true })
  await fs.mkdir(TASK, { recursive: true })
  await fs.writeFile(path.join(REPO, '.git', 'dsh-worktree', 'tasks.json'), `${JSON.stringify({
    version: 1,
    repo: REPO,
    tasks: {
      demo: {
        name: 'demo',
        branch: 'worktree/demo',
        worktree: TASK,
        status: 'active',
      },
    },
    preview: null,
  }, null, 2)}\n`)

  const workspaces = [{ id: 'main', path: REPO, title: path.basename(REPO) }]
  const warnings = []
  const registry = {
    list: () => workspaces,
    create: async (target, title) => {
      const workspace = { id: `w-${workspaces.length + 1}`, path: target, title }
      workspaces.push(workspace)
      return workspace
    },
  }
  const ctx = {
    logger: {
      info() {},
      warn(message) { warnings.push(message) },
    },
  }

  const stop = startWorkspaceSync(ctx, registry, { intervalMs: 20 })
  assert.ok(await waitFor(() => workspaces.length === 2), 'workspace was not auto-added')
  assert.equal(workspaces[1].path, TASK)
  assert.equal(workspaces[1].title, `${path.basename(REPO)} · demo`)
  assert.deepEqual(warnings, [])

  await delay(80)
  assert.equal(workspaces.length, 2, 'workspace was added twice')
  stop()

  console.log('WORKSPACE SYNC TEST PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
