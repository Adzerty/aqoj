import type { GameAction, GameMeta } from "../games/types";

// Contrat partagé client ⇄ serveur pour Socket.IO. Types purs uniquement.

export type LobbyStatus = "waiting" | "in_game" | "finished";
export type LobbyVisibility = "public" | "private";

export interface LobbyMemberView {
  id: string;
  name: string;
  image: string | null;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
}

export interface LobbySnapshot {
  code: string;
  hostId: string;
  gameId: string;
  status: LobbyStatus;
  visibility: LobbyVisibility;
  /** Membres dans l'ORDRE de la table (modifiable par le maître de table). */
  members: LobbyMemberView[];
  game: GameMeta | null;
}

/** Résumé d'une table pour la liste publique (page « Tables »). */
export interface TableSummary {
  code: string;
  gameId: string;
  game: GameMeta | null;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
}

export interface GameResultView {
  playerId: string;
  name: string;
  image: string | null;
  score: number;
  rank: number;
  won: boolean;
}

export interface GameOverPayload {
  gameId: string;
  results: GameResultView[];
}

export interface Ack {
  ok: boolean;
  error?: string;
  code?: string;
}

// Événements serveur → client
export interface ServerToClientEvents {
  "lobby:state": (snapshot: LobbySnapshot) => void;
  "lobby:closed": (reason: string) => void;
  "game:view": (view: unknown) => void;
  "game:over": (payload: GameOverPayload) => void;
  "toast": (message: string) => void;
  /** Code de la table où le joueur est actuellement assis (ou null). */
  "table:current": (code: string | null) => void;
  /** Liste des tables publiques rejoignables (page « Tables »). */
  "tables:list": (tables: TableSummary[]) => void;
}

// Événements client → serveur
export interface ClientToServerEvents {
  "lobby:create": (gameId: string, ack: (res: Ack) => void) => void;
  "lobby:join": (code: string, ack: (res: Ack) => void) => void;
  "lobby:leave": () => void;
  "lobby:setReady": (ready: boolean) => void;
  "lobby:setGame": (gameId: string) => void;
  "lobby:start": (ack: (res: Ack) => void) => void;
  "lobby:requestState": () => void;
  "game:action": (action: GameAction) => void;
  // Gestion de la table par le maître de table
  "lobby:shuffleOrder": () => void;
  "lobby:reorder": (order: string[]) => void;
  "lobby:setVisibility": (visibility: LobbyVisibility) => void;
  // Liste publique des tables
  "tables:watch": () => void;
  "tables:unwatch": () => void;
}

export interface SocketUser {
  id: string;
  name: string;
  image: string | null;
  guest: boolean;
}

export interface SocketData {
  user: SocketUser;
}
