// ─────────────────────────────────────────────────────────────────────────────
// Moteur de jeu générique d'AQOJ.
//
// Chaque jeu est une `GameDefinition` : des métadonnées + une logique pure et
// *server-authoritative* (les clients envoient des actions, le serveur calcule
// le nouvel état et renvoie à chaque joueur une "vue" filtrée).
//
// Pour ajouter un jeu : créer un dossier dans `src/lib/games/<id>/`, exporter une
// `GameDefinition`, et l'enregistrer dans `registry.ts`. Aucune autre plomberie.
// ─────────────────────────────────────────────────────────────────────────────

export type PlayerId = string;

/** Action déclenchée par un timer serveur (pas par un joueur). */
export const SYSTEM_PLAYER: PlayerId = "__system__";

export interface GamePlayer {
  id: PlayerId;
  name: string;
  image: string | null;
}

/** Action générique envoyée par un client (ou par le système via un timer). */
export interface GameAction<T extends string = string, P = unknown> {
  type: T;
  payload?: P;
}

/** Timer programmé par le reducer ; le serveur redispatchera `action` après `delayMs`. */
export interface TimerSpec {
  delayMs: number;
  action: GameAction;
}

export interface ReducerCtx {
  players: GamePlayer[];
  playerId: PlayerId; // auteur de l'action (ou SYSTEM_PLAYER)
  now: number;
  random: () => number;
}

export interface ReducerResult<S> {
  state: S;
  /**
   * Timers à (re)programmer. À chaque dispatch, le serveur annule les timers en
   * attente et applique ceux retournés ici. Omettre = garder l'état sans timer.
   */
  timers?: TimerSpec[];
}

export interface GameResultEntry {
  playerId: PlayerId;
  score: number;
  rank: number; // 1 = meilleur
  won: boolean;
}

/** Métadonnées affichées dans l'UI (sérialisables, sans logique). */
export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  description: string;
  emoji: string;
  /** Clé d'accent (couleur douce du jeu), ex: "honey". Voir components/games/accent.ts. */
  accent: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedMinutes: number;
  tags: string[];
  /** Règles résumées (une entrée = une étape/point), affichées sur la fiche du jeu. */
  rules: string[];
}

export interface GameDefinition<S = unknown, V = unknown> extends GameMeta {
  /** État initial de la partie. */
  createInitialState(ctx: Omit<ReducerCtx, "playerId">): S;

  /** Réducteur pur et server-authoritative. Ne jamais muter `state`. */
  reducer(state: S, action: GameAction, ctx: ReducerCtx): ReducerResult<S>;

  /** Projette l'état complet vers la vue d'un joueur (cache les secrets). */
  viewFor(state: S, playerId: PlayerId, players: GamePlayer[]): V;

  /** La partie est-elle terminée ? */
  isFinished(state: S): boolean;

  /** Classement final, une fois `isFinished` vrai. */
  getResults(state: S, players: GamePlayer[]): GameResultEntry[];
}

/** Extrait les métadonnées sérialisables d'une définition (pour l'UI/réseau). */
export function toMeta(def: GameDefinition): GameMeta {
  return {
    id: def.id,
    name: def.name,
    tagline: def.tagline,
    description: def.description,
    emoji: def.emoji,
    accent: def.accent,
    minPlayers: def.minPlayers,
    maxPlayers: def.maxPlayers,
    estimatedMinutes: def.estimatedMinutes,
    tags: def.tags,
    rules: def.rules,
  };
}

// ───────────────────────────── AQOJPoints ─────────────────────────────
// Monnaie du jeu gagnée en fin de partie, UNIQUEMENT à partir de 3 joueurs.
// • Jeu individuel (un seul gagnant) : 5 pts au 1er, 2 pts au 2e.
// • Jeu en équipe (plusieurs gagnants) : 5 pts à chaque membre de l'équipe gagnante.
export const AQOJ_MIN_PLAYERS_FOR_POINTS = 3;

/** Calcule les AQOJPoints de chaque joueur à partir du classement final. */
export function aqojPointsFor(
  results: GameResultEntry[],
  playerCount: number,
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const r of results) out[r.playerId] = 0;
  if (playerCount < AQOJ_MIN_PLAYERS_FOR_POINTS) return out;

  const winners = results.filter((r) => r.won);
  const teamGame = winners.length > 1; // plusieurs gagnants = victoire d'équipe
  for (const r of results) {
    if (r.won) out[r.playerId] = 5;
    else if (!teamGame && r.rank === 2) out[r.playerId] = 2;
  }
  return out;
}

/** Helper : attribue des rangs à partir des scores (desc) et marque le(s) gagnant(s). */
export function rankByScore(
  scores: { playerId: PlayerId; score: number }[],
): GameResultEntry[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const best = sorted.length ? sorted[0].score : 0;
  let rank = 0;
  let prev: number | null = null;
  return sorted.map((s, i) => {
    if (prev === null || s.score !== prev) {
      rank = i + 1;
      prev = s.score;
    }
    return {
      playerId: s.playerId,
      score: s.score,
      rank,
      won: s.score === best && best > 0,
    };
  });
}
