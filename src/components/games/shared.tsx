import type { ReactNode } from "react";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";

export type MemberMap = Record<string, LobbyMemberView>;

// ─────────────────────────────────────────────────────────────────────────────
// TableCircle — dispose les joueurs « autour d'une table » (en cercle) plutôt
// qu'en colonnes. « Moi » est ancré en bas, les autres s'égrènent autour. Le
// centre accueille une info partagée (jeton central, tour en cours…).
// Le rendu de chaque siège est délégué à l'appelant via `renderSeat`.
// ─────────────────────────────────────────────────────────────────────────────
export function TableCircle({
  ids,
  meId,
  renderSeat,
  center,
  className = "",
}: {
  ids: string[];
  meId: string | null;
  renderSeat: (id: string, isMe: boolean) => ReactNode;
  center?: ReactNode;
  className?: string;
}) {
  // Réordonne pour que « moi » occupe le siège du bas.
  const meIdx = meId ? ids.indexOf(meId) : -1;
  const seats = meIdx >= 0 ? [...ids.slice(meIdx), ...ids.slice(0, meIdx)] : ids;
  const n = seats.length;

  return (
    <div
      className={`relative mx-auto aspect-square w-full max-w-[26rem] rounded-full border border-dashed border-border/70 bg-surface/40 ${className}`}
    >
      {center !== undefined && (
        <div className="absolute left-1/2 top-1/2 w-2/5 -translate-x-1/2 -translate-y-1/2 text-center">
          {center}
        </div>
      )}
      {seats.map((id, i) => {
        // i=0 → bas du cercle ; on tourne dans le sens horaire.
        const angle = Math.PI / 2 + (i / n) * 2 * Math.PI;
        const x = 50 + 43 * Math.cos(angle);
        const y = 50 + 43 * Math.sin(angle);
        return (
          <div
            key={id}
            className="absolute w-[7.5rem] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {renderSeat(id, id === meId)}
          </div>
        );
      })}
    </div>
  );
}

export function toMemberMap(members: LobbyMemberView[]): MemberMap {
  return Object.fromEntries(members.map((m) => [m.id, m]));
}

export function PlayerPill({
  member,
  highlight = false,
}: {
  member?: { id: string; name: string; image: string | null };
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${
        highlight ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface-2"
      }`}
    >
      <Avatar name={member?.name ?? "?"} image={member?.image} size={18} />
      {member?.name ?? "Joueur"}
    </span>
  );
}

export function Scoreboard({
  entries,
  members,
  meId,
  unit,
}: {
  entries: { playerId: string; score: number }[];
  members: MemberMap;
  meId: string | null;
  unit?: string;
}) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="space-y-1.5">
      {entries.map((e, i) => {
        const m = members[e.playerId];
        const isMe = e.playerId === meId;
        return (
          <div
            key={e.playerId}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              isMe ? "border-primary/60 bg-primary/5" : "border-border bg-surface"
            }`}
          >
            <span className="w-6 text-center text-sm font-bold text-muted">
              {medals[i] ?? i + 1}
            </span>
            <Avatar name={m?.name ?? "Joueur"} image={m?.image} size={30} />
            <span className="flex-1 truncate text-sm font-semibold">
              {m?.name ?? "Joueur"}
              {isMe && <span className="ml-1 text-xs text-primary">(toi)</span>}
            </span>
            <span className="font-mono text-sm font-bold">
              {e.score}
              {unit ? <span className="ml-0.5 text-xs font-normal text-muted">{unit}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
