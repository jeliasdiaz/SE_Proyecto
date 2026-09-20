import { Label } from "@/components/ui/label"

type CampoProps = {
  id: string
  etiqueta: string
  errores?: string[]
  ayuda?: string
  children: React.ReactNode
}

// Etiqueta + control + ayuda/errores. El control debe llevar aria-describedby={`${id}-mensaje`}.
export function Campo({ id, etiqueta, errores, ayuda, children }: CampoProps) {
  const hayErrores = Boolean(errores?.length)
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      <div id={`${id}-mensaje`} aria-live="polite">
        {hayErrores
          ? errores!.map((error) => (
              <p key={error} className="text-xs text-destructive">
                {error}
              </p>
            ))
          : ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      </div>
    </div>
  )
}
