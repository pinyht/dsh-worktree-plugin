import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { WorktreeError } from './errors.js'
import {
  getTask,
  repoContext,
  requireMainContext,
  statePath,
  writeState,
} from './state.js'
import {
  branchExists,
  commonDir,
  exists,
  headCommit,
  headTree,
  repoRoot,
  statusPorcelain,
} from './git.js'

const MAX_PROMPTS = 40
const MAX_PROMPT_CHARS = 4000
const MAX_PROMPT_ITEM = 800
const MAX_SUMMARY = 1500

function now() {
  return new Date().toISOString()
}

export function validateTaskName(name) {
  if (!name) throw new WorktreeError('任务名不能为空')
  if (name.startsWith('-')) throw new WorktreeError("任务名不能以 '-' 开头，避免和 --all、--clear 等选项冲突。")
  if (name.endsWith('-')) throw new WorktreeError("任务名不能以 '-' 结尾，避免生成的 worktree 目录名出现连续分隔符。")
  if (name === '.' || name === '..') throw new WorktreeError("任务名不能是 '.' 或 '..'。")
  if ([...name].length > 80) throw new WorktreeError('任务名不能超过 80 个字符。')
  if (/\s/.test(name)) throw new WorktreeError('任务名不能包含空格、Tab 或换行。')
  const bad = [...new Set([...name].filter((ch) => '/\\:*?"<>|'.includes(ch) || ch.charCodeAt(0) < 32))]
  if (bad.length) throw new WorktreeError(`任务名包含不适合作为路径的字符: ${bad.map((ch) => JSON.stringify(ch)).join(' ')}`)
}

function hash8(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 8)
}

export function branchSlug(name) {
  const ascii = name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  const slug = (ascii || 'task').slice(0, 40).replace(/-+$/g, '') || 'task'
  return `${slug}-${hash8(name)}`
}

function worktreeDirName(name) {
  return `task-${name}-${hash8(name)}`
}

function validateRelativePath(rel) {
  if (!rel || path.isAbsolute(rel) || rel.split(/[\\/]+/).includes('..')) {
    throw new WorktreeError(`检测到不安全的 Git 路径，已停止: ${rel}`)
  }
  return rel
}

function formatChanges(changes) {
  if (!changes.length) return '(无文件变化)'
  return changes.map((change) => `${change.status}\t${change.path}`).join('\n')
}

async function requireCleanMain(git, root) {
  const status = await statusPorcelain(git, root)
  if (status) {
    throw new WorktreeError(
      '主项目目录存在未提交改动，已停止。\n请先手动确认、提交或清理后再执行该操作。\n\n' + status,
    )
  }
}

async function worktreeBase(root, common) {
  const mode = (process.env.DSH_WORKTREE_ROOT || 'agents').trim()
  let base
  if (mode === 'agents') base = path.join(root, '.agents', 'worktrees')
  else if (mode === 'git') base = path.join(common, 'dsh-worktrees')
  else if (mode === 'sibling') base = path.join(path.dirname(root), `${path.basename(root)}.worktrees`)
  else if (path.isAbsolute(mode)) base = mode
  else throw new WorktreeError('DSH_WORKTREE_ROOT 只能是 agents、git、sibling 或绝对路径。')

  await fs.mkdir(base, { recursive: true })
  if (mode === 'agents' && base === path.join(root, '.agents', 'worktrees')) {
    const ignore = path.join(base, '.gitignore')
    if (!(await exists(ignore))) await fs.writeFile(ignore, '*\n', 'utf8')
  }
  return base
}

async function taskChanges(git, taskPath) {
  const conflicted = (await git(['diff', '--name-only', '--diff-filter=U', 'HEAD', '--'], taskPath)).stdout.trim()
  if (conflicted) {
    throw new WorktreeError(
      '任务 worktree 存在未解决冲突，已停止。\n请先在任务目录解决冲突后再切换或合并。\n\n' + conflicted,
    )
  }

  const tokens = (await git(['diff', '--name-status', '-z', '--find-renames', 'HEAD', '--'], taskPath)).stdout.split('\0')
  const changes = []
  let index = 0
  while (index < tokens.length) {
    const status = tokens[index]
    index += 1
    if (!status) continue
    const kind = status.slice(0, 1)
    if (kind === 'R' || kind === 'C') {
      const oldPath = validateRelativePath(tokens[index])
      const newPath = validateRelativePath(tokens[index + 1])
      index += 2
      if (kind === 'R') changes.push({ status: 'D', path: oldPath })
      changes.push({ status: 'A', path: newPath })
      continue
    }
    const file = validateRelativePath(tokens[index])
    index += 1
    if (kind === 'D') changes.push({ status: 'D', path: file })
    else changes.push({ status: kind === 'A' || kind === 'T' ? kind : 'M', path: file })
  }

  const untracked = (await git(['ls-files', '--others', '--exclude-standard', '-z'], taskPath)).stdout.split('\0')
  for (const file of untracked) {
    if (file) changes.push({ status: 'A', path: validateRelativePath(file) })
  }
  return changes
}

async function treeFromWorktree(git, worktreePath) {
  const indexPath = path.join(os.tmpdir(), `dsh-worktree-index-${process.pid}-${crypto.randomUUID()}`)
  const env = { GIT_INDEX_FILE: indexPath }
  try {
    await git(['read-tree', 'HEAD'], worktreePath, { env })
    await git(['add', '-A', '--', '.'], worktreePath, { env, graceMs: 120000 })
    return (await git(['write-tree'], worktreePath, { env })).stdout.trim()
  } finally {
    await fs.rm(indexPath, { force: true }).catch(() => {})
    await fs.rm(`${indexPath}.lock`, { force: true }).catch(() => {})
  }
}

async function taskPatch(git, taskPath, taskTree) {
  return (await git(['diff', '--binary', '--full-index', 'HEAD', taskTree, '--'], taskPath, { graceMs: 120000 })).stdout
}

async function blobAt(git, root, stage, file) {
  const result = await git(['show', `:${stage}:${file}`], root, { check: false })
  return result.code === 0 ? result.stdout : null
}

function markerCount(content) {
  if (!content) return 0
  return content.split('\n').filter((line) => line.startsWith('<<<<<<< ')).length
}

function changedTerms(base, content) {
  if (!content) return []
  const baseText = base ?? ''
  const candidates = content.match(/\/[A-Za-z0-9_./:-]+|[A-Za-z_][A-Za-z0-9_./:-]{2,}|[\u4e00-\u9fff]{2,}/g) ?? []
  const seen = []
  for (let term of candidates) {
    if (baseText.includes(term) || seen.includes(term)) continue
    if (term.length > 48) term = `${term.slice(0, 45)}...`
    seen.push(term)
    if (seen.length >= 6) break
  }
  return seen
}

async function conflictAnalysis(git, root, files) {
  const lines = [`检测到 ${files.length} 个冲突文件:`]
  for (const [index, file] of files.entries()) {
    const [base, ours, theirs] = await Promise.all([
      blobAt(git, root, 1, file),
      blobAt(git, root, 2, file),
      blobAt(git, root, 3, file),
    ])
    let working = null
    try {
      working = await fs.readFile(path.join(root, file), 'utf8')
    } catch {
      // A delete/rename conflict may have no working file.
    }
    lines.push(`\n${index + 1}. ${file}`)
    lines.push(`   冲突块: ${markerCount(working)} 个`)
    if (base === null || ours === null) lines.push('   主项目版本: 新增或删除文件')
    else lines.push(`   主项目版本: ${ours.split('\n').length} 行`)
    if (base === null || theirs === null) lines.push('   任务版本: 新增或删除文件')
    else lines.push(`   任务版本: ${theirs.split('\n').length} 行`)
    const oursTerms = changedTerms(base, ours)
    const theirsTerms = changedTerms(base, theirs)
    if (oursTerms.length) lines.push(`   主项目侧关键词: ${oursTerms.join(', ')}`)
    if (theirsTerms.length) lines.push(`   任务侧关键词: ${theirsTerms.join(', ')}`)
  }
  lines.push('\n建议: 在主项目会话中让 Agent 读取冲突文件以及 :1/:2/:3 三方版本，给出语义级修复方案后再修改文件。')
  return lines.join('\n')
}

async function applyTaskPatch(git, root, patch) {
  const patchFile = path.join(os.tmpdir(), `dsh-worktree-patch-${process.pid}-${crypto.randomUUID()}.patch`)
  await fs.writeFile(patchFile, patch, 'utf8')
  try {
    const result = await git(['apply', '--3way', '--whitespace=nowarn', patchFile], root, {
      check: false,
      graceMs: 120000,
    })
    if (result.code === 0) {
      await git(['reset', '--'], root)
      return
    }
    const conflicted = (await git(['diff', '--name-only', '--diff-filter=U', '--'], root, { check: false }))
      .stdout.trim().split('\n').filter(Boolean)
    if (conflicted.length) {
      const analysis = await conflictAnalysis(git, root, conflicted)
      throw new WorktreeError(
        '任务改动与主项目当前提交存在合并冲突，已保留冲突状态。\n'
        + '脚本不会自动 commit，也不会启动服务。\n\n'
        + [result.stdout, result.stderr].filter(Boolean).join('\n')
        + `\n\n${analysis}`,
      )
    }
    throw new WorktreeError(
      '任务改动无法三方合并到主项目目录，已停止。\n'
      + '主项目目录可能保留了部分 Git apply 状态，请查看 git status 后决定继续解决或手动清理。\n\n'
      + [result.stdout, result.stderr].filter(Boolean).join('\n'),
    )
  } finally {
    await fs.rm(patchFile, { force: true }).catch(() => {})
  }
}

async function resetMain(git, root) {
  await git(['reset', '--hard', 'HEAD'], root)
  await git(['clean', '-fd'], root)
}

async function resetTask(git, taskPath, commit) {
  await git(['reset', '--hard', commit], taskPath)
  await git(['clean', '-fd'], taskPath)
}

async function resetMainSlot(git, context) {
  const { root, state, common } = context
  const status = await statusPorcelain(git, root)
  if (status) {
    const currentTree = await treeFromWorktree(git, root)
    if (state.preview && currentTree === state.preview.tree) {
      await resetMain(git, root)
      state.preview = null
      await writeState(common, state)
      return '已重置上一轮 switch 预览，主项目目录已恢复到当前提交。'
    }
    throw new WorktreeError(
      '主项目目录存在未提交改动，且不等于已记录的 switch 预览状态，已停止。\n'
      + '请先手动提交、stash 或清理这些改动后再继续。\n\n'
      + status,
    )
  }
  if (state.preview) {
    state.preview = null
    await resetMain(git, root)
    await writeState(common, state)
    return '已清除 switch 预览记录，主项目目录已恢复到当前提交。'
  }
  await resetMain(git, root)
  return ''
}

async function requireNoTaskCommits(git, root, taskPath) {
  const mainHead = await headCommit(git, root)
  const taskHead = await headCommit(git, taskPath)
  if (taskHead === mainHead) return
  const listing = (await git(['log', '--oneline', `${mainHead}..${taskHead}`], taskPath, { check: false })).stdout.trim()
  if (!listing) return
  const commits = listing.split('\n').filter(Boolean)
  const baseResult = await git(['merge-base', taskHead, mainHead], taskPath, { check: false })
  const base = baseResult.code === 0 ? baseResult.stdout.trim() : mainHead
  throw new WorktreeError(
    '任务分支上有主线没有的提交，已停止。\n'
    + 'merge/switch 只搬运任务目录里的未提交改动；这些已提交的改动不会被带到主项目目录，'
    + '而且合并后任务 worktree 会被重置到主线，这些提交会变成孤儿。\n\n'
    + commits.slice(0, 10).map((line) => `  ${line}`).join('\n')
    + (commits.length > 10 ? `\n  ……（共 ${commits.length} 个）` : '')
    + '\n\n恢复方法（在任务目录执行，改动内容不会丢）:\n'
    + `  git reset --soft ${base}\n`
    + '然后重新执行本命令。',
  )
}

async function absorbedByMain(git, root, taskPath, changes) {
  if (!changes.length) return true
  const taskTree = await treeFromWorktree(git, taskPath)
  const taskHead = await headCommit(git, taskPath)
  const mainHead = await headCommit(git, root)
  const result = await git(
    ['merge-tree', '--write-tree', '--merge-base', taskHead, mainHead, taskTree],
    root,
    { check: false },
  )
  if (result.code !== 0) return false
  const mergedTree = result.stdout.trim().split('\n')[0]
  if (!mergedTree) return false
  return mergedTree === await headTree(git, root)
}

async function removePath(target) {
  await fs.rm(target, { recursive: true, force: true })
}

async function copyPath(source, target) {
  const info = await fs.lstat(source)
  await fs.mkdir(path.dirname(target), { recursive: true })
  if (info.isSymbolicLink()) {
    const link = await fs.readlink(source)
    await fs.symlink(link, target)
  } else if (info.isDirectory()) {
    await fs.cp(source, target, { recursive: true, verbatimSymlinks: true, force: true })
  } else {
    await fs.copyFile(source, target)
  }
}

async function applyTaskFiles(taskPath, target, changes) {
  const deletions = changes.filter((change) => change.status === 'D').sort((a, b) => b.path.localeCompare(a.path))
  for (const change of deletions) await removePath(path.join(target, change.path))
  for (const change of changes) {
    if (change.status === 'D') continue
    await removePath(path.join(target, change.path))
    await copyPath(path.join(taskPath, change.path), path.join(target, change.path))
  }
}

function textBlocks(content) {
  if (typeof content === 'string') return content.trim() ? [content] : []
  if (!Array.isArray(content)) return []
  return content
    .filter((item) => item && item.type === 'text' && typeof item.text === 'string' && item.text.trim())
    .map((item) => item.text)
}

/** Extract the user's prompts and the last assistant summary from task sessions. */
export async function taskMemory(sessionQuery, taskPath) {
  if (!sessionQuery) return null
  let records
  try {
    records = await sessionQuery.filterSessions([{ kind: 'cwd', values: [taskPath] }])
  } catch {
    return null
  }
  if (!records.length) return null

  const selected = records.slice(0, 5).reverse()
  const prompts = []
  let summary = null
  const sessions = []
  for (const record of selected) {
    let log
    try {
      log = await sessionQuery.readSession(record.header.id)
    } catch {
      continue
    }
    sessions.push(String(record.header.id))
    for (const event of log.events) {
      if (event.type === 'user/message') {
        const kind = event.data?.source?.kind
        if (kind === 'user' || kind === 'agent-message') {
          prompts.push(...textBlocks(event.data?.content))
        }
      } else if (event.type === 'assistant/message') {
        const texts = textBlocks(event.data?.message?.content)
        if (texts.length) summary = texts.join('\n')
      }
    }
  }
  if (!prompts.length && !summary) return null

  let compact = prompts
  if (compact.length > MAX_PROMPTS) {
    compact = [...compact.slice(0, 2), '……（中间省略）', ...compact.slice(-(MAX_PROMPTS - 3))]
  }
  const trimmed = []
  let used = 0
  for (const prompt of compact) {
    if (used >= MAX_PROMPT_CHARS) {
      trimmed.push('……（后续省略）')
      break
    }
    const piece = prompt.length <= MAX_PROMPT_ITEM ? prompt : `${prompt.slice(0, MAX_PROMPT_ITEM)}…`
    trimmed.push(piece)
    used += piece.length
  }
  if (summary && summary.length > MAX_SUMMARY) summary = `${summary.slice(0, MAX_SUMMARY)}…`
  return { sessions, prompts: trimmed, summary }
}

function formatMemory(memory) {
  if (!memory) {
    return '任务会话记忆: 未找到（该任务目录没有 DSH 会话记录，或会话已被清理）。\n请仅依据槽里的改动生成提交说明。'
  }
  const lines = [`任务会话记忆（来自任务目录的 DSH 会话记录，共 ${memory.sessions.length} 个会话）:`]
  if (memory.prompts.length) {
    lines.push('  你当初的要求:')
    for (const prompt of memory.prompts) {
      for (const line of prompt.split('\n')) lines.push(`    ${line}`)
    }
  }
  if (memory.summary) {
    lines.push('  任务会话最后总结:')
    for (const line of memory.summary.split('\n')) lines.push(`    ${line}`)
  }
  return lines.join('\n')
}

function formatList(data) {
  const lines = [`仓库: ${data.repo}`, `状态文件: ${data.stateFile}`]
  const main = data.main
  if (main.preview) lines.push(`当前 switch 预览: ${main.preview.task}`)
  else if (main.clean) lines.push('主项目: 干净（主线基线）')
  else lines.push('主项目: 有未提交改动')
  if (data.inTask) lines.push(`当前窗口位于任务 worktree: ${data.taskName}`)
  if (!data.tasks.length) {
    lines.push('当前没有 worktree 任务。')
    return lines.join('\n')
  }
  for (const task of data.tasks) {
    lines.push(`- ${task.name}`)
    lines.push(`  状态: ${task.status} / ${task.dirty} / 目录${task.exists ? '存在' : '缺失'}`)
    lines.push(`  分支: ${task.branch}`)
    lines.push(`  目录: ${task.worktree}`)
    lines.push(`  更新时间: ${task.updatedAt}`)
  }
  return lines.join('\n')
}

function formatCurrent(data) {
  if (data.kind === 'task') {
    return [
      `当前窗口位于任务 worktree: ${data.taskName}`,
      `分支: ${data.branch}`,
      `主项目目录: ${data.repo}`,
      `任务目录: ${data.worktree}`,
    ].join('\n')
  }
  const lines = [`主项目目录: ${data.repo}`]
  if (data.preview) lines.push(`当前主项目目录正在预览任务: ${data.preview.task}`)
  else if (data.status) lines.push('当前主项目目录有未提交改动，不属于已记录的 switch 预览状态。\n' + data.status)
  else lines.push('当前主项目目录处于主线基线状态。')
  return lines.join('\n')
}

function formatInfo(data) {
  return [
    `任务: ${data.task.name}`,
    `状态: ${data.task.status}`,
    `分支: ${data.task.branch}`,
    `目录: ${data.task.worktree}`,
    `主项目目录: ${data.repo}`,
    '在 Worktrees 面板点 Open 可打开该任务会话。',
  ].join('\n')
}

const HELP = `dsh-worktree 命令：

/worktree-new <任务名>          创建任务 worktree
/worktree-list                  查看当前仓库的任务
/worktree-info <任务名>         查看任务详情
/worktree-current               查看当前窗口对应任务或主项目状态
/worktree-status                查看当前 Git 未提交状态
/worktree-switch <任务名>       把任务改动复制到主项目目录预览
/worktree-switch --clear        清除预览并恢复主项目目录
/worktree-merge <任务名>        三方合并任务改动到主项目，不自动 commit
/worktree-sync <任务名>         把主项目最新提交带到任务目录
/worktree-sync --all            同步所有任务
/worktree-take-sql <任务名> <sql...>
/worktree-push-sql <任务名> <sql...>
/worktree-end <任务名> [--force] 清理任务

说明：
- 主项目目录是可重置的统一调试槽；任务目录用于具体开发。
- Worktrees 面板可直接新建、打开、预览、合并和清理任务。
- 不会自动 commit；主项目有来源不明的改动时不会执行 switch/merge/sync。
- 任务会话只应编辑文件；switch/merge/sync/end 在主项目会话执行。`

function makeLock() {
  const queues = new Map()
  return function withLock(key, fn) {
    const previous = queues.get(key) ?? Promise.resolve()
    const result = previous.then(fn, fn)
    queues.set(key, result.then(() => {}, () => {}))
    return result
  }
}

export function createEngine({ git, sessionQuery = null }) {
  const withLock = makeLock()

  async function locked(cwd, fn) {
    const root = await repoRoot(git, cwd)
    const common = await commonDir(git, cwd)
    return withLock(common, async () => fn(await repoContext(git, cwd), common))
  }

  async function newTask({ cwd, name }) {
    return locked(cwd, async (context) => {
      requireMainContext(context)
      await requireCleanMain(git, context.root)
      validateTaskName(name)
      if (context.state.tasks[name]) throw new WorktreeError(`任务已存在: ${name}`)

      const branch = `worktree/${branchSlug(name)}`
      if (await branchExists(git, context.root, branch)) {
        throw new WorktreeError(`任务分支已存在: ${branch}`)
      }
      const base = await worktreeBase(context.root, context.common)
      const worktree = path.resolve(base, worktreeDirName(name))
      if (await exists(worktree)) throw new WorktreeError(`任务目录已存在: ${worktree}`)

      try {
        await git(['worktree', 'add', '-b', branch, worktree, 'HEAD'], context.root, { graceMs: 120000 })
      } catch (error) {
        await git(['worktree', 'remove', '--force', worktree], context.root, { check: false }).catch(() => {})
        await git(['branch', '-D', branch], context.root, { check: false }).catch(() => {})
        throw error
      }

      const task = {
        name,
        branch,
        worktree,
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
        lastMergedAt: null,
        lastSyncedAt: now(),
      }
      context.state.tasks[name] = task
      await writeState(context.common, context.state)

      const text = [
        `已创建 worktree 任务: ${name}`,
        `分支: ${branch}`,
        `目录: ${worktree}`,
        '在 Worktrees 面板点 Open 打开任务会话；也可以手动把该目录添加为 workspace。',
        '任务会话用于开发，不启动长期运行的项目服务，也不要 commit。',
      ].join('\n')
      return { text, data: { task, repo: context.repo, baseDir: base, stateFile: statePath(context.common) } }
    })
  }

  async function list({ cwd }) {
    const context = await repoContext(git, cwd)
    const mainStatus = await statusPorcelain(git, context.repo)
    const tasks = []
    for (const task of Object.values(context.state.tasks)) {
      const taskPath = path.resolve(task.worktree)
      const taskExists = await exists(taskPath)
      let dirty = '未知'
      let changes = []
      if (taskExists) {
        try {
          changes = await taskChanges(git, taskPath)
          if (!changes.length) dirty = '干净'
          else if (await absorbedByMain(git, context.repo, taskPath, changes)) dirty = '已被主线吸收'
          else dirty = '有未合并改动'
        } catch (error) {
          dirty = '冲突或不可读'
        }
      }
      tasks.push({
        name: task.name,
        status: task.status,
        branch: task.branch,
        worktree: task.worktree,
        exists: taskExists,
        dirty,
        changes,
        updatedAt: task.updatedAt,
      })
    }
    const data = {
      repo: context.repo,
      cwd: context.root,
      inTask: Boolean(context.task),
      taskName: context.taskName,
      stateFile: statePath(context.common),
      main: {
        clean: !mainStatus,
        status: mainStatus,
        preview: context.state.preview
          ? { task: context.state.preview.task, switchedAt: context.state.preview.switchedAt }
          : null,
      },
      tasks,
    }
    return { text: formatList(data), data }
  }

  async function info({ cwd, name }) {
    const context = await repoContext(git, cwd)
    const task = getTask(context, name)
    return { text: formatInfo({ task, repo: context.repo }), data: { task, repo: context.repo } }
  }

  async function current({ cwd }) {
    const context = await repoContext(git, cwd)
    if (context.task) {
      const data = {
        kind: 'task',
        taskName: context.taskName,
        task: context.task,
        repo: context.repo,
        worktree: context.task.worktree,
        branch: context.task.branch,
      }
      return { text: formatCurrent(data), data }
    }

    const status = await statusPorcelain(git, context.root)
    const preview = context.state.preview
    let data = { kind: 'main', repo: context.repo, preview: null, status, clean: !status }
    if (preview) {
      const currentTree = await treeFromWorktree(git, context.root)
      if (currentTree === preview.tree) {
        if (!status && (await headTree(git, context.root)) === currentTree) {
          context.state.preview = null
          await writeState(context.common, context.state)
        } else {
          data.preview = { task: preview.task, switchedAt: preview.switchedAt }
        }
      } else if (!status) {
        context.state.preview = null
        await writeState(context.common, context.state)
      }
    }
    return { text: formatCurrent(data), data }
  }

  async function status({ cwd }) {
    const context = await repoContext(git, cwd)
    const output = (await git(
      ['status', '--short', '--branch', '--untracked-files=all'],
      context.root,
    )).stdout.trim()
    const data = {
      repo: context.repo,
      cwd: context.root,
      inTask: Boolean(context.task),
      taskName: context.taskName,
      status: output,
    }
    const lines = [`当前 Git 仓库: ${context.root}`]
    if (context.task) lines.push(`当前 worktree 任务: ${context.taskName}`, `主项目目录: ${context.repo}`)
    else lines.push('当前位于主项目目录。')
    lines.push(output || '工作区干净。')
    return { text: lines.join('\n'), data }
  }

  async function switchTask({ cwd, name }) {
    return locked(cwd, async (context) => {
      requireMainContext(context)
      const task = getTask(context, name)
      const taskPath = path.resolve(task.worktree)
      if (!(await exists(taskPath))) throw new WorktreeError(`任务目录不存在: ${taskPath}`)

      await requireNoTaskCommits(git, context.root, taskPath)
      const changes = await taskChanges(git, taskPath)
      await resetMainSlot(git, context)

      if (!changes.length) {
        context.state.preview = null
        await writeState(context.common, context.state)
        return { text: `任务没有可预览改动: ${task.name}`, data: { task, changes } }
      }

      const text = [`待预览文件:`, formatChanges(changes)].join('\n')
      await applyTaskFiles(taskPath, context.root, changes)
      const previewTree = await treeFromWorktree(git, context.root)
      context.state.preview = {
        task: task.name,
        head: await headCommit(git, context.root),
        tree: previewTree,
        files: changes.map((change) => change.path),
        switchedAt: now(),
      }
      await writeState(context.common, context.state)
      return {
        text: `${text}\n\n已切换主项目目录到任务预览状态: ${task.name}\n`
          + '该操作只用于临时验证；不会更新任务基线、不会反向同步、不会自动 commit。',
        data: { task, changes, preview: context.state.preview },
      }
    })
  }

  async function switchClear({ cwd }) {
    return locked(cwd, async (context) => {
      requireMainContext(context)
      const message = await resetMainSlot(git, context)
      await writeState(context.common, context.state)
      return { text: message || '主项目目录已恢复到当前提交。', data: { preview: null } }
    })
  }

  async function mergeTask({ cwd, name }) {
    return locked(cwd, async (context) => {
      requireMainContext(context)
      const task = getTask(context, name)
      const taskPath = path.resolve(task.worktree)
      if (!(await exists(taskPath))) throw new WorktreeError(`任务目录不存在: ${taskPath}`)

      await requireNoTaskCommits(git, context.root, taskPath)
      const changes = await taskChanges(git, taskPath)
      if (!changes.length) {
        context.state.preview = null
        await writeState(context.common, context.state)
        return { text: `任务没有待合并改动: ${task.name}`, data: { task, changes: [] } }
      }

      const taskTree = await treeFromWorktree(git, taskPath)
      const patch = await taskPatch(git, taskPath, taskTree)
      if (!patch) {
        context.state.preview = null
        await writeState(context.common, context.state)
        return { text: `任务没有待合并改动: ${task.name}`, data: { task, changes: [] } }
      }

      await resetMainSlot(git, context)
      context.state.preview = null
      await writeState(context.common, context.state)
      const mainCommit = await headCommit(git, context.root)

      await applyTaskPatch(git, context.root, patch)
      let resetWarning = ''
      try {
        await resetTask(git, taskPath, mainCommit)
      } catch (error) {
        resetWarning = `\n\n警告: 任务目录未能自动对齐到主项目最新提交。\n${error.message}\n`
          + '合并结果已保留；请在任务会话或授权后执行 /worktree-sync。'
      }

      task.status = 'merged-to-main-pending-user-commit'
      task.lastMergedAt = now()
      task.lastSyncedAt = now()
      task.updatedAt = now()
      await writeState(context.common, context.state)

      const memory = await taskMemory(sessionQuery, taskPath)
      const text = [
        '待合并文件:',
        formatChanges(changes),
        '',
        '已把任务改动三方合并到主项目目录，主项目未自动 commit。',
        '请在主项目目录手动重启服务验证。',
        '',
        formatMemory(memory),
        '',
        '验证通过后由你决定：可以让 Agent 提交并写说明，也可以自己手动 git commit。',
      ].join('\n') + resetWarning
      return { text, data: { task, changes, memory, mainCommit } }
    })
  }

  async function syncOne(context, name) {
    const task = getTask(context, name)
    const taskPath = path.resolve(task.worktree)
    if (!(await exists(taskPath))) throw new WorktreeError(`任务目录不存在: ${taskPath}`)

    const mainCommit = await headCommit(git, context.root)
    const taskHead = await headCommit(git, taskPath)
    const mainTree = await headTree(git, context.root)
    const taskTree = await treeFromWorktree(git, taskPath)

    let message
    if (taskHead === mainCommit) message = '已包含主项目最新提交'
    else if (taskTree === mainTree) {
      await resetTask(git, taskPath, mainCommit)
      message = '任务内容已与主项目一致，已自动对齐到主项目最新提交'
    } else {
      const changes = await taskChanges(git, taskPath)
      if (changes.length && await absorbedByMain(git, context.root, taskPath, changes)) {
        await resetTask(git, taskPath, mainCommit)
        message = '任务本地改动已被主项目吸收，已自动对齐到主项目最新提交'
      } else {
        const result = await git(['merge', '--ff-only', mainCommit], taskPath, { check: false })
        if (result.code !== 0) {
          throw new WorktreeError(
            '任务目录无法直接拉取主项目最新提交，已停止。\n'
            + '请先在任务目录手动处理主线更新、提交关系或冲突后再继续。\n\n'
            + [result.stdout, result.stderr].filter(Boolean).join('\n'),
          )
        }
        message = '已带入主项目最新提交'
      }
    }

    task.status = 'active'
    task.lastSyncedAt = now()
    task.updatedAt = now()
    return message
  }

  async function syncTasks({ cwd, name, all }) {
    return locked(cwd, async (context) => {
      requireMainContext(context)
      await requireCleanMain(git, context.root)
      if (all) {
        const synced = []
        const failed = []
        for (const taskName of Object.keys(context.state.tasks)) {
          try {
            const message = await syncOne(context, taskName)
            await writeState(context.common, context.state)
            synced.push({ name: taskName, message })
          } catch (error) {
            failed.push({ name: taskName, message: error.message })
          }
        }
        const lines = []
        if (synced.length) {
          lines.push('已同步任务:')
          for (const item of synced) lines.push(`- ${item.name}: ${item.message}`)
        } else lines.push('没有任务完成同步。')
        if (failed.length) {
          lines.push('以下任务同步被阻止:')
          for (const item of failed) lines.push(`- ${item.name}`, item.message)
        }
        const text = lines.join('\n')
        if (failed.length) throw new WorktreeError(`${text}\n\n${failed.length} 个任务同步被阻止，详见上方输出。`)
        return { text, data: { synced, failed } }
      }

      const message = await syncOne(context, name)
      await writeState(context.common, context.state)
      return { text: message, data: { name, message } }
    })
  }

  function prepareSql(context, name, sqlPaths) {
    const task = getTask(context, name)
    const taskPath = path.resolve(task.worktree)
    const paths = sqlPaths.map((item) => validateRelativePath(item))
    for (const file of paths) {
      if (path.extname(file).toLowerCase() !== '.sql') {
        throw new WorktreeError(`SQL 命令只支持 .sql 文件: ${file}`)
      }
    }
    return { task, taskPath, paths }
  }

  async function takeSqlUnlocked(context, task, taskPath, sqlPaths) {
    const changes = await taskChanges(git, taskPath)
    const byPath = new Map(changes.map((change) => [change.path, change.status]))
    for (const file of sqlPaths) {
      if (byPath.get(file) !== 'A') {
        throw new WorktreeError(
          '只支持从任务目录拿取新增且未合并的 SQL 文件。\n'
          + `文件: ${file}\n当前状态: ${byPath.get(file) ?? '未变化'}`,
        )
      }
      const source = path.join(taskPath, file)
      const info = await fs.lstat(source)
      if (info.isSymbolicLink() || !info.isFile()) {
        throw new WorktreeError(`任务 SQL 文件不存在或不是普通文件: ${file}`)
      }
    }

    await resetMainSlot(git, context)
    for (const file of sqlPaths) {
      if (await exists(path.join(context.root, file))) {
        throw new WorktreeError(`主项目目录已存在同路径文件，已停止: ${file}`)
      }
    }

    const taken = []
    for (const file of sqlPaths) {
      const source = path.join(taskPath, file)
      const target = path.join(context.root, file)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.copyFile(source, target)
      await fs.rm(source, { force: true })
      await git(['rm', '--cached', '--ignore-unmatch', '--', file], taskPath, { check: false })
      taken.push(file)
    }
    task.status = 'active'
    task.lastSqlTakenAt = now()
    task.updatedAt = now()
    context.state.preview = null
    await writeState(context.common, context.state)
    return taken
  }

  async function takeSql({ cwd, name, sqlPaths }) {
    return locked(cwd, async (context) => {
      requireMainContext(context)
      const { task, taskPath, paths } = prepareSql(context, name, sqlPaths)
      const taken = await takeSqlUnlocked(context, task, taskPath, paths)
      const text = [
        `已从任务拿取 SQL: ${task.name}`,
        ...taken.map((file) => `- ${file}`),
        '这些 SQL 已复制到主项目目录，并已从任务 worktree 删除。',
        '请在主项目目录 review 后手动提交，然后执行 /worktree-sync ' + task.name,
      ].join('\n')
      return { text, data: { task, taken } }
    })
  }

  async function syncSqlToTasks(context, sqlPaths) {
    const synced = []
    const failed = []
    for (const task of Object.values(context.state.tasks)) {
      const taskPath = path.resolve(task.worktree)
      if (!(await exists(taskPath))) {
        failed.push({ name: task.name, message: `任务目录不存在: ${taskPath}` })
        continue
      }
      try {
        const copied = []
        for (const file of sqlPaths) {
          const source = path.join(context.root, file)
          const target = path.join(taskPath, file)
          if (await exists(target)) {
            const a = await fs.readFile(source)
            const b = await fs.readFile(target)
            if (!a.equals(b)) throw new WorktreeError(`任务目录已有同路径 SQL，且内容与主线 SQL 不一致: ${file}`)
            continue
          }
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.copyFile(source, target)
          copied.push(file)
        }
        task.status = 'active'
        task.lastSqlSyncedAt = now()
        task.updatedAt = now()
        await writeState(context.common, context.state)
        synced.push({ name: task.name, message: copied.length ? `已同步 SQL ${copied.length} 个` : 'SQL 已存在' })
      } catch (error) {
        failed.push({ name: task.name, message: error.message })
      }
    }
    return { synced, failed }
  }

  async function pushSql({ cwd, name, sqlPaths }) {
    return locked(cwd, async (context) => {
      requireMainContext(context)
      const { task, taskPath, paths } = prepareSql(context, name, sqlPaths)
      const taken = await takeSqlUnlocked(context, task, taskPath, paths)

      const message = 'add ' + taken.join(' ')
      await git(['add', '--', ...taken], context.root)
      await git(['commit', '-m', message], context.root, { graceMs: 120000 })
      await git(['push'], context.root, { graceMs: 120000, check: false }).then((result) => {
        if (result.code !== 0) {
          throw new WorktreeError(
            '已提交 SQL，但 git push 失败。\n'
            + [result.stdout, result.stderr].filter(Boolean).join('\n'),
          )
        }
      })

      const { synced, failed } = await syncSqlToTasks(context, taken)
      const preview = await switchTaskUnlocked(context, name)
      const lines = [
        `已从任务拿取 SQL: ${task.name}`,
        ...taken.map((file) => `- ${file}`),
        `已提交 SQL: ${message}`,
        '已执行 git push。',
      ]
      if (synced.length) {
        lines.push('已向任务同步 SQL:')
        for (const item of synced) lines.push(`- ${item.name}: ${item.message}`)
      }
      if (failed.length) {
        lines.push('以下任务 SQL 同步被阻止:')
        for (const item of failed) lines.push(`- ${item.name}`, item.message)
      }
      lines.push(preview.text)
      const text = lines.join('\n')
      if (failed.some((item) => item.name === name)) {
        throw new WorktreeError(`${text}\n\n当前 SQL 对应任务同步失败，已停止切换预览。`)
      }
      if (failed.length) throw new WorktreeError(`${text}\n\n${failed.length} 个任务的 SQL 同步被阻止。`)
      return { text, data: { task, taken, synced, failed } }
    })
  }

  async function switchTaskUnlocked(context, name) {
    const task = getTask(context, name)
    const taskPath = path.resolve(task.worktree)
    if (!(await exists(taskPath))) throw new WorktreeError(`任务目录不存在: ${taskPath}`)
    await requireNoTaskCommits(git, context.root, taskPath)
    const changes = await taskChanges(git, taskPath)
    await resetMainSlot(git, context)
    if (!changes.length) {
      context.state.preview = null
      await writeState(context.common, context.state)
      return { text: `任务没有可预览改动: ${task.name}`, data: { task, changes } }
    }
    await applyTaskFiles(taskPath, context.root, changes)
    const previewTree = await treeFromWorktree(git, context.root)
    context.state.preview = {
      task: task.name,
      head: await headCommit(git, context.root),
      tree: previewTree,
      files: changes.map((change) => change.path),
      switchedAt: now(),
    }
    await writeState(context.common, context.state)
    return {
      text: `已切换主项目目录到任务预览状态: ${task.name}`,
      data: { task, changes, preview: context.state.preview },
    }
  }

  async function endTask({ cwd, name, force }) {
    return locked(cwd, async (context) => {
      requireMainContext(context)
      const task = getTask(context, name)
      const taskPath = path.resolve(task.worktree)
      if (await exists(taskPath)) {
        if (!force) {
          await requireNoTaskCommits(git, context.root, taskPath)
          const changes = await taskChanges(git, taskPath)
          if (changes.length && !(await absorbedByMain(git, context.repo, taskPath, changes))) {
            throw new WorktreeError(
              '任务 worktree 还有未合并改动，已停止清理。\n未合并文件:\n'
              + formatChanges(changes)
              + '\n请先执行 /worktree-merge，或确认放弃后使用 --force。',
            )
          }
        }
        await git(['worktree', 'remove', '--force', taskPath], context.root, { graceMs: 120000 })
      }
      if (await branchExists(git, context.root, task.branch)) {
        await git(['branch', '-D', task.branch], context.root)
      }
      delete context.state.tasks[name]
      if (context.state.preview?.task === name) context.state.preview = null
      await writeState(context.common, context.state)
      return { text: `已清理 worktree 任务: ${name}`, data: { name } }
    })
  }

  return {
    newTask,
    list,
    info,
    current,
    status,
    switchTask,
    switchClear,
    mergeTask,
    syncTasks,
    takeSql,
    pushSql,
    endTask,
    help: async () => ({ text: HELP, data: { help: HELP } }),
  }
}
