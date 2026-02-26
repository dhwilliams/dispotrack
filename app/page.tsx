import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">DispoTrack</CardTitle>
          <CardDescription>Asset Disposition Tracking System</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">Next.js 16</Badge>
            <Badge variant="secondary">Tailwind v4</Badge>
            <Badge variant="secondary">shadcn/ui</Badge>
            <Badge variant="secondary">Supabase</Badge>
          </div>
          <Button className="w-full" disabled>
            Login
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Auth will be configured in Phase 0.3
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
