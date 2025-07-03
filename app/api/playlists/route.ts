import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'iptv.sqlite')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channels TEXT NOT NULL
)`)

function isErrorWithMessage(e: unknown): e is { message: string } {
  return typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string';
}

// Add url column if not present
try {
  db.prepare('ALTER TABLE playlists ADD COLUMN url TEXT').run()
} catch (e) {
  if (isErrorWithMessage(e)) {
    if (!e.message.includes('duplicate column name')) throw e as { message: string }
    // Ignore if already exists
  } else {
    throw e
  }
}

// On server start, insert default playlist if table is empty
const count = db.prepare('SELECT COUNT(*) as count FROM playlists').get().count
if (count === 0) {
  db.prepare('INSERT INTO playlists (id, name, url, channels) VALUES (?, ?, ?, ?)')
    .run('default', 'IPTV-org Global', 'https://iptv-org.github.io/iptv/index.m3u', '[]')
}

export async function GET() {
  const rows = db.prepare('SELECT * FROM playlists').all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { id, name, channels } = await req.json()
  if (!id || !name || !channels) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  db.prepare('INSERT OR REPLACE INTO playlists (id, name, channels) VALUES (?, ?, ?)')
    .run(id, name, JSON.stringify(channels))
  return NextResponse.json({ status: 'ok' })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  db.prepare('DELETE FROM playlists WHERE id = ?').run(id)
  return NextResponse.json({ status: 'ok' })
} 