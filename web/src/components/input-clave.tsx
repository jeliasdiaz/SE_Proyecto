"use client"

import { useState } from "react"
import { AnimatePresence, m } from "motion/react"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Contraseña con botón para mostrarla. aria-pressed comunica el estado; la etiqueta no cambia.
export function InputClave({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label="Mostrar contraseña"
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={visible ? "ocultar" : "mostrar"}
            className="grid"
            initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
            transition={{ duration: 0.15 }}
          >
            {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
          </m.span>
        </AnimatePresence>
      </button>
    </div>
  )
}
