import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";

export type MemberMap = Record<string, LobbyMemberView>;

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
