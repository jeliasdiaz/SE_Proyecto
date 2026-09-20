"use client"

import { useActionState } from "react"
import { Campo } from "@/components/campo"
import { MensajeFormulario } from "@/components/mensaje-formulario"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  ADJUNTO_TAMANO_MAXIMO,
  ADJUNTO_TIPOS_PERMITIDOS,
  ETIQUETA_TIPO,
  nombreArchivoSeguro,
  TIPOS,
} from "@/lib/dominio"
import { createClient } from "@/lib/supabase/client"
import { erroresDe, esquemaSolicitud, valoresDe, type EstadoFormulario } from "@/lib/validacion"
import { crearSolicitud } from "../actions"

function errorDeArchivo(archivo: FormDataEntryValue | null): string | null {
  if (!(archivo instanceof File) || archivo.size === 0) return null
  if (!ADJUNTO_TIPOS_PERMITIDOS.includes(archivo.type)) return "Solo se aceptan archivos PDF, JPG o PNG."
  if (archivo.size > ADJUNTO_TAMANO_MAXIMO) return "El archivo supera el máximo de 10 MB."
  return null
}

export function FormularioSolicitud({ estudianteId }: { estudianteId: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoFormulario, FormData>(async (_previo, formData) => {
    const valores = valoresDe(formData, ["tipo", "asunto", "descripcion"])
    const datos = esquemaSolicitud.safeParse(valores)
    const archivo = formData.get("adjunto")
    const problemaArchivo = errorDeArchivo(archivo)

    if (!datos.success || problemaArchivo) {
      return {
        errores: {
          ...(datos.success ? {} : erroresDe(datos.error)),
          ...(problemaArchivo ? { adjunto: [problemaArchivo] } : {}),
        },
        valores,
      }
    }

    // Primero el archivo, luego la fila: el INSERT dispara el aviso de registro (F1).
    const id = crypto.randomUUID()
    let adjuntoPath: string | null = null
    if (archivo instanceof File && archivo.size > 0) {
      const ruta = `${estudianteId}/${id}/${nombreArchivoSeguro(archivo.name)}`
      const { error } = await createClient()
        .storage.from("adjuntos")
        .upload(ruta, archivo, { contentType: archivo.type, upsert: false })
      if (error) {
        return { mensaje: "No pudimos subir el adjunto. Vuelve a seleccionarlo e inténtalo de nuevo.", valores }
      }
      adjuntoPath = ruta
    }

    const resultado = await crearSolicitud({ id, ...datos.data, adjuntoPath })
    return { ...resultado, valores }
  }, {})

  return (
    <form action={enviar} className="grid gap-5" noValidate>
      <MensajeFormulario mensaje={estado.mensaje} />
      <Campo id="tipo" etiqueta="Tipo de solicitud" errores={estado.errores?.tipo}>
        <NativeSelect
          id="tipo"
          name="tipo"
          required
          defaultValue={estado.valores?.tipo ?? ""}
          className="w-full"
          aria-invalid={Boolean(estado.errores?.tipo)}
          aria-describedby="tipo-mensaje"
        >
          <NativeSelectOption value="" disabled>
            Elige una opción
          </NativeSelectOption>
          {TIPOS.map((tipo) => (
            <NativeSelectOption key={tipo} value={tipo}>
              {ETIQUETA_TIPO[tipo]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Campo>
      <Campo id="asunto" etiqueta="Asunto" errores={estado.errores?.asunto}>
        <Input
          id="asunto"
          name="asunto"
          required
          maxLength={150}
          placeholder="Ej.: Supletorio del parcial 2 de Bases de Datos"
          defaultValue={estado.valores?.asunto}
          aria-invalid={Boolean(estado.errores?.asunto)}
          aria-describedby="asunto-mensaje"
        />
      </Campo>
      <Campo
        id="descripcion"
        etiqueta="Descripción"
        errores={estado.errores?.descripcion}
        ayuda="Explica qué pides y por qué. Incluye asignaturas, fechas y cualquier dato que ayude a resolverla."
      >
        <Textarea
          id="descripcion"
          name="descripcion"
          required
          rows={7}
          maxLength={5000}
          defaultValue={estado.valores?.descripcion}
          aria-invalid={Boolean(estado.errores?.descripcion)}
          aria-describedby="descripcion-mensaje"
        />
      </Campo>
      <Campo
        id="adjunto"
        etiqueta="Adjunto (opcional)"
        errores={estado.errores?.adjunto}
        ayuda="PDF, JPG o PNG de hasta 10 MB: certificados, constancias o soportes."
      >
        <Input
          id="adjunto"
          name="adjunto"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          aria-invalid={Boolean(estado.errores?.adjunto)}
          aria-describedby="adjunto-mensaje"
        />
      </Campo>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar solicitud"}
        </Button>
      </div>
    </form>
  )
}
