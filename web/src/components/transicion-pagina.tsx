import { ViewTransition } from "react"

const DIRECCION = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }

// Desliza la página según la dirección del enlace (Link transitionTypes={["nav-forward" | "nav-back"]}).
// Va en cada page.tsx, no en el layout: el layout persiste entre navegaciones y nunca entra ni sale.
// Sin tipo (botón atrás del navegador, filtros, router.refresh) no anima: la página se vuelve a
// montar con cada cambio de searchParams y una entrada animada ahí sería ruido.
export function TransicionPagina({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={DIRECCION} exit={DIRECCION} default="none">
      {children}
    </ViewTransition>
  )
}
