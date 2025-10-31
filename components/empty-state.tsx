// components/empty-state.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Plus, Tv } from 'lucide-react';

interface EmptyStateProps {
  onAddChannel: (url: string, name: string) => void;
}

export function EmptyState({ onAddChannel }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <Tv className="h-10 w-10 text-primary" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">No channel selected</h2>
        <p className="text-muted-foreground">
          Select a channel from the sidebar or add a new one to get started
        </p>
      </div>
      <Button
        onClick={() => {
          const url = prompt('Enter stream URL:');
          const name = prompt('Enter channel name:');
          if (url && name) {
            onAddChannel(url, name);
          }
        }}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Channel
      </Button>
    </div>
  );
}