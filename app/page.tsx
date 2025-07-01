"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
} from "lucide-react"

interface Channel {
  name: string
  url: string
  group?: string
  logo?: string
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

// Dummy parseXMLTV function (replace with actual implementation)
const parseXMLTV = (xml: string): EPGData => {
  // Implement your XMLTV parsing logic here
  // This is just a placeholder
  return { channels: [], programs: [] }
}

export default function IPTVPlayer() {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isAddPlaylistOpen, setIsAddPlaylistOpen] = useState(false)
  const [playlistName, setPlaylistName] = useState("")
  const [playlistUrl, setPlaylistUrl] = useState("")
  const [playlistContent, setPlaylistContent] = useState("")
  const [addMethod, setAddMethod] = useState<"url" | "content">("url")
  const [epgData, setEpgData] = useState<EPGData>({ channels: [], programs: [] })
  const [showEPG, setShow_EPG] = useState(false)
  const [epgDate, setEpgDate] = useState(new Date())
  const [isAddEPGOpen, setIsAddEPGOpen] = useState(false)
  const [epgUrl, setEpgUrl] = useState("")
  const [selectedProgram, setSelectedProgram] = useState<EPGProgram | null>(null)

  const [recordings, setRecordings] = useState<Recording[]>([])
  const [showRecordings, setShowRecordings] = useState(false)
  const [recordingConflicts, setRecordingConflicts] = useState<RecordingConflict[]>([])
  const [isRecordingDialogOpen, setIsRecordingDialogOpen] = useState(false)
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [channelCache, setChannelCache] = useState<Map<string, Channel[]>>(new Map())

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false)
  const [showParticles, setShowParticles] = useState(false)

  // Particle animation configuration
  const particleConfig = {
    count: isDarkMode ? 25 : 20, // More particles for dark mode
    colors: isDarkMode
      ? ["#60A5FA", "#34D399", "#A78BFA", "#F472B6", "#FBBF24"] // Dark mode colors
      : ["#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#F59E0B"], // Light mode colors
    duration: 2000,
    size: { min: 2, max: 6 },
    speed: { min: 0.5, max: 2 },
  }

  // Enhanced toggle theme with particle animation
  const toggleTheme = () => {
    setIsThemeTransitioning(true)
    setShowParticles(true)

    // Add a slight delay to show the transition effect
    setTimeout(() => {
      setIsDarkMode(!isDarkMode)

      // Hide particles after animation completes
      setTimeout(() => {
        setShowParticles(false)
        setIsThemeTransitioning(false)
      }, particleConfig.duration)
    }, 100)
  }

  // Load theme preference from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("iptv-theme")
    if (savedTheme === "dark") {
      setIsDarkMode(true)
    } else {
      setIsDarkMode(false) // Default to light theme
    }
  }, [])

  // Save theme preference and apply to document
  useEffect(() => {
    localStorage.setItem("iptv-theme", isDarkMode ? "dark" : "light")
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  // Theme-aware classes with animations
  const themeClasses = {
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
  }

  // Load playlists from localStorage on mount
  useEffect(() => {
    const savedPlaylists = localStorage.getItem("iptv-playlists")
    if (savedPlaylists) {
      setPlaylists(JSON.parse(savedPlaylists))
    }
  }, [])

  // Save playlists to localStorage whenever playlists change
  useEffect(() => {
    localStorage.setItem("iptv-playlists", JSON.stringify(playlists))
  }, [playlists])

  // Parse M3U content
  const parseM3U = (content: string, onProgress?: (progress: number) => void): Channel[] => {
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)

    const channels: Channel[] = []
    const categorySet = new Set<string>()
    let processed = 0

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXTINF:")) {
        const extinf = lines[i]
        const url = lines[i + 1]

        if (url && !url.startsWith("#")) {
          // Extract channel name
          const nameMatch = extinf.match(/,(.+)$/)
          const name = nameMatch ? nameMatch[1].trim() : "Unknown Channel"

          // Extract group
          const groupMatch = extinf.match(/group-title="([^"]+)"/i)
          const group = groupMatch ? groupMatch[1] : "Uncategorized"

          // Extract logo
          const logoMatch = extinf.match(/tvg-logo="([^"]+)"/i)
          const logo = logoMatch ? logoMatch[1] : undefined

          channels.push({ name, url, group, logo })
          categorySet.add(group)

          processed++
          if (onProgress && processed % 100 === 0) {
            onProgress((processed / (lines.length / 2)) * 100)
          }
        }
      }
    }

    // Update categories
    setCategories(Array.from(categorySet).sort())

    if (onProgress) onProgress(100)
    return channels
  }

  // Add playlist from URL
  const addPlaylistFromUrl = async () => {
    if (!playlistName || !playlistUrl) return

    setIsLoadingPlaylist(true)
    setLoadingProgress(0)

    try {
      // Check cache first
      const cacheKey = `${playlistName}-${playlistUrl}`
      if (channelCache.has(cacheKey)) {
        const cachedChannels = channelCache.get(cacheKey)!
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
        return
      }

      const response = await fetch(playlistUrl)
      const content = await response.text()

      const channels = parseM3U(content, (progress) => {
        setLoadingProgress(progress)
      })

      // Cache the channels
      setChannelCache((prev) => new Map(prev).set(cacheKey, channels))

      const newPlaylist: Playlist = {
        id: Date.now().toString(),
        name: playlistName,
        channels,
      }

      setPlaylists((prev) => [...prev, newPlaylist])
      setPlaylistName("")
      setPlaylistUrl("")
      setIsAddPlaylistOpen(false)
    } catch (error) {
      console.error("Error fetching playlist:", error)
      alert("Error fetching playlist. Please check the URL.")
    } finally {
      setIsLoadingPlaylist(false)
      setLoadingProgress(0)
    }
  }

  // Add playlist from content
  const addPlaylistFromContent = () => {
    if (!playlistName || !playlistContent) return

    const channels = parseM3U(playlistContent)

    const newPlaylist: Playlist = {
      id: Date.now().toString(),
      name: playlistName,
      channels,
    }

    setPlaylists((prev) => [...prev, newPlaylist])
    setPlaylistName("")
    setPlaylistContent("")
    setIsAddPlaylistOpen(false)
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setPlaylistContent(content)
        setAddMethod("content")
      }
      reader.readAsText(file)
    }
  }

  // Add EPG from URL
  const addEPGFromUrl = async () => {
    if (!epgUrl) return

    try {
      const response = await fetch(epgUrl)
      const content = await response.text()
      const parsedEPG = parseXMLTV(content)

      setEpgData(parsedEPG)
      setEpgUrl("")
      setIsAddEPGOpen(false)
    } catch (error) {
      console.error("Error fetching EPG:", error)
      alert("Error fetching EPG. Please check the URL.")
    }
  }

  // Get current program for a channel
  const getCurrentProgram = (channelName: string): EPGProgram | null => {
    const now = new Date()
    const epgChannel = epgData.channels.find(
      (ch) =>
        ch.displayName.toLowerCase().includes(channelName.toLowerCase()) ||
        channelName.toLowerCase().includes(ch.displayName.toLowerCase()),
    )

    if (!epgChannel) return null

    return (
      epgData.programs.find(
        (program) => program.channelId === epgChannel.id && program.start <= now && program.end > now,
      ) || null
    )
  }

  // Get next program for a channel
  const getNextProgram = (channelName: string): EPGProgram | null => {
    const now = new Date()
    const epgChannel = epgData.channels.find(
      (ch) =>
        ch.displayName.toLowerCase().includes(channelName.toLowerCase()) ||
        channelName.toLowerCase().includes(ch.displayName.toLowerCase()),
    )

    if (!epgChannel) return null

    return (
      epgData.programs
        .filter((program) => program.channelId === epgChannel.id && program.start > now)
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0] || null
    )
  }

  // Get programs for EPG grid
  const getEPGPrograms = (date: Date) => {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    return epgData.programs.filter((program) => program.start >= startOfDay && program.start <= endOfDay)
  }

  // Format time for EPG
  const formatEPGTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Remove playlist
  const removePlaylist = (playlistId: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId))
    if (selectedPlaylist === playlistId) {
      setSelectedPlaylist(null)
      setSelectedChannel(null)
    }
  }

  // Get filtered channels
  const getFilteredChannels = () => {
    if (!selectedPlaylist) return []

    const playlist = playlists.find((p) => p.id === selectedPlaylist)
    if (!playlist) return []

    let filteredChannels = playlist.channels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (channel.group && channel.group.toLowerCase().includes(searchTerm.toLowerCase())),
    )

    // Filter by category if selected
    if (selectedCategory) {
      filteredChannels = filteredChannels.filter((channel) => channel.group === selectedCategory)
    }

    return filteredChannels
  }

  // Play channel
  const playChannel = (channel: Channel) => {
    setSelectedChannel(channel)
    if (videoRef.current) {
      videoRef.current.src = channel.url
      videoRef.current.load()
    }
  }

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = Number.parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        videoRef.current.requestFullscreen()
      }
    }
  }

  // Load recordings from localStorage
  useEffect(() => {
    const savedRecordings = localStorage.getItem("iptv-recordings")
    if (savedRecordings) {
      const parsedRecordings = JSON.parse(savedRecordings).map((r: any) => ({
        ...r,
        startTime: new Date(r.startTime),
        endTime: new Date(r.endTime),
      }))
      setRecordings(parsedRecordings)
    }
  }, [])

  // Save recordings to localStorage
  useEffect(() => {
    localStorage.setItem("iptv-recordings", JSON.stringify(recordings))
    checkRecordingConflicts()
  }, [recordings])

  // Check for recording conflicts
  const checkRecordingConflicts = () => {
    const conflicts: RecordingConflict[] = []
    const activeRecordings = recordings.filter((r) => r.status === "scheduled" || r.status === "recording")

    for (let i = 0; i < activeRecordings.length; i++) {
      for (let j = i + 1; j < activeRecordings.length; j++) {
        const r1 = activeRecordings[i]
        const r2 = activeRecordings[j]

        // Check for time overlap
        const overlapStart = new Date(Math.max(r1.startTime.getTime(), r2.startTime.getTime()))
        const overlapEnd = new Date(Math.min(r1.endTime.getTime(), r2.endTime.getTime()))

        if (overlapStart < overlapEnd) {
          conflicts.push({
            recording1: r1,
            recording2: r2,
            overlapStart,
            overlapEnd,
          })
        }
      }
    }

    setRecordingConflicts(conflicts)
  }

  // Schedule a recording
  const scheduleRecording = (program: EPGProgram) => {
    const channel = getFilteredChannels().find((ch) => {
      const epgChannel = epgData.channels.find((ec) => ec.id === program.channelId)
      return (
        epgChannel &&
        (ch.name.toLowerCase().includes(epgChannel.displayName.toLowerCase()) ||
          epgChannel.displayName.toLowerCase().includes(ch.name.toLowerCase()))
      )
    })

    if (!channel) {
      alert("Channel not found for recording")
      return
    }

    const newRecording: Recording = {
      id: Date.now().toString(),
      programId: program.id,
      channelName: channel.name,
      channelUrl: channel.url,
      title: program.title,
      description: program.description,
      category: program.category,
      startTime: program.start,
      endTime: program.end,
      status: "scheduled",
    }

    setRecordings((prev) => [...prev, newRecording])
    setSelectedProgram(null)
  }

  // Cancel a recording
  const cancelRecording = (recordingId: string) => {
    setRecordings((prev) => prev.map((r) => (r.id === recordingId ? { ...r, status: "cancelled" as const } : r)))
  }

  // Delete a recording
  const deleteRecording = (recordingId: string) => {
    setRecordings((prev) => prev.filter((r) => r.id !== recordingId))
  }

  // Check if program is already scheduled
  const isProgramScheduled = (programId: string) => {
    return recordings.some((r) => r.programId === programId && (r.status === "scheduled" || r.status === "recording"))
  }

  // Get recording status for a program
  const getRecordingStatus = (programId: string) => {
    const recording = recordings.find((r) => r.programId === programId)
    return recording?.status || null
  }

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown"
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  // Get upcoming recordings
  const getUpcomingRecordings = () => {
    const now = new Date()
    return recordings
      .filter((r) => r.status === "scheduled" && r.startTime > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, 5)
  }

  // Simulate recording process (in a real app, this would handle actual recording)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()

      setRecordings((prev) =>
        prev.map((recording) => {
          // Start scheduled recordings
          if (recording.status === "scheduled" && recording.startTime <= now && recording.endTime > now) {
            return { ...recording, status: "recording" as const }
          }

          // Complete active recordings
          if (recording.status === "recording" && recording.endTime <= now) {
            return {
              ...recording,
              status: "completed" as const,
              filePath: `/recordings/${recording.title.replace(/[^a-zA-Z0-9]/g, "_")}_${recording.id}.mp4`,
              fileSize: Math.floor(Math.random() * 2000000000) + 500000000, // Simulate file size
            }
          }

          return recording
        }),
      )
    }, 10000) // Check every 10 seconds

    return () => clearInterval(interval)
  }, [])

  // Load default IPTV-org playlist
  const loadDefaultPlaylist = async () => {
    const defaultUrl = "https://iptv-org.github.io/iptv/index.m3u"
    const defaultName = "IPTV-org Global"

    // Check if default playlist already exists
    if (playlists.some((p) => p.name === defaultName)) return

    setIsLoadingPlaylist(true)
    setLoadingProgress(0)

    try {
      const response = await fetch(defaultUrl)
      const content = await response.text()

      const channels = parseM3U(content, (progress) => {
        setLoadingProgress(progress)
      })

      const newPlaylist: Playlist = {
        id: `default-${Date.now()}`,
        name: defaultName,
        channels,
      }

      setPlaylists((prev) => [newPlaylist, ...prev])
      setSelectedPlaylist(newPlaylist.id)
    } catch (error) {
      console.error("Error loading default playlist:", error)
    } finally {
      setIsLoadingPlaylist(false)
      setLoadingProgress(0)
    }
  }

  // Load default playlist on first app load
  useEffect(() => {
    const hasLoadedDefault = localStorage.getItem("iptv-default-loaded")
    if (!hasLoadedDefault && playlists.length === 0) {
      loadDefaultPlaylist()
      localStorage.setItem("iptv-default-loaded", "true")
    }
  }, [playlists.length])

  // Get channel count by category
  const getChannelCountByCategory = (category: string) => {
    if (!selectedPlaylist) return 0
    const playlist = playlists.find((p) => p.id === selectedPlaylist)
    if (!playlist) return 0

    return playlist.channels.filter((channel) => channel.group === category).length
  }

  // Particle System Component
  const ParticleSystem = () => {
    const [particles, setParticles] = useState<
      Array<{
        id: number
        x: number
        y: number
        vx: number
        vy: number
        size: number
        color: string
        opacity: number
        life: number
      }>
    >([])

    useEffect(() => {
      if (!showParticles) {
        setParticles([])
        return
      }

      // Generate initial particles
      const newParticles = Array.from({ length: particleConfig.count }, (_, i) => ({
        id: i,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * particleConfig.speed.max,
        vy: (Math.random() - 0.5) * particleConfig.speed.max,
        size: Math.random() * (particleConfig.size.max - particleConfig.size.min) + particleConfig.size.min,
        color: particleConfig.colors[Math.floor(Math.random() * particleConfig.colors.length)],
        opacity: Math.random() * 0.8 + 0.2,
        life: 1,
      }))

      setParticles(newParticles)

      // Animation loop
      const animationInterval = setInterval(() => {
        setParticles((prevParticles) =>
          prevParticles
            .map((particle) => ({
              ...particle,
              x: particle.x + particle.vx,
              y: particle.y + particle.vy,
              life: particle.life - 0.01,
              opacity: particle.opacity * 0.98,
            }))
            .filter((particle) => particle.life > 0),
        )
      }, 16) // ~60fps

      return () => clearInterval(animationInterval)
    }, [showParticles, isDarkMode])

    if (!showParticles || particles.length === 0) return null

    return (
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full animate-pulse"
            style={{
              left: `${particle.x}px`,
              top: `${particle.y}px`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particle.color,
              opacity: particle.opacity,
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}40`,
              transform: `scale(${particle.life})`,
              transition: "transform 0.1s ease-out",
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${themeClasses.background} ${themeClasses.text} transition-colors duration-200`}>
      <ParticleSystem />
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className={`w-80 ${themeClasses.sidebar} border-r ${themeClasses.sidebarBorder} flex flex-col shadow-lg`}>
          {/* Header */}
          <div className={`p-4 border-b ${themeClasses.sidebarBorder}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tv className="w-6 h-6 text-blue-500" />
                <h1 className="text-xl font-bold">IPTV Player</h1>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className={`${themeClasses.hover} p-2 relative overflow-hidden group theme-button-enhanced ${
                  isThemeTransitioning ? "animate-pulse transitioning starburst" : ""
                }`}
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                disabled={isThemeTransitioning}
              >
                <div className="relative z-10 transition-transform duration-300 ease-in-out group-hover:scale-110">
                  {isDarkMode ? (
                    <Sun
                      className={`w-4 h-4 transition-all duration-300 ease-in-out ${
                        isThemeTransitioning ? "rotate-180 scale-0" : "rotate-0 scale-100"
                      }`}
                    />
                  ) : (
                    <Moon
                      className={`w-4 h-4 transition-all duration-300 ease-in-out ${
                        isThemeTransitioning ? "rotate-180 scale-0" : "rotate-0 scale-100"
                      }`}
                    />
                  )}
                </div>
                {/* Enhanced animated background effect */}
                <div
                  className={`absolute inset-0 rounded-md transition-all duration-300 ease-in-out ${
                    isThemeTransitioning
                      ? "bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 scale-110 animate-pulse-glow"
                      : "scale-0"
                  }`}
                />
                {/* Sparkle effects */}
                {isThemeTransitioning && (
                  <>
                    <div
                      className="sparkle absolute top-1 right-1 animate-sparkle"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <div
                      className="sparkle absolute bottom-1 left-1 animate-sparkle"
                      style={{ animationDelay: "0.3s" }}
                    />
                    <div className="sparkle absolute top-1 left-1 animate-sparkle" style={{ animationDelay: "0.5s" }} />
                    <div
                      className="sparkle absolute bottom-1 right-1 animate-sparkle"
                      style={{ animationDelay: "0.7s" }}
                    />
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Dialog open={isAddPlaylistOpen} onOpenChange={setIsAddPlaylistOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Playlist
                  </Button>
                </DialogTrigger>
                <DialogContent className={`${themeClasses.dialog} shadow-xl`}>
                  <DialogHeader>
                    <DialogTitle>Add M3U Playlist</DialogTitle>
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
                        disabled={isLoadingPlaylist}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant={addMethod === "url" ? "default" : "outline"}
                        onClick={() => setAddMethod("url")}
                        size="sm"
                        disabled={isLoadingPlaylist}
                      >
                        URL
                      </Button>
                      <Button
                        variant={addMethod === "content" ? "default" : "outline"}
                        onClick={() => setAddMethod("content")}
                        size="sm"
                        disabled={isLoadingPlaylist}
                      >
                        Content
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        size="sm"
                        disabled={isLoadingPlaylist}
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        File
                      </Button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".m3u,.m3u8"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isLoadingPlaylist}
                    />

                    {addMethod === "url" ? (
                      <div>
                        <Label htmlFor="playlist-url">M3U URL</Label>
                        <Input
                          id="playlist-url"
                          value={playlistUrl}
                          onChange={(e) => setPlaylistUrl(e.target.value)}
                          placeholder="https://example.com/playlist.m3u"
                          className={themeClasses.input}
                          disabled={isLoadingPlaylist}
                        />
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPlaylistUrl("https://iptv-org.github.io/iptv/index.m3u")
                              setPlaylistName("IPTV-org Global")
                            }}
                            disabled={isLoadingPlaylist}
                            className="text-xs"
                          >
                            Use Default IPTV-org Playlist
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="playlist-content">M3U Content</Label>
                        <Textarea
                          id="playlist-content"
                          value={playlistContent}
                          onChange={(e) => setPlaylistContent(e.target.value)}
                          placeholder="Paste M3U content here..."
                          className={`${themeClasses.input} h-32`}
                          disabled={isLoadingPlaylist}
                        />
                      </div>
                    )}

                    {isLoadingPlaylist && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Loading playlist...</span>
                          <span>{Math.round(loadingProgress)}%</span>
                        </div>
                        <div
                          className={`w-full ${isDarkMode ? "bg-gray-700" : "bg-gray-200"} rounded-full h-2 overflow-hidden transition-colors duration-300`}
                        >
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                            style={{ width: `${loadingProgress}%` }}
                          >
                            {/* Animated shimmer effect */}
                            <div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                              style={{
                                backgroundSize: "200% 100%",
                                animation: "shimmer 1.5s infinite linear",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={addMethod === "url" ? addPlaylistFromUrl : addPlaylistFromContent}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={
                        isLoadingPlaylist || !playlistName || (addMethod === "url" ? !playlistUrl : !playlistContent)
                      }
                    >
                      {isLoadingPlaylist ? "Loading..." : "Add Playlist"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddEPGOpen} onOpenChange={setIsAddEPGOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className={`w-full ${themeClasses.button} ${themeClasses.buttonText}`}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add EPG
                  </Button>
                </DialogTrigger>
                <DialogContent className={`${themeClasses.dialog} shadow-xl`}>
                  <DialogHeader>
                    <DialogTitle>Add XMLTV EPG</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="epg-url">XMLTV URL</Label>
                      <Input
                        id="epg-url"
                        value={epgUrl}
                        onChange={(e) => setEpgUrl(e.target.value)}
                        placeholder="https://example.com/epg.xml"
                        className={themeClasses.input}
                      />
                    </div>
                    <Button
                      onClick={addEPGFromUrl}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={!epgUrl}
                    >
                      Load EPG Data
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                className={`w-full ${themeClasses.button} ${themeClasses.buttonText}`}
                onClick={() => setShow_EPG(!showEPG)}
                disabled={epgData.programs.length === 0}
              >
                <List className="w-4 h-4 mr-2" />
                {showEPG ? "Hide EPG" : "Show EPG"}
              </Button>

              <Button
                variant="outline"
                className={`w-full ${themeClasses.button} ${themeClasses.buttonText}`}
                onClick={() => setShowRecordings(!showRecordings)}
              >
                <List className="w-4 h-4 mr-2" />
                Recordings ({recordings.filter((r) => r.status !== "cancelled").length})
              </Button>
            </div>
          </div>

          {/* Playlists */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4">
              <h2 className={`text-sm font-semibold ${themeClasses.muted} mb-2`}>PLAYLISTS</h2>
              <div className="space-y-2">
                {playlists.map((playlist, index) => (
                  <div
                    key={playlist.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-[1.02] ${
                      selectedPlaylist === playlist.id
                        ? themeClasses.selected + " text-white shadow-lg"
                        : themeClasses.hover
                    }`}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animation: isThemeTransitioning ? "fadeInUp 0.3s ease-out forwards" : "none",
                    }}
                    onClick={() => setSelectedPlaylist(playlist.id)}
                  >
                    <div className="flex items-center gap-2">
                      <List className="w-4 h-4" />
                      <span className="text-sm">{playlist.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {playlist.channels.length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removePlaylist(playlist.id)
                      }}
                      className="h-6 w-6 p-0 hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {selectedPlaylist && (
              <>
                <Separator className={themeClasses.separator} />
                <div className="p-4">
                  {/* Category Filter */}
                  {categories.length > 0 && (
                    <div className="mb-3">
                      <ScrollArea className="w-full">
                        <div className="flex gap-2 pb-2">
                          <Button
                            variant={selectedCategory === null ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedCategory(null)}
                            className="whitespace-nowrap"
                          >
                            All ({getFilteredChannels().length})
                          </Button>
                          {categories.slice(0, 10).map((category) => (
                            <Button
                              key={category}
                              variant={selectedCategory === category ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedCategory(category)}
                              className="whitespace-nowrap"
                            >
                              {category} ({getChannelCountByCategory(category)})
                            </Button>
                          ))}
                          {categories.length > 10 && (
                            <Button variant="outline" size="sm" disabled>
                              +{categories.length - 10} more
                            </Button>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="relative mb-3">
                    <Search
                      className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${themeClasses.muted}`}
                    />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search channels..."
                      className={`pl-10 ${themeClasses.input}`}
                    />
                  </div>

                  {selectedCategory && (
                    <div className="mb-2">
                      <Badge variant="secondary" className="text-xs">
                        Category: {selectedCategory}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCategory(null)}
                        className="ml-2 h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  <div className="px-4 pb-4 space-y-1">
                    {getFilteredChannels().length === 0 ? (
                      <div className={`text-center ${themeClasses.muted} py-8`}>
                        <div className="text-sm">No channels found</div>
                        <div className="text-xs">Try adjusting your search or category filter</div>
                      </div>
                    ) : (
                      getFilteredChannels().map((channel, index) => {
                        const currentProgram = getCurrentProgram(channel.name)
                        const nextProgram = getNextProgram(channel.name)

                        return (
                          <div
                            key={`${channel.url}-${index}`}
                            className={`p-2 rounded cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-[1.01] hover:shadow-md ${
                              selectedChannel?.url === channel.url
                                ? themeClasses.selected + " text-white shadow-lg scale-[1.01]"
                                : themeClasses.hover
                            }`}
                            style={{
                              animationDelay: `${index * 30}ms`,
                              animation: isThemeTransitioning ? "slideInLeft 0.4s ease-out forwards" : "none",
                            }}
                            onClick={() => playChannel(channel)}
                          >
                            <div className="flex items-center gap-2">
                              {channel.logo && (
                                <img
                                  src={channel.logo || "/placeholder.svg"}
                                  alt={channel.name}
                                  className="w-8 h-8 rounded object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = "none"
                                  }}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{channel.name}</div>
                                {channel.group && (
                                  <div className={`text-xs ${themeClasses.muted} truncate`}>{channel.group}</div>
                                )}
                                {currentProgram && (
                                  <div className={`text-xs ${themeClasses.success} truncate`}>
                                    Now: {currentProgram.title}
                                  </div>
                                )}
                                {nextProgram && (
                                  <div className={`text-xs ${themeClasses.accent} truncate`}>
                                    Next: {formatEPGTime(nextProgram.start)} - {nextProgram.title}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Video Player */}
          <div className="flex-1 bg-black relative">
            {selectedChannel ? (
              <div className="w-full h-full relative">
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onLoadStart={() => setIsPlaying(false)}
                  crossOrigin="anonymous"
                />

                {/* Video Controls Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={togglePlay} className="text-white hover:bg-white/20">
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={toggleMute} className="text-white hover:bg-white/20">
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={handleVolumeChange}
                        className="w-20"
                      />
                    </div>

                    <div className="flex-1" />

                    <div className="text-white text-sm">{selectedChannel.name}</div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleFullscreen}
                      className="text-white hover:bg-white/20"
                    >
                      <Maximize className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className={`text-center ${themeClasses.muted}`}>
                  <Tv className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No Channel Selected</h2>
                  <p>Add a playlist and select a channel to start watching</p>
                </div>
              </div>
            )}
          </div>

          {/* EPG Grid */}
          {showEPG && (
            <div className={`${themeClasses.card} border-t ${themeClasses.cardBorder} h-80 flex flex-col shadow-lg`}>
              <div className={`p-4 border-b ${themeClasses.cardBorder}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Electronic Program Guide</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newDate = new Date(epgDate)
                        newDate.setDate(newDate.getDate() - 1)
                        setEpgDate(newDate)
                      }}
                    >
                      ←
                    </Button>
                    <span className="text-sm px-3">{epgDate.toLocaleDateString()}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newDate = new Date(epgDate)
                        newDate.setDate(newDate.getDate() + 1)
                        setEpgDate(newDate)
                      }}
                    >
                      →
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEpgDate(new Date())}>
                      Today
                    </Button>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4">
                  {selectedPlaylist &&
                    (() => {
                      const playlist = playlists.find((p) => p.id === selectedPlaylist)
                      const dayPrograms = getEPGPrograms(epgDate)

                      return (
                        <div className="space-y-4">
                          {playlist?.channels.slice(0, 10).map((channel, channelIndex) => {
                            const channelPrograms = dayPrograms
                              .filter((program) => {
                                const epgChannel = epgData.channels.find(
                                  (ch) =>
                                    ch.displayName.toLowerCase().includes(channel.name.toLowerCase()) ||
                                    channel.name.toLowerCase().includes(ch.displayName.toLowerCase()),
                                )
                                return epgChannel && program.channelId === epgChannel.id
                              })
                              .sort((a, b) => a.start.getTime() - b.start.getTime())

                            return (
                              <div key={channelIndex} className={`border ${themeClasses.cardBorder} rounded`}>
                                <div className={`${themeClasses.button} p-2 font-medium text-sm`}>{channel.name}</div>
                                <div className="p-2">
                                  {channelPrograms.length > 0 ? (
                                    <div className="space-y-1">
                                      {channelPrograms.slice(0, 6).map((program) => (
                                        <div
                                          key={program.id}
                                          className={`flex items-center justify-between p-2 ${themeClasses.button} rounded cursor-pointer ${themeClasses.hover}`}
                                          onClick={() => setSelectedProgram(program)}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{program.title}</div>
                                            {program.category && (
                                              <div className={`text-xs ${themeClasses.muted}`}>{program.category}</div>
                                            )}
                                          </div>
                                          <div className={`text-xs ${themeClasses.muted} ml-2`}>
                                            {formatEPGTime(program.start)} - {formatEPGTime(program.end)}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className={`text-sm ${themeClasses.muted} italic`}>
                                      No program data available
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Recordings Panel */}
          {showRecordings && (
            <div className={`${themeClasses.card} border-t ${themeClasses.cardBorder} h-80 flex flex-col shadow-lg`}>
              <div className={`p-4 border-b ${themeClasses.cardBorder}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Recordings Manager</h3>
                  <div className="flex items-center gap-2">
                    {recordingConflicts.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {recordingConflicts.length} Conflicts
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {recordings.filter((r) => r.status === "scheduled").length} Scheduled
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {recordings.filter((r) => r.status === "recording").length} Recording
                    </Badge>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4">
                  {/* Recording Conflicts */}
                  {recordingConflicts.length > 0 && (
                    <div className="mb-6">
                      <h4 className={`text-sm font-medium ${themeClasses.error} mb-2`}>Recording Conflicts</h4>
                      <div className="space-y-2">
                        {recordingConflicts.map((conflict, index) => (
                          <div
                            key={index}
                            className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-600 rounded p-3"
                          >
                            <div className={`text-sm font-medium ${themeClasses.error} mb-1`}>Conflict Detected</div>
                            <div className={`text-xs ${themeClasses.error} space-y-1 opacity-80`}>
                              <div>
                                • {conflict.recording1.title} ({conflict.recording1.channelName})
                              </div>
                              <div>
                                • {conflict.recording2.title} ({conflict.recording2.channelName})
                              </div>
                              <div className={themeClasses.error}>
                                Overlap: {formatEPGTime(conflict.overlapStart)} - {formatEPGTime(conflict.overlapEnd)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming Recordings */}
                  {getUpcomingRecordings().length > 0 && (
                    <div className="mb-6">
                      <h4 className={`text-sm font-medium ${themeClasses.accent} mb-2`}>Upcoming Recordings</h4>
                      <div className="space-y-2">
                        {getUpcomingRecordings().map((recording) => (
                          <div
                            key={recording.id}
                            className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-600 rounded p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{recording.title}</div>
                                <div className={`text-xs ${themeClasses.muted}`}>{recording.channelName}</div>
                                <div className={`text-xs ${themeClasses.accent}`}>
                                  {formatEPGTime(recording.startTime)} - {formatEPGTime(recording.endTime)}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelRecording(recording.id)}
                                className={`${themeClasses.error} hover:bg-red-100 dark:hover:bg-red-900/50`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All Recordings */}
                  <div>
                    <h4 className={`text-sm font-medium ${themeClasses.muted} mb-2`}>All Recordings</h4>
                    <div className="space-y-2">
                      {recordings.length === 0 ? (
                        <div className={`text-center ${themeClasses.muted} py-8`}>
                          <div className="text-sm">No recordings scheduled</div>
                          <div className="text-xs">Schedule recordings from the EPG</div>
                        </div>
                      ) : (
                        recordings
                          .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
                          .map((recording) => (
                            <div
                              key={recording.id}
                              className={`border ${themeClasses.cardBorder} rounded p-3 cursor-pointer ${themeClasses.hover} ${
                                recording.status === "recording"
                                  ? "border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/20"
                                  : recording.status === "completed"
                                    ? "border-green-300 dark:border-green-500 bg-green-50 dark:bg-green-900/20"
                                    : recording.status === "cancelled"
                                      ? `border-gray-300 dark:border-gray-500 ${isDarkMode ? "bg-gray-900/20" : "bg-gray-50"}`
                                      : themeClasses.cardBorder
                              }`}
                              onClick={() => setSelectedRecording(recording)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="text-sm font-medium truncate">{recording.title}</div>
                                    <Badge
                                      variant={
                                        recording.status === "recording"
                                          ? "destructive"
                                          : recording.status === "completed"
                                            ? "default"
                                            : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {recording.status}
                                    </Badge>
                                  </div>
                                  <div className={`text-xs ${themeClasses.muted}`}>{recording.channelName}</div>
                                  <div className={`text-xs ${themeClasses.muted}`}>
                                    {recording.startTime.toLocaleDateString()} {formatEPGTime(recording.startTime)} -{" "}
                                    {formatEPGTime(recording.endTime)}
                                  </div>
                                  {recording.fileSize && (
                                    <div className={`text-xs ${themeClasses.muted}`}>
                                      Size: {formatFileSize(recording.fileSize)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  {recording.status === "scheduled" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        cancelRecording(recording.id)
                                      }}
                                      className={`${themeClasses.error} hover:bg-red-100 dark:hover:bg-red-900/50`}
                                    >
                                      Cancel
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteRecording(recording.id)
                                    }}
                                    className={`${themeClasses.muted} hover:bg-gray-100 dark:hover:bg-gray-700`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Channel Info */}
          {selectedChannel && (
            <div className={`${themeClasses.card} border-t ${themeClasses.cardBorder} p-4 shadow-lg`}>
              <div className="flex items-center gap-4">
                {selectedChannel.logo && (
                  <img
                    src={selectedChannel.logo || "/placeholder.svg"}
                    alt={selectedChannel.name}
                    className="w-12 h-12 rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                )}
                <div className="flex-1">
                  <h3 className="font-semibold">{selectedChannel.name}</h3>
                  {selectedChannel.group && <p className={`text-sm ${themeClasses.muted}`}>{selectedChannel.group}</p>}

                  {(() => {
                    const currentProgram = getCurrentProgram(selectedChannel.name)
                    const nextProgram = getNextProgram(selectedChannel.name)

                    return (
                      <div className="mt-2 space-y-1">
                        {currentProgram && (
                          <div className="text-sm">
                            <span className={`${themeClasses.success} font-medium`}>Now Playing: </span>
                            <span>{currentProgram.title}</span>
                            <span className={`${themeClasses.muted} ml-2`}>
                              {formatEPGTime(currentProgram.start)} - {formatEPGTime(currentProgram.end)}
                            </span>
                          </div>
                        )}
                        {nextProgram && (
                          <div className="text-sm">
                            <span className={`${themeClasses.accent} font-medium`}>Up Next: </span>
                            <span>{nextProgram.title}</span>
                            <span className={`${themeClasses.muted} ml-2`}>{formatEPGTime(nextProgram.start)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Program Details Dialog */}
      {selectedProgram && (
        <Dialog open={!!selectedProgram} onOpenChange={() => setSelectedProgram(null)}>
          <DialogContent className={`${themeClasses.dialog} shadow-xl`}>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                {selectedProgram.title}
                {getRecordingStatus(selectedProgram.id) && (
                  <Badge
                    variant={getRecordingStatus(selectedProgram.id) === "recording" ? "destructive" : "secondary"}
                    className="ml-2"
                  >
                    {getRecordingStatus(selectedProgram.id)}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className={`flex items-center gap-2 text-sm ${themeClasses.muted}`}>
                <span>
                  {formatEPGTime(selectedProgram.start)} - {formatEPGTime(selectedProgram.end)}
                </span>
                {selectedProgram.category && (
                  <>
                    <span>•</span>
                    <Badge variant="secondary">{selectedProgram.category}</Badge>
                  </>
                )}
              </div>
              {selectedProgram.description && (
                <p className={`text-sm ${themeClasses.text}`}>{selectedProgram.description}</p>
              )}

              {/* Recording Conflicts Warning */}
              {recordingConflicts.some(
                (conflict) =>
                  conflict.recording1.programId === selectedProgram.id ||
                  conflict.recording2.programId === selectedProgram.id,
              ) && (
                <div className="bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-600 rounded p-3">
                  <div className={`${themeClasses.warning} text-sm font-medium mb-1`}>Recording Conflict</div>
                  <div className={`${themeClasses.warning} text-xs opacity-80`}>
                    This recording conflicts with another scheduled recording.
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const channel = getFilteredChannels().find((ch) => {
                      const epgChannel = epgData.channels.find((ec) => ec.id === selectedProgram.channelId)
                      return (
                        epgChannel &&
                        (ch.name.toLowerCase().includes(epgChannel.displayName.toLowerCase()) ||
                          epgChannel.displayName.toLowerCase().includes(ch.name.toLowerCase()))
                      )
                    })
                    if (channel) {
                      playChannel(channel)
                      setSelectedProgram(null)
                    }
                  }}
                  disabled={
                    !getFilteredChannels().some((ch) => {
                      const epgChannel = epgData.channels.find((ec) => ec.id === selectedProgram.channelId)
                      return (
                        epgChannel &&
                        (ch.name.toLowerCase().includes(epgChannel.displayName.toLowerCase()) ||
                          epgChannel.displayName.toLowerCase().includes(ch.name.toLowerCase()))
                      )
                    })
                  }
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Watch Channel
                </Button>

                {!isProgramScheduled(selectedProgram.id) ? (
                  <Button
                    variant="outline"
                    onClick={() => scheduleRecording(selectedProgram)}
                    disabled={selectedProgram.end <= new Date()}
                  >
                    Schedule Recording
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const recording = recordings.find((r) => r.programId === selectedProgram.id)
                      if (recording && recording.status === "scheduled") {
                        cancelRecording(recording.id)
                      }
                    }}
                  >
                    Cancel Recording
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Recording Details Dialog */}
      {selectedRecording && (
        <Dialog open={!!selectedRecording} onOpenChange={() => setSelectedRecording(null)}>
          <DialogContent className={`${themeClasses.dialog} shadow-xl`}>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                {selectedRecording.title}
                <Badge
                  variant={
                    selectedRecording.status === "recording"
                      ? "destructive"
                      : selectedRecording.status === "completed"
                        ? "default"
                        : "secondary"
                  }
                >
                  {selectedRecording.status}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className={`${themeClasses.muted}`}>Channel</div>
                  <div>{selectedRecording.channelName}</div>
                </div>
                <div>
                  <div className={`${themeClasses.muted}`}>Category</div>
                  <div>{selectedRecording.category || "Unknown"}</div>
                </div>
                <div>
                  <div className={`${themeClasses.muted}`}>Start Time</div>
                  <div>{selectedRecording.startTime.toLocaleString()}</div>
                </div>
                <div>
                  <div className={`${themeClasses.muted}`}>End Time</div>
                  <div>{selectedRecording.endTime.toLocaleString()}</div>
                </div>
                {selectedRecording.fileSize && (
                  <div>
                    <div className={`${themeClasses.muted}`}>File Size</div>
                    <div>{formatFileSize(selectedRecording.fileSize)}</div>
                  </div>
                )}
                {selectedRecording.filePath && (
                  <div>
                    <div className={`${themeClasses.muted}`}>File Path</div>
                    <div className={`text-xs font-mono ${themeClasses.muted}`}>{selectedRecording.filePath}</div>
                  </div>
                )}
              </div>

              {selectedRecording.description && (
                <div>
                  <div className={`${themeClasses.muted} text-sm mb-1`}>Description</div>
                  <p className={`text-sm ${themeClasses.text}`}>{selectedRecording.description}</p>
                </div>
              )}

              <div className="flex gap-2">
                {selectedRecording.status === "completed" && (
                  <Button disabled className="bg-blue-500 text-white opacity-50">
                    Play Recording
                  </Button>
                )}
                {selectedRecording.status === "scheduled" && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      cancelRecording(selectedRecording.id)
                      setSelectedRecording(null)
                    }}
                  >
                    Cancel Recording
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    deleteRecording(selectedRecording.id)
                    setSelectedRecording(null)
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
