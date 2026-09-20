"use client"

import { useActionState } from "react"
import { Campo } from "@/components/campo"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
        <Input
          id="clave"
          name="clave"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(estado.errores?.clave)}
          aria-describedby="clave-mensaje"
        />
      </Campo>
      <Campo id="confirmacion" etiqueta="Repite la contraseña" errores={estado.errores?.confirmacion}>
        <Input
          id="confirmacion"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(estado.errores?.confirmacion)}
          aria-describedby="confirmacion-mensaje"
        />
      </Campo>
      <Button type="submit" size="lg" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  )
}
