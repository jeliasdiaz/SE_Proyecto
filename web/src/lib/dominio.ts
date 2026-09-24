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
  retirada: "Retirada",
}

export const ESTADOS = Object.keys(ETIQUETA_ESTADO) as Estado[]

export const ETIQUETA_ROL: Record<Rol, string> = {
  estudiante: "Estudiante",
  asesor: "Asesoría",
  admin: "Administración",
}

// Personal de la coordinación: atiende la bandeja. Espejo de es_personal() en la base de datos.
export const ROLES_PERSONAL = ["asesor", "admin"] as const satisfies readonly Rol[]

export function esPersonal(rol: Rol): boolean {
  return (ROLES_PERSONAL as readonly Rol[]).includes(rol)
}

// Espejo de validar_cambio_solicitud() en la base de datos. Aquí solo sirve para mostrar
// las opciones válidas; quien decide es el trigger. El estudiante solo puede pasar su solicitud
// de pendiente a retirada.
export const TRANSICIONES: Record<Estado, readonly Estado[]> = {
  pendiente: ["en_proceso", "rechazada", "retirada"],
  en_proceso: ["finalizada", "rechazada", "retirada"],
  finalizada: [],
  rechazada: [],
  retirada: [],
}

// Reabrir un caso finalizado o rechazado es exclusivo del admin. Un retiro no se reabre: lo
// decidió el estudiante.
export function esReapertura(de: Estado, a: Estado): boolean {
  return (de === "finalizada" || de === "rechazada") && a === "en_proceso"
}

export function transicionesPara(estado: Estado, rol: Rol): readonly Estado[] {
  if (rol === "admin" && esReapertura(estado, "en_proceso")) return ["en_proceso"]
  return TRANSICIONES[estado]
}

// Solo para la coordinación: el retiro que hace el estudiante no lleva observación.
export function exigeObservacion(de: Estado, a: Estado): boolean {
  return a === "rechazada" || a === "retirada" || esReapertura(de, a)
}

// Espejo de dias_recordatorio() en la base de datos: días sin cambios para considerar un caso
// estancado (la vista solicitudes_estancadas y el recordatorio F3 usan el mismo umbral).
export const DIAS_RECORDATORIO = 3

// No depende de TRANSICIONES: un caso cerrado sigue cerrado aunque el admin pueda reabrirlo.
export function estaAbierta(estado: Estado): boolean {
  return estado === "pendiente" || estado === "en_proceso"
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
