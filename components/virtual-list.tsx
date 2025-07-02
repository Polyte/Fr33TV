"use client"

import type React from "react"

import { memo, useMemo, useCallback, useRef, useState } from "react"

interface VirtualListProps {
  height: number
  itemCount: number
  itemSize: number
  renderItem: (index: number) => React.ReactNode
  className?: string
  overscan?: number
}

export const VirtualList = memo(function VirtualList({
  height,
  itemCount,
  itemSize,
  renderItem,
  className = "",
  overscan = 5,
}: VirtualListProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const { visibleItems, totalHeight, offsetY } = useMemo(() => {
    const containerHeight = height
    const startIndex = Math.floor(scrollTop / itemSize)
    const endIndex = Math.min(itemCount - 1, Math.floor((scrollTop + containerHeight) / itemSize))

    const visibleStartIndex = Math.max(0, startIndex - overscan)
    const visibleEndIndex = Math.min(itemCount - 1, endIndex + overscan)

    const items = []
    for (let i = visibleStartIndex; i <= visibleEndIndex; i++) {
      items.push({
        index: i,
        offsetY: i * itemSize,
      })
    }

    return {
      visibleItems: items,
      totalHeight: itemCount * itemSize,
      offsetY: visibleStartIndex * itemSize,
    }
  }, [scrollTop, height, itemSize, itemCount, overscan])

  return (
    <div ref={scrollElementRef} className={`overflow-auto ${className}`} style={{ height }} onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ index }) => (
            <div key={index} style={{ height: itemSize }}>
              {renderItem(index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
