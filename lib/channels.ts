import { Channel } from '@/types';

const STORAGE_KEY = 'fr33tv_channels';

// Load channels from localStorage
export const loadChannels = (): Channel[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const savedChannels = localStorage.getItem(STORAGE_KEY);
    if (!savedChannels) return [];
    
    const channels = JSON.parse(savedChannels);
    // Convert string dates back to Date objects
    return channels.map((channel: any) => ({
      ...channel,
      lastChecked: channel.lastChecked ? new Date(channel.lastChecked) : undefined
    }));
  } catch (error) {
    console.error('Error loading channels:', error);
    return [];
  }
};

// Save channels to localStorage
export const saveChannels = (channels: Channel[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
  } catch (error) {
    console.error('Error saving channels:', error);
  }
};

// Validate a channel URL
export const validateChannel = async (url: string): Promise<boolean> => {
  if (!url) return false;
  
  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return false;
  }
  
  // For M3U8/HLS streams, we can do a more thorough check
  if (url.endsWith('.m3u8') || url.includes('m3u8')) {
    return validateHLSStream(url);
  }
  
  // For other stream types, just check if the URL is accessible
  return checkUrlAccessibility(url);
};

// Check if a URL is accessible
const checkUrlAccessibility = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('Error checking URL accessibility:', error);
    return false;
  }
};

// Validate HLS stream
const validateHLSStream = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for HLS
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return false;
    
    const content = await response.text();
    // Basic check for M3U8 file format
    return content.includes('#EXTM3U');
  } catch (error) {
    console.error('Error validating HLS stream:', error);
    return false;
  }
};

// Generate a unique ID for a channel
export const generateChannelId = (channel: Omit<Channel, 'id'>): string => {
  return `${channel.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
};

// Find a channel by ID
export const findChannelById = (channels: Channel[], id: string): Channel | undefined => {
  return channels.find(channel => channel.id === id);
};

// Update a channel by ID
export const updateChannel = (
  channels: Channel[], 
  id: string, 
  updates: Partial<Channel>
): Channel[] => {
  return channels.map(channel => 
    channel.id === id ? { ...channel, ...updates } : channel
  );
};

// Remove a channel by ID
export const removeChannel = (channels: Channel[], id: string): Channel[] => {
  return channels.filter(channel => channel.id !== id);
};

// Filter channels by search term
export const filterChannels = (channels: Channel[], searchTerm: string): Channel[] => {
  if (!searchTerm.trim()) return channels;
  
  const term = searchTerm.toLowerCase();
  return channels.filter(channel => 
    channel.name.toLowerCase().includes(term) || 
    (channel.group && channel.group.toLowerCase().includes(term))
  );
};

// Get unique channel groups
export const getChannelGroups = (channels: Channel[]): string[] => {
  const groups = new Set<string>();
  channels.forEach(channel => {
    if (channel.group) {
      groups.add(channel.group);
    }
  });
  return Array.from(groups).sort();
};