import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type CampoProps = {
  id: string
  etiqueta: string
  errores?: string[]
  ayuda?: string
  // Enlace o botón alineado a la derecha de la etiqueta (p. ej. "¿Olvidaste tu contraseña?").
  accion?: React.ReactNode
  children: React.ReactNode
}

// Etiqueta + control + ayuda/errores. El control debe llevar aria-describedby={`${id}-mensaje`}.
export function Campo({ id, etiqueta, errores, ayuda, accion, children }: CampoProps) {
  const hayErrores = Boolean(errores?.length)
  const mensaje = (
    <div id={`${id}-mensaje`} aria-live="polite" className={cn(accion && "col-span-2")}>
      {hayErrores
        ? errores!.map((error) => (
            <p key={error} className="text-xs text-destructive">
              {error}
            </p>
          ))
        : ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
    </div>
  )

  if (!accion) {
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{etiqueta}</Label>
        {children}
        {mensaje}
      </div>
    )
  }

  // La acción se ve junto a la etiqueta pero va después del control en el DOM: el Tab pasa del
  // campo anterior a este control, no al enlace.
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5">
      <Label htmlFor={id} className="row-start-1">
        {etiqueta}
      </Label>
      <div className="col-span-2 row-start-2">{children}</div>
      <div className="col-start-2 row-start-1">{accion}</div>
      {mensaje}
    </div>
  )
}
