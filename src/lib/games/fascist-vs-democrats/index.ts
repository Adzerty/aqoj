import {
  type GameAction,
  type GameDefinition,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Fascist vs Democrats — réimplémentation fidèle de « Secret Hitler ».
//
// Jeu de déduction sociale à rôles cachés (5–10 joueurs). Les Démocrates sont
// majoritaires mais ne savent pas qui est qui ; les Fascistes se connaissent et
// cachent leur chef (« le Chancelier secret »). À chaque manche : on élit un
// gouvernement (Président + Chancelier), il légifère (adopte une loi Démocrate ou
// Fasciste), et certaines lois Fascistes débloquent un pouvoir présidentiel.
//
// Victoires :
//  • Démocrates : 5 lois Démocrates, OU exécuter le chef fasciste.
//  • Fascistes  : 6 lois Fascistes, OU faire élire leur chef Chancelier après que
//                 3 lois Fascistes aient été adoptées.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = "liberal" | "fascist" | "hitler";
export type Party = "liberal" | "fascist";
export type Policy = "liberal" | "fascist";
export type Power = "investigate" | "special_election" | "peek" | "execution";
export type Team = "liberal" | "fascist";

export type Phase =
  | "nomination"
  | "election"
  | "legislative_president"
  | "legislative_chancellor"
  | "legislative_veto"
  | "power_investigate"
  | "power_special_election"
  | "power_peek"
  | "power_execution"
  | "finished";

// Nombre de Fascistes (hors chef) selon le nombre de joueurs ; +1 chef + reste démocrates.
const FASCIST_COUNT: Record<number, number> = { 5: 1, 6: 1, 7: 2, 8: 2, 9: 3, 10: 3 };
const TOTAL_LIBERAL_POLICIES = 6;
const TOTAL_FASCIST_POLICIES = 11;
const LIBERAL_WIN = 5;
const FASCIST_WIN = 6;
const VETO_UNLOCK = 5; // veto dispo dès la 5e loi fasciste

interface Investigation {
  by: PlayerId;
  target: PlayerId;
  party: Party;
}

interface State {
  players: PlayerId[]; // ordre des sièges (= ordre de la table)
  names: Record<PlayerId, string>;
  playerCount: number;
  roles: Record<PlayerId, Role>;
  alive: Record<PlayerId, boolean>;

  liberalPolicies: number;
  fascistPolicies: number;
  deck: Policy[];
  discard: Policy[];

  regularPresidentIndex: number; // index du dernier Président de rotation normale
  presidentId: PlayerId;
  nomineeChancellorId: PlayerId | null;
  lastPresidentId: PlayerId | null;
  lastChancellorId: PlayerId | null;

  votes: Record<PlayerId, boolean>;
  lastVotes: Record<PlayerId, boolean> | null;
  lastElection: { ja: number; nein: number; passed: boolean } | null;
  electionTracker: number;

  drawnPolicies: Policy[];
  vetoAttempted: boolean;

  phase: Phase;
  pendingPower: Power | null;
  peekCards: Policy[] | null;
  investigations: Investigation[];
  investigatedIds: PlayerId[];

  lastEnactedPolicy: Policy | null;
  winner: Team | null;
  winReason: string | null;
  log: string[];
}

// ───────────────────────────── Vues client ─────────────────────────────

export interface FvDPlayerView {
  id: PlayerId;
  alive: boolean;
  isPresident: boolean;
  isChancellor: boolean;
  isLastPresident: boolean;
  isLastChancellor: boolean;
  /** Rôle connu du spectateur (soi-même, coéquipiers fascistes, ou fin de partie). */
  knownRole: Role | null;
  /** Loyauté révélée par une enquête menée par le spectateur. */
  knownParty: Party | null;
  /** Vote révélé après l'élection. */
  vote: "ja" | "nein" | null;
  hasVoted: boolean;
}

export interface FvDView {
  phase: Phase;
  meId: PlayerId;
  myRole: Role;
  iAmAlive: boolean;
  players: FvDPlayerView[];

  liberalPolicies: number;
  fascistPolicies: number;
  liberalGoal: number;
  fascistGoal: number;
  electionTracker: number;
  deckSize: number;
  discardSize: number;
  playerCount: number;

  presidentId: PlayerId;
  chancellorId: PlayerId | null;

  // Contexte d'action pour le spectateur
  canNominate: boolean;
  eligibleChancellors: PlayerId[];
  canVote: boolean;
  myVote: "ja" | "nein" | null;
  awaitingVoters: number;

  hand: Policy[] | null; // 3 (Président) ou 2 (Chancelier)
  handRole: "president" | "chancellor" | null;
  canVeto: boolean;
  vetoStage: boolean; // Président doit répondre au veto

  power: Power | null;
  powerForMe: boolean;
  peekCards: Policy[] | null;
  eligiblePowerTargets: PlayerId[];
  myInvestigations: { targetId: PlayerId; party: Party }[];

  lastElection: { ja: number; nein: number; passed: boolean } | null;
  winner: Team | null;
  winReason: string | null;
  log: string[];
}

// ───────────────────────────── Helpers ─────────────────────────────

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pushLog(log: string[], entry: string): string[] {
  return [entry, ...log].slice(0, 40);
}

const partyOf = (role: Role): Party => (role === "liberal" ? "liberal" : "fascist");

function powerFor(playerCount: number, fascistPolicyNumber: number): Power | null {
  if (playerCount <= 6) {
    if (fascistPolicyNumber === 3) return "peek";
    if (fascistPolicyNumber === 4 || fascistPolicyNumber === 5) return "execution";
    return null;
  }
  if (playerCount <= 8) {
    if (fascistPolicyNumber === 2) return "investigate";
    if (fascistPolicyNumber === 3) return "special_election";
    if (fascistPolicyNumber === 4 || fascistPolicyNumber === 5) return "execution";
    return null;
  }
  if (fascistPolicyNumber === 1 || fascistPolicyNumber === 2) return "investigate";
  if (fascistPolicyNumber === 3) return "special_election";
  if (fascistPolicyNumber === 4 || fascistPolicyNumber === 5) return "execution";
  return null;
}

/** Copie de travail : clone uniquement les parties mutables. */
function draft(state: State): State {
  return {
    ...state,
    alive: { ...state.alive },
    deck: [...state.deck],
    discard: [...state.discard],
    votes: { ...state.votes },
    lastVotes: state.lastVotes ? { ...state.lastVotes } : null,
    drawnPolicies: [...state.drawnPolicies],
    investigations: [...state.investigations],
    investigatedIds: [...state.investigatedIds],
    peekCards: state.peekCards ? [...state.peekCards] : null,
    log: [...state.log],
  };
}

const nm = (s: State, id: PlayerId) => s.names[id] ?? "Joueur";
const aliveIds = (s: State) => s.players.filter((id) => s.alive[id]);

function nextAliveIndex(s: State, fromIndex: number): number {
  const n = s.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (s.alive[s.players[idx]]) return idx;
  }
  return fromIndex;
}

function eligibleChancellor(s: State, cid: PlayerId): boolean {
  if (!s.alive[cid] || cid === s.presidentId) return false;
  if (cid === s.lastChancellorId) return false;
  const count = aliveIds(s).length;
  // Restriction « dernier Président » seulement à 7+ joueurs, et tant que >5 vivants.
  if (s.playerCount >= 7 && count > 5 && cid === s.lastPresidentId) return false;
  return true;
}

function ensureDeck(s: State, n: number, random: () => number) {
  if (s.deck.length >= n) return;
  s.deck = shuffle([...s.deck, ...s.discard], random);
  s.discard = [];
  s.log = pushLog(s.log, "🔀 Pioche épuisée : les lois défaussées sont remélangées.");
}

function finish(s: State, winner: Team, reason: string) {
  s.winner = winner;
  s.winReason = reason;
  s.phase = "finished";
  s.log = pushLog(
    s.log,
    `🏁 ${reason} — victoire des ${winner === "liberal" ? "Démocrates 🕊️" : "Fascistes 💀"} !`,
  );
}

function beginNextRound(s: State, special: PlayerId | null) {
  s.nomineeChancellorId = null;
  s.votes = {};
  s.drawnPolicies = [];
  s.vetoAttempted = false;
  s.pendingPower = null;
  s.peekCards = null;
  if (special) {
    s.presidentId = special;
  } else {
    s.regularPresidentIndex = nextAliveIndex(s, s.regularPresidentIndex);
    s.presidentId = s.players[s.regularPresidentIndex];
  }
  s.phase = "nomination";
  s.log = pushLog(s.log, `${nm(s, s.presidentId)} devient Président·e — à lui/elle de nommer un Chancelier.`);
}

function enterPower(s: State, power: Power, random: () => number) {
  s.pendingPower = power;
  const pres = nm(s, s.presidentId);
  if (power === "peek") {
    ensureDeck(s, 3, random);
    s.peekCards = s.deck.slice(0, 3);
    s.phase = "power_peek";
    s.log = pushLog(s.log, `🔍 ${pres} inspecte les 3 prochaines lois.`);
  } else if (power === "investigate") {
    s.phase = "power_investigate";
    s.log = pushLog(s.log, `🔎 ${pres} peut enquêter sur la loyauté d'un joueur.`);
  } else if (power === "special_election") {
    s.phase = "power_special_election";
    s.log = pushLog(s.log, `👑 ${pres} peut désigner le prochain Président.`);
  } else {
    s.phase = "power_execution";
    s.log = pushLog(s.log, `🔫 ${pres} doit exécuter un joueur.`);
  }
}

function enactPolicy(s: State, policy: Policy, chaos: boolean, random: () => number) {
  if (policy === "liberal") s.liberalPolicies++;
  else s.fascistPolicies++;
  s.lastEnactedPolicy = policy;
  s.log = pushLog(
    s.log,
    `${chaos ? "⚠️ Chaos — " : ""}Loi ${policy === "liberal" ? "Démocrate 🕊️" : "Fasciste 💀"} adoptée (${s.liberalPolicies} D / ${s.fascistPolicies} F).`,
  );

  if (s.liberalPolicies >= LIBERAL_WIN) return finish(s, "liberal", "Cinq lois Démocrates adoptées");
  if (s.fascistPolicies >= FASCIST_WIN) return finish(s, "fascist", "Six lois Fascistes adoptées");

  if (policy === "fascist" && !chaos) {
    const power = powerFor(s.playerCount, s.fascistPolicies);
    if (power) return enterPower(s, power, random);
  }
  beginNextRound(s, null);
}

function resolveElection(s: State, random: () => number) {
  const voters = aliveIds(s);
  const ja = voters.filter((id) => s.votes[id] === true).length;
  const nein = voters.length - ja;
  s.lastVotes = { ...s.votes };
  s.lastElection = { ja, nein, passed: ja > nein };

  if (ja > nein) {
    const chancellor = s.nomineeChancellorId!;
    s.log = pushLog(
      s.log,
      `✅ Gouvernement élu : ${nm(s, s.presidentId)} (Prés.) & ${nm(s, chancellor)} (Chanc.) — Ja ${ja} / Nein ${nein}.`,
    );
    // Victoire fasciste : le chef est élu Chancelier après 3 lois fascistes.
    if (s.roles[chancellor] === "hitler" && s.fascistPolicies >= 3) {
      return finish(s, "fascist", "Le chef fasciste a été élu Chancelier");
    }
    s.lastPresidentId = s.presidentId;
    s.lastChancellorId = chancellor;
    s.electionTracker = 0;
    ensureDeck(s, 3, random);
    s.drawnPolicies = s.deck.splice(0, 3);
    s.vetoAttempted = false;
    s.phase = "legislative_president";
    s.log = pushLog(s.log, `${nm(s, s.presidentId)} pioche 3 lois et en défausse une en secret.`);
  } else {
    s.log = pushLog(s.log, `❌ Gouvernement rejeté — Ja ${ja} / Nein ${nein}.`);
    s.electionTracker++;
    if (s.electionTracker >= 3) {
      s.log = pushLog(s.log, "⚠️ Trois échecs d'affilée : le pays sombre dans le chaos.");
      ensureDeck(s, 1, random);
      const top = s.deck.shift()!;
      s.electionTracker = 0;
      s.lastPresidentId = null;
      s.lastChancellorId = null; // limites de mandat oubliées
      enactPolicy(s, top, true, random);
      return;
    }
    beginNextRound(s, null);
  }
}

// ───────────────────────────── Définition ─────────────────────────────

export const fascistVsDemocrats: GameDefinition<State, FvDView> = {
  id: "fascist-vs-democrats",
  name: "Fascist vs Democrats",
  tagline: "Rôles secrets, élections truquées, un chef caché.",
  description:
    "Déduction sociale (5–10 joueurs). Les Démocrates tentent d'adopter 5 lois sans laisser les Fascistes prendre le pouvoir — ni faire élire leur chef secret. Mensonge, alliances et pouvoirs présidentiels au programme.",
  emoji: "🗳️",
  accent: "ink",
  minPlayers: 5,
  maxPlayers: 10,
  estimatedMinutes: 30,
  tags: ["Déduction", "Rôles cachés", "Soirée"],

  createInitialState(ctx) {
    const ids = ctx.players.map((p) => p.id);
    const n = ids.length;
    const fascists = FASCIST_COUNT[n] ?? 1;

    // Attribution secrète des rôles (indépendante de l'ordre des sièges).
    const shuffledIds = shuffle(ids, ctx.random);
    const roles: Record<PlayerId, Role> = {};
    shuffledIds.forEach((id, i) => {
      if (i === 0) roles[id] = "hitler";
      else if (i <= fascists) roles[id] = "fascist";
      else roles[id] = "liberal";
    });

    const deck = shuffle(
      [
        ...Array<Policy>(TOTAL_FASCIST_POLICIES).fill("fascist"),
        ...Array<Policy>(TOTAL_LIBERAL_POLICIES).fill("liberal"),
      ],
      ctx.random,
    );

    const names: Record<PlayerId, string> = {};
    const alive: Record<PlayerId, boolean> = {};
    for (const p of ctx.players) {
      names[p.id] = p.name;
      alive[p.id] = true;
    }

    const startIndex = Math.floor(ctx.random() * n);

    return {
      players: ids,
      names,
      playerCount: n,
      roles,
      alive,
      liberalPolicies: 0,
      fascistPolicies: 0,
      deck,
      discard: [],
      regularPresidentIndex: startIndex,
      presidentId: ids[startIndex],
      nomineeChancellorId: null,
      lastPresidentId: null,
      lastChancellorId: null,
      votes: {},
      lastVotes: null,
      lastElection: null,
      electionTracker: 0,
      drawnPolicies: [],
      vetoAttempted: false,
      phase: "nomination",
      pendingPower: null,
      peekCards: null,
      investigations: [],
      investigatedIds: [],
      lastEnactedPolicy: null,
      winner: null,
      winReason: null,
      log: [`La partie commence — ${names[ids[startIndex]]} est le premier Président·e.`],
    };
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    if (state.phase === "finished") return { state };
    if (action.type === "start") return { state };

    const s = draft(state);
    const me = ctx.playerId;
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const targetId = typeof payload.targetId === "string" ? payload.targetId : "";
    const chancellorId = typeof payload.chancellorId === "string" ? payload.chancellorId : "";
    const index = Math.floor(Number(payload.index));

    switch (action.type) {
      case "nominate": {
        if (s.phase !== "nomination" || me !== s.presidentId) return { state };
        if (!eligibleChancellor(s, chancellorId)) return { state };
        s.nomineeChancellorId = chancellorId;
        s.votes = {};
        s.lastVotes = null;
        s.lastElection = null;
        s.phase = "election";
        s.log = pushLog(s.log, `🗳️ ${nm(s, s.presidentId)} propose ${nm(s, chancellorId)} comme Chancelier. Au vote !`);
        return { state: s };
      }

      case "vote": {
        if (s.phase !== "election" || !s.alive[me]) return { state };
        s.votes = { ...s.votes, [me]: payload.ja === true };
        if (aliveIds(s).every((id) => id in s.votes)) resolveElection(s, ctx.random);
        return { state: s };
      }

      case "discard": {
        if (s.phase !== "legislative_president" || me !== s.presidentId) return { state };
        if (s.drawnPolicies.length !== 3 || index < 0 || index > 2) return { state };
        const [removed] = s.drawnPolicies.splice(index, 1);
        s.discard.push(removed);
        s.phase = "legislative_chancellor";
        s.log = pushLog(s.log, `${nm(s, s.presidentId)} transmet 2 lois au Chancelier ${nm(s, s.nomineeChancellorId!)}.`);
        return { state: s };
      }

      case "enact": {
        if (s.phase !== "legislative_chancellor" || me !== s.nomineeChancellorId) return { state };
        if (s.drawnPolicies.length !== 2 || index < 0 || index > 1) return { state };
        const enacted = s.drawnPolicies[index];
        s.discard.push(s.drawnPolicies[1 - index]);
        s.drawnPolicies = [];
        enactPolicy(s, enacted, false, ctx.random);
        return { state: s };
      }

      case "veto": {
        if (s.phase !== "legislative_chancellor" || me !== s.nomineeChancellorId) return { state };
        if (s.fascistPolicies < VETO_UNLOCK || s.vetoAttempted) return { state };
        s.vetoAttempted = true;
        s.phase = "legislative_veto";
        s.log = pushLog(s.log, `🛑 Le Chancelier ${nm(s, me)} propose un veto.`);
        return { state: s };
      }

      case "vetoResponse": {
        if (s.phase !== "legislative_veto" || me !== s.presidentId) return { state };
        if (payload.agree === true) {
          s.discard.push(...s.drawnPolicies);
          s.drawnPolicies = [];
          s.log = pushLog(s.log, "🛑 Veto accepté : les 2 lois sont défaussées.");
          s.electionTracker++;
          if (s.electionTracker >= 3) {
            ensureDeck(s, 1, ctx.random);
            const top = s.deck.shift()!;
            s.electionTracker = 0;
            s.lastPresidentId = null;
            s.lastChancellorId = null;
            enactPolicy(s, top, true, ctx.random);
          } else {
            beginNextRound(s, null);
          }
        } else {
          s.phase = "legislative_chancellor";
          s.log = pushLog(s.log, "Le Président refuse le veto : le Chancelier doit adopter une loi.");
        }
        return { state: s };
      }

      case "peekAck": {
        if (s.phase !== "power_peek" || me !== s.presidentId) return { state };
        s.peekCards = null;
        beginNextRound(s, null);
        return { state: s };
      }

      case "investigate": {
        if (s.phase !== "power_investigate" || me !== s.presidentId) return { state };
        if (!s.alive[targetId] || targetId === s.presidentId || s.investigatedIds.includes(targetId))
          return { state };
        s.investigations.push({ by: s.presidentId, target: targetId, party: partyOf(s.roles[targetId]) });
        s.investigatedIds.push(targetId);
        s.log = pushLog(s.log, `🔎 ${nm(s, s.presidentId)} a enquêté sur ${nm(s, targetId)}.`);
        beginNextRound(s, null);
        return { state: s };
      }

      case "specialElection": {
        if (s.phase !== "power_special_election" || me !== s.presidentId) return { state };
        if (!s.alive[targetId] || targetId === s.presidentId) return { state };
        s.log = pushLog(s.log, `👑 ${nm(s, s.presidentId)} désigne ${nm(s, targetId)} comme prochain Président.`);
        beginNextRound(s, targetId);
        return { state: s };
      }

      case "execute": {
        if (s.phase !== "power_execution" || me !== s.presidentId) return { state };
        if (!s.alive[targetId] || targetId === s.presidentId) return { state };
        s.alive[targetId] = false;
        s.log = pushLog(s.log, `🔫 ${nm(s, s.presidentId)} a exécuté ${nm(s, targetId)}.`);
        if (s.roles[targetId] === "hitler") finish(s, "liberal", "Le chef fasciste a été exécuté");
        else beginNextRound(s, null);
        return { state: s };
      }

      default:
        return { state };
    }
  },

  viewFor(state, me): FvDView {
    const s = state;
    const myRole = s.roles[me];
    const revealAll = s.winner !== null;

    const knownRoleFor = (target: PlayerId): Role | null => {
      if (revealAll) return s.roles[target];
      if (target === me) return s.roles[target];
      // Les Fascistes (hors chef) connaissent tous les Fascistes et le chef.
      if (myRole === "fascist" && (s.roles[target] === "fascist" || s.roles[target] === "hitler"))
        return s.roles[target];
      // Le chef connaît les Fascistes seulement à 5–6 joueurs.
      if (myRole === "hitler" && s.playerCount <= 6 && s.roles[target] === "fascist") return "fascist";
      return null;
    };

    const myInvestigations = s.investigations
      .filter((x) => x.by === me)
      .map((x) => ({ targetId: x.target, party: x.party }));
    const knownPartyOf = (target: PlayerId): Party | null =>
      myInvestigations.find((x) => x.targetId === target)?.party ?? null;

    const players: FvDPlayerView[] = s.players.map((id) => ({
      id,
      alive: s.alive[id],
      isPresident: id === s.presidentId,
      isChancellor: id === s.nomineeChancellorId,
      isLastPresident: id === s.lastPresidentId,
      isLastChancellor: id === s.lastChancellorId,
      knownRole: knownRoleFor(id),
      knownParty: knownPartyOf(id),
      vote:
        s.lastVotes && s.phase !== "election"
          ? s.lastVotes[id] === undefined
            ? null
            : s.lastVotes[id]
              ? "ja"
              : "nein"
          : null,
      hasVoted: s.phase === "election" ? id in s.votes : false,
    }));

    const isPres = me === s.presidentId;
    const isChanc = me === s.nomineeChancellorId;

    // Mains de cartes (lois) selon la phase et le rôle.
    let hand: Policy[] | null = null;
    let handRole: "president" | "chancellor" | null = null;
    if (s.phase === "legislative_president" && isPres) {
      hand = s.drawnPolicies;
      handRole = "president";
    } else if (
      (s.phase === "legislative_chancellor" || s.phase === "legislative_veto") &&
      (isChanc || isPres)
    ) {
      hand = s.drawnPolicies;
      handRole = isChanc ? "chancellor" : "president";
    }

    const power: Power | null = s.phase.startsWith("power_") ? s.pendingPower : null;
    const powerForMe = power !== null && isPres;
    let eligiblePowerTargets: PlayerId[] = [];
    if (powerForMe) {
      eligiblePowerTargets = s.players.filter((id) => {
        if (!s.alive[id] || id === s.presidentId) return false;
        if (power === "investigate" && s.investigatedIds.includes(id)) return false;
        return true;
      });
    }

    return {
      phase: s.phase,
      meId: me,
      myRole,
      iAmAlive: s.alive[me],
      players,
      liberalPolicies: s.liberalPolicies,
      fascistPolicies: s.fascistPolicies,
      liberalGoal: LIBERAL_WIN,
      fascistGoal: FASCIST_WIN,
      electionTracker: s.electionTracker,
      deckSize: s.deck.length,
      discardSize: s.discard.length,
      playerCount: s.playerCount,
      presidentId: s.presidentId,
      chancellorId: s.nomineeChancellorId,
      canNominate: s.phase === "nomination" && isPres,
      eligibleChancellors:
        s.phase === "nomination" && isPres ? s.players.filter((id) => eligibleChancellor(s, id)) : [],
      canVote: s.phase === "election" && s.alive[me] && !(me in s.votes),
      myVote: me in s.votes ? (s.votes[me] ? "ja" : "nein") : null,
      awaitingVoters: s.phase === "election" ? aliveIds(s).filter((id) => !(id in s.votes)).length : 0,
      hand,
      handRole,
      canVeto: s.phase === "legislative_chancellor" && isChanc && s.fascistPolicies >= VETO_UNLOCK && !s.vetoAttempted,
      vetoStage: s.phase === "legislative_veto" && isPres,
      power,
      powerForMe,
      peekCards: s.phase === "power_peek" && isPres ? s.peekCards : null,
      eligiblePowerTargets,
      myInvestigations,
      lastElection: s.lastElection,
      winner: s.winner,
      winReason: s.winReason,
      log: s.log,
    };
  },

  isFinished(state) {
    return state.phase === "finished";
  },

  getResults(state, players) {
    const won = (id: PlayerId) =>
      state.winner === "liberal" ? state.roles[id] === "liberal" : state.roles[id] !== "liberal";
    return players.map((p) => ({
      playerId: p.id,
      score: won(p.id) ? 1 : 0,
      rank: won(p.id) ? 1 : 2,
      won: won(p.id),
    }));
  },
};
