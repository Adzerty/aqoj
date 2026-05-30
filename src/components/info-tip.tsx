"use client";

import { useRef, useState, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// InfoTip — affiche une bulle d'info au SURVOL (desktop) ou à l'APPUI LONG (mobile).
// L'appui long n'enclenche PAS le clic de l'élément enveloppé (ex. jouer une carte) :
// la bulle s'affiche tant qu'on reste appuyé, et le clic suivant est neutralisé.
// Réutilisable pour cartes, personnages, etc.
// ─────────────────────────────────────────────────────────────────────────────

export function InfoTip({
  content,
  children,
  className = "",
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const longPress = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHold = () => {
    timer.current = setTimeout(() => {
      longPress.current = true;
      setOpen(true);
    }, 320);
  };
  const endHold = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  if (!content) return <>{children}</>;

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onTouchStart={startHold}
      onTouchEnd={endHold}
      onTouchMove={endHold}
      onTouchCancel={endHold}
      onClickCapture={(e) => {
        // Après un appui long, on neutralise le clic (pour ne pas jouer la carte).
        if (longPress.current) {
          e.preventDefault();
          e.stopPropagation();
          longPress.current = false;
        }
      }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[230px] -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs font-medium leading-snug text-foreground shadow-lg shadow-black/15"
        >
          {content}
        </span>
      )}
    </span>
  );
}
