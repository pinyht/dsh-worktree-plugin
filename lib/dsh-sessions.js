import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

function dshHome() {
  return process.env.WORKTREE_DSH_HOME || process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

function sessionsRoot() {
  return path.join(dshHome(), 'sessions')
}

function frameOffsets(buffer) {
  const offsets = []
  for (let index = 0; index <= buffer.length - ZSTD_MAGIC.length; index += 1) {
    if (
      buffer[index] === ZSTD_MAGIC[0]
      && buffer[index + 1] === ZSTD_MAGIC[1]
      && buffer[index + 2] === ZSTD_MAGIC[2]
      && buffer[index + 3] === ZSTD_MAGIC[3]
    ) {
      offsets.push(index)
    }
  }
  return offsets
}

function decodeFrames(buffer, limit = Number.POSITIVE_INFINITY) {
  const offsets = frameOffsets(buffer)
  const parts = []
  for (let index = 0; index < offsets.length && index < limit; index += 1) {
    const start = offsets[index]
    const end = index + 1 < offsets.length ? offsets[index + 1] : buffer.length
    try {
      parts.push(zlib.zstdDecompressSync(buffer.subarray(start, end)).toString('utf8'))
    } catch {
      // A partially written or unknown frame is skipped; the remaining frames
      // still carry the session header and messages.
    }
  }
  return parts.join('')
}

function normalizeDirectory(value) {
  if (!value) return null
  try {
    return fs.realpathSync.native(value)
  } catch {
    return path.resolve(value)
  }
}

function sessionFiles() {
  const root = sessionsRoot()
  let projectDirs
  try {
    projectDirs = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  const files = []
  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) continue
    const projectPath = path.join(root, projectDir.name)
    let sessionDirs
    try {
      sessionDirs = fs.readdirSync(projectPath, { withFileTypes: true })
    } catch {
      continue
    }
    for (const sessionDir of sessionDirs) {
      if (!sessionDir.isDirectory()) continue
      const dir = path.join(projectPath, sessionDir.name)
      let entries
      try {
        entries = fs.readdirSync(dir)
      } catch {
        continue
      }
      const file = entries.find((entry) => entry.endsWith('.jsonl.zstd'))
      if (file) files.push(path.join(dir, file))
    }
  }
  return files
}

function readHeader(file) {
  let buffer
  try {
    buffer = fs.readFileSync(file)
  } catch {
    return null
  }
  const text = decodeFrames(buffer, 3)
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const entry = JSON.parse(line)
      if (entry?.type === 'session' && typeof entry.id === 'string' && typeof entry.cwd === 'string') {
        return { id: entry.id, cwd: entry.cwd, createdAt: entry.createdAt ?? 0 }
      }
    } catch {
      // Ignore malformed prefixes; the header is the first complete JSON line.
    }
  }
  return null
}

/**
 * A sessionQuery-compatible reader over DSH's own session logs.
 *
 * The CLI cannot use `ctx.sessionQuery`, but merge-time task memory only needs
 * the header cwd, user prompts, and the last assistant text. This reader keeps
 * that feature in skill mode and degrades to no memory when DSH's on-disk
 * session format changes.
 */
export function createDshSessionQuery() {
  const byId = new Map()

  return {
    async filterSessions(filters) {
      const cwdFilter = filters?.find((filter) => filter.kind === 'cwd')
      const wanted = new Set((cwdFilter?.values ?? []).map(normalizeDirectory).filter(Boolean))
      if (!wanted.size) return []
      const records = []
      for (const file of sessionFiles()) {
        const header = readHeader(file)
        if (!header) continue
        const cwd = normalizeDirectory(header.cwd)
        if (!cwd || !wanted.has(cwd)) continue
        byId.set(header.id, file)
        records.push({
          header: { id: header.id, cwd: header.cwd },
          createdAt: header.createdAt,
          file,
        })
      }
      records.sort((left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0))
      return records
    },

    async readSession(id) {
      const file = byId.get(String(id)) ?? sessionFiles().find((candidate) => {
        const header = readHeader(candidate)
        return header?.id === String(id)
      })
      if (!file) return { events: [] }
      let buffer
      try {
        buffer = fs.readFileSync(file)
      } catch {
        return { events: [] }
      }
      const events = []
      for (const line of decodeFrames(buffer).split('\n')) {
        if (!line.trim()) continue
        try {
          events.push(JSON.parse(line))
        } catch {
          // Skip a truncated final line from an interrupted checkpoint.
        }
      }
      return { events }
    },
  }
}
