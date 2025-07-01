"use client"

import { useEffect, useState } from "react"
import { Tv } from "lucide-react"

interface PreloaderProps {
  isLoading: boolean
  onLoadingComplete?: () => void
}

export function Preloader({ isLoading, onLoadingComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0)
  const [loadingText, setLoadingText] = useState("Initializing...")
  const [isVisible, setIsVisible] = useState(isLoading)

  const loadingSteps = [
    { progress: 20, text: "Loading playlists..." },
    { progress: 40, text: "Connecting to streams..." },
    { progress: 60, text: "Preparing channels..." },
    { progress: 80, text: "Setting up interface..." },
    { progress: 100, text: "Ready to watch!" },
  ]

  useEffect(() => {
    if (!isLoading) {
      // Fade out animation
      const timer = setTimeout(() => {
        setIsVisible(false)
        onLoadingComplete?.()
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(true)
      setProgress(0)
      setLoadingText("Initializing...")
    }
  }, [isLoading, onLoadingComplete])

  useEffect(() => {
    if (isLoading && isVisible) {
      let currentStep = 0
      const interval = setInterval(() => {
        if (currentStep < loadingSteps.length) {
          const step = loadingSteps[currentStep]
          setProgress(step.progress)
          setLoadingText(step.text)
          currentStep++
        } else {
          clearInterval(interval)
        }
      }, 800)

      return () => clearInterval(interval)
    }
  }, [isLoading, isVisible])

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 transition-opacity duration-500 ${
        isLoading ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-blue-400 rounded-full opacity-20 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main preloader content */}
      <div className="relative z-10 text-center">
        {/* Animated logo */}
        <div className="mb-8 relative">
          <div className="relative inline-block">
            {/* Pulsing rings */}
            <div className="absolute inset-0 w-24 h-24 border-4 border-blue-500 rounded-full animate-ping opacity-20" />
            <div className="absolute inset-2 w-20 h-20 border-2 border-purple-400 rounded-full animate-ping opacity-30 animation-delay-500" />
            <div className="absolute inset-4 w-16 h-16 border border-blue-300 rounded-full animate-ping opacity-40 animation-delay-1000" />

            {/* Main logo */}
            <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl animate-pulse-glow">
              <Tv className="w-12 h-12 text-white animate-bounce" />
            </div>
          </div>
        </div>

        {/* App title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 animate-fade-in">
          <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
            Fr33 TV
          </span>
        </h1>

        <p className="text-blue-200 text-lg mb-8 animate-fade-in animation-delay-500">
          Your Gateway to Free Television
        </p>

        {/* Progress bar */}
        <div className="w-80 max-w-sm mx-auto mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-blue-200 text-sm font-medium">{loadingText}</span>
            <span className="text-blue-300 text-sm font-bold">{progress}%</span>
          </div>

          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              {/* Animated shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Loading dots */}
        <div className="flex justify-center space-x-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
  )
}
