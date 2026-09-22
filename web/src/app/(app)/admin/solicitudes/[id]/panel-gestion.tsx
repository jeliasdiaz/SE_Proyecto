"use client"

import { useActionState, useState } from "react"
import { Campo } from "@/components/campo"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { ETIQUETA_ESTADO, TRANSICIONES, exigeObservacion, type Estado } from "@/lib/dominio"
import type { EstadoFormulario } from "@/lib/validacion"
import { cambiarEstado } from "./actions"

export function PanelGestion({ solicitudId, estadoActual }: { solicitudId: string; estadoActual: Estado }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(
    cambiarEstado.bind(null, solicitudId),
    {}
  )
  const opciones = TRANSICIONES[estadoActual]
  const [destino, setDestino] = useState<Estado | "">("")

  if (opciones.length === 0) {
    return (
      <div className="grid gap-3">
        <MensajeFormulario ok={estado.ok} mensaje={estado.mensaje} />
        <p className="text-sm text-muted-foreground">
          El caso está {ETIQUETA_ESTADO[estadoActual].toLowerCase()} y ya no admite cambios de estado.
        </p>
      </div>
    )
  }

  const obligatoria = destino !== "" && exigeObservacion(destino)

  return (
    <form
      action={(formData) => {
        enviar(formData)
        setDestino("")
      }}
      className="grid gap-4"
      noValidate
    >
      <MensajeFormulario ok={estado.ok} mensaje={estado.mensaje} />
      <Campo id="estado" etiqueta="Nuevo estado" errores={estado.errores?.estado}>
        <NativeSelect
          id="estado"
          name="estado"
          required
          value={destino}
          onChange={(e) => setDestino(e.target.value as Estado | "")}
          className="w-full"
          aria-describedby="estado-mensaje"
        >
          <NativeSelectOption value="" disabled>
            Elige el siguiente paso
          </NativeSelectOption>
          {opciones.map((opcion) => (
            <NativeSelectOption key={opcion} value={opcion}>
              {ETIQUETA_ESTADO[opcion]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Campo>
      <Campo
        id="observacion"
        etiqueta={obligatoria ? "Motivo del rechazo (obligatorio)" : "Observación para el estudiante (opcional)"}
        errores={estado.errores?.observacion}
        ayuda="La verá el estudiante y se incluye en el correo de aviso."
      >
        <Textarea
          id="observacion"
          name="observacion"
          rows={4}
          maxLength={2000}
          required={obligatoria}
          defaultValue={estado.ok ? "" : estado.valores?.observacion}
          aria-invalid={Boolean(estado.errores?.observacion)}
          aria-describedby="observacion-mensaje"
        />
      </Campo>
      <Button type="submit" disabled={enviando || destino === ""}>
        {enviando && <Spinner data-icon="inline-start" />}
        {enviando ? "Guardando…" : "Cambiar estado"}
      </Button>
    </form>
  )
}
