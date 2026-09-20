import { z } from "zod"
import { ESTADOS, TIPOS } from "@/lib/dominio"

// Esquemas compartidos por los formularios (cliente) y las Server Actions (servidor).
// Son más estrictos que la base de datos, que también recibe datos de n8n.

const correo = z.string().trim().toLowerCase().pipe(z.email("Escribe un correo válido."))

const clave = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres.")
  .regex(/[A-Za-z]/, "La contraseña debe tener al menos una letra.")
  .regex(/[0-9]/, "La contraseña debe tener al menos un número.")

export const esquemaLogin = z.object({
  correo,
  clave: z.string().min(1, "Escribe tu contraseña."),
})

export const esquemaRegistro = z
  .object({
    nombre: z.string().trim().min(2, "Escribe tu nombre completo.").max(120, "Máximo 120 caracteres."),
    correo,
    idEstudiantil: z.string().trim().regex(/^[0-9]{4,12}$/, "El ID estudiantil tiene entre 4 y 12 dígitos."),
    clave,
    confirmacion: z.string(),
  })
  .refine((datos) => datos.clave === datos.confirmacion, {
    path: ["confirmacion"],
    message: "Las contraseñas no coinciden.",
  })

export const esquemaRecuperar = z.object({
  correo,
})

export const esquemaNuevaClave = z
  .object({ clave, confirmacion: z.string() })
  .refine((datos) => datos.clave === datos.confirmacion, {
    path: ["confirmacion"],
    message: "Las contraseñas no coinciden.",
  })

export const esquemaSolicitud = z.object({
  tipo: z.enum(TIPOS, "Elige el tipo de solicitud."),
  asunto: z.string().trim().min(5, "El asunto debe tener al menos 5 caracteres.").max(150, "Máximo 150 caracteres."),
  descripcion: z
    .string()
    .trim()
    .min(20, "Describe tu solicitud con al menos 20 caracteres.")
    .max(5000, "Máximo 5000 caracteres."),
})

export const esquemaNuevaSolicitud = esquemaSolicitud.extend({
  id: z.uuid(),
  adjuntoPath: z.string().max(300).nullable(),
})

export const esquemaCambioEstado = z.object({
  estado: z.enum(ESTADOS, "Elige el nuevo estado."),
  observacion: z.string().trim().max(2000, "Máximo 2000 caracteres."),
})

export const esquemaClasificacion = z.object({
  tipo: z.enum(TIPOS, "Elige el tipo de solicitud."),
})

export type ErroresDeCampo = Record<string, string[] | undefined>

export type EstadoFormulario = {
  ok?: boolean
  mensaje?: string
  errores?: ErroresDeCampo
  valores?: Record<string, string>
}

export function erroresDe(error: z.ZodError): ErroresDeCampo {
  return z.flattenError(error).fieldErrors
}

// Devuelve lo que el usuario escribió para no borrarle el formulario cuando hay errores.
// Nunca devuelve contraseñas.
export function valoresDe(formData: FormData, campos: string[]): Record<string, string> {
  return Object.fromEntries(
    campos.map((campo) => [campo, typeof formData.get(campo) === "string" ? String(formData.get(campo)) : ""])
  )
}
