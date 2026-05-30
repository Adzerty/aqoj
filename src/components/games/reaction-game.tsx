"use client";

import type { GameAction } from "@/lib/games/types";
import type { ReactionView } from "@/lib/games/reaction";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";
import { Scoreboard, toMemberMap } from "./shared";

export function ReactionGame({
  view,
  members,
  meId,
  sendAction,
}: {
  view: ReactionView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);

  function tap() {
    if (view.phase === "arming" && !view.myFalseStart) sendAction({ type: "tap" });
    else if (view.phase === "go" && view.myReaction === null) sendAction({ type: "tap" });
  }

  const isArming = view.phase === "arming";
  const isGo = view.phase === "go";

  // Couleur de la grande zone selon la phase (pleine, pas de dégradé)
  let panel = "bg-zinc-700";
  let title = "";
  let subtitle = "";
  if (isArming) {
    if (view.myFalseStart) {
      panel = "bg-rose-600";
      title = "Faux départ ! 🙈";
      subtitle = "Tu sautes cette manche…";
    } else {
      panel = "bg-rose-500";
      title = "Attends…";
      subtitle = "Ne tape pas avant le VERT";
    }
  } else if (isGo) {
    panel = "bg-emerald-500";
    if (view.myReaction !== null) {
      title = `${view.myReaction} ms`;
      subtitle = "Touché ! ⚡";
    } else {
      title = "TAPE ! 🟢";
      subtitle = "Maintenant !";
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted">
          Manche {view.roundIndex + 1} / {view.totalRounds}
        </span>
      </div>

      {/* Grande zone de tap (arming / go) */}
      {(isArming || isGo) && (
        <button
          onPointerDown={tap}
          disabled={(isArming && view.myFalseStart) || (isGo && view.myReaction !== null)}
          className={`flex min-h-56 w-full select-none flex-col items-center justify-center rounded-3xl ${panel} p-8 text-center text-white transition-transform active:scale-[0.99] disabled:active:scale-100`}
        >
          <span className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</span>
          <span className="mt-2 text-base font-medium text-white/80">{subtitle}</span>
        </button>
      )}

      {/* Résultat de la manche */}
      {view.phase === "result" && (
        <div className="rounded-3xl border border-border bg-surface p-6">
          {view.roundWinner ? (
            <div className="flex flex-col items-center text-center">
              <Avatar
                name={map[view.roundWinner]?.name ?? "?"}
                image={map[view.roundWinner]?.image}
                size={56}
                ring
              />
              <p className="mt-3 text-lg font-bold">
                {map[view.roundWinner]?.name ?? "Joueur"} remporte la manche !
              </p>
              <p className="font-mono text-sm text-muted">
                {view.taps[view.roundWinner]} ms de réaction
              </p>
            </div>
          ) : (
            <p className="text-center font-semibold text-muted">
              Personne n&apos;a tapé à temps 😴
            </p>
          )}

          <div className="mt-5 space-y-1.5">
            {members.map((m) => {
              const fs = view.falseStart[m.id];
              const t = view.taps[m.id];
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-3 py-1.5 text-sm"
                >
                  <Avatar name={m.name} image={m.image} size={24} />
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className="font-mono text-xs font-semibold">
                    {fs ? (
                      <span className="text-rose-400">faux départ</span>
                    ) : t !== undefined ? (
                      `${t} ms`
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Classement (victoires) */}
      <div>
        <h4 className="mb-2 text-sm font-bold text-muted">Victoires</h4>
        <Scoreboard entries={view.wins} members={map} meId={meId} unit="🏆" />
      </div>
    </div>
  );
}
