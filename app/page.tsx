"use client"

import { useRef } from "react"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Preloader from "@/components/preloader"
import { ChannelList } from "@/components/channel-list"
import OfflineIndicator from "@/components/offline-indicator"
import ServiceWorkerUpdater from "@/components/service-worker-updater"
import { useDebounce } from "@/hooks/use-debounce"
import { useCache } from "@/hooks/use-cache"
import { usePerformance } from "@/hooks/use-performance"
import { useToast } from "@/hooks/use-toast"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Plus,
  Search,
  Trash2,
  Tv,
  List,
  Upload,
  Sun,
  Moon,
  PlayCircle,
  Download,
  Calendar,
  Clock,
  X,
  AlertTriangle,
  Wifi,
  WifiOff,
  Menu,
} from "lucide-react"

// Lazy load heavy components
const RecordingPlayer = lazy(() =>
  import("@/components/recording-player").then((module) => ({ default: module.RecordingPlayer })),
)

interface Channel {
  name: string
  url: string
  group?: string
  logo?: string
  isWorking?: boolean
  lastChecked?: Date
}

interface Playlist {
  id: string
  name: string
  url?: string
  channels: Channel[]
}

interface EPGProgram {
  id: string
  channelId: string
  title: string
  description?: string
  category?: string
  start: Date
  end: Date
  icon?: string
}

interface EPGChannel {
  id: string
  displayName: string
  icon?: string
}

interface EPGData {
  channels: EPGChannel[]
  programs: EPGProgram[]
}

interface Recording {
  id: string
  programId: string
  channelName: string
  channelUrl: string
  title: string
  description?: string
  category?: string
  startTime: Date
  endTime: Date
  status: "scheduled" | "recording" | "completed" | "failed" | "cancelled"
  filePath?: string
  fileSize?: number
}

interface RecordingConflict {
  recording1: Recording
  recording2: Recording
  overlapStart: Date
  overlapEnd: Date
}

// Working demo video sources
const DEMO_SOURCES = [
  {
    name: "Big Buck Bunny",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    type: "video/mp4",
  },
  {
    name: "Elephant Dream",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    type: "video/mp4",
  },
  {
    name: "For Bigger Blazes",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    type: "video/mp4",
  },
  {
    name: "Sintel",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    type: "video/mp4",
  },
]

// Optimized M3U parser with Web Workers support
const parseM3UOptimized = (content: string, onProgress?: (progress: number) => void): Promise<Channel[]> => {
  return new Promise((resolve, reject) => {
    try {
      console.log("[v0] Starting M3U parsing, content length:", content.length)

      const normalizedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
      const lines = normalizedContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line)

      console.log("[v0] Total lines to process:", lines.length)

      // Use Web Worker for large playlists (>50KB or >500 lines)
      if ((content.length > 50000 || lines.length > 500) && typeof Worker !== "undefined") {
        console.log("[v0] Using Web Worker for parsing")

        const workerCode = `
          self.onmessage = function(e) {
            const { content } = e.data;
            const lines = content.split('\\n').map(line => line.trim()).filter(line => line);
            const channels = [];
            const categorySet = new Set();
            
            console.log('[v0 Worker] Processing', lines.length, 'lines');
            
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              
              // Look for EXTINF lines
              if (line.startsWith('#EXTINF:')) {
                const extinf = line;
                let url = '';
                
                // Find the next non-comment line as the URL
                for (let j = i + 1; j < lines.length; j++) {
                  if (!lines[j].startsWith('#')) {
                    url = lines[j];
                    break;
                  }
                }
                
                if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('rtmp://') || url.startsWith('rtsp://'))) {
                  // Extract channel name (after the comma)
                  const nameMatch = extinf.match(/,(.+)$/);
                  const name = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';
                  
                  // Extract group/category
                  const groupMatch = extinf.match(/group-title="([^"]+)"/i);
                  const group = groupMatch ? groupMatch[1].trim() : 'Uncategorized';
                  
                  // Extract logo
                  const logoMatch = extinf.match(/tvg-logo="([^"]+)"/i);
                  const logo = logoMatch ? logoMatch[1] : undefined;
                  
                  channels.push({ name, url, group, logo });
                  categorySet.add(group);
                  
                  // Report progress every 50 channels
                  if (channels.length % 50 === 0) {
                    self.postMessage({ type: 'progress', progress: (i / lines.length) * 100 });
                  }
                }
              }
            }
            
            console.log('[v0 Worker] Parsed', channels.length, 'channels');
            self.postMessage({ 
              type: 'complete', 
              channels, 
              categories: Array.from(categorySet).sort() 
            });
          };
        `

      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
          const { type, channels, progress } = e.data
          if (type === "progress" && onProgress) {
            onProgress(progress)
          } else if (type === "complete") {
            console.log("[v0] Worker completed, channels:", channels.length)
            worker.terminate()
            URL.revokeObjectURL(blob)
            resolve(channels)
          }
        }

        worker.onerror = (error) => {
          console.error("[v0] Worker error:", error)
          worker.terminate()
          // Fallback to main thread
          parseMainThread()
        }

        worker.postMessage({ content: normalizedContent })
      } else {
        // Parse on main thread for smaller playlists
        parseMainThread()
      }

      function parseMainThread() {
        console.log("[v0] Using main thread for parsing")
        const channels: Channel[] = []
        const categorySet = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("#EXTINF:")) {
      const extinf = lines[i]
      const url = lines[i + 1]

      if (url && !url.startsWith("#")) {
        const nameMatch = extinf.match(/,(.+)$/)
        const name = nameMatch ? nameMatch[1].trim() : "Unknown Channel"

        const groupMatch = extinf.match(/group-title="([^"]+)"/i)
        const group = groupMatch ? groupMatch[1] : "Uncategorized"

        const logoMatch = extinf.match(/tvg-logo="([^"]+)"/i)
        const logo = logoMatch ? logoMatch[1] : undefined

        channels.push({ name, url, group, logo })

              // Report progress every 50 channels
              if (onProgress && channels.length % 50 === 0) {
                onProgress((i / lines.length) * 100)
              }
            }
          }
        }

        console.log("[v0] Main thread parsed", channels.length, "channels")

        if (onProgress) onProgress(100)

        if (channels.length === 0) {
          reject(new Error("No valid channels found in the playlist. Please check the M3U format."))
        } else {
          resolve(channels)
        }
      }
    } catch (error) {
      console.error("[v0] Error parsing M3U:", error)
      reject(error)
    }
  })
}

// Dummy parseXMLTV function (replace with actual implementation)
const parseXMLTV = (xml: string): EPGData => {
  return { channels: [], programs: [] }
}

// Generate stable IDs for SSR consistency
const generateId = (prefix: string, data: any): string => {
  const hash = JSON.stringify(data).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return `${prefix}-${Math.abs(hash)}-${Date.now()}`
}

// Video source validation with fallback methods
const validateVideoSource = async (url: string): Promise<boolean> => {
  try {
    // First try HEAD request
    const headResponse = await fetch(url, { 
      method: "HEAD",
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    
    if (headResponse.ok) {
      return true
    }
    
    // If HEAD returns 405 (Method Not Allowed), try GET with range
    if (headResponse.status === 405) {
      const getResponse = await fetch(url, {
        method: "GET",
        headers: { "Range": "bytes=0-1023" }, // Request first 1KB
        signal: AbortSignal.timeout(5000)
      })
      return getResponse.ok || getResponse.status === 206 // 206 Partial Content is also valid
    }
    
    // For other status codes, check if they're in the acceptable range
    return headResponse.status >= 200 && headResponse.status < 400
  } catch (error) {
    // If all methods fail, assume the source might still be valid
    // Many IPTV sources don't support HEAD requests but work fine with video players
    console.warn(`Video source validation failed for ${url}:`, error)
    return true // Assume valid unless we can definitively prove it's not
  }
}

function IPTVPlayer() {
  const { startRender, endRender } = usePerformance()
  const { get: getCached, set: setCached } = useCache<any>()
  const { toast } = useToast()

  // Core state
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Video state
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // UI state
  const [isAddPlaylistOpen, setIsAddPlaylistOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState("")
  const [playlistUrl, setPlaylistUrl] = useState("")
  const [playlistContent, setPlaylistContent] = useState("")
  const [addMethod, setAddMethod] = useState<"url" | "content">("url")

  // EPG state
  const [epgData, setEpgData] = useState<EPGData>({ channels: [], programs: [] })
  const [showEPG, setShowEPG] = useState(false)
  const [epgDate, setEpgDate] = useState<Date | null>(null)
  const [isAddEPGOpen, setIsAddEPGOpen] = useState(false)
  const [epgUrl, setEpgUrl] = useState("")
  const [selectedProgram, setSelectedProgram] = useState<EPGProgram | null>(null)

  // Recording state
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [showRecordings, setShowRecordings] = useState(false)
  const [recordingConflicts, setRecordingConflicts] = useState<RecordingConflict[]>([])
  const [isRecordingPlayerOpen, setIsRecordingPlayerOpen] = useState(false)
  const [playingRecording, setPlayingRecording] = useState<Recording | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Performance state
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [isLogoHovered, setIsLogoHovered] = useState(false)

  // App loading state
  const [isAppLoading, setIsAppLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  // Network state
  const [isOnline, setIsOnline] = useState(true)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [recordingFile, setRecordingFile] = useState<string | null>(null)
  const [recordingFilename, setRecordingFilename] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Memoized theme classes
  const themeClasses = useMemo(
    () => ({
      background: `${isDarkMode ? "bg-gray-900" : "bg-gray-50"} transition-all duration-300 ease-in-out`,
      text: `${isDarkMode ? "text-white" : "text-gray-900"} transition-colors duration-300 ease-in-out`,
      sidebar: `${isDarkMode ? "bg-gray-800" : "bg-white"} transition-all duration-300 ease-in-out`,
      sidebarBorder: `${isDarkMode ? "border-gray-700" : "border-gray-200"} transition-colors duration-300 ease-in-out`,
      card: `${isDarkMode ? "bg-gray-800" : "bg-white"} transition-all duration-300 ease-in-out`,
      cardBorder: `${isDarkMode ? "border-gray-700" : "border-gray-200"} transition-colors duration-300 ease-in-out`,
      input: `${isDarkMode ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"} transition-all duration-300 ease-in-out`,
      button: `${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"} transition-all duration-200 ease-in-out`,
      buttonText: `${isDarkMode ? "text-white" : "text-gray-900"} transition-colors duration-300 ease-in-out`,
      muted: `${isDarkMode ? "text-gray-400" : "text-gray-600"} transition-colors duration-300 ease-in-out`,
      accent: "text-blue-500 transition-colors duration-300 ease-in-out",
      success: `${isDarkMode ? "text-green-400" : "text-green-600"} transition-colors duration-300 ease-in-out`,
      warning: `${isDarkMode ? "text-yellow-400" : "text-yellow-600"} transition-colors duration-300 ease-in-out`,
      error: `${isDarkMode ? "text-red-400" : "text-red-600"} transition-colors duration-300 ease-in-out`,
      hover: `${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"} transition-all duration-200 ease-in-out`,
      selected: `${isDarkMode ? "bg-blue-600" : "bg-blue-500"} transition-all duration-200 ease-in-out`,
      separator: `${isDarkMode ? "bg-gray-700" : "bg-gray-200"} transition-colors duration-300 ease-in-out`,
      dialog: `${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} transition-all duration-300 ease-in-out`,
      overlay: `${isDarkMode ? "bg-black/80" : "bg-white/90"} transition-all duration-300 ease-in-out`,
    }),
    [isDarkMode],
  )

  // Network status monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Optimized toggle theme
  const toggleTheme = useCallback(() => {
    setIsThemeTransitioning(true)
    setShowParticles(true)

    setTimeout(() => {
      setIsDarkMode(!isDarkMode)
      setTimeout(() => {
        setShowParticles(false)
        setIsThemeTransitioning(false)
      }, 2000)
    }, 100)
  }, [isDarkMode])

  // Initialize app with performance optimizations
  useEffect(() => {
    startRender()
    const initializeApp = async () => {
      try {
        setEpgDate(new Date())
        const savedTheme = getCached("iptv-theme") || (typeof window !== 'undefined' ? localStorage.getItem("iptv-theme") : null)
        if (savedTheme === "dark") setIsDarkMode(true)
        // Fetch playlists from backend
        const res = await fetch('/api/playlists')
        const data = await res.json()
        setPlaylists(data)
        if (data.length > 0) setSelectedPlaylist(data[0].id)
        // Load saved recordings (keep as is)
        const savedRecordings = typeof window !== 'undefined' ? localStorage.getItem("iptv-recordings") : null
        if (savedRecordings) {
          const parsedRecordings = JSON.parse(savedRecordings).map((r: any) => ({
            ...r,
            startTime: new Date(r.startTime),
            endTime: new Date(r.endTime),
          }))
          setRecordings(parsedRecordings)
        }
        await new Promise((resolve) => setTimeout(resolve, 1500))
        setIsInitialized(true)
      } catch (error) {
        console.error("Error initializing app:", error)
        toast({
          title: "Initialization Error",
          description: "Failed to load application data. Please refresh the page.",
          variant: "destructive",
        })
      } finally {
        setIsAppLoading(false)
        endRender()
      }
    }
    initializeApp()
  }, [])

  // Optimized theme persistence
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      const theme = isDarkMode ? "dark" : "light"
      localStorage.setItem("iptv-theme", theme)
      setCached("iptv-theme", theme)

      if (isDarkMode) {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }
  }, [isDarkMode, isInitialized, setCached])

  // Video event handlers
  const handleLoadStart = useCallback(() => {
    setIsVideoLoading(true)
    setVideoError(null)
    
    // Set a timeout to prevent infinite loading
    // IPTV streams may take longer to start, so we use a longer timeout
    setTimeout(() => {
      if (videoRef.current && videoRef.current.currentTime === 0 && videoRef.current.readyState < 2) {
        setIsVideoLoading(false)
        setVideoError("Stream loading timeout. The channel may be unavailable or blocked.")
      }
    }, 25000) // 25 second timeout for IPTV streams
  }, [])

  const handleCanPlay = useCallback(() => {
    setIsVideoLoading(false)
    setVideoError(null)
  }, [])

  const handleError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    setIsVideoLoading(false)
    const target = e.currentTarget
    let errorMessage = "Unknown video error"

    if (target.error) {
      switch (target.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = "Video playback was aborted"
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = "Network error occurred while loading video"
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = "Video format not supported or corrupted"
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = "Video source not supported or not found"
          break
      }
    }

    // Check for specific HTTP errors and IPTV issues
    if (target.src) {
      const url = new URL(target.src)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        // Check for common IPTV server issues
        if (target.error && target.error.code === MediaError.MEDIA_ERR_NETWORK) {
          errorMessage = "Stream server error (405/403). This channel may be temporarily unavailable."
        } else if (target.error && target.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
          errorMessage = "Stream format not supported. This may be a geoblocked stream, private stream, or unsupported format. Try using a different browser or VPN."
        } else if (target.error && target.error.code === MediaError.MEDIA_ERR_DECODE) {
          errorMessage = "Stream encoding not supported. The stream may use a codec not supported by your browser."
        } else {
          errorMessage = "Stream may be unavailable, blocked, or requires authentication. Some IPTV streams require specific headers or user agents."
        }
      }
    }

    setVideoError(errorMessage)
    
    // Only show toast for non-abort errors (user-initiated stops shouldn't show errors)
    if (target.error && target.error.code !== MediaError.MEDIA_ERR_ABORTED) {
      toast({
        title: "Video Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }, [toast])

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }, [])

  const handleDurationChange = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }, [])

  // Set volume when it changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
    }
  }, [volume])

  // Set muted state when it changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted
    }
  }, [isMuted])

  // Optimized add playlist from URL
  const addPlaylistFromUrl = useCallback(async () => {
    if (!playlistName || !playlistUrl) return
    setIsLoadingPlaylist(true)
    setLoadingProgress(0)
    try {
      console.log("[v0] Adding playlist from URL:", playlistUrl)

      // Check cache first
      const cacheKey = `playlist-${playlistUrl}`
      const cachedChannels = getCached(cacheKey)

      if (cachedChannels && Array.isArray(cachedChannels) && cachedChannels.length > 0) {
        console.log("[v0] Using cached playlist data")
        const newPlaylist: Playlist = {
          id: Date.now().toString(),
          name: playlistName,
          channels: cachedChannels,
        }
        setPlaylists((prev) => [...prev, newPlaylist])

        // Update categories
        const categorySet = new Set(cachedChannels.map((ch) => ch.group).filter(Boolean))
        setCategories(Array.from(categorySet).sort())

        setPlaylistName("")
        setPlaylistUrl("")
        setIsAddPlaylistOpen(false)
        setIsLoadingPlaylist(false)
        toast({
          title: "Playlist Added",
          description: `${playlistName} has been added with ${cachedChannels.length} channels (from cache).`,
        })
        return
      }

      // Use server-side proxy to bypass CORS
      console.log("[v0] Fetching playlist via API")
      const response = await fetch("/api/fetch-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: playlistUrl }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const { content } = await response.json()
      console.log("[v0] Received playlist content, length:", content.length)

      // Parse the M3U content
      const channels = await parseM3UOptimized(content, (progress) => {
        setLoadingProgress(progress)
      })

      console.log("[v0] Parsed channels:", channels.length)

      if (channels.length === 0) {
        throw new Error("No valid channels found in playlist")
      }

      // Cache the channels
      setCached(cacheKey, channels)

      const newPlaylist: Playlist = {
        id: Date.now().toString(),
        name: playlistName,
        channels,
      }

      setPlaylists((prev) => [...prev, newPlaylist])

      // Update categories
      const categorySet = new Set(channels.map((ch) => ch.group).filter(Boolean))
      setCategories(Array.from(categorySet).sort())

      setPlaylistName("")
      setPlaylistUrl("")
      setIsAddPlaylistOpen(false)
      toast({ title: "Playlist Added", description: `${playlistName} has been added successfully.` })
    } catch (error) {
      console.error("[v0] Error adding playlist:", error)
      toast({
        title: "Error Adding Playlist",
        description:
          error instanceof Error ? error.message : "Failed to add playlist. Please check the URL and try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingPlaylist(false)
      setLoadingProgress(0)
    }
  }, [playlistName, playlistUrl, toast])

  // Optimized add playlist from content
  const addPlaylistFromContent = useCallback(async () => {
    if (!playlistName || !playlistContent) {
      toast({
        title: "Missing Information",
        description: "Please provide both playlist name and content.",
        variant: "destructive",
      })
      return
    }

    setIsLoadingPlaylist(true)
    setLoadingProgress(0)

    try {
      console.log("[v0] Parsing playlist from content")
      const channels = await parseM3UOptimized(playlistContent, (progress) => {
        setLoadingProgress(progress)
      })

      console.log("[v0] Parsed channels:", channels.length)

      if (channels.length === 0) {
        throw new Error("No valid channels found in playlist content")
      }

      const newPlaylist: Playlist = {
        id: generateId("playlist", { name: playlistName, channels }),
        name: playlistName,
        channels,
      }

      setPlaylists((prev) => [...prev, newPlaylist])

      // Update categories
      const categorySet = new Set(channels.map((ch) => ch.group))
      setCategories(Array.from(categorySet).filter((group): group is string => typeof group === "string").sort())

      setPlaylistName("")
      setPlaylistContent("")
      setIsAddPlaylistOpen(false)

      toast({
        title: "Playlist Added",
        description: `${playlistName} has been added with ${channels.length} channels.`,
      })
    } catch (error) {
      console.error("[v0] Error parsing playlist:", error)
      toast({
        title: "Error Adding Playlist",
        description: "Failed to parse playlist content. Please check the format.",
        variant: "destructive",
      })
    }
  }, [playlistName, playlistContent, toast])

  // Optimized file upload handler
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const content = e.target?.result as string
          setPlaylistContent(content)
          setAddMethod("content")
        }
        reader.onerror = () => {
          toast({
            title: "File Error",
            description: "Failed to read the selected file.",
            variant: "destructive",
          })
        }
        reader.readAsText(file)
      }
    },
    [toast],
  )

  // Memoized filtered channels
  const filteredChannels = useMemo(() => {
    if (!selectedPlaylist) return []

    const playlist = playlists.find((p) => p.id === selectedPlaylist)
    if (!playlist) return []

    let filtered = playlist.channels

    // Filter by search term (debounced)
    if (debouncedSearchTerm) {
      const lowerSearchTerm = debouncedSearchTerm.toLowerCase()
      filtered = filtered.filter(
        (channel) =>
          channel.name.toLowerCase().includes(lowerSearchTerm) ||
          (channel.group && channel.group.toLowerCase().includes(lowerSearchTerm)),
      )
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((channel) => channel.group === selectedCategory)
    }

    return filtered
  }, [playlists, selectedPlaylist, debouncedSearchTerm, selectedCategory])

  // Optimized channel selection with error handling
  const handleChannelSelect = useCallback(
    async (channel: Channel) => {
      console.log("[v0] Selecting channel:", channel.name)
      setSelectedChannel(channel)
      setVideoError(null)
      setIsVideoLoading(true)

      if (videoRef.current) {
        try {
          // Reset video state
          videoRef.current.pause()
          videoRef.current.currentTime = 0
          setCurrentTime(0)
          setDuration(0)
          setIsPlaying(false)

          // Set the video source immediately for better UX
          // For IPTV streams, we need to handle different formats
          const video = videoRef.current

          // Check if the URL is an HLS stream (.m3u8)
          if (channel.url.includes(".m3u8")) {
            const proxyUrl = `/api/stream-proxy?url=${encodeURIComponent(channel.url)}`
            console.log("[v0] Using proxy URL for HLS stream:", proxyUrl)

            // Use HLS.js for HLS streams
            if (typeof window !== "undefined" && "Hls" in window) {
              const Hls = (window as any).Hls

              if (Hls.isSupported()) {
                // Destroy existing HLS instance if any
                if ((video as any).hls) {
                  ;(video as any).hls.destroy()
                }

                const hls = new Hls({
                  enableWorker: true,
                  lowLatencyMode: true,
                  backBufferLength: 90,
                  xhrSetup: (xhr: XMLHttpRequest, url: string) => {
                    xhr.withCredentials = false
                  },
                })

                hls.loadSource(proxyUrl)
                hls.attachMedia(video)

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                  console.log("[v0] HLS manifest parsed successfully, attempting to play")
                  video.play().catch((error) => {
                    console.error("[v0] HLS play error:", error)
                    setVideoError(`Failed to play HLS stream: ${error.message}`)
                  })
                })

                hls.on(Hls.Events.ERROR, (event, data) => {
                  console.error("[v0] HLS error:", data)
                  if (data.fatal) {
                    switch (data.type) {
                      case Hls.ErrorTypes.NETWORK_ERROR:
                        console.error("[v0] Fatal network error, attempting recovery")
                        setVideoError("Network error loading stream. Retrying...")
                        hls.startLoad()
                        break
                      case Hls.ErrorTypes.MEDIA_ERROR:
                        console.error("[v0] Fatal media error, attempting recovery")
                        setVideoError("Media error, attempting recovery...")
                        hls.recoverMediaError()
                        break
                      default:
                        console.error("[v0] Fatal error, cannot recover")
                        setVideoError("Fatal error loading stream. The stream may be unavailable.")
                        hls.destroy()
                        break
                    }
                  }
                })

                // Store HLS instance on video element for cleanup
                ;(video as any).hls = hls
              } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                console.log("[v0] Using native HLS support with proxy")
                video.src = proxyUrl
                video.load()
                video.play().catch((error) => {
                  console.error("[v0] Native HLS play error:", error)
                  setVideoError(`Failed to play stream: ${error.message}`)
                })
              } else {
                setVideoError("HLS streams are not supported in this browser")
              }
            } else {
              // HLS.js not loaded yet, load it dynamically
              console.log("[v0] Loading HLS.js library")
              const script = document.createElement("script")
              script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest"
              script.onload = () => {
                console.log("[v0] HLS.js loaded, retrying channel selection")
                handleChannelSelect(channel)
              }
              script.onerror = () => {
                setVideoError("Failed to load HLS player library")
              }
              document.head.appendChild(script)
              return
            }
          } else {
            // Regular video source (MP4, WebM, etc.)
            // Destroy HLS instance if exists
            if ((video as any).hls) {
              ;(video as any).hls.destroy()
              delete (video as any).hls
            }

            video.src = channel.url
            video.load()

            // Attempt to play after a short delay to ensure load has started
            setTimeout(() => {
              video.play().catch((error) => {
                console.error("[v0] Play error:", error)
                setVideoError(`Failed to play video: ${error.message}`)
              })
            })
          }

          toast({
            title: "Channel Selected",
            description: `Now playing: ${channel.name}`,
          })
        } catch (error) {
          console.error("[v0] Error loading channel:", error)
          setVideoError(`Failed to load channel: ${channel.name}`)
          toast({
            title: "Channel Error",
            description: `Failed to load ${channel.name}. The source may be unavailable.`,
            variant: "destructive",
          })
        }
      }
    },
    [isOnline, toast],
  )

  // Retry mechanism for failed channels
  const retryChannel = useCallback(() => {
    if (!selectedChannel || !videoRef.current) {
      console.warn('Cannot retry: no channel selected or video element not available')
      return
    }
    
    // Clear any existing error state
    setVideoError(null)
    setIsVideoLoading(true)
    
    // Try different approaches for IPTV streams
    const video = videoRef.current
    
    // Clear any existing sources
    while (video.firstChild) {
      video.removeChild(video.firstChild)
    }
    
    // Try with different user agent simulation for some streams
    const formats = [
      { type: 'application/x-mpegURL', ext: '.m3u8' },
      { type: 'application/vnd.apple.mpegurl', ext: '.m3u8' },
      { type: 'video/mp4', ext: '.mp4' },
      { type: 'video/webm', ext: '.webm' },
      { type: 'video/ogg', ext: '.ogv' },
      { type: 'application/octet-stream', ext: '' } // Generic fallback
    ]
    
    formats.forEach(format => {
      const source = document.createElement('source')
      source.src = selectedChannel?.url || ''
      source.type = format.type
      video.appendChild(source)
    })
    
    video.load()
    
    toast({
      title: "Retrying Channel",
      description: `Attempting to load ${selectedChannel?.name || 'Channel'} with different formats...`,
    })
  }, [selectedChannel, toast])

  // Optimized video controls
  const togglePlay = useCallback(() => {
    if (videoRef.current && !videoError) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play().catch((error) => {
          console.error("Play failed:", error)
          setVideoError("Failed to play video")
        })
      }
    }
  }, [isPlaying, videoError])

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }, [isMuted])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }, [])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number.parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        videoRef.current.requestFullscreen().catch((error) => {
          console.error("Fullscreen failed:", error)
          toast({
            title: "Fullscreen Error",
            description: "Failed to enter fullscreen mode.",
            variant: "destructive",
          })
        })
      }
    }
  }, [toast])

  // Optimized recording functions
  const playRecording = useCallback((recording: Recording) => {
    setPlayingRecording(recording)
    setIsRecordingPlayerOpen(true)
  }, [])

  const formatFileSize = useCallback((bytes?: number) => {
    if (!bytes) return "Unknown"
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }, [])

  const formatTime = useCallback((time: number) => {
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [])

  // Load default playlist for demo with working sources
  const loadDefaultPlaylist = useCallback(async () => {
    const demoChannels: Channel[] = DEMO_SOURCES.map((source, index) => ({
      name: source.name,
      url: source.url,
      group: "Demo",
      logo: "/placeholder.svg?height=40&width=40",
      isWorking: true,
      lastChecked: new Date(),
    }))

    const demoPlaylist: Playlist = {
      id: "demo",
      name: "Demo Playlist",
      channels: demoChannels,
    }

    setPlaylists([demoPlaylist])
    setCategories(["Demo"])

    toast({
      title: "Demo Playlist Loaded",
      description: `${demoChannels.length} demo channels are ready to play.`,
    })
  }, [toast])

  useEffect(() => {
    return () => {
      if (videoRef.current && (videoRef.current as any).hls) {
        ;(videoRef.current as any).hls.destroy()
      }
    }
  }, [])

  // Render loading state
  if (isAppLoading) {
    return <Preloader isLoading={isAppLoading} onLoadingComplete={() => setIsAppLoading(false)} />
  }

  return (
    <div className={`min-h-screen ${themeClasses.background} ${themeClasses.text} relative overflow-hidden`}>
      <OfflineIndicator />
      <ServiceWorkerUpdater />

      {/* Network Status */}
      {!isOnline && (
        <div className="fixed top-4 right-4 z-50">
          <Alert className="bg-red-500 text-white border-red-600">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>You are currently offline. Some features may not work.</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Theme transition particles */}
      {showParticles && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 50 }).map((_, i) => {
            // Use deterministic values for SSR consistency
            const left = ((i * 13) % 100) + (i % 7) * 5
            const top = ((i * 17) % 100) + (i % 11) * 3
            const delay = (i % 5) * 0.3
            const duration = 2 + (i % 4) * 0.4
            
            return (
              <div
                key={i}
                className={`absolute w-2 h-2 rounded-full ${
                  isDarkMode ? "bg-blue-400" : "bg-yellow-400"
                } animate-float opacity-70`}
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                }}
              />
            )
          })}
        </div>
      )}

      <div className="flex h-screen">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar */}
        <div className={`fixed md:relative inset-y-0 left-0 z-50 w-80 ${themeClasses.sidebar} border-r ${themeClasses.sidebarBorder} flex flex-col transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onMouseEnter={() => setIsLogoHovered(true)}
                onMouseLeave={() => setIsLogoHovered(false)}
              >
                <div
                  className={`p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 transform transition-all duration-300 ${
                    isLogoHovered ? "scale-110 rotate-12" : "scale-100 rotate-0"
                  }`}
                >
                  <Tv className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Fr33 TV
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className={`${themeClasses.button} ${themeClasses.buttonText} transform transition-all duration-300 hover:scale-110`}
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
                {/* Mobile close button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarOpen(false)}
                  className={`${themeClasses.button} ${themeClasses.buttonText} md:hidden`}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="channel-search"
                placeholder="Search channels..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${themeClasses.input}`}
                aria-label="Search channels"
              />
            </div>
          </div>

          {/* Playlist Selection */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Playlists</Label>
              <Dialog open={isAddPlaylistOpen} onOpenChange={setIsAddPlaylistOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={`${themeClasses.button} ${themeClasses.buttonText}`}
                    aria-label="Add new playlist"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className={themeClasses.dialog}>
                  <DialogHeader>
                    <DialogTitle>Add Playlist</DialogTitle>
                    <DialogDescription>
                      Add a new playlist by providing a URL, pasting content, or uploading a file.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="playlist-name">Playlist Name</Label>
                      <Input
                        id="playlist-name"
                        value={playlistName}
                        onChange={(e) => setPlaylistName(e.target.value)}
                        placeholder="Enter playlist name"
                        className={themeClasses.input}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant={addMethod === "url" ? "default" : "outline"}
                        onClick={() => setAddMethod("url")}
                        size="sm"
                      >
                        URL
                      </Button>
                      <Button
                        variant={addMethod === "content" ? "default" : "outline"}
                        onClick={() => setAddMethod("content")}
                        size="sm"
                      >
                        Content
                      </Button>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} size="sm">
                        <Upload className="w-4 h-4 mr-1" />
                        File
                      </Button>
                    </div>

                    {addMethod === "url" ? (
                      <div>
                        <Label htmlFor="playlist-url">Playlist URL</Label>
                        <Input
                          id="playlist-url"
                          value={playlistUrl}
                          onChange={(e) => setPlaylistUrl(e.target.value)}
                          placeholder="Enter M3U playlist URL"
                          className={themeClasses.input}
                        />
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="playlist-content">Playlist Content</Label>
                        <Textarea
                          id="playlist-content"
                          value={playlistContent}
                          onChange={(e) => setPlaylistContent(e.target.value)}
                          placeholder="Paste M3U playlist content here"
                          rows={6}
                          className={themeClasses.input}
                        />
                      </div>
                    )}

                    {isLoadingPlaylist && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Loading playlist...</span>
                          <span>{Math.round(loadingProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${loadingProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={addMethod === "url" ? addPlaylistFromUrl : addPlaylistFromContent}
                        disabled={
                          isLoadingPlaylist || !playlistName || (addMethod === "url" ? !playlistUrl : !playlistContent)
                        }
                        className="flex-1"
                      >
                        Add Playlist
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAddPlaylistOpen(false)
                          setPlaylistName("")
                          setPlaylistUrl("")
                          setPlaylistContent("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <select
              id="playlist-select"
              value={selectedPlaylist || ""}
              onChange={(e) => setSelectedPlaylist(e.target.value || null)}
              className={`w-full p-2 rounded border ${themeClasses.input}`}
              aria-label="Select a playlist"
            >
              <option value="">Select a playlist</option>
              {playlists.map((playlist, idx) => (
                <option key={playlist.id || idx} value={playlist.id || idx}>
                  {playlist.name} ({playlist.channels ? playlist.channels.length : 0} channels)
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <Label className="text-sm font-medium mb-2 block">Categories</Label>
              <select
                id="category-select"
                value={selectedCategory || ""}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className={`w-full p-2 rounded border ${themeClasses.input}`}
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Channel List */}
          <div className="flex-1 overflow-hidden">
            {selectedPlaylist ? (
              <ChannelList
                channels={filteredChannels}
                selectedChannel={selectedChannel}
                onChannelSelect={handleChannelSelect}
                searchTerm={debouncedSearchTerm}
                selectedCategory={selectedCategory}
                isDarkMode={isDarkMode}
                containerHeight={400}
              />
            ) : (
              <div className="p-4 text-center text-gray-500">
                <Tv className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a playlist to view channels</p>
                <p className="text-xs mt-1">Or add a new playlist to get started</p>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <Button
              variant="outline"
              onClick={() => setShowRecordings(!showRecordings)}
              className={`w-full ${themeClasses.button} ${themeClasses.buttonText}`}
            >
              <List className="w-4 h-4 mr-2" />
              Recordings ({recordings.length})
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Mobile Header with Menu Button */}
          <div className="md:hidden p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSidebarOpen(true)}
                  className={`${themeClasses.button} ${themeClasses.buttonText}`}
                >
                  <Menu className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                  Fr33 TV
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {isOnline ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleTheme}
                  className={`${themeClasses.button} ${themeClasses.buttonText}`}
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {/* Video Player */}
          <div className="flex-1 bg-black relative">
            {/* Video Error Display */}
            {videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                <div className="text-center text-white p-8 max-w-md">
                  <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                  <h3 className="text-xl font-semibold mb-2">Video Error</h3>
                  <p className="text-gray-300 mb-4">{videoError}</p>
                  
                  {/* Helpful tips for IPTV issues */}
                  <div className="text-left text-sm text-gray-400 mb-4 bg-gray-800 p-3 rounded">
                    <p className="font-medium mb-2">Troubleshooting tips:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Try a different browser (Chrome, Firefox, Safari)</li>
                      <li>• Check if the stream requires a VPN</li>
                      <li>• Some streams may be geoblocked</li>
                      <li>• Try refreshing the page and selecting again</li>
                    </ul>
                  </div>
                  
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={retryChannel}
                      variant="outline"
                      className="text-white border-white hover:bg-white hover:text-black"
                    >
                      Retry
                    </Button>
                    <Button
                      onClick={() => setVideoError(null)}
                      variant="ghost"
                      className="text-gray-300 hover:text-white"
                    >
                      Try Another Channel
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isVideoLoading && !videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
                  <p className="text-lg font-medium mb-2">Loading {selectedChannel?.name || 'Channel'}...</p>
                  <p className="text-sm text-gray-300">Connecting to stream server</p>
                  <p className="text-xs text-gray-400 mt-1">This may take a few seconds for live streams</p>
                </div>
              </div>
            )}

            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              controls={false}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onLoadStart={handleLoadStart}
              onCanPlay={handleCanPlay}
              onError={(e) => handleError(e as any)}
              onTimeUpdate={handleTimeUpdate}
              onDurationChange={handleDurationChange}
              crossOrigin="anonymous"
              preload="auto"
              playsInline
              muted={isMuted}
              autoPlay
              poster=""
            >
              {/* Add source elements for different stream formats */}
              {selectedChannel && (
                <>
                  <source src={selectedChannel.url} type="application/x-mpegURL" />
                  <source src={selectedChannel.url} type="video/mp4" />
                  <source src={selectedChannel.url} type="video/webm" />
                  <source src={selectedChannel.url} type="video/ogg" />
                  <source src={selectedChannel.url} type="application/vnd.apple.mpegurl" />
                </>
              )}
            </video>

            {/* Custom Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              {/* Progress Bar - Only show for non-live content */}
              {duration > 0 && isFinite(duration) && (
                <div className="mb-4">
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-300 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}
              
              {/* Live indicator for live streams */}
              {duration === 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-center gap-2 text-xs text-red-400">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    <span>LIVE</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={togglePlay}
                    disabled={!!videoError}
                    className="text-white hover:bg-white/20"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleMute}
                      disabled={!!videoError}
                      className="text-white hover:bg-white/20"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      disabled={!!videoError}
                      className="w-20"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-sm">
                    {selectedChannel?.name || 'Unknown Channel'}
                    {selectedChannel?.group && <span className="text-gray-300 ml-2">• {selectedChannel.group}</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullscreen}
                    disabled={!!videoError}
                    className="text-white hover:bg-white/20"
                  >
                    <Maximize className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (videoRef.current) {
                        // @ts-ignore
                        if (document.pictureInPictureElement) {
                          // @ts-ignore
                          document.exitPictureInPicture();
                        } else {
                          // @ts-ignore
                          videoRef.current.requestPictureInPicture();
                        }
                      }
                    }}
                    className="text-white hover:bg-white/20"
                    aria-label="Picture in Picture"
                  >
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="14" rx="2" fill="currentColor" opacity="0.2"/>
                      <rect x="13" y="13" width="8" height="6" rx="1" fill="currentColor"/>
                    </svg>
                  </Button>
                </div>

                {selectedChannel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRecord}
                    disabled={isRecording || !!videoError}
                    className="text-white hover:bg-white/20"
                  >
                    {isRecording ? (
                      <span className="flex items-center"><span className="animate-pulse w-2 h-2 bg-red-500 rounded-full mr-2"></span>Recording...</span>
                    ) : (
                      <span className="flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>Record</span>
                    )}
                  </Button>
                )}

                {isRecording && recordingFilename && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleStopRecording}
                    className="text-white hover:bg-red-600 ml-2"
                  >
                    Stop Recording
                  </Button>
                )}
              </div>

              {recordingError && (
                <div className="text-xs text-red-400 mt-2">{recordingError}</div>
              )}
              {recordingFile && (
                <div className="text-xs text-green-400 mt-2">
                  Recording saved: <a href={recordingFile} download className="underline">Download</a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recordings Panel */}
      {showRecordings && (
        <div
          className={`fixed inset-y-0 right-0 w-96 ${themeClasses.sidebar} border-l ${themeClasses.sidebarBorder} z-40 transform transition-transform duration-300`}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recordings</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRecordings(false)}
                className={`${themeClasses.button} ${themeClasses.buttonText}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {recordings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recordings yet</p>
                <p className="text-xs">Schedule recordings from the EPG</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recordings.map((recording) => (
                  <div
                    key={recording.id}
                    className={`p-3 rounded-lg border ${themeClasses.card} ${themeClasses.cardBorder}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{recording.title}</h3>
                        <p className={`text-xs ${themeClasses.muted} truncate`}>{recording.channelName}</p>
                      </div>
                      <Badge
                        variant={
                          recording.status === "completed"
                            ? "default"
                            : recording.status === "recording"
                              ? "destructive"
                              : recording.status === "failed"
                                ? "destructive"
                                : "secondary"
                        }
                        className="ml-2 text-xs"
                      >
                        {recording.status}
                      </Badge>
                    </div>

                    <div className={`text-xs ${themeClasses.muted} mb-2`}>
                      <div className="flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3" />
                        {recording.startTime.toLocaleDateString()}{" "}
                        {recording.startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      {recording.fileSize && <div>Size: {formatFileSize(recording.fileSize)}</div>}
                    </div>

                    {recording.description && (
                      <p className={`text-xs ${themeClasses.muted} mb-2 line-clamp-2`}>{recording.description}</p>
                    )}

                    <div className="flex gap-1">
                      {recording.status === "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => playRecording(recording)}
                          className="flex-1 text-xs"
                        >
                          <PlayCircle className="w-3 h-3 mr-1" />
                          Play
                        </Button>
                      )}
                      {recording.status === "completed" && recording.filePath && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement("a")
                            link.href = recording.filePath!
                            link.download = `${recording.title}.mp4`
                            link.click()
                          }}
                          className="text-xs"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setRecordings((prev) => prev.filter((r) => r.id !== recording.id))
                        }}
                        className="text-xs"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Recording Player */}
      <Suspense fallback={<div>Loading player...</div>}>
        {playingRecording && (
          <RecordingPlayer
            recording={playingRecording}
            isOpen={isRecordingPlayerOpen}
            onClose={() => {
              setIsRecordingPlayerOpen(false)
              setPlayingRecording(null)
            }}
            isDarkMode={isDarkMode}
          />
        )}
      </Suspense>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".m3u,.m3u8" onChange={handleFileUpload} className="hidden" />
    </div>
  )
}

// Client-side only wrapper to prevent hydration issues
export default function IPTVPlayerWrapper() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center animate-pulse">
            <Tv className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Fr33 TV</h1>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return <IPTVPlayer />
}
