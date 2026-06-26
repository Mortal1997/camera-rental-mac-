import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Apple pill-style input
        "h-11 w-full min-w-0 rounded-full border border-[rgba(0,0,0,0.08)] bg-[var(--color-canvas)] px-5 py-3",
        "text-[17px] leading-[1.47] tracking-[-0.374px] text-[var(--color-ink)]",
        "transition-colors outline-none",
        "placeholder:text-[var(--color-ink-muted-48)]",
        "focus:border-[var(--color-primary)] focus:ring-[3px] focus:ring-[rgba(0,102,204,0.15)]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-canvas-parchment)]",
        // Legacy
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
