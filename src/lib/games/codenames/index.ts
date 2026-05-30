import {
  type GameAction,
  type GameDefinition,
  type GamePlayer,
  type PlayerId,
  type ReducerCtx,
  type ReducerResult,
  rankByScore,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Codenames — adaptation fidèle du jeu de société.
//
// Deux équipes (rouge / bleue). Dans chaque équipe, un Espion (spymaster) connaît
// la couleur secrète des 25 mots et fait deviner ceux de son équipe à ses Agents
// via « 1 mot + 1 chiffre ». L'équipe qui démasque tous ses mots gagne ; toucher
// l'Assassin = défaite immédiate. L'équipe qui commence a 9 mots, l'autre 8.
// ─────────────────────────────────────────────────────────────────────────────

export type Team = "red" | "blue";
export type Role = "spymaster" | "operative";
export type CardColor = "red" | "blue" | "neutral" | "assassin";
type Phase = "clue" | "guess" | "finished";

const UNLIMITED = 99; // indice « 0 » = nombre de tentatives illimité

// Pioche de mots (français, un mot par carte).
const WORDS = [
  "PLAGE", "ÉCOLE", "FUSÉE", "CHEVAL", "BANQUE", "GLACE", "PIRATE", "ROBOT",
  "CHÂTEAU", "DRAGON", "POMME", "GUITARE", "MONTAGNE", "TÉLÉPHONE", "CHOCOLAT",
  "AVION", "SERPENT", "DOCTEUR", "FANTÔME", "VOLCAN", "JARDIN", "MASQUE",
  "ÉTOILE", "REQUIN", "PINCEAU", "BOUTEILLE", "TAMBOUR", "COURONNE", "ARAIGNÉE",
  "SOLEIL", "NEIGE", "FROMAGE", "VOLEUR", "CIRQUE", "MIROIR", "BALLON", "TRÉSOR",
  "SORCIÈRE", "ABEILLE", "TIGRE", "BOUSSOLE", "CRAYON", "LUNETTES", "CASCADE",
  "ORANGE", "MOUSTACHE", "CLÉ", "TORTUE", "CANON", "ÉCHELLE", "PONT", "NAVIRE",
  "DÉSERT", "FORÊT", "ROI", "REINE", "BOMBE", "PLUME", "OURS", "RENARD", "LION",
  "GÂTEAU", "PIANO", "VIOLON", "TRAIN", "MÉTRO", "USINE", "HÔPITAL", "MARTEAU",
  "ÉPÉE", "BOUCLIER", "CARTE", "FUSIL",
];

// ───────────────────────────── État & vues ─────────────────────────────

interface Card {
  word: string;
  color: CardColor; // identité secrète
  revealed: boolean;
}

interface Clue {
  word: string;
  count: number; // chiffre annoncé (0 = illimité)
  team: Team;
}

interface State {
  cards: Card[]; // 25
  assignments: Record<PlayerId, { team: Team; role: Role }>;
  startingTeam: Team;
  currentTeam: Team;
  phase: Phase;
  clue: Clue | null;
  guessesRemaining: number; // tentatives restantes ce tour (UNLIMITED = illimité)
  guessedThisTurn: boolean; // au moins une carte tentée ce tour ?
  remaining: Record<Team, number>; // mots non révélés par équipe
  winner: Team | null;
  log: string[];
}

export interface CodenamesCardView {
  word: string;
  revealed: boolean;
  /** Couleur visible : révélée pour tous, ou pour l'Espion (carte clé). Sinon null. */
  color: CardColor | null;
}

export interface CodenamesPlayerView {
  id: PlayerId;
  team: Team;
  role: Role;
}

export interface CodenamesView {
  phase: Phase;
  cards: CodenamesCardView[];
  currentTeam: Team;
  startingTeam: Team;
  clue: Clue | null;
  guessesRemaining: number | null; // null hors phase de devinette
  remaining: Record<Team, number>;
  winner: Team | null;
  me: { team: Team; role: Role } | null;
  isSpymaster: boolean;
  canGiveClue: boolean; // mon tour de donner un indice
  canGuess: boolean; // mon tour de deviner
  canPass: boolean; // je peux passer (≥1 tentative faite)
  players: CodenamesPlayerView[];
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

const other = (t: Team): Team => (t === "red" ? "blue" : "red");
const label = (t: Team): string => (t === "red" ? "Rouge" : "Bleue");

function pushLog(log: string[], entry: string): string[] {
  return [entry, ...log].slice(0, 8);
}

/** Passe la main à l'équipe adverse, en attente d'un nouvel indice. */
function endTurn(state: State): Partial<State> {
  return {
    currentTeam: other(state.currentTeam),
    phase: "clue",
    clue: null,
    guessesRemaining: 0,
    guessedThisTurn: false,
  };
}

// Les équipes suivent l'ORDRE de la table (fixé par le maître de table) : on
// alterne rouge/bleu, et le 1er de chaque équipe devient l'Espion. Le maître peut
// mélanger ou réorganiser la table pour changer la composition d'une partie à l'autre.
function assignTeams(
  players: GamePlayer[],
): Record<PlayerId, { team: Team; role: Role }> {
  const byTeam: Record<Team, PlayerId[]> = { red: [], blue: [] };
  players.forEach((p, i) => byTeam[i % 2 === 0 ? "red" : "blue"].push(p.id));

  const assignments: Record<PlayerId, { team: Team; role: Role }> = {};
  (["red", "blue"] as Team[]).forEach((team) => {
    byTeam[team].forEach((id, i) => {
      assignments[id] = { team, role: i === 0 ? "spymaster" : "operative" };
    });
  });
  return assignments;
}

// ───────────────────────────── Définition ─────────────────────────────

export const codenames: GameDefinition<State, CodenamesView> = {
  id: "codenames",
  name: "Codenames",
  tagline: "Un mot, un chiffre, faites deviner vos agents.",
  description:
    "Deux équipes s'affrontent. L'Espion connaît la couleur secrète des 25 mots et fait deviner ceux de son camp avec un seul mot et un chiffre. Trouvez tous vos mots avant l'adversaire… mais évitez l'Assassin !",
  emoji: "🕵️",
  accent: "sky",
  minPlayers: 4,
  maxPlayers: 8,
  estimatedMinutes: 15,
  tags: ["Équipes", "Déduction", "Mots"],

  createInitialState(ctx) {
    const assignments = assignTeams(ctx.players);
    const startingTeam: Team = ctx.random() < 0.5 ? "red" : "blue";
    const second = other(startingTeam);

    // 9 pour l'équipe qui commence, 8 pour l'autre, 7 neutres, 1 assassin = 25.
    const colors: CardColor[] = [
      ...Array(9).fill(startingTeam),
      ...Array(8).fill(second),
      ...Array(7).fill("neutral"),
      "assassin",
    ];
    const shuffledColors = shuffle(colors, ctx.random);
    const words = shuffle(WORDS, ctx.random).slice(0, 25);
    const cards: Card[] = words.map((word, i) => ({
      word,
      color: shuffledColors[i],
      revealed: false,
    }));

    return {
      cards,
      assignments,
      startingTeam,
      currentTeam: startingTeam,
      phase: "clue",
      clue: null,
      guessesRemaining: 0,
      guessedThisTurn: false,
      remaining: { red: 0, blue: 0, [startingTeam]: 9, [second]: 8 } as Record<Team, number>,
      winner: null,
      log: [`La partie commence — l'équipe ${label(startingTeam)} joue en premier.`],
    };
  },

  reducer(state, action: GameAction, ctx: ReducerCtx): ReducerResult<State> {
    if (state.phase === "finished") return { state };
    const me = state.assignments[ctx.playerId];
    const payload = (action.payload ?? {}) as Record<string, unknown>;

    switch (action.type) {
      case "start":
        return { state };

      case "clue": {
        if (state.phase !== "clue") return { state };
        if (!me || me.team !== state.currentTeam || me.role !== "spymaster") return { state };

        const word = String(payload.word ?? "").trim();
        const count = Math.floor(Number(payload.count));
        // Un seul mot (pas d'espace), chiffre entre 0 et 9.
        if (!word || word.length > 24 || /\s/.test(word)) return { state };
        if (!Number.isFinite(count) || count < 0 || count > 9) return { state };

        return {
          state: {
            ...state,
            phase: "guess",
            clue: { word, count, team: state.currentTeam },
            guessesRemaining: count === 0 ? UNLIMITED : count + 1,
            guessedThisTurn: false,
            log: pushLog(
              state.log,
              `🗣️ ${label(state.currentTeam)} — indice : « ${word.toUpperCase()} » ${
                count === 0 ? "∞" : count
              }`,
            ),
          },
        };
      }

      case "guess": {
        if (state.phase !== "guess") return { state };
        if (!me || me.team !== state.currentTeam || me.role !== "operative") return { state };

        const idx = Math.floor(Number(payload.cardIndex));
        const card = state.cards[idx];
        if (!card || card.revealed) return { state };

        const cards = state.cards.map((c, i) => (i === idx ? { ...c, revealed: true } : c));
        const remaining = { ...state.remaining };
        if (card.color === "red" || card.color === "blue") remaining[card.color]--;

        // Assassin → défaite immédiate.
        if (card.color === "assassin") {
          const winner = other(state.currentTeam);
          return {
            state: {
              ...state,
              cards,
              phase: "finished",
              winner,
              log: pushLog(
                state.log,
                `💀 ${label(state.currentTeam)} a touché l'Assassin (${card.word}) — ${label(
                  winner,
                )} gagne !`,
              ),
            },
          };
        }

        // Carte de sa propre équipe → bonne pioche.
        if (card.color === state.currentTeam) {
          if (remaining[state.currentTeam] === 0) {
            return {
              state: {
                ...state,
                cards,
                remaining,
                phase: "finished",
                winner: state.currentTeam,
                log: pushLog(
                  state.log,
                  `🏆 ${label(state.currentTeam)} a trouvé tous ses mots — victoire !`,
                ),
              },
            };
          }
          const gr = state.guessesRemaining - 1;
          const log = pushLog(state.log, `✅ ${card.word} — ${label(state.currentTeam)}`);
          if (gr <= 0) {
            return {
              state: {
                ...state,
                cards,
                remaining,
                ...endTurn(state),
                log: pushLog(log, `↪︎ Au tour de l'équipe ${label(other(state.currentTeam))}.`),
              },
            };
          }
          return {
            state: { ...state, cards, remaining, guessesRemaining: gr, guessedThisTurn: true, log },
          };
        }

        // Mauvaise pioche (carte adverse ou neutre) → fin du tour.
        let log: string[];
        if (card.color === "red" || card.color === "blue") {
          log = pushLog(state.log, `❌ ${card.word} appartenait à l'équipe ${label(card.color)} !`);
          if (remaining[card.color] === 0) {
            return {
              state: {
                ...state,
                cards,
                remaining,
                phase: "finished",
                winner: card.color,
                log: pushLog(log, `🏆 ${label(card.color)} a tous ses mots — victoire !`),
              },
            };
          }
        } else {
          log = pushLog(state.log, `⬜ ${card.word} était neutre — fin du tour.`);
        }
        return {
          state: {
            ...state,
            cards,
            remaining,
            ...endTurn(state),
            log: pushLog(log, `↪︎ Au tour de l'équipe ${label(other(state.currentTeam))}.`),
          },
        };
      }

      case "pass": {
        if (state.phase !== "guess") return { state };
        if (!me || me.team !== state.currentTeam || me.role !== "operative") return { state };
        if (!state.guessedThisTurn) return { state }; // au moins 1 tentative obligatoire

        return {
          state: {
            ...state,
            ...endTurn(state),
            log: pushLog(
              state.log,
              `↪︎ ${label(state.currentTeam)} passe — au tour de ${label(other(state.currentTeam))}.`,
            ),
          },
        };
      }

      default:
        return { state };
    }
  },

  viewFor(state, playerId, players): CodenamesView {
    const me = state.assignments[playerId] ?? null;
    const isSpymaster = me?.role === "spymaster";
    const seeAll = isSpymaster || state.phase === "finished";

    const cards: CodenamesCardView[] = state.cards.map((c) => ({
      word: c.word,
      revealed: c.revealed,
      color: c.revealed || seeAll ? c.color : null,
    }));

    const canGiveClue =
      !!me && me.team === state.currentTeam && me.role === "spymaster" && state.phase === "clue";
    const canGuess =
      !!me && me.team === state.currentTeam && me.role === "operative" && state.phase === "guess";

    return {
      phase: state.phase,
      cards,
      currentTeam: state.currentTeam,
      startingTeam: state.startingTeam,
      clue: state.clue,
      guessesRemaining: state.phase === "guess" ? state.guessesRemaining : null,
      remaining: state.remaining,
      winner: state.winner,
      me,
      isSpymaster,
      canGiveClue,
      canGuess,
      canPass: canGuess && state.guessedThisTurn,
      players: players
        .filter((p) => state.assignments[p.id])
        .map((p) => ({ id: p.id, ...state.assignments[p.id] })),
      log: state.log,
    };
  },

  isFinished(state) {
    return state.phase === "finished";
  },

  getResults(state, players) {
    // Les joueurs de l'équipe gagnante marquent 1, les autres 0.
    return rankByScore(
      players.map((p) => ({
        playerId: p.id,
        score: state.winner && state.assignments[p.id]?.team === state.winner ? 1 : 0,
      })),
    );
  },
};
