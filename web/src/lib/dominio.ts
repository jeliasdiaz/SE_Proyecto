import type { Enums } from "@/types/database"

export type Estado = Enums<"estado_solicitud">
export type Tipo = Enums<"tipo_solicitud">
export type Origen = Enums<"origen_solicitud">
export type Revision = Enums<"estado_revision">
export type Rol = Enums<"rol_usuario">

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  finalizada: "Finalizada",
  rechazada: "Rechazada",
}

export const ESTADOS = Object.keys(ETIQUETA_ESTADO) as Estado[]

// Espejo de validar_cambio_solicitud() en la base de datos. Aquí solo sirve para mostrar
// las opciones válidas; quien decide es el trigger.
export const TRANSICIONES: Record<Estado, readonly Estado[]> = {
  pendiente: ["en_proceso", "rechazada"],
  en_proceso: ["finalizada", "rechazada"],
  finalizada: [],
  rechazada: [],
}

export function puedeTransicionar(de: Estado, a: Estado): boolean {
  return TRANSICIONES[de].includes(a)
}

export function exigeObservacion(estado: Estado): boolean {
  return estado === "rechazada"
}

export const ETIQUETA_TIPO: Record<Tipo, string> = {
  homologacion: "Homologación",
  cancelacion_extemporanea: "Cancelación extemporánea",
  supletorio: "Supletorio",
  reingreso: "Reingreso",
  comite_curricular: "Solicitud al comité curricular",
  otro: "Otro",
}

export const TIPOS = Object.keys(ETIQUETA_TIPO) as Tipo[]

export const ETIQUETA_ORIGEN: Record<Origen, string> = {
  web: "Web",
  correo: "Correo",
}

export const ORIGENES = Object.keys(ETIQUETA_ORIGEN) as Origen[]

export function esEstado(valor: unknown): valor is Estado {
  return typeof valor === "string" && valor in ETIQUETA_ESTADO
}

export function esTipo(valor: unknown): valor is Tipo {
  return typeof valor === "string" && valor in ETIQUETA_TIPO
}

export function esOrigen(valor: unknown): valor is Origen {
  return typeof valor === "string" && valor in ETIQUETA_ORIGEN
}

// Adjuntos: mismas reglas que el bucket `adjuntos` (supabase/migrations/..._storage.sql).
export const ADJUNTO_TAMANO_MAXIMO = 10 * 1024 * 1024
export const ADJUNTO_TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"]

export function nombreArchivoSeguro(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
  return limpio.slice(-100) || "adjunto"
}
