import {
  type GameAction,
  type GameDefinition,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// La Pègre — adaptation de « Mafia de Cuba ».
//
// Jeu d'enquête et de bluff (6–12 joueurs). Le Parrain confie sa boîte à cigares :
// elle passe de main en main, et chaque joueur y prend EN SECRET soit des diamants
// (il devient Voleur), soit un jeton personnage (Fidèle, Agent, Chauffeur). Puis le
// Parrain interroge tout le monde pour retrouver ses diamants et démasquer les
// Voleurs — sans accuser à tort (il perd ses Jokers) ni tomber sur un Agent.
//
// La discussion/interrogation se fait à la voix (Discord) ; le moteur gère le
// secret des prises, les accusations et les conditions de victoire.
// ─────────────────────────────────────────────────────────────────────────────

export type TokenType = "fidele" | "agent" | "chauffeur";
export type Role = "parrain" | "voleur" | "fidele" | "agent" | "chauffeur" | "enfant";

export type Take =
  | { kind: "diamonds"; count: number }
  | { kind: "token"; token: TokenType }
  | { kind: "nothing" };

type Phase = "godfather_setup" | "stealing" | "investigation" | "finished";

const TOTAL_DIAMONDS = 15;
const MAX_POCKET = 5;

// Jetons placés dans la boîte + Jokers (devant le Parrain) selon le nombre de joueurs.
const SETUP: Record<number, { fidele: number; agent: number; chauffeur: number; joker: number }> = {
  6: { fidele: 1, agent: 1, chauffeur: 1, joker: 0 },
  7: { fidele: 2, agent: 1, chauffeur: 1, joker: 0 },
  8: { fidele: 3, agent: 1, chauffeur: 1, joker: 1 },
  9: { fidele: 4, agent: 1, chauffeur: 1, joker: 1 },
  10: { fidele: 4, agent: 2, chauffeur: 1, joker: 1 },
  11: { fidele: 4, agent: 2, chauffeur: 2, joker: 2 },
  12: { fidele: 5, agent: 2, chauffeur: 2, joker: 2 },
};

interface State {
  players: PlayerId[]; // ordre des sièges ; players[0] = Parrain
  names: Record<PlayerId, string>;
  godfather: PlayerId;
  phase: Phase;

  pocketed: number; // diamants gardés en poche par le Parrain (0–5)
  boxDiamonds: number;
  boxTokens: TokenType[];
  pouch: TokenType | null; // jeton mis de côté par le 1er joueur

  stealOrder: PlayerId[]; // players[1..n-1]
  stealIndex: number;
  takes: Record<PlayerId, Take>; // prise secrète de chaque joueur (hors Parrain)

  jokers: number;
  recovered: number;
  totalStolen: number;
  eliminated: Record<PlayerId, boolean>;
  accused: Record<PlayerId, boolean>;
  revealed: Record<PlayerId, Take>; // prises dévoilées (accusation/fin)
  jokerHolders: PlayerId[];

  winner: { team: "parrain" | "agent" | "voleurs"; players: PlayerId[]; reason: string } | null;
  log: string[];
}

// ───────────────────────────── Vues ─────────────────────────────

export interface PegrePlayerView {
  id: PlayerId;
  name: string;
  isGodfather: boolean;
  eliminated: boolean;
  hasJoker: boolean;
  isCurrentStealer: boolean;
  hasTaken: boolean; // a déjà pioché (phase de vol)
  role: Role | null; // visible : soi, Parrain, joueur dévoilé, ou fin de partie
  revealedDiamonds: number | null; // nb de diamants si Voleur dévoilé
  isWinner: boolean;
}

export interface PegreView {
  meId: PlayerId;
  phase: Phase;
  godfatherId: PlayerId;
  iAmGodfather: boolean;
  myRole: Role | null;
  myTake: Take | null;
  pocketed: number | null; // visible au Parrain

  // phase de vol
  currentStealerId: PlayerId | null;
  isMyStealTurn: boolean;
  box: { diamonds: number; fidele: number; agent: number; chauffeur: number } | null;
  isFirstStealer: boolean;
  canSetAside: boolean;
  isLastStealer: boolean;
  boxEmpty: boolean;

  // enquête
  jokers: number;
  recovered: number;
  totalStolen: number | null; // connu du Parrain
  accusableIds: PlayerId[];

  players: PegrePlayerView[];
  winner: State["winner"];
  log: string[];
}

// ───────────────────────────── Helpers ─────────────────────────────

function pushLog(log: string[], e: string): string[] { return [e, ...log].slice(0, 50); }
const nm = (s: State, id: PlayerId) => s.names[id] ?? "Joueur";

function draft(s: State): State {
  return {
    ...s,
    boxTokens: [...s.boxTokens],
    stealOrder: [...s.stealOrder],
    takes: { ...s.takes },
    eliminated: { ...s.eliminated },
    accused: { ...s.accused },
    revealed: { ...s.revealed },
    jokerHolders: [...s.jokerHolders],
    winner: s.winner ? { ...s.winner, players: [...s.winner.players] } : null,
    log: [...s.log],
  };
}

function roleOf(s: State, id: PlayerId): Role | null {
  if (id === s.godfather) return "parrain";
  const t = s.takes[id];
  if (!t) return null;
  if (t.kind === "diamonds") return "voleur";
  if (t.kind === "nothing") return "enfant";
  return t.token; // fidele | agent | chauffeur
}

function rightNeighbor(s: State, id: PlayerId): PlayerId {
  const n = s.players.length;
  const i = s.players.indexOf(id);
  return s.players[(i - 1 + n) % n];
}

/** Ajoute les Chauffeurs dont le voisin de droite est déjà vainqueur (jusqu'à stabilité). */
function applyChauffeurs(s: State, winners: Set<PlayerId>) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of s.players) {
      if (winners.has(id)) continue;
      const t = s.takes[id];
      if (t?.kind === "token" && t.token === "chauffeur" && winners.has(rightNeighbor(s, id))) {
        winners.add(id);
        changed = true;
      }
    }
  }
}

function finishGodfather(s: State) {
  const winners = new Set<PlayerId>([s.godfather]);
  for (const id of s.players) if (roleOf(s, id) === "fidele") winners.add(id);
  applyChauffeurs(s, winners);
  s.winner = { team: "parrain", players: [...winners], reason: "Le Parrain a récupéré tous ses diamants." };
  s.phase = "finished";
  s.log = pushLog(s.log, "🏁 Le Parrain récupère tout — victoire du Parrain et des Fidèles !");
}

function finishAgent(s: State, agent: PlayerId) {
  const winners = new Set<PlayerId>([agent]);
  applyChauffeurs(s, winners);
  s.winner = { team: "agent", players: [...winners], reason: "Le Parrain a accusé un Agent infiltré." };
  s.phase = "finished";
  s.log = pushLog(s.log, `🏁 ${nm(s, agent)} était un Agent — il gagne seul !`);
}

function finishThieves(s: State) {
  // Le Parrain est éliminé : on dévoile les Voleurs encore en jeu.
  const thieves = s.players.filter((id) => s.takes[id]?.kind === "diamonds" && !s.eliminated[id]);
  for (const id of thieves) s.revealed[id] = s.takes[id];
  let max = 0;
  for (const id of thieves) max = Math.max(max, (s.takes[id] as { count: number }).count);
  const winners = new Set<PlayerId>();
  for (const id of thieves) if ((s.takes[id] as { count: number }).count === max && max > 0) winners.add(id);
  for (const id of s.players) if (s.takes[id]?.kind === "nothing") winners.add(id); // Enfants des rues
  applyChauffeurs(s, winners);
  s.winner = { team: "voleurs", players: [...winners], reason: "Le Parrain a été éliminé." };
  s.phase = "finished";
  s.log = pushLog(s.log, "🏁 Le Parrain tombe — les Voleurs (et les Enfants des rues) l'emportent !");
}

function advanceSteal(s: State) {
  s.stealIndex++;
  if (s.stealIndex >= s.stealOrder.length) {
    s.totalStolen = s.players.reduce(
      (a, id) => a + (s.takes[id]?.kind === "diamonds" ? (s.takes[id] as { count: number }).count : 0),
      0,
    );
    s.phase = "investigation";
    s.log = pushLog(s.log, `🔎 Le vol est terminé. Le Parrain ${nm(s, s.godfather)} mène l'enquête !`);
  }
}

// ───────────────────────────── Définition ─────────────────────────────

export const laPegre: GameDefinition<State, PegreView> = {
  id: "la-pegre",
  name: "La Pègre",
  tagline: "Boîte à cigares, diamants volés, et un Parrain qui enquête.",
  description:
    "Adaptation de Mafia de Cuba (6–12 joueurs). La boîte à cigares passe de main en main : chacun y prend en secret des diamants (Voleur) ou un jeton (Fidèle, Agent, Chauffeur). Le Parrain interroge tout le monde pour retrouver ses diamants — bluff, accusations et coups fourrés garantis.",
  emoji: "💎",
  accent: "sage",
  minPlayers: 6,
  maxPlayers: 12,
  estimatedMinutes: 20,
  tags: ["Bluff", "Rôles cachés", "Soirée"],
  rules: [
    "Le 1er joueur de la table est le Parrain ; il garde 0 à 5 diamants en poche.",
    "La boîte passe de main en main : chacun y prend EN SECRET soit des diamants (il devient Voleur), soit un jeton personnage.",
    "Jetons : Fidèle (avec le Parrain), Agent (gagne s'il est accusé), Chauffeur (gagne si son voisin de droite gagne).",
    "Le Parrain interroge tout le monde (à la voix) puis ordonne « Vide tes poches ! » pour accuser.",
    "Voleur accusé : diamants rendus, joueur éliminé. Mauvaise accusation : le Parrain donne un Joker (s'il en a, sinon il est éliminé). Agent accusé : l'Agent gagne seul.",
    "Le Parrain (+ Fidèles) gagne s'il récupère tous les diamants ; sinon les Voleurs (+ Enfants des rues) l'emportent.",
  ],

  createInitialState(ctx) {
    const ids = ctx.players.map((p) => p.id);
    const n = ids.length;
    const setup = SETUP[n] ?? SETUP[12];
    const names: Record<PlayerId, string> = {};
    for (const p of ctx.players) names[p.id] = p.name;

    const boxTokens: TokenType[] = [
      ...Array<TokenType>(setup.fidele).fill("fidele"),
      ...Array<TokenType>(setup.agent).fill("agent"),
      ...Array<TokenType>(setup.chauffeur).fill("chauffeur"),
    ];

    return {
      players: ids,
      names,
      godfather: ids[0],
      phase: "godfather_setup",
      pocketed: 0,
      boxDiamonds: TOTAL_DIAMONDS,
      boxTokens,
      pouch: null,
      stealOrder: ids.slice(1),
      stealIndex: 0,
      takes: {},
      jokers: setup.joker,
      recovered: 0,
      totalStolen: 0,
      eliminated: {},
      accused: {},
      revealed: {},
      jokerHolders: [],
      winner: null,
      log: [`${names[ids[0]]} est le Parrain. Il prépare sa boîte à cigares…`],
    };
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    if (state.phase === "finished") return { state };
    if (action.type === "start") return { state };

    const s = draft(state);
    const me = ctx.playerId;
    const payload = (action.payload ?? {}) as Record<string, unknown>;

    switch (action.type) {
      case "pocket": {
        if (s.phase !== "godfather_setup" || me !== s.godfather) return { state };
        const count = Math.max(0, Math.min(MAX_POCKET, Math.floor(Number(payload.count))));
        s.pocketed = count;
        s.boxDiamonds = TOTAL_DIAMONDS - count;
        s.phase = "stealing";
        s.log = pushLog(s.log, `🎩 Le Parrain confie la boîte. ${nm(s, s.stealOrder[0])} commence.`);
        return { state: s };
      }

      case "setAside": {
        if (s.phase !== "stealing" || s.stealIndex !== 0 || me !== s.stealOrder[0] || s.pouch) return { state };
        const token = payload.token as TokenType;
        const idx = s.boxTokens.indexOf(token);
        if (idx < 0) return { state };
        s.boxTokens.splice(idx, 1);
        s.pouch = token;
        s.log = pushLog(s.log, `🤫 Le premier joueur glisse un jeton dans le sachet…`);
        return { state: s };
      }

      case "take": {
        if (s.phase !== "stealing") return { state };
        const cur = s.stealOrder[s.stealIndex];
        if (me !== cur) return { state };
        const last = s.stealIndex === s.stealOrder.length - 1;
        const boxEmpty = s.boxDiamonds === 0 && s.boxTokens.length === 0;
        const kind = String(payload.kind);

        if (boxEmpty) {
          s.takes[me] = { kind: "nothing" };
        } else if (kind === "diamonds") {
          const count = Math.floor(Number(payload.count));
          if (count < 1 || count > s.boxDiamonds) return { state };
          s.boxDiamonds -= count;
          s.takes[me] = { kind: "diamonds", count };
        } else if (kind === "token") {
          const token = payload.token as TokenType;
          const idx = s.boxTokens.indexOf(token);
          if (idx < 0) return { state };
          s.boxTokens.splice(idx, 1);
          s.takes[me] = { kind: "token", token };
        } else if (kind === "nothing") {
          if (!last) return { state }; // seul le dernier joueur peut ne rien prendre
          s.takes[me] = { kind: "nothing" };
        } else {
          return { state };
        }
        advanceSteal(s);
        return { state: s };
      }

      case "accuse": {
        if (s.phase !== "investigation" || me !== s.godfather) return { state };
        const t = String(payload.targetId);
        if (t === s.godfather || !s.players.includes(t) || s.eliminated[t] || s.accused[t]) return { state };
        const take = s.takes[t];
        if (!take) return { state };
        s.accused[t] = true;
        s.revealed[t] = take;

        if (take.kind === "token" && take.token === "agent") {
          finishAgent(s, t);
        } else if (take.kind === "diamonds") {
          s.recovered += take.count;
          s.eliminated[t] = true;
          s.log = pushLog(s.log, `💎 ${nm(s, t)} vide ses poches : un Voleur ! ${take.count} diamant(s) récupéré(s).`);
          if (s.recovered >= s.totalStolen) finishGodfather(s);
        } else {
          // mauvaise accusation (Fidèle, Chauffeur ou Enfant des rues)
          if (s.jokers > 0) {
            s.jokers--;
            s.jokerHolders.push(t);
            s.log = pushLog(s.log, `🍾 ${nm(s, t)} n'était pas un Voleur — le Parrain lui donne un Joker.`);
          } else {
            s.eliminated[s.godfather] = true;
            s.log = pushLog(s.log, `💥 Plus de Joker — le Parrain s'est trompé une fois de trop !`);
            finishThieves(s);
          }
        }
        return { state: s };
      }

      default:
        return { state };
    }
  },

  viewFor(state, me): PegreView {
    const s = state;
    const finished = s.phase === "finished";
    const cur = s.phase === "stealing" ? s.stealOrder[s.stealIndex] : null;

    const roleVisible = (id: PlayerId): Role | null => {
      if (finished) return roleOf(s, id);
      if (id === me) return roleOf(s, id);
      if (id === s.godfather) return "parrain";
      if (s.revealed[id]) return roleOf(s, id);
      return null;
    };

    const players: PegrePlayerView[] = s.players.map((id) => {
      const role = roleVisible(id);
      const tk = finished || s.revealed[id] ? s.takes[id] : null;
      return {
        id,
        name: nm(s, id),
        isGodfather: id === s.godfather,
        eliminated: !!s.eliminated[id],
        hasJoker: s.jokerHolders.includes(id),
        isCurrentStealer: id === cur,
        hasTaken: !!s.takes[id],
        role,
        revealedDiamonds: tk?.kind === "diamonds" ? tk.count : null,
        isWinner: !!s.winner?.players.includes(id),
      };
    });

    const iAmGodfather = me === s.godfather;
    const isMyStealTurn = s.phase === "stealing" && cur === me;
    const showBox =
      (isMyStealTurn) || (s.phase === "investigation" && iAmGodfather);
    const box = showBox
      ? {
          diamonds: s.boxDiamonds,
          fidele: s.boxTokens.filter((t) => t === "fidele").length,
          agent: s.boxTokens.filter((t) => t === "agent").length,
          chauffeur: s.boxTokens.filter((t) => t === "chauffeur").length,
        }
      : null;

    return {
      meId: me,
      phase: s.phase,
      godfatherId: s.godfather,
      iAmGodfather,
      myRole: roleOf(s, me),
      myTake: s.takes[me] ?? null,
      pocketed: iAmGodfather ? s.pocketed : null,
      currentStealerId: cur,
      isMyStealTurn,
      box,
      isFirstStealer: isMyStealTurn && s.stealIndex === 0,
      canSetAside: isMyStealTurn && s.stealIndex === 0 && !s.pouch,
      isLastStealer: isMyStealTurn && s.stealIndex === s.stealOrder.length - 1,
      boxEmpty: s.boxDiamonds === 0 && s.boxTokens.length === 0,
      jokers: s.jokers,
      recovered: s.recovered,
      totalStolen: iAmGodfather ? s.totalStolen : null,
      accusableIds:
        s.phase === "investigation" && iAmGodfather
          ? s.players.filter((id) => id !== s.godfather && !s.eliminated[id] && !s.accused[id])
          : [],
      players,
      winner: s.winner,
      log: s.log,
    };
  },

  isFinished(state) {
    return state.phase === "finished";
  },

  getResults(state, players) {
    const winners = new Set(state.winner?.players ?? []);
    return players.map((p) => ({
      playerId: p.id,
      score: winners.has(p.id) ? 1 : 0,
      rank: winners.has(p.id) ? 1 : 2,
      won: winners.has(p.id),
    }));
  },
};
