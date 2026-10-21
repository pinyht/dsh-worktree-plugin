import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ownedMarker = '.dsh-worktree-owned'
const runtimeMarker = '.dsh-worktree-runtime'

export function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

export function defaultSkillsRoot() {
  return path.join(dshHome(), 'skills')
}

export function defaultRuntimeDir() {
  return path.join(dshHome(), 'dsh-worktree')
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true })
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name)
    const to = path.join(destination, entry.name)
    if (entry.isDirectory()) copyTree(from, to)
    else if (entry.isFile()) fs.copyFileSync(from, to)
  }
}

function sourceSkills(root) {
  const directory = path.join(root, 'skills')
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(directory, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort()
}

/**
 * Install the self-contained skill bundle.
 *
 * DSH's filesystem provider treats each direct child of a skill root as one
 * bundle, so the 12 skills go directly under `<DSH_HOME>/skills` while the CLI
 * and its lib live in `<DSH_HOME>/dsh-worktree`. Copying the runtime keeps the
 * skills working after the Cordis plugin is removed.
 */
export function installSkills({
  skillsRoot = defaultSkillsRoot(),
  runtimeDir = defaultRuntimeDir(),
  force = false,
  root = sourceRoot,
} = {}) {
  const resolvedSkillsRoot = path.resolve(skillsRoot)
  const resolvedRuntime = path.resolve(runtimeDir)
  const names = sourceSkills(root)

  // Validate every target before touching the filesystem so a conflicting
  // user skill cannot leave a half-installed bundle.
  for (const name of names) {
    const target = path.join(resolvedSkillsRoot, name)
    const owned = fs.existsSync(path.join(target, ownedMarker))
    if (fs.existsSync(target) && !owned && !force) {
      throw new Error(`skill 目录已存在且不是 dsh-worktree 安装: ${target}\n确认覆盖请加 --force。`)
    }
  }

  const runtimeOwned = fs.existsSync(path.join(resolvedRuntime, runtimeMarker))
  if (fs.existsSync(resolvedRuntime) && !runtimeOwned && !force) {
    throw new Error(`运行时目录已存在且不是 dsh-worktree 安装: ${resolvedRuntime}\n确认覆盖请加 --force。`)
  }
  if (fs.existsSync(resolvedRuntime)) fs.rmSync(resolvedRuntime, { recursive: true, force: true })
  fs.mkdirSync(resolvedRuntime, { recursive: true })
  fs.writeFileSync(path.join(resolvedRuntime, runtimeMarker), 'installed by dsh-worktree-plugin\n', 'utf8')
  copyTree(path.join(root, 'lib'), path.join(resolvedRuntime, 'lib'))
  fs.mkdirSync(path.join(resolvedRuntime, 'scripts'), { recursive: true })
  fs.copyFileSync(
    path.join(root, 'scripts', 'worktree-task.mjs'),
    path.join(resolvedRuntime, 'scripts', 'worktree-task.mjs'),
  )

  const cli = `node ${shellQuote(path.join(resolvedRuntime, 'scripts', 'worktree-task.mjs'))}`
  fs.mkdirSync(resolvedSkillsRoot, { recursive: true })

  // Remove skills a previous install owned but this version no longer ships.
  for (const entry of fs.readdirSync(resolvedSkillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (names.includes(entry.name)) continue
    const owned = path.join(resolvedSkillsRoot, entry.name, ownedMarker)
    if (fs.existsSync(owned)) fs.rmSync(path.join(resolvedSkillsRoot, entry.name), { recursive: true, force: true })
  }

  for (const name of names) {
    const target = path.join(resolvedSkillsRoot, name)
    const owned = fs.existsSync(path.join(target, ownedMarker))
    if (fs.existsSync(target) && !owned && !force) {
      throw new Error(`skill 目录已存在且不是 dsh-worktree 安装: ${target}\n确认覆盖请加 --force。`)
    }
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
    copyTree(path.join(root, 'skills', name), target)
    const skillFile = path.join(target, 'SKILL.md')
    fs.writeFileSync(skillFile, fs.readFileSync(skillFile, 'utf8').replaceAll('{{CLI}}', cli), 'utf8')
    fs.writeFileSync(path.join(target, ownedMarker), 'installed by dsh-worktree-plugin\n', 'utf8')
  }

  return { skillsRoot: resolvedSkillsRoot, runtimeDir: resolvedRuntime, skills: names }
}
