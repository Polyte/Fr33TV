"use client"

import { useState, useRef, useEffect } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  fallbackSrc?: string
  width?: number
  height?: number
  onLoad?: () => void
  onError?: () => void
}

export function LazyImage({
  src,
  alt,
  className = "",
  fallbackSrc = "/placeholder.svg",
  width,
  height,
  onLoad,
  onError,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: "50px", // Start loading 50px before the image comes into view
        threshold: 0.1,
      },
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current)
      }
    }
  }, [])

  // Handle image loading
  useEffect(() => {
    if (isInView && !isLoaded && !hasError) {
      setIsLoading(true)

      const img = new Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        setIsLoaded(true)
        setIsLoading(false)
        onLoad?.()
      }

      img.onerror = () => {
        setHasError(true)
        setIsLoading(false)
        onError?.()
      }

      img.src = src
    }
  }, [isInView, src, isLoaded, hasError, onLoad, onError])

  const imageSrc = hasError ? fallbackSrc : src

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {/* Loading skeleton */}
      {!isLoaded && isLoading && (
        <Skeleton className="absolute inset-0 w-full h-full animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
      )}

      {/* Placeholder for not in view */}
      {!isInView && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Actual image */}
      {isInView && (
        <img
          ref={imgRef}
          src={imageSrc || "/placeholder.svg"}
          alt={alt}
          className={`w-full h-full object-cover transition-all duration-500 ease-in-out ${
            isLoaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-105 blur-sm"
          }`}
          onLoad={() => {
            setIsLoaded(true)
            setIsLoading(false)
            onLoad?.()
          }}
          onError={() => {
            setHasError(true)
            setIsLoading(false)
            onError?.()
          }}
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Error state */}
      {hasError && !isLoading && (
        <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-gray-400 text-xs text-center p-2">
            <div className="w-8 h-8 mx-auto mb-1 opacity-50">📺</div>
            <div>No Image</div>
          </div>
        </div>
      )}

      {/* Loading indicator overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
