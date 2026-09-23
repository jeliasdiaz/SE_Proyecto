"use client"

import { useActionState, useState } from "react"
import { ArrowRightIcon, LockKeyholeIcon } from "lucide-react"
import { Campo } from "@/components/campo"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { EstadoBadge } from "@/components/estado-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { ETIQUETA_ESTADO, TRANSICIONES, exigeObservacion, type Estado } from "@/lib/dominio"
import type { EstadoFormulario } from "@/lib/validacion"
import { cambiarEstado } from "./actions"

const ESTILO_PANEL: Record<Estado, string> = {
  pendiente: "border-amber-200 bg-amber-50/70",
  en_proceso: "border-sky-200 bg-sky-50/70",
  finalizada: "border-emerald-200 bg-emerald-50/70",
  rechazada: "border-rose-200 bg-rose-50/70",
}

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
        <Alert className={ESTILO_PANEL[estadoActual]}>
          <LockKeyholeIcon />
          <AlertTitle>Solicitud cerrada</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-1.5 text-foreground/70">
            Este caso está {ETIQUETA_ESTADO[estadoActual].toLowerCase()} y ya no admite cambios de estado.
            <EstadoBadge estado={estadoActual} />
          </AlertDescription>
        </Alert>
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
      <div className={`rounded-lg border p-3 ${ESTILO_PANEL[estadoActual]}`}>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Estado actual</p>
        <EstadoBadge estado={estadoActual} />
      </div>
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
      {destino && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Pasará a</span>
          <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <EstadoBadge estado={destino} />
        </div>
      )}
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
