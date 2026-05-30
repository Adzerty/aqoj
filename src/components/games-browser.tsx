"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GameMeta } from "@/lib/games/types";
import { useToast } from "./toast";
import { GameCard } from "./game-card";
import { Button } from "./button";
import { ArrowRight } from "./icons";

export function GamesBrowser({ metas }: { metas: GameMeta[] }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState("");

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
      {/* Rejoindre par code */}
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

      {/* Les jeux — chaque carte mène à sa fiche (description, règles, tables) */}
      <div>
        <h2 className="mb-1 text-xl font-bold">Les jeux</h2>
        <p className="mb-4 text-sm text-muted">
          Clique un jeu pour voir sa fiche, ses règles et créer une table.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metas.map((m) => (
            <Link key={m.id} href={`/jeux/${m.id}`} className="block">
              <GameCard
                meta={m}
                footer={
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    Voir la fiche & créer <ArrowRight size={15} />
                  </span>
                }
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
