"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Campo } from "@/components/campo"
import { InputClave } from "@/components/input-clave"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
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
          autoFocus
          required
          defaultValue={estado.valores?.correo}
          aria-invalid={Boolean(estado.errores?.correo)}
          aria-describedby="correo-mensaje"
        />
      </Campo>
      <Campo
        id="clave"
        etiqueta="Contraseña"
        errores={estado.errores?.clave}
        accion={
          <Link
            href="/recuperar"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        }
      >
        <InputClave
          id="clave"
          name="clave"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(estado.errores?.clave)}
          aria-describedby="clave-mensaje"
        />
      </Campo>
      <Button type="submit" size="lg" disabled={enviando}>
        {enviando && <Spinner data-icon="inline-start" />}
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  )
}
