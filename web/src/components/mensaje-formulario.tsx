import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function MensajeFormulario({ ok, mensaje }: { ok?: boolean; mensaje?: string }) {
  if (!mensaje) return null
  return (
    <Alert variant={ok ? "default" : "destructive"}>
      {ok ? <CircleCheckIcon className="text-emerald-600" /> : <CircleAlertIcon />}
      <AlertDescription>{mensaje}</AlertDescription>
    </Alert>
  )
}
