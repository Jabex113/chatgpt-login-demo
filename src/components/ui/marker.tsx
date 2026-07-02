import * as React from "react"
import { cn } from "@/lib/utils"

export const Marker = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-start text-xs text-muted-foreground", className)}
    {...props}
  />
))
Marker.displayName = "Marker"

export const MarkerContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-1.5 opacity-80", className)}
    {...props}
  />
))
MarkerContent.displayName = "MarkerContent"
