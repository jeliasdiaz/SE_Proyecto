import { ViewTransition } from "react"
import { EsqueletoDetalle } from "@/components/esqueletos"

// La silueta sale deslizándose hacia abajo cuando llega el contenido (ver .slide-down en globals.css).
export default function Cargando() {
  return (
    <ViewTransition exit="slide-down" default="none">
      <EsqueletoDetalle />
    </ViewTransition>
  )
}
