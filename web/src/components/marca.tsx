import { InboxIcon } from "lucide-react"
import { NOMBRE_APP } from "@/lib/marca"
import { cn } from "@/lib/utils"

export function Marca({ tamano = "md", className }: { tamano?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 font-semibold tracking-tight", className)}>
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground",
          tamano === "lg" ? "size-9 [&_svg]:size-5" : "size-7 [&_svg]:size-4"
        )}
      >
        <InboxIcon />
      </span>
      <span className={cn("truncate", tamano === "lg" && "text-lg")}>{NOMBRE_APP}</span>
    </span>
  )
}
