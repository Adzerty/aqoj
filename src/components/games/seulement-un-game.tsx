"use client";

import { useState } from "react";
import type { GameAction } from "@/lib/games/types";
import type { SeulementUnView } from "@/lib/games/seulement-un";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { toMemberMap } from "./shared";

const OUTCOME_TEXT: Record<string, { label: string; cls: string }> = {
  correct: { label: "Bonne réponse ! +1", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" },
  wrong: { label: "Raté… 2 cartes perdues", cls: "border-rose-500/50 bg-rose-500/10 text-rose-300" },
  pass: { label: "Passé — carte retirée", cls: "border-amber-500/50 bg-amber-500/10 text-amber-300" },
  "no-clues": { label: "Tous les indices annulés !", cls: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300" },
};

export function SeulementUnGame({
  view,
  members,
  meId,
  sendAction,
}: {
  view: SeulementUnView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);
  const [clue, setClue] = useState("");
  const [guess, setGuess] = useState("");

  const activeName = map[view.activePlayerId]?.name ?? "Joueur";

  function submitClue(e: React.FormEvent) {
    e.preventDefault();
    const w = clue.trim();
    if (!w || /\s/.test(w)) return;
    sendAction({ type: "clue", payload: { word: w } });
    setClue("");
  }

  function submitGuess(e: React.FormEvent) {
    e.preventDefault();
    const w = guess.trim();
    if (!w) return;
    sendAction({ type: "guess", payload: { word: w } });
    setGuess("");
  }

  return (
    <div className="space-y-5">
      {/* En-tête : manche, score, cartes restantes (sans chrono — jeu non chronométré) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted">
          Manche {view.roundNumber} / {view.totalRounds}
        </span>
        <div className="flex items-center gap-3 text-sm">
          <span className="font-bold">
            Score <span className="font-mono text-base text-emerald-500">{view.score}</span>
          </span>
          <span className="text-muted">·</span>
          <span className="text-muted">{view.cardsLeft} carte(s) restante(s)</span>
        </div>
      </div>

      {/* Qui devine */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted">
        <Avatar name={activeName} image={map[view.activePlayerId]?.image} size={24} />
        <span>
          <b className="text-foreground">{view.amActive ? "À toi de deviner" : activeName}</b>{" "}
          {view.amActive ? "🎯" : "doit deviner le mot mystère"}
        </span>
      </div>

      {/* Mot mystère (visible par tous sauf le devineur en phase write/guess) */}
      {view.mysteryWord && (view.phase === "write" || view.phase === "guess") && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300/80">Mot mystère</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{view.mysteryWord}</p>
        </div>
      )}

      {/* ───────── Phase ÉCRITURE ───────── */}
      {view.phase === "write" &&
        (view.amActive ? (
          <p className="rounded-2xl border border-border bg-surface p-5 text-center text-muted">
            Les autres écrivent leur indice…{" "}
            <span className="font-semibold text-foreground">
              {view.submittedPlayerIds.length}/{view.writersCount}
            </span>{" "}
            prêt(s). Ferme les yeux ! 🙈
          </p>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-4">
            {view.myClue ? (
              <p className="text-center text-sm">
                Ton indice : <b className="font-mono text-base">{view.myClue}</b>
                <span className="mt-1 block text-xs text-muted">
                  En attente des autres ({view.submittedPlayerIds.length}/{view.writersCount})…
                </span>
              </p>
            ) : (
              <form onSubmit={submitClue} className="flex flex-col gap-2 sm:flex-row">
                <input
                  autoFocus
                  value={clue}
                  onChange={(e) => setClue(e.target.value)}
                  placeholder="Ton indice (un seul mot)"
                  maxLength={32}
                  className="h-11 flex-1 rounded-xl border border-border bg-surface-2 px-4 outline-none transition-colors focus:border-primary"
                />
                <Button type="submit" size="md" disabled={!clue.trim() || /\s/.test(clue.trim())}>
                  Valider l&apos;indice
                </Button>
              </form>
            )}
            <p className="mt-2 text-center text-xs text-muted">
              Attention : si deux joueurs écrivent la même chose, les deux indices sont annulés !
            </p>
          </div>
        ))}

      {/* ───────── Phase DEVINETTE ───────── */}
      {view.phase === "guess" && (
        <div className="space-y-3">
          {/* Indices restants */}
          <div className="flex flex-wrap justify-center gap-2">
            {view.clues && view.clues.length > 0 ? (
              view.clues.map((c, i) =>
                c.eliminated ? (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted line-through opacity-60"
                  >
                    {view.amActive ? "— annulé —" : c.word}
                  </span>
                ) : (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-primary/50 bg-primary/10 px-3 py-2 text-base font-bold"
                  >
                    {c.word}
                    {!view.amActive && (
                      <Avatar name={map[c.playerId]?.name ?? "?"} image={map[c.playerId]?.image} size={16} />
                    )}
                  </span>
                ),
              )
            ) : (
              <p className="text-sm text-muted">Aucun indice valide…</p>
            )}
          </div>

          {view.amActive ? (
            <form onSubmit={submitGuess} className="flex flex-col gap-2 sm:flex-row">
              <input
                autoFocus
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Ta réponse"
                maxLength={40}
                className="h-11 flex-1 rounded-xl border border-border bg-surface-2 px-4 outline-none transition-colors focus:border-primary"
              />
              <Button type="submit" size="md" disabled={!guess.trim()}>
                Deviner
              </Button>
              <Button type="button" variant="secondary" size="md" onClick={() => sendAction({ type: "pass" })}>
                Passer
              </Button>
            </form>
          ) : (
            <p className="text-center text-sm text-muted">
              <b className="text-foreground">{activeName}</b> réfléchit à sa réponse…
            </p>
          )}
        </div>
      )}

      {/* ───────── Phase REVEAL ───────── */}
      {view.phase === "reveal" && view.lastResult && (
        <div className="space-y-3">
          <div className={`animate-pop rounded-2xl border p-4 text-center ${OUTCOME_TEXT[view.lastResult.outcome]?.cls ?? ""}`}>
            <p className="font-extrabold">{OUTCOME_TEXT[view.lastResult.outcome]?.label}</p>
            <p className="mt-1 text-sm">
              Mot mystère : <b>{view.lastResult.mysteryWord}</b>
              {view.lastResult.guess && (
                <>
                  {" "}· Réponse : <b>{view.lastResult.guess}</b>
                </>
              )}
            </p>
          </div>
          {view.lastResult.clues.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {view.lastResult.clues.map((c, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm ${
                    c.eliminated
                      ? "border-border bg-surface-2 text-muted line-through opacity-60"
                      : "border-emerald-500/40 bg-emerald-500/10"
                  } ${c.playerId === meId ? "ring-1 ring-primary" : ""}`}
                  title={map[c.playerId]?.name}
                >
                  <Avatar name={map[c.playerId]?.name ?? "?"} image={map[c.playerId]?.image} size={16} />
                  {c.word}
                </span>
              ))}
            </div>
          )}
          {/* Le prochain devineur lance la manche suivante (plus de chrono auto). */}
          <div className="text-center">
            {view.canContinue ? (
              <Button onClick={() => sendAction({ type: "nextRound" })}>
                {view.cardsLeft > 0 ? "Manche suivante" : "Voir le score final"}
              </Button>
            ) : (
              <p className="text-xs text-muted">
                En attente de <b className="text-foreground">{activeName}</b> pour relancer…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
