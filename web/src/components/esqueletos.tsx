import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// Siluetas de carga para los loading.tsx. Calcan el layout final (mismo grid y breakpoints) para que
// al llegar el contenido nada salte de lugar.

function Encabezado({ conVolver = false }: { conVolver?: boolean }) {
  return (
    <div className="grid gap-2">
      {conVolver && <Skeleton className="h-4 w-24" />}
      <Skeleton className="h-7 w-3/4 sm:h-8 sm:w-1/2" />
      <Skeleton className="h-4 w-2/3 sm:w-1/3" />
    </div>
  )
}

function TarjetaTexto({ lineas = 3 }: { lineas?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="grid gap-2">
        {Array.from({ length: lineas }, (_, i) => (
          <Skeleton key={i} className={i === lineas - 1 ? "h-4 w-2/3" : "h-4 w-full"} />
        ))}
      </CardContent>
    </Card>
  )
}

export function EsqueletoLista() {
  return (
    <div className="grid gap-6" aria-busy aria-label="Cargando">
      <Encabezado />
      <Card className="gap-0 py-0">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-6 border-b px-4 py-3 last:border-0">
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-3/5 md:w-2/5" />
              <Skeleton className="h-3 w-2/5 md:w-1/4" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
          </div>
        ))}
      </Card>
    </div>
  )
}

// Detalle: una columna en móvil; desde lg, contenido (2/3) y panel lateral (1/3).
export function EsqueletoDetalle() {
  return (
    <div className="grid gap-6" aria-busy aria-label="Cargando">
      <Encabezado conVolver />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <TarjetaTexto lineas={5} />
          <TarjetaTexto lineas={4} />
        </div>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="grid gap-3">
              <Skeleton className="h-10 w-full md:h-8" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full md:h-8" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function EsqueletoFormulario() {
  return (
    <Card className="mx-auto w-full max-w-2xl" aria-busy aria-label="Cargando">
      <CardHeader className="gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full sm:w-3/4" />
      </CardHeader>
      <CardContent className="grid gap-5">
        {[10, 10, 40, 10].map((alto, i) => (
          <div key={i} className="grid gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className={alto === 40 ? "h-40 w-full" : "h-10 w-full md:h-8"} />
          </div>
        ))}
        <Skeleton className="h-11 w-full sm:ml-auto sm:w-44 md:h-9" />
      </CardContent>
    </Card>
  )
}

export function EsqueletoMetricas() {
  return (
    <div className="grid gap-6" aria-busy aria-label="Cargando">
      <Encabezado />
      <Card>
        <CardContent className="grid gap-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
            <div className="col-span-2 grid gap-2 sm:col-span-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-16" />
            </div>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-12" />
              </div>
            ))}
          </div>
          <Skeleton className="h-3 w-full" />
        </CardContent>
      </Card>
      <TarjetaTexto lineas={6} />
    </div>
  )
}
