import type { Server, Socket } from "socket.io";
import { getGame } from "../lib/games/registry";
import {
  aqojPointsFor,
  type GameAction,
  type GameDefinition,
  type GamePlayer,
  SYSTEM_PLAYER,
  toMeta,
} from "../lib/games/types";
import type {
  Ack,
  ClientToServerEvents,
  GameResultView,
  LobbySnapshot,
  LobbyVisibility,
  ServerToClientEvents,
  SocketData,
  SocketUser,
  TableSummary,
} from "../lib/socket/events";
import { persistResult } from "./results";

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

interface Member {
  id: string;
  name: string;
  image: string | null;
  socketId: string | null;
  connected: boolean;
  ready: boolean;
}

interface Runtime {
  def: GameDefinition;
  state: unknown;
  timers: NodeJS.Timeout[];
  participants: GamePlayer[];
}

interface Lobby {
  code: string;
  hostId: string;
  gameId: string;
  status: "waiting" | "in_game" | "finished";
  visibility: LobbyVisibility;
  members: Map<string, Member>;
  /** Ordre des joueurs à la table (ids). Pilote l'ordre des jeux en tour par tour. */
  order: string[];
  runtime: Runtime | null;
  // Destruction différée : quand la table devient vide, on attend un peu avant de
  // la supprimer, le temps qu'un joueur qui a sauté (blip réseau, navigation) revienne.
  destroyTimer: NodeJS.Timeout | null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I/O/0/1 ambigus
const CODE_LENGTH = 4;
const EMPTY_LOBBY_GRACE_MS = 60_000; // garde une table vide 60 s avant suppression
const BROWSE_ROOM = "browse"; // room des sockets qui consultent la liste des tables

export class LobbyManager {
  private lobbies = new Map<string, Lobby>();
  private socketIndex = new Map<string, { code: string; userId: string }>();
  /** Table « courante » de chaque joueur (survit aux reconnexions/refresh). */
  private userTable = new Map<string, string>();

  constructor(private io: IOServer) {}

  // ───────────────────────────── Cycle de vie socket ─────────────────────────────

  register(socket: IOSocket) {
    socket.on("lobby:create", (gameId, ack) => this.handleCreate(socket, gameId, ack));
    socket.on("lobby:join", (code, ack) => this.handleJoin(socket, code, ack));
    socket.on("lobby:leave", () => this.handleLeave(socket));
    socket.on("lobby:setReady", (ready) => this.handleSetReady(socket, ready));
    socket.on("lobby:setGame", (gameId) => this.handleSetGame(socket, gameId));
    socket.on("lobby:start", (ack) => this.handleStart(socket, ack));
    socket.on("lobby:requestState", () => this.resync(socket));
    socket.on("lobby:shuffleOrder", () => this.handleShuffleOrder(socket));
    socket.on("lobby:reorder", (order) => this.handleReorder(socket, order));
    socket.on("lobby:setVisibility", (v) => this.handleSetVisibility(socket, v));
    socket.on("tables:watch", () => this.handleTablesWatch(socket));
    socket.on("tables:unwatch", () => this.handleTablesUnwatch(socket));
    socket.on("game:action", (action) => this.handleAction(socket, action));
    socket.on("disconnect", () => this.handleDisconnect(socket));

    // Restaure « ma table » au (re)connexion (navigation, refresh).
    this.restoreCurrent(socket);
  }

  // ───────────────────────────── Handlers ─────────────────────────────

  private handleCreate(socket: IOSocket, gameId: string, ack: (r: Ack) => void) {
    const game = getGame(gameId);
    if (!game) return ack({ ok: false, error: "Jeu inconnu." });

    this.detach(socket); // quitter une éventuelle table précédente
    const code = this.generateCode();
    const user = socket.data.user;
    const lobby: Lobby = {
      code,
      hostId: user.id,
      gameId,
      status: "waiting",
      visibility: "public",
      members: new Map(),
      order: [],
      runtime: null,
      destroyTimer: null,
    };
    this.lobbies.set(code, lobby);
    this.addMember(lobby, socket, user);
    ack({ ok: true, code });
    socket.emit("table:current", code);
    this.broadcast(lobby);
    this.broadcastBrowse();
  }

  private handleJoin(socket: IOSocket, rawCode: string, ack: (r: Ack) => void) {
    const code = (rawCode ?? "").toUpperCase().trim();
    const lobby = this.lobbies.get(code);
    if (!lobby) return ack({ ok: false, error: "Table introuvable." });

    const user = socket.data.user;
    const existing = lobby.members.get(user.id);
    const game = getGame(lobby.gameId);

    // Nouveau venu : refusé si partie en cours ou table pleine.
    if (!existing) {
      if (lobby.status === "in_game") {
        return ack({ ok: false, error: "Partie déjà en cours." });
      }
      if (game && lobby.members.size >= game.maxPlayers) {
        return ack({ ok: false, error: "Table complète." });
      }
    }

    this.detach(socket);
    this.addMember(lobby, socket, user);
    // Si l'hôte d'origine a quitté pendant que la table était vide, on confie la
    // main au premier arrivant.
    this.ensureHost(lobby);
    ack({ ok: true, code });
    socket.emit("table:current", code);
    this.broadcast(lobby);
    this.broadcastBrowse();

    // Reconnexion en pleine partie : renvoyer l'état de jeu courant.
    if (lobby.status === "in_game" && lobby.runtime) {
      this.emitGameViewTo(lobby, user.id);
    }
  }

  private handleLeave(socket: IOSocket) {
    this.detach(socket, true);
    socket.emit("table:current", null);
  }

  private handleSetReady(socket: IOSocket, ready: boolean) {
    const lobby = this.lobbyOf(socket);
    if (!lobby) return;
    const member = lobby.members.get(socket.data.user.id);
    if (!member) return;
    member.ready = !!ready;
    this.broadcast(lobby);
  }

  private handleSetGame(socket: IOSocket, gameId: string) {
    const lobby = this.lobbyOf(socket);
    if (!lobby || lobby.hostId !== socket.data.user.id) return;
    if (lobby.status === "in_game") return;
    if (!getGame(gameId)) return;
    lobby.gameId = gameId;
    // Changer de jeu réinitialise les "prêt".
    for (const m of lobby.members.values()) m.ready = false;
    this.broadcast(lobby);
    this.broadcastBrowse();
  }

  private handleShuffleOrder(socket: IOSocket) {
    const lobby = this.lobbyOf(socket);
    if (!lobby || lobby.hostId !== socket.data.user.id) return;
    if (lobby.status === "in_game") return;
    // Fisher-Yates sur l'ordre des joueurs.
    for (let i = lobby.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lobby.order[i], lobby.order[j]] = [lobby.order[j], lobby.order[i]];
    }
    this.broadcast(lobby);
  }

  private handleReorder(socket: IOSocket, order: string[]) {
    const lobby = this.lobbyOf(socket);
    if (!lobby || lobby.hostId !== socket.data.user.id) return;
    if (lobby.status === "in_game") return;
    if (!Array.isArray(order)) return;
    // L'ordre proposé doit être une permutation exacte des membres actuels.
    const current = new Set(lobby.order);
    if (order.length !== current.size) return;
    for (const id of order) {
      if (!current.has(id)) return;
      current.delete(id);
    }
    lobby.order = [...order];
    this.broadcast(lobby);
  }

  private handleSetVisibility(socket: IOSocket, visibility: LobbyVisibility) {
    const lobby = this.lobbyOf(socket);
    if (!lobby || lobby.hostId !== socket.data.user.id) return;
    if (visibility !== "public" && visibility !== "private") return;
    lobby.visibility = visibility;
    this.broadcast(lobby);
    this.broadcastBrowse();
  }

  private handleStart(socket: IOSocket, ack: (r: Ack) => void) {
    const lobby = this.lobbyOf(socket);
    if (!lobby) return ack({ ok: false, error: "Pas à une table." });
    if (lobby.hostId !== socket.data.user.id) {
      return ack({ ok: false, error: "Seul le maître de table peut lancer." });
    }
    const game = getGame(lobby.gameId);
    if (!game) return ack({ ok: false, error: "Jeu inconnu." });

    // Participants dans l'ORDRE de la table (filtrés aux joueurs connectés).
    const present = this.orderedMembers(lobby).filter((m) => m.connected);
    if (present.length < game.minPlayers) {
      return ack({ ok: false, error: `Il faut au moins ${game.minPlayers} joueurs.` });
    }

    const participants: GamePlayer[] = present.map((m) => ({
      id: m.id,
      name: m.name,
      image: m.image,
    }));

    const now = Date.now();
    const state = game.createInitialState({ players: participants, now, random: Math.random });
    lobby.runtime = { def: game, state, timers: [], participants };
    lobby.status = "in_game";
    for (const m of lobby.members.values()) m.ready = false;

    ack({ ok: true });
    this.broadcast(lobby);
    this.broadcastBrowse(); // la table quitte la liste publique (partie en cours)
    // Action conventionnelle "start" : laisse le jeu programmer ses 1ers timers.
    this.dispatch(lobby, SYSTEM_PLAYER, { type: "start" });
  }

  private handleAction(socket: IOSocket, action: GameAction) {
    const lobby = this.lobbyOf(socket);
    if (!lobby || lobby.status !== "in_game" || !lobby.runtime) return;
    if (!action || typeof action.type !== "string") return;
    this.dispatch(lobby, socket.data.user.id, action);
  }

  private handleDisconnect(socket: IOSocket) {
    this.detach(socket);
  }

  private handleTablesWatch(socket: IOSocket) {
    socket.join(BROWSE_ROOM);
    socket.emit("tables:list", this.publicTables());
  }

  private handleTablesUnwatch(socket: IOSocket) {
    socket.leave(BROWSE_ROOM);
  }

  // ───────────────────────────── Moteur de jeu ─────────────────────────────

  private dispatch(lobby: Lobby, playerId: string, action: GameAction) {
    const rt = lobby.runtime;
    if (!rt) return;

    const ctx = {
      players: rt.participants,
      playerId,
      now: Date.now(),
      random: Math.random,
    };
    const result = rt.def.reducer(rt.state, action, ctx);
    rt.state = result.state;

    // `timers` non défini → on conserve les timers en cours (l'action n'affecte
    // pas le rythme). Un tableau (même vide) → on remplace les timers en attente.
    if (result.timers !== undefined) {
      for (const t of rt.timers) clearTimeout(t);
      rt.timers = [];
      for (const spec of result.timers) {
        const handle = setTimeout(() => this.dispatch(lobby, SYSTEM_PLAYER, spec.action), spec.delayMs);
        rt.timers.push(handle);
      }
    }

    this.emitGameViews(lobby);

    if (rt.def.isFinished(rt.state)) {
      this.finishGame(lobby);
    }
  }

  private emitGameViews(lobby: Lobby) {
    const rt = lobby.runtime;
    if (!rt) return;
    for (const p of rt.participants) {
      this.emitGameViewTo(lobby, p.id);
    }
  }

  private emitGameViewTo(lobby: Lobby, userId: string) {
    const rt = lobby.runtime;
    if (!rt) return;
    const member = lobby.members.get(userId);
    if (!member?.socketId) return;
    const view = rt.def.viewFor(rt.state, userId, rt.participants);
    this.io.to(member.socketId).emit("game:view", view);
  }

  private async finishGame(lobby: Lobby) {
    const rt = lobby.runtime;
    if (!rt) return;
    for (const t of rt.timers) clearTimeout(t);
    rt.timers = [];

    const results = rt.def.getResults(rt.state, rt.participants);
    const byId = new Map(rt.participants.map((p) => [p.id, p]));
    const points = aqojPointsFor(results, rt.participants.length);
    const view: GameResultView[] = results
      .map((r) => {
        const p = byId.get(r.playerId);
        return {
          playerId: r.playerId,
          name: p?.name ?? "Joueur",
          image: p?.image ?? null,
          score: r.score,
          rank: r.rank,
          won: r.won,
          points: points[r.playerId] ?? 0,
        };
      })
      .sort((a, b) => a.rank - b.rank);

    lobby.status = "finished";
    lobby.runtime = null;

    this.io.to(lobby.code).emit("game:over", { gameId: rt.def.id, results: view });
    this.broadcast(lobby);

    try {
      await persistResult(rt.def.id, lobby.code, results, rt.participants);
    } catch (err) {
      console.error("[lobby] persistResult a échoué", err);
    }
  }

  // ───────────────────────────── Membres / diffusion ─────────────────────────────

  private addMember(lobby: Lobby, socket: IOSocket, user: SocketUser) {
    // Quelqu'un rejoint : on annule une éventuelle destruction différée.
    if (lobby.destroyTimer) {
      clearTimeout(lobby.destroyTimer);
      lobby.destroyTimer = null;
    }
    const existing = lobby.members.get(user.id);
    if (existing) {
      existing.socketId = socket.id;
      existing.connected = true;
      existing.name = user.name;
      existing.image = user.image;
    } else {
      lobby.members.set(user.id, {
        id: user.id,
        name: user.name,
        image: user.image,
        socketId: socket.id,
        connected: true,
        ready: false,
      });
      lobby.order.push(user.id); // nouvel arrivant : en fin de file
    }
    socket.join(lobby.code);
    this.socketIndex.set(socket.id, { code: lobby.code, userId: user.id });
    this.userTable.set(user.id, lobby.code);
  }

  /** Détache un socket de sa table. `explicit` = quitter volontairement. */
  private detach(socket: IOSocket, explicit = false) {
    const idx = this.socketIndex.get(socket.id);
    this.socketIndex.delete(socket.id);
    if (!idx) return;
    const lobby = this.lobbies.get(idx.code);
    if (!lobby) return;
    const member = lobby.members.get(idx.userId);
    if (!member) return;

    socket.leave(lobby.code);

    const inGame = lobby.status === "in_game";
    // En partie, on garde le membre (déconnecté) pour permettre la reconnexion ;
    // sinon (table d'attente / finie) ou départ explicite, on le retire.
    if (inGame && !explicit) {
      member.connected = false;
      member.socketId = null;
    } else {
      lobby.members.delete(idx.userId);
      lobby.order = lobby.order.filter((id) => id !== idx.userId);
      this.userTable.delete(idx.userId);
    }

    if (this.activeCount(lobby) === 0) {
      // Table vide : suppression différée (fenêtre de grâce).
      this.scheduleDestroy(lobby);
      this.broadcast(lobby);
      this.broadcastBrowse();
      return;
    }

    this.ensureHost(lobby);
    this.broadcast(lobby);
    this.broadcastBrowse();
  }

  private activeCount(lobby: Lobby): number {
    return [...lobby.members.values()].filter((m) => m.connected).length;
  }

  /** Garantit qu'un membre connecté est désigné comme maître de table. */
  private ensureHost(lobby: Lobby) {
    const host = lobby.members.get(lobby.hostId);
    if (host?.connected) return;
    const next = this.orderedMembers(lobby).find((m) => m.connected);
    if (next) lobby.hostId = next.id;
  }

  /** Membres dans l'ordre de la table (ignore les ids orphelins par sécurité). */
  private orderedMembers(lobby: Lobby): Member[] {
    return lobby.order
      .map((id) => lobby.members.get(id))
      .filter((m): m is Member => m !== undefined);
  }

  private scheduleDestroy(lobby: Lobby) {
    if (lobby.destroyTimer) return;
    lobby.destroyTimer = setTimeout(() => {
      lobby.destroyTimer = null;
      if (this.activeCount(lobby) === 0) this.destroyLobby(lobby);
    }, EMPTY_LOBBY_GRACE_MS);
  }

  private destroyLobby(lobby: Lobby) {
    if (lobby.destroyTimer) {
      clearTimeout(lobby.destroyTimer);
      lobby.destroyTimer = null;
    }
    if (lobby.runtime) {
      for (const t of lobby.runtime.timers) clearTimeout(t);
    }
    for (const id of lobby.members.keys()) {
      if (this.userTable.get(id) === lobby.code) this.userTable.delete(id);
    }
    this.lobbies.delete(lobby.code);
    this.broadcastBrowse();
  }

  /** À la (re)connexion, indique au socket sa table courante (si toujours valide). */
  private restoreCurrent(socket: IOSocket) {
    const uid = socket.data.user.id;
    const code = this.userTable.get(uid);
    const lobby = code ? this.lobbies.get(code) : undefined;
    if (lobby && lobby.members.has(uid)) {
      socket.emit("table:current", code!);
    } else {
      this.userTable.delete(uid);
      socket.emit("table:current", null);
    }
  }

  private resync(socket: IOSocket) {
    const lobby = this.lobbyOf(socket);
    if (!lobby) return;
    socket.emit("lobby:state", this.snapshot(lobby));
    if (lobby.status === "in_game") this.emitGameViewTo(lobby, socket.data.user.id);
  }

  private broadcast(lobby: Lobby) {
    this.io.to(lobby.code).emit("lobby:state", this.snapshot(lobby));
  }

  private snapshot(lobby: Lobby): LobbySnapshot {
    const game = getGame(lobby.gameId);
    return {
      code: lobby.code,
      hostId: lobby.hostId,
      gameId: lobby.gameId,
      status: lobby.status,
      visibility: lobby.visibility,
      game: game ? toMeta(game) : null,
      members: this.orderedMembers(lobby).map((m) => ({
        id: m.id,
        name: m.name,
        image: m.image,
        isHost: m.id === lobby.hostId,
        ready: m.ready,
        connected: m.connected,
      })),
    };
  }

  // ───────────────────────────── Liste publique ─────────────────────────────

  private publicTables(): TableSummary[] {
    const out: TableSummary[] = [];
    for (const lobby of this.lobbies.values()) {
      if (lobby.visibility !== "public" || lobby.status !== "waiting") continue;
      const game = getGame(lobby.gameId);
      if (game && lobby.members.size >= game.maxPlayers) continue; // pleine
      const host = lobby.members.get(lobby.hostId);
      out.push({
        code: lobby.code,
        gameId: lobby.gameId,
        game: game ? toMeta(game) : null,
        hostName: host?.name ?? "Joueur",
        playerCount: lobby.members.size,
        maxPlayers: game?.maxPlayers ?? lobby.members.size,
      });
    }
    // Tables les plus remplies d'abord.
    return out.sort((a, b) => b.playerCount - a.playerCount);
  }

  private broadcastBrowse() {
    this.io.to(BROWSE_ROOM).emit("tables:list", this.publicTables());
  }

  // ───────────────────────────── Utilitaires ─────────────────────────────

  private lobbyOf(socket: IOSocket): Lobby | undefined {
    const idx = this.socketIndex.get(socket.id);
    return idx ? this.lobbies.get(idx.code) : undefined;
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = "";
      for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.lobbies.has(code)) return code;
    }
    return `${Date.now() % 100000}`;
  }
}
