"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center",
  {
    variants: {
      variant: {
        // Apple style: no background, underline indicator
        default: "gap-0 bg-transparent",
        // Apple style: pill variant
        pill: "gap-1 bg-[var(--color-canvas-parchment)] p-[3px] rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Base styles
        "relative inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-[17px] font-normal whitespace-nowrap text-[var(--color-ink-muted-48)] transition-all",
        // Hover
        "hover:text-[var(--color-ink)]",
        // Focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus)] focus-visible:ring-offset-2",
        // Disabled
        "disabled:pointer-events-none disabled:opacity-50",
        // Active state - Apple style underline
        "data-active:text-[var(--color-ink)] data-active:font-semibold",
        // Underline indicator for default variant
        "after:absolute after:bg-transparent after:transition-all",
        "data-[variant=default]:after:inset-x-0 after:bottom-0 after:h-0.5 data-[variant=default]:data-active:after:bg-[var(--color-ink)]",
        // Pill indicator for pill variant
        "data-[variant=pill]:rounded-full data-[variant=pill]:data-active:bg-[var(--color-canvas)] data-[variant=pill]:data-active:shadow-sm",
        // Icons
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-[17px] text-[var(--color-ink)] outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
