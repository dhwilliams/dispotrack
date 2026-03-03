import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileQuestion } from "lucide-react"

export default function AppNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <FileQuestion className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle>Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Button asChild>
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
