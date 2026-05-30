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

// Tons à fort contraste : fond saturé + texte très foncé (clair) / très clair (sombre).
const TONES: Record<CardTone, string> = {
  neutral: "bg-surface border-border text-foreground",
  blue: "bg-sky-100 border-sky-400 text-sky-950 dark:bg-sky-500/25 dark:border-sky-400/60 dark:text-sky-50",
  red: "bg-rose-100 border-rose-400 text-rose-950 dark:bg-rose-500/25 dark:border-rose-500/60 dark:text-rose-50",
  green: "bg-emerald-100 border-emerald-400 text-emerald-950 dark:bg-emerald-500/25 dark:border-emerald-400/60 dark:text-emerald-50",
  amber: "bg-amber-100 border-amber-400 text-amber-950 dark:bg-amber-500/25 dark:border-amber-400/60 dark:text-amber-50",
  violet: "bg-violet-100 border-violet-400 text-violet-950 dark:bg-violet-500/25 dark:border-violet-400/60 dark:text-violet-50",
  slate: "bg-slate-200 border-slate-400 text-slate-950 dark:bg-slate-500/30 dark:border-slate-400/60 dark:text-slate-50",
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
        <span className="text-[11px] font-extrabold uppercase tracking-wide opacity-90">{title}</span>
      )}
      {icon && <span className={`leading-none ${ICON_SIZE[size]}`}>{icon}</span>}
      {children}
      {subtitle && <span className="text-xs font-extrabold leading-tight">{subtitle}</span>}
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
