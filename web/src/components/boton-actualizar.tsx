"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Vuelve a pedir los datos de la página sin recargarla. Los estados cambian desde otra sesión
// (el admin) o desde n8n, y la interfaz no escucha cambios en tiempo real.
// En móvil queda solo el ícono (el texto sigue disponible para lectores de pantalla).
export function BotonActualizar({ className }: { className?: string }) {
  const router = useRouter()
  const [actualizando, iniciar] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      disabled={actualizando}
      onClick={() => iniciar(() => router.refresh())}
      className={className}
    >
      <RefreshCwIcon data-icon="inline-start" className={cn(actualizando && "animate-spin")} />
      <span className="sr-only sm:not-sr-only">{actualizando ? "Actualizando…" : "Actualizar"}</span>
    </Button>
  )
}
