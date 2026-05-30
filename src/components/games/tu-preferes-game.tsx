"use client";

import type { GameAction } from "@/lib/games/types";
import type { TuPreferesView } from "@/lib/games/tu-preferes";
import type { LobbyMemberView } from "@/lib/socket/events";
import { useCountdown } from "@/hooks/use-countdown";
import { Avatar } from "../avatar";
import { Scoreboard, toMemberMap } from "./shared";

const PHASE_MAX: Record<string, number> = { question: 20000, reveal: 6000 };

export function TuPreferesGame({
  view,
  members,
  meId,
  sendAction,
}: {
  view: TuPreferesView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);
  const msLeft = useCountdown(view.deadline);
  const seconds = Math.ceil(msLeft / 1000);
  const max = PHASE_MAX[view.phase] ?? 20000;
  const pct = Math.min(100, Math.max(0, (msLeft / max) * 100));

  const q = view.question;
  const reveal = view.reveal;
  const totalVotes = reveal ? reveal.counts.a + reveal.counts.b : 0;

  return (
    <div className="space-y-5">
      {/* En-tête manche + timer */}
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted">
          Manche {view.roundIndex + 1} / {view.totalRounds}
        </span>
        <span className="font-mono text-2xl font-bold tabular-nums">{seconds}s</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-100"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Question */}
      {(["a", "b"] as const).map((opt) => {
        const text = opt === "a" ? q?.a : q?.b;
        const chosen = view.myChoice === opt;
        const count = reveal ? reveal.counts[opt] : 0;
        const share = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
        const voters = reveal
          ? Object.entries(reveal.votesByPlayer)
              .filter(([, c]) => c === opt)
              .map(([pid]) => pid)
          : [];

        return (
          <button
            key={opt}
            disabled={view.phase !== "question" || view.myChoice !== null}
            onClick={() => sendAction({ type: "vote", payload: { choice: opt } })}
            className={`relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all disabled:cursor-default ${
              chosen
                ? "border-primary ring-2 ring-primary"
                : "border-border hover:border-primary/60"
            } ${view.phase === "question" && view.myChoice === null ? "hover:-translate-y-0.5" : ""}`}
          >
            {/* Barre de résultat (reveal) */}
            {reveal && (
              <div
                className={`absolute inset-y-0 left-0 -z-0 ${
                  opt === "a" ? "bg-sky-400/15" : "bg-amber-400/15"
                } transition-[width] duration-500`}
                style={{ width: `${share}%` }}
              />
            )}
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase text-muted">
                  {opt === "a" ? "A" : "B"}
                </span>
                {reveal && (
                  <span className="text-sm font-bold">
                    {share}% · {count}
                  </span>
                )}
              </div>
              <p className="mt-1 text-lg font-semibold leading-snug">{text}</p>
              {reveal && voters.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {voters.map((pid) => (
                    <span key={pid} className="inline-flex items-center" title={map[pid]?.name}>
                      <Avatar name={map[pid]?.name ?? "?"} image={map[pid]?.image} size={22} />
                      {reveal.gains[pid] > 0 && (
                        <span className="ml-0.5 text-xs font-bold text-emerald-400">
                          +{reveal.gains[pid]}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* État sous la question */}
      {view.phase === "question" && (
        <p className="text-center text-sm text-muted">
          {view.myChoice
            ? "Vote enregistré — en attente des autres…"
            : "Vote vite avant la fin du chrono !"}{" "}
          <span className="font-semibold text-foreground">
            {view.votedPlayerIds.length}/{members.length}
          </span>{" "}
          ont voté
        </p>
      )}

      {/* Scores */}
      <div>
        <h4 className="mb-2 text-sm font-bold text-muted">Classement</h4>
        <Scoreboard entries={view.scores} members={map} meId={meId} unit="pts" />
      </div>
    </div>
  );
}
