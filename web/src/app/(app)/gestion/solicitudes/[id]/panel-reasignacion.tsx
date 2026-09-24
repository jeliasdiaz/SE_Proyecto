"use client"

import { useActionState } from "react"
import { Campo } from "@/components/campo"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { ETIQUETA_ROL, type Rol } from "@/lib/dominio"
import type { EstadoFormulario } from "@/lib/validacion"
import { reasignarSolicitud } from "./actions"

export type Candidato = { id: string; nombre: string; rol: Rol }

type Props = { solicitudId: string; responsableActual: string | null; candidatos: Candidato[] }

// Solo el admin: el trigger rechaza la reasignación que intente un asesor.
export function PanelReasignacion({ solicitudId, responsableActual, candidatos }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    reasignarSolicitud.bind(null, solicitudId),
    {}
  )

  return (
    <form action={enviar} className="grid gap-3" noValidate>
      <MensajeFormulario ok={estado.ok} mensaje={estado.mensaje} />
      <Campo id="responsable" etiqueta="Reasignar a" errores={estado.errores?.responsable}>
        {/* key: tras reasignar, el select vuelve a partir del responsable nuevo. */}
        <NativeSelect
          key={responsableActual ?? "libre"}
          id="responsable"
          name="responsable"
          defaultValue={estado.ok ? (responsableActual ?? "") : (estado.valores?.responsable ?? responsableActual ?? "")}
          className="w-full"
          aria-describedby="responsable-mensaje"
        >
          <NativeSelectOption value="">Sin asignar</NativeSelectOption>
          {candidatos.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.nombre} · {ETIQUETA_ROL[c.rol]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Campo>
      <Button type="submit" variant="outline" disabled={enviando}>
        {enviando && <Spinner data-icon="inline-start" />}
        {enviando ? "Guardando…" : "Reasignar"}
      </Button>
    </form>
  )
}
