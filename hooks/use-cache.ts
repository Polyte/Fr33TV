"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface CacheEntry<T> {
  value: T
  timestamp: number
  ttl?: number
}

interface CacheStats {
  size: number
  hits: number
  misses: number
  hitRate: number
}

export function useCache<T>(maxSize = 100, defaultTTL: number = 5 * 60 * 1000) {
  const cache = useRef(new Map<string, CacheEntry<T>>())
  const stats = useRef<CacheStats>({ size: 0, hits: 0, misses: 0, hitRate: 0 })
  const [, forceUpdate] = useState({})

  const updateStats = useCallback(() => {
    const { hits, misses } = stats.current
    stats.current.hitRate = hits + misses > 0 ? hits / (hits + misses) : 0
    stats.current.size = cache.current.size
  }, [])

  const cleanup = useCallback(() => {
    const now = Date.now()
    const entries = Array.from(cache.current.entries())

    for (const [key, entry] of entries) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        cache.current.delete(key)
      }
    }

    // If still over max size, remove oldest entries
    if (cache.current.size > maxSize) {
      const sortedEntries = entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, cache.current.size - maxSize)

      for (const [key] of sortedEntries) {
        cache.current.delete(key)
      }
    }

    updateStats()
  }, [maxSize, updateStats])

  const get = useCallback(
    (key: string): T | undefined => {
      const entry = cache.current.get(key)

      if (!entry) {
        stats.current.misses++
        updateStats()
        return undefined
      }

      const now = Date.now()
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        cache.current.delete(key)
        stats.current.misses++
        updateStats()
        return undefined
      }

      stats.current.hits++
      updateStats()
      return entry.value
    },
    [updateStats],
  )

  const set = useCallback(
    (key: string, value: T, ttl?: number): void => {
      cache.current.set(key, {
        value,
        timestamp: Date.now(),
        ttl: ttl || defaultTTL,
      })

      cleanup()
      forceUpdate({})
    },
    [defaultTTL, cleanup],
  )

  const remove = useCallback(
    (key: string): boolean => {
      const result = cache.current.delete(key)
      updateStats()
      forceUpdate({})
      return result
    },
    [updateStats],
  )

  const clear = useCallback(() => {
    cache.current.clear()
    stats.current = { size: 0, hits: 0, misses: 0, hitRate: 0 }
    forceUpdate({})
  }, [])

  const has = useCallback((key: string): boolean => {
    return cache.current.has(key)
  }, [])

  // Periodic cleanup
  useEffect(() => {
    const interval = setInterval(cleanup, 60000) // Cleanup every minute
    return () => clearInterval(interval)
  }, [cleanup])

  return {
    get,
    set,
    remove,
    clear,
    has,
    stats: stats.current,
  }
}
