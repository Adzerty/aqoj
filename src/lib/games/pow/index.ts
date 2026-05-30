import {
  type GameAction,
  type GameDefinition,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// POW! — adaptation de « Bang! » (4–7 joueurs).
//
// Déduction sociale + duels au revolver. Rôles secrets (Shérif révélé, Adjoints,
// Hors-la-loi, Renégat), 16 personnages aux pouvoirs uniques, et le système de
// cartes de Bang! : BANG!/Manqué!, distances & armes, Tonneau, Duel, Indiens,
// Gatling, Magasin, Prison, Dynamite, etc.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = "sheriff" | "deputy" | "outlaw" | "renegade";
export type Team = "sheriff" | "outlaws" | "renegade";
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type CardType =
  | "bang" | "missed" | "beer" | "saloon" | "stagecoach" | "wells_fargo"
  | "general_store" | "panic" | "cat_balou" | "duel" | "indians" | "gatling"
  | "barrel" | "scope" | "mustang" | "jail" | "dynamite"
  | "volcanic" | "schofield" | "remington" | "carbine" | "winchester";

export interface Card {
  id: string;
  type: CardType;
  suit: Suit;
  rank: number; // 1=A, 11=J, 12=Q, 13=K
}

export type CharKey =
  | "bart_cassidy" | "black_jack" | "calamity_janet" | "el_gringo" | "jesse_jones"
  | "jourdonnais" | "kit_carson" | "lucky_duke" | "paul_regret" | "pedro_ramirez"
  | "rose_doolan" | "sid_ketchum" | "slab" | "sam" | "suzy" | "willy_kid";

export interface Character { key: CharKey; name: string; hp: number; power: string }

export const CHARACTERS: Character[] = [
  { key: "bart_cassidy", name: "Bart Cassidy", hp: 4, power: "Pioche 1 carte à chaque point de vie perdu." },
  { key: "black_jack", name: "Black Jack", hp: 4, power: "En piochant, révèle sa 2e carte ; si ♥/♦, pioche une 3e." },
  { key: "calamity_janet", name: "Calamity Janet", hp: 4, power: "Utilise les BANG! comme Manqué! et inversement." },
  { key: "el_gringo", name: "El Gringo", hp: 3, power: "Quand un joueur lui fait perdre un PV, il lui vole une carte." },
  { key: "jesse_jones", name: "Jesse Jones", hp: 4, power: "Peut piocher sa 1re carte dans la main d'un joueur." },
  { key: "jourdonnais", name: "Jourdonnais", hp: 4, power: "Possède un Tonneau permanent." },
  { key: "kit_carson", name: "Kit Carson", hp: 4, power: "Regarde 3 cartes, en garde 2, repose la 3e." },
  { key: "lucky_duke", name: "Lucky Duke", hp: 4, power: "À chaque « dégaine », tire 2 cartes et garde la meilleure." },
  { key: "paul_regret", name: "Paul Regret", hp: 3, power: "Possède un Mustang permanent (+1 distance)." },
  { key: "pedro_ramirez", name: "Pedro Ramirez", hp: 4, power: "Peut piocher sa 1re carte sur la défausse." },
  { key: "rose_doolan", name: "Rose Doolan", hp: 4, power: "Possède une Lunette permanente (-1 distance)." },
  { key: "sid_ketchum", name: "Sid Ketchum", hp: 4, power: "Défausse 2 cartes pour regagner 1 PV." },
  { key: "slab", name: "Slab le Flingueur", hp: 4, power: "Ses BANG! exigent 2 Manqué! pour être annulés." },
  { key: "sam", name: "Sam le Vautour", hp: 4, power: "Récupère les cartes des joueurs éliminés." },
  { key: "suzy", name: "Suzy Lafayette", hp: 4, power: "Pioche dès qu'elle n'a plus de carte en main." },
  { key: "willy_kid", name: "Willy the Kid", hp: 4, power: "Peut jouer autant de BANG! qu'il veut." },
];

// Composition des 80 cartes de jeu.
const DECK: { type: CardType; n: number }[] = [
  { type: "bang", n: 25 }, { type: "missed", n: 12 }, { type: "beer", n: 6 },
  { type: "panic", n: 4 }, { type: "cat_balou", n: 4 }, { type: "stagecoach", n: 2 },
  { type: "wells_fargo", n: 1 }, { type: "general_store", n: 2 }, { type: "indians", n: 2 },
  { type: "duel", n: 3 }, { type: "gatling", n: 1 }, { type: "saloon", n: 1 },
  { type: "barrel", n: 2 }, { type: "scope", n: 1 }, { type: "mustang", n: 2 },
  { type: "jail", n: 3 }, { type: "dynamite", n: 1 }, { type: "volcanic", n: 2 },
  { type: "schofield", n: 3 }, { type: "remington", n: 1 }, { type: "carbine", n: 1 },
  { type: "winchester", n: 1 },
];

const ROLE_SETUP: Record<number, Role[]> = {
  4: ["sheriff", "renegade", "outlaw", "outlaw"],
  5: ["sheriff", "renegade", "outlaw", "outlaw", "deputy"],
  6: ["sheriff", "renegade", "outlaw", "outlaw", "outlaw", "deputy"],
  7: ["sheriff", "renegade", "outlaw", "outlaw", "outlaw", "deputy", "deputy"],
};

const WEAPON_RANGE: Partial<Record<CardType, number>> = {
  volcanic: 1, schofield: 2, remington: 3, carbine: 4, winchester: 5,
};
const WEAPONS = new Set<CardType>(["volcanic", "schofield", "remington", "carbine", "winchester"]);
const BLUE = new Set<CardType>([...WEAPONS, "barrel", "scope", "mustang"]);

// ───────────────────────────── État ─────────────────────────────

type Pending =
  | { kind: "bang"; target: PlayerId; source: PlayerId; hits: number; missed: number; barrelTried: boolean }
  | { kind: "gatling"; source: PlayerId; queue: PlayerId[]; barrelTried: boolean }
  | { kind: "indians"; source: PlayerId; queue: PlayerId[] }
  | { kind: "duel"; current: PlayerId; other: PlayerId }
  | { kind: "general_store"; cards: Card[]; order: PlayerId[]; idx: number }
  | { kind: "death_save"; player: PlayerId; killer: PlayerId | null };

interface State {
  players: PlayerId[];
  names: Record<PlayerId, string>;
  roles: Record<PlayerId, Role>;
  chars: Record<PlayerId, CharKey>;
  alive: Record<PlayerId, boolean>;
  maxHp: Record<PlayerId, number>;
  hp: Record<PlayerId, number>;
  hands: Record<PlayerId, Card[]>;
  board: Record<PlayerId, Card[]>; // cartes bleues en jeu
  jail: Record<PlayerId, Card | null>;
  dynamite: { holder: PlayerId; card: Card } | null;
  deck: Card[];
  discard: Card[];
  turn: number; // index du joueur courant dans players
  phase: "draw" | "play" | "discard" | "finished";
  bangsThisTurn: number;
  pending: Pending[];
  kitPreview: Card[] | null; // Kit Carson : 3 cartes en attente de choix
  winner: Team | null;
  log: string[];
}

// ───────────────────────────── Vues ─────────────────────────────

export interface PowCardView { id: string; type: CardType; suit: Suit; rank: number }
export interface PowPlayerView {
  id: PlayerId;
  alive: boolean;
  role: Role | null; // visible si Shérif, soi-même, mort, ou fin de partie
  char: CharKey;
  charName: string;
  hp: number;
  maxHp: number;
  handCount: number;
  board: PowCardView[];
  jailed: boolean;
  hasDynamite: boolean;
  isCurrent: boolean;
  distance: number | null; // distance vue depuis le spectateur (null = soi)
  inRange: boolean; // atteignable par un BANG! du spectateur
}

export interface PowPendingView {
  kind: Pending["kind"];
  forMe: boolean;
  actor: PlayerId | null;
  source?: PlayerId;
  hits?: number;
  missed?: number;
  storeCards?: PowCardView[];
}

export interface PowView {
  meId: PlayerId;
  myRole: Role;
  myChar: CharKey;
  alive: boolean;
  hand: PowCardView[];
  players: PowPlayerView[];
  phase: State["phase"];
  currentId: PlayerId;
  isMyTurn: boolean;
  bangsThisTurn: number;
  weaponRange: number;
  deckSize: number;
  discardTop: PowCardView | null;
  pending: PowPendingView | null;
  kitPreview: PowCardView[] | null;
  handLimit: number;
  winner: Team | null;
  log: string[];
}

// ───────────────────────────── Helpers ─────────────────────────────

function shuffle<T>(a: T[], r: () => number): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
function pushLog(log: string[], e: string): string[] { return [e, ...log].slice(0, 50); }
const nm = (s: State, id: PlayerId) => s.names[id] ?? "Joueur";
const aliveList = (s: State) => s.players.filter((p) => s.alive[p]);

function draft(s: State): State {
  const cloneRec = <T>(r: Record<PlayerId, T[]>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, [...v]])) as Record<PlayerId, T[]>;
  return {
    ...s,
    alive: { ...s.alive },
    hp: { ...s.hp },
    hands: cloneRec(s.hands),
    board: cloneRec(s.board),
    jail: { ...s.jail },
    deck: [...s.deck],
    discard: [...s.discard],
    pending: s.pending.map((p) => ({ ...p, ...("queue" in p ? { queue: [...p.queue] } : {}), ...("cards" in p ? { cards: [...p.cards] } : {}) })) as Pending[],
    kitPreview: s.kitPreview ? [...s.kitPreview] : null,
    log: [...s.log],
  };
}

// Distance de base sur le cercle des joueurs vivants.
function baseDistance(s: State, a: PlayerId, b: PlayerId): number {
  const circle = aliveList(s);
  const ia = circle.indexOf(a), ib = circle.indexOf(b);
  if (ia < 0 || ib < 0) return 99;
  const d = Math.abs(ia - ib);
  return Math.min(d, circle.length - d);
}
function hasCard(s: State, id: PlayerId, t: CardType): boolean {
  return s.board[id]?.some((c) => c.type === t) ?? false;
}
function scopeBonus(s: State, id: PlayerId): number {
  return (hasCard(s, id, "scope") ? 1 : 0) + (s.chars[id] === "rose_doolan" ? 1 : 0);
}
function mustangBonus(s: State, id: PlayerId): number {
  return (hasCard(s, id, "mustang") ? 1 : 0) + (s.chars[id] === "paul_regret" ? 1 : 0);
}
// Distance perçue par `viewer` vers `target` (Lunette/Mustang, pas les armes).
function seenDistance(s: State, viewer: PlayerId, target: PlayerId): number {
  return Math.max(1, baseDistance(s, viewer, target) - scopeBonus(s, viewer) + mustangBonus(s, target));
}
function weaponRange(s: State, id: PlayerId): number {
  const w = s.board[id]?.find((c) => WEAPONS.has(c.type));
  return w ? WEAPON_RANGE[w.type]! : 1;
}
function inRange(s: State, a: PlayerId, b: PlayerId): boolean {
  return seenDistance(s, a, b) <= weaponRange(s, a);
}
const handLimit = (s: State, id: PlayerId) => Math.max(0, s.hp[id]);

function isMissedCard(char: CharKey, c: Card): boolean {
  return c.type === "missed" || (char === "calamity_janet" && c.type === "bang");
}
function isBangCard(char: CharKey, c: Card): boolean {
  return c.type === "bang" || (char === "calamity_janet" && c.type === "missed");
}

function ensureDeck(s: State, r: () => number) {
  if (s.deck.length === 0 && s.discard.length > 0) {
    s.deck = shuffle(s.discard, r);
    s.discard = [];
  }
}
function drawN(s: State, id: PlayerId, n: number, r: () => number) {
  for (let i = 0; i < n; i++) {
    ensureDeck(s, r);
    const c = s.deck.shift();
    if (c) s.hands[id].push(c);
  }
}
function discardCardFromHand(s: State, id: PlayerId, cardId: string): Card | null {
  const i = s.hands[id].findIndex((c) => c.id === cardId);
  if (i < 0) return null;
  const [c] = s.hands[id].splice(i, 1);
  s.discard.push(c);
  return c;
}
function checkSuzy(s: State, id: PlayerId, r: () => number) {
  if (s.alive[id] && s.chars[id] === "suzy" && s.hands[id].length === 0) drawN(s, id, 1, r);
}

// « Dégaine » : retourne la carte déterminante (gère Lucky Duke).
function drawCheck(s: State, id: PlayerId, want: (c: Card) => boolean, r: () => number): Card {
  ensureDeck(s, r);
  if (s.chars[id] === "lucky_duke") {
    ensureDeck(s, r);
    const c1 = s.deck.shift()!;
    ensureDeck(s, r);
    const c2 = s.deck.shift() ?? c1;
    s.discard.push(c1);
    if (c2 !== c1) s.discard.push(c2);
    return want(c1) ? c1 : want(c2) ? c2 : c1;
  }
  const c = s.deck.shift()!;
  s.discard.push(c);
  return c;
}

// ───────────────────────────── Dégâts / mort ─────────────────────────────

function dealDamage(s: State, target: PlayerId, amount: number, source: PlayerId | null, r: () => number) {
  if (!s.alive[target]) return;
  s.hp[target] -= amount;
  s.log = pushLog(s.log, `💥 ${nm(s, target)} perd ${amount} PV.`);
  // El Gringo : vole une carte par PV perdu au joueur responsable.
  if (s.chars[target] === "el_gringo" && source && source !== target && s.hands[source]?.length) {
    for (let i = 0; i < amount && s.hands[source].length; i++) {
      const idx = Math.floor(r() * s.hands[source].length);
      const [stolen] = s.hands[source].splice(idx, 1);
      s.hands[target].push(stolen);
    }
    s.log = pushLog(s.log, `🤠 El Gringo vole une carte à ${nm(s, source)}.`);
    checkSuzy(s, source, r);
  }
  // Bart Cassidy : pioche un nombre de cartes égal aux PV perdus.
  if (s.chars[target] === "bart_cassidy" && s.hp[target] > 0) {
    drawN(s, target, amount, r);
    s.log = pushLog(s.log, `🤠 Bart Cassidy pioche ${amount} carte(s).`);
  }
  if (s.hp[target] <= 0) {
    const canBeer = aliveList(s).length > 2 && s.hands[target].some((c) => c.type === "beer");
    if (canBeer) {
      s.pending.push({ kind: "death_save", player: target, killer: source });
    } else {
      eliminate(s, target, source, r);
    }
  }
}

function eliminate(s: State, id: PlayerId, killer: PlayerId | null, r: () => number) {
  if (!s.alive[id]) return;
  s.alive[id] = false;
  s.log = pushLog(s.log, `☠️ ${nm(s, id)} est éliminé (${s.roles[id] === "sheriff" ? "Shérif" : s.roles[id] === "renegade" ? "Renégat" : s.roles[id] === "deputy" ? "Adjoint" : "Hors-la-loi"}).`);

  // Récompenses / pénalités
  const allCards = [...s.hands[id], ...s.board[id], ...(s.jail[id] ? [s.jail[id]!] : [])].filter(Boolean) as Card[];
  s.hands[id] = [];
  s.board[id] = [];
  s.jail[id] = null;

  const vulture = s.players.find((p) => p !== id && s.alive[p] && s.chars[p] === "sam");
  if (vulture) {
    s.hands[vulture].push(...allCards);
    s.log = pushLog(s.log, `🦅 Sam le Vautour récupère les cartes de ${nm(s, id)}.`);
  } else {
    s.discard.push(...allCards);
  }

  // Le Shérif qui élimine un Adjoint perd toutes ses cartes.
  if (killer && s.roles[killer] === "sheriff" && s.roles[id] === "deputy") {
    s.discard.push(...s.hands[killer], ...s.board[killer]);
    s.hands[killer] = [];
    s.board[killer] = [];
    s.log = pushLog(s.log, `😵 Le Shérif a abattu un Adjoint : il défausse toutes ses cartes !`);
  }
  // Qui élimine un Hors-la-loi pioche 3 cartes.
  if (killer && s.alive[killer] && s.roles[id] === "outlaw") {
    drawN(s, killer, 3, r);
    s.log = pushLog(s.log, `💰 ${nm(s, killer)} récupère 3 cartes (prime).`);
  }
  checkWin(s);
}

function checkWin(s: State) {
  if (s.winner) return;
  const alive = aliveList(s);
  const sheriffAlive = alive.some((p) => s.roles[p] === "sheriff");
  const outlawsAlive = alive.some((p) => s.roles[p] === "outlaw");
  const renegadeAlive = alive.some((p) => s.roles[p] === "renegade");

  if (!sheriffAlive) {
    if (alive.length === 1 && s.roles[alive[0]] === "renegade") {
      s.winner = "renegade";
      s.log = pushLog(s.log, "🏁 Le Renégat est le dernier en vie — il l'emporte !");
    } else {
      s.winner = "outlaws";
      s.log = pushLog(s.log, "🏁 Le Shérif est mort — les Hors-la-loi l'emportent !");
    }
    s.phase = "finished";
  } else if (!outlawsAlive && !renegadeAlive) {
    s.winner = "sheriff";
    s.log = pushLog(s.log, "🏁 Plus de menace — le Shérif et ses Adjoints l'emportent !");
    s.phase = "finished";
  }
}

// ───────────────────────────── Tours ─────────────────────────────

function nextTurn(s: State, r: () => number) {
  if (s.winner) return;
  const n = s.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (s.turn + step) % n;
    if (s.alive[s.players[idx]]) { s.turn = idx; break; }
  }
  beginTurn(s, r);
}

function beginTurn(s: State, r: () => number) {
  const id = s.players[s.turn];
  s.bangsThisTurn = 0;
  s.kitPreview = null;

  // Dynamite (en premier)
  if (s.dynamite && s.dynamite.holder === id) {
    const c = drawCheck(s, id, (x) => !(x.suit === "spades" && x.rank >= 2 && x.rank <= 9), r);
    if (c.suit === "spades" && c.rank >= 2 && c.rank <= 9) {
      s.discard.push(s.dynamite.card);
      s.dynamite = null;
      s.log = pushLog(s.log, `🧨 La Dynamite explose sur ${nm(s, id)} (-3 PV) !`);
      dealDamage(s, id, 3, null, r);
      if (!s.alive[id]) { if (!s.winner) nextTurn(s, r); return; }
    } else {
      // passe à gauche
      const circle = aliveList(s);
      const i = circle.indexOf(id);
      const left = circle[(i + 1) % circle.length];
      s.dynamite = { holder: left, card: s.dynamite.card };
      s.log = pushLog(s.log, `🧨 La Dynamite passe à ${nm(s, left)}.`);
    }
  }
  // Prison
  if (s.jail[id]) {
    const c = drawCheck(s, id, (x) => x.suit === "hearts", r);
    const card = s.jail[id]!;
    s.jail[id] = null;
    s.discard.push(card);
    if (c.suit === "hearts") {
      s.log = pushLog(s.log, `🔓 ${nm(s, id)} s'échappe de prison !`);
    } else {
      s.log = pushLog(s.log, `🔒 ${nm(s, id)} reste en prison et passe son tour.`);
      nextTurn(s, r);
      return;
    }
  }
  s.phase = "draw";
  s.log = pushLog(s.log, `▶️ Tour de ${nm(s, id)}.`);
}

// ───────────────────────────── Définition ─────────────────────────────

export const pow: GameDefinition<State, PowView> = {
  id: "pow",
  name: "POW!",
  tagline: "Western à rôles cachés : descends les bons, démasque les traîtres.",
  description:
    "Adaptation de Bang! (4–7 joueurs). Le Shérif et ses Adjoints traquent les Hors-la-loi et le Renégat. Personnages à pouvoirs, duels au pistolet, Dynamite, Prison… le Far West dans toute sa folie.",
  emoji: "🤠",
  accent: "clay",
  minPlayers: 4,
  maxPlayers: 7,
  estimatedMinutes: 30,
  tags: ["Rôles cachés", "Cartes", "Soirée"],

  createInitialState(ctx) {
    const r = ctx.random;
    const ids = ctx.players.map((p) => p.id);
    const n = ids.length;

    // Rôles (mélangés sur les sièges).
    const rolePool = shuffle(ROLE_SETUP[n] ?? ROLE_SETUP[7].slice(0, n), r);
    const roles: Record<PlayerId, Role> = {};
    ids.forEach((id, i) => (roles[id] = rolePool[i]));

    // Personnages
    const charPool = shuffle(CHARACTERS, r);
    const chars: Record<PlayerId, CharKey> = {};
    const maxHp: Record<PlayerId, number> = {};
    const hp: Record<PlayerId, number> = {};
    ids.forEach((id, i) => {
      const c = charPool[i % charPool.length];
      chars[id] = c.key;
      const bonus = roles[id] === "sheriff" ? 1 : 0;
      maxHp[id] = c.hp + bonus;
      hp[id] = c.hp + bonus;
    });

    // Pioche
    let cardId = 0;
    const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
    const raw: Card[] = [];
    for (const { type, n: count } of DECK) {
      for (let i = 0; i < count; i++) {
        raw.push({ id: `c${cardId++}`, type, suit: suits[Math.floor(r() * 4)], rank: 1 + Math.floor(r() * 13) });
      }
    }
    const deck = shuffle(raw, r);

    const names: Record<PlayerId, string> = {};
    const alive: Record<PlayerId, boolean> = {};
    const hands: Record<PlayerId, Card[]> = {};
    const board: Record<PlayerId, Card[]> = {};
    const jail: Record<PlayerId, Card | null> = {};
    for (const p of ctx.players) {
      names[p.id] = p.name;
      alive[p.id] = true;
      hands[p.id] = [];
      board[p.id] = [];
      jail[p.id] = null;
    }
    // Mains de départ = PV de chaque joueur.
    for (const id of ids) for (let i = 0; i < hp[id]; i++) hands[id].push(deck.shift()!);

    const sheriffIdx = ids.findIndex((id) => roles[id] === "sheriff");

    const s: State = {
      players: ids, names, roles, chars, alive, maxHp, hp, hands, board, jail,
      dynamite: null, deck, discard: [], turn: sheriffIdx, phase: "draw",
      bangsThisTurn: 0, pending: [], kitPreview: null, winner: null,
      log: [`Le shérif ${names[ids[sheriffIdx]]} ouvre le bal. Que le Far West tremble !`],
    };
    return s;
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    if (state.phase === "finished") return { state };
    if (action.type === "start") return { state };

    const s = draft(state);
    const r = ctx.random;
    const me = ctx.playerId;
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const cardId = typeof payload.cardId === "string" ? payload.cardId : "";
    const targetId = typeof payload.targetId === "string" ? payload.targetId : "";
    const current = s.players[s.turn];
    const top = s.pending[s.pending.length - 1];

    // ─────────── Réactions (priorité au sommet de la pile) ───────────
    if (top) {
      const actor =
        top.kind === "bang" ? top.target
          : top.kind === "gatling" || top.kind === "indians" ? top.queue[0]
            : top.kind === "duel" ? top.current
              : top.kind === "general_store" ? top.order[top.idx]
                : top.player;
      if (me !== actor) return { state };

      switch (action.type) {
        case "respond": {
          const use = String(payload.use ?? "");
          if (top.kind === "bang") {
            if (use === "missed") {
              const c = s.hands[me].find((x) => x.id === cardId);
              if (!c || !isMissedCard(s.chars[me], c)) return { state };
              discardCardFromHand(s, me, cardId);
              checkSuzy(s, me, r);
              top.missed++;
              if (top.missed >= top.hits) { s.pending.pop(); s.log = pushLog(s.log, `🛡️ ${nm(s, me)} esquive le BANG! de ${nm(s, top.source)}.`); }
            } else if (use === "barrel" && !top.barrelTried && (hasCard(s, me, "barrel") || s.chars[me] === "jourdonnais")) {
              top.barrelTried = true;
              const c = drawCheck(s, me, (x) => x.suit === "hearts", r);
              if (c.suit === "hearts") {
                top.missed++;
                s.log = pushLog(s.log, `🛢️ Tonneau : ${nm(s, me)} dégaine un ♥ — Manqué !`);
                if (top.missed >= top.hits) { s.pending.pop(); }
              } else {
                s.log = pushLog(s.log, `🛢️ Tonneau : raté (${c.suit}).`);
              }
            } else if (use === "take") {
              s.pending.pop();
              dealDamage(s, me, 1, top.source, r);
            } else return { state };
          } else if (top.kind === "gatling") {
            if (use === "missed") {
              const c = s.hands[me].find((x) => x.id === cardId);
              if (!c || !isMissedCard(s.chars[me], c)) return { state };
              discardCardFromHand(s, me, cardId); checkSuzy(s, me, r);
              top.queue.shift();
            } else if (use === "barrel" && !top.barrelTried && (hasCard(s, me, "barrel") || s.chars[me] === "jourdonnais")) {
              const c = drawCheck(s, me, (x) => x.suit === "hearts", r);
              if (c.suit === "hearts") { top.queue.shift(); s.log = pushLog(s.log, `🛢️ ${nm(s, me)} esquive la Gatling au Tonneau.`); }
              else s.log = pushLog(s.log, `🛢️ Tonneau raté pour ${nm(s, me)}.`);
            } else if (use === "take") {
              top.queue.shift();
              dealDamage(s, me, 1, top.source, r);
            } else return { state };
            if (s.pending[s.pending.length - 1] === top && top.queue.length === 0) s.pending.pop();
          } else if (top.kind === "indians") {
            if (use === "bang") {
              const c = s.hands[me].find((x) => x.id === cardId);
              if (!c || !isBangCard(s.chars[me], c)) return { state };
              discardCardFromHand(s, me, cardId); checkSuzy(s, me, r);
              top.queue.shift();
            } else if (use === "take") {
              top.queue.shift();
              dealDamage(s, me, 1, top.source, r);
            } else return { state };
            if (s.pending[s.pending.length - 1] === top && top.queue.length === 0) s.pending.pop();
          } else if (top.kind === "duel") {
            if (use === "bang") {
              const c = s.hands[me].find((x) => x.id === cardId);
              if (!c || !isBangCard(s.chars[me], c)) return { state };
              discardCardFromHand(s, me, cardId); checkSuzy(s, me, r);
              const o = top.other; top.other = top.current; top.current = o; // au tour de l'autre
            } else if (use === "take") {
              s.pending.pop();
              dealDamage(s, me, 1, top.other, r);
            } else return { state };
          } else if (top.kind === "death_save") {
            if (use === "beer") {
              const c = s.hands[me].find((x) => x.id === cardId);
              if (!c || c.type !== "beer") return { state };
              discardCardFromHand(s, me, cardId); checkSuzy(s, me, r);
              s.hp[me] = Math.min(s.maxHp[me], s.hp[me] + 1);
              s.log = pushLog(s.log, `🍺 ${nm(s, me)} boit une Bière in extremis (+1 PV).`);
              if (s.hp[me] > 0) s.pending.pop();
            } else if (use === "accept") {
              s.pending.pop();
              eliminate(s, me, top.killer, r);
              if (!s.alive[current] && !s.winner) nextTurn(s, r);
            } else return { state };
          }
          break;
        }
        case "pick": {
          if (top.kind !== "general_store") return { state };
          const i = top.cards.findIndex((c) => c.id === cardId);
          if (i < 0) return { state };
          const [card] = top.cards.splice(i, 1);
          s.hands[me].push(card);
          top.idx++;
          s.log = pushLog(s.log, `🏪 ${nm(s, me)} prend une carte au Magasin.`);
          if (top.idx >= top.order.length) {
            s.discard.push(...top.cards); top.cards.length = 0;
            s.pending.pop();
          }
          break;
        }
        default:
          return { state };
      }

      // Après résolution : si plus de pending et le joueur courant est mort, on avance.
      if (s.pending.length === 0 && !s.alive[current] && !s.winner) nextTurn(s, r);
      return { state: s };
    }

    // ─────────── Actions du joueur courant ───────────
    if (me !== current) return { state };

    switch (action.type) {
      case "draw": {
        if (s.phase !== "draw") return { state };
        const ch = s.chars[me];
        if (ch === "kit_carson") {
          ensureDeck(s, r);
          const three: Card[] = [];
          for (let i = 0; i < 3; i++) { ensureDeck(s, r); const c = s.deck.shift(); if (c) three.push(c); }
          s.kitPreview = three;
          s.phase = "draw"; // attend "kitReturn"
          return { state: s };
        }
        if (ch === "jesse_jones" && targetId && s.alive[targetId] && targetId !== me && s.hands[targetId].length) {
          const idx = Math.floor(r() * s.hands[targetId].length);
          const [stolen] = s.hands[targetId].splice(idx, 1);
          s.hands[me].push(stolen);
          checkSuzy(s, targetId, r);
          drawN(s, me, 1, r);
        } else if (ch === "pedro_ramirez" && payload.fromDiscard === true && s.discard.length) {
          s.hands[me].push(s.discard.pop()!);
          drawN(s, me, 1, r);
        } else if (ch === "black_jack") {
          ensureDeck(s, r); const c1 = s.deck.shift(); if (c1) s.hands[me].push(c1);
          ensureDeck(s, r); const c2 = s.deck.shift();
          if (c2) {
            s.hands[me].push(c2);
            s.log = pushLog(s.log, `🃏 Black Jack révèle ${c2.suit === "hearts" ? "♥" : c2.suit === "diamonds" ? "♦" : c2.suit === "clubs" ? "♣" : "♠"}.`);
            if (c2.suit === "hearts" || c2.suit === "diamonds") drawN(s, me, 1, r);
          }
        } else {
          drawN(s, me, 2, r);
        }
        s.phase = "play";
        return { state: s };
      }

      case "kitReturn": {
        if (s.phase !== "draw" || !s.kitPreview) return { state };
        const i = s.kitPreview.findIndex((c) => c.id === cardId);
        if (i < 0) return { state };
        const [back] = s.kitPreview.splice(i, 1);
        s.deck.unshift(back);
        s.hands[me].push(...s.kitPreview);
        s.kitPreview = null;
        s.phase = "play";
        return { state: s };
      }

      case "ability": {
        // Sid Ketchum : défausser 2 cartes pour +1 PV.
        if (s.chars[me] !== "sid_ketchum") return { state };
        const ids = Array.isArray(payload.cardIds) ? (payload.cardIds as string[]) : [];
        if (ids.length !== 2 || s.hp[me] >= s.maxHp[me]) return { state };
        if (!ids.every((cid) => s.hands[me].some((c) => c.id === cid)) || ids[0] === ids[1]) return { state };
        ids.forEach((cid) => discardCardFromHand(s, me, cid));
        s.hp[me] = Math.min(s.maxHp[me], s.hp[me] + 1);
        checkSuzy(s, me, r);
        s.log = pushLog(s.log, `🩹 Sid Ketchum se soigne (+1 PV).`);
        return { state: s };
      }

      case "play": {
        if (s.phase !== "play") return { state };
        const c = s.hands[me].find((x) => x.id === cardId);
        if (!c) return { state };
        const t = c.type;

        // BANG!
        if (t === "bang" || (s.chars[me] === "calamity_janet" && t === "missed" && payload.as === "bang")) {
          const limit = s.bangsThisTurn >= 1 && s.chars[me] !== "willy_kid" && !hasCard(s, me, "volcanic");
          if (limit) return { state };
          if (!targetId || !s.alive[targetId] || targetId === me || !inRange(s, me, targetId)) return { state };
          discardCardFromHand(s, me, cardId); checkSuzy(s, me, r);
          s.bangsThisTurn++;
          const hits = s.chars[me] === "slab" ? 2 : 1;
          s.pending.push({ kind: "bang", target: targetId, source: me, hits, missed: 0, barrelTried: false });
          s.log = pushLog(s.log, `🔫 ${nm(s, me)} tire sur ${nm(s, targetId)} !`);
          return { state: s };
        }

        // Cartes bleues (en jeu)
        if (BLUE.has(t)) {
          if (WEAPONS.has(t)) {
            const old = s.board[me].find((x) => WEAPONS.has(x.type));
            if (old) { s.board[me] = s.board[me].filter((x) => x !== old); s.discard.push(old); }
          } else if (hasCard(s, me, t)) {
            return { state }; // pas deux fois la même carte bleue
          }
          discardCardFromHand(s, me, cardId);
          s.board[me].push(c);
          checkSuzy(s, me, r);
          s.log = pushLog(s.log, `🔵 ${nm(s, me)} met ${t} en jeu.`);
          return { state: s };
        }

        // Jail (sur un autre, pas le Shérif)
        if (t === "jail") {
          if (!targetId || !s.alive[targetId] || s.roles[targetId] === "sheriff" || s.jail[targetId]) return { state };
          discardCardFromHand(s, me, cardId);
          s.jail[targetId] = c;
          checkSuzy(s, me, r);
          s.log = pushLog(s.log, `🔒 ${nm(s, me)} emprisonne ${nm(s, targetId)}.`);
          return { state: s };
        }
        // Dynamite (devant soi)
        if (t === "dynamite") {
          if (s.dynamite) return { state };
          discardCardFromHand(s, me, cardId);
          s.dynamite = { holder: me, card: c };
          checkSuzy(s, me, r);
          s.log = pushLog(s.log, `🧨 ${nm(s, me)} pose la Dynamite.`);
          return { state: s };
        }

        // Soins / pioche
        if (t === "beer") {
          if (aliveList(s).length <= 2 || s.hp[me] >= s.maxHp[me]) {
            if (aliveList(s).length <= 2) return { state };
          }
          discardCardFromHand(s, me, cardId);
          s.hp[me] = Math.min(s.maxHp[me], s.hp[me] + 1);
          checkSuzy(s, me, r);
          s.log = pushLog(s.log, `🍺 ${nm(s, me)} boit une Bière (+1 PV).`);
          return { state: s };
        }
        if (t === "saloon") {
          discardCardFromHand(s, me, cardId);
          for (const p of aliveList(s)) s.hp[p] = Math.min(s.maxHp[p], s.hp[p] + 1);
          checkSuzy(s, me, r);
          s.log = pushLog(s.log, `🍻 ${nm(s, me)} paie une tournée — tout le monde +1 PV.`);
          return { state: s };
        }
        if (t === "stagecoach") { discardCardFromHand(s, me, cardId); drawN(s, me, 2, r); s.log = pushLog(s.log, `🚍 ${nm(s, me)} pioche 2 cartes.`); return { state: s }; }
        if (t === "wells_fargo") { discardCardFromHand(s, me, cardId); drawN(s, me, 3, r); s.log = pushLog(s.log, `🚂 ${nm(s, me)} pioche 3 cartes.`); return { state: s }; }

        // Vol / défausse ciblés
        if (t === "panic") {
          if (!targetId || !s.alive[targetId] || targetId === me || seenDistance(s, me, targetId) > 1) return { state };
          discardCardFromHand(s, me, cardId);
          const boardCard = s.board[targetId].find((x) => x.id === (payload.stealId as string));
          if (boardCard) { s.board[targetId] = s.board[targetId].filter((x) => x !== boardCard); s.hands[me].push(boardCard); }
          else if (s.hands[targetId].length) { const idx = Math.floor(r() * s.hands[targetId].length); const [st] = s.hands[targetId].splice(idx, 1); s.hands[me].push(st); }
          checkSuzy(s, targetId, r);
          s.log = pushLog(s.log, `🫳 ${nm(s, me)} braque une carte à ${nm(s, targetId)}.`);
          return { state: s };
        }
        if (t === "cat_balou") {
          if (!targetId || !s.alive[targetId] || targetId === me) return { state };
          discardCardFromHand(s, me, cardId);
          const boardCard = s.board[targetId].find((x) => x.id === (payload.stealId as string));
          if (boardCard) { s.board[targetId] = s.board[targetId].filter((x) => x !== boardCard); s.discard.push(boardCard); }
          else if (s.hands[targetId].length) { const idx = Math.floor(r() * s.hands[targetId].length); const [st] = s.hands[targetId].splice(idx, 1); s.discard.push(st); }
          else if (s.jail[targetId]) { s.discard.push(s.jail[targetId]!); s.jail[targetId] = null; }
          checkSuzy(s, targetId, r);
          s.log = pushLog(s.log, `💨 ${nm(s, me)} fait défausser une carte à ${nm(s, targetId)}.`);
          return { state: s };
        }

        // Attaques de zone / duel
        if (t === "gatling") {
          discardCardFromHand(s, me, cardId);
          s.pending.push({ kind: "gatling", source: me, queue: aliveList(s).filter((p) => p !== me), barrelTried: false });
          s.log = pushLog(s.log, `🔫 ${nm(s, me)} déclenche la Gatling sur tout le monde !`);
          return { state: s };
        }
        if (t === "indians") {
          discardCardFromHand(s, me, cardId);
          s.pending.push({ kind: "indians", source: me, queue: aliveList(s).filter((p) => p !== me) });
          s.log = pushLog(s.log, `🏹 ${nm(s, me)} appelle les Indiens !`);
          return { state: s };
        }
        if (t === "duel") {
          if (!targetId || !s.alive[targetId] || targetId === me) return { state };
          discardCardFromHand(s, me, cardId);
          s.pending.push({ kind: "duel", current: targetId, other: me });
          s.log = pushLog(s.log, `⚔️ ${nm(s, me)} défie ${nm(s, targetId)} en duel !`);
          return { state: s };
        }
        if (t === "general_store") {
          discardCardFromHand(s, me, cardId);
          const order = aliveList(s);
          const cards: Card[] = [];
          for (let i = 0; i < order.length; i++) { ensureDeck(s, r); const cc = s.deck.shift(); if (cc) cards.push(cc); }
          // commencer par le joueur courant
          const start = order.indexOf(me);
          const ordered = [...order.slice(start), ...order.slice(0, start)];
          s.pending.push({ kind: "general_store", cards, order: ordered, idx: 0 });
          s.log = pushLog(s.log, `🏪 ${nm(s, me)} ouvre le Magasin général.`);
          return { state: s };
        }
        return { state };
      }

      case "endTurn": {
        if (s.phase !== "play") return { state };
        if (s.hands[me].length > handLimit(s, me)) { s.phase = "discard"; return { state: s }; }
        nextTurn(s, r);
        return { state: s };
      }

      case "discard": {
        if (s.phase !== "discard") return { state };
        if (!discardCardFromHand(s, me, cardId)) return { state };
        if (s.hands[me].length <= handLimit(s, me)) nextTurn(s, r);
        return { state: s };
      }

      default:
        return { state };
    }
  },

  viewFor(state, me): PowView {
    const s = state;
    const reveal = s.winner !== null;
    const top = s.pending[s.pending.length - 1];

    const roleVisible = (id: PlayerId): Role | null => {
      if (id === me) return s.roles[id];
      if (s.roles[id] === "sheriff") return "sheriff";
      if (!s.alive[id] || reveal) return s.roles[id];
      return null;
    };

    const toCardView = (c: Card): PowCardView => ({ id: c.id, type: c.type, suit: c.suit, rank: c.rank });

    const players: PowPlayerView[] = s.players.map((id) => ({
      id,
      alive: s.alive[id],
      role: roleVisible(id),
      char: s.chars[id],
      charName: CHARACTERS.find((c) => c.key === s.chars[id])?.name ?? "",
      hp: s.hp[id],
      maxHp: s.maxHp[id],
      handCount: s.hands[id].length,
      board: s.board[id].map(toCardView),
      jailed: !!s.jail[id],
      hasDynamite: s.dynamite?.holder === id,
      isCurrent: id === s.players[s.turn],
      distance: id === me || !s.alive[me] ? null : seenDistance(s, me, id),
      inRange: id !== me && s.alive[id] && s.alive[me] ? inRange(s, me, id) : false,
    }));

    let pending: PowPendingView | null = null;
    if (top) {
      const actor =
        top.kind === "bang" ? top.target
          : top.kind === "gatling" || top.kind === "indians" ? top.queue[0]
            : top.kind === "duel" ? top.current
              : top.kind === "general_store" ? top.order[top.idx]
                : top.player;
      pending = {
        kind: top.kind,
        forMe: actor === me,
        actor,
        source: top.kind === "bang" ? top.source : top.kind === "gatling" || top.kind === "indians" ? top.source : top.kind === "duel" ? top.other : undefined,
        hits: top.kind === "bang" ? top.hits : undefined,
        missed: top.kind === "bang" ? top.missed : undefined,
        storeCards: top.kind === "general_store" ? top.cards.map(toCardView) : undefined,
      };
    }

    return {
      meId: me,
      myRole: s.roles[me],
      myChar: s.chars[me],
      alive: s.alive[me],
      hand: s.hands[me].map(toCardView),
      players,
      phase: s.phase,
      currentId: s.players[s.turn],
      isMyTurn: s.players[s.turn] === me && s.pending.length === 0,
      bangsThisTurn: s.bangsThisTurn,
      weaponRange: weaponRange(s, me),
      deckSize: s.deck.length,
      discardTop: s.discard.length ? toCardView(s.discard[s.discard.length - 1]) : null,
      pending,
      kitPreview: s.players[s.turn] === me && s.kitPreview ? s.kitPreview.map(toCardView) : null,
      handLimit: handLimit(s, me),
      winner: s.winner,
      log: s.log,
    };
  },

  isFinished(state) {
    return state.phase === "finished";
  },

  getResults(state, players) {
    const team = state.winner;
    const won = (id: PlayerId): boolean => {
      const role = state.roles[id];
      if (team === "sheriff") return role === "sheriff" || role === "deputy";
      if (team === "outlaws") return role === "outlaw";
      if (team === "renegade") return role === "renegade";
      return false;
    };
    return players.map((p) => ({ playerId: p.id, score: won(p.id) ? 1 : 0, rank: won(p.id) ? 1 : 2, won: won(p.id) }));
  },
};
