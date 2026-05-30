"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/socket/events";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketCtx {
  socket: AppSocket | null;
  connected: boolean;
  /** Code de la table où le joueur est actuellement assis (ou null). */
  currentTable: string | null;
}

const Ctx = createContext<SocketCtx>({ socket: null, connected: false, currentTable: null });

export function useSocket() {
  return useContext(Ctx);
}

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/socket-token");
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.token === "string" ? data.token : null;
  } catch {
    return null;
  }
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [socket, setSocket] = useState<AppSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentTable, setCurrentTable] = useState<string | null>(null);
  const ref = useRef<AppSocket | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;

    (async () => {
      const token = await fetchToken();
      if (!active || !token) return;

      const s: AppSocket = io({
        path: "/socket.io",
        auth: { token },
        autoConnect: true,
      });

      s.on("connect", () => setConnected(true));
      s.on("disconnect", () => setConnected(false));
      // Le serveur indique la table courante du joueur (persiste navigation/refresh).
      s.on("table:current", (code) => setCurrentTable(code));

      // Le jeton expire (10 min) : on le rafraîchit avant chaque tentative de
      // reconnexion. Socket.IO gère lui-même le backoff — on ne relance jamais
      // connect() manuellement (ça créerait une boucle serrée en cas d'échec).
      s.io.on("reconnect_attempt", async () => {
        const fresh = await fetchToken();
        if (fresh) s.auth = { token: fresh };
      });

      ref.current = s;
      setSocket(s);
    })();

    return () => {
      active = false;
      ref.current?.disconnect();
      ref.current = null;
      setSocket(null);
      setConnected(false);
      setCurrentTable(null);
    };
  }, [status]);

  return (
    <Ctx.Provider value={{ socket, connected, currentTable }}>{children}</Ctx.Provider>
  );
}
