import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg hover:brightness-[1.06] border-transparent",
  secondary: "bg-surface text-foreground hover:bg-surface-2 border-border",
  ghost: "bg-transparent text-muted hover:text-foreground hover:bg-surface-2 border-transparent",
  danger: "bg-transparent text-rose-500 hover:bg-rose-500/10 border-transparent",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full border font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

function classes(variant: Variant, size: Size, className?: string) {
  return `${base} ${VARIANTS[variant]} ${SIZES[size]} ${className ?? ""}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={classes(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={classes(variant, size, className)} {...props} />;
}
