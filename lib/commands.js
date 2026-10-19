import crypto from 'node:crypto'
import { WorktreeError } from './errors.js'

function parseInput(rawInput) {
  const tokens = (rawInput ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    tokens,
    args: tokens.filter((token) => !token.startsWith('--')),
    flags: new Set(tokens.filter((token) => token.startsWith('--'))),
  }
}

function jsonOrText(result, json) {
  if (json) return JSON.stringify(result.data)
  return result.text
}

function conflictHandoffMessage(taskName, analysis) {
  const text = [
    `【系统自动触发】任务「${taskName}」合并到主项目时发生冲突，主项目目录已保留冲突状态。`,
    '',
    '脚本的冲突分析：',
    analysis,
    '',
    '请按以下流程处理：',
    '1. 读取 git status、冲突文件、`:1/:2/:3` 三方版本，以及相关路由、权限、授权、schema、配置、状态机代码；',
    '2. 给出 2-3 个语义级修复方案，逐个说明影响和推荐项；',
    '3. 如果需要我决策，请用 ask_user_question 给出编号选项，每个选项一句话说明影响和推荐项；',
    '4. 不要直接 commit，也不要在我选择方案前修改文件；',
    '5. 等我选择后再修改冲突文件，并告诉我如何验证。',
  ].join('\n')
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

function requireName(args, command) {
  const name = args[0]
  if (!name) throw new WorktreeError(`/${command} 需要任务名。`)
  return name
}

const DEFINITIONS = [
  {
    name: 'worktree-list',
    description: '查看当前仓库的 worktree 任务列表',
    input: { hint: '[--json]' },
    run: async (engine, cwd, raw) => {
      const { flags } = parseInput(raw)
      return jsonOrText(await engine.list({ cwd }), flags.has('--json'))
    },
  },
  {
    name: 'worktree-new',
    description: '创建新的 worktree 任务',
    input: { hint: '<任务名> [--json]' },
    run: async (engine, cwd, raw) => {
      const { args, flags } = parseInput(raw)
      const name = requireName(args, 'worktree-new')
      return jsonOrText(await engine.newTask({ cwd, name }), flags.has('--json'))
    },
  },
  {
    name: 'worktree-info',
    description: '查看指定 worktree 任务的详情',
    input: { hint: '<任务名> [--json]' },
    run: async (engine, cwd, raw) => {
      const { args, flags } = parseInput(raw)
      const name = requireName(args, 'worktree-info')
      return jsonOrText(await engine.info({ cwd, name }), flags.has('--json'))
    },
  },
  {
    name: 'worktree-current',
    description: '查看当前窗口对应的任务或主项目状态',
    input: { hint: '[--json]' },
    run: async (engine, cwd, raw) => {
      const { flags } = parseInput(raw)
      return jsonOrText(await engine.current({ cwd }), flags.has('--json'))
    },
  },
  {
    name: 'worktree-status',
    description: '查看当前 Git 未提交状态',
    input: { hint: '[--json]' },
    run: async (engine, cwd, raw) => {
      const { flags } = parseInput(raw)
      return jsonOrText(await engine.status({ cwd }), flags.has('--json'))
    },
  },
  {
    name: 'worktree-switch',
    description: '把任务改动复制到主项目目录做临时预览',
    input: { hint: '<任务名> | --clear' },
    run: async (engine, cwd, raw) => {
      const { args, flags } = parseInput(raw)
      if (flags.has('--clear')) return (await engine.switchClear({ cwd })).text
      const name = requireName(args, 'worktree-switch')
      return (await engine.switchTask({ cwd, name })).text
    },
  },
  {
    name: 'worktree-merge',
    description: '把任务改动三方合并回主项目目录，不自动 commit',
    input: { hint: '<任务名>' },
    run: async (engine, cwd, raw) => {
      const { args } = parseInput(raw)
      const name = requireName(args, 'worktree-merge')
      return (await engine.mergeTask({ cwd, name })).text
    },
  },
  {
    name: 'worktree-sync',
    description: '把主项目最新提交带到任务目录',
    input: { hint: '<任务名> | --all' },
    run: async (engine, cwd, raw) => {
      const { args, flags } = parseInput(raw)
      if (flags.has('--all')) return (await engine.syncTasks({ cwd, all: true })).text
      const name = requireName(args, 'worktree-sync')
      return (await engine.syncTasks({ cwd, name, all: false })).text
    },
  },
  {
    name: 'worktree-take-sql',
    description: '把任务新增的 SQL 文件拿到主项目目录',
    input: { hint: '<任务名> <sql...>' },
    run: async (engine, cwd, raw) => {
      const { args } = parseInput(raw)
      const name = requireName(args, 'worktree-take-sql')
      if (args.length < 2) throw new WorktreeError('/worktree-take-sql 需要至少一个 SQL 文件。')
      return (await engine.takeSql({ cwd, name, sqlPaths: args.slice(1) })).text
    },
  },
  {
    name: 'worktree-push-sql',
    description: '拿取任务新增 SQL，提交并推送后同步到各任务',
    input: { hint: '<任务名> <sql...>' },
    run: async (engine, cwd, raw) => {
      const { args } = parseInput(raw)
      const name = requireName(args, 'worktree-push-sql')
      if (args.length < 2) throw new WorktreeError('/worktree-push-sql 需要至少一个 SQL 文件。')
      return (await engine.pushSql({ cwd, name, sqlPaths: args.slice(1) })).text
    },
  },
  {
    name: 'worktree-end',
    description: '清理 worktree、任务分支和本地状态',
    input: { hint: '<任务名> [--force]' },
    run: async (engine, cwd, raw) => {
      const { args, flags } = parseInput(raw)
      const name = requireName(args, 'worktree-end')
      return (await engine.endTask({ cwd, name, force: flags.has('--force') })).text
    },
  },
  {
    name: 'worktree-help',
    description: '查看 dsh-worktree 命令帮助',
    run: async (engine) => (await engine.help()).text,
  },
]

/** Register every command as a human-only slash command (never a model tool). */
export function registerCommands(ctx, engine) {
  for (const definition of DEFINITIONS) {
    ctx.effect(() => ctx.commands.register({
      name: definition.name,
      description: definition.description,
      input: definition.input,
      handler: async ({ agent, rawInput }) => {
        try {
          const cwd = ctx.workingDirectory.get(agent.session)
          return { kind: 'success', text: await definition.run(engine, cwd, rawInput ?? '') }
        } catch (error) {
          if (
            error instanceof WorktreeError
            && definition.name === 'worktree-merge'
            && error.message.includes('已保留冲突状态')
          ) {
            try {
              const taskName = parseInput(rawInput).args[0] ?? '任务'
              agent.followup(conflictHandoffMessage(taskName, error.message))
              return {
                kind: 'success',
                text: `合并冲突已产生，已交给 Agent 分析。\n\n${error.message}`,
              }
            } catch {
              // Fall back to the conflict result; the panel keeps its manual analysis action.
            }
          }
          if (error instanceof WorktreeError) return { kind: 'error', text: error.message }
          return {
            kind: 'error',
            text: `worktree 命令失败: ${error?.message ?? String(error)}`,
          }
        }
      },
    }))
  }
}
