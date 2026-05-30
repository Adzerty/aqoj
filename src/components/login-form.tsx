"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "./button";
import { DiceMark, Discord } from "./icons";

export function LoginForm({
  discordEnabled,
  guestEnabled,
}: {
  discordEnabled: boolean;
  guestEnabled: boolean;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState<"discord" | "guest" | null>(null);

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <DiceMark size={34} />
          </div>
          <h1 className="text-xl font-bold">Bienvenue sur aqoj</h1>
          <p className="mt-1 text-sm text-muted">Rejoins la partie en quelques secondes.</p>
        </div>

        <Button
          className="w-full bg-[#5865F2] text-white hover:brightness-[1.06]"
          size="lg"
          disabled={!discordEnabled || loading !== null}
          onClick={() => {
            setLoading("discord");
            signIn("discord", { redirectTo: "/jeux" });
          }}
        >
          <Discord size={20} />
          {loading === "discord" ? "Redirection…" : "Continuer avec Discord"}
        </Button>
        {!discordEnabled && (
          <p className="mt-2 text-center text-xs text-muted">
            Discord non configuré (ajoute tes identifiants OAuth dans <code>.env</code>).
          </p>
        )}

        {guestEnabled && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" />
              ou en invité (dev)
              <span className="h-px flex-1 bg-border" />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLoading("guest");
                signIn("guest", { name: name.trim() || "Invité", redirectTo: "/jeux" });
              }}
              className="space-y-3"
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder="Ton pseudo"
                className="h-11 w-full rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none transition-colors focus:border-primary"
              />
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={loading !== null}
              >
                {loading === "guest" ? "Connexion…" : "Entrer en invité"}
              </Button>
            </form>
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        En continuant, tu acceptes de t&apos;amuser.
      </p>
    </div>
  );
}
