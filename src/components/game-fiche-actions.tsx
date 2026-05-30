"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TableSummary } from "@/lib/socket/events";
import { useSocket } from "./socket-provider";
import { useToast } from "./toast";
import { Button } from "./button";
import { Avatar } from "./avatar";
import { Users } from "./icons";

export function GameFicheActions({ gameId }: { gameId: string }) {
  const { socket, connected } = useSocket();
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [tables, setTables] = useState<TableSummary[]>([]);

  useEffect(() => {
    if (!socket) return;
    const onList = (list: TableSummary[]) => setTables(list.filter((t) => t.gameId === gameId));
    socket.on("tables:list", onList);
    const watch = () => socket.emit("tables:watch");
    if (socket.connected) watch();
    socket.on("connect", watch);
    return () => {
      socket.off("tables:list", onList);
      socket.off("connect", watch);
      socket.emit("tables:unwatch");
    };
  }, [socket, gameId]);

  function create() {
    if (!socket) {
      toast("Connexion au serveur en cours…");
      return;
    }
    setCreating(true);
    socket.emit("lobby:create", gameId, (res) => {
      setCreating(false);
      if (res.ok && res.code) router.push(`/lobby/${res.code}`);
      else toast(res.error ?? "Impossible de créer la table.");
    });
  }

  return (
    <div className="space-y-5">
      {/* Créer */}
      <Button size="lg" className="w-full sm:w-auto" disabled={creating} onClick={create}>
        {creating ? "Création…" : "Créer une table"}
      </Button>

      {/* Tables ouvertes pour ce jeu */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Tables ouvertes</h2>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              connected ? "text-emerald-500" : "text-muted"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-muted"}`} />
            {connected ? "En direct" : "Connexion…"}
          </span>
        </div>

        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            Aucune table ouverte pour ce jeu. Lance-en une !
          </div>
        ) : (
          <div className="space-y-2">
            {tables.map((t) => (
              <div
                key={t.code}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
              >
                <Avatar name={t.hostName} image={null} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">Table de {t.hostName}</p>
                  <p className="truncate text-xs text-muted">
                    Code <span className="font-mono font-semibold tracking-wider">{t.code}</span>
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                  <Users size={14} />
                  {t.playerCount}/{t.maxPlayers}
                </span>
                <Button size="sm" onClick={() => router.push(`/lobby/${t.code}`)}>
                  Rejoindre
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
