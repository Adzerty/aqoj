"use client";

import { useState } from "react";
import type { GameAction } from "@/lib/games/types";
import type { FvDView, Policy, Role } from "@/lib/games/fascist-vs-democrats";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { Card, CardHand } from "../cards/card";
import { toMemberMap } from "./shared";

// ───────────────────────────── Helpers d'affichage ─────────────────────────────

const ROLE_INFO: Record<Role, { label: string; tone: "blue" | "red"; icon: string }> = {
  liberal: { label: "Démocrate", tone: "blue", icon: "🕊️" },
  fascist: { label: "Fasciste", tone: "red", icon: "💀" },
  hitler: { label: "Chef fasciste", tone: "red", icon: "🎩" },
};

const POLICY_INFO: Record<Policy, { label: string; tone: "blue" | "red"; icon: string }> = {
  liberal: { label: "Démocrate", tone: "blue", icon: "🕊️" },
  fascist: { label: "Fasciste", tone: "red", icon: "💀" },
};

const POWER_EMOJI: Record<string, string> = {
  investigate: "🔎",
  special: "👑",
  peek: "🔍",
  execution: "🔫",
};

// Pouvoir débloqué par la n-ième loi fasciste (1-indexé) selon le nombre de joueurs.
function powerForSlot(playerCount: number, n: number): string | null {
  if (playerCount <= 6) return n === 3 ? "peek" : n === 4 || n === 5 ? "execution" : null;
  if (playerCount <= 8)
    return n === 2 ? "investigate" : n === 3 ? "special" : n === 4 || n === 5 ? "execution" : null;
  return n <= 2 ? "investigate" : n === 3 ? "special" : n === 4 || n === 5 ? "execution" : null;
}

// ───────────────────────────── Composant principal ─────────────────────────────

export function FascistVsDemocratsGame({
  view,
  members,
  sendAction,
}: {
  view: FvDView;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  const map = toMemberMap(members);
  const [showRole, setShowRole] = useState(false);
  const name = (id: string) => map[id]?.name ?? "Joueur";

  const myRole = ROLE_INFO[view.myRole];
  const teammates = view.players.filter(
    (p) => p.id !== view.meId && (p.knownRole === "fascist" || p.knownRole === "hitler"),
  );

  return (
    <div className="space-y-6">
      {/* ───── Plateau ───── */}
      <Board view={view} />

      {/* ───── Ton rôle secret ───── */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-muted">Ton rôle (secret)</h4>
          <button
            onClick={() => setShowRole((v) => !v)}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted transition-colors hover:text-foreground"
          >
            {showRole ? "Masquer" : "Révéler"}
          </button>
        </div>
        {showRole ? (
          <div className="mt-3 flex items-center gap-4">
            <Card
              size="md"
              tone={myRole.tone}
              title="Rôle"
              icon={myRole.icon}
              subtitle={myRole.label}
            />
            <div className="text-sm">
              {view.myRole === "liberal" ? (
                <p className="text-muted">
                  Tu es du camp des <b className="text-foreground">Démocrates</b>. Démasque les
                  Fascistes et fais adopter 5 lois Démocrates.
                </p>
              ) : (
                <>
                  <p className="text-muted">
                    Tu es du camp des <b className="text-foreground">Fascistes</b>.
                    {view.myRole === "hitler" && " Tu es leur chef secret."}
                  </p>
                  {teammates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {teammates.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-300"
                        >
                          <Avatar name={name(t.id)} image={map[t.id]?.image} size={16} />
                          {name(t.id)}
                          {t.knownRole === "hitler" && " 🎩"}
                        </span>
                      ))}
                    </div>
                  )}
                  {view.myRole === "hitler" && view.playerCount >= 7 && (
                    <p className="mt-1 text-xs text-muted">
                      (À 7 joueurs et plus, tu ne connais pas tes alliés — à toi de les repérer.)
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Clique sur « Révéler » à l&apos;abri des regards pour voir ton camp.
          </p>
        )}
      </div>

      {/* ───── Panneau d'action ───── */}
      <ActionPanel view={view} name={name} map={map} sendAction={sendAction} />

      {/* ───── Joueurs ───── */}
      <div>
        <h4 className="mb-2 text-sm font-bold text-muted">Joueurs</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {view.players.map((p) => (
            <PlayerRow key={p.id} p={p} view={view} name={name} image={map[p.id]?.image} />
          ))}
        </div>
      </div>

      {/* ───── Journal ───── */}
      {view.log.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-muted">Journal</h4>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-2xl border border-border bg-surface p-3 text-sm">
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

// ───────────────────────────── Plateau (pistes de lois) ─────────────────────────────

function Board({ view }: { view: FvDView }) {
  const trackerDots = [0, 1, 2];
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      {/* Piste Démocrate */}
      <Track
        label="Lois Démocrates"
        slots={view.liberalGoal}
        filled={view.liberalPolicies}
        icon="🕊️"
      />
      {/* Piste Fasciste avec pouvoirs */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-bold text-rose-600 dark:text-rose-300">Lois Fascistes</span>
          <span className="text-xs text-muted">{view.fascistPolicies}/6</span>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: view.fascistGoal }, (_, i) => {
            const n = i + 1;
            const power = powerForSlot(view.playerCount, n);
            const filled = i < view.fascistPolicies;
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`grid h-10 w-full place-items-center rounded-lg border text-lg ${
                    filled
                      ? "border-rose-400 bg-rose-500/15"
                      : "border-dashed border-border bg-surface-2"
                  }`}
                >
                  {filled ? "💀" : ""}
                </div>
                <span className="h-4 text-[11px] leading-none text-muted" title={power ?? undefined}>
                  {n === 6 ? "🏴" : power ? POWER_EMOJI[power] : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Marqueur d'élection + pioche */}
      <div className="flex items-center justify-between pt-1 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span>Échecs d&apos;élection :</span>
          <div className="flex gap-1">
            {trackerDots.map((i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${
                  i < view.electionTracker ? "bg-amber-500" : "bg-surface-2 ring-1 ring-border"
                }`}
              />
            ))}
          </div>
        </div>
        <span>
          Pioche {view.deckSize} · Défausse {view.discardSize}
        </span>
      </div>
    </div>
  );
}

function Track({
  label,
  slots,
  filled,
  icon,
}: {
  label: string;
  slots: number;
  filled: number;
  icon: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold text-sky-600 dark:text-sky-300">{label}</span>
        <span className="text-xs text-muted">
          {filled}/{slots}
        </span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: slots }, (_, i) => (
          <div
            key={i}
            className={`grid h-10 flex-1 place-items-center rounded-lg border text-lg ${
              i < filled ? "border-sky-400 bg-sky-500/15" : "border-dashed border-border bg-surface-2"
            }`}
          >
            {i < filled ? icon : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── Ligne joueur ─────────────────────────────

function PlayerRow({
  p,
  view,
  name,
  image,
}: {
  p: FvDView["players"][number];
  view: FvDView;
  name: (id: string) => string;
  image: string | null | undefined;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border bg-surface px-3 py-2 ${
        p.alive ? "border-border" : "border-border/50 opacity-50"
      }`}
    >
      <Avatar name={name(p.id)} image={image} size={30} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">
            {name(p.id)}
            {p.id === view.meId && <span className="ml-1 text-xs text-primary">(toi)</span>}
          </span>
          {!p.alive && <span title="Exécuté">☠️</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {p.isPresident && <Tag>🏛️ Président</Tag>}
          {p.isChancellor && <Tag>👔 Chancelier</Tag>}
          {p.isLastPresident && !p.isPresident && <Tag muted>ex-Prés.</Tag>}
          {p.isLastChancellor && !p.isChancellor && <Tag muted>ex-Chanc.</Tag>}
          {p.knownRole && p.id !== view.meId && (
            <Tag tone={p.knownRole === "liberal" ? "blue" : "red"}>
              {p.knownRole === "liberal" ? "🕊️ Démocrate" : p.knownRole === "hitler" ? "🎩 Chef" : "💀 Fasciste"}
            </Tag>
          )}
          {p.knownParty && !p.knownRole && (
            <Tag tone={p.knownParty === "liberal" ? "blue" : "red"}>
              Loyauté : {p.knownParty === "liberal" ? "Démocrate" : "Fasciste"}
            </Tag>
          )}
          {p.vote && (
            <Tag tone={p.vote === "ja" ? "green" : "amber"}>{p.vote === "ja" ? "Ja ✓" : "Nein ✕"}</Tag>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({
  children,
  tone,
  muted,
}: {
  children: React.ReactNode;
  tone?: "blue" | "red" | "green" | "amber";
  muted?: boolean;
}) {
  const tones: Record<string, string> = {
    blue: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
    red: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  };
  const cls = muted ? "bg-surface-2 text-muted" : tone ? tones[tone] : "bg-primary/10 text-primary";
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

// ───────────────────────────── Panneau d'action ─────────────────────────────

function ActionPanel({
  view,
  name,
  map,
  sendAction,
}: {
  view: FvDView;
  name: (id: string) => string;
  map: ReturnType<typeof toMemberMap>;
  sendAction: (a: GameAction) => void;
}) {
  // Fin de partie
  if (view.winner) {
    return (
      <div
        className={`animate-pop rounded-2xl border p-5 text-center ${
          view.winner === "liberal"
            ? "border-sky-400/50 bg-sky-500/10"
            : "border-rose-400/50 bg-rose-500/10"
        }`}
      >
        <p className="text-lg font-extrabold">
          {view.winner === "liberal" ? "🕊️ Les Démocrates l'emportent !" : "💀 Les Fascistes l'emportent !"}
        </p>
        {view.winReason && <p className="mt-1 text-sm text-muted">{view.winReason}</p>}
        <p className="mt-2 text-xs text-muted">Les rôles de chacun sont désormais révélés ci-dessous.</p>
      </div>
    );
  }

  if (!view.iAmAlive) {
    return (
      <Banner>☠️ Tu as été exécuté. Tu observes la partie sans pouvoir agir ni voter.</Banner>
    );
  }

  const targets = (label: string, action: (id: string) => GameAction, danger = false) => (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {view.eligiblePowerTargets.map((id) => (
          <button
            key={id}
            onClick={() => sendAction(action(id))}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              danger
                ? "border-rose-400/50 hover:border-rose-500 hover:bg-rose-500/10"
                : "border-border hover:border-primary hover:bg-primary/5"
            }`}
          >
            <Avatar name={name(id)} image={map[id]?.image} size={22} />
            {name(id)}
          </button>
        ))}
      </div>
    </div>
  );

  const gov = (
    <p className="mb-3 text-center text-xs text-muted">
      Président : <b className="text-foreground">{name(view.presidentId)}</b>
      {view.chancellorId && (
        <>
          {" "}
          · Chancelier : <b className="text-foreground">{name(view.chancellorId)}</b>
        </>
      )}
    </p>
  );

  let body: React.ReactNode = null;

  switch (view.phase) {
    case "nomination":
      body = view.canNominate ? (
        <div>
          <p className="mb-2 text-sm font-semibold">Choisis ton Chancelier :</p>
          <div className="flex flex-wrap gap-2">
            {view.eligibleChancellors.map((id) => (
              <button
                key={id}
                onClick={() => sendAction({ type: "nominate", payload: { chancellorId: id } })}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Avatar name={name(id)} image={map[id]?.image} size={22} />
                {name(id)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Banner>🏛️ {name(view.presidentId)} choisit un Chancelier…</Banner>
      );
      break;

    case "election":
      body = view.canVote ? (
        <div>
          <p className="mb-3 text-center text-sm font-semibold">
            Élire {name(view.presidentId)} (Prés.) & {name(view.chancellorId!)} (Chanc.) ?
          </p>
          <CardHand>
            <Card
              size="md"
              tone="green"
              title="Vote"
              icon="✓"
              subtitle="Ja !"
              selectable
              onSelect={() => sendAction({ type: "vote", payload: { ja: true } })}
            />
            <Card
              size="md"
              tone="amber"
              title="Vote"
              icon="✕"
              subtitle="Nein !"
              selectable
              onSelect={() => sendAction({ type: "vote", payload: { ja: false } })}
            />
          </CardHand>
        </div>
      ) : view.myVote ? (
        <Banner>
          Vote enregistré ({view.myVote === "ja" ? "Ja" : "Nein"}). En attente de{" "}
          {view.awaitingVoters} joueur(s)…
        </Banner>
      ) : (
        <Banner>Vote en cours… ({view.awaitingVoters} à voter)</Banner>
      );
      break;

    case "legislative_president":
      body =
        view.handRole === "president" && view.hand ? (
          <div>
            <p className="mb-3 text-center text-sm font-semibold">
              Défausse une loi en secret — transmets les 2 autres au Chancelier.
            </p>
            <CardHand>
              {view.hand.map((pol, i) => (
                <Card
                  key={i}
                  size="md"
                  tone={POLICY_INFO[pol].tone}
                  title="Loi"
                  icon={POLICY_INFO[pol].icon}
                  subtitle={`Défausser`}
                  selectable
                  onSelect={() => sendAction({ type: "discard", payload: { index: i } })}
                />
              ))}
            </CardHand>
          </div>
        ) : (
          <Banner>🏛️ Le Président examine 3 lois en secret…</Banner>
        );
      break;

    case "legislative_chancellor":
      body =
        view.handRole === "chancellor" && view.hand ? (
          <div>
            <p className="mb-3 text-center text-sm font-semibold">
              Adopte une loi — l&apos;autre est défaussée.
            </p>
            <CardHand>
              {view.hand.map((pol, i) => (
                <Card
                  key={i}
                  size="md"
                  tone={POLICY_INFO[pol].tone}
                  title="Loi"
                  icon={POLICY_INFO[pol].icon}
                  subtitle="Adopter"
                  selectable
                  onSelect={() => sendAction({ type: "enact", payload: { index: i } })}
                />
              ))}
            </CardHand>
            {view.canVeto && (
              <div className="mt-3 text-center">
                <Button variant="secondary" size="sm" onClick={() => sendAction({ type: "veto" })}>
                  🛑 Proposer un veto
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Banner>👔 Le Chancelier adopte une loi…</Banner>
        );
      break;

    case "legislative_veto":
      body = view.vetoStage ? (
        <div className="text-center">
          <p className="mb-3 text-sm font-semibold">Le Chancelier propose un veto. Acceptes-tu ?</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => sendAction({ type: "vetoResponse", payload: { agree: true } })}>
              Accepter le veto
            </Button>
            <Button
              variant="secondary"
              onClick={() => sendAction({ type: "vetoResponse", payload: { agree: false } })}
            >
              Refuser
            </Button>
          </div>
        </div>
      ) : (
        <Banner>🛑 Veto proposé — le Président décide…</Banner>
      );
      break;

    case "power_peek":
      body = view.powerForMe ? (
        <div>
          <p className="mb-3 text-center text-sm font-semibold">
            Les 3 prochaines lois (toi seul les vois) :
          </p>
          <CardHand>
            {(view.peekCards ?? []).map((pol, i) => (
              <Card
                key={i}
                size="md"
                tone={POLICY_INFO[pol].tone}
                title="Loi"
                icon={POLICY_INFO[pol].icon}
                subtitle={POLICY_INFO[pol].label}
              />
            ))}
          </CardHand>
          <div className="mt-3 text-center">
            <Button onClick={() => sendAction({ type: "peekAck" })}>Continuer</Button>
          </div>
        </div>
      ) : (
        <Banner>🔍 Le Président inspecte la pioche…</Banner>
      );
      break;

    case "power_investigate":
      body = view.powerForMe ? (
        targets("🔎 Enquête : choisis un joueur dont tu verras la loyauté.", (id) => ({
          type: "investigate",
          payload: { targetId: id },
        }))
      ) : (
        <Banner>🔎 Le Président enquête sur la loyauté d&apos;un joueur…</Banner>
      );
      break;

    case "power_special_election":
      body = view.powerForMe ? (
        targets("👑 Élection spéciale : désigne le prochain Président.", (id) => ({
          type: "specialElection",
          payload: { targetId: id },
        }))
      ) : (
        <Banner>👑 Le Président désigne le prochain Président…</Banner>
      );
      break;

    case "power_execution":
      body = view.powerForMe ? (
        targets(
          "🔫 Exécution : choisis un joueur à éliminer.",
          (id) => ({ type: "execute", payload: { targetId: id } }),
          true,
        )
      ) : (
        <Banner>🔫 Le Président choisit une cible à exécuter…</Banner>
      );
      break;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      {gov}
      {body}
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-center text-sm text-muted">{children}</p>;
}
