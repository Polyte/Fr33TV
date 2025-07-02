"use client"

import { useRef } from "react"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
  return new Promise((resolve) => {
    // Use Web Worker if available for large playlists
    if (content.length > 100000 && typeof Worker !== "undefined") {
      const worker = new Worker(
        URL.createObjectURL(
          new Blob(
            [
              `
          self.onmessage = function(e) {
            const { content } = e.data;
            const lines = content.split('\n').map(line => line.trim()).filter(line => line);
            const channels = [];
            const categorySet = new Set();
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].startsWith('#EXTINF:')) {
                const extinf = lines[i];
                const url = lines[i + 1];
                
                if (url && !url.startsWith('#')) {
                  const nameMatch = extinf.match(/,(.+)$/);
                  const name = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';
                  
                  const groupMatch = extinf.match(/group-title="([^"]+)"/i);
                  const group = groupMatch ? groupMatch[1] : 'Uncategorized';
                  
                  const logoMatch = extinf.match(/tvg-logo="([^"]+)"/i);
                  const logo = logoMatch ? logoMatch[1] : undefined;
                  
                  channels.push({ name, url, group, logo });
                  categorySet.add(group);
                  
                  if (channels.length % 100 === 0) {
                    self.postMessage({ type: 'progress', progress: (i / lines.length) * 100 });
                  }
                }
              }
            }
            
            self.postMessage({ 
              type: 'complete', 
              channels, 
              categories: Array.from(categorySet).sort() 
            });
          };
        `,
            ],
            { type: "application/javascript" },
          ),
        ),
      )

      worker.onmessage = (e) => {
        const { type, channels, progress } = e.data
        if (type === "progress" && onProgress) {
          onProgress(progress)
        } else if (type === "complete") {
          worker.terminate()
          resolve(channels)
        }
      }

      worker.postMessage({ content })
    } else {
      // Fallback to main thread parsing
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line)
      const channels: Channel[] = []
      let processed = 0

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

            processed++
            if (onProgress && processed % 100 === 0) {
              onProgress((processed / (lines.length / 2)) * 100)
            }
          }
        }
      }

      if (onProgress) onProgress(100)
      resolve(channels)
    }
  })
}

// Dummy parseXMLTV function (replace with actual implementation)
const parseXMLTV = (xml: string): EPGData => {
  return { channels: [], programs: [] }
}

// Video source validation
const validateVideoSource = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: "HEAD" })
    return response.ok
  } catch {
    return false
  }
}

export default function IPTVPlayer() {
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
  const [epgDate, setEpgDate] = useState(new Date())
  const [isAddEPGOpen, setIsAddEPGOpen] = useState(false)
  const [epgUrl, setEpgUrl] = useState("")
  const [selectedProgram, setSelectedProgram] = useState<EPGProgram | null>(null)

  // Recording state
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [showRecordings, setShowRecordings] = useState(false)
  const [recordingConflicts, setRecordingConflicts] = useState<RecordingConflict[]>([])
  const [playingRecording, setPlayingRecording] = useState<Recording | null>(null)
  const [isRecordingPlayerOpen, setIsRecordingPlayerOpen] = useState(false)

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
        // Load theme preference
        const savedTheme = getCached("iptv-theme") || localStorage.getItem("iptv-theme")
        if (savedTheme === "dark") {
          setIsDarkMode(true)
        }

        // Load saved playlists with caching
        const cachedPlaylists = getCached("iptv-playlists")
        if (cachedPlaylists) {
          setPlaylists(cachedPlaylists)
        } else {
          const savedPlaylists = localStorage.getItem("iptv-playlists")
          if (savedPlaylists) {
            const parsedPlaylists = JSON.parse(savedPlaylists)
            setPlaylists(parsedPlaylists)
            setCached("iptv-playlists", parsedPlaylists)
          }
        }

        // Load saved recordings
        const savedRecordings = localStorage.getItem("iptv-recordings")
        if (savedRecordings) {
          const parsedRecordings = JSON.parse(savedRecordings).map((r: any) => ({
            ...r,
            startTime: new Date(r.startTime),
            endTime: new Date(r.endTime),
          }))
          setRecordings(parsedRecordings)
        }

        // Simulate initialization with reduced delay
        await new Promise((resolve) => setTimeout(resolve, 1500))

        setIsInitialized(true)

        // Load default playlist if needed
        const hasLoadedDefault = localStorage.getItem("iptv-default-loaded")
        if (!hasLoadedDefault && playlists.length === 0) {
          await loadDefaultPlaylist()
          localStorage.setItem("iptv-default-loaded", "true")
        }
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
    if (isInitialized) {
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

  // Optimized playlist persistence
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("iptv-playlists", JSON.stringify(playlists))
      setCached("iptv-playlists", playlists)
    }
  }, [playlists, isInitialized, setCached])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadStart = () => {
      setIsVideoLoading(true)
      setVideoError(null)
    }

    const handleCanPlay = () => {
      setIsVideoLoading(false)
      setVideoError(null)
    }

    const handleError = (e: Event) => {
      setIsVideoLoading(false)
      const target = e.target as HTMLVideoElement
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

      setVideoError(errorMessage)
      toast({
        title: "Video Error",
        description: errorMessage,
        variant: "destructive",
      })
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handleDurationChange = () => {
      setDuration(video.duration)
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    video.addEventListener("loadstart", handleLoadStart)
    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("error", handleError)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("durationchange", handleDurationChange)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)

    return () => {
      video.removeEventListener("loadstart", handleLoadStart)
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("error", handleError)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("durationchange", handleDurationChange)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
    }
  }, [toast])

  // Optimized add playlist from URL
  const addPlaylistFromUrl = useCallback(async () => {
    if (!playlistName || !playlistUrl) return

    setIsLoadingPlaylist(true)
    setLoadingProgress(0)

    try {
      // Check cache first
      const cacheKey = `playlist-${playlistUrl}`
      const cachedChannels = getCached(cacheKey)

      if (cachedChannels) {
        const newPlaylist: Playlist = {
          id: Date.now().toString(),
          name: playlistName,
          channels: cachedChannels,
        }
        setPlaylists((prev) => [...prev, newPlaylist])
        setPlaylistName("")
        setPlaylistUrl("")
        setIsAddPlaylistOpen(false)
        setIsLoadingPlaylist(false)
        toast({
          title: "Playlist Added",
          description: `${playlistName} has been added successfully.`,
        })
        return
      }

      const response = await fetch(playlistUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const content = await response.text()

      const channels = await parseM3UOptimized(content, (progress) => {
        setLoadingProgress(progress)
      })

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

      toast({
        title: "Playlist Added",
        description: `${playlistName} has been added with ${channels.length} channels.`,
      })
    } catch (error) {
      console.error("Error fetching playlist:", error)
      toast({
        title: "Error Adding Playlist",
        description: error instanceof Error ? error.message : "Failed to fetch playlist. Please check the URL.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingPlaylist(false)
      setLoadingProgress(0)
    }
  }, [playlistName, playlistUrl, getCached, setCached, toast])

  // Optimized add playlist from content
  const addPlaylistFromContent = useCallback(async () => {
    if (!playlistName || !playlistContent) return

    try {
      const channels = await parseM3UOptimized(playlistContent)

      if (channels.length === 0) {
        throw new Error("No valid channels found in playlist content")
      }

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
      setPlaylistContent("")
      setIsAddPlaylistOpen(false)

      toast({
        title: "Playlist Added",
        description: `${playlistName} has been added with ${channels.length} channels.`,
      })
    } catch (error) {
      console.error("Error parsing playlist:", error)
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
      setSelectedChannel(channel)
      setVideoError(null)
      setIsVideoLoading(true)

      if (videoRef.current) {
        try {
          // Validate source before setting
          const isValid = await validateVideoSource(channel.url)
          if (!isValid && isOnline) {
            throw new Error("Channel source is not accessible")
          }

          videoRef.current.src = channel.url
          videoRef.current.load()

          toast({
            title: "Channel Selected",
            description: `Now playing: ${channel.name}`,
          })
        } catch (error) {
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
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className={`absolute w-2 h-2 rounded-full ${
                isDarkMode ? "bg-blue-400" : "bg-yellow-400"
              } animate-float opacity-70`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="flex h-screen">
        {/* Sidebar */}
        <div className={`w-80 ${themeClasses.sidebar} border-r ${themeClasses.sidebarBorder} flex flex-col`}>
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
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search channels..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${themeClasses.input}`}
              />
            </div>
          </div>

          {/* Playlist Selection */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Playlists</Label>
              <Dialog open={isAddPlaylistOpen} onOpenChange={setIsAddPlaylistOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className={`${themeClasses.button} ${themeClasses.buttonText}`}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className={themeClasses.dialog}>
                  <DialogHeader>
                    <DialogTitle>Add Playlist</DialogTitle>
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
              value={selectedPlaylist || ""}
              onChange={(e) => setSelectedPlaylist(e.target.value || null)}
              className={`w-full p-2 rounded border ${themeClasses.input}`}
            >
              <option value="">Select a playlist</option>
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name} ({playlist.channels.length} channels)
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <Label className="text-sm font-medium mb-2 block">Categories</Label>
              <select
                value={selectedCategory || ""}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className={`w-full p-2 rounded border ${themeClasses.input}`}
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
          {/* Video Player */}
          <div className="flex-1 bg-black relative">
            {selectedChannel ? (
              <div className="relative w-full h-full">
                {/* Video Error Display */}
                {videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                    <div className="text-center text-white p-8">
                      <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
                      <h3 className="text-xl font-semibold mb-2">Video Error</h3>
                      <p className="text-gray-300 mb-4">{videoError}</p>
                      <Button
                        onClick={() => {
                          setVideoError(null)
                          if (selectedChannel) {
                            handleChannelSelect(selectedChannel)
                          }
                        }}
                        variant="outline"
                        className="text-white border-white hover:bg-white hover:text-black"
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                )}

                {/* Loading Indicator */}
                {isVideoLoading && !videoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
                      <p>Loading {selectedChannel.name}...</p>
                    </div>
                  </div>
                )}

                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  controls={false}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  crossOrigin="anonymous"
                  preload="metadata"
                />

                {/* Custom Controls Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  {/* Progress Bar */}
                  {duration > 0 && (
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
                        {selectedChannel.name}
                        {selectedChannel.group && <span className="text-gray-300 ml-2">• {selectedChannel.group}</span>}
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
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Tv className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a channel to start watching</p>
                  <p className="text-sm">Choose from the playlist on the left</p>
                  {playlists.length === 0 && (
                    <div className="mt-4">
                      <Button onClick={loadDefaultPlaylist} variant="outline">
                        Load Demo Playlist
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
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
