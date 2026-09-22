"use client"

import { useActionState } from "react"
import { Campo } from "@/components/campo"
import { InputClave } from "@/components/input-clave"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import type { EstadoFormulario } from "@/lib/validacion"
import { registrarse } from "../actions"

export function FormularioRegistro() {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(registrarse, {})

  if (estado.ok) return <MensajeFormulario ok mensaje={estado.mensaje} />

  return (
    <form action={enviar} className="grid gap-4" noValidate>
      <MensajeFormulario mensaje={estado.mensaje} />
      <Campo id="nombre" etiqueta="Nombre completo" errores={estado.errores?.nombre}>
        <Input
          id="nombre"
          name="nombre"
          autoComplete="name"
          required
          defaultValue={estado.valores?.nombre}
          aria-invalid={Boolean(estado.errores?.nombre)}
          aria-describedby="nombre-mensaje"
        />
      </Campo>
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
      <Campo id="idEstudiantil" etiqueta="ID estudiantil" errores={estado.errores?.idEstudiantil}>
        <Input
          id="idEstudiantil"
          name="idEstudiantil"
          inputMode="numeric"
          required
          defaultValue={estado.valores?.idEstudiantil}
          aria-invalid={Boolean(estado.errores?.idEstudiantil)}
          aria-describedby="idEstudiantil-mensaje"
        />
      </Campo>
      <Campo
        id="clave"
        etiqueta="Contraseña"
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
        {enviando ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  )
}
