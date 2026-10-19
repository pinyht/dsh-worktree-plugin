import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { WorktreeError } from './errors.js'
import { commonDir, repoRoot } from './git.js'

export const STATE_VERSION = 1
export const STATE_DIR = 'dsh-worktree'
export const STATE_FILE = 'tasks.json'

export function statePath(common) {
  return path.join(common, STATE_DIR, STATE_FILE)
}

export function emptyState(repo) {
  return {
    version: STATE_VERSION,
    repo,
    tasks: {},
    preview: null,
  }
}

export async function readState(common, repo) {
  const file = statePath(common)
  let raw
  try {
    raw = await fs.readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyState(repo)
    throw new WorktreeError(`无法读取任务状态: ${file}\n${error.message}`)
  }
  let state
  try {
    state = JSON.parse(raw)
  } catch (error) {
    throw new WorktreeError(`任务状态不是合法 JSON: ${file}\n${error.message}`)
  }
  if (!state || state.version !== STATE_VERSION || typeof state.tasks !== 'object' || state.tasks === null) {
    throw new WorktreeError(`任务状态格式不兼容: ${file}`)
  }
  if (!state.repo) state.repo = repo
  state.preview ??= null
  return state
}

export async function writeState(common, state) {
  const file = statePath(common)
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
  await fs.rename(tmp, file)
}

/** Resolve the current checkout, its shared .git, task state, and task binding. */
export async function repoContext(git, cwd) {
  const root = await repoRoot(git, cwd)
  const common = await commonDir(git, cwd)
  const state = await readState(common, root)
  let task = null
  for (const candidate of Object.values(state.tasks)) {
    if (candidate?.worktree && path.resolve(candidate.worktree) === path.resolve(root)) {
      task = candidate
      break
    }
  }
  return {
    root,
    common,
    state,
    task,
    taskName: task?.name ?? null,
    repo: state.repo || root,
  }
}

export function requireMainContext(context) {
  if (context.task) {
    throw new WorktreeError(
      `该操作必须在主项目目录执行。\n当前目录是任务 worktree: ${context.taskName}\n主项目目录: ${context.repo}`,
    )
  }
}

export function getTask(context, name) {
  const task = context.state.tasks[name]
  if (!task) throw new WorktreeError(`未找到任务: ${name}`)
  return task
}
