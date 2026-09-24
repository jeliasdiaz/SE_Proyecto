"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

// Cuando otra persona toma o mueve una solicitud, vuelve a pedir la página para que nadie trabaje
// sobre datos viejos. Es solo comodidad: quien impide que dos asesores tomen el mismo caso es la
// base de datos. Realtime respeta RLS, así que solo llegan cambios de filas que el usuario puede ver.
// La espera agrupa ráfagas de cambios (p. ej. un cambio de estado más su historial) en un solo refresco.
export function RefrescoEnVivo({ espera = 800 }: { espera?: number }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let temporizador: ReturnType<typeof setTimeout> | undefined
    const canal = supabase
      .channel("solicitudes-bandeja")
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes" }, () => {
        clearTimeout(temporizador)
        temporizador = setTimeout(() => router.refresh(), espera)
      })
      .subscribe()

    return () => {
      clearTimeout(temporizador)
      void supabase.removeChannel(canal)
    }
  }, [router, espera])

  return null
}
