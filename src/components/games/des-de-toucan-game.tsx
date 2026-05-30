"use client";

import { useState } from "react";
import type { GameAction } from "@/lib/games/types";
import type { Bid, ToucanView } from "@/lib/games/des-de-toucan";
import { isLegalBid } from "@/lib/games/des-de-toucan";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { Die } from "../dice";
import { toMemberMap } from "./shared";

const valueLabel = (v: number) => (v === 1 ? "Paco" : `${v}`);
const matches = (die: number, value: number, palifico: boolean) =>
  die === value || (!palifico && value !== 1 && die === 1);

export function DesDeToucanGame({
  view,
  members,
  sendAction,
}: {
  view: ToucanView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);
  const name = (id: string) => map[id]?.name ?? "Joueur";
  const bidKey = view.bid ? `${view.bid.quantity}-${view.bid.value}-${view.bid.by}` : `open-${view.starterId}`;

  return (
    <div className="space-y-5">
      {/* Bandeau */}
      {view.winner ? (
        <div className="animate-pop rounded-2xl border border-primary/50 bg-primary/10 p-4 text-center">
          <p className="text-lg font-extrabold">🏆 {name(view.winner)} remporte la partie !</p>
          <p className="mt-1 text-xs text-muted">Tournée de Cuba Libre pour les autres 🍹</p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          {view.palifico && (
            <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-300">
              PALIFICO
            </span>
          )}
          {view.phase === "reveal" ? (
            <span className="font-semibold text-foreground">Révélation des dés…</span>
          ) : (
            <span>
              Tour de <b className="text-foreground">{name(view.currentId)}</b>
              {view.isMyTurn && " — à toi !"}
            </span>
          )}
          <span className="text-muted/60">· {view.totalDice} dés en jeu</span>
        </div>
      )}

      {/* Enchère courante */}
      {view.bid && view.phase === "bidding" && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-3">
          <span className="text-sm text-muted">{name(view.bid.by)} annonce</span>
          <span className="text-2xl font-extrabold tabular-nums">{view.bid.quantity}×</span>
          <Die value={view.bid.value} size={34} />
          <span className="font-bold">{valueLabel(view.bid.value)}</span>
        </div>
      )}

      {/* Joueurs */}
      <div className="grid gap-2 sm:grid-cols-2">
        {view.players.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border p-2.5 ${
              p.isCurrent ? "border-primary ring-1 ring-primary" : "border-border"
            } ${p.alive ? "" : "opacity-40"}`}
          >
            <div className="flex items-center gap-2">
              <Avatar name={name(p.id)} image={map[p.id]?.image} size={28} />
              <span className="flex-1 truncate text-sm font-semibold">
                {name(p.id)}
                {p.id === view.meId && <span className="ml-1 text-xs text-primary">(toi)</span>}
                {p.isStarter && <span className="ml-1" title="Meneur">🎙️</span>}
                {!p.alive && <span className="ml-1">☠️</span>}
              </span>
              {!p.dice && <span className="text-xs text-muted">{p.diceCount} dé{p.diceCount > 1 ? "s" : ""}</span>}
            </div>
            {/* Dés : cachés pendant les enchères, révélés au reveal */}
            {p.alive && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {p.dice
                  ? p.dice.map((d, i) => (
                      <Die
                        key={i}
                        value={d}
                        size={28}
                        highlight={!!view.lastResult && matches(d, view.lastResult.bid.value, view.lastResult.palifico)}
                      />
                    ))
                  : p.id !== view.meId &&
                    Array.from({ length: p.diceCount }, (_, i) => <Die key={i} size={22} hidden />)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mes dés */}
      {view.alive && view.phase === "bidding" && (
        <div className="rounded-2xl border border-border bg-surface p-3 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Tes dés (cachés des autres)</p>
          <div key={view.myDice.join(",")} className="flex flex-wrap justify-center gap-2">
            {view.myDice.map((d, i) => (
              <Die
                key={i}
                value={d}
                size={48}
                rolling
                delayMs={i * 70}
                highlight={!!view.bid && matches(d, view.bid.value, view.palifico)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Zone d'action */}
      {view.phase === "reveal" ? (
        <RevealPanel view={view} name={name} sendAction={sendAction} />
      ) : view.isMyTurn ? (
        <BidPanel
          key={bidKey}
          bid={view.bid}
          palifico={view.palifico}
          totalDice={view.totalDice}
          onBid={(quantity, value) => sendAction({ type: "bid", payload: { quantity, value } })}
          onDudo={() => sendAction({ type: "dudo" })}
          onCalza={() => sendAction({ type: "calza" })}
        />
      ) : (
        view.phase === "bidding" && (
          <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">
            En attente de <b className="text-foreground">{name(view.currentId)}</b>…
          </p>
        )
      )}

      {/* Journal */}
      <div>
        <h4 className="mb-2 text-sm font-bold text-muted">Journal</h4>
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-3 text-sm">
          {view.log.map((e, i) => (
            <p key={i} className={i === 0 ? "font-medium" : "text-muted"}>{e}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Reveal ─────────────────────────────

function RevealPanel({
  view,
  name,
  sendAction,
}: {
  view: ToucanView;
  name: (id: string) => string;
  sendAction: (a: GameAction) => void;
}) {
  const res = view.lastResult;
  return (
    <div className="rounded-2xl border border-amber-400/50 bg-amber-500/5 p-4 text-center">
      {res && (
        <>
          <p className="text-sm font-semibold">
            {res.type === "dudo" ? "🗣️ Dudo" : "🎯 Calza"} de {name(res.caller)} sur l&apos;annonce{" "}
            <b>
              {res.bid.quantity}× {valueLabel(res.bid.value)}
            </b>
          </p>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm">
            Comptés :
            <span className="inline-flex items-center gap-1">
              <Die value={res.bid.value} size={22} /> ×<b className="text-base">{res.count}</b>
            </span>
          </p>
          <p className="mt-1 text-sm font-bold">
            {res.winner
              ? `✨ ${name(res.winner)} avait raison — il récupère un dé !`
              : res.loser
                ? `➖ ${name(res.loser)} perd un dé.`
                : ""}
          </p>
        </>
      )}
      <div className="mt-3">
        {view.canContinue ? (
          <Button onClick={() => sendAction({ type: "nextRound" })}>🥤 Lancer la manche suivante</Button>
        ) : (
          <p className="text-xs text-muted">
            En attente de <b className="text-foreground">{name(view.nextStarterId ?? "")}</b> pour relancer…
          </p>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── Construction d'enchère ─────────────────────────────

function BidPanel({
  bid,
  palifico,
  totalDice,
  onBid,
  onDudo,
  onCalza,
}: {
  bid: (Bid & { by: string }) | null;
  palifico: boolean;
  totalDice: number;
  onBid: (quantity: number, value: number) => void;
  onDudo: () => void;
  onCalza: () => void;
}) {
  const [q, setQ] = useState(() => (bid ? bid.quantity + 1 : Math.max(1, Math.round(totalDice / 3))));
  const [v, setV] = useState(() => (bid ? bid.value : 2));

  const valueOptions = palifico
    ? bid
      ? [bid.value]
      : [2, 3, 4, 5, 6, 1]
    : bid
      ? [2, 3, 4, 5, 6, 1]
      : [2, 3, 4, 5, 6];

  const legal = isLegalBid(bid, { quantity: q, value: v }, palifico);

  return (
    <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="text-center text-sm font-semibold">Ta proposition :</p>

      {/* Quantité */}
      <div className="flex items-center justify-center gap-3">
        <span className="text-xs font-bold uppercase text-muted">Nombre</span>
        <button
          onClick={() => setQ((x) => Math.max(1, x - 1))}
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-lg font-bold hover:bg-surface-2"
        >
          −
        </button>
        <span className="w-10 text-center text-2xl font-extrabold tabular-nums">{q}</span>
        <button
          onClick={() => setQ((x) => Math.min(totalDice, x + 1))}
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-lg font-bold hover:bg-surface-2"
        >
          +
        </button>
      </div>

      {/* Valeur */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {valueOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => setV(opt)}
            className={`rounded-xl border-2 p-1 transition-all ${
              v === opt ? "border-primary ring-2 ring-primary" : "border-transparent hover:border-border"
            }`}
            title={valueLabel(opt)}
          >
            <Die value={opt} size={38} />
          </button>
        ))}
      </div>

      {/* Boutons */}
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        <Button disabled={!legal} onClick={() => onBid(q, v)}>
          Annoncer {q}× {valueLabel(v)}
        </Button>
        {bid && (
          <>
            <Button variant="danger" onClick={onDudo}>
              🗣️ Dudo !
            </Button>
            <Button variant="secondary" onClick={onCalza}>
              🎯 Calza
            </Button>
          </>
        )}
      </div>
      {!legal && (
        <p className="text-center text-xs text-rose-500">
          Enchère invalide — il faut monter (quantité ou valeur), sans descendre.
        </p>
      )}
    </div>
  );
}
