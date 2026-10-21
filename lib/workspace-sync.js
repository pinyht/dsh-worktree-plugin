import fs from 'node:fs'
import path from 'node:path'
import { repoStateId } from './state.js'

const DEFAULT_INTERVAL_MS = 2000

function canonical(target) {
  try {
    return fs.realpathSync.native(target)
  } catch {
    return path.resolve(target)
  }
}

function isFile(target) {
  try {
    return fs.statSync(target).isFile()
  } catch {
    return false
  }
}

function stateFileForRepo(repoPath) {
  const local = path.join(repoPath, '.git', 'dsh-worktree', 'tasks.json')
  if (isFile(local)) return local
  const stateRoot = process.env.WORKTREE_STATE || process.env.DSH_WORKTREE_STATE
  if (!stateRoot) return null
  const file = path.join(path.resolve(stateRoot), repoStateId(repoPath), 'tasks.json')
  return isFile(file) ? file : null
}

function readTasks(file) {
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'))
    return state && typeof state.tasks === 'object' && state.tasks !== null ? state.tasks : {}
  } catch {
    return {}
  }
}

/**
 * Add a DSH workspace for every task in the states of known main workspaces.
 *
 * The skill CLI cannot call the client workspace API, and the old panel's
 * auto-open is gone. This host-side poller restores the useful half: a new
 * task worktree appears in the sidebar within a few seconds and the user only
 * has to click it. It never deletes workspace registrations.
 */
export function startWorkspaceSync(ctx, registry, { intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  let busy = false
  const warned = new Set()

  async function tick() {
    if (busy) return
    busy = true
    try {
      const workspaces = registry.list()
      const known = new Map(workspaces.map((workspace) => [canonical(workspace.path), workspace]))
      for (const workspace of workspaces) {
        const stateFile = stateFileForRepo(workspace.path)
        if (!stateFile) continue
        const tasks = readTasks(stateFile)
        for (const task of Object.values(tasks)) {
          if (!task?.name || !task.worktree) continue
          let worktree
          try {
            worktree = canonical(task.worktree)
            if (!fs.statSync(worktree).isDirectory()) continue
          } catch {
            continue
          }
          if (known.has(worktree)) continue
          if (worktree === canonical(workspace.path)) continue
          const title = `${workspace.title || path.basename(workspace.path)} · ${task.name}`
          try {
            const created = await registry.create(worktree, title)
            known.set(canonical(created.path), created)
            ctx.logger?.info?.(`[dsh-worktree] auto-added workspace: ${title}`)
          } catch (error) {
            if (!warned.has(worktree)) {
              warned.add(worktree)
              ctx.logger?.warn?.(`[dsh-worktree] auto workspace failed for ${worktree}: ${error?.message ?? error}`)
            }
          }
        }
      }
    } catch (error) {
      ctx.logger?.warn?.(`[dsh-worktree] workspace sync failed: ${error?.message ?? error}`)
    } finally {
      busy = false
    }
  }

  const timer = setInterval(() => { void tick() }, intervalMs)
  timer.unref?.()
  void tick()
  return () => clearInterval(timer)
}
