import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get("url")

    if (!url) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    console.log(" Proxying stream request:", url)

    // Fetch the content from the external URL
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: new URL(url).origin,
        Referer: url,
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(" Stream proxy error:", response.status, response.statusText)
      return NextResponse.json(
        { error: `Failed to fetch stream: ${response.status} ${response.statusText}` },
        { status: response.status },
      )
    }

    const contentType = response.headers.get("content-type") || ""
    console.log(" Stream content type:", contentType)

    // Check if this is an M3U8 playlist
    if (
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("application/x-mpegURL") ||
      url.includes(".m3u8")
    ) {
      // Read and rewrite the M3U8 content to proxy all URLs
      const text = await response.text()
      console.log(" Rewriting M3U8 manifest, original length:", text.length)

      // Parse the base URL for relative paths
      const baseUrl = url.substring(0, url.lastIndexOf("/") + 1)

      // Rewrite URLs in the manifest to go through our proxy
      const rewrittenText = text
        .split("\n")
        .map((line) => {
          // Skip comments and empty lines
          if (line.startsWith("#") || !line.trim()) {
            return line
          }

          // Check if line is a URL
          if (line.startsWith("http://") || line.startsWith("https://")) {
            // Absolute URL - proxy it
            const proxyUrl = `/api/stream-proxy?url=${encodeURIComponent(line.trim())}`
            console.log(" Rewriting absolute URL:", line.trim(), "->", proxyUrl)
            return proxyUrl
          } else if (line.trim()) {
            // Relative URL - make it absolute then proxy it
            const absoluteUrl = new URL(line.trim(), baseUrl).href
            const proxyUrl = `/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}`
            console.log(" Rewriting relative URL:", line.trim(), "->", proxyUrl)
            return proxyUrl
          }

          return line
        })
        .join("\n")

      console.log(" Rewritten M3U8 length:", rewrittenText.length)

      return new NextResponse(rewrittenText, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      })
    }

    // For video segments and other content, stream it directly
    const arrayBuffer = await response.arrayBuffer()
    console.log(" Proxying binary content, size:", arrayBuffer.byteLength)

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=3600",
        "Content-Length": arrayBuffer.byteLength.toString(),
      },
    })
  } catch (error: any) {
    console.error(" Stream proxy error:", error)

    if (error.name === "AbortError") {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 })
    }

    return NextResponse.json({ error: error.message || "Failed to proxy stream" }, { status: 500 })
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
