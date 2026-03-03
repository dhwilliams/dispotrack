import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function AssetEditLoading() {
  return (
    <div className="space-y-6">
      {/* Header with asset ID */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      {/* Tabs */}
      <Skeleton className="h-9 w-full max-w-3xl" />
      {/* Form content */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-20" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
