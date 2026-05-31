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

// Tons à fort contraste : fond pleinement saturé + texte blanc + contour sombre.
// Le contour (`.text-outline`) est appliqué aux libellés pour rester lisibles
// sur les fonds colorés.
const TONES: Record<CardTone, string> = {
  neutral: "bg-surface border-border text-foreground",
  blue: "bg-sky-500 border-sky-700 text-white dark:bg-sky-600",
  red: "bg-rose-500 border-rose-700 text-white dark:bg-rose-600",
  green: "bg-emerald-500 border-emerald-700 text-white dark:bg-emerald-600",
  amber: "bg-amber-500 border-amber-700 text-white dark:bg-amber-600",
  violet: "bg-violet-500 border-violet-700 text-white dark:bg-violet-600",
  slate: "bg-slate-600 border-slate-800 text-white dark:bg-slate-700",
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
  // Sur les fonds colorés, on rajoute un contour sombre sur les textes — la
  // carte neutre garde un rendu normal (texte foncé déjà lisible).
  const textCls = tone === "neutral" ? "" : "text-outline";

  const content = (
    <>
      {title && (
        <span className={`text-[11px] font-extrabold uppercase tracking-wide opacity-95 ${textCls}`}>
          {title}
        </span>
      )}
      {icon && <span className={`leading-none ${ICON_SIZE[size]}`}>{icon}</span>}
      {children}
      {subtitle && (
        <span className={`text-xs font-extrabold leading-tight ${textCls}`}>{subtitle}</span>
      )}
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
