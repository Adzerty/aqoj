"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { Logo } from "./logo";
import { Avatar } from "./avatar";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./button";
import { useSocket } from "./socket-provider";

export function Navbar() {
  const { data: session, status } = useSession();
  const { currentTable } = useSocket();
  const points = useAqojPoints(status === "authenticated");

  const linkCls =
    "hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground sm:block";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/jeux" className={linkCls}>
            Jeux
          </Link>
          <Link href="/tables" className={linkCls}>
            Tables
          </Link>
          {status === "authenticated" && currentTable && (
            <Link
              href={`/lobby/${currentTable}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Ma table
            </Link>
          )}
          {status === "authenticated" && (
            <Link href="/profil" className={linkCls}>
              Profil
            </Link>
          )}

          {status === "authenticated" && points !== null && (
            <Link
              href="/profil"
              title="Tes AQOJPoints"
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-sm font-bold text-amber-600 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
            >
              <span>🪙</span>
              <span className="tabular-nums">{points}</span>
            </Link>
          )}

          <ThemeToggle />

          {status === "authenticated" ? (
            <div className="flex items-center gap-2">
              <Link href="/profil" className="flex items-center gap-2">
                <Avatar name={session.user.name ?? "Joueur"} image={session.user.image} size={34} />
              </Link>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Se déconnecter
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => signIn()}>
              Se connecter
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

// Solde d'AQOJPoints du joueur connecté. Rafraîchi au montage et à chaque retour
// sur l'onglet (le solde change après une partie terminée dans le lobby).
function useAqojPoints(enabled: boolean): number | null {
  const [points, setPoints] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!enabled) return;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.aqojPoints === "number") setPoints(d.aqojPoints);
      })
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled, refresh]);

  // Le badge n'est de toute façon affiché qu'une fois authentifié.
  return enabled ? points : null;
}
