import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function MensajeFormulario({ ok, mensaje }: { ok?: boolean; mensaje?: string }) {
  if (!mensaje) return null
  return (
    // key: un mensaje nuevo vuelve a entrar animado, así se nota aunque reemplace a otro.
    <Alert
      key={mensaje}
      variant={ok ? "default" : "destructive"}
      className="animate-in duration-200 fade-in slide-in-from-top-1"
    >
      {ok ? <CircleCheckIcon className="text-emerald-600" /> : <CircleAlertIcon />}
      <AlertDescription>{mensaje}</AlertDescription>
    </Alert>
  )
}
