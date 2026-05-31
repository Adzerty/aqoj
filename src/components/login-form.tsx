"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { prepareEmailLogin } from "@/app/login/actions";
import { Button } from "./button";
import { DiceMark, Discord } from "./icons";

export function LoginForm({
  emailEnabled,
  discordEnabled,
  guestEnabled,
}: {
  emailEnabled: boolean;
  discordEnabled: boolean;
  guestEnabled: boolean;
}) {
  const [email, setEmail] = useState("");
  const [pseudo, setPseudo] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState<"email" | "discord" | "guest" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("email");
    const prep = await prepareEmailLogin(email, pseudo);
    if (!prep.ok) {
      setError(prep.error ?? "Erreur.");
      setLoading(null);
      return;
    }
    const res = await signIn("nodemailer", {
      email: email.trim().toLowerCase(),
      redirect: false,
      redirectTo: "/jeux",
    });
    setLoading(null);
    if (res?.error) {
      setError("Impossible d'envoyer l'email. Réessaie dans un instant.");
      return;
    }
    setSentTo(email.trim().toLowerCase());
  }

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

        {sentTo ? (
          // ───── État : email envoyé ─────
          <div className="text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-2xl">
              📧
            </div>
            <p className="font-semibold">Lien envoyé !</p>
            <p className="mt-1 text-sm text-muted">
              Un lien de connexion a été envoyé à <b className="text-foreground">{sentTo}</b>. Ouvre
              ta boîte mail et clique dessus pour te connecter.
            </p>
            <button
              onClick={() => {
                setSentTo(null);
                setError(null);
              }}
              className="mt-4 text-sm font-semibold text-primary hover:underline"
            >
              ← Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <>
            {/* ───── Connexion par email (lien magique) ───── */}
            {emailEnabled && (
              <form onSubmit={onEmail} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@email.com"
                  className="h-11 w-full rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none transition-colors focus:border-primary"
                />
                <input
                  required
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  maxLength={24}
                  placeholder="Ton pseudo"
                  className="h-11 w-full rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none transition-colors focus:border-primary"
                />
                <Button type="submit" size="lg" className="w-full" disabled={loading !== null}>
                  {loading === "email" ? "Envoi…" : "Recevoir mon lien de connexion"}
                </Button>
                <p className="text-center text-xs text-muted">
                  Pas de mot de passe — un lien sécurisé arrive dans ta boîte mail.
                </p>
              </form>
            )}

            {error && <p className="mt-3 text-center text-sm text-rose-500">{error}</p>}

            {/* ───── Discord ───── */}
            {discordEnabled && (
              <>
                {emailEnabled && (
                  <div className="my-5 flex items-center gap-3 text-xs text-muted">
                    <span className="h-px flex-1 bg-border" />
                    ou
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                <Button
                  className="w-full bg-[#5865F2] text-white hover:brightness-[1.06]"
                  size="lg"
                  disabled={loading !== null}
                  onClick={() => {
                    setLoading("discord");
                    signIn("discord", { redirectTo: "/jeux" });
                  }}
                >
                  <Discord size={20} />
                  {loading === "discord" ? "Redirection…" : "Continuer avec Discord"}
                </Button>
              </>
            )}

            {/* ───── Invité (dev) ───── */}
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
          </>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        En continuant, tu acceptes de t&apos;amuser.
      </p>
    </div>
  );
}
