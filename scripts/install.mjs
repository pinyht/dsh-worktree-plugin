#!/usr/bin/env node
/**
 * Install the DSH worktree skills without the Cordis plugin.
 *
 * The plugin path (Plugins UI) runs the same installation on boot. This script
 * is for users who prefer plain files under `~/.dsh/skills`.
 */
import { defaultRuntimeDir, defaultSkillsRoot, installSkills } from '../lib/install-skills.js'

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const skillsRoot = option('--skills-root', defaultSkillsRoot())
const runtimeDir = option('--runtime-dir', defaultRuntimeDir())
const force = args.includes('--force')

try {
  const result = installSkills({ skillsRoot, runtimeDir, force })
  process.stdout.write([
    `已安装 ${result.skills.length} 个 worktree skills。`,
    `Skills:  ${result.skillsRoot}`,
    `Runtime: ${result.runtimeDir}`,
    '',
    '下一步：',
    '1. 新开一个 DSH 会话（或刷新页面），输入 /worktree-help 验证；',
    '2. 不需要安装 Cordis 插件；如果之前装过 dsh-worktree-plugin，建议在 Plugins 里卸载，避免重复安装；',
    '3. 任务状态默认在 <repo>/.git/dsh-worktree/，worktree 默认在 <repo>/.agents/worktrees/；需要外部布局时设置 WORKTREE_STATE / WORKTREE_ROOT=sibling。',
    '',
  ].join('\n'))
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
