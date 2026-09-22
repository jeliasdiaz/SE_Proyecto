import { ScanSearchIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Violeta, no ámbar: "por revisar" es la calidad de la clasificación, no un estado del proceso,
// y no debe confundirse con Pendiente.
export function RevisionBadge({ motivo, className }: { motivo?: string | null; className?: string }) {
  return (
    <Badge
      variant="outline"
      title={motivo ?? undefined}
      className={cn("border-violet-200 bg-violet-50 text-violet-900", className)}
    >
      <ScanSearchIcon data-icon="inline-start" />
      Por revisar
    </Badge>
  )
}
