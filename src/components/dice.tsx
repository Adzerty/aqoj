"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Dé jouable réutilisable. Faces dessinées (pips), animation de lancer, et un
// rendu spécial « Paco » (toucan 🦜) pour la valeur 1. Réutilisable par d'autres
// jeux de dés.
// ─────────────────────────────────────────────────────────────────────────────

// Cases du quadrillage 3×3 (0..8) occupées par un pip selon la valeur.
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({
  value,
  size = 44,
  highlight = false,
  dim = false,
  rolling = false,
  hidden = false,
  delayMs = 0,
}: {
  value?: number;
  size?: number;
  highlight?: boolean;
  dim?: boolean;
  rolling?: boolean;
  hidden?: boolean;
  delayMs?: number;
}) {
  const box = { width: size, height: size };

  if (hidden || value == null) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-lg border-2 border-border bg-surface-2"
        style={box}
        aria-hidden
      >
        <span className="rounded-full bg-muted/40" style={{ width: size * 0.16, height: size * 0.16 }} />
      </span>
    );
  }

  const paco = value === 1;
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-lg border-2 shadow-sm ${
        paco
          ? "border-amber-400 bg-amber-100 dark:bg-amber-300/30"
          : "border-zinc-300 bg-white dark:border-zinc-400"
      } ${highlight ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""} ${
        dim ? "opacity-40" : ""
      } ${rolling ? "animate-dice" : ""}`}
      style={{ ...box, ...(rolling ? { animationDelay: `${delayMs}ms` } : {}) }}
    >
      {paco ? (
        <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>🦜</span>
      ) : (
        <span className="absolute inset-[16%] grid grid-cols-3 grid-rows-3 gap-px">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="grid place-items-center">
              {PIPS[value]?.includes(i) && (
                <span className="rounded-full bg-zinc-800" style={{ width: size * 0.14, height: size * 0.14 }} />
              )}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
