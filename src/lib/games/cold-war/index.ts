import {
  type GameAction,
  type GameDefinition,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Cold War — adaptation de « Secrets ».
//
// Années 60 : chaque joueur est secrètement membre de la CIA, du KGB ou un
// Hippie. À son tour, on pioche 2 personnages différents, on en choisit un en
// secret (« Proposition ») qu'on propose à un autre joueur. Il accepte ou refuse :
// la carte est placée devant l'un ou l'autre, et son effet s'applique. L'agence
// au score total le plus élevé gagne — mais si un seul Hippie a le score
// individuel le plus faible (sans égalité), il rafle la mise.
// ─────────────────────────────────────────────────────────────────────────────

export type Affiliation = "cia" | "kgb" | "hippie";
export type Pos = PlayerId | "__center__";

export type PersonageKind =
  | "psychiatre" | "agent_double" | "politicien" | "journaliste"
  | "diplomate" | "detective" | "scientifique" | "assassin";

export interface PersonageCard { id: string; kind: PersonageKind; value: number }
export interface BallCard { id: string; value: number } // 0, -1, -2, -3
interface PlacedCard {
  id: string;
  origin: "personage" | "ball";
  kind: PersonageKind | null; // null pour Balle
  value: number;
  faceDown: boolean;
}

type Phase = "draw" | "propose" | "respond" | "effect" | "finished";

// Distribution des jetons selon le nombre de joueurs (+ 1 au centre = total).
const ID_SETUP: Record<number, { cia: number; kgb: number; hippie: number }> = {
  4: { cia: 2, kgb: 2, hippie: 1 },
  5: { cia: 2, kgb: 2, hippie: 2 },
  6: { cia: 3, kgb: 3, hippie: 1 },
  7: { cia: 3, kgb: 3, hippie: 2 },
  8: { cia: 4, kgb: 4, hippie: 1 },
};
const END_CARDS: Record<number, number> = { 4: 5, 5: 5, 6: 5, 7: 4, 8: 4 };

const DECK: { kind: PersonageKind; value: number; n: number }[] = [
  { kind: "agent_double", value: 2, n: 3 },
  { kind: "psychiatre", value: -1, n: 2 },
  { kind: "politicien", value: 3, n: 4 },
  { kind: "detective", value: -2, n: 3 },
  { kind: "diplomate", value: 1, n: 3 },
  { kind: "journaliste", value: 3, n: 4 },
  { kind: "scientifique", value: 5, n: 6 },
  { kind: "assassin", value: 0, n: 4 },
];

const BALL_DECK: number[] = [0, -1, -2, -3];

// ───────────────────────────── État ─────────────────────────────

interface Effect {
  kind: PersonageKind;
  holder: PlayerId; // joueur sur qui l'effet s'applique
  step: number;
  data?: { ballId?: string; targets?: PlayerId[]; diplomatLeft?: PlayerId; diplomatRight?: PlayerId };
}

interface State {
  players: PlayerId[];
  names: Record<PlayerId, string>;
  N: number;

  identities: Record<Pos, Affiliation>;
  // Tableau de connaissance par joueur : ce qu'il a vu en dernier sur chaque jeton.
  knowledge: Record<PlayerId, Partial<Record<Pos, Affiliation>>>;

  deck: PersonageCard[];
  discard: PersonageCard[];
  ballDeck: BallCard[];

  placed: Record<PlayerId, PlacedCard[]>;
  /** Pour chaque carte Balle reçue (face cachée), qui sait sa valeur (le donneur). */
  ballKnowers: Record<string, PlayerId>; // ballCardId -> joueur qui sait

  unHolder: PlayerId | null; // null = jeton ONU au centre
  unUsedThisProposition: boolean;

  turn: number; // index du joueur actif
  phase: Phase;

  // Phase draw : cartes révélées par le joueur actif
  revealed: PersonageCard[];
  // Phase propose : main (2 cartes différentes)
  hand: PersonageCard[];

  // Phase respond
  proposition: PersonageCard | null;
  propositionFrom: PlayerId | null;
  propositionTo: PlayerId | null;

  // Phase effect
  effect: Effect | null;

  // Dernière info révélée à un joueur (pour l'UI privée)
  lastPeek: Record<PlayerId, { pos: Pos; identity: Affiliation } | null>;
  lastBallPeek: Record<PlayerId, { ballId: string; value: number } | null>;
  endTrigger: number;
  winner: { teams: Affiliation[]; players: PlayerId[]; reason: string } | null;
  log: string[];
}

// ───────────────────────────── Vues ─────────────────────────────

export interface CWPlacedCardView {
  id: string;
  faceDown: boolean;
  kind: PersonageKind | null;
  value: number | null; // null si face cachée et qu'on ne voit pas
  origin: "personage" | "ball";
}

export interface CWPlayerView {
  id: PlayerId;
  name: string;
  identity: Affiliation | null; // ce que JE sais de son jeton (dernier peek)
  identityRevealed: Affiliation | null; // valeur RÉELLE (en fin de partie)
  isActive: boolean;
  hasUN: boolean;
  cardCount: number;
  cards: CWPlacedCardView[];
  isWinner: boolean;
}

export interface CWView {
  meId: PlayerId;
  myIdentity: Affiliation; // ma vraie identité
  centerIdentity: Affiliation | null; // ce que je sais du centre
  centerRevealed: Affiliation | null; // valeur réelle (fin)
  phase: Phase;
  activeId: PlayerId;
  isMyTurn: boolean;
  unHolderId: PlayerId | null;

  // Phase draw
  revealed: PersonageCard[];
  canDraw: boolean;
  canTakeHand: boolean;

  // Phase propose
  myHand: PersonageCard[] | null;
  canPropose: boolean;

  // Phase respond
  propositionVisible: { card: PersonageCard; from: PlayerId; to: PlayerId } | null;
  canRespond: boolean;
  canIntervene: boolean;

  // Phase effect
  effect: {
    kind: PersonageKind;
    holder: PlayerId;
    step: number;
    iAmHolder: boolean;
  } | null;
  effectChoices: PlayerId[]; // candidats valides selon le contexte

  // Mes peeks récents (info privée à afficher)
  myLastPeek: { pos: Pos; identity: Affiliation } | null;
  myBallValues: { ballId: string; value: number }[]; // valeurs de balles que JE connais

  players: CWPlayerView[];
  endTrigger: number;
  maxCardCount: number;
  winner: State["winner"];
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
function pushLog(log: string[], e: string): string[] { return [e, ...log].slice(0, 60); }
const nm = (s: State, id: PlayerId) => s.names[id] ?? "Joueur";

function draft(s: State): State {
  const cloneRec = <T>(r: Record<PlayerId, T[]>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, [...v]])) as Record<PlayerId, T[]>;
  return {
    ...s,
    identities: { ...s.identities },
    knowledge: Object.fromEntries(Object.entries(s.knowledge).map(([k, v]) => [k, { ...v }])),
    deck: [...s.deck],
    discard: [...s.discard],
    ballDeck: [...s.ballDeck],
    placed: cloneRec(s.placed),
    ballKnowers: { ...s.ballKnowers },
    revealed: [...s.revealed],
    hand: [...s.hand],
    effect: s.effect ? { ...s.effect, data: s.effect.data ? { ...s.effect.data } : undefined } : null,
    lastPeek: { ...s.lastPeek },
    lastBallPeek: { ...s.lastBallPeek },
    winner: s.winner ? { ...s.winner, teams: [...s.winner.teams], players: [...s.winner.players] } : null,
    log: [...s.log],
  };
}

const cardCount = (s: State, id: PlayerId) => s.placed[id].length;
const maxCardCount = (s: State) => Math.max(...s.players.map((p) => cardCount(s, p)));

function recordPeek(s: State, viewer: PlayerId, pos: Pos) {
  const id = s.identities[pos];
  if (!id) return;
  s.knowledge[viewer][pos] = id;
  s.lastPeek[viewer] = { pos, identity: id };
}
function recordReveal(s: State, viewers: PlayerId[], pos: Pos) {
  for (const v of viewers) recordPeek(s, v, pos);
}
function swap(s: State, a: Pos, b: Pos) {
  const ta = s.identities[a], tb = s.identities[b];
  s.identities[a] = tb;
  s.identities[b] = ta;
  // Les "knowledge" deviennent obsolètes : on les remet aux nouvelles valeurs SEULEMENT pour ceux qui voient.
  // Le plus juste : on garde les snapshots, ils sont "périmés" mais c'est ainsi.
}

// ───────────────────────────── Transitions ─────────────────────────────

function startTurn(s: State, idx: number) {
  s.turn = idx;
  s.phase = "draw";
  s.revealed = [];
  s.hand = [];
  s.proposition = null;
  s.propositionFrom = null;
  s.propositionTo = null;
  s.effect = null;
  s.unUsedThisProposition = false;
  s.log = pushLog(s.log, `▶️ Tour de ${nm(s, s.players[idx])}.`);
}

function endTurn(s: State) {
  // Cartes identiques face visible → retournées face cachée (valeur 0).
  for (const p of s.players) {
    const visible = s.placed[p].filter((c) => !c.faceDown && c.origin === "personage");
    const counts: Record<string, number> = {};
    for (const c of visible) counts[c.kind!] = (counts[c.kind!] ?? 0) + 1;
    for (const c of s.placed[p]) {
      if (!c.faceDown && c.origin === "personage" && counts[c.kind!] >= 2) {
        c.faceDown = true;
        c.value = 0;
      }
    }
  }

  // Fin de partie ?
  const trigger = s.endTrigger;
  if (s.players.some((p) => cardCount(s, p) >= trigger)) {
    finishGame(s);
    return;
  }

  // ONU : prend le joueur strict min ; sinon → centre.
  const counts = s.players.map((p) => ({ id: p, n: cardCount(s, p) }));
  const min = Math.min(...counts.map((c) => c.n));
  const mins = counts.filter((c) => c.n === min);
  if (mins.length === 1) {
    if (s.unHolder !== mins[0].id) {
      s.unHolder = mins[0].id;
      s.log = pushLog(s.log, `🕊️ ${nm(s, mins[0].id)} prend le jeton ONU.`);
    }
  } else if (s.unHolder !== null) {
    s.unHolder = null;
    s.log = pushLog(s.log, `🕊️ Le jeton ONU retourne au centre.`);
  }

  startTurn(s, (s.turn + 1) % s.N);
}

function finishGame(s: State) {
  s.phase = "finished";
  const scores: Record<PlayerId, number> = {};
  for (const p of s.players) scores[p] = s.placed[p].reduce((a, c) => a + c.value, 0);

  // Vérification Hippie : le score le plus faible (strict) appartient à un Hippie ?
  const minScore = Math.min(...s.players.map((p) => scores[p]));
  const mins = s.players.filter((p) => scores[p] === minScore);
  if (mins.length === 1 && s.identities[mins[0]] === "hippie") {
    s.winner = { teams: ["hippie"], players: [mins[0]], reason: `${nm(s, mins[0])} (Hippie) a le score individuel le plus faible.` };
    s.log = pushLog(s.log, `🏁 ${nm(s, mins[0])} (Hippie) gagne seul·e !`);
    return;
  }
  // Sinon agences
  const cia = s.players.filter((p) => s.identities[p] === "cia").reduce((a, p) => a + scores[p], 0);
  const kgb = s.players.filter((p) => s.identities[p] === "kgb").reduce((a, p) => a + scores[p], 0);
  if (cia === kgb) {
    s.winner = { teams: [], players: [], reason: `Égalité CIA/KGB (${cia}-${kgb}) — tout le monde a perdu.` };
    s.log = pushLog(s.log, `🏁 Égalité entre agences : tout le monde perd.`);
  } else {
    const winTeam: Affiliation = cia > kgb ? "cia" : "kgb";
    const winners = s.players.filter((p) => s.identities[p] === winTeam);
    s.winner = { teams: [winTeam], players: winners, reason: `${winTeam.toUpperCase()} ${Math.max(cia, kgb)} vs ${Math.min(cia, kgb)}.` };
    s.log = pushLog(s.log, `🏁 ${winTeam.toUpperCase()} l'emporte (${Math.max(cia, kgb)}-${Math.min(cia, kgb)}) !`);
  }
}

function placeCard(s: State, who: PlayerId, card: PersonageCard) {
  s.placed[who].push({ id: card.id, origin: "personage", kind: card.kind, value: card.value, faceDown: false });
}

function startEffect(s: State, holder: PlayerId, card: PersonageCard) {
  s.effect = { kind: card.kind, holder, step: 0 };

  // Auto-effets simples
  switch (card.kind) {
    case "agent_double": {
      swap(s, holder, "__center__");
      recordPeek(s, holder, holder); // après le swap, sa nouvelle position contient son ancien centre
      s.log = pushLog(s.log, `🕴️ ${nm(s, holder)} (Agent Double) échange son jeton avec le centre et le regarde.`);
      s.effect = null;
      return;
    }
    case "journaliste": {
      // Révèle au monde sauf au holder
      const viewers = s.players.filter((p) => p !== holder);
      recordReveal(s, viewers, holder);
      s.log = pushLog(s.log, `📰 ${nm(s, holder)} (Journaliste) révèle son jeton à tous les autres.`);
      s.effect = null;
      return;
    }
    case "scientifique": {
      const scientists = s.placed[holder].filter((c) => c.kind === "scientifique" && c.origin === "personage");
      if (scientists.length >= 2) {
        // Retourne TOUTES les cartes Personnage face cachée, y compris les Scientifiques.
        for (const c of s.placed[holder]) {
          if (c.origin === "personage") { c.faceDown = true; c.value = 0; }
        }
        s.log = pushLog(s.log, `🔬 ${nm(s, holder)} (2e Scientifique) — toutes ses cartes passent à 0.`);
      } else {
        s.log = pushLog(s.log, `🔬 ${nm(s, holder)} pose un Scientifique (sans effet immédiat).`);
      }
      s.effect = null;
      return;
    }
  }
  // Sinon, l'effet attend une ou plusieurs actions interactives.
}

// ───────────────────────────── Définition ─────────────────────────────

export const coldWar: GameDefinition<State, CWView> = {
  id: "cold-war",
  name: "Cold War",
  tagline: "Années 60, jetons secrets, vrais mensonges.",
  description:
    "Adaptation de Secrets (4–8 joueurs). Tu es secrètement de la CIA, du KGB ou un Hippie. À ton tour, propose un personnage à un autre joueur : il accepte ou refuse. Les effets s'enchaînent (regards de jetons, échanges, balles…). L'agence au score le plus élevé gagne — sauf si un Hippie a le score individuel le plus faible.",
  emoji: "🕶️",
  accent: "ink",
  minPlayers: 4,
  maxPlayers: 8,
  estimatedMinutes: 35,
  tags: ["Bluff", "Rôles cachés", "Soirée"],
  rules: [
    "Chaque joueur reçoit un jeton secret : CIA, KGB ou Hippie. Un jeton est placé au centre.",
    "À 4 joueurs tu vois ton jeton ; à 5+ joueurs tu vois aussi celui de ton voisin de droite.",
    "À ton tour : pioche 2 personnages différents, choisis-en un en secret (la Proposition) et propose-le à un autre joueur.",
    "Le joueur cible accepte (carte placée devant lui) ou refuse (carte placée devant toi). L'effet s'applique au porteur.",
    "Effets : Agent Double / Politicien / Diplomate / Détective / Journaliste / Psychiatre / Scientifique / Assassin (cf. icônes).",
    "Le jeton ONU va au joueur qui a strictement le moins de cartes. Son porteur peut intercepter une Proposition.",
    "Fin : 4–6 joueurs = 5 cartes devant un joueur, 7–8 = 4. L'agence au score le plus élevé gagne, sauf si un seul Hippie a le score min.",
  ],

  createInitialState(ctx) {
    const ids = ctx.players.map((p) => p.id);
    const N = ids.length;
    const setup = ID_SETUP[N] ?? ID_SETUP[8];
    const names: Record<PlayerId, string> = {};
    const placed: Record<PlayerId, PlacedCard[]> = {};
    const knowledge: Record<PlayerId, Partial<Record<Pos, Affiliation>>> = {};
    const lastPeek: Record<PlayerId, { pos: Pos; identity: Affiliation } | null> = {};
    const lastBallPeek: Record<PlayerId, { ballId: string; value: number } | null> = {};
    for (const p of ctx.players) {
      names[p.id] = p.name;
      placed[p.id] = [];
      knowledge[p.id] = {};
      lastPeek[p.id] = null;
      lastBallPeek[p.id] = null;
    }

    // Jetons : mélange et distribution
    const pool: Affiliation[] = [
      ...Array<Affiliation>(setup.cia).fill("cia"),
      ...Array<Affiliation>(setup.kgb).fill("kgb"),
      ...Array<Affiliation>(setup.hippie).fill("hippie"),
    ];
    const shuffledPool = shuffle(pool, ctx.random);
    const identities: Record<Pos, Affiliation> = { __center__: shuffledPool[N] };
    for (let i = 0; i < N; i++) identities[ids[i]] = shuffledPool[i];

    // Information initiale
    for (let i = 0; i < N; i++) {
      const me = ids[i];
      knowledge[me][me] = identities[me];
      lastPeek[me] = { pos: me, identity: identities[me] };
      if (N >= 5 && N <= 8) {
        // À 5-8j : voir aussi voisin de droite (suivant dans l'ordre).
        const right = ids[(i + 1) % N];
        knowledge[me][right] = identities[right];
      }
    }

    // Pioche personnages
    let cid = 1;
    const raw: PersonageCard[] = [];
    for (const { kind, value, n } of DECK) for (let i = 0; i < n; i++) raw.push({ id: `c${cid++}`, kind, value });
    const deck = shuffle(raw, ctx.random);

    // Pioche balles
    const ballDeck: BallCard[] = shuffle(BALL_DECK, ctx.random).map((v, i) => ({ id: `b${i + 1}`, value: v }));

    // Premier joueur (au hasard, faute du "plus jeune")
    const start = Math.floor(ctx.random() * N);
    const s: State = {
      players: ids, names, N,
      identities, knowledge,
      deck, discard: [], ballDeck,
      placed, ballKnowers: {},
      unHolder: null, unUsedThisProposition: false,
      turn: start, phase: "draw",
      revealed: [], hand: [],
      proposition: null, propositionFrom: null, propositionTo: null,
      effect: null,
      lastPeek, lastBallPeek,
      endTrigger: END_CARDS[N] ?? 5,
      winner: null,
      log: [`Cold War : ${names[ids[start]]} ouvre les hostilités !`],
    };
    return s;
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    if (state.phase === "finished") return { state };
    if (action.type === "start") return { state };

    const s = draft(state);
    const me = ctx.playerId;
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const activeId = s.players[s.turn];

    // ─────── Intervention ONU (priorité) ───────
    if (action.type === "intervene") {
      if (s.phase !== "respond") return { state };
      if (s.unHolder !== me || me === activeId || s.unUsedThisProposition) return { state };
      // Le porteur ONU se substitue au joueur ciblé.
      s.propositionTo = me;
      s.unHolder = null; // jeton ONU défaussé (au centre)
      s.unUsedThisProposition = true;
      s.log = pushLog(s.log, `🕊️ ${nm(s, me)} dégaine l'ONU et s'interpose !`);
      // Force "accepter" : la carte est placée devant lui et l'effet lui est appliqué.
      const card = s.proposition!;
      placeCard(s, me, card);
      s.proposition = null;
      s.propositionFrom = null;
      s.propositionTo = null;
      startEffect(s, me, card);
      if (s.effect === null) {
        // Auto-résolu : fin de tour direct
        endTurn(s);
      } else {
        s.phase = "effect";
      }
      return { state: s };
    }

    // ─────── Actions du joueur actif (draw / propose) ───────
    if (me === activeId) {
      switch (action.type) {
        case "draw": {
          if (s.phase !== "draw") return { state };
          if (s.deck.length === 0) {
            if (s.discard.length === 0) return { state };
            s.deck = shuffle(s.discard, ctx.random);
            s.discard = [];
          }
          const c = s.deck.shift()!;
          // Si déjà un personnage identique dans `revealed`, remettre sous la pioche et repiocher.
          if (s.revealed.some((r) => r.kind === c.kind)) {
            s.deck.push(c);
          } else {
            s.revealed.push(c);
          }
          if (s.revealed.length >= 2) {
            s.hand = [...s.revealed];
            // On NE vide PAS `revealed` : les 2 cartes piochées restent publiques
            // pendant la phase `propose` (tout le monde connaît les options).
            s.phase = "propose";
            s.log = pushLog(
              s.log,
              `🃏 ${nm(s, me)} a pioché ${s.revealed.map((c) => `${c.kind} (${c.value > 0 ? "+" : ""}${c.value})`).join(" et ")}.`,
            );
          }
          return { state: s };
        }
        case "propose": {
          if (s.phase !== "propose") return { state };
          const cardId = String(payload.cardId);
          const targetId = String(payload.targetId);
          const card = s.hand.find((c) => c.id === cardId);
          if (!card || !s.players.includes(targetId) || targetId === me) return { state };
          // L'autre carte est remise sous la pioche.
          const other = s.hand.find((c) => c.id !== cardId)!;
          s.deck.push(other);
          s.hand = [];
          s.revealed = []; // les cartes piochées ne sont plus affichées publiquement
          s.proposition = card;
          s.propositionFrom = me;
          s.propositionTo = targetId;
          s.unUsedThisProposition = false;
          s.phase = "respond";
          s.log = pushLog(s.log, `🤝 ${nm(s, me)} propose une carte à ${nm(s, targetId)}…`);
          return { state: s };
        }
      }
    }

    // ─────── Réponse du ciblé (accept / refuse) ───────
    if (action.type === "respond") {
      if (s.phase !== "respond" || me !== s.propositionTo) return { state };
      const accept = payload.accept === true;
      const card = s.proposition!;
      const holder = accept ? me : s.propositionFrom!;
      placeCard(s, holder, card);
      s.log = pushLog(
        s.log,
        accept
          ? `✅ ${nm(s, me)} accepte la carte (chez lui).`
          : `🚫 ${nm(s, me)} refuse — la carte reste chez ${nm(s, holder)}.`,
      );
      s.proposition = null;
      s.propositionFrom = null;
      s.propositionTo = null;
      startEffect(s, holder, card);
      if (s.effect === null) endTurn(s);
      else s.phase = "effect";
      return { state: s };
    }

    // ─────── Phase effect : actions selon le type ───────
    if (action.type === "effectAction") {
      if (s.phase !== "effect" || !s.effect) return { state };
      const eff = s.effect;
      if (me !== eff.holder) return { state };

      const target1 = typeof payload.targetId === "string" ? payload.targetId : null;
      const positionId = typeof payload.position === "string" ? payload.position : null; // PlayerId | "__center__"
      const choice = typeof payload.choice === "string" ? payload.choice : null;

      switch (eff.kind) {
        case "psychiatre": {
          // Étape : sélectionner 2 AUTRES joueurs (différents du holder et entre eux).
          if (!target1) return { state };
          eff.data = eff.data ?? { targets: [] };
          const targets = eff.data.targets ?? [];
          if (target1 === eff.holder || targets.includes(target1)) return { state };
          targets.push(target1);
          eff.data.targets = targets;
          if (targets.length === 2) {
            swap(s, targets[0], targets[1]);
            s.log = pushLog(s.log, `🧠 ${nm(s, eff.holder)} échange les jetons de ${nm(s, targets[0])} et ${nm(s, targets[1])}.`);
            s.effect = null;
            endTurn(s);
          }
          return { state: s };
        }
        case "politicien": {
          if (!target1 || target1 === eff.holder) return { state };
          // Déplace la carte (déjà posée devant le holder) → devant la cible
          const idx = s.placed[eff.holder].findIndex((c) => c.kind === "politicien" && !c.faceDown);
          if (idx >= 0) {
            const [moved] = s.placed[eff.holder].splice(idx, 1);
            s.placed[target1].push(moved);
          }
          recordPeek(s, eff.holder, target1);
          s.log = pushLog(s.log, `🗣️ ${nm(s, eff.holder)} (Politicien) pose la carte devant ${nm(s, target1)} et regarde son jeton.`);
          s.effect = null;
          endTurn(s);
          return { state: s };
        }
        case "detective": {
          if (!positionId) return { state };
          // Vérifie la position : self, autre joueur, ou centre.
          if (positionId !== "__center__" && !s.players.includes(positionId)) return { state };
          recordPeek(s, eff.holder, positionId as Pos);
          s.log = pushLog(s.log, `🔍 ${nm(s, eff.holder)} (Détective) regarde un jeton.`);
          s.effect = null;
          endTurn(s);
          return { state: s };
        }
        case "diplomate": {
          // Étape 1 : révéler son jeton au centre (à tous)
          if (eff.step === 0) {
            recordReveal(s, s.players, eff.holder);
            s.log = pushLog(s.log, `🎩 ${nm(s, eff.holder)} (Diplomate) révèle son jeton à tous.`);
            eff.step = 1;
            return { state: s };
          }
          // Étape 2 : choisir voisin gauche ou droite pour swap
          if (eff.step === 1) {
            if (choice !== "left" && choice !== "right") return { state };
            const i = s.players.indexOf(eff.holder);
            const neighbor = choice === "right" ? s.players[(i + 1) % s.N] : s.players[(i - 1 + s.N) % s.N];
            swap(s, eff.holder, neighbor);
            s.log = pushLog(s.log, `🎩 ${nm(s, eff.holder)} échange son jeton avec son voisin de ${choice === "right" ? "droite" : "gauche"}.`);
            s.effect = null;
            endTurn(s);
            return { state: s };
          }
          return { state };
        }
        case "assassin": {
          // Étape 0 : pioche une carte balle, le holder la regarde
          if (eff.step === 0) {
            if (s.ballDeck.length === 0) {
              s.log = pushLog(s.log, `🔫 Plus de carte Balle — l'effet n'a aucune cible.`);
              s.effect = null;
              endTurn(s);
              return { state: s };
            }
            const ball = s.ballDeck.shift()!;
            eff.data = { ballId: ball.id };
            s.lastBallPeek[eff.holder] = { ballId: ball.id, value: ball.value };
            // On stocke temporairement la balle dans ballKnowers en attendant la cible
            // Note : on remet la balle dans ballDeck pour ne pas la perdre, on la sortira au step 1.
            s.ballDeck.unshift(ball);
            eff.step = 1;
            s.log = pushLog(s.log, `🔫 ${nm(s, eff.holder)} (Assassin) pioche une carte Balle et la regarde.`);
            return { state: s };
          }
          // Étape 1 : donne la balle face cachée à un autre joueur
          if (eff.step === 1 && target1 && target1 !== eff.holder) {
            const ball = s.ballDeck.shift()!;
            s.placed[target1].push({
              id: ball.id, origin: "ball", kind: null, value: ball.value, faceDown: true,
            });
            s.ballKnowers[ball.id] = eff.holder;
            s.log = pushLog(s.log, `🔫 ${nm(s, eff.holder)} glisse une Balle face cachée à ${nm(s, target1)}.`);
            s.effect = null;
            endTurn(s);
            return { state: s };
          }
          return { state };
        }
      }
    }
    return { state };
  },

  viewFor(state, me): CWView {
    const s = state;
    const finished = s.phase === "finished";
    const activeId = s.players[s.turn];

    const myKnow = s.knowledge[me] ?? {};
    const identityFor = (pos: Pos): Affiliation | null => myKnow[pos] ?? null;

    const myCardsCount = s.placed[me]?.length ?? 0;
    void myCardsCount;

    const players: CWPlayerView[] = s.players.map((id) => ({
      id,
      name: nm(s, id),
      identity: identityFor(id),
      identityRevealed: finished ? s.identities[id] : null,
      isActive: id === activeId && !finished,
      hasUN: s.unHolder === id,
      cardCount: cardCount(s, id),
      cards: s.placed[id].map((c) => ({
        id: c.id,
        faceDown: c.faceDown,
        kind: c.kind,
        // Face cachée : valeur visible UNIQUEMENT à toi pour les balles que tu connais, sinon null.
        value: c.faceDown
          ? c.origin === "ball" && s.ballKnowers[c.id] === me
            ? c.value
            : finished
              ? c.value
              : null
          : c.value,
        origin: c.origin,
      })),
      isWinner: !!s.winner?.players.includes(id),
    }));

    const isActive = me === activeId;
    const eff = s.effect;
    const effectChoices: PlayerId[] = (() => {
      if (!eff || eff.holder !== me) return [];
      if (eff.kind === "psychiatre") {
        const taken = eff.data?.targets ?? [];
        return s.players.filter((p) => p !== eff.holder && !taken.includes(p));
      }
      if (eff.kind === "politicien") return s.players.filter((p) => p !== eff.holder);
      if (eff.kind === "assassin" && eff.step === 1) return s.players.filter((p) => p !== eff.holder);
      return [];
    })();

    return {
      meId: me,
      myIdentity: s.identities[me],
      centerIdentity: identityFor("__center__"),
      centerRevealed: finished ? s.identities["__center__"] : null,
      phase: s.phase,
      activeId,
      isMyTurn: isActive,
      unHolderId: s.unHolder,
      revealed: s.revealed,
      canDraw: isActive && s.phase === "draw",
      canTakeHand: false,
      myHand: isActive && s.phase === "propose" ? s.hand : null,
      canPropose: isActive && s.phase === "propose",
      propositionVisible:
        s.phase === "respond" && s.proposition && s.propositionFrom && s.propositionTo
          ? { card: s.proposition, from: s.propositionFrom, to: s.propositionTo }
          : null,
      canRespond: s.phase === "respond" && me === s.propositionTo,
      canIntervene:
        s.phase === "respond" && s.unHolder === me && me !== activeId && me !== s.propositionTo && !s.unUsedThisProposition,
      effect: eff
        ? { kind: eff.kind, holder: eff.holder, step: eff.step, iAmHolder: eff.holder === me }
        : null,
      effectChoices,
      myLastPeek: s.lastPeek[me],
      myBallValues: Object.entries(s.ballKnowers)
        .filter(([, knower]) => knower === me)
        .map(([ballId]) => {
          // Cherche la valeur dans n'importe quelle pile.
          for (const p of s.players) {
            const c = s.placed[p].find((x) => x.id === ballId);
            if (c) return { ballId, value: c.value };
          }
          return { ballId, value: 0 };
        }),
      players,
      endTrigger: s.endTrigger,
      maxCardCount: maxCardCount(s),
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
