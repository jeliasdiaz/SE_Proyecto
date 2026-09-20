"use client"

import { useTransition } from "react"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { obtenerUrlAdjunto } from "@/lib/adjuntos"

export function DescargarAdjunto({ solicitudId, nombre }: { solicitudId: string; nombre: string }) {
  const [cargando, iniciar] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={cargando}
      onClick={() =>
        iniciar(async () => {
          const resultado = await obtenerUrlAdjunto(solicitudId)
          if ("url" in resultado) window.location.assign(resultado.url)
          else toast.error(resultado.error)
        })
      }
    >
      <DownloadIcon data-icon="inline-start" />
      <span className="max-w-60 truncate">{cargando ? "Preparando…" : nombre}</span>
    </Button>
  )
}
