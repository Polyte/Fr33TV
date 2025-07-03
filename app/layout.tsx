import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

export const metadata: Metadata = {
  title: 'Fr33TV - Watch Free',
  description: 'Free TV Channels From All Over The World. Enjoy - by 369Kxng',
 
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

const handleStopRecording = async () => {
  if (!recordingFilename) return;
  setRecordingError(null);
  try {
    const res = await fetch('/api/record', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: recordingFilename })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to stop recording');
    setIsRecording(false);
    setRecordingFile(null);
    setRecordingFilename(null);
    toast({ title: 'Recording stopped', description: 'The recording has been stopped.' });
  } catch (error) {
    setRecordingError(error instanceof Error ? error.message : 'Failed to stop recording');
  }
};
