"use client"

import { useActionState } from "react"
import { Campo } from "@/components/campo"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { EstadoFormulario } from "@/lib/validacion"
import { iniciarSesion } from "../actions"

type Props = {
  next: string
  aviso?: { ok: boolean; mensaje: string }
}

export function FormularioLogin({ next, aviso }: Props) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(iniciarSesion, {})
  const mensaje = estado.mensaje ? estado : aviso

  return (
    <form action={enviar} className="grid gap-4" noValidate>
      <MensajeFormulario ok={mensaje?.ok} mensaje={mensaje?.mensaje} />
      <input type="hidden" name="next" value={next} />
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
      <Campo id="clave" etiqueta="Contraseña" errores={estado.errores?.clave}>
        <Input
          id="clave"
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(estado.errores?.clave)}
          aria-describedby="clave-mensaje"
        />
      </Campo>
      <Button type="submit" size="lg" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  )
}
