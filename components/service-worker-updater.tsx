"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Download } from "lucide-react"

const ServiceWorkerUpdater = () => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg)

        // Listen for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setShowUpdatePrompt(true)
              }
            })
          }
        })
      })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "UPDATE_AVAILABLE") {
          setShowUpdatePrompt(true)
        }
      })
    }
  }, [])

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" })
      window.location.reload()
    }
  }

  const handleDismiss = () => {
    setShowUpdatePrompt(false)
  }

  if (!showUpdatePrompt) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Alert className="border-blue-200 bg-blue-50">
        <Download className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 mb-3">A new version of the app is available!</AlertDescription>
        <div className="flex space-x-2">
          <Button size="sm" onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 text-white">
            <RefreshCw className="w-3 h-3 mr-1" />
            Update
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDismiss}
            className="border-blue-300 text-blue-700 hover:bg-blue-100 bg-transparent"
          >
            Later
          </Button>
        </div>
      </Alert>
    </div>
  )
}

export default ServiceWorkerUpdater
