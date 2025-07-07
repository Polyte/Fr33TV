import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import ffmpegStatic from 'ffmpeg-static'

// Track ffmpeg processes by filename
const ffmpegProcesses = new Map<string, ReturnType<typeof spawn>>()

// Use ffmpeg-static if available, otherwise fallback to system ffmpeg
const ffmpegPath = ffmpegStatic || 'ffmpeg'

export async function POST(req: NextRequest) {
  try {
    const { url, filename } = await req.json()
    if (!url || !filename) {
      return NextResponse.json({ error: 'Missing url or filename' }, { status: 400 })
    }

    const recordingsDir = path.join(process.cwd(), 'recording')
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir)
    }
    const filePath = path.join(recordingsDir, filename)

    // Spawn ffmpeg to record
    const ffmpeg = spawn(ffmpegPath as string, [
      '-i', url,
      '-c', 'copy',
      '-f', 'mp4',
      filePath
    ])
    ffmpegProcesses.set(filename, ffmpeg)

    ffmpeg.on('close', (code) => {
      ffmpegProcesses.delete(filename)
    })

    return NextResponse.json({ status: 'recording', file: `/recording/${filename}` })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { filename } = await req.json()
    if (!filename) {
      return NextResponse.json({ error: 'Missing filename' }, { status: 400 })
    }
    const ffmpeg = ffmpegProcesses.get(filename)
    if (!ffmpeg) {
      return NextResponse.json({ error: 'No recording in progress for this file' }, { status: 404 })
    }
    ffmpeg.kill('SIGINT')
    ffmpegProcesses.delete(filename)
    return NextResponse.json({ status: 'stopped' })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}

export function GET() {
  return new NextResponse('Method Not Allowed', { status: 405 })
} 