import {
  type GameAction,
  type GameDefinition,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
  rankByScore,
} from "../types";

const TOTAL_ROUNDS = 5;
const ARM_MIN_MS = 1_500;
const ARM_MAX_MS = 5_000;
const GO_WINDOW_MS = 4_000; // si personne ne tape
const RESULT_MS = 4_000;

type Phase = "arming" | "go" | "result" | "finished";

interface State {
  phase: Phase;
  roundIndex: number;
  goAt: number | null;
  taps: Record<PlayerId, number>; // temps de réaction en ms
  falseStart: Record<PlayerId, boolean>;
  roundWinner: PlayerId | null;
  wins: Record<PlayerId, number>;
  bestMs: Record<PlayerId, number>;
  deadline: number;
}

export interface ReactionView {
  phase: Phase;
  roundIndex: number;
  totalRounds: number;
  goAt: number | null;
  deadline: number;
  myReaction: number | null;
  myFalseStart: boolean;
  roundWinner: PlayerId | null;
  taps: Record<PlayerId, number>;
  falseStart: Record<PlayerId, boolean>;
  wins: { playerId: PlayerId; score: number }[];
  bestMs: Record<PlayerId, number>;
}

function armingDelay(random: () => number): number {
  return Math.round(ARM_MIN_MS + random() * (ARM_MAX_MS - ARM_MIN_MS));
}

export const reaction: GameDefinition<State, ReactionView> = {
  id: "reaction",
  name: "Réaction",
  tagline: "Le plus rapide à dégainer gagne.",
  description:
    "L'écran est rouge… attends. Dès qu'il passe au VERT, tape le plus vite possible ! Le premier rafle la manche. Mais attention : taper trop tôt = faux départ, tu sautes ton tour.",
  emoji: "⚡",
  accent: "clay",
  minPlayers: 2,
  maxPlayers: 12,
  estimatedMinutes: 3,
  tags: ["Réflexes", "Compétitif", "Rapide"],

  createInitialState(ctx) {
    const wins: Record<PlayerId, number> = {};
    const bestMs: Record<PlayerId, number> = {};
    for (const p of ctx.players) {
      wins[p.id] = 0;
      bestMs[p.id] = Infinity;
    }
    return {
      phase: "arming",
      roundIndex: 0,
      goAt: null,
      taps: {},
      falseStart: {},
      roundWinner: null,
      wins,
      bestMs,
      deadline: 0,
    };
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    switch (action.type) {
      case "start":
      case "next": {
        if (action.type === "next") {
          const nextIdx = state.roundIndex + 1;
          if (nextIdx >= TOTAL_ROUNDS) {
            return { state: { ...state, phase: "finished" } };
          }
          state = { ...state, roundIndex: nextIdx };
        }
        const delay = armingDelay(ctx.random);
        return {
          state: {
            ...state,
            phase: "arming",
            goAt: null,
            taps: {},
            falseStart: {},
            roundWinner: null,
            deadline: ctx.now + delay,
          },
          timers: [{ delayMs: delay, action: { type: "go" } }],
        };
      }

      case "go": {
        if (state.phase !== "arming") return { state };
        return {
          state: { ...state, phase: "go", goAt: ctx.now, deadline: ctx.now + GO_WINDOW_MS },
          timers: [{ delayMs: GO_WINDOW_MS, action: { type: "roundEnd" } }],
        };
      }

      case "tap": {
        // Faux départ : on tape avant le GO.
        if (state.phase === "arming") {
          if (state.falseStart[ctx.playerId]) return { state };
          return { state: { ...state, falseStart: { ...state.falseStart, [ctx.playerId]: true } } };
        }
        if (state.phase !== "go" || state.goAt === null) return { state };
        if (state.falseStart[ctx.playerId] || state.taps[ctx.playerId] !== undefined) {
          return { state };
        }

        const reactionMs = Math.max(0, ctx.now - state.goAt);
        const taps = { ...state.taps, [ctx.playerId]: reactionMs };

        // Premier tap valide = vainqueur de la manche, on enchaîne.
        const wins = { ...state.wins, [ctx.playerId]: (state.wins[ctx.playerId] ?? 0) + 1 };
        const bestMs = {
          ...state.bestMs,
          [ctx.playerId]: Math.min(state.bestMs[ctx.playerId] ?? Infinity, reactionMs),
        };
        return {
          state: {
            ...state,
            taps,
            wins,
            bestMs,
            roundWinner: ctx.playerId,
            phase: "result",
            deadline: ctx.now + RESULT_MS,
          },
          timers: [{ delayMs: RESULT_MS, action: { type: "next" } }],
        };
      }

      case "roundEnd": {
        if (state.phase !== "go") return { state };
        // Personne n'a tapé à temps : manche nulle.
        return {
          state: { ...state, phase: "result", roundWinner: null, deadline: ctx.now + RESULT_MS },
          timers: [{ delayMs: RESULT_MS, action: { type: "next" } }],
        };
      }

      default:
        return { state };
    }
  },

  viewFor(state, playerId, players): ReactionView {
    return {
      phase: state.phase,
      roundIndex: state.roundIndex,
      totalRounds: TOTAL_ROUNDS,
      goAt: state.phase === "go" || state.phase === "result" ? state.goAt : null,
      deadline: state.deadline,
      myReaction: state.taps[playerId] ?? null,
      myFalseStart: !!state.falseStart[playerId],
      roundWinner: state.roundWinner,
      taps: state.phase === "result" || state.phase === "finished" ? { ...state.taps } : {},
      falseStart: { ...state.falseStart },
      wins: players
        .map((p) => ({ playerId: p.id, score: state.wins[p.id] ?? 0 }))
        .sort((a, b) => b.score - a.score),
      bestMs: Object.fromEntries(
        players.map((p) => [p.id, state.bestMs[p.id] === Infinity ? 0 : state.bestMs[p.id] ?? 0]),
      ),
    };
  },

  isFinished(state) {
    return state.phase === "finished";
  },

  getResults(state, players) {
    return rankByScore(players.map((p) => ({ playerId: p.id, score: state.wins[p.id] ?? 0 })));
  },
};
