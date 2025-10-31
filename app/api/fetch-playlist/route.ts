import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    console.log(" Fetching playlist from:", url)

    // Fetch the playlist from the server side (bypasses CORS)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
      },
      // Add timeout
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!response.ok) {
      console.log(" Fetch failed with status:", response.status)
      return NextResponse.json(
        { error: `Failed to fetch playlist: ${response.status} ${response.statusText}` },
        { status: response.status },
      )
    }

    const content = await response.text()
    console.log(" Received content length:", content.length)
    console.log(" Content preview:", content.substring(0, 200))

    const hasExtM3U = content.includes("#EXTM3U")
    const hasExtInf = content.includes("#EXTINF")
    const hasHttpUrls = content.includes("http://") || content.includes("https://")
    const hasM3UExtension = url.toLowerCase().includes(".m3u")

    // Accept if it has M3U markers OR if it looks like a playlist with URLs
    if (!hasExtM3U && !hasExtInf && !hasHttpUrls && !hasM3UExtension) {
      console.log(" Content validation failed - not a valid M3U format")
      return NextResponse.json(
        {
          error:
            "Invalid M3U playlist format. The file should contain #EXTM3U or #EXTINF markers, or valid streaming URLs.",
        },
        { status: 400 },
      )
    }

    console.log(" Playlist validated successfully")
    return NextResponse.json({ content })
  } catch (error) {
    console.error(" Error fetching playlist:", error)

    if (error instanceof Error) {
      if (error.name === "AbortError" || error.name === "TimeoutError") {
        return NextResponse.json({ error: "Request timeout - the playlist took too long to load" }, { status: 408 })
      }
      return NextResponse.json({ error: `Failed to fetch playlist: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ error: "Failed to fetch playlist" }, { status: 500 })
  }
}
