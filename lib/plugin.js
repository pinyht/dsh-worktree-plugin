import { createHostGit } from './git.js'
import { createEngine } from './engine.js'
import { registerCommands } from './commands.js'

export const inject = ['commands', 'workingDirectory', 'subprocess']

/**
 * Host half of dsh-worktree.
 *
 * Commands are human-facing only: no model tool is registered. The engine runs
 * Git through the Host's subprocess service; the task state lives in the main
 * repository's `.git/dsh-worktree/tasks.json`.
 */
export function apply(ctx) {
  const git = createHostGit(ctx)
  const sessionQuery = ctx.get('sessionQuery')
  const engine = createEngine({ git, sessionQuery })
  registerCommands(ctx, engine)
  ctx.logger?.info?.('[dsh-worktree] task engine ready')
}
