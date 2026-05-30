"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSocket } from "@/components/socket-provider";
import { useToast } from "@/components/toast";
import type { GameAction } from "@/lib/games/types";
import type { GameOverPayload, LobbySnapshot, LobbyVisibility } from "@/lib/socket/events";

export interface UseLobby {
  snapshot: LobbySnapshot | null;
  view: unknown;
  over: GameOverPayload | null;
  meId: string | null;
  ready: boolean;
  isHost: boolean;
  setReady: (ready: boolean) => void;
  setGame: (gameId: string) => void;
  start: () => void;
  leave: () => void;
  sendAction: (action: GameAction) => void;
  shuffleOrder: () => void;
  reorder: (order: string[]) => void;
  setVisibility: (visibility: LobbyVisibility) => void;
}

export function useLobby(code: string): UseLobby {
  const { socket } = useSocket();
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();

  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [view, setView] = useState<unknown>(null);
  const [over, setOver] = useState<GameOverPayload | null>(null);

  const meId = session?.user?.id ?? null;

  useEffect(() => {
    if (!socket) return;

    const onState = (snap: LobbySnapshot) => {
      setSnapshot(snap);
      if (snap.status !== "finished") setOver(null);
    };
    const onView = (v: unknown) => setView(v);
    const onOver = (payload: GameOverPayload) => setOver(payload);
    const onClosed = (reason: string) => {
      toast(reason || "Le salon a été fermé.");
      router.push("/jeux");
    };
    const onToast = (msg: string) => toast(msg);

    socket.on("lobby:state", onState);
    socket.on("game:view", onView);
    socket.on("game:over", onOver);
    socket.on("lobby:closed", onClosed);
    socket.on("toast", onToast);

    const doJoin = () => {
      socket.emit("lobby:join", code, (res) => {
        if (!res.ok) {
          toast(res.error ?? "Impossible de rejoindre.");
          router.push("/jeux");
        }
      });
    };

    if (socket.connected) doJoin();
    socket.on("connect", doJoin);

    return () => {
      socket.off("lobby:state", onState);
      socket.off("game:view", onView);
      socket.off("game:over", onOver);
      socket.off("lobby:closed", onClosed);
      socket.off("toast", onToast);
      socket.off("connect", doJoin);
      // On NE quitte PAS la table en changeant de page : le joueur garde son siège
      // (la table n'est plus éphémère). Il quitte explicitement via « Quitter ».
    };
  }, [socket, code, router, toast]);

  const setReady = useCallback((ready: boolean) => socket?.emit("lobby:setReady", ready), [socket]);
  const setGame = useCallback((gameId: string) => socket?.emit("lobby:setGame", gameId), [socket]);
  const sendAction = useCallback((a: GameAction) => socket?.emit("game:action", a), [socket]);
  const shuffleOrder = useCallback(() => socket?.emit("lobby:shuffleOrder"), [socket]);
  const reorder = useCallback((order: string[]) => socket?.emit("lobby:reorder", order), [socket]);
  const setVisibility = useCallback(
    (v: LobbyVisibility) => socket?.emit("lobby:setVisibility", v),
    [socket],
  );

  const start = useCallback(() => {
    socket?.emit("lobby:start", (res) => {
      if (!res.ok) toast(res.error ?? "Impossible de lancer.");
    });
  }, [socket, toast]);

  const leave = useCallback(() => {
    socket?.emit("lobby:leave");
    router.push("/jeux");
  }, [socket, router]);

  const me = snapshot?.members.find((m) => m.id === meId);

  return {
    snapshot,
    view,
    over,
    meId,
    ready: !!me?.ready,
    isHost: snapshot?.hostId === meId,
    setReady,
    setGame,
    start,
    leave,
    sendAction,
    shuffleOrder,
    reorder,
    setVisibility,
  };
}
