import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createDshSessionQuery } from '../lib/dsh-sessions.js'
import { taskMemory } from '../lib/engine.js'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-sessions')
const HOME = path.join(ROOT, `dsh-${Date.now()}`)
const TASK = path.join(ROOT, `task-${Date.now()}`)

function frame(event) {
  return zlib.zstdCompressSync(Buffer.from(`${JSON.stringify(event)}\n`))
}

async function main() {
  fs.mkdirSync(TASK, { recursive: true })
  const dir = path.join(HOME, 'sessions', '--proj--', 'session-sess-1')
  fs.mkdirSync(dir, { recursive: true })
  const events = [
    { type: 'session', version: 4, id: 'sess-1', createdAt: 1790000000000, cwd: TASK },
    {
      type: 'user/message',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text: '请修复登录跳转' }] },
    },
    {
      type: 'assistant/message',
      data: { message: { content: [{ type: 'text', text: '已完成登录修复' }] } },
    },
  ]
  fs.writeFileSync(
    path.join(dir, 'session.v4.jsonl.zstd'),
    Buffer.concat(events.map(frame)),
  )

  process.env.DSH_HOME = HOME
  const query = createDshSessionQuery()
  const records = await query.filterSessions([{ kind: 'cwd', values: [TASK] }])
  assert.equal(records.length, 1)
  assert.equal(records[0].header.id, 'sess-1')

  const memory = await taskMemory(query, TASK)
  assert.deepEqual(memory.prompts, ['请修复登录跳转'])
  assert.equal(memory.summary, '已完成登录修复')

  const other = await query.filterSessions([{ kind: 'cwd', values: [path.join(ROOT, 'missing')] }])
  assert.deepEqual(other, [])

  console.log('SESSION READER TEST PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
