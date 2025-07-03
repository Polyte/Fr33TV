import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import ffmpegPath from 'ffmpeg-static'

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

    // Spawn ffmpeg to record the stream
    const ffmpeg = spawn(ffmpegPath as string, [
      '-y', // overwrite
      '-i', url,
      '-c', 'copy',
      '-t', '00:10:00', // max 10 min for safety
      filePath,
    ])

    ffmpeg.on('error', (err) => {
      console.error('ffmpeg error:', err)
    })

    // Wait for ffmpeg to finish
    await new Promise((resolve, reject) => {
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve(true)
        else reject(new Error('ffmpeg exited with code ' + code))
      })
    })

    return NextResponse.json({ status: 'ok', filePath })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export function GET() {
  return new NextResponse('Method Not Allowed', { status: 405 })
} 