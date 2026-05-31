"use client";

import { useState } from "react";
import type { GameAction } from "@/lib/games/types";
import type { CardColor, CodenamesView, Team } from "@/lib/games/codenames";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { toMemberMap } from "./shared";

// L'équipe est féminine (« l'équipe Bleue »), mais l'Espion/Agent est masculin
// (« Espion Bleu »). On garde deux libellés distincts pour éviter les fautes.
const TEAM_LABEL: Record<Team, string> = { red: "Rouge", blue: "Bleue" };
const TEAM_LABEL_M: Record<Team, string> = { red: "Rouge", blue: "Bleu" };

// Styles des cartes (forts contrastes) — claires en mode clair, profondes en sombre.
const CARD_STYLE: Record<CardColor, string> = {
  red: "border-rose-500 bg-rose-500 text-white dark:bg-rose-600",
  blue: "border-sky-500 bg-sky-500 text-white dark:bg-sky-600",
  neutral: "border-amber-300 bg-amber-200 text-amber-950 dark:bg-amber-300/40 dark:text-amber-50",
  assassin: "border-zinc-900 bg-zinc-900 text-zinc-50",
};

function TeamBadge({ team }: { team: Team }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        team === "red" ? "bg-rose-500/20 text-rose-300" : "bg-sky-500/20 text-sky-300"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${team === "red" ? "bg-rose-400" : "bg-sky-400"}`} />
      {TEAM_LABEL[team]}
    </span>
  );
}

export function CodenamesGame({
  view,
  members,
  meId,
  sendAction,
}: {
  view: CodenamesView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);

  const { me, currentTeam, clue, remaining, winner } = view;

  function submitClue(e: React.FormEvent) {
    e.preventDefault();
    const word = clueWord.trim();
    if (!word || /\s/.test(word)) return;
    sendAction({ type: "clue", payload: { word, count: clueCount } });
    setClueWord("");
    setClueCount(1);
  }

  const finished = view.phase === "finished";

  return (
    <div className="space-y-5">
      {/* Bandeau d'état */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold tabular-nums text-rose-400">
              {remaining.red}
            </span>
            <TeamBadge team="red" />
          </div>
          <span className="text-muted">·</span>
          <div className="flex items-center gap-2">
            <TeamBadge team="blue" />
            <span className="text-2xl font-extrabold tabular-nums text-sky-400">
              {remaining.blue}
            </span>
          </div>
        </div>

        {me && (
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            Toi :{" "}
            <b className="text-foreground">
              {me.role === "spymaster" ? "🕵️ Espion" : "🎯 Agent"} {TEAM_LABEL_M[me.team]}
            </b>
          </span>
        )}
      </div>

      {/* Indice courant / tour */}
      {!finished && (
        <div className="rounded-2xl border border-border bg-surface p-3 text-center">
          {clue ? (
            <p className="text-sm">
              Indice de l&apos;équipe{" "}
              <b className={currentTeam === "red" ? "text-rose-500 dark:text-rose-300" : "text-sky-600 dark:text-sky-300"}>
                {TEAM_LABEL[currentTeam]}
              </b>{" "}
              : <span className="font-mono text-lg font-bold">{clue.word.toUpperCase()}</span>{" "}
              <span className="text-muted">
                ({clue.count === 0 ? "∞" : clue.count}
                {view.guessesRemaining !== null && (
                  <> · {view.guessesRemaining >= 99 ? "∞" : view.guessesRemaining} essai(s)</>
                )}
                )
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted">
              En attente de l&apos;indice de l&apos;Espion{" "}
              <b className="text-foreground">{TEAM_LABEL_M[currentTeam]}</b>…
            </p>
          )}
        </div>
      )}

      {/* Fin de partie */}
      {finished && winner && (
        <div
          className={`animate-pop rounded-2xl border p-4 text-center ${
            winner === "red" ? "border-rose-500/50 bg-rose-500/10" : "border-sky-500/50 bg-sky-500/10"
          }`}
        >
          <p className="text-lg font-extrabold">🏆 L&apos;équipe {TEAM_LABEL[winner]} remporte la partie !</p>
        </div>
      )}

      {/* Grille 5×5 */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {view.cards.map((card, i) => {
          const clickable = view.canGuess && !card.revealed && !finished;
          const colored = card.color !== null;
          // Carte « découverte » : on doit la voir clairement DIFFÉRENTE — y
          // compris pour l'Espion qui connaît déjà toutes les couleurs.
          const revealed = card.revealed;
          return (
            <button
              key={i}
              disabled={!clickable}
              onClick={() => clickable && sendAction({ type: "guess", payload: { cardIndex: i } })}
              className={`relative flex aspect-[5/3] items-center justify-center rounded-lg border-2 px-1 text-center text-[11px] font-extrabold uppercase leading-tight tracking-wide transition-all sm:text-sm ${
                colored
                  ? CARD_STYLE[card.color as CardColor]
                  : "border-border bg-surface text-foreground"
              } ${
                revealed
                  ? "scale-[0.95] opacity-90 ring-4 ring-inset ring-black/30 shadow-inner shadow-black/30"
                  : "shadow-sm"
              } ${
                clickable ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary" : "cursor-default"
              }`}
              style={{ textShadow: colored ? "0 1px 2px rgba(0,0,0,0.45)" : undefined }}
              title={card.word}
            >
              <span className="line-clamp-2">{card.word}</span>
              {revealed && (
                <span
                  className={`absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full text-[10px] font-black ${
                    card.color === "assassin" ? "bg-white text-zinc-900" : "bg-black/40 text-white"
                  }`}
                  title="Carte découverte"
                >
                  {card.color === "assassin" ? "💀" : "✓"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Zone d'action */}
      {!finished && (
        <div className="rounded-2xl border border-border bg-surface p-3">
          {view.canGiveClue ? (
            <form onSubmit={submitClue} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={clueWord}
                onChange={(e) => setClueWord(e.target.value)}
                placeholder="Ton indice (un seul mot)"
                maxLength={24}
                className="h-11 flex-1 rounded-xl border border-border bg-surface-2 px-4 outline-none transition-colors focus:border-primary"
              />
              <input
                type="number"
                min={0}
                max={9}
                value={clueCount}
                onChange={(e) => setClueCount(Math.max(0, Math.min(9, Number(e.target.value))))}
                className="h-11 w-20 rounded-xl border border-border bg-surface-2 px-4 text-center font-mono text-lg font-bold outline-none focus:border-primary"
              />
              <Button type="submit" size="md" disabled={!clueWord.trim()}>
                Donner l&apos;indice
              </Button>
            </form>
          ) : view.canGuess ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">À vous de deviner — touchez une carte.</p>
              <Button variant="secondary" size="sm" disabled={!view.canPass} onClick={() => sendAction({ type: "pass" })}>
                Passer / Terminer
              </Button>
            </div>
          ) : view.isSpymaster ? (
            <p className="text-center text-sm text-muted">
              Tu es Espion : tu vois toutes les couleurs. Patiente, c&apos;est à l&apos;autre équipe.
            </p>
          ) : (
            <p className="text-center text-sm text-muted">
              C&apos;est au tour de l&apos;équipe adverse. Observe et prépare-toi.
            </p>
          )}
        </div>
      )}

      {/* Équipes */}
      <div className="grid gap-3 sm:grid-cols-2">
        {(["red", "blue"] as Team[]).map((team) => (
          <div
            key={team}
            className={`rounded-2xl border p-3 ${
              team === currentTeam && !finished
                ? team === "red"
                  ? "border-rose-500/50"
                  : "border-sky-500/50"
                : "border-border"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <TeamBadge team={team} />
              <span className="text-xs text-muted">{remaining[team]} mot(s) restant(s)</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {view.players
                .filter((p) => p.team === team)
                .sort((a, b) => (a.role === "spymaster" ? -1 : 1) - (b.role === "spymaster" ? -1 : 1))
                .map((p) => {
                  const m = map[p.id];
                  return (
                    <span
                      key={p.id}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${
                        p.id === meId ? "border-primary bg-primary/10" : "border-border bg-surface-2"
                      }`}
                      title={p.role === "spymaster" ? "Espion" : "Agent"}
                    >
                      <span>{p.role === "spymaster" ? "🕵️" : "🎯"}</span>
                      <Avatar name={m?.name ?? "?"} image={m?.image} size={18} />
                      {m?.name ?? "Joueur"}
                    </span>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Journal (scrollable) */}
      {view.log.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-muted">Historique</h4>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-3 text-sm">
            {view.log.map((entry, i) => (
              <p key={i} className={i === 0 ? "font-medium" : "text-muted"}>
                {entry}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
