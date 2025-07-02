"use client"

import { useState, useRef, useEffect, memo, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  RotateCcw,
  Settings,
  X,
  Download,
  Share2,
} from "lucide-react"

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

interface RecordingPlayerProps {
  recording: Recording
  isOpen: boolean
  onClose: () => void
  isDarkMode?: boolean
}

export const RecordingPlayer = memo(function RecordingPlayer({
  recording,
  isOpen,
  onClose,
  isDarkMode = false,
}: RecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [buffered, setBuffered] = useState(0)

  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

  // Memoized theme classes
  const themeClasses = useMemo(
    () => ({
      background: isDarkMode ? "bg-black" : "bg-gray-900",
      text: isDarkMode ? "text-white" : "text-gray-100",
      controls: isDarkMode ? "bg-black/80" : "bg-gray-900/80",
      button: "text-white hover:bg-white/20",
    }),
    [isDarkMode],
  )

  // Format time for display
  const formatTime = useCallback((time: number) => {
    const hours = Math.floor(time / 3600)
    const minutes = Math.floor((time % 3600) / 60)
    const seconds = Math.floor(time % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }, [])

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)

      // Update buffered progress
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1)
        setBuffered((bufferedEnd / video.duration) * 100)
      }
    }

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleVolumeChange = () => {
      setVolume(video.volume)
      setIsMuted(video.muted)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("volumechange", handleVolumeChange)
    video.addEventListener("ended", handleEnded)

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("volumechange", handleVolumeChange)
      video.removeEventListener("ended", handleEnded)
    }
  }, [])

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  // Auto-hide controls
  useEffect(() => {
    if (showControls && isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [showControls, isPlaying])

  // Control functions
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
    }
  }, [isPlaying])

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
    }
  }, [isMuted])

  const handleVolumeChange = useCallback((value: number[]) => {
    if (videoRef.current) {
      videoRef.current.volume = value[0]
    }
  }, [])

  const handleSeek = useCallback((value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0]
    }
  }, [])

  const skipTime = useCallback(
    (seconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds))
      }
    },
    [duration, currentTime],
  )

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  const changePlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate
      setPlaybackRate(rate)
    }
  }, [])

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
  }, [])

  const handleDownload = useCallback(() => {
    if (recording.filePath) {
      // In a real implementation, this would trigger a download
      const link = document.createElement("a")
      link.href = recording.filePath
      link.download = `${recording.title}.mp4`
      link.click()
    }
  }, [recording])

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: recording.title,
        text: `Watch "${recording.title}" recorded from ${recording.channelName}`,
        url: window.location.href,
      })
    }
  }, [recording])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.code) {
        case "Space":
          e.preventDefault()
          togglePlay()
          break
        case "ArrowLeft":
          e.preventDefault()
          skipTime(-10)
          break
        case "ArrowRight":
          e.preventDefault()
          skipTime(10)
          break
        case "ArrowUp":
          e.preventDefault()
          if (videoRef.current) {
            videoRef.current.volume = Math.min(1, volume + 0.1)
          }
          break
        case "ArrowDown":
          e.preventDefault()
          if (videoRef.current) {
            videoRef.current.volume = Math.max(0, volume - 0.1)
          }
          break
        case "KeyF":
          e.preventDefault()
          toggleFullscreen()
          break
        case "KeyM":
          e.preventDefault()
          toggleMute()
          break
        case "Escape":
          if (isFullscreen) {
            document.exitFullscreen()
          } else {
            onClose()
          }
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, togglePlay, skipTime, volume, toggleFullscreen, toggleMute, isFullscreen, onClose])

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 ${themeClasses.background} ${themeClasses.text}`}>
      {/* Video Container */}
      <div
        className="relative w-full h-full flex items-center justify-center"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          src={recording.filePath || "/placeholder-video.mp4"}
          crossOrigin="anonymous"
          preload="metadata"
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
              <p className="text-white">Loading recording...</p>
            </div>
          </div>
        )}

        {/* Top Controls */}
        <div
          className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onClose} className={themeClasses.button}>
                <X className="w-5 h-5" />
              </Button>
              <div>
                <h2 className="text-lg font-semibold">{recording.title}</h2>
                <p className="text-sm text-gray-300">
                  {recording.channelName} • {recording.startTime.toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {recording.category && <Badge variant="secondary">{recording.category}</Badge>}
              <Button variant="ghost" size="sm" onClick={handleShare} className={themeClasses.button}>
                <Share2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownload} className={themeClasses.button}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Center Play Button (when paused) */}
        {!isPlaying && !isLoading && (
          <Button
            variant="ghost"
            size="lg"
            onClick={togglePlay}
            className="absolute inset-0 w-20 h-20 m-auto rounded-full bg-black/50 hover:bg-black/70 text-white border-2 border-white/30"
          >
            <Play className="w-8 h-8 ml-1" />
          </Button>
        )}

        {/* Bottom Controls */}
        <div
          className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="relative">
              {/* Buffered Progress */}
              <div
                className="absolute top-1/2 left-0 h-1 bg-white/30 rounded-full transform -translate-y-1/2"
                style={{ width: `${buffered}%` }}
              />
              {/* Seek Slider */}
              <Slider value={[currentTime]} max={duration} step={1} onValueChange={handleSeek} className="w-full" />
            </div>
            <div className="flex justify-between text-xs text-gray-300 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <Button variant="ghost" size="sm" onClick={togglePlay} className={themeClasses.button}>
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>

              {/* Skip Backward */}
              <Button variant="ghost" size="sm" onClick={() => skipTime(-10)} className={themeClasses.button}>
                <SkipBack className="w-4 h-4" />
                <span className="text-xs ml-1">10s</span>
              </Button>

              {/* Skip Forward */}
              <Button variant="ghost" size="sm" onClick={() => skipTime(10)} className={themeClasses.button}>
                <SkipForward className="w-4 h-4" />
                <span className="text-xs ml-1">10s</span>
              </Button>

              {/* Restart */}
              <Button variant="ghost" size="sm" onClick={() => handleSeek([0])} className={themeClasses.button}>
                <RotateCcw className="w-4 h-4" />
              </Button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={toggleMute} className={themeClasses.button}>
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback Speed */}
              <div className="flex items-center gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <Button
                    key={rate}
                    variant={playbackRate === rate ? "default" : "ghost"}
                    size="sm"
                    onClick={() => changePlaybackRate(rate)}
                    className={`text-xs ${playbackRate === rate ? "" : themeClasses.button}`}
                  >
                    {rate}x
                  </Button>
                ))}
              </div>

              {/* Settings */}
              <Button variant="ghost" size="sm" className={themeClasses.button}>
                <Settings className="w-4 h-4" />
              </Button>

              {/* Fullscreen */}
              <Button variant="ghost" size="sm" onClick={toggleFullscreen} className={themeClasses.button}>
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts Overlay */}
        <div className="absolute top-4 right-4 text-xs text-gray-400 opacity-50">
          <div>Space: Play/Pause</div>
          <div>←/→: Seek 10s</div>
          <div>↑/↓: Volume</div>
          <div>F: Fullscreen</div>
          <div>M: Mute</div>
          <div>Esc: Exit</div>
        </div>
      </div>
    </div>
  )
})
