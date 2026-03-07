"use client"

import { useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { ScanBarcode } from "lucide-react"

interface BarcodeScannerProps {
  id?: string
  name?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onScan?: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
}

/**
 * Input that handles both manual typing and USB barcode scanner input.
 * USB scanners send keystrokes rapidly followed by Enter — this detects
 * that pattern and triggers onScan when a rapid sequence ending in Enter is detected.
 */
export function BarcodeScanner({
  id,
  name,
  placeholder = "Scan or type...",
  value,
  onChange,
  onScan,
  onBlur,
  disabled,
}: BarcodeScannerProps) {
  const bufferRef = useRef("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault()
        // If we have a buffer from rapid input, treat as scan
        if (bufferRef.current.length >= 3) {
          const scanned = bufferRef.current
          onChange(scanned)
          onScan?.(scanned)
        } else if (value.trim()) {
          // Manual entry followed by Enter
          onScan?.(value.trim())
        }
        bufferRef.current = ""
        if (timerRef.current) clearTimeout(timerRef.current)
        return
      }

      // Track rapid keystrokes (scanner sends chars < 50ms apart)
      if (e.key.length === 1) {
        bufferRef.current += e.key
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          // If keystrokes stopped coming, it was manual typing — clear buffer
          bufferRef.current = ""
        }, 100)
      }
    },
    [value, onChange, onScan],
  )

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        disabled={disabled}
        className="pr-9"
      />
      <ScanBarcode className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
