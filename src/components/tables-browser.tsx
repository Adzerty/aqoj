"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TableSummary } from "@/lib/socket/events";
import { useSocket } from "./socket-provider";
import { accentOf } from "./games/accent";
import { ButtonLink, Button } from "./button";
import { Users } from "./icons";

export function TablesBrowser() {
  const { socket, connected } = useSocket();
  const router = useRouter();
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!socket) return;

    const onList = (list: TableSummary[]) => setTables(list);
    socket.on("tables:list", onList);

    const watch = () => socket.emit("tables:watch");
    if (socket.connected) watch();
    socket.on("connect", watch); // re-souscrit après reconnexion

    return () => {
      socket.off("tables:list", onList);
      socket.off("connect", watch);
      socket.emit("tables:unwatch");
    };
  }, [socket]);

  function joinByCode(e: React.FormEvent) {
    e.preventDefault();
    const c = code.toUpperCase().trim();
    if (c.length < 3) return;
    router.push(`/lobby/${c}`);
  }

  return (
    <div className="space-y-8">
      {/* Rejoindre par code + créer */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-end sm:justify-between">
        <form onSubmit={joinByCode} className="flex flex-1 flex-col gap-2 sm:flex-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="CODE"
            className="h-11 flex-1 rounded-xl border border-border bg-surface-2 px-4 font-mono text-lg uppercase tracking-[0.3em] outline-none transition-colors focus:border-primary"
          />
          <Button type="submit" size="md">
            Rejoindre
          </Button>
        </form>
        <ButtonLink href="/jeux" variant="secondary" size="md">
          Créer une table
        </ButtonLink>
      </div>

      {/* Liste des tables ouvertes */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Tables ouvertes</h2>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              connected ? "text-emerald-500" : "text-muted"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-muted"}`}
            />
            {connected ? "En direct" : "Connexion…"}
          </span>
        </div>

        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
            Aucune table publique pour le moment.
            <br />
            <span className="text-sm">Sois le premier à en ouvrir une !</span>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tables.map((t) => {
              const accent = accentOf(t.game?.accent ?? "sage");
              return (
                <div
                  key={t.code}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
                >
                  <span
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${accent.tile}`}
                  >
                    {t.game?.emoji ?? "🎲"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold leading-tight">
                      {t.game?.name ?? t.gameId}
                    </h3>
                    <p className="truncate text-xs text-muted">
                      Table de {t.hostName} ·{" "}
                      <span className="font-mono font-semibold tracking-wider">{t.code}</span>
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
