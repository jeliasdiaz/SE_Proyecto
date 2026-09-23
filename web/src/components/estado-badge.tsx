import { CheckCircle2Icon, CircleXIcon, Clock3Icon, LoaderCircleIcon, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ETIQUETA_ESTADO, type Estado } from "@/lib/dominio"
import { cn } from "@/lib/utils"

const ESTILO: Record<Estado, string> = {
  pendiente: "border-amber-300 bg-amber-50 text-amber-950 shadow-sm shadow-amber-100",
  en_proceso: "border-sky-300 bg-sky-50 text-sky-950 shadow-sm shadow-sky-100",
  finalizada: "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm shadow-emerald-100",
  rechazada: "border-rose-300 bg-rose-50 text-rose-950 shadow-sm shadow-rose-100",
}

const ICONO: Record<Estado, LucideIcon> = {
  pendiente: Clock3Icon,
  en_proceso: LoaderCircleIcon,
  finalizada: CheckCircle2Icon,
  rechazada: CircleXIcon,
}

export function EstadoBadge({ estado, className }: { estado: Estado; className?: string }) {
  const Icono = ICONO[estado]

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", ESTILO[estado], className)}>
      <Icono className={cn("size-3.5", estado === "en_proceso" && "animate-spin")} aria-hidden="true" />
      {ETIQUETA_ESTADO[estado]}
    </Badge>
  )
}
