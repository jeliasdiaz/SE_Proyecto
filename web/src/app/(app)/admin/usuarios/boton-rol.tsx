"use client"

import { useTransition } from "react"
import { UserMinusIcon, UserPlusIcon } from "lucide-react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cambiarRol } from "./actions"

type Props = { usuarioId: string; nombre: string; accion: "promover" | "degradar"; onHecho?: () => void }

export function BotonRol({ usuarioId, nombre, accion, onHecho }: Props) {
  const [guardando, iniciar] = useTransition()
  const promover = accion === "promover"

  const aplicar = () =>
    iniciar(async () => {
      const resultado = await cambiarRol(usuarioId, promover ? "asesor" : "estudiante")
      if (resultado.ok) {
        toast.success(`${nombre} ${resultado.mensaje}`)
        onHecho?.()
      } else {
        toast.error(resultado.mensaje)
      }
    })

  const icono = guardando ? <Spinner data-icon="inline-start" /> : null

  // Promover no quita nada: va directo. Quitar el rol le cierra la bandeja: se confirma.
  if (promover) {
    return (
      <Button type="button" size="sm" disabled={guardando} onClick={aplicar}>
        {icono ?? <UserPlusIcon data-icon="inline-start" />}
        Hacer asesor
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={guardando}>
          {icono ?? <UserMinusIcon data-icon="inline-start" />}
          Quitar rol
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Quitarle el rol de asesor a {nombre}?</AlertDialogTitle>
          <AlertDialogDescription>
            Dejará de ver la bandeja y volverá a entrar como estudiante. Los casos que ya atendió conservan su nombre en
            el historial. Puedes volver a darle el rol cuando quieras.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={aplicar}>
            Quitar rol
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
