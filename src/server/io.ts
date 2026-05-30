import type { Server as HTTPServer } from "node:http";
import { Server } from "socket.io";
import { verifySocketToken } from "../lib/socket-token";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../lib/socket/events";
import { LobbyManager } from "./lobby";

export function setupSocket(httpServer: HTTPServer) {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    path: "/socket.io",
    // Même origine que Next : pas besoin de CORS ouvert.
    cors: { origin: false },
  });

  // Authentification du handshake via le jeton signé émis par /api/socket-token.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const user = typeof token === "string" ? verifySocketToken(token) : null;
    if (!user) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.user = user;
    next();
  });

  const manager = new LobbyManager(io);
  io.on("connection", (socket) => manager.register(socket));

  return io;
}
