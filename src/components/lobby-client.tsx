"use client";

import { useState } from "react";
import type { GameMeta } from "@/lib/games/types";
import { useLobby } from "@/hooks/use-lobby";
import { useToast } from "./toast";
import { Avatar } from "./avatar";
import { Button } from "./button";
import { Logo } from "./logo";
import { GameStage } from "./games/game-stage";
import { accentOf } from "./games/accent";
import { TableRoster } from "./table-roster";
import { Globe, Lock, Shuffle } from "./icons";

export function LobbyClient({ code, metas }: { code: string; metas: GameMeta[] }) {
  const lobby = useLobby(code);
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const { snapshot, view, over, meId, isHost, ready } = lobby;

  function copyCode() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      toast("Code copié !");
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!snapshot) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        Connexion à la table {code}…
      </div>
    );
  }

  const game = snapshot.game;
  const connectedCount = snapshot.members.filter((m) => m.connected).length;
  const canStart = game ? connectedCount >= game.minPlayers : false;
  const inGame = snapshot.status === "in_game";

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:px-6">
      {/* Barre haute */}
      <div className="mb-5 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 transition-colors hover:border-primary"
            title="Copier le code"
          >
            <span className="text-xs text-muted">Code</span>
            <span className="font-mono text-lg font-bold tracking-[0.2em]">{code}</span>
            <span className="text-xs">{copied ? "✓" : "📋"}</span>
          </button>
          <Button variant="danger" size="sm" onClick={lobby.leave}>
            Quitter
          </Button>
        </div>
      </div>

      {/* Écran de fin de partie */}
      {over && snapshot.status === "finished" && (
        <div className="animate-pop mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="bg-primary px-6 py-4 text-center text-primary-fg">
            <p className="text-sm font-medium uppercase tracking-wide opacity-90">Fin de partie</p>
            <p className="text-2xl font-extrabold">
              {over.results.find((r) => r.won)?.name ?? "Égalité"} {over.results.some((r) => r.won) ? "gagne ! 🏆" : ""}
            </p>
          </div>
          <div className="space-y-1.5 p-4">
            {over.results.map((r, i) => (
              <div
                key={r.playerId}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  r.playerId === meId ? "border-primary/60 bg-primary/5" : "border-border"
                }`}
              >
                <span className="w-6 text-center font-bold text-muted">
                  {["🥇", "🥈", "🥉"][i] ?? i + 1}
                </span>
                <Avatar name={r.name} image={r.image} size={30} />
                <span className="flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="font-mono text-sm font-bold">{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Partie en cours */}
      {inGame ? (
        <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
          {game && (
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted">
              <span>{game.emoji}</span>
              {game.name}
            </div>
          )}
          <GameStage
            gameId={snapshot.gameId}
            view={view}
            members={snapshot.members}
            meId={meId}
            sendAction={lobby.sendAction}
          />
        </div>
      ) : (
        <>
          {/* Jeu sélectionné */}
          {game && (
            <div className="mb-5 rounded-2xl border border-border bg-surface">
              <div className="flex items-center gap-4 p-5">
                <span
                  className={`grid h-14 w-14 place-items-center rounded-2xl text-3xl ${accentOf(game.accent).tile}`}
                >
                  {game.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold">{game.name}</h2>
                  <p className="truncate text-sm text-muted">{game.tagline}</p>
                </div>
                <span className="hidden text-xs text-muted sm:block">
                  {game.minPlayers}–{game.maxPlayers} joueurs
                </span>
              </div>
            </div>
          )}

          {/* Sélecteur de jeu (hôte) */}
          {isHost && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-bold text-muted">Changer de jeu</p>
              <div className="flex flex-wrap gap-2">
                {metas.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => lobby.setGame(m.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      m.id === snapshot.gameId
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface hover:border-primary/50"
                    }`}
                  >
                    <span>{m.emoji}</span>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ordre de la table */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-muted">
                Ordre de la table · {connectedCount}
                {game ? `/${game.maxPlayers}` : ""}
              </p>
              {isHost && (
                <button
                  onClick={lobby.shuffleOrder}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-foreground/20 hover:text-foreground"
                >
                  <Shuffle size={14} />
                  Mélanger
                </button>
              )}
            </div>

            <TableRoster
              members={snapshot.members}
              meId={meId}
              isHost={isHost}
              canReorder={!inGame}
              onReorder={lobby.reorder}
            />

            {isHost ? (
              <p className="mt-2 text-xs text-muted">
                Glisse les joueurs (ou les flèches) pour fixer l&apos;ordre — il décide des tours et
                des équipes dans les jeux concernés.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted">
                Le maître de table fixe l&apos;ordre des joueurs.
              </p>
            )}
          </div>

          {/* Visibilité de la table (maître de table) */}
          {isHost && (
            <div className="mb-5 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                {snapshot.visibility === "public" ? (
                  <Globe size={16} />
                ) : (
                  <Lock size={16} />
                )}
                <span className="font-semibold">
                  {snapshot.visibility === "public" ? "Table publique" : "Table privée"}
                </span>
                <span className="hidden text-xs text-muted sm:inline">
                  {snapshot.visibility === "public"
                    ? "· visible dans la liste des tables"
                    : "· accessible seulement avec le code"}
                </span>
              </div>
              <button
                onClick={() =>
                  lobby.setVisibility(snapshot.visibility === "public" ? "private" : "public")
                }
                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-foreground/20 hover:text-foreground"
              >
                {snapshot.visibility === "public" ? "Rendre privée" : "Rendre publique"}
              </button>
            </div>
          )}

          {/* Contrôles */}
          <div className="sticky bottom-4 rounded-2xl border border-border bg-surface p-3 shadow-md shadow-black/5">
            {isHost ? (
              <div className="flex items-center gap-3">
                <Button
                  className="flex-1"
                  size="lg"
                  disabled={!canStart}
                  onClick={lobby.start}
                >
                  {over ? "Rejouer" : "Lancer la partie"}
                </Button>
                {!canStart && game && (
                  <span className="text-xs text-muted">
                    Min. {game.minPlayers} joueurs
                  </span>
                )}
              </div>
            ) : (
              <Button
                className="w-full"
                size="lg"
                variant={ready ? "secondary" : "primary"}
                onClick={() => lobby.setReady(!ready)}
              >
                {ready ? "✓ Tu es prêt" : "Je suis prêt"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
