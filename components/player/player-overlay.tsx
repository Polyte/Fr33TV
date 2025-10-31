// components/player/player-overlay.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { Channel, PlayerState } from '@/types';
import { cn } from '@/lib/utils';

interface PlayerOverlayProps {
  channel: Channel;
  playerState: PlayerState;
  onStateChange: (state: Partial<PlayerState>) => void;
}

export function PlayerOverlay({ channel, playerState, onStateChange }: PlayerOverlayProps) {
  const toggleMute = () => {
    onStateChange({ isMuted: !playerState.isMuted });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
      {/* Top Bar */}
      <div className="flex justify-between items-center">
        <div className="bg-black/70 text-white px-3 py-1 rounded">
          <h2 className="font-semibold">{channel.name}</h2>
          {channel.group && (
            <p className="text-xs text-muted-foreground">{channel.group}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="pointer-events-auto">
            {playerState.isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="pointer-events-auto">
            {document.fullscreenElement ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex justify-center">
        <PlayerControls state={playerState} onChange={onStateChange} className="pointer-events-auto" />
      </div>
    </div>
  );
}