import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

export function MensajeFormulario({ ok, mensaje }: { ok?: boolean; mensaje?: string }) {
  if (!mensaje) return null
  return (
    // key: un mensaje nuevo vuelve a entrar animado, así se nota aunque reemplace a otro.
    <Alert
      key={mensaje}
      variant={ok ? "default" : "destructive"}
      className={cn(
        "animate-in duration-200 fade-in slide-in-from-top-1",
        ok && "border-emerald-200 bg-emerald-50 text-emerald-950"
      )}
    >
      {ok ? <CircleCheckIcon className="text-emerald-600" /> : <CircleAlertIcon />}
      <AlertDescription className={ok ? "text-emerald-900/80" : undefined}>{mensaje}</AlertDescription>
    </Alert>
  )
}
