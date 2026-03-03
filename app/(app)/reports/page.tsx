import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Shield, HardDrive, Recycle } from "lucide-react"

const reports = [
  {
    title: "Certificate of Disposition",
    description:
      "Lists all assets received in a transaction. Certifies proper disposition, sanitization, and compliance with applicable regulations.",
    href: "/reports/disposition",
    icon: FileText,
    ready: true,
  },
  {
    title: "Certificate of Sanitization",
    description:
      "Lists assets with sanitization records (drive-level). Certifies NIST 800-88 compliant data sanitization.",
    href: "/reports/sanitization",
    icon: Shield,
    ready: true,
  },
  {
    title: "Certificate of Data Destruction",
    description:
      "Lists assets where drives were physically destroyed (crushed/shredded). Certifies physical media destruction.",
    href: "/reports/destruction",
    icon: HardDrive,
    ready: false,
  },
  {
    title: "Certificate of Recycling",
    description:
      "Lists assets with destination = recycle. Certifies responsible recycling in compliance with regulations.",
    href: "/reports/recycling",
    icon: Recycle,
    ready: false,
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate audit-ready certificates for transactions"
      />

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon
          const content = (
            <Card
              className={`transition-colors ${
                report.ready
                  ? "cursor-pointer hover:border-primary/50"
                  : "opacity-60"
              }`}
            >
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{report.title}</CardTitle>
                  {!report.ready && (
                    <span className="text-xs text-muted-foreground">
                      Coming soon
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {report.description}
                </p>
              </CardContent>
            </Card>
          )

          if (report.ready) {
            return (
              <Link key={report.title} href={report.href}>
                {content}
              </Link>
            )
          }

          return <div key={report.title}>{content}</div>
        })}
      </div>
    </div>
  )
}
