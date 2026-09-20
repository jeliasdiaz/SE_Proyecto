import { Badge } from "@/components/ui/badge"
import { ETIQUETA_ESTADO, type Estado } from "@/lib/dominio"
import { cn } from "@/lib/utils"

const ESTILO: Record<Estado, string> = {
  pendiente: "border-amber-200 bg-amber-50 text-amber-900",
  en_proceso: "border-sky-200 bg-sky-50 text-sky-900",
  finalizada: "border-emerald-200 bg-emerald-50 text-emerald-900",
  rechazada: "border-rose-200 bg-rose-50 text-rose-900",
}

export function EstadoBadge({ estado, className }: { estado: Estado; className?: string }) {
  return (
    <Badge variant="outline" className={cn(ESTILO[estado], className)}>
      {ETIQUETA_ESTADO[estado]}
    </Badge>
  )
}
