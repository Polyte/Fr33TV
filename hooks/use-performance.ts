"use client"

import { useState, useEffect, useCallback, useRef } from "react"

interface PerformanceMetrics {
  fps: number
  memoryUsage: number
  renderTime: number
  isSlowDevice: boolean
}

export function usePerformance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memoryUsage: 0,
    renderTime: 0,
    isSlowDevice: false,
  })

  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())
  const renderStartTime = useRef(0)
  const animationFrameId = useRef<number>()

  const updateFPS = useCallback(() => {
    const now = performance.now()
    frameCount.current++

    if (now - lastTime.current >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current))

      setMetrics((prev) => ({
        ...prev,
        fps,
        isSlowDevice: fps < 30,
      }))

      frameCount.current = 0
      lastTime.current = now
    }

    animationFrameId.current = requestAnimationFrame(updateFPS)
  }, [])

  const updateMemoryUsage = useCallback(() => {
    if ("memory" in performance) {
      const memory = (performance as any).memory
      const memoryUsage = Math.round(memory.usedJSHeapSize / 1024 / 1024)

      setMetrics((prev) => ({
        ...prev,
        memoryUsage,
      }))
    }
  }, [])

  const startRender = useCallback(() => {
    renderStartTime.current = performance.now()
  }, [])

  const endRender = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current
    setMetrics((prev) => ({
      ...prev,
      renderTime,
    }))
  }, [])

  useEffect(() => {
    // Start FPS monitoring
    animationFrameId.current = requestAnimationFrame(updateFPS)

    // Update memory usage periodically
    const memoryInterval = setInterval(updateMemoryUsage, 5000)

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
      clearInterval(memoryInterval)
    }
  }, [updateFPS, updateMemoryUsage])

  return {
    ...metrics,
    startRender,
    endRender,
  }
}
