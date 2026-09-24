"use client"

import { useTransition } from "react"
import { HandIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { tomarSolicitud } from "./solicitudes/[id]/actions"

// El resultado va en un toast: al revalidar, el botón desaparece y en su lugar queda el responsable.
export function BotonTomar({ solicitudId, className }: { solicitudId: string; className?: string }) {
  const [tomando, iniciar] = useTransition()

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={tomando}
      className={className}
      onClick={() =>
        iniciar(async () => {
          const resultado = await tomarSolicitud(solicitudId)
          if (resultado.ok) toast.success(resultado.mensaje)
          else toast.error(resultado.mensaje)
        })
      }
    >
      {tomando ? <Spinner data-icon="inline-start" /> : <HandIcon data-icon="inline-start" />}
      {tomando ? "Tomando…" : "Tomar"}
    </Button>
  )
}
