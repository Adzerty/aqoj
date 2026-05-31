import {
  type GameAction,
  type GameDefinition,
  type GamePlayer,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Seulement Un — réimplémentation coopérative de « Just One ».
//
// À chaque manche, un joueur actif doit deviner un mot mystère qu'il ne voit pas.
// Tous les autres écrivent secrètement UN indice (un seul mot). Les indices
// identiques (doublons / variantes) sont éliminés automatiquement avant que le
// devineur ne découvre ceux qui restent. Il a droit à une seule tentative.
// Jeu 100 % coopératif : on vise le meilleur score collectif sur la pioche.
// ─────────────────────────────────────────────────────────────────────────────

type Phase = "write" | "guess" | "reveal" | "finished";
type Outcome = "correct" | "wrong" | "pass" | "no-clues";

const DECK_SIZE = 13;

const WORDS = [
  "SOLEIL", "PIZZA", "DRAGON", "VAMPIRE", "GUITARE", "PLAGE", "ROBOT", "FANTÔME",
  "CHOCOLAT", "MONTAGNE", "TÉLÉPHONE", "PIRATE", "CHÂTEAU", "LICORNE", "CINÉMA",
  "FOOTBALL", "TORNADE", "SIRÈNE", "VOLCAN", "DÉSERT", "BOUSSOLE", "AQUARIUM",
  "CARNAVAL", "SORCIER", "TAMBOUR", "TRÉSOR", "MÉDUSE", "PYRAMIDE", "SANDWICH",
  "HÉLICOPTÈRE", "CACTUS", "IGLOO", "KANGOUROU", "LASAGNE", "MARIONNETTE",
  "NAUFRAGE", "ORIGAMI", "PARACHUTE", "QUILLE", "RADEAU", "SAXOPHONE", "TOBOGGAN",
  "UNIFORME", "VINYLE", "WAGON", "XYLOPHONE", "YOGA", "ZÈBRE", "AIMANT",
  "BÛCHERON", "CITROUILLE", "DIAMANT", "ÉCHARPE", "FLAMANT", "GIROUETTE", "HIBOU",
  "ICEBERG", "JONGLEUR", "KOALA", "LANTERNE", "MOULIN", "NUAGE", "OURS",
  "PAPILLON", "QUARTZ", "RENARD", "SPAGHETTI", "TRAMPOLINE", "USINE", "VÉLO",
  "WESTERN", "YAOURT", "ZEPPELIN", "ASTRONAUTE", "BOOMERANG", "CAMÉLÉON",
  "DAUPHIN", "ESCALIER", "FONTAINE",
];

// ───────────────────────────── État & vues ─────────────────────────────

interface ClueView {
  playerId: PlayerId;
  word: string;
  eliminated: boolean;
}

interface RoundResult {
  mysteryWord: string;
  guess: string | null;
  outcome: Outcome;
  activePlayerId: PlayerId;
  clues: ClueView[];
}

interface State {
  deck: string[];
  pointer: number; // index de la carte courante dans deck
  order: PlayerId[]; // ordre des joueurs (rotation du joueur actif)
  activeIndex: number; // index dans `order` du joueur actif courant
  phase: Phase;
  clues: Record<PlayerId, string>; // indices bruts soumis cette manche
  unique: ClueView[] | null; // indices après élimination des doublons
  score: number;
  roundNumber: number;
  deadline: number;
  lastResult: RoundResult | null;
}

export interface SeulementUnView {
  phase: Phase;
  roundNumber: number;
  totalRounds: number;
  cardsLeft: number;
  score: number;
  deadline: number;
  activePlayerId: PlayerId;
  amActive: boolean;
  mysteryWord: string | null; // masqué pour le joueur actif tant qu'il devine
  myClue: string | null;
  submittedPlayerIds: PlayerId[];
  writersCount: number;
  clues: ClueView[] | null; // visibles en phase guess/reveal
  lastResult: RoundResult | null;
  /** En phase reveal : si vrai, c'est à MOI de lancer la manche suivante. */
  canContinue: boolean;
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

/** Normalise un mot pour comparer indices/réponses : minuscules, sans accents ni
 *  ponctuation, et pluriel simple ignoré. Sert à détecter doublons et bonnes
 *  réponses (accepte la casse, les accents, le pluriel et l'homographie proche). */
function normalize(w: string): string {
  let n = w
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // retire les accents
    .replace(/[^a-z0-9]/g, "");
  if (n.length > 3 && n.endsWith("s")) n = n.slice(0, -1); // pluriel simple
  return n;
}

const activeIdOf = (s: State): PlayerId => s.order[s.activeIndex % s.order.length];

function computeUnique(s: State, mysteryWord: string, players: GamePlayer[]): ClueView[] {
  const activeId = activeIdOf(s);
  const mNorm = normalize(mysteryWord);
  const entries = players
    .filter((p) => p.id !== activeId)
    .map((p) => ({ playerId: p.id, word: (s.clues[p.id] ?? "").trim() }))
    .filter((e) => e.word.length > 0)
    .map((e) => ({ ...e, norm: normalize(e.word) }));

  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.norm] = (counts[e.norm] ?? 0) + 1;

  return entries.map((e) => ({
    playerId: e.playerId,
    word: e.word,
    // Éliminé si doublon, vide, ou égal au mot mystère (indice interdit).
    eliminated: counts[e.norm] > 1 || e.norm.length === 0 || e.norm === mNorm,
  }));
}

// ───────────────────────────── Transitions ─────────────────────────────

/** Fin de la phase d'écriture : calcule les indices uniques puis enchaîne. */
function endWrite(s: State, players: GamePlayer[]): ReducerResult<State> {
  const mystery = s.deck[s.pointer];
  const unique = computeUnique(s, mystery, players);
  const survivors = unique.filter((c) => !c.eliminated);

  if (survivors.length === 0) {
    // Tous les indices éliminés → carte perdue, on passe directement.
    return resolveRound(s, {
      outcome: "no-clues",
      guess: null,
      unique,
    });
  }

  return {
    state: { ...s, phase: "guess", unique, deadline: 0 },
  };
}

/** Applique le résultat d'une manche (score + cartes brûlées) et passe en reveal. */
function resolveRound(
  s: State,
  opts: { outcome: Outcome; guess: string | null; unique: ClueView[] },
): ReducerResult<State> {
  const mystery = s.deck[s.pointer];
  let score = s.score;
  let pointer = s.pointer + 1; // la carte jouée quitte la pioche

  if (opts.outcome === "wrong") {
    // On perd une carte de plus : la suivante de la pioche, ou (dernière manche)
    // une carte précédemment réussie.
    if (pointer < s.deck.length) pointer += 1;
    else score = Math.max(0, score - 1);
  } else if (opts.outcome === "correct") {
    score += 1;
  }

  const lastResult: RoundResult = {
    mysteryWord: mystery,
    guess: opts.guess,
    outcome: opts.outcome,
    activePlayerId: activeIdOf(s),
    clues: opts.unique,
  };

  return {
    state: {
      ...s,
      score,
      pointer,
      activeIndex: s.activeIndex + 1, // le joueur à gauche devient actif
      phase: "reveal",
      unique: opts.unique,
      lastResult,
      deadline: 0,
    },
  };
}

/** Démarre explicitement la manche suivante (déclenché par un joueur). */
function nextRound(s: State): ReducerResult<State> {
  if (s.pointer >= s.deck.length) {
    return { state: { ...s, phase: "finished" } };
  }
  return {
    state: {
      ...s,
      phase: "write",
      clues: {},
      unique: null,
      roundNumber: s.roundNumber + 1,
      deadline: 0,
    },
  };
}

// ───────────────────────────── Définition ─────────────────────────────

export const seulementUn: GameDefinition<State, SeulementUnView> = {
  id: "seulement-un",
  name: "Seulement Un",
  tagline: "Un seul mot pour aider… sans dire la même chose !",
  description:
    "Jeu coopératif : faites deviner un maximum de mots. Chacun écrit un indice d'un seul mot, mais les indices identiques s'annulent. Soyez malins et originaux pour battre votre meilleur score collectif !",
  emoji: "💡",
  accent: "honey",
  minPlayers: 3,
  maxPlayers: 7,
  estimatedMinutes: 12,
  tags: ["Coopératif", "Mots", "Ambiance"],
  rules: [
    "Jeu coopératif : faites deviner un maximum de mots, ensemble.",
    "Un joueur actif ne voit pas le mot mystère ; les autres voient le mot.",
    "Chaque joueur écrit en secret UN seul mot d'indice.",
    "Les indices identiques (ou variantes) s'annulent — soyez originaux !",
    "Le joueur actif découvre les indices restants et tente UNE réponse.",
    "Bonne réponse = +1. Sur 13 cartes, visez le meilleur score collectif.",
  ],

  createInitialState(ctx) {
    const deck = shuffle(WORDS, ctx.random).slice(0, DECK_SIZE);
    // L'ordre des joueurs (et donc la rotation du devineur) suit l'ordre de la
    // table, fixé par le maître de table. Le 1er de la table commence.
    const order = ctx.players.map((p) => p.id);
    return {
      deck,
      pointer: 0,
      order,
      activeIndex: 0,
      phase: "write",
      clues: {},
      unique: null,
      score: 0,
      roundNumber: 1,
      deadline: 0,
      lastResult: null,
    };
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    if (state.phase === "finished") return { state };
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const activeId = activeIdOf(state);

    switch (action.type) {
      case "start":
        return { state };

      case "clue": {
        if (state.phase !== "write") return { state };
        if (ctx.playerId === activeId) return { state }; // le devineur n'écrit pas
        const word = String(payload.word ?? "").trim().slice(0, 32);
        if (!word || /\s/.test(word)) return { state }; // un seul mot

        const clues = { ...state.clues, [ctx.playerId]: word };
        const next = { ...state, clues };

        // Tous les non-actifs ont écrit → on enchaîne la phase suivante.
        const writers = ctx.players.filter((p) => p.id !== activeId);
        const allWritten = writers.every((p) => (clues[p.id] ?? "").trim().length > 0);
        if (allWritten) return endWrite(next, ctx.players);

        return { state: next };
      }

      case "guess": {
        if (state.phase !== "guess") return { state };
        if (ctx.playerId !== activeId) return { state };
        const guess = String(payload.word ?? "").trim();
        if (!guess) return { state };
        const correct = normalize(guess) === normalize(state.deck[state.pointer]);
        return resolveRound(state, {
          outcome: correct ? "correct" : "wrong",
          guess,
          unique: state.unique ?? [],
        });
      }

      case "pass": {
        if (state.phase !== "guess") return { state };
        if (ctx.playerId !== activeId) return { state };
        return resolveRound(state, {
          outcome: "pass",
          guess: null,
          unique: state.unique ?? [],
        });
      }

      case "nextRound": {
        // Passe explicitement à la manche suivante (déclenché par le futur
        // devineur). Plus aucun timer ne le fait automatiquement.
        if (state.phase !== "reveal") return { state };
        return nextRound(state);
      }

      default:
        return { state };
    }
  },

  viewFor(state, playerId, players): SeulementUnView {
    const activeId = activeIdOf(state);
    const amActive = playerId === activeId;
    const inWriteOrGuess = state.phase === "write" || state.phase === "guess";
    const writers = players.filter((p) => p.id !== activeId);

    // Mot mystère : caché au devineur tant qu'il n'a pas conclu la manche.
    const mysteryWord = inWriteOrGuess && amActive ? null : state.deck[state.pointer] ?? null;

    // Indices visibles. En phase guess, le devineur ne voit que les survivants
    // (les éliminés sont masqués) ; les autres voient la comparaison complète.
    let clues: ClueView[] | null = null;
    if (state.unique && (state.phase === "guess" || state.phase === "reveal")) {
      if (amActive && state.phase === "guess") {
        clues = state.unique
          .filter((c) => !c.eliminated)
          .map((c) => ({ ...c }));
      } else {
        clues = state.unique.map((c) => ({ ...c }));
      }
    }

    return {
      phase: state.phase,
      roundNumber: state.roundNumber,
      totalRounds: DECK_SIZE,
      cardsLeft: Math.max(0, state.deck.length - state.pointer),
      score: state.score,
      deadline: state.deadline,
      activePlayerId: activeId,
      amActive,
      mysteryWord,
      myClue: state.clues[playerId] ?? null,
      submittedPlayerIds: writers.filter((p) => (state.clues[p.id] ?? "").trim()).map((p) => p.id),
      writersCount: writers.length,
      clues,
      lastResult: state.phase === "reveal" || state.phase === "finished" ? state.lastResult : null,
      // Le futur devineur (déjà calculé via activeIndex) déclenche la manche suivante.
      canContinue: state.phase === "reveal" && playerId === activeId,
    };
  },

  isFinished(state) {
    return state.phase === "finished";
  },

  getResults(state, players) {
    // Coopératif : tout le monde partage le score. « Gagné » si bonne perf (≥ 11).
    const won = state.score >= 11;
    return players.map((p) => ({ playerId: p.id, score: state.score, rank: 1, won }));
  },
};
