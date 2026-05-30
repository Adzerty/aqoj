"use client";

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

          <ThemeToggle />

          {status === "authenticated" ? (
            <div className="flex items-center gap-2">
              <Link href="/profil" className="flex items-center gap-2">
                <Avatar name={session.user.name ?? "Joueur"} image={session.user.image} size={34} />
              </Link>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Quitter
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
