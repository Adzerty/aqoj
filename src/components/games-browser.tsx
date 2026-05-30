"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GameMeta } from "@/lib/games/types";
import { useSocket } from "./socket-provider";
import { useToast } from "./toast";
import { GameCard } from "./game-card";
import { Button } from "./button";

export function GamesBrowser({ metas }: { metas: GameMeta[] }) {
  const { socket, connected } = useSocket();
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState<string | null>(null);
  const [code, setCode] = useState("");

  function create(gameId: string) {
    if (!socket) {
      toast("Connexion au serveur en cours…");
      return;
    }
    setCreating(gameId);
    socket.emit("lobby:create", gameId, (res) => {
      setCreating(null);
      if (res.ok && res.code) router.push(`/lobby/${res.code}`);
      else toast(res.error ?? "Impossible de créer la table.");
    });
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.toUpperCase().trim();
    if (c.length < 3) {
      toast("Entre un code valide.");
      return;
    }
    router.push(`/lobby/${c}`);
  }

  return (
    <div className="space-y-10">
      {/* Rejoindre */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="font-bold">Rejoindre une table</h2>
        <p className="mb-4 text-sm text-muted">Un pote t&apos;a filé un code ? Entre-le ici.</p>
        <form onSubmit={join} className="flex flex-col gap-2 sm:flex-row">
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
      </div>

      {/* Créer */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Créer une table</h2>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              connected ? "text-emerald-400" : "text-muted"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-muted"}`}
            />
            {connected ? "Connecté" : "Connexion…"}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metas.map((m) => (
            <GameCard
              key={m.id}
              meta={m}
              footer={
                <Button
                  className="w-full"
                  disabled={creating !== null}
                  onClick={() => create(m.id)}
                >
                  {creating === m.id ? "Création…" : "Créer une table"}
                </Button>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
