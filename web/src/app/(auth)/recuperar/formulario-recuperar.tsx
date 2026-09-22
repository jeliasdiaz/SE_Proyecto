"use client"

import { useActionState } from "react"
import { Campo } from "@/components/campo"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { EstadoFormulario } from "@/lib/validacion"
import { solicitarRecuperacion } from "../actions"

export function FormularioRecuperar() {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(solicitarRecuperacion, {})

  if (estado.ok) return <MensajeFormulario ok mensaje={estado.mensaje} />

  return (
    <form action={enviar} className="grid gap-4" noValidate>
      <MensajeFormulario mensaje={estado.mensaje} />
      <Campo id="correo" etiqueta="Correo" errores={estado.errores?.correo}>
        <Input
          id="correo"
          name="correo"
          type="email"
          autoComplete="email"
          required
          defaultValue={estado.valores?.correo}
          aria-invalid={Boolean(estado.errores?.correo)}
          aria-describedby="correo-mensaje"
        />
      </Campo>
      <Button type="submit" size="lg" disabled={enviando}>
        {enviando && <Spinner data-icon="inline-start" />}
        {enviando ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  )
}
