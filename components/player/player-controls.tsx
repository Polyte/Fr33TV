// components/player/player-controls.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  RotateCcw,
  RotateCw
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface PlayerControlsProps {
  state: {
    isPlaying: boolean;
    isMuted: boolean;
    volume: number;
    currentTime: number;
    duration: number;
    isFullscreen: boolean;
    error: string | null;
  };
  onChange: (state: Partial<PlayerState>) => void;
  className?: string;
  showSkipControls?: boolean;
  skipDuration?: number;
}

export function PlayerControls({
  state,
  onChange,
  className,
  showSkipControls = true,
  skipDuration = 10,
}: PlayerControlsProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout>();

  const togglePlay = () => {
    onChange({ isPlaying: !state.isPlaying });
  };

  const toggleMute = () => {
    onChange({ isMuted: !state.isMuted });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100;
    onChange({ 
      volume: newVolume,
      isMuted: newVolume === 0 ? true : state.isMuted
    });
  };

  const handleSeek = (value: number[]) => {
    onChange({ currentTime: value[0] });
  };

  const skipForward = () => {
    onChange({ currentTime: Math.min(state.currentTime + skipDuration, state.duration) });
  };

  const skipBackward = () => {
    onChange({ currentTime: Math.max(0, state.currentTime - skipDuration) });
  };

  // Format time in MM:SS format
  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Auto-hide controls when not interacting
  useEffect(() => {
    const handleMouseMove = () => {
      setIsHovered(true);
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
      volumeTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 3000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current);
      }
    };
  }, []);

  if (state.error) {
    return (
      <div className={cn('p-4 bg-black/70 text-white text-center', className)}>
        <p className="text-red-400">Error: {state.error}</p>
      </div>
    );
  }

  return (
    <div 
      ref={controlsRef}
      className={cn(
        'w-full bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300',
        isHovered ? 'opacity-100' : 'opacity-0 hover:opacity-100',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Progress Bar */}
      <div className="w-full mb-2 group">
        <Slider
          value={[state.currentTime]}
          max={state.duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="h-1.5 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-white/80 mt-1">
          <span>{formatTime(state.currentTime)}</span>
          <span>{formatTime(state.duration)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Play/Pause Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlay}
            className="text-white hover:bg-white/20"
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5" />
            )}
          </Button>

          {/* Skip Backward */}
          {showSkipControls && (
            <Button
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              className="text-white hover:bg-white/20"
              aria-label={`Skip back ${skipDuration} seconds`}
            >
              <SkipBack className="h-5 w-5" />
            </Button>
          )}

          {/* Skip Forward */}
          {showSkipControls && (
            <Button
              variant="ghost"
              size="icon"
              onClick={skipForward}
              className="text-white hover:bg-white/20"
              aria-label={`Skip forward ${skipDuration} seconds`}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          )}

          {/* Current Time */}
          <span className="text-sm text-white/80 w-16 text-center">
            {formatTime(state.currentTime)}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Volume Control */}
          <div 
            className="relative group/volume"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="text-white hover:bg-white/20"
              aria-label={state.isMuted ? 'Unmute' : 'Mute'}
            >
              {state.isMuted || state.volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
            
            {showVolumeSlider && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-black/90 p-3 rounded shadow-lg">
                <Slider
                  value={[state.isMuted ? 0 : state.volume * 100]}
                  max={100}
                  step={1}
                  orientation="vertical"
                  className="h-24"
                  onValueChange={(value) => handleVolumeChange(value)}
                />
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-white hover:bg-white/20"
            aria-label={state.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {state.isFullscreen ? (
              <Minimize className="h-5 w-5" />
            ) : (
              <Maximize className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}