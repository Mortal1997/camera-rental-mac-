import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] focus-visible:ring-offset-2 active:scale-[0.95] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary Pill - The signature Apple action
        default: "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[#0055aa] aria-invalid:bg-destructive aria-invalid:text-destructive-foreground",
        // Secondary Pill - Ghost variant
        secondary: "border border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-primary)]/5",
        // Dark Utility - For global nav actions
        dark: "bg-[var(--color-ink)] text-[var(--color-body-on-dark)] hover:bg-[#333333]",
        // Pearl Capsule - Secondary button
        pearl: "bg-[var(--color-surface-pearl)] text-[var(--color-ink-muted-80)] border-[3px_solid_var(--color-divider-soft)] hover:bg-[#f0f0f2]",
        // Store Hero - Larger primary CTA
        "store-hero": "bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[18px] font-light hover:bg-[#0055aa]",
        // Icon Circular - Floats over photography
        "icon-circular": "w-11 h-11 rounded-full bg-[rgba(210,210,215,0.64)] text-[var(--color-ink)] hover:bg-[rgba(210,210,215,0.8)]",
        // Outline variant
        outline: "border border-input bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        // Ghost variant
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // Destructive
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20",
        // Link
        link: "text-[var(--color-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-6 text-[17px] font-normal",
        sm: "h-9 gap-1.5 px-5 text-[14px]",
        lg: "h-12 gap-2 px-8 text-[18px]",
        xl: "h-14 gap-2 px-10 text-[18px]",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
