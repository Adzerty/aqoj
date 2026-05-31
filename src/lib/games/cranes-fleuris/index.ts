import {
  type GameAction,
  type GameDefinition,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Crânes fleuris — adaptation de « Skull » (Skull & Roses).
//
// Chaque joueur possède 3 disques-fleur + 1 disque-crâne. À chaque manche, on
// pose des disques face cachée, puis on lance/surenchérit un défi : le plus fort
// enchérisseur (le Challenger) doit retourner ce nombre de disques SANS tomber
// sur un crâne. Réussir DEUX défis (ou rester seul) = victoire. Bluff total.
//
// La discussion se fait à la voix (Discord) ; le moteur gère le secret des
// disques, les enchères et les retournements.
// ─────────────────────────────────────────────────────────────────────────────

export type DiscType = "flower" | "skull";
type Phase = "place" | "bid" | "attempt" | "finished";

interface State {
  players: PlayerId[];
  names: Record<PlayerId, string>;
  active: Record<PlayerId, boolean>;
  flowers: Record<PlayerId, number>; // disques-fleur possédés (0–3)
  skull: Record<PlayerId, boolean>; // possède encore son crâne ?
  wins: Record<PlayerId, number>; // défis réussis (tapis côté fleur)

  placed: Record<PlayerId, DiscType[]>; // disques posés ce tour (bas → haut)
  flipped: Record<PlayerId, number>; // disques retournés depuis le haut (tentative)
  placedFirst: Record<PlayerId, boolean>; // a posé son disque de phase 1

  phase: Phase;
  firstPlayer: PlayerId;
  current: PlayerId;
  challengeStarted: boolean;
  currentBid: number;
  highBidder: PlayerId | null;
  passed: Record<PlayerId, boolean>;

  challenger: PlayerId | null;
  bid: number;
  flipsDone: number;

  lostInfo: { player: PlayerId; type: DiscType } | null;
  lastResult: { type: "success" | "fail"; challenger: PlayerId; skullOwner?: PlayerId; bid: number } | null;
  winner: PlayerId | null;
  log: string[];
}

// ───────────────────────────── Vues ─────────────────────────────

export interface FleurPlayerView {
  id: PlayerId;
  name: string;
  active: boolean;
  discs: number; // disques possédés (public)
  placedCount: number;
  revealed: DiscType[]; // disques retournés (public)
  wins: number;
  isFirst: boolean;
  isCurrent: boolean;
  isHighBidder: boolean;
  passed: boolean;
  isChallenger: boolean;
  isWinner: boolean;
  myPlaced: DiscType[] | null; // visible seulement pour soi
}

export interface FleurView {
  meId: PlayerId;
  phase: Phase;
  active: boolean;
  // mes disques
  myFlowersInHand: number;
  mySkullInHand: boolean;
  myFlowersTotal: number;
  mySkullTotal: boolean;
  myWins: number;
  // contexte
  firstPlayerId: PlayerId;
  currentId: PlayerId;
  challengeStarted: boolean;
  currentBid: number;
  totalPlaced: number;
  challengerId: PlayerId | null;
  bid: number;
  flipsDone: number;
  // actions possibles
  canPlace: boolean;
  canAddOrChallenge: boolean;
  canBid: boolean;
  isChallenger: boolean;
  flippableIds: PlayerId[];
  // infos
  lostType: DiscType | null; // ce que J'AI perdu (privé)
  lastResult: State["lastResult"];
  players: FleurPlayerView[];
  winner: PlayerId | null;
  log: string[];
}

// ───────────────────────────── Helpers ─────────────────────────────

function pushLog(log: string[], e: string): string[] { return [e, ...log].slice(0, 50); }
const nm = (s: State, id: PlayerId) => s.names[id] ?? "Joueur";
const owned = (s: State, id: PlayerId) => s.flowers[id] + (s.skull[id] ? 1 : 0);
const activeList = (s: State) => s.players.filter((p) => s.active[p]);
const totalPlaced = (s: State) => s.players.reduce((a, p) => a + s.placed[p].length, 0);

const handFlowers = (s: State, id: PlayerId) => s.flowers[id] - s.placed[id].filter((d) => d === "flower").length;
const handSkull = (s: State, id: PlayerId) => (s.skull[id] ? 1 : 0) - s.placed[id].filter((d) => d === "skull").length;

function nextActive(s: State, from: PlayerId): PlayerId {
  const n = s.players.length;
  const i = s.players.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const id = s.players[(i + k) % n];
    if (s.active[id]) return id;
  }
  return from;
}
function nextNonPassed(s: State, from: PlayerId): PlayerId {
  const n = s.players.length;
  const i = s.players.indexOf(from);
  for (let k = 1; k <= n; k++) {
    const id = s.players[(i + k) % n];
    if (s.active[id] && !s.passed[id]) return id;
  }
  return from;
}

function draft(s: State): State {
  const cloneArr = (r: Record<PlayerId, DiscType[]>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, [...v]])) as Record<PlayerId, DiscType[]>;
  return {
    ...s,
    active: { ...s.active },
    flowers: { ...s.flowers },
    skull: { ...s.skull },
    wins: { ...s.wins },
    placed: cloneArr(s.placed),
    flipped: { ...s.flipped },
    placedFirst: { ...s.placedFirst },
    passed: { ...s.passed },
    lostInfo: s.lostInfo ? { ...s.lostInfo } : null,
    lastResult: s.lastResult ? { ...s.lastResult } : null,
    log: [...s.log],
  };
}

// ───────────────────────────── Transitions ─────────────────────────────

function endRound(s: State, firstPlayer: PlayerId) {
  if (activeList(s).length <= 1) {
    s.winner = activeList(s)[0] ?? null;
    s.phase = "finished";
    if (s.winner) s.log = pushLog(s.log, `🏁 ${nm(s, s.winner)} reste seul·e en jeu — victoire !`);
    return;
  }
  for (const p of s.players) {
    s.placed[p] = [];
    s.flipped[p] = 0;
    s.placedFirst[p] = false;
    s.passed[p] = false;
  }
  s.challengeStarted = false;
  s.challenger = null;
  s.currentBid = 0;
  s.highBidder = null;
  s.bid = 0;
  s.flipsDone = 0;
  const fp = s.active[firstPlayer] ? firstPlayer : nextActive(s, firstPlayer);
  s.firstPlayer = fp;
  s.current = fp;
  s.phase = "place";
  s.log = pushLog(s.log, `🌸 Nouvelle manche. ${nm(s, fp)} ouvre.`);
}

function loseDisc(s: State, id: PlayerId, random: () => number) {
  const total = owned(s, id);
  if (total <= 0) return;
  const idx = Math.floor(random() * total);
  // disques = [crâne?] + fleurs…
  if (s.skull[id] && idx === 0) {
    s.skull[id] = false;
    s.lostInfo = { player: id, type: "skull" };
  } else {
    s.flowers[id] = Math.max(0, s.flowers[id] - 1);
    s.lostInfo = { player: id, type: "flower" };
  }
  s.log = pushLog(s.log, `➖ ${nm(s, id)} perd un disque (il en reste ${owned(s, id)}).`);
  if (owned(s, id) === 0) {
    s.active[id] = false;
    s.log = pushLog(s.log, `☠️ ${nm(s, id)} n'a plus de disque — éliminé·e !`);
  }
}

function succeed(s: State) {
  const c = s.challenger!;
  s.wins[c]++;
  s.lastResult = { type: "success", challenger: c, bid: s.bid };
  s.log = pushLog(s.log, `🌸 ${nm(s, c)} réussit son défi (${s.bid} disque(s), aucun crâne) !`);
  if (s.wins[c] >= 2) {
    s.winner = c;
    s.phase = "finished";
    s.log = pushLog(s.log, `🏆 ${nm(s, c)} remporte son DEUXIÈME défi — victoire !`);
    return;
  }
  endRound(s, c);
}

function fail(s: State, skullOwner: PlayerId, random: () => number) {
  const c = s.challenger!;
  s.lastResult = { type: "fail", challenger: c, skullOwner, bid: s.bid };
  s.log = pushLog(s.log, `💀 ${nm(s, c)} retourne un crâne (chez ${nm(s, skullOwner)}) — défi échoué !`);

  // Cas particulier : un joueur à 1 seul disque (son crâne) qui est révélé est éliminé.
  if (skullOwner !== c && owned(s, skullOwner) === 1 && s.skull[skullOwner]) {
    s.active[skullOwner] = false;
    s.skull[skullOwner] = false;
    s.log = pushLog(s.log, `☠️ ${nm(s, skullOwner)} n'avait que son crâne — éliminé·e !`);
  }

  loseDisc(s, c, random);

  // Premier joueur du tour suivant : celui chez qui le crâne a été retourné (s'il est encore là).
  const nextFirst = s.active[skullOwner] ? skullOwner : nextActive(s, c);
  endRound(s, nextFirst);
}

function startAttempt(s: State, challenger: PlayerId, random: () => number) {
  s.challenger = challenger;
  s.bid = s.currentBid;
  s.phase = "attempt";
  s.flipsDone = 0;
  for (const p of s.players) s.flipped[p] = 0;
  s.log = pushLog(s.log, `🎯 ${nm(s, challenger)} est le Challenger : il doit retourner ${s.bid} disque(s).`);

  // Retourne d'abord ses propres disques (le nombre juste nécessaire, depuis le haut).
  const ownStack = s.placed[challenger];
  const k = Math.min(ownStack.length, s.bid);
  for (let i = 0; i < k; i++) {
    const disc = ownStack[ownStack.length - 1 - i];
    s.flipped[challenger] = i + 1;
    s.flipsDone++;
    if (disc === "skull") {
      fail(s, challenger, random);
      return;
    }
  }
  if (s.flipsDone >= s.bid) succeed(s);
}

// ───────────────────────────── Définition ─────────────────────────────

export const cranesFleuris: GameDefinition<State, FleurView> = {
  id: "cranes-fleuris",
  name: "Crânes fleuris",
  tagline: "Pose, bluffe, surenchéris… et ne retourne jamais un crâne.",
  description:
    "Adaptation de Skull (3–6 joueurs). Chacun a 3 fleurs et 1 crâne. On pose des disques face cachée, puis on enchérit sur le nombre qu'on s'engage à retourner sans tomber sur un crâne. Réussis deux défis pour gagner — mais gare au bluff de tes adversaires.",
  emoji: "🌺",
  accent: "plum",
  minPlayers: 3,
  maxPlayers: 6,
  estimatedMinutes: 20,
  tags: ["Bluff", "Enchères", "Ambiance"],
  rules: [
    "Chacun possède 3 disques-fleur 🌸 et 1 disque-crâne 💀, posés face cachée (toi seul connais tes faces).",
    "Phase 1 : chacun pose un disque sur son tapis.",
    "Phase 2 : à tour de rôle, ajoute un disque OU lance un défi (un nombre de disques à retourner). Les autres surenchérissent ou passent.",
    "Le plus fort enchérisseur devient le Challenger et retourne ce nombre de disques — en commençant par les siens.",
    "Un crâne retourné = défi échoué : le Challenger perd un disque au hasard (éliminé s'il n'en a plus).",
    "Aucun crâne et le bon nombre atteint = défi réussi : tapis côté fleur. Réussir DEUX défis (ou rester seul) = victoire !",
  ],

  createInitialState(ctx) {
    const ids = ctx.players.map((p) => p.id);
    const names: Record<PlayerId, string> = {};
    const active: Record<PlayerId, boolean> = {};
    const flowers: Record<PlayerId, number> = {};
    const skull: Record<PlayerId, boolean> = {};
    const wins: Record<PlayerId, number> = {};
    const placed: Record<PlayerId, DiscType[]> = {};
    const flipped: Record<PlayerId, number> = {};
    const placedFirst: Record<PlayerId, boolean> = {};
    const passed: Record<PlayerId, boolean> = {};
    for (const p of ctx.players) {
      names[p.id] = p.name;
      active[p.id] = true;
      flowers[p.id] = 3;
      skull[p.id] = true;
      wins[p.id] = 0;
      placed[p.id] = [];
      flipped[p.id] = 0;
      placedFirst[p.id] = false;
      passed[p.id] = false;
    }
    return {
      players: ids, names, active, flowers, skull, wins, placed, flipped, placedFirst,
      phase: "place", firstPlayer: ids[0], current: ids[0],
      challengeStarted: false, currentBid: 0, highBidder: null, passed,
      challenger: null, bid: 0, flipsDone: 0,
      lostInfo: null, lastResult: null, winner: null,
      log: [`Crânes fleuris : ${names[ids[0]]} ouvre la danse. Posez vos disques !`],
    };
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    if (state.phase === "finished") return { state };
    if (action.type === "start") return { state };

    const s = draft(state);
    const me = ctx.playerId;
    const r = ctx.random;
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const discType = payload.type === "skull" ? "skull" : "flower";

    switch (action.type) {
      case "place": {
        if (s.phase !== "place" || !s.active[me] || s.placedFirst[me]) return { state };
        if (discType === "skull" ? handSkull(s, me) <= 0 : handFlowers(s, me) <= 0) return { state };
        s.placed[me].push(discType);
        s.placedFirst[me] = true;
        if (activeList(s).every((p) => s.placedFirst[p])) {
          s.phase = "bid";
          s.current = s.firstPlayer;
          s.log = pushLog(s.log, `Tous les disques sont posés. À ${nm(s, s.firstPlayer)} de jouer.`);
        }
        return { state: s };
      }

      case "add": {
        if (s.phase !== "bid" || s.challengeStarted || me !== s.current) return { state };
        if (discType === "skull" ? handSkull(s, me) <= 0 : handFlowers(s, me) <= 0) return { state };
        s.placed[me].push(discType);
        s.log = pushLog(s.log, `${nm(s, me)} ajoute un disque.`);
        s.current = nextActive(s, me);
        return { state: s };
      }

      case "challenge": {
        if (s.phase !== "bid" || s.challengeStarted || me !== s.current) return { state };
        const bid = Math.floor(Number(payload.bid));
        if (bid < 1 || bid > totalPlaced(s)) return { state };
        s.challengeStarted = true;
        s.currentBid = bid;
        s.highBidder = me;
        for (const p of s.players) s.passed[p] = false;
        s.log = pushLog(s.log, `📣 ${nm(s, me)} lance un défi : ${bid} disque(s) !`);
        s.current = nextNonPassed(s, me);
        return { state: s };
      }

      case "raise": {
        if (s.phase !== "bid" || !s.challengeStarted || me !== s.current || s.passed[me]) return { state };
        const bid = Math.floor(Number(payload.bid));
        if (bid <= s.currentBid || bid > totalPlaced(s)) return { state };
        s.currentBid = bid;
        s.highBidder = me;
        s.log = pushLog(s.log, `📣 ${nm(s, me)} surenchérit : ${bid} !`);
        s.current = nextNonPassed(s, me);
        return { state: s };
      }

      case "pass": {
        if (s.phase !== "bid" || !s.challengeStarted || me !== s.current || s.passed[me]) return { state };
        s.passed[me] = true;
        s.log = pushLog(s.log, `🙅 ${nm(s, me)} passe.`);
        const remaining = activeList(s).filter((p) => !s.passed[p]);
        if (remaining.length === 1) {
          startAttempt(s, remaining[0], r);
        } else {
          s.current = nextNonPassed(s, me);
        }
        return { state: s };
      }

      case "flip": {
        if (s.phase !== "attempt" || me !== s.challenger) return { state };
        const t = String(payload.targetId);
        if (!s.players.includes(t) || t === s.challenger) return { state };
        if (s.flipped[t] >= s.placed[t].length) return { state };
        const disc = s.placed[t][s.placed[t].length - 1 - s.flipped[t]];
        s.flipped[t]++;
        s.flipsDone++;
        if (disc === "skull") {
          fail(s, t, r);
        } else if (s.flipsDone >= s.bid) {
          succeed(s);
        }
        return { state: s };
      }

      default:
        return { state };
    }
  },

  viewFor(state, me): FleurView {
    const s = state;
    const finished = s.phase === "finished";

    const players: FleurPlayerView[] = s.players.map((id) => {
      const stack = s.placed[id];
      const revealed: DiscType[] = [];
      for (let i = 0; i < s.flipped[id]; i++) revealed.push(stack[stack.length - 1 - i]);
      return {
        id,
        name: nm(s, id),
        active: s.active[id],
        discs: owned(s, id),
        placedCount: stack.length,
        revealed,
        wins: s.wins[id],
        isFirst: id === s.firstPlayer,
        isCurrent: id === s.current && (s.phase === "bid"),
        isHighBidder: id === s.highBidder && s.challengeStarted,
        passed: !!s.passed[id] && s.challengeStarted,
        isChallenger: id === s.challenger,
        isWinner: finished && s.winner === id,
        myPlaced: id === me || finished ? [...stack] : null,
      };
    });

    const isChallenger = s.phase === "attempt" && s.challenger === me;
    return {
      meId: me,
      phase: s.phase,
      active: s.active[me],
      myFlowersInHand: handFlowers(s, me),
      mySkullInHand: handSkull(s, me) > 0,
      myFlowersTotal: s.flowers[me],
      mySkullTotal: s.skull[me],
      myWins: s.wins[me],
      firstPlayerId: s.firstPlayer,
      currentId: s.current,
      challengeStarted: s.challengeStarted,
      currentBid: s.currentBid,
      totalPlaced: totalPlaced(s),
      challengerId: s.challenger,
      bid: s.bid,
      flipsDone: s.flipsDone,
      canPlace: s.phase === "place" && s.active[me] && !s.placedFirst[me],
      canAddOrChallenge: s.phase === "bid" && !s.challengeStarted && s.current === me,
      canBid: s.phase === "bid" && s.challengeStarted && s.current === me && !s.passed[me],
      isChallenger,
      flippableIds: isChallenger
        ? s.players.filter((id) => id !== me && s.flipped[id] < s.placed[id].length)
        : [],
      lostType: s.lostInfo?.player === me ? s.lostInfo.type : null,
      lastResult: s.lastResult,
      players,
      winner: s.winner,
      log: s.log,
    };
  },

  isFinished(state) {
    return state.phase === "finished";
  },

  getResults(state, players) {
    return players.map((p) => ({
      playerId: p.id,
      score: state.winner === p.id ? 1 : 0,
      rank: state.winner === p.id ? 1 : 2,
      won: state.winner === p.id,
    }));
  },
};
