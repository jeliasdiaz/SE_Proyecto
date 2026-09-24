"use client"

import { useTransition } from "react"
import { UserMinusIcon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cambiarRol } from "./actions"

type Props = { usuarioId: string; nombre: string; accion: "promover" | "degradar" }

export function BotonRol({ usuarioId, nombre, accion }: Props) {
  const [guardando, iniciar] = useTransition()
  const promover = accion === "promover"
  const Icono = promover ? UserPlusIcon : UserMinusIcon

  return (
    <Button
      type="button"
      size="sm"
      variant={promover ? "default" : "outline"}
      disabled={guardando}
      onClick={() => {
        // Quitar el rol le cierra la bandeja de inmediato: se confirma.
        if (!promover && !window.confirm(`¿Quitarle el rol de asesor a ${nombre}?`)) return
        iniciar(async () => {
          const resultado = await cambiarRol(usuarioId, promover ? "asesor" : "estudiante")
          if (resultado.ok) toast.success(`${nombre}: ${resultado.mensaje}`)
          else toast.error(resultado.mensaje)
        })
      }}
    >
      {guardando ? <Spinner data-icon="inline-start" /> : <Icono data-icon="inline-start" />}
      {promover ? "Hacer asesor" : "Quitar rol"}
    </Button>
  )
}
