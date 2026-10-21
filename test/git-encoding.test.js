import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createLocalGit } from '../lib/git.js'

const ROOT = path.join(process.env.HOME, '.cache', 'dsh-worktree-encoding')
const REPO = path.join(ROOT, `repo-${Date.now()}`)
const REPLACEMENT = '\uFFFD'

function line(index) {
  return `第 ${index} 行：这是一段用于验证 UTF-8 分块解码的中文内容，包含标点、数字 ${index} 和 mixed English。`
}

async function main() {
  await fs.mkdir(REPO, { recursive: true })
  const local = createLocalGit()
  await local(['init', '-q'], REPO)
  await local(['config', 'user.email', 'test@example.com'], REPO)
  await local(['config', 'user.name', 'Test'], REPO)
  await local(['config', 'commit.gpgsign', 'false'], REPO)

  // 1. Negative control: the old per-chunk decode corrupts a split character.
  const bytes = Buffer.from('中文测试', 'utf8')
  const naive = [bytes.subarray(0, 1), bytes.subarray(1, 2), bytes.subarray(2)]
    .map((part) => part.toString('utf8'))
    .join('')
  assert.ok(naive.includes(REPLACEMENT), 'per-chunk decoding should corrupt the split character')

  // 2. The runner must preserve a character split across separate pipe reads.
  const splitScript = `
const zh = Buffer.from('中文测试', 'utf8')
process.stdout.write(zh.subarray(0, 1))
setTimeout(() => {
  process.stdout.write(zh.subarray(1, 2))
  setTimeout(() => {
    process.stdout.write(zh.subarray(2))
    const err = Buffer.from('错误信息', 'utf8')
    process.stderr.write(err.subarray(0, 2))
    setTimeout(() => { process.stderr.write(err.subarray(2)) }, 25)
  }, 25)
}, 25)
`
  const node = createLocalGit({ command: process.execPath })
  const split = await node(['-e', splitScript], REPO)
  assert.equal(split.stdout, '中文测试')
  assert.equal(split.stderr, '错误信息')
  assert.ok(!split.stdout.includes(REPLACEMENT))
  assert.ok(!split.stderr.includes(REPLACEMENT))

  // 3. A large single write crosses many 64KB pipe chunks; 65536 % 3 !== 0, so
  //    at least one three-byte character is split at a chunk boundary.
  const largeText = '中文内容'.repeat(40_000)
  const largeScript = path.join(REPO, 'large-output.mjs')
  await fs.writeFile(
    largeScript,
    `process.stdout.write(${JSON.stringify(largeText)})\n`,
    'utf8',
  )
  const large = await node([largeScript], REPO)
  assert.equal(large.stdout.length, largeText.length)
  assert.equal(large.stdout, largeText)
  assert.ok(!large.stdout.includes(REPLACEMENT))

  // 4. Real git: a >64KB Chinese-dense diff must round-trip through git apply.
  const original = Array.from({ length: 1200 }, (_, index) => line(index)).join('\n') + '\n'
  const file = path.join(REPO, 'zh.txt')
  await fs.writeFile(file, original, 'utf8')
  await local(['add', '-A'], REPO)
  await local(['commit', '-qm', 'init'], REPO)

  const updated = `${line(0)}（已修改）\n${original.split('\n').slice(1).join('\n')}\n新增行一：提交说明需要保留中文。\n新增行二：补丁上下文也必须保留中文。\n`
  await fs.writeFile(file, updated, 'utf8')

  // A large new file puts the whole Chinese body into the patch, which is the
  // "damage lands in added content" case that used to write mojibake silently.
  const added = Array.from({ length: 1200 }, (_, index) => line(index)).join('\n') + '\n'
  const addedFile = path.join(REPO, 'zh-new.txt')
  await fs.writeFile(addedFile, added, 'utf8')
  await local(['add', '-A'], REPO)

  const patch = (await local(
    ['diff', '--cached', '--binary', '--full-index', 'HEAD', '--'],
    REPO,
  )).stdout
  assert.ok(patch.length > 64 * 1024, `patch should exceed one pipe chunk (${patch.length} chars)`)
  assert.ok(patch.includes('新增行一'), 'patch should contain the Chinese additions')
  assert.ok(patch.includes('第 1199 行'), 'patch should contain the added file body')
  assert.ok(!patch.includes(REPLACEMENT), 'patch must not contain U+FFFD')

  const patchFile = path.join(REPO, 'change.patch')
  await fs.writeFile(patchFile, patch, 'utf8')
  await local(['reset', '--hard', 'HEAD'], REPO)
  assert.equal(await fs.access(addedFile).then(() => true, () => false), false)

  const check = await local(['apply', '--3way', '--check', patchFile], REPO, { check: false })
  assert.equal(check.code, 0, `git apply --3way --check failed:\n${check.stderr}`)
  const applied = await local(['apply', '--3way', patchFile], REPO)
  assert.equal(applied.code, 0)
  assert.equal(await fs.readFile(file, 'utf8'), updated)
  assert.equal(await fs.readFile(addedFile, 'utf8'), added)

  console.log('GIT ENCODING TEST PASSED')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
