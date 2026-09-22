"use client"

import { useActionState } from "react"
import { Campo } from "@/components/campo"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { ETIQUETA_TIPO, TIPOS, type Tipo } from "@/lib/dominio"
import type { EstadoFormulario } from "@/lib/validacion"
import { clasificarSolicitud } from "./actions"

type Props = { solicitudId: string; tipoActual: Tipo; porRevisar: boolean }

export function PanelClasificacion({ solicitudId, tipoActual, porRevisar }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    clasificarSolicitud.bind(null, solicitudId),
    {}
  )

  return (
    <form action={enviar} className="grid gap-4" noValidate>
      <MensajeFormulario ok={estado.ok} mensaje={estado.mensaje} />
      <Campo id="tipo" etiqueta="Tipo de solicitud" errores={estado.errores?.tipo}>
        <NativeSelect
          id="tipo"
          name="tipo"
          defaultValue={estado.valores?.tipo ?? tipoActual}
          className="w-full"
          aria-describedby="tipo-mensaje"
        >
          {TIPOS.map((tipo) => (
            <NativeSelectOption key={tipo} value={tipo}>
              {ETIQUETA_TIPO[tipo]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Campo>
      <Button type="submit" variant={porRevisar ? "default" : "outline"} disabled={enviando}>
        {enviando && <Spinner data-icon="inline-start" />}
        {enviando ? "Guardando…" : porRevisar ? "Confirmar tipo y marcar revisada" : "Guardar tipo"}
      </Button>
    </form>
  )
}
