"use client"

import { memo, useMemo, useCallback, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Play, Wifi, WifiOff, AlertTriangle, Star } from "lucide-react"
import { VirtualList } from "@/components/virtual-list"

interface Channel {
  name: string
  url: string
  group?: string
  logo?: string
  isWorking?: boolean
  lastChecked?: Date
}

interface ChannelListProps {
  channels: Channel[]
  selectedChannel: Channel | null
  onChannelSelect: (channel: Channel) => void
  searchTerm?: string
  selectedCategory?: string | null
  isDarkMode?: boolean
  containerHeight?: number
}

const ChannelItem = memo(function ChannelItem({
  channel,
  isSelected,
  onSelect,
  isDarkMode,
  isFavourite,
  onToggleFavourite,
}: {
  channel: Channel
  isSelected: boolean
  onSelect: (channel: Channel) => void
  isDarkMode?: boolean
  isFavourite?: boolean
  onToggleFavourite?: (channel: Channel) => void
}) {
  const handleClick = useCallback(() => {
    onSelect(channel)
  }, [channel, onSelect])

  const themeClasses = useMemo(
    () => ({
      item: `p-3 border-b transition-all duration-200 cursor-pointer ${
        isDarkMode ? "border-gray-700 hover:bg-gray-700" : "border-gray-200 hover:bg-gray-50"
      } ${isSelected ? (isDarkMode ? "bg-blue-600" : "bg-blue-500") : ""}`,
      text: `${isDarkMode ? "text-white" : "text-gray-900"} ${isSelected ? "text-white" : ""}`,
      muted: `${isDarkMode ? "text-gray-400" : "text-gray-600"} ${isSelected ? "text-blue-100" : ""}`,
    }),
    [isDarkMode, isSelected],
  )

  return (
    <div className={themeClasses.item} onClick={handleClick}>
      <div className="flex items-center gap-3">
        {/* Channel Logo */}
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
          {channel.logo ? (
            <img
              src={channel.logo || "/placeholder.svg"}
              alt={channel.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = "none"
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-4 h-4 text-gray-400" />
            </div>
          )}
        </div>

        {/* Channel Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-medium text-sm truncate ${themeClasses.text}`}>{channel.name}</h3>
            {channel.isWorking === false && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
            {channel.isWorking === true && <Wifi className="w-3 h-3 text-green-500 flex-shrink-0" />}
          </div>
          {channel.group && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {channel.group}
              </Badge>
              {channel.lastChecked && (
                <span className={`text-xs ${themeClasses.muted}`}>
                  Checked {channel.lastChecked.toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Favourite Button */}
        {onToggleFavourite && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="flex-shrink-0 mr-1"
            tabIndex={-1}
            onClick={e => {
              e.stopPropagation()
              onToggleFavourite(channel)
            }}
            aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
          >
            <Star className={`w-4 h-4 ${isFavourite ? "text-yellow-400 fill-yellow-400" : "text-gray-400"}`} fill={isFavourite ? "#facc15" : "none"} />
          </Button>
        )}

        {/* Play Button */}
        <Button
          variant={isSelected ? "secondary" : "ghost"}
          size="sm"
          className={`flex-shrink-0 ${isSelected ? "text-blue-600" : themeClasses.text}`}
        >
          <Play className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
})

export const ChannelList = memo(function ChannelList({
  channels,
  selectedChannel,
  onChannelSelect,
  searchTerm,
  selectedCategory,
  isDarkMode,
  containerHeight = 400,
}: ChannelListProps) {
  // Favourites state
  const [favourites, setFavourites] = useState<string[]>([])

  // Load favourites from localStorage
  useEffect(() => {
    const favs = localStorage.getItem("favouriteChannels")
    if (favs) setFavourites(JSON.parse(favs))
  }, [])

  // Save favourites to localStorage
  useEffect(() => {
    localStorage.setItem("favouriteChannels", JSON.stringify(favourites))
  }, [favourites])

  // Toggle favourite
  const handleToggleFavourite = useCallback((channel: Channel) => {
    setFavourites(prev => {
      if (prev.includes(channel.url)) {
        return prev.filter(url => url !== channel.url)
      } else {
        return [...prev, channel.url]
      }
    })
  }, [])

  // Memoized filtered and sorted channels
  const processedChannels = useMemo(() => {
    const filtered = [...channels]
    // Sort by working status first, then by name
    filtered.sort((a, b) => {
      // Working channels first
      if (a.isWorking && !b.isWorking) return -1
      if (!a.isWorking && b.isWorking) return 1
      // Then by name
      return (a.name || '').localeCompare(b.name || '')
    })
    return filtered
  }, [channels])

  // Favourites at the top
  const favouriteChannels = useMemo(() =>
    processedChannels.filter(c => favourites.includes(c.url)),
    [processedChannels, favourites]
  )
  const nonFavouriteChannels = useMemo(() =>
    processedChannels.filter(c => !favourites.includes(c.url)),
    [processedChannels, favourites]
  )
  const allChannels = [...favouriteChannels, ...nonFavouriteChannels]

  // Render item function for virtual list
  const renderItem = useCallback(
    (index: number) => {
      const channel = allChannels[index]
      const isSelected = selectedChannel?.url === channel.url
      const isFavourite = favourites.includes(channel.url)
      return (
        <ChannelItem
          key={`${channel.url}-${index}`}
          channel={channel}
          isSelected={isSelected}
          onSelect={onChannelSelect}
          isDarkMode={isDarkMode}
          isFavourite={isFavourite}
          onToggleFavourite={handleToggleFavourite}
        />
      )
    },
    [allChannels, selectedChannel, onChannelSelect, isDarkMode, favourites, handleToggleFavourite],
  )

  if (allChannels.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <WifiOff className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No channels found</p>
        {searchTerm && <p className="text-xs">Try adjusting your search terms</p>}
      </div>
    )
  }

  // Use virtual scrolling for large lists
  if (allChannels.length > 50) {
    return (
      <VirtualList
        height={containerHeight}
        itemCount={allChannels.length}
        itemSize={80}
        renderItem={renderItem}
        className="w-full"
      />
    )
  }

  // Regular scrolling for smaller lists
  return (
    <ScrollArea className="h-full">
      <div className="space-y-0">
        {favouriteChannels.length > 0 && (
          <>
            <div className="px-4 pt-3 pb-1 text-xs font-semibold text-yellow-600 dark:text-yellow-400">Favourites</div>
            {favouriteChannels.map((channel, index) => (
              <ChannelItem
                key={`fav-${channel.url}-${index}`}
                channel={channel}
                isSelected={selectedChannel?.url === channel.url}
                onSelect={onChannelSelect}
                isDarkMode={isDarkMode}
                isFavourite={true}
                onToggleFavourite={handleToggleFavourite}
              />
            ))}
            <div className="my-2 border-t border-dashed border-gray-300 dark:border-gray-700" />
          </>
        )}
        {nonFavouriteChannels.map((channel, index) => (
          <ChannelItem
            key={`nonfav-${channel.url}-${index}`}
            channel={channel}
            isSelected={selectedChannel?.url === channel.url}
            onSelect={onChannelSelect}
            isDarkMode={isDarkMode}
            isFavourite={false}
            onToggleFavourite={handleToggleFavourite}
          />
        ))}
      </div>
    </ScrollArea>
  )
})
