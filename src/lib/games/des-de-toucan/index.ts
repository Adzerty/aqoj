import {
  type GameAction,
  type GameDefinition,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Dès de Toucan — adaptation de « Perudo » (Liar's Dice).
//
// Chaque joueur cache 5 dés sous son gobelet. À tour de rôle on surenchérit sur
// le nombre de dés d'une même valeur cachés sur TOUTE la table (en bluffant), ou
// on crie « Dudo ! » pour contester. Les 1 sont des « Paco » (toucans) : des
// jokers universels. Dernier joueur avec des dés = vainqueur.
// ─────────────────────────────────────────────────────────────────────────────

export interface Bid {
  quantity: number;
  value: number; // 1 = Paco (toucan), 2–6 = valeur normale
}

interface Round {
  by: PlayerId;
}

interface State {
  players: PlayerId[];
  names: Record<PlayerId, string>;
  diceCount: Record<PlayerId, number>;
  dice: Record<PlayerId, number[]>;
  eliminatedOrder: PlayerId[];
  phase: "bidding" | "reveal" | "finished";
  bid: (Bid & Round) | null;
  current: PlayerId; // à qui de parler
  starter: PlayerId; // qui a ouvert la manche
  palifico: boolean;
  palificoNext: PlayerId | null; // deviendra Palifico à la manche suivante
  nextStarter: PlayerId | null;
  lastResult: {
    type: "dudo" | "calza";
    caller: PlayerId;
    bidder: PlayerId;
    bid: Bid;
    count: number;
    loser: PlayerId | null;
    winner: PlayerId | null; // Calza réussi
    palifico: boolean;
  } | null;
  winner: PlayerId | null;
  log: string[];
}

// ───────────────────────────── Vues ─────────────────────────────

export interface ToucanPlayerView {
  id: PlayerId;
  name: string;
  diceCount: number;
  alive: boolean;
  isCurrent: boolean;
  isStarter: boolean;
  dice: number[] | null; // visible seulement au reveal/fin
}

export interface ToucanView {
  meId: PlayerId;
  myDice: number[];
  alive: boolean;
  players: ToucanPlayerView[];
  phase: State["phase"];
  bid: (Bid & { by: PlayerId }) | null;
  currentId: PlayerId;
  starterId: PlayerId;
  isMyTurn: boolean;
  palifico: boolean;
  totalDice: number;
  canContinue: boolean; // reveal : c'est à moi de lancer la manche suivante
  nextStarterId: PlayerId | null;
  lastResult: State["lastResult"];
  winner: PlayerId | null;
  log: string[];
}

// ───────────────────────────── Helpers ─────────────────────────────

function pushLog(log: string[], e: string): string[] { return [e, ...log].slice(0, 40); }
const nm = (s: State, id: PlayerId) => s.names[id] ?? "Joueur";
const inGame = (s: State) => s.players.filter((p) => s.diceCount[p] > 0);
const totalDice = (s: State) => s.players.reduce((a, p) => a + s.diceCount[p], 0);

function rollFor(s: State, r: () => number) {
  for (const p of s.players) {
    s.dice[p] = s.diceCount[p] > 0 ? Array.from({ length: s.diceCount[p] }, () => 1 + Math.floor(r() * 6)) : [];
  }
}

function nextInGame(s: State, from: PlayerId): PlayerId {
  const n = s.players.length;
  const i = s.players.indexOf(from);
  for (let step = 1; step <= n; step++) {
    const id = s.players[(i + step) % n];
    if (s.diceCount[id] > 0) return id;
  }
  return from;
}

function draft(s: State): State {
  return {
    ...s,
    diceCount: { ...s.diceCount },
    dice: Object.fromEntries(Object.entries(s.dice).map(([k, v]) => [k, [...v]])),
    eliminatedOrder: [...s.eliminatedOrder],
    bid: s.bid ? { ...s.bid } : null,
    lastResult: s.lastResult ? { ...s.lastResult, bid: { ...s.lastResult.bid } } : null,
    log: [...s.log],
  };
}

const ceilHalf = (x: number) => Math.ceil(x / 2);

/** Une enchère est-elle légale par rapport à la précédente ? (règles Perudo). */
export function isLegalBid(prev: Bid | null, next: Bid, palifico: boolean): boolean {
  const { quantity: nq, value: nv } = next;
  if (!Number.isInteger(nq) || !Number.isInteger(nv) || nq < 1 || nv < 1 || nv > 6) return false;

  if (palifico) {
    if (!prev) return true; // ouverture Palifico : n'importe quelle valeur (Paco permis)
    if (nv !== prev.value) return false; // valeur figée
    return nq > prev.quantity; // on ne peut qu'augmenter la quantité
  }

  if (!prev) return nv !== 1; // ouverture normale : pas de Paco

  const pPaco = prev.value === 1;
  const nPaco = nv === 1;
  if (!pPaco && !nPaco) {
    // ni l'un ni l'autre Paco : on ne baisse jamais, on monte d'au moins un cran.
    return nq >= prev.quantity && nv >= prev.value && (nq > prev.quantity || nv > prev.value);
  }
  if (!pPaco && nPaco) return nq >= ceilHalf(prev.quantity); // normal -> Paco
  if (pPaco && !nPaco) return nq >= 2 * prev.quantity + 1; // Paco -> normal
  return nq > prev.quantity; // Paco -> Paco
}

/** Compte les dés correspondant à la valeur (Paco joker sauf en Palifico). */
function countMatching(s: State, value: number, palifico: boolean): number {
  let c = 0;
  for (const p of inGame(s)) {
    for (const d of s.dice[p]) {
      if (d === value) c++;
      else if (!palifico && value !== 1 && d === 1) c++;
    }
  }
  return c;
}

function loseDie(s: State, id: PlayerId) {
  s.diceCount[id] = Math.max(0, s.diceCount[id] - 1);
  if (s.diceCount[id] === 0) {
    s.eliminatedOrder.push(id);
    s.log = pushLog(s.log, `❌ ${nm(s, id)} perd son dernier dé — éliminé !`);
  } else {
    s.log = pushLog(s.log, `➖ ${nm(s, id)} perd un dé (${s.diceCount[id]} restant${s.diceCount[id] > 1 ? "s" : ""}).`);
    if (s.diceCount[id] === 1) s.palificoNext = id; // tombe à 1 dé -> Palifico la manche suivante
  }
}

function resolve(s: State, caller: PlayerId, type: "dudo" | "calza") {
  const bid = s.bid!;
  const count = countMatching(s, bid.value, s.palifico);
  let loser: PlayerId | null = null;
  let winner: PlayerId | null = null;

  if (type === "dudo") {
    // Exacte ou sous-estimée -> le contestataire perd ; trop haute -> l'enchérisseur perd.
    loser = count >= bid.quantity ? caller : bid.by;
    s.log = pushLog(s.log, `🗣️ Dudo de ${nm(s, caller)} ! Annonce : ${bid.quantity}× ${bid.value === 1 ? "Paco 🦜" : bid.value}. Compté : ${count}.`);
    loseDie(s, loser);
  } else {
    // Calza : exact = récupère un dé, sinon perd un dé.
    if (count === bid.quantity) {
      winner = caller;
      s.diceCount[caller] = Math.min(5, s.diceCount[caller] + 1);
      s.log = pushLog(s.log, `🎯 Calza exact de ${nm(s, caller)} (${count}) — il récupère un dé !`);
    } else {
      loser = caller;
      s.log = pushLog(s.log, `🎲 Calza raté de ${nm(s, caller)} (compté ${count} ≠ ${bid.quantity}).`);
      loseDie(s, loser);
    }
  }

  s.lastResult = { type, caller, bidder: bid.by, bid: { quantity: bid.quantity, value: bid.value }, count, loser, winner, palifico: s.palifico };

  // Prochain meneur : le perdant (ou le gagnant du Calza). Si éliminé, son voisin de gauche.
  const pivot = loser ?? winner ?? caller;
  s.nextStarter = s.diceCount[pivot] > 0 ? pivot : nextInGame(s, pivot);

  // Fin de partie ?
  if (inGame(s).length <= 1) {
    s.winner = inGame(s)[0] ?? null;
    s.phase = "finished";
    if (s.winner) s.log = pushLog(s.log, `🏆 ${nm(s, s.winner)} est le dernier en jeu — victoire !`);
  } else {
    s.phase = "reveal";
  }
}

// ───────────────────────────── Définition ─────────────────────────────

export const desDeToucan: GameDefinition<State, ToucanView> = {
  id: "des-de-toucan",
  name: "Dés de Toucan",
  tagline: "Bluff aux dés : surenchéris ou crie « Dudo ! »",
  description:
    "Adaptation de Perudo (3–8 joueurs). Chacun cache 5 dés. On enchérit sur le nombre de dés d'une valeur cachés sous tous les gobelets — en bluffant. Les 1 sont des Paco (toucans), jokers universels. Le dernier avec des dés gagne.",
  emoji: "🎲",
  accent: "honey",
  minPlayers: 3,
  maxPlayers: 8,
  estimatedMinutes: 15,
  tags: ["Bluff", "Dés", "Ambiance"],
  rules: [
    "Chacun cache 5 dés sous son gobelet (tu ne vois que les tiens).",
    "On enchérit sur le nombre de dés d'une même valeur cachés sur TOUTE la table.",
    "Chaque enchère doit monter : plus de dés, ou une valeur plus haute.",
    "Les 1 sont des Paco (toucans 🦜) : des jokers qui comptent dans toute enchère.",
    "Crie « Dudo ! » pour contester : on révèle et on compte ; le perdant perd un dé.",
    "Variante Calza : annonce un total exact pour récupérer un dé (ou en perdre un).",
    "Dernier joueur avec des dés = vainqueur.",
  ],

  createInitialState(ctx) {
    const ids = ctx.players.map((p) => p.id);
    const names: Record<PlayerId, string> = {};
    const diceCount: Record<PlayerId, number> = {};
    const dice: Record<PlayerId, number[]> = {};
    for (const p of ctx.players) { names[p.id] = p.name; diceCount[p.id] = 5; dice[p.id] = []; }
    const starter = ids[Math.floor(ctx.random() * ids.length)];

    const s: State = {
      players: ids, names, diceCount, dice, eliminatedOrder: [],
      phase: "bidding", bid: null, current: starter, starter,
      palifico: false, palificoNext: null, nextStarter: null, lastResult: null,
      winner: null, log: [`Les gobelets sont secoués. ${names[starter]} ouvre les enchères !`],
    };
    rollFor(s, ctx.random);
    return s;
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    if (state.phase === "finished") return { state };
    if (action.type === "start") return { state };

    const s = draft(state);
    const r = ctx.random;
    const me = ctx.playerId;
    const payload = (action.payload ?? {}) as Record<string, unknown>;

    switch (action.type) {
      case "bid": {
        if (s.phase !== "bidding" || me !== s.current) return { state };
        const quantity = Math.floor(Number(payload.quantity));
        const value = Math.floor(Number(payload.value));
        if (!isLegalBid(s.bid, { quantity, value }, s.palifico)) return { state };
        s.bid = { quantity, value, by: me };
        s.log = pushLog(s.log, `📣 ${nm(s, me)} annonce ${quantity}× ${value === 1 ? "Paco 🦜" : value}.`);
        s.current = nextInGame(s, me);
        return { state: s };
      }

      case "dudo": {
        if (s.phase !== "bidding" || me !== s.current || !s.bid) return { state };
        resolve(s, me, "dudo");
        return { state: s };
      }

      case "calza": {
        if (s.phase !== "bidding" || me !== s.current || !s.bid) return { state };
        resolve(s, me, "calza");
        return { state: s };
      }

      case "nextRound": {
        if (s.phase !== "reveal" || me !== s.nextStarter) return { state };
        const starter = s.nextStarter!;
        s.starter = starter;
        s.current = starter;
        s.bid = null;
        s.palifico = s.palificoNext === starter && s.diceCount[starter] > 0;
        s.palificoNext = null;
        s.nextStarter = null;
        s.lastResult = null;
        s.phase = "bidding";
        rollFor(s, r);
        s.log = pushLog(s.log, `🥤 Nouvelle manche${s.palifico ? " — PALIFICO !" : ""}. ${nm(s, starter)} ouvre.`);
        return { state: s };
      }

      default:
        return { state };
    }
  },

  viewFor(state, me): ToucanView {
    const s = state;
    const showAll = s.phase === "reveal" || s.phase === "finished";
    const players: ToucanPlayerView[] = s.players.map((id) => ({
      id,
      name: nm(s, id),
      diceCount: s.diceCount[id],
      alive: s.diceCount[id] > 0,
      isCurrent: id === s.current && s.phase === "bidding",
      isStarter: id === s.starter,
      dice: showAll ? s.dice[id] : id === me ? s.dice[id] : null,
    }));

    return {
      meId: me,
      myDice: s.dice[me] ?? [],
      alive: s.diceCount[me] > 0,
      players,
      phase: s.phase,
      bid: s.bid ? { quantity: s.bid.quantity, value: s.bid.value, by: s.bid.by } : null,
      currentId: s.current,
      starterId: s.starter,
      isMyTurn: s.phase === "bidding" && s.current === me && s.diceCount[me] > 0,
      palifico: s.palifico,
      totalDice: totalDice(s),
      canContinue: s.phase === "reveal" && s.nextStarter === me,
      nextStarterId: s.nextStarter,
      lastResult: s.lastResult,
      winner: s.winner,
      log: s.log,
    };
  },

  isFinished(state) {
    return state.phase === "finished";
  },

  getResults(state, players) {
    // Classement : vainqueur 1er, puis ordre inverse d'élimination.
    const order = [
      ...(state.winner ? [state.winner] : []),
      ...[...state.eliminatedOrder].reverse(),
    ];
    return players.map((p) => {
      const rank = order.indexOf(p.id) >= 0 ? order.indexOf(p.id) + 1 : players.length;
      const won = p.id === state.winner;
      return { playerId: p.id, score: won ? 1 : 0, rank, won };
    });
  },
};
