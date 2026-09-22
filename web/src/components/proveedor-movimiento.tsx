"use client"

import { LazyMotion, MotionConfig, domMax } from "motion/react"

// motion solo se usa en islas cliente (nav, pestañas, métricas) con `m.*`; las tablas y páginas
// siguen siendo server components. domMax hace falta por las animaciones con layoutId.
export function ProveedorMovimiento({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
