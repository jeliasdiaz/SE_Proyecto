"use client"

import { useState, useTransition } from "react"
import { Undo2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { retirarSolicitud } from "../actions"

// Confirmación en dos pasos dentro de la tarjeta: retirar no se puede deshacer. El aviso de
// éxito va en un toast porque, al revalidar, la página deja de mostrar este panel.
export function PanelRetiro({ solicitudId }: { solicitudId: string }) {
  const [confirmando, setConfirmando] = useState(false)
  const [retirando, iniciar] = useTransition()

  if (!confirmando) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Mientras siga pendiente puedes retirarla si ya no necesitas el trámite.
        </p>
        <Button type="button" variant="outline" className="w-full sm:w-fit" onClick={() => setConfirmando(true)}>
          <Undo2Icon data-icon="inline-start" />
          Retirar solicitud
        </Button>
      </div>
    )
  }

  return (
    <div role="group" aria-labelledby="retiro-titulo" className="grid gap-3">
      <p id="retiro-titulo" className="text-sm">
        <strong>¿Retirar esta solicitud?</strong> La coordinación ya no la tramitará y no se puede deshacer. Si
        cambias de opinión, tendrás que registrar una nueva.
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" disabled={retirando} onClick={() => setConfirmando(false)}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={retirando}
          onClick={() =>
            iniciar(async () => {
              const resultado = await retirarSolicitud(solicitudId)
              if ("ok" in resultado) toast.success("Retiraste la solicitud.")
              else {
                toast.error(resultado.error)
                setConfirmando(false)
              }
            })
          }
        >
          {retirando && <Spinner data-icon="inline-start" />}
          {retirando ? "Retirando…" : "Sí, retirar"}
        </Button>
      </div>
    </div>
  )
}
