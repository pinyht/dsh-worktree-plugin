#!/usr/bin/env node
/**
 * Standalone worktree task CLI.
 *
 * The skills invoke this process; it is also usable by hand from any checkout.
 * It deliberately depends only on Node and Git, not on DSH Host services.
 */
import { createLocalGit } from '../lib/git.js'
import { createEngine } from '../lib/engine.js'
import { createDshSessionQuery } from '../lib/dsh-sessions.js'
import { WorktreeError } from '../lib/errors.js'

const raw = process.argv.slice(2)
const command = raw[0] ?? 'help'
const rest = raw.slice(1)
const flags = new Set(rest.filter((token) => token.startsWith('--')))
const args = rest.filter((token) => !token.startsWith('--'))
const cwd = process.cwd()

function nameArg(commandName) {
  const name = args[0]
  if (!name) throw new WorktreeError(`/${commandName} 需要任务名。`)
  return name
}

function sqlArgs(commandName) {
  const name = nameArg(commandName)
  if (args.length < 2) throw new WorktreeError(`/${commandName} 需要至少一个 SQL 文件。`)
  return { name, sqlPaths: args.slice(1) }
}

async function run() {
  const engine = createEngine({
    git: createLocalGit(),
    sessionQuery: createDshSessionQuery(),
  })

  let result
  switch (command) {
    case 'new':
      result = await engine.newTask({ cwd, name: nameArg('worktree-new') })
      break
    case 'list':
      result = await engine.list({ cwd })
      break
    case 'info':
      result = await engine.info({ cwd, name: nameArg('worktree-info') })
      break
    case 'current':
      result = await engine.current({ cwd })
      break
    case 'status':
      result = await engine.status({ cwd })
      break
    case 'switch':
      result = flags.has('--clear')
        ? await engine.switchClear({ cwd })
        : await engine.switchTask({ cwd, name: nameArg('worktree-switch') })
      break
    case 'merge':
      result = await engine.mergeTask({ cwd, name: nameArg('worktree-merge') })
      break
    case 'commit-context':
      result = await engine.commitContext({ cwd, name: args[0] })
      break
    case 'mark-committed':
      result = await engine.markCommitted({ cwd, name: nameArg('worktree-commit') })
      break
    case 'sync':
      result = flags.has('--all')
        ? await engine.syncTasks({ cwd, all: true })
        : await engine.syncTasks({ cwd, name: nameArg('worktree-sync'), all: false })
      break
    case 'take-sql': {
      const { name, sqlPaths } = sqlArgs('worktree-take-sql')
      result = await engine.takeSql({ cwd, name, sqlPaths })
      break
    }
    case 'push-sql': {
      const { name, sqlPaths } = sqlArgs('worktree-push-sql')
      result = await engine.pushSql({ cwd, name, sqlPaths })
      break
    }
    case 'end':
      result = await engine.endTask({
        cwd,
        name: nameArg('worktree-end'),
        force: flags.has('--force'),
      })
      break
    case 'help':
    case '--help':
    case '-h':
      result = await engine.help()
      break
    default:
      throw new WorktreeError(`未知子命令: ${command}\n\n${(await engine.help()).text}`)
  }
  if (result?.text) process.stdout.write(`${result.text}\n`)
}

run().catch((error) => {
  const message = error instanceof WorktreeError
    ? error.message
    : `worktree 命令失败: ${error?.message ?? String(error)}`
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
