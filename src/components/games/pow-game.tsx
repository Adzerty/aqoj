"use client";

import { useState } from "react";
import type { GameAction } from "@/lib/games/types";
import type { CardType, PowCardView, PowView, Role } from "@/lib/games/pow";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { Card, CardHand, type CardTone } from "../cards/card";
import { toMemberMap } from "./shared";

const CARD_INFO: Record<CardType, { label: string; icon: string; tone: CardTone }> = {
  bang: { label: "BANG!", icon: "🔫", tone: "red" },
  missed: { label: "Manqué!", icon: "🛡️", tone: "blue" },
  beer: { label: "Bière", icon: "🍺", tone: "green" },
  saloon: { label: "Saloon", icon: "🍻", tone: "green" },
  stagecoach: { label: "Diligence", icon: "🚍", tone: "amber" },
  wells_fargo: { label: "Convoi", icon: "🚂", tone: "amber" },
  general_store: { label: "Magasin", icon: "🏪", tone: "amber" },
  panic: { label: "Braquage", icon: "🫳", tone: "violet" },
  cat_balou: { label: "Coup de foudre", icon: "💨", tone: "violet" },
  duel: { label: "Duel", icon: "⚔️", tone: "red" },
  indians: { label: "Indiens", icon: "🏹", tone: "red" },
  gatling: { label: "Gatling", icon: "💥", tone: "red" },
  barrel: { label: "Tonneau", icon: "🛢️", tone: "slate" },
  scope: { label: "Lunette", icon: "🔭", tone: "slate" },
  mustang: { label: "Mustang", icon: "🐴", tone: "slate" },
  jail: { label: "Prison", icon: "🔒", tone: "slate" },
  dynamite: { label: "Dynamite", icon: "🧨", tone: "red" },
  volcanic: { label: "Volcanic", icon: "🌋", tone: "amber" },
  schofield: { label: "Schofield", icon: "🔫", tone: "amber" },
  remington: { label: "Remington", icon: "🔫", tone: "amber" },
  carbine: { label: "Carabine", icon: "🔫", tone: "amber" },
  winchester: { label: "Winchester", icon: "🔫", tone: "amber" },
};

const ROLE_INFO: Record<Role, { label: string; icon: string }> = {
  sheriff: { label: "Shérif", icon: "⭐" },
  deputy: { label: "Adjoint", icon: "🤝" },
  outlaw: { label: "Hors-la-loi", icon: "🐴" },
  renegade: { label: "Renégat", icon: "🃏" },
};

const SUIT = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" } as const;
const rankLabel = (n: number) => (n === 1 ? "A" : n === 11 ? "J" : n === 12 ? "Q" : n === 13 ? "K" : `${n}`);

const NEEDS_TARGET = new Set<CardType>(["bang", "duel", "jail", "panic", "cat_balou"]);

export function PowGame({
  view,
  members,
  sendAction,
}: {
  view: PowView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);
  const name = (id: string) => map[id]?.name ?? "Joueur";
  const [sel, setSel] = useState<{ cardId: string; type: CardType } | null>(null);
  const [showRole, setShowRole] = useState(false);

  const canMiss = (c: PowCardView) =>
    c.type === "missed" || (view.myChar === "calamity_janet" && c.type === "bang");
  const canBang = (c: PowCardView) =>
    c.type === "bang" || (view.myChar === "calamity_janet" && c.type === "missed");

  const pending = view.pending;
  const reacting = pending?.forMe ?? false;

  // Cible cliquable pour la carte sélectionnée
  function eligibleTarget(pid: string): boolean {
    if (!sel) return false;
    const p = view.players.find((x) => x.id === pid);
    if (!p || !p.alive || pid === view.meId) return false;
    if (sel.type === "bang") return p.inRange;
    if (sel.type === "jail") return p.role !== "sheriff" && !p.jailed;
    if (sel.type === "panic") return (p.distance ?? 99) <= 1;
    return true; // duel, cat_balou
  }

  function playCard(c: PowCardView) {
    if (NEEDS_TARGET.has(c.type)) {
      setSel(sel?.cardId === c.id ? null : { cardId: c.id, type: c.type });
    } else {
      sendAction({ type: "play", payload: { cardId: c.id } });
      setSel(null);
    }
  }

  function onTargetClick(pid: string, stealId?: string) {
    if (!sel) return;
    sendAction({ type: "play", payload: { cardId: sel.cardId, targetId: pid, ...(stealId ? { stealId } : {}) } });
    setSel(null);
  }

  // ─────────── rendu ───────────
  return (
    <div className="space-y-5">
      {/* Bandeau de tour / fin */}
      {view.winner ? (
        <div className="animate-pop rounded-2xl border border-primary/50 bg-primary/10 p-4 text-center">
          <p className="text-lg font-extrabold">
            {view.winner === "sheriff" && "⭐ Le Shérif et ses Adjoints l'emportent !"}
            {view.winner === "outlaws" && "🐴 Les Hors-la-loi l'emportent !"}
            {view.winner === "renegade" && "🃏 Le Renégat l'emporte !"}
          </p>
          <p className="mt-1 text-xs text-muted">Les rôles sont révélés ci-dessous.</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">
          Tour de <b className="text-foreground">{name(view.currentId)}</b>
          {view.isMyTurn && " — à toi de jouer !"}
        </p>
      )}

      {/* Ton rôle / personnage */}
      <div className="rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-muted">Ton identité</span>
          <button
            onClick={() => setShowRole((v) => !v)}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted hover:text-foreground"
          >
            {showRole ? "Masquer" : "Révéler"}
          </button>
        </div>
        {showRole && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-bold text-primary">
              {ROLE_INFO[view.myRole].icon} {ROLE_INFO[view.myRole].label}
            </span>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold">
              🤠 {view.players.find((p) => p.id === view.meId)?.charName}
            </span>
            <span className="text-xs text-muted">
              {view.myRole === "sheriff" && "Élimine Hors-la-loi et Renégat."}
              {view.myRole === "deputy" && "Protège le Shérif."}
              {view.myRole === "outlaw" && "Tue le Shérif."}
              {view.myRole === "renegade" && "Sois le dernier en vie."}
            </span>
          </div>
        )}
      </div>

      {/* Joueurs */}
      <div className="grid gap-2 sm:grid-cols-2">
        {view.players.map((p) => {
          const targetable = sel && eligibleTarget(p.id);
          return (
            <div
              key={p.id}
              onClick={() => targetable && onTargetClick(p.id)}
              className={`rounded-xl border p-2.5 transition-all ${
                p.isCurrent ? "border-primary ring-1 ring-primary" : "border-border"
              } ${p.alive ? "" : "opacity-50"} ${targetable ? "cursor-pointer ring-2 ring-rose-400 hover:-translate-y-0.5" : ""}`}
            >
              <div className="flex items-center gap-2">
                <Avatar name={name(p.id)} image={map[p.id]?.image} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{name(p.id)}</span>
                    {p.id === view.meId && <span className="text-xs text-primary">(toi)</span>}
                    {!p.alive && <span title="Éliminé">☠️</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
                    <span title={p.charName}>🤠 {p.charName}</span>
                    {p.role && (
                      <span className="font-semibold">
                        · {ROLE_INFO[p.role].icon} {ROLE_INFO[p.role].label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-rose-500">
                    {"❤".repeat(Math.max(0, p.hp))}
                    <span className="text-muted/40">{"❤".repeat(Math.max(0, p.maxHp - p.hp))}</span>
                  </div>
                  <div className="text-[10px] text-muted">
                    {p.id !== view.meId && p.distance != null && `dist. ${p.distance} · `}
                    {p.handCount} carte{p.handCount > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              {/* marqueurs & cartes bleues */}
              {(p.board.length > 0 || p.jailed || p.hasDynamite) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.jailed && <Marker>🔒 Prison</Marker>}
                  {p.hasDynamite && <Marker>🧨 Dynamite</Marker>}
                  {p.board.map((c) => {
                    const stealable =
                      sel && (sel.type === "panic" || sel.type === "cat_balou") && eligibleTarget(p.id);
                    return (
                      <button
                        key={c.id}
                        disabled={!stealable}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (stealable) onTargetClick(p.id, c.id);
                        }}
                        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${
                          stealable ? "cursor-pointer border-rose-400 hover:bg-rose-500/10" : "border-border bg-surface-2"
                        }`}
                      >
                        {CARD_INFO[c.type].icon} {CARD_INFO[c.type].label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Zone d'action */}
      <ActionZone view={view} name={name} sendAction={sendAction} canMiss={canMiss} canBang={canBang} />

      {/* Ma main */}
      {view.alive && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-bold text-muted">
              Ta main · {view.hand.length}
              {view.phase === "discard" && ` (défausse jusqu'à ${view.handLimit})`}
            </h4>
            {sel && <span className="text-xs text-rose-500">Choisis une cible…</span>}
          </div>
          <CardHand className="justify-start">
            {view.hand.map((c) => {
              const info = CARD_INFO[c.type];
              const selected = sel?.cardId === c.id;
              const interactive = handCardInteractive(view, c, reacting, canMiss, canBang);
              return (
                <Card
                  key={c.id}
                  size="sm"
                  tone={info.tone}
                  title={`${rankLabel(c.rank)}${SUIT[c.suit]}`}
                  icon={info.icon}
                  subtitle={info.label}
                  selectable={interactive}
                  selected={selected}
                  disabled={!interactive}
                  onSelect={() => onHandCardClick(view, c, reacting, sendAction, playCard, canMiss, canBang)}
                />
              );
            })}
            {view.hand.length === 0 && <p className="py-4 text-sm text-muted">Main vide.</p>}
          </CardHand>
        </div>
      )}

      {/* Journal */}
      <div>
        <h4 className="mb-2 text-sm font-bold text-muted">Journal</h4>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-3 text-sm">
          {view.log.map((e, i) => (
            <p key={i} className={i === 0 ? "font-medium" : "text-muted"}>{e}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

// Une carte de la main est-elle cliquable dans le contexte courant ?
function handCardInteractive(
  view: PowView,
  c: PowCardView,
  reacting: boolean,
  canMiss: (c: PowCardView) => boolean,
  canBang: (c: PowCardView) => boolean,
): boolean {
  if (reacting && view.pending) {
    const k = view.pending.kind;
    if (k === "bang" || k === "gatling") return canMiss(c);
    if (k === "indians" || k === "duel") return canBang(c);
    if (k === "death_save") return c.type === "beer";
    return false;
  }
  if (view.isMyTurn && view.phase === "play") return true;
  if (view.isMyTurn && view.phase === "discard") return true;
  return false;
}

function onHandCardClick(
  view: PowView,
  c: PowCardView,
  reacting: boolean,
  sendAction: (a: GameAction) => void,
  playCard: (c: PowCardView) => void,
  canMiss: (c: PowCardView) => boolean,
  canBang: (c: PowCardView) => boolean,
) {
  if (reacting && view.pending) {
    const k = view.pending.kind;
    if ((k === "bang" || k === "gatling") && canMiss(c))
      sendAction({ type: "respond", payload: { use: "missed", cardId: c.id } });
    else if ((k === "indians" || k === "duel") && canBang(c))
      sendAction({ type: "respond", payload: { use: "bang", cardId: c.id } });
    else if (k === "death_save" && c.type === "beer")
      sendAction({ type: "respond", payload: { use: "beer", cardId: c.id } });
    return;
  }
  if (view.phase === "discard") {
    sendAction({ type: "discard", payload: { cardId: c.id } });
    return;
  }
  if (view.phase === "play") playCard(c);
}

function Marker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
      {children}
    </span>
  );
}

// ───────────────────────────── Zone d'action contextuelle ─────────────────────────────

function ActionZone({
  view,
  name,
  sendAction,
  canMiss,
  canBang,
}: {
  view: PowView;
  name: (id: string) => string;
  sendAction: (a: GameAction) => void;
  canMiss: (c: PowCardView) => boolean;
  canBang: (c: PowCardView) => boolean;
}) {
  const p = view.pending;

  // Réaction demandée à moi
  if (p?.forMe) {
    const hasBarrel = false; // le Tonneau passe par un bouton dédié ci-dessous
    void hasBarrel;
    return (
      <div className="rounded-2xl border border-rose-400/50 bg-rose-500/5 p-4 text-center">
        {p.kind === "bang" && (
          <>
            <p className="text-sm font-semibold">
              {name(p.source ?? "")} te tire dessus !{" "}
              {p.hits === 2 && <span className="text-rose-500">(Slab : 2 Manqué! requis — {p.missed}/2)</span>}
            </p>
            <p className="mt-1 text-xs text-muted">Joue un Manqué! depuis ta main, ou :</p>
          </>
        )}
        {p.kind === "gatling" && <p className="text-sm font-semibold">Gatling ! Joue un Manqué! ou encaisse.</p>}
        {p.kind === "indians" && <p className="text-sm font-semibold">Les Indiens ! Défausse un BANG! ou encaisse.</p>}
        {p.kind === "duel" && <p className="text-sm font-semibold">Duel ! Riposte avec un BANG! ou abandonne.</p>}
        {p.kind === "death_save" && (
          <p className="text-sm font-semibold">Tu es à terre ! Bois une Bière pour survivre, ou accepte la mort.</p>
        )}
        {p.kind === "general_store" && <p className="text-sm font-semibold">Choisis une carte au Magasin :</p>}

        {/* Boutons de réaction */}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {(p.kind === "bang" || p.kind === "gatling") && (
            <Button variant="secondary" size="sm" onClick={() => sendAction({ type: "respond", payload: { use: "barrel" } })}>
              🛢️ Tonneau
            </Button>
          )}
          {(p.kind === "bang" || p.kind === "gatling" || p.kind === "indians") && (
            <Button variant="secondary" size="sm" onClick={() => sendAction({ type: "respond", payload: { use: "take" } })}>
              Encaisser (-1 ❤)
            </Button>
          )}
          {p.kind === "duel" && (
            <Button variant="secondary" size="sm" onClick={() => sendAction({ type: "respond", payload: { use: "take" } })}>
              Abandonner (-1 ❤)
            </Button>
          )}
          {p.kind === "death_save" && (
            <Button variant="danger" size="sm" onClick={() => sendAction({ type: "respond", payload: { use: "accept" } })}>
              Accepter la mort ☠️
            </Button>
          )}
        </div>

        {p.kind === "general_store" && p.storeCards && (
          <CardHand className="mt-3">
            {p.storeCards.map((c) => (
              <Card
                key={c.id}
                size="sm"
                tone={CARD_INFO[c.type].tone}
                title={`${rankLabel(c.rank)}${SUIT[c.suit]}`}
                icon={CARD_INFO[c.type].icon}
                subtitle={CARD_INFO[c.type].label}
                selectable
                onSelect={() => sendAction({ type: "pick", payload: { cardId: c.id } })}
              />
            ))}
          </CardHand>
        )}
      </div>
    );
  }

  // Réaction demandée à quelqu'un d'autre
  if (p && !p.forMe) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">
        En attente de <b className="text-foreground">{name(p.actor ?? "")}</b>…
      </p>
    );
  }

  // Mon tour
  if (view.isMyTurn) {
    if (view.phase === "draw") return <DrawPanel view={view} name={name} sendAction={sendAction} />;
    if (view.phase === "play")
      return (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-3">
          <span className="text-sm text-muted">Joue tes cartes, puis termine ton tour.</span>
          <Button size="sm" onClick={() => sendAction({ type: "endTurn" })}>
            Terminer le tour
          </Button>
        </div>
      );
    if (view.phase === "discard")
      return (
        <p className="rounded-2xl border border-amber-400/50 bg-amber-500/5 p-3 text-center text-sm font-semibold">
          Défausse-toi jusqu&apos;à {view.handLimit} carte(s) — clique dans ta main.
        </p>
      );
  }

  void canMiss;
  void canBang;
  return (
    <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">
      C&apos;est au tour de <b className="text-foreground">{name(view.currentId)}</b>.
    </p>
  );
}

function DrawPanel({
  view,
  name,
  sendAction,
}: {
  view: PowView;
  name: (id: string) => string;
  sendAction: (a: GameAction) => void;
}) {
  // Kit Carson : choix de la carte à reposer
  if (view.kitPreview) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-3 text-center">
        <p className="mb-2 text-sm font-semibold">Kit Carson : garde 2 cartes, repose la 3e sur la pioche.</p>
        <CardHand>
          {view.kitPreview.map((c) => (
            <Card
              key={c.id}
              size="sm"
              tone={CARD_INFO[c.type].tone}
              title={`${rankLabel(c.rank)}${SUIT[c.suit]}`}
              icon={CARD_INFO[c.type].icon}
              subtitle="Reposer"
              selectable
              onSelect={() => sendAction({ type: "kitReturn", payload: { cardId: c.id } })}
            />
          ))}
        </CardHand>
      </div>
    );
  }

  const ch = view.myChar;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-3">
      <span className="text-sm font-semibold">Phase de pioche :</span>
      <Button size="sm" onClick={() => sendAction({ type: "draw" })}>
        Piocher {ch === "black_jack" ? "(Black Jack)" : "2 cartes"}
      </Button>
      {ch === "pedro_ramirez" && view.discardTop && (
        <Button size="sm" variant="secondary" onClick={() => sendAction({ type: "draw", payload: { fromDiscard: true } })}>
          1re carte sur la défausse ({CARD_INFO[view.discardTop.type].icon})
        </Button>
      )}
      {ch === "jesse_jones" && (
        <span className="text-xs text-muted">
          (Jesse Jones : clique un joueur ci-dessus pour lui piocher sa 1re carte —{" "}
          <button
            className="underline"
            onClick={() => {
              const target = view.players.find((p) => p.id !== view.meId && p.alive && p.handCount > 0);
              if (target) sendAction({ type: "draw", payload: { targetId: target.id } });
              else sendAction({ type: "draw" });
            }}
          >
            voler le 1er dispo
          </button>
          )
        </span>
      )}
      {ch === "jesse_jones" &&
        view.players
          .filter((p) => p.id !== view.meId && p.alive && p.handCount > 0)
          .map((p) => (
            <Button key={p.id} size="sm" variant="secondary" onClick={() => sendAction({ type: "draw", payload: { targetId: p.id } })}>
              Voler {name(p.id)}
            </Button>
          ))}
    </div>
  );
}
