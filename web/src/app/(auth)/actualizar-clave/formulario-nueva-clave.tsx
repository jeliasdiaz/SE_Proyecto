"use client"

import { useActionState } from "react"
import { Campo } from "@/components/campo"
import { InputClave } from "@/components/input-clave"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { EstadoFormulario } from "@/lib/validacion"
import { actualizarClave } from "../actions"

export function FormularioNuevaClave() {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(actualizarClave, {})

  return (
    <form action={enviar} className="grid gap-4" noValidate>
      <MensajeFormulario mensaje={estado.mensaje} />
      <Campo
        id="clave"
        etiqueta="Contraseña nueva"
        errores={estado.errores?.clave}
        ayuda="Mínimo 8 caracteres, con letras y números."
      >
        <InputClave
          id="clave"
          name="clave"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(estado.errores?.clave)}
          aria-describedby="clave-mensaje"
        />
      </Campo>
      <Campo id="confirmacion" etiqueta="Repite la contraseña" errores={estado.errores?.confirmacion}>
        <InputClave
          id="confirmacion"
          name="confirmacion"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(estado.errores?.confirmacion)}
          aria-describedby="confirmacion-mensaje"
        />
      </Campo>
      <Button type="submit" size="lg" disabled={enviando}>
        {enviando && <Spinner data-icon="inline-start" />}
        {enviando ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  )
}
