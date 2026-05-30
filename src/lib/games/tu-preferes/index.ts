import {
  type GameAction,
  type GameDefinition,
  type GamePlayer,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
  rankByScore,
} from "../types";

// ───────────────────────────── Données du jeu ─────────────────────────────

interface Dilemma {
  a: string;
  b: string;
}

const POOL: Dilemma[] = [
  { a: "Avoir le pouvoir de voler", b: "Être invisible à volonté" },
  { a: "Ne plus jamais manger de fromage", b: "Ne plus jamais manger de chocolat" },
  { a: "Vivre sans musique", b: "Vivre sans films & séries" },
  { a: "Savoir quand tu vas mourir", b: "Savoir comment tu vas mourir" },
  { a: "Être toujours en retard", b: "Être toujours 20 min en avance" },
  { a: "Lire dans les pensées", b: "Voir le futur 1 jour à l'avance" },
  { a: "Avoir 1 000 000 € maintenant", b: "10 000 € par mois à vie" },
  { a: "Ne plus jamais avoir froid", b: "Ne plus jamais avoir chaud" },
  { a: "Parler toutes les langues", b: "Parler à tous les animaux" },
  { a: "Vivre à la montagne", b: "Vivre au bord de la mer" },
  { a: "Perdre tous tes messages", b: "Perdre toutes tes photos" },
  { a: "Être célèbre mais détesté", b: "Être inconnu mais adoré de tes proches" },
  { a: "Revivre le même jour 1 an", b: "Sauter 1 an de ta vie d'un coup" },
  { a: "Ne plus jamais utiliser ton téléphone", b: "Ne plus jamais regarder un écran télé/PC" },
  { a: "Gagner à tous les jeux", b: "Gagner toutes les disputes" },
  { a: "Avoir une mémoire parfaite", b: "Pouvoir oublier ce que tu veux" },
  { a: "Manger uniquement salé à vie", b: "Manger uniquement sucré à vie" },
  { a: "Téléportation (mais 5s de douleur)", b: "Voler (lentement, 30 km/h)" },
  { a: "Connaître tous les secrets du monde", b: "N'avoir plus jamais aucun secret" },
  { a: "Être le plus drôle de la pièce", b: "Être le plus intelligent de la pièce" },
];

const TOTAL_ROUNDS = 6;
const QUESTION_MS = 20_000;
const REVEAL_MS = 6_000;

// ───────────────────────────── État & vues ─────────────────────────────

type Choice = "a" | "b";
type Phase = "question" | "reveal" | "finished";

interface State {
  phase: Phase;
  rounds: Dilemma[];
  roundIndex: number;
  votes: Record<PlayerId, Choice>;
  scores: Record<PlayerId, number>;
  deadline: number;
  lastGains: Record<PlayerId, number>;
}

export interface TuPreferesView {
  phase: Phase;
  roundIndex: number;
  totalRounds: number;
  question: Dilemma | null;
  deadline: number;
  myChoice: Choice | null;
  votedPlayerIds: PlayerId[];
  scores: { playerId: PlayerId; score: number }[];
  // Disponible seulement en phase "reveal" / "finished"
  reveal: {
    counts: { a: number; b: number };
    votesByPlayer: Record<PlayerId, Choice>;
    gains: Record<PlayerId, number>;
  } | null;
}

// ───────────────────────────── Logique ─────────────────────────────

function pickRounds(random: () => number): Dilemma[] {
  const shuffled = [...POOL].sort(() => random() - 0.5);
  return shuffled.slice(0, Math.min(TOTAL_ROUNDS, POOL.length));
}

function tallyAndScore(state: State, players: GamePlayer[]): State {
  const counts = { a: 0, b: 0 };
  for (const p of players) {
    const v = state.votes[p.id];
    if (v) counts[v]++;
  }
  const gains: Record<PlayerId, number> = {};
  const scores = { ...state.scores };
  for (const p of players) {
    const v = state.votes[p.id];
    // On marque autant de points qu'il y a d'AUTRES joueurs du même avis.
    const gain = v ? Math.max(0, counts[v] - 1) : 0;
    gains[p.id] = gain;
    scores[p.id] = (scores[p.id] ?? 0) + gain;
  }
  return { ...state, scores, lastGains: gains };
}

export const tuPreferes: GameDefinition<State, TuPreferesView> = {
  id: "tu-preferes",
  name: "Tu Préfères",
  tagline: "Dilemmes impossibles, votes à l'aveugle.",
  description:
    "À chaque manche, un dilemme cornélien. Votez en secret pour A ou B : vous marquez des points pour chaque joueur qui pense comme vous. Saurez-vous deviner l'avis du groupe ?",
  emoji: "🤔",
  accent: "plum",
  minPlayers: 2,
  maxPlayers: 12,
  estimatedMinutes: 4,
  tags: ["Vote", "Ambiance", "Rapide"],

  createInitialState(ctx) {
    const scores: Record<PlayerId, number> = {};
    for (const p of ctx.players) scores[p.id] = 0;
    return {
      phase: "question",
      rounds: pickRounds(ctx.random),
      roundIndex: 0,
      votes: {},
      scores,
      deadline: ctx.now + QUESTION_MS,
      lastGains: {},
    };
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    switch (action.type) {
      case "start": {
        // Démarre le 1er chrono de vote.
        return {
          state: { ...state, deadline: ctx.now + QUESTION_MS },
          timers: [{ delayMs: QUESTION_MS, action: { type: "phaseEnd" } }],
        };
      }

      case "vote": {
        if (state.phase !== "question") return { state };
        const choice = (action.payload as { choice?: Choice })?.choice;
        if (choice !== "a" && choice !== "b") return { state };

        const votes = { ...state.votes, [ctx.playerId]: choice };
        const everyoneVoted = ctx.players.every((p) => votes[p.id]);

        if (everyoneVoted) {
          const tallied = tallyAndScore({ ...state, votes }, ctx.players);
          return {
            state: { ...tallied, phase: "reveal", deadline: ctx.now + REVEAL_MS },
            timers: [{ delayMs: REVEAL_MS, action: { type: "phaseEnd" } }],
          };
        }
        return { state: { ...state, votes } };
      }

      case "phaseEnd": {
        if (state.phase === "question") {
          const tallied = tallyAndScore(state, ctx.players);
          return {
            state: { ...tallied, phase: "reveal", deadline: ctx.now + REVEAL_MS },
            timers: [{ delayMs: REVEAL_MS, action: { type: "phaseEnd" } }],
          };
        }
        if (state.phase === "reveal") {
          const next = state.roundIndex + 1;
          if (next >= state.rounds.length) {
            return { state: { ...state, phase: "finished" } };
          }
          return {
            state: {
              ...state,
              phase: "question",
              roundIndex: next,
              votes: {},
              lastGains: {},
              deadline: ctx.now + QUESTION_MS,
            },
            timers: [{ delayMs: QUESTION_MS, action: { type: "phaseEnd" } }],
          };
        }
        return { state };
      }

      default:
        return { state };
    }
  },

  viewFor(state, playerId, players): TuPreferesView {
    const scores = players
      .map((p) => ({ playerId: p.id, score: state.scores[p.id] ?? 0 }))
      .sort((a, b) => b.score - a.score);

    const base: TuPreferesView = {
      phase: state.phase,
      roundIndex: state.roundIndex,
      totalRounds: state.rounds.length,
      question: state.rounds[state.roundIndex] ?? null,
      deadline: state.deadline,
      myChoice: state.votes[playerId] ?? null,
      votedPlayerIds: players.filter((p) => state.votes[p.id]).map((p) => p.id),
      scores,
      reveal: null,
    };

    if (state.phase === "reveal" || state.phase === "finished") {
      const counts = { a: 0, b: 0 };
      for (const p of players) {
        const v = state.votes[p.id];
        if (v) counts[v]++;
      }
      base.reveal = { counts, votesByPlayer: { ...state.votes }, gains: { ...state.lastGains } };
    }

    return base;
  },

  isFinished(state) {
    return state.phase === "finished";
  },

  getResults(state, players) {
    return rankByScore(players.map((p) => ({ playerId: p.id, score: state.scores[p.id] ?? 0 })));
  },
};
