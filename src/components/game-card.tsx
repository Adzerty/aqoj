import type { GameMeta } from "@/lib/games/types";
import { accentOf } from "./games/accent";
import { Clock, Users } from "./icons";

export function GameCard({
  meta,
  footer,
  active = false,
}: {
  meta: GameMeta;
  footer?: React.ReactNode;
  active?: boolean;
}) {
  const accent = accentOf(meta.accent);

  return (
    <div
      className={`group flex flex-col rounded-2xl border bg-surface p-5 transition-all hover:-translate-y-0.5 ${
        active ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/15"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${accent.tile}`}
        >
          {meta.emoji}
        </span>
        <div className="min-w-0">
          <h3 className="font-bold leading-tight">{meta.name}</h3>
          <p className="text-sm text-muted">{meta.tagline}</p>
        </div>
      </div>

      <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-muted">{meta.description}</p>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {meta.tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs font-medium text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Users size={14} />
          {meta.minPlayers}–{meta.maxPlayers}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={14} />~{meta.estimatedMinutes} min
        </span>
      </div>

      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
