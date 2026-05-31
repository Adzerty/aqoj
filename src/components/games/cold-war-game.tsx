"use client";

import { useState } from "react";
import type { GameAction } from "@/lib/games/types";
import type { Affiliation, CWView, PersonageKind } from "@/lib/games/cold-war";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { Card, CardHand, type CardTone } from "../cards/card";
import { InfoTip } from "../info-tip";
import { toMemberMap } from "./shared";

// ─────────────────────────────────────────────────────────────────────────────
// UI Cold War — gestion des phases : draw, propose, respond (+ ONU), effect.
// On réutilise la composante `Card` pour les Personnages, et un petit jeton pour
// les identités secrètes (CIA / KGB / Hippie).
// ─────────────────────────────────────────────────────────────────────────────

const KIND_INFO: Record<PersonageKind, { label: string; icon: string; tone: CardTone; desc: string }> = {
  agent_double: { label: "Agent Double", icon: "🕴️", tone: "amber", desc: "Échange ton jeton avec celui du centre et regarde-le." },
  psychiatre: { label: "Psychiatre", icon: "🧠", tone: "violet", desc: "Échange les jetons de 2 autres joueurs." },
  politicien: { label: "Politicien", icon: "🗣️", tone: "blue", desc: "Pose ta carte devant un autre joueur, puis regarde son jeton." },
  detective: { label: "Détective", icon: "🔍", tone: "slate", desc: "Regarde secrètement un jeton (toi, autre, ou centre)." },
  diplomate: { label: "Diplomate", icon: "🎩", tone: "green", desc: "Révèle ton jeton à tous (au centre), puis échange-le avec un voisin." },
  journaliste: { label: "Journaliste", icon: "📰", tone: "red", desc: "Révèle ton jeton à tous les autres (sans le regarder)." },
  scientifique: { label: "Scientifique", icon: "🔬", tone: "violet", desc: "1er : rien. 2e : TOUTES tes cartes passent à 0 face cachée." },
  assassin: { label: "Assassin", icon: "🔫", tone: "red", desc: "Pioche une Balle, regarde-la, donne-la à un joueur face cachée." },
};

const ID_INFO: Record<Affiliation, { label: string; icon: string; cls: string }> = {
  cia: { label: "CIA", icon: "🦅", cls: "bg-blue-600 text-white border-blue-800" },
  kgb: { label: "KGB", icon: "☭", cls: "bg-rose-600 text-white border-rose-800" },
  hippie: { label: "Hippie", icon: "☮", cls: "bg-emerald-600 text-white border-emerald-800" },
};

function IdToken({ id, size = "md" }: { id: Affiliation | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-6 w-6 text-xs" : "h-9 w-9 text-base";
  if (!id) {
    return (
      <span className={`grid place-items-center rounded-full border-2 border-dashed border-border bg-surface-2 text-muted ${dim}`} title="Jeton inconnu">
        ?
      </span>
    );
  }
  const info = ID_INFO[id];
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border-2 font-extrabold shadow-sm ${info.cls} ${dim}`}
      title={info.label}
    >
      {info.icon}
    </span>
  );
}

export function ColdWarGame({
  view,
  members,
  sendAction,
}: {
  view: CWView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);
  const name = (id: string) => map[id]?.name ?? "Joueur";

  return (
    <div className="space-y-5">
      {/* Bandeau d'état */}
      {view.winner ? (
        <div className="animate-pop rounded-2xl border border-primary/50 bg-primary/10 p-4 text-center">
          <p className="text-lg font-extrabold">
            {view.winner.teams.length === 0
              ? "🤝 Égalité — tout le monde perd."
              : view.winner.teams[0] === "hippie"
                ? `☮ ${name(view.winner.players[0])} (Hippie) l'emporte seul·e !`
                : view.winner.teams[0] === "cia"
                  ? "🦅 La CIA l'emporte !"
                  : "☭ Le KGB l'emporte !"}
          </p>
          <p className="mt-1 text-sm text-muted">{view.winner.reason}</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">
          {view.phase === "draw" && (
            <>
              Tour de <b className="text-foreground">{name(view.activeId)}</b> — pioche…
            </>
          )}
          {view.phase === "propose" && (
            <>
              <b className="text-foreground">{name(view.activeId)}</b> choisit sa Proposition…
            </>
          )}
          {view.phase === "respond" && (
            <>
              Proposition de <b className="text-foreground">{name(view.activeId)}</b> en attente de
              réponse…
            </>
          )}
          {view.phase === "effect" && view.effect && (
            <>
              <b className="text-foreground">{name(view.effect.holder)}</b> applique{" "}
              {KIND_INFO[view.effect.kind].icon} {KIND_INFO[view.effect.kind].label}…
            </>
          )}
        </p>
      )}

      {/* Mon identité + dernier regard */}
      <div className="rounded-2xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-bold text-muted">Toi :</span>
            <IdToken id={view.myIdentity} size="sm" /> <b>{ID_INFO[view.myIdentity].label}</b>
          </div>
          {view.centerIdentity && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Centre (vu) :</span>
              <IdToken id={view.centerIdentity} size="sm" />
            </div>
          )}
          {view.myLastPeek && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <span>Dernier regard :</span>
              <IdToken id={view.myLastPeek.identity} size="sm" />
              <span>
                ({view.myLastPeek.pos === "__center__" ? "centre" : name(view.myLastPeek.pos)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Joueurs (vue de la table) */}
      <div className="grid gap-2 sm:grid-cols-2">
        {view.players.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border bg-surface p-2.5 ${
              p.isActive ? "border-primary ring-1 ring-primary" : p.isWinner ? "border-primary" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Avatar name={p.name} image={map[p.id]?.image} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {p.name}
                    {p.id === view.meId && <span className="ml-1 text-xs text-primary">(toi)</span>}
                  </span>
                  {p.hasUN && <span title="Jeton ONU 🕊️">🕊️</span>}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  <IdToken id={p.identityRevealed ?? p.identity} size="sm" />
                  <span>
                    {p.cardCount}/{view.endTrigger} cartes
                  </span>
                </div>
              </div>
            </div>

            {/* Cartes posées devant ce joueur */}
            {p.cards.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {p.cards.map((c) => {
                  if (c.faceDown) {
                    return (
                      <span
                        key={c.id}
                        className="grid h-9 w-9 place-items-center rounded-lg border-2 border-zinc-400 bg-zinc-700 text-xs font-bold text-white"
                        title={c.origin === "ball" ? "Carte Balle" : `Carte ${c.kind ?? "?"}`}
                      >
                        {c.origin === "ball" ? (c.value != null ? c.value : "?") : "0"}
                      </span>
                    );
                  }
                  if (c.origin === "ball") {
                    return (
                      <span key={c.id} className="grid h-9 w-9 place-items-center rounded-lg border-2 border-zinc-600 bg-zinc-800 text-xs font-bold text-white">
                        {c.value}
                      </span>
                    );
                  }
                  const info = KIND_INFO[c.kind!];
                  return (
                    <InfoTip key={c.id} content={<><b>{info.label}</b> ({c.value})<br />{info.desc}</>}>
                      <span
                        className={`grid h-9 w-9 cursor-help place-items-center rounded-lg border-2 text-base shadow-sm ${
                          info.tone === "blue" ? "bg-sky-500 border-sky-700" :
                          info.tone === "red" ? "bg-rose-500 border-rose-700" :
                          info.tone === "green" ? "bg-emerald-500 border-emerald-700" :
                          info.tone === "amber" ? "bg-amber-500 border-amber-700" :
                          info.tone === "violet" ? "bg-violet-500 border-violet-700" :
                          "bg-slate-600 border-slate-800"
                        }`}
                      >
                        {info.icon}
                      </span>
                    </InfoTip>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Zone d'action */}
      <ActionZone view={view} name={name} map={map} sendAction={sendAction} />

      {/* Balles que je connais */}
      {view.myBallValues.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-3 text-center text-xs text-muted">
          Balles que tu as posées :
          {view.myBallValues.map((b) => (
            <span key={b.ballId} className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-zinc-700 font-bold text-white">
              {b.value}
            </span>
          ))}
        </div>
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

// Affiche une main de cartes Personnage révélées, chacune avec le tooltip du rôle.
function RevealedHand({ cards }: { cards: { id: string; kind: PersonageKind; value: number }[] }) {
  return (
    <CardHand>
      {cards.map((c) => {
        const info = KIND_INFO[c.kind];
        return (
          <InfoTip key={c.id} content={<><b>{info.label}</b> ({c.value > 0 ? "+" : ""}{c.value})<br />{info.desc}</>}>
            <Card
              size="sm"
              tone={info.tone}
              title={`${c.value > 0 ? "+" : ""}${c.value}`}
              icon={info.icon}
              subtitle={info.label}
            />
          </InfoTip>
        );
      })}
    </CardHand>
  );
}

// ───────────────────────────── Zone d'action ─────────────────────────────

function ActionZone({
  view,
  name,
  map,
  sendAction,
}: {
  view: CWView;
  name: (id: string) => string;
  map: ReturnType<typeof toMemberMap>;
  sendAction: (a: GameAction) => void;
}) {
  // Intervention ONU (priorité visuelle)
  if (view.canIntervene) {
    return (
      <div className="space-y-2 rounded-2xl border border-emerald-400/50 bg-emerald-500/5 p-3 text-center">
        <p className="text-sm font-semibold">🕊️ Tu as le jeton ONU — tu peux intercepter la Proposition !</p>
        <Button onClick={() => sendAction({ type: "intervene" })}>
          Intercepter (la carte vient chez toi)
        </Button>
      </div>
    );
  }

  // Phase draw : pioche les 2 cartes
  if (view.canDraw) {
    return (
      <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="text-sm font-semibold">
          Pioche jusqu&apos;à révéler 2 personnages différents ({view.revealed.length}/2)
        </p>
        {view.revealed.length > 0 && <RevealedHand cards={view.revealed} />}
        <Button onClick={() => sendAction({ type: "draw" })}>Piocher</Button>
      </div>
    );
  }

  // Phase propose : choisis la carte + la cible
  if (view.canPropose && view.myHand) {
    return <ProposePanel view={view} name={name} map={map} sendAction={sendAction} />;
  }

  // Phase respond (cible)
  if (view.canRespond && view.propositionVisible) {
    const from = view.propositionVisible.from;
    return (
      <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="text-sm">
          <b className="text-foreground">{name(from)}</b> te propose une carte (face cachée).
          Acceptes-tu ?
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => sendAction({ type: "respond", payload: { accept: true } })}>
            ✅ Accepter (chez moi)
          </Button>
          <Button variant="secondary" onClick={() => sendAction({ type: "respond", payload: { accept: false } })}>
            🚫 Refuser (chez {name(from)})
          </Button>
        </div>
      </div>
    );
  }

  // Phase respond (non-cible) : informer
  if (view.phase === "respond" && view.propositionVisible) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">
        ⏳ <b className="text-foreground">{name(view.propositionVisible.to)}</b> décide…
      </p>
    );
  }

  // Phase effect
  if (view.effect) return <EffectPanel view={view} name={name} map={map} sendAction={sendAction} />;

  // Phases draw / propose vues par les autres joueurs : les cartes piochées sont
  // publiques (tout le monde connaît les options ; seule la Proposition reste secrète).
  if ((view.phase === "draw" || view.phase === "propose") && view.revealed.length > 0) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 text-center">
        <p className="text-sm text-muted">
          {view.phase === "draw" ? (
            <><b className="text-foreground">{name(view.activeId)}</b> a pioché :</>
          ) : (
            <><b className="text-foreground">{name(view.activeId)}</b> choisit sa Proposition parmi :</>
          )}
        </p>
        <RevealedHand cards={view.revealed} />
      </div>
    );
  }

  if (view.phase === "draw") {
    return (
      <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">
        <b className="text-foreground">{name(view.activeId)}</b> pioche…
      </p>
    );
  }

  // Sinon : observer
  return (
    <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">
      En attente de <b className="text-foreground">{name(view.activeId)}</b>…
    </p>
  );
}

// ───────────────────────────── Propose ─────────────────────────────

function ProposePanel({
  view,
  name,
  map,
  sendAction,
}: {
  view: CWView;
  name: (id: string) => string;
  map: ReturnType<typeof toMemberMap>;
  sendAction: (a: GameAction) => void;
}) {
  const [cardId, setCardId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  if (!view.myHand) return null;
  return (
    <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="text-center text-sm font-semibold">
        Choisis UNE carte (à proposer) puis un joueur cible. L&apos;autre carte sera défaussée.
      </p>
      <CardHand>
        {view.myHand.map((c) => {
          const info = KIND_INFO[c.kind];
          return (
            <InfoTip key={c.id} content={<><b>{info.label}</b> ({c.value > 0 ? "+" : ""}{c.value})<br />{info.desc}</>}>
              <Card
                size="md"
                tone={info.tone}
                title={`${c.value > 0 ? "+" : ""}${c.value}`}
                icon={info.icon}
                subtitle={info.label}
                selectable
                selected={cardId === c.id}
                onSelect={() => setCardId(c.id)}
              />
            </InfoTip>
          );
        })}
      </CardHand>
      {cardId && (
        <div className="space-y-2 text-center">
          <p className="text-xs text-muted">Choisis la cible :</p>
          <div className="flex flex-wrap justify-center gap-2">
            {view.players
              .filter((p) => p.id !== view.meId)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTargetId(p.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    targetId === p.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  <Avatar name={p.name} image={map[p.id]?.image} size={22} />
                  {p.name}
                </button>
              ))}
          </div>
          {targetId && (
            <Button onClick={() => sendAction({ type: "propose", payload: { cardId, targetId } })}>
              📤 Proposer à {name(targetId)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Effect ─────────────────────────────

function EffectPanel({
  view,
  name,
  map,
  sendAction,
}: {
  view: CWView;
  name: (id: string) => string;
  map: ReturnType<typeof toMemberMap>;
  sendAction: (a: GameAction) => void;
}) {
  const eff = view.effect!;
  const info = KIND_INFO[eff.kind];
  if (!eff.iAmHolder) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">
        ⏳ <b className="text-foreground">{name(eff.holder)}</b> applique{" "}
        {info.icon} {info.label}…
      </p>
    );
  }

  // Détective : choisir une position (self / autre / centre)
  if (eff.kind === "detective") {
    return (
      <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="text-sm font-semibold">🔍 Regarde un jeton (toi, un autre, ou le centre) :</p>
        <div className="flex flex-wrap justify-center gap-2">
          {view.players.map((p) => (
            <button
              key={p.id}
              onClick={() => sendAction({ type: "effectAction", payload: { position: p.id } })}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary"
            >
              <Avatar name={p.name} image={map[p.id]?.image} size={22} />
              {p.name}
            </button>
          ))}
          <button
            onClick={() => sendAction({ type: "effectAction", payload: { position: "__center__" } })}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary"
          >
            🌐 Centre
          </button>
        </div>
      </div>
    );
  }

  // Diplomate étape 0 : confirmer la révélation, puis étape 1 : choisir voisin
  if (eff.kind === "diplomate") {
    if (eff.step === 0) {
      return (
        <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
          <p className="text-sm font-semibold">🎩 Révèle ton jeton à tous les joueurs.</p>
          <Button onClick={() => sendAction({ type: "effectAction", payload: {} })}>Révéler</Button>
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="text-sm font-semibold">Échange ton jeton avec quel voisin ?</p>
        <div className="flex justify-center gap-2">
          <Button onClick={() => sendAction({ type: "effectAction", payload: { choice: "left" } })}>
            ⬅️ Voisin de gauche
          </Button>
          <Button onClick={() => sendAction({ type: "effectAction", payload: { choice: "right" } })}>
            Voisin de droite ➡️
          </Button>
        </div>
      </div>
    );
  }

  // Assassin étape 0 : piocher une Balle (aucune cible à choisir encore).
  if (eff.kind === "assassin" && eff.step === 0) {
    return (
      <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="text-sm font-semibold">🔫 Pioche une Balle et regarde sa valeur…</p>
        <Button onClick={() => sendAction({ type: "effectAction", payload: {} })}>
          Piocher une Balle
        </Button>
      </div>
    );
  }

  // Psychiatre / Politicien / Assassin : sélectionner parmi `effectChoices`
  if (view.effectChoices.length > 0) {
    const intro =
      eff.kind === "psychiatre"
        ? `🧠 Sélectionne 2 autres joueurs (${eff.step + 1}/2)…`
        : eff.kind === "politicien"
          ? "🗣️ Pose ta carte devant un joueur (et regarde son jeton) :"
          : eff.kind === "assassin"
            ? "🔫 Donne la Balle à un joueur (face cachée) :"
            : "Choisis une cible :";
    return (
      <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="text-sm font-semibold">{intro}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {view.effectChoices.map((id) => (
            <button
              key={id}
              onClick={() => sendAction({ type: "effectAction", payload: { targetId: id } })}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:border-primary"
            >
              <Avatar name={name(id)} image={map[id]?.image} size={22} />
              {name(id)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">
      {info.icon} {info.label} appliqué…
    </p>
  );
}
