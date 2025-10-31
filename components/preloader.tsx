"use client"

import {  } from 'react';

import { ReactNode , useState, useEffect, memo } from "react"
import { Tv, Wifi, Play, Settings, Zap } from "lucide-react"
import dynamic from 'next/dynamic'

interface PreloaderProps {
  isLoading: boolean
  onLoadingComplete: () => void
}

 interface NoSSRProps {
  children: ReactNode;
  fallback?: ReactNode;
}
 

const Preloader = memo(function Preloader({ isLoading, onLoadingComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  const stages = [
    { icon: Tv, label: "Initializing IPTV Player", duration: 800 },
    { icon: Wifi, label: "Connecting to services", duration: 600 },
    { icon: Play, label: "Loading media components", duration: 500 },
    { icon: Settings, label: "Configuring settings", duration: 400 },
    { icon: Zap, label: "Optimizing performance", duration: 300 },
  ]

    const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
     setIsMounted(true);
    if (!isLoading) return

    const totalDuration = 0
    let currentProgress = 0

    const runStages = async () => {
      for (let i = 0; i < stages.length; i++) {
        setCurrentStage(i)

        const stageDuration = stages[i].duration
        const stageProgressIncrement = 100 / stages.length

        // Animate progress for this stage
        const startProgress = currentProgress
        const endProgress = currentProgress + stageProgressIncrement

        await new Promise<void>((resolve) => {
          const startTime = Date.now()

          const animateProgress = () => {
            const elapsed = Date.now() - startTime
            const stageProgress = Math.min(elapsed / stageDuration, 1)
            const newProgress = startProgress + stageProgress * stageProgressIncrement

            setProgress(newProgress)

            if (stageProgress < 1) {
              requestAnimationFrame(animateProgress)
            } else {
              resolve()
            }
          }

          animateProgress()
        })

        currentProgress = endProgress
      }

      // Complete loading
      setProgress(100)

      // Wait a bit before hiding
      setTimeout(() => {
        setIsVisible(false)
        setTimeout(onLoadingComplete, 500)
      }, 500)
    }

    runStages()
  }, [isLoading, onLoadingComplete])

  if (!isVisible) return null

  const CurrentIcon = stages[currentStage]?.icon || Tv
  if (!isMounted) return null;
  return (  
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 animate-pulse" />

        {/* Floating particles */}
        {Array.from({ length: 20 }).map((_, i) => {
          // Use deterministic values for SSR consistency
          const left = ((i * 7) % 100) + (i % 3) * 10
          const top = ((i * 11) % 100) + (i % 5) * 8
          const delay = (i % 4) * 0.5
          const duration = 3 + (i % 3) * 0.5
          
          return (
            <div
              key={i}
              className="absolute w-2 h-2 bg-blue-400/30 rounded-full animate-float"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                animationDelay: `${delay}s`,
                animationDuration: `${duration}s`,
              }}
            />
          )
        })}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-blue-400/30 rounded-full animate-float"
            style={{
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    animationDelay: `${Math.random() * 3}s`,
    animationDuration: `${3 + Math.random() * 2}s`,
  }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-md mx-auto px-6">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center transform animate-bounce">
            <Tv className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Fr33 TV</h1>
          <p className="text-blue-200">Professional IPTV Experience</p>
        </div>

        {/* Current stage */}
        <div className="mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
            <CurrentIcon className="w-8 h-8 text-blue-300 animate-pulse" />
          </div>
          <p className="text-white text-lg font-medium">{stages[currentStage]?.label || "Loading..."}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="w-full bg-white/20 rounded-full h-2 mb-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-blue-200 text-sm">{Math.round(progress)}% Complete</p>
        </div>

        {/* Features preview */}
        <div className="grid grid-cols-2 gap-4 text-xs text-blue-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>HD Streaming</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>EPG Support</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>Recording</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>Offline Mode</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>by 369Kxng</span>
          </div>
        </div>
      </div>
    </div>
  );
})

export default Preloader
