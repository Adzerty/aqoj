"use client";

import type { ReactNode } from "react";
import { DiceMark } from "../icons";

// ─────────────────────────────────────────────────────────────────────────────
// Carte générique réutilisable (jeux de cartes AQOJ).
//
// Une carte = un rectangle arrondi avec un ton de couleur, un titre, une icône
// centrale et un sous-titre. Elle peut être face cachée, sélectionnable, choisie
// ou désactivée. Pensée pour servir : lois, rôles, votes, mains de cartes…
// ─────────────────────────────────────────────────────────────────────────────

export type CardTone =
  | "neutral"
  | "blue"
  | "red"
  | "green"
  | "amber"
  | "violet"
  | "slate";

export type CardSize = "sm" | "md" | "lg";

const TONES: Record<CardTone, string> = {
  neutral: "bg-surface border-border text-foreground",
  blue: "bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-400/10 dark:border-sky-400/40 dark:text-sky-200",
  red: "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-500/10 dark:border-rose-500/40 dark:text-rose-200",
  green: "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-400/10 dark:border-emerald-400/40 dark:text-emerald-200",
  amber: "bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-400/10 dark:border-amber-400/40 dark:text-amber-200",
  violet: "bg-violet-50 border-violet-300 text-violet-900 dark:bg-violet-400/10 dark:border-violet-400/40 dark:text-violet-200",
  slate: "bg-slate-100 border-slate-300 text-slate-900 dark:bg-slate-400/10 dark:border-slate-400/40 dark:text-slate-200",
};

const SIZES: Record<CardSize, string> = {
  sm: "h-24 w-16 gap-1 p-2",
  md: "h-28 w-20 gap-1.5 p-2.5",
  lg: "h-40 w-28 gap-2 p-3",
};

const ICON_SIZE: Record<CardSize, string> = { sm: "text-2xl", md: "text-3xl", lg: "text-4xl" };

export interface CardProps {
  tone?: CardTone;
  size?: CardSize;
  faceDown?: boolean;
  title?: string;
  icon?: ReactNode;
  subtitle?: string;
  children?: ReactNode;
  selectable?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  className?: string;
}

export function Card({
  tone = "neutral",
  size = "md",
  faceDown = false,
  title,
  icon,
  subtitle,
  children,
  selectable = false,
  selected = false,
  disabled = false,
  onSelect,
  className = "",
}: CardProps) {
  const base = `relative flex shrink-0 flex-col items-center justify-center rounded-2xl border text-center shadow-sm transition-all ${SIZES[size]}`;

  if (faceDown) {
    return (
      <div
        className={`${base} items-center justify-center border-border bg-surface-2 text-muted/40 ${className}`}
      >
        <DiceMark size={size === "lg" ? 30 : size === "md" ? 24 : 18} />
      </div>
    );
  }

  const interactive = selectable && !disabled;
  const stateCls = selected
    ? "ring-2 ring-primary ring-offset-2 ring-offset-background -translate-y-1"
    : interactive
      ? "hover:-translate-y-1 cursor-pointer"
      : "";
  const cls = `${base} ${TONES[tone]} ${stateCls} ${disabled ? "opacity-50" : ""} ${className}`;

  const content = (
    <>
      {title && (
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{title}</span>
      )}
      {icon && <span className={`leading-none ${ICON_SIZE[size]}`}>{icon}</span>}
      {children}
      {subtitle && <span className="text-[11px] font-semibold leading-tight">{subtitle}</span>}
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onSelect} disabled={disabled} className={cls}>
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
}

/** Range de cartes (main), centrée et qui passe à la ligne sur petit écran. */
export function CardHand({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>{children}</div>;
}
