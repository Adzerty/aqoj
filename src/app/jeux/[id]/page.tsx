import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navbar } from "@/components/navbar";
import { GameFicheActions } from "@/components/game-fiche-actions";
import { accentOf } from "@/components/games/accent";
import { Clock, Users } from "@/components/icons";
import { getGameMeta } from "@/lib/games/registry";

export default async function GameFichePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const meta = getGameMeta(id);
  if (!meta) notFound();

  const accent = accentOf(meta.accent);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/jeux" className="text-sm font-medium text-muted transition-colors hover:text-foreground">
          ← Tous les jeux
        </Link>

        {/* En-tête */}
        <header className="mt-4 flex items-start gap-4">
          <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-4xl ${accent.tile}`}>
            {meta.emoji}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{meta.name}</h1>
            <p className="text-muted">{meta.tagline}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-medium text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} />
                {meta.minPlayers}–{meta.maxPlayers} joueurs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} />~{meta.estimatedMinutes} min
              </span>
              {meta.tags.map((t) => (
                <span key={t} className="rounded-full bg-surface-2 px-2.5 py-0.5">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </header>

        {/* Description */}
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Le jeu en bref</h2>
          <p className="leading-relaxed text-foreground">{meta.description}</p>
        </section>

        {/* Règles */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Comment on joue</h2>
          <ol className="space-y-2.5">
            {meta.rules.map((rule, i) => (
              <li key={i} className="flex gap-3">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${accent.tile}`}
                >
                  {i + 1}
                </span>
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Créer / rejoindre */}
        <section className="mt-10 border-t border-border pt-8">
          <GameFicheActions gameId={meta.id} />
        </section>
      </main>
    </>
  );
}
