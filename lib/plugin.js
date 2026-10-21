import { installSkills } from './install-skills.js'
import { startWorkspaceSync } from './workspace-sync.js'

export const inject = []

/**
 * Host half of dsh-worktree.
 *
 * Plugin installation is an installer for the self-contained skill bundle:
 * skills, the standalone CLI, and its lib are copied to `~/.dsh/skills`.
 * DSH's filesystem provider scans one level under a skill root, so the 13
 * skills become direct children there; the CLI/lib live beside them in
 * `~/.dsh/dsh-worktree` and keep working if the plugin is removed.
 *
 * The host also polls task states of known workspaces and registers new task
 * worktrees as workspaces, replacing the panel's auto-add without a client.
 */
export function apply(ctx) {
  try {
    const result = installSkills()
    ctx.logger?.info?.(
      `[dsh-worktree] installed ${result.skills.length} worktree skills into ${result.skillsRoot} (runtime: ${result.runtimeDir})`,
    )
  } catch (error) {
    ctx.logger?.warn?.(
      `[dsh-worktree] skill install failed: ${error?.message ?? error}\n`
      + '可以手动执行: node <plugin>/scripts/install.mjs --force',
    )
  }

  if (typeof ctx.inject === 'function') {
    ctx.inject(['workspaceRegistry'], (registryCtx) => {
      const stop = startWorkspaceSync(registryCtx, registryCtx.workspaceRegistry)
      registryCtx.effect(() => stop)
    })
  }
}
