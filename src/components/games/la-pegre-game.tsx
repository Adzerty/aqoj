"use client";

import { useState } from "react";
import type { GameAction } from "@/lib/games/types";
import type { PegreView, Role, TokenType } from "@/lib/games/la-pegre";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { InfoTip } from "../info-tip";
import { toMemberMap } from "./shared";

const ROLE_INFO: Record<Role, { label: string; icon: string; desc: string }> = {
  parrain: { label: "Parrain", icon: "🎩", desc: "Retrouve tous tes diamants volés (avec les Fidèles)." },
  voleur: { label: "Voleur", icon: "💎", desc: "Tu as pris des diamants. Si le Parrain tombe, le plus riche gagne." },
  fidele: { label: "Fidèle", icon: "🤵", desc: "Tu gagnes si le Parrain récupère tout. Aide-le… ou fais semblant." },
  agent: { label: "Agent", icon: "🕵️", desc: "Tu gagnes seul si le Parrain t'accuse (« Vide tes poches »)." },
  chauffeur: { label: "Chauffeur", icon: "🚗", desc: "Tu gagnes si ton voisin de droite fait partie des vainqueurs." },
  enfant: { label: "Enfant des rues", icon: "🧒", desc: "Tu gagnes si un Voleur gagne. Fais-toi accuser à tort !" },
};
const TOKEN_INFO: Record<TokenType, { label: string; icon: string }> = {
  fidele: { label: "Fidèle", icon: "🤵" },
  agent: { label: "Agent", icon: "🕵️" },
  chauffeur: { label: "Chauffeur", icon: "🚗" },
};

export function LaPegreGame({
  view,
  members,
  sendAction,
}: {
  view: PegreView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);
  const name = (id: string) => map[id]?.name ?? "Joueur";
  const [showRole, setShowRole] = useState(false);

  const takeLabel = (): string => {
    const t = view.myTake;
    if (view.iAmGodfather) return `Tu gardes ${view.pocketed} diamant(s) en poche.`;
    if (!t) return "Tu n'as pas encore pioché.";
    if (t.kind === "diamonds") return `Tu as volé ${t.count} diamant(s) 💎.`;
    if (t.kind === "nothing") return "Tu n'as rien pris — Enfant des rues 🧒.";
    return `Tu as pris le jeton ${TOKEN_INFO[t.token].label}.`;
  };

  return (
    <div className="space-y-5">
      {/* Bandeau */}
      {view.winner ? (
        <div className="animate-pop rounded-2xl border border-primary/50 bg-primary/10 p-4 text-center">
          <p className="text-lg font-extrabold">
            {view.winner.team === "parrain" && "🎩 Le Parrain et ses Fidèles l'emportent !"}
            {view.winner.team === "agent" && "🕵️ L'Agent infiltré gagne !"}
            {view.winner.team === "voleurs" && "💎 Les Voleurs (et Enfants des rues) l'emportent !"}
          </p>
          <p className="mt-1 text-sm text-muted">{view.winner.reason}</p>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">
          {view.phase === "godfather_setup" && "Le Parrain prépare sa boîte à cigares…"}
          {view.phase === "stealing" && (
            <>
              La boîte est chez <b className="text-foreground">{name(view.currentStealerId ?? "")}</b>…
            </>
          )}
          {view.phase === "investigation" && (
            <>
              🔎 Enquête du Parrain <b className="text-foreground">{name(view.godfatherId)}</b> — interrogez-vous à la
              voix !
            </>
          )}
        </p>
      )}

      {/* Mon rôle / ma prise */}
      <div className="rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-muted">Ton rôle</span>
          <button
            onClick={() => setShowRole((v) => !v)}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted hover:text-foreground"
          >
            {showRole ? "Masquer" : "Révéler"}
          </button>
        </div>
        {showRole ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-bold text-primary">
              {view.myRole ? `${ROLE_INFO[view.myRole].icon} ${ROLE_INFO[view.myRole].label}` : "À déterminer"}
            </span>
            <span className="text-muted">{takeLabel()}</span>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">Clique « Révéler » à l&apos;abri des regards.</p>
        )}
      </div>

      {/* Zone d'action */}
      <ActionZone view={view} name={name} map={map} sendAction={sendAction} />

      {/* Joueurs */}
      <div>
        <h4 className="mb-2 text-sm font-bold text-muted">Autour de la table</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {view.players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2.5 rounded-xl border bg-surface px-3 py-2 ${
                p.isWinner ? "border-primary ring-1 ring-primary" : "border-border"
              } ${p.eliminated ? "opacity-50" : ""}`}
            >
              <Avatar name={p.name} image={map[p.id]?.image} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">
                    {p.name}
                    {p.id === view.meId && <span className="ml-1 text-xs text-primary">(toi)</span>}
                  </span>
                  {p.isGodfather && <span title="Parrain">🎩</span>}
                  {p.hasJoker && <span title="A reçu un Joker">🍾</span>}
                  {p.eliminated && <span title="Éliminé">☠️</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
                  {p.isCurrentStealer && <span>🔍 fouille la boîte…</span>}
                  {!p.isCurrentStealer && p.hasTaken && view.phase === "stealing" && <span>a pioché</span>}
                  {p.role && (
                    <InfoTip content={<><b>{ROLE_INFO[p.role].label}</b><br />{ROLE_INFO[p.role].desc}</>}>
                      <span className="cursor-help font-semibold underline decoration-dotted underline-offset-2">
                        {ROLE_INFO[p.role].icon} {ROLE_INFO[p.role].label}
                        {p.revealedDiamonds != null && ` (${p.revealedDiamonds}💎)`}
                      </span>
                    </InfoTip>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

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

// ───────────────────────────── Boîte (affichage) ─────────────────────────────

function BoxDisplay({ box }: { box: NonNullable<PegreView["box"]> }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2 font-bold">
        💎 {box.diamonds}
      </span>
      {(["fidele", "agent", "chauffeur"] as TokenType[]).map((t) =>
        box[t] > 0 ? (
          <span key={t} className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm font-medium">
            {TOKEN_INFO[t].icon} {TOKEN_INFO[t].label} ×{box[t]}
          </span>
        ) : null,
      )}
      {box.diamonds === 0 && box.fidele + box.agent + box.chauffeur === 0 && (
        <span className="text-sm text-muted">Boîte vide</span>
      )}
    </div>
  );
}

// ───────────────────────────── Zone d'action ─────────────────────────────

function ActionZone({
  view,
  name,
  map,
  sendAction,
}: {
  view: PegreView;
  name: (id: string) => string;
  map: ReturnType<typeof toMemberMap>;
  sendAction: (a: GameAction) => void;
}) {
  if (view.phase === "godfather_setup") {
    return view.iAmGodfather ? (
      <PocketPanel onConfirm={(count) => sendAction({ type: "pocket", payload: { count } })} />
    ) : (
      <Banner>🎩 Le Parrain prépare sa boîte (il garde quelques diamants en poche…).</Banner>
    );
  }

  if (view.phase === "stealing") {
    return view.isMyStealTurn && view.box ? (
      <StealPanel key={view.currentStealerId ?? ""} view={view} sendAction={sendAction} />
    ) : (
      <Banner>🤫 {name(view.currentStealerId ?? "")} regarde discrètement dans la boîte…</Banner>
    );
  }

  if (view.phase === "investigation") {
    if (view.iAmGodfather) {
      return (
        <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-center text-sm font-semibold">
            Reste dans la boîte (à toi seul) :
          </p>
          {view.box && <BoxDisplay box={view.box} />}
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <span>💎 Récupérés : <b>{view.recovered}/{view.totalStolen}</b></span>
            <span>🍾 Jokers : <b>{view.jokers}</b></span>
          </div>
          <p className="text-center text-xs text-muted">
            Interroge à la voix, puis ordonne « Vide tes poches ! » :
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {view.accusableIds.map((id) => (
              <button
                key={id}
                onClick={() => sendAction({ type: "accuse", payload: { targetId: id } })}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-400/50 px-3 py-2 text-sm font-medium transition-colors hover:border-rose-500 hover:bg-rose-500/10"
              >
                <Avatar name={name(id)} image={map[id]?.image} size={22} />
                {name(id)}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return <Banner>🔎 Le Parrain enquête. Défends-toi (ou embrouille-le) à la voix !</Banner>;
  }

  return null;
}

function PocketPanel({ onConfirm }: { onConfirm: (count: number) => void }) {
  const [count, setCount] = useState(0);
  return (
    <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
      <p className="text-sm font-semibold">Combien de diamants gardes-tu en poche ? (0 à 5)</p>
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setCount((c) => Math.max(0, c - 1))} className="grid h-9 w-9 place-items-center rounded-full border border-border text-lg font-bold hover:bg-surface-2">−</button>
        <span className="w-16 text-center text-2xl font-extrabold tabular-nums">{count} 💎</span>
        <button onClick={() => setCount((c) => Math.min(5, c + 1))} className="grid h-9 w-9 place-items-center rounded-full border border-border text-lg font-bold hover:bg-surface-2">+</button>
      </div>
      <Button onClick={() => onConfirm(count)}>Confier la boîte ({15 - count} diamants dedans)</Button>
    </div>
  );
}

function StealPanel({ view, sendAction }: { view: PegreView; sendAction: (a: GameAction) => void }) {
  const box = view.box!;
  const [dia, setDia] = useState(1);
  const take = (payload: Record<string, unknown>) => sendAction({ type: "take", payload });

  if (view.boxEmpty) {
    return (
      <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-center">
        <p className="text-sm font-semibold">La boîte est vide — tu deviens Enfant des rues 🧒</p>
        <Button onClick={() => take({ kind: "nothing" })}>Passer la boîte</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="text-center text-sm font-semibold">À toi ! Sers-toi discrètement (diamants OU un jeton).</p>
      <BoxDisplay box={box} />

      {/* Mettre un jeton de côté (1er joueur) */}
      {view.canSetAside && (box.fidele + box.agent + box.chauffeur > 0) && (
        <div className="rounded-xl border border-dashed border-border p-2.5 text-center">
          <p className="mb-2 text-xs text-muted">Privilège du 1er joueur : mettre un jeton dans le sachet (optionnel)</p>
          <div className="flex flex-wrap justify-center gap-2">
            {(["fidele", "agent", "chauffeur"] as TokenType[]).map((t) =>
              box[t] > 0 ? (
                <Button key={t} size="sm" variant="secondary" onClick={() => sendAction({ type: "setAside", payload: { token: t } })}>
                  Cacher {TOKEN_INFO[t].icon} {TOKEN_INFO[t].label}
                </Button>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* Prendre des diamants */}
      {box.diamonds > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => setDia((d) => Math.max(1, d - 1))} className="grid h-9 w-9 place-items-center rounded-full border border-border text-lg font-bold hover:bg-surface-2">−</button>
          <span className="w-12 text-center text-xl font-extrabold tabular-nums">{Math.min(dia, box.diamonds)} 💎</span>
          <button onClick={() => setDia((d) => Math.min(box.diamonds, d + 1))} className="grid h-9 w-9 place-items-center rounded-full border border-border text-lg font-bold hover:bg-surface-2">+</button>
          <Button onClick={() => take({ kind: "diamonds", count: Math.min(dia, box.diamonds) })}>
            Voler {Math.min(dia, box.diamonds)} diamant(s)
          </Button>
        </div>
      )}

      {/* Prendre un jeton */}
      {box.fidele + box.agent + box.chauffeur > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {(["fidele", "agent", "chauffeur"] as TokenType[]).map((t) =>
            box[t] > 0 ? (
              <Button key={t} variant="secondary" onClick={() => take({ kind: "token", token: t })}>
                Prendre {TOKEN_INFO[t].icon} {TOKEN_INFO[t].label}
              </Button>
            ) : null,
          )}
        </div>
      )}

      {/* Dernier joueur : ne rien prendre */}
      {view.isLastStealer && (
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => take({ kind: "nothing" })}>
            Ne rien prendre (Enfant des rues 🧒)
          </Button>
        </div>
      )}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-border bg-surface p-3 text-center text-sm text-muted">{children}</p>;
}
