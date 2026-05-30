// Palette d'accents par jeu : des couleurs PLEINES et douces (pas de dégradé),
// déclinées clair + sombre. Les classes sont écrites en entier pour que Tailwind
// les conserve au build (pas de noms de classes dynamiques).

export interface Accent {
  /** Pastille / tuile d'icône : fond doux + texte coloré. */
  tile: string;
  /** Petit point de couleur pleine (badges, puces). */
  dot: string;
  /** Fond très léger (zones, surlignage). */
  soft: string;
  /** Texte coloré. */
  text: string;
  /** Bordure douce de la couleur. */
  border: string;
  /** Remplissage plein (barres de progression). */
  fill: string;
}

export const ACCENTS: Record<string, Accent> = {
  honey: {
    tile: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
    dot: "bg-amber-500",
    soft: "bg-amber-50 dark:bg-amber-400/10",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-400/30",
    fill: "bg-amber-500",
  },
  clay: {
    tile: "bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
    dot: "bg-orange-500",
    soft: "bg-orange-50 dark:bg-orange-400/10",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-400/30",
    fill: "bg-orange-500",
  },
  sky: {
    tile: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    dot: "bg-sky-500",
    soft: "bg-sky-50 dark:bg-sky-400/10",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-300 dark:border-sky-400/30",
    fill: "bg-sky-500",
  },
  plum: {
    tile: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
    dot: "bg-rose-500",
    soft: "bg-rose-50 dark:bg-rose-400/10",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-300 dark:border-rose-400/30",
    fill: "bg-rose-500",
  },
  sage: {
    tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
    soft: "bg-emerald-50 dark:bg-emerald-400/10",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-300 dark:border-emerald-400/30",
    fill: "bg-emerald-500",
  },
  ink: {
    tile: "bg-slate-200 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300",
    dot: "bg-slate-500",
    soft: "bg-slate-50 dark:bg-slate-400/10",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-400/30",
    fill: "bg-slate-500",
  },
};

export function accentOf(key: string): Accent {
  return ACCENTS[key] ?? ACCENTS.sage;
}
