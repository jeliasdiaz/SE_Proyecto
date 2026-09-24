"use client"

import { useEffect } from "react"
import { MensajeFormulario } from "@/components/mensaje-formulario"

// Aviso de una sola vez tras crear la solicitud. Quita ?creada=1 de la URL (sin pedir nada al
// servidor) para que recargar la página no lo vuelva a mostrar cuando el caso ya avanzó.
export function AvisoSolicitudCreada() {
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("creada")) return
    url.searchParams.delete("creada")
    window.history.replaceState(null, "", url)
  }, [])

  return <MensajeFormulario ok mensaje="Tu solicitud quedó registrada como Pendiente. Aquí verás cada avance." />
}
