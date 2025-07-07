import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import path from 'path'

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

const recordingsDir = path.join(process.cwd(), 'public', 'recording')
