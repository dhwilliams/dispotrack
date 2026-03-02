"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Check, Copy } from "lucide-react"

interface InternalIdDisplayProps {
  internalAssetId: string
  className?: string
}

export function InternalIdDisplay({
  internalAssetId,
  className,
}: InternalIdDisplayProps) {
  const [copied, setCopied] = useState(false)

  async function copyToClipboard() {
    await navigator.clipboard.writeText(internalAssetId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="rounded bg-muted px-2.5 py-1 font-mono text-sm font-semibold">
        {internalAssetId}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={copyToClipboard}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}
