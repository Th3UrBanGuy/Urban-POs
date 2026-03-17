import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-bold tracking-wide ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-[4px] active:shadow-none transform-gpu",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-b from-primary/90 to-primary text-primary-foreground shadow-[0_4px_0_theme(colors.primary.900)] hover:brightness-110",
        destructive:
          "bg-gradient-to-b from-destructive/90 to-destructive text-destructive-foreground shadow-[0_4px_0_theme(colors.destructive.900)] hover:brightness-110",
        outline:
          "border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 shadow-[0_4px_0_theme(colors.slate.300)] dark:shadow-[0_4px_0_theme(colors.slate.950)] hover:bg-slate-100 dark:hover:bg-slate-800",
        secondary:
          "bg-gradient-to-b from-secondary/90 to-secondary text-secondary-foreground shadow-[0_4px_0_theme(colors.secondary.800)] hover:brightness-110",
        ghost: "hover:bg-accent hover:text-accent-foreground active:translate-y-0 active:shadow-none shadow-none",
        link: "text-primary underline-offset-4 hover:underline active:translate-y-0 active:shadow-none shadow-none",
      },
      size: {
        default: "h-11 px-6 py-2 rounded-lg",
        sm: "h-9 rounded-md px-4",
        lg: "h-12 rounded-xl px-8 text-md",
        icon: "h-11 w-11 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
