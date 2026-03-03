import { Skeleton } from "@/components/ui/skeleton"

export default function ClientsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="rounded-md border">
        <div className="p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
