"use client"

import { useState, useRef, useEffect } from "react"
import { ImageIcon } from "lucide-react"

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  fallback?: string
}

export function LazyImage({ src, alt, className = "", width, height, fallback }: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    if (placeholderRef.current) {
      observer.observe(placeholderRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleLoad = () => {
    setIsLoaded(true)
  }

  const handleError = () => {
    setHasError(true)
    setIsLoaded(true)
  }

  return (
    <div
      ref={placeholderRef}
      className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{ width, height }}
    >
      {/* Loading skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse">
            <ImageIcon className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      )}

      {/* Actual image */}
      {isInView && (
        <img
          ref={imgRef}
          src={hasError ? fallback || "/placeholder.svg" : src}
          alt={alt}
          className={`w-full h-full object-cover transition-all duration-300 ${
            isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
          }`}
          onLoad={handleLoad}
          onError={handleError}
          crossOrigin="anonymous"
        />
      )}

      {/* Shimmer effect while loading */}
      {!isLoaded && isInView && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      )}
    </div>
  )
}
