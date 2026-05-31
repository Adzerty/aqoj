"use client";

import { useState } from "react";
import type { GameAction } from "@/lib/games/types";
import type { DiscType, FleurView } from "@/lib/games/cranes-fleuris";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { toMemberMap } from "./shared";

// ─────────────────────────────────────────────────────────────────────────────
// UI Crânes fleuris : placement secret, ajout/surenchère/passe, tentative.
// Les disques posés des autres sont CACHÉS tant qu'ils ne sont pas retournés.
// ─────────────────────────────────────────────────────────────────────────────

function Disc({
  variant,
  size = 38,
  rotated = false,
}: {
  variant: "hidden" | "flower" | "skull";
  size?: number;
  rotated?: boolean;
}) {
  const box = { width: size, height: size };
  if (variant === "hidden") {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full border-2 border-violet-400/60 bg-violet-200 shadow-sm dark:bg-violet-500/30"
        style={box}
        aria-hidden
      >
        <span style={{ fontSize: size * 0.45, lineHeight: 1 }}>✦</span>
      </span>
    );
  }
  if (variant === "flower") {
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-full border-2 border-emerald-400 bg-emerald-100 shadow-sm dark:bg-emerald-500/30 ${
          rotated ? "animate-pop" : ""
        }`}
        style={box}
      >
        <span style={{ fontSize: size * 0.6, lineHeight: 1 }}>🌸</span>
      </span>
    );
  }
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border-2 border-rose-400 bg-rose-100 shadow-sm dark:bg-rose-500/30 ${
        rotated ? "animate-pop" : ""
      }`}
      style={box}
    >
      <span style={{ fontSize: size * 0.6, lineHeight: 1 }}>💀</span>
    </span>
  );
}

export function CranesFleurisGame({
  view,
  members,
  sendAction,
}: {
  view: FleurView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);
  const name = (id: string) => map[id]?.name ?? "Joueur";
  const [bidInput, setBidInput] = useState(1);

  return (
    <div className="space-y-5">
      {/* Bandeau d'état */}
      {view.winner ? (
        <div className="animate-pop rounded-2xl border border-primary/50 bg-primary/10 p-4 text-center">
          <p className="text-lg font-extrabold">🏆 {name(view.winner)} remporte la partie !</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">
          {view.phase === "place" && "Pose un disque face cachée…"}
          {view.phase === "bid" && !view.challengeStarted && (
            <>
              Tour de <b className="text-foreground">{name(view.currentId)}</b> : ajouter un disque
              ou lancer un défi.
            </>
          )}
          {view.phase === "bid" && view.challengeStarted && (
            <>
              Enchère : <b className="text-foreground">{view.currentBid}</b> · au tour de{" "}
              <b className="text-foreground">{name(view.currentId)}</b>.
            </>
          )}
          {view.phase === "attempt" && (
            <>
              🎯 <b className="text-foreground">{name(view.challengerId ?? "")}</b> tente de
              retourner <b>{view.bid}</b> disque(s) sans tomber sur un crâne ({view.flipsDone}/
              {view.bid}).
            </>
          )}
        </p>
      )}

      {/* Joueurs (vue de la table) */}
      <div className="grid gap-2 sm:grid-cols-2">
        {view.players.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border p-2.5 ${
              p.isCurrent || p.isChallenger ? "border-primary ring-1 ring-primary" : "border-border"
            } ${p.active ? "" : "opacity-50"}`}
          >
            <div className="flex items-center gap-2.5">
              <Avatar name={p.name} image={map[p.id]?.image} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {p.name}
                    {p.id === view.meId && <span className="ml-1 text-xs text-primary">(toi)</span>}
                    {p.isFirst && <span className="ml-1" title="Premier joueur">⭐</span>}
                    {p.isChallenger && <span className="ml-1" title="Challenger">🎯</span>}
                    {!p.active && <span className="ml-1">☠️</span>}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span>🌺 {p.discs}</span>
                  <span>· 🏆 {p.wins}/2</span>
                  {p.passed && <span>· passé</span>}
                  {p.isHighBidder && <span>· meneur d&apos;enchère</span>}
                </div>
              </div>
            </div>

            {/* Pile de disques posés */}
            {p.placedCount > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {/* disques retournés visibles */}
                {p.revealed.map((d, i) => (
                  <Disc key={`r${i}`} variant={d} size={32} rotated />
                ))}
                {/* le reste face cachée */}
                {Array.from({ length: p.placedCount - p.revealed.length }, (_, i) => {
                  // Pour moi-même : on affiche mes disques en clair (face cachée pour les autres,
                  // mais je dois pouvoir me souvenir de ce que j'ai posé). On les marque discrètement.
                  if (p.id === view.meId && p.myPlaced) {
                    const stackIdx = p.placedCount - 1 - p.revealed.length - i;
                    const d = p.myPlaced[stackIdx];
                    return <Disc key={`m${i}`} variant={d} size={32} />;
                  }
                  return <Disc key={`h${i}`} variant="hidden" size={32} />;
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Zone d'action */}
      <ActionZone view={view} name={name} map={map} sendAction={sendAction} bidInput={bidInput} setBidInput={setBidInput} />

      {/* Mes disques en main */}
      {view.active && (
        <div className="rounded-2xl border border-border bg-surface p-3 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Tes disques (en main)</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: view.myFlowersInHand }, (_, i) => (
              <Disc key={`f${i}`} variant="flower" />
            ))}
            {view.mySkullInHand && <Disc variant="skull" />}
            {view.myFlowersInHand === 0 && !view.mySkullInHand && (
              <span className="text-sm text-muted">Tu n&apos;as plus de disque en main.</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            Total restant : {view.myFlowersTotal} 🌸 + {view.mySkullTotal ? "1 💀" : "0 💀"} · Défis gagnés :{" "}
            {view.myWins}/2
          </p>
          {view.lostType && (
            <p className="mt-1 text-xs font-semibold text-rose-500">
              Tu as perdu {view.lostType === "skull" ? "ton crâne 💀" : "un disque-fleur 🌸"} (au hasard).
            </p>
          )}
        </div>
      )}

      {/* Résultat de la dernière manche */}
      {view.lastResult && view.phase !== "attempt" && (
        <p className="text-center text-xs text-muted">
          Dernière manche :{" "}
          {view.lastResult.type === "success" ? (
            <>
              🌸 défi réussi par <b className="text-foreground">{name(view.lastResult.challenger)}</b>{" "}
              ({view.lastResult.bid} disques)
            </>
          ) : (
            <>
              💀 défi échoué par <b className="text-foreground">{name(view.lastResult.challenger)}</b>{" "}
              chez {view.lastResult.skullOwner ? name(view.lastResult.skullOwner) : "—"}
            </>
          )}
        </p>
      )}

      {/* Journal */}
      <div>
        <h4 className="mb-2 text-sm font-bold text-muted">Journal</h4>
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-3 text-sm">
          {view.log.map((e, i) => (
            <p key={i} className={i === 0 ? "font-medium" : "text-muted"}>
              {e}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Zone d'action ─────────────────────────────

function ActionZone({
  view,
  name,
  map,
  sendAction,
  bidInput,
  setBidInput,
}: {
  view: FleurView;
  name: (id: string) => string;
  map: ReturnType<typeof toMemberMap>;
  sendAction: (a: GameAction) => void;
  bidInput: number;
  setBidInput: (n: number) => void;
}) {
  // Placement (phase 1)
  if (view.canPlace) {
    const placeDisc = (type: DiscType) => sendAction({ type: "place", payload: { type } });
    return (
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="mb-3 text-sm font-semibold">Pose UN disque face cachée :</p>
        <div className="flex flex-wrap justify-center gap-3">
          {view.myFlowersInHand > 0 && (
            <button
              onClick={() => placeDisc("flower")}
              className="grid place-items-center rounded-full transition-transform hover:-translate-y-1"
              title="Poser une fleur"
            >
              <Disc variant="flower" size={56} />
            </button>
          )}
          {view.mySkullInHand && (
            <button
              onClick={() => placeDisc("skull")}
              className="grid place-items-center rounded-full transition-transform hover:-translate-y-1"
              title="Poser ton crâne (risqué !)"
            >
              <Disc variant="skull" size={56} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (view.phase === "place") {
    const waiting = view.players.filter((p) => p.active && p.placedCount === 0).map((p) => p.name);
    return (
      <Banner>En attente de la pose des autres joueurs : {waiting.join(", ") || "tout le monde a posé."}</Banner>
    );
  }

  // Phase 2 — Mon tour : ajouter un disque OU lancer un défi
  if (view.canAddOrChallenge) {
    const addDisc = (type: DiscType) => sendAction({ type: "add", payload: { type } });
    const hasInHand = view.myFlowersInHand + (view.mySkullInHand ? 1 : 0) > 0;
    const minBid = 1;
    const maxBid = view.totalPlaced;
    const safeBid = Math.max(minBid, Math.min(maxBid, bidInput));
    return (
      <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="text-sm font-semibold">Ton tour : ajouter un disque OU lancer un défi.</p>

        {hasInHand && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {view.myFlowersInHand > 0 && (
              <button
                onClick={() => addDisc("flower")}
                className="grid place-items-center transition-transform hover:-translate-y-1"
                title="Ajouter une fleur"
              >
                <Disc variant="flower" size={48} />
              </button>
            )}
            {view.mySkullInHand && (
              <button
                onClick={() => addDisc("skull")}
                className="grid place-items-center transition-transform hover:-translate-y-1"
                title="Ajouter ton crâne (piège !)"
              >
                <Disc variant="skull" size={48} />
              </button>
            )}
          </div>
        )}

        <div className="mt-2 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-2 py-1">
          <button
            onClick={() => setBidInput(Math.max(minBid, safeBid - 1))}
            className="grid h-8 w-8 place-items-center rounded-full text-lg font-bold hover:bg-surface-2"
          >
            −
          </button>
          <span className="w-12 text-center text-xl font-extrabold tabular-nums">{safeBid}</span>
          <button
            onClick={() => setBidInput(Math.min(maxBid, safeBid + 1))}
            className="grid h-8 w-8 place-items-center rounded-full text-lg font-bold hover:bg-surface-2"
          >
            +
          </button>
          <Button size="sm" onClick={() => sendAction({ type: "challenge", payload: { bid: safeBid } })}>
            📣 Lancer le défi
          </Button>
        </div>
        <p className="text-[11px] text-muted">{maxBid} disques posés au total sur la table.</p>
      </div>
    );
  }

  // Phase 2 — défi lancé, mon tour : surenchérir ou passer
  if (view.canBid) {
    const minBid = view.currentBid + 1;
    const maxBid = view.totalPlaced;
    const safeBid = Math.max(minBid, Math.min(maxBid, bidInput));
    return (
      <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="text-sm font-semibold">Surenchéris ou passe (défi actuel : {view.currentBid})</p>
        <div className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-2 py-1">
          <button
            onClick={() => setBidInput(Math.max(minBid, safeBid - 1))}
            className="grid h-8 w-8 place-items-center rounded-full text-lg font-bold hover:bg-surface-2"
            disabled={safeBid <= minBid}
          >
            −
          </button>
          <span className="w-12 text-center text-xl font-extrabold tabular-nums">{safeBid}</span>
          <button
            onClick={() => setBidInput(Math.min(maxBid, safeBid + 1))}
            className="grid h-8 w-8 place-items-center rounded-full text-lg font-bold hover:bg-surface-2"
            disabled={safeBid >= maxBid}
          >
            +
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" disabled={safeBid > maxBid} onClick={() => sendAction({ type: "raise", payload: { bid: safeBid } })}>
            ⬆️ Surenchérir à {safeBid}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => sendAction({ type: "pass" })}>
            🙅 Passer
          </Button>
        </div>
      </div>
    );
  }

  // Phase 3 — tentative
  if (view.phase === "attempt" && view.isChallenger) {
    return (
      <div className="space-y-3 rounded-2xl border border-rose-400/50 bg-rose-500/5 p-4 text-center">
        <p className="text-sm font-semibold">
          🎯 Retourne {view.bid - view.flipsDone} disque(s) supplémentaire(s) chez un adversaire.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {view.flippableIds.map((id) => (
            <button
              key={id}
              onClick={() => sendAction({ type: "flip", payload: { targetId: id } })}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/50 px-3 py-2 text-sm font-medium transition-colors hover:border-rose-500 hover:bg-rose-500/10"
            >
              <Avatar name={name(id)} image={map[id]?.image} size={22} />
              {name(id)}
            </button>
          ))}
          {view.flippableIds.length === 0 && (
            <span className="text-sm text-muted">Aucun disque adverse disponible.</span>
          )}
        </div>
      </div>
    );
  }

  if (view.phase === "attempt") {
    return (
      <Banner>
        🎯 {name(view.challengerId ?? "")} tente sa chance ({view.flipsDone}/{view.bid})…
      </Banner>
    );
  }

  return <Banner>En attente…</Banner>;
}

function Banner({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">{children}</p>;
}
