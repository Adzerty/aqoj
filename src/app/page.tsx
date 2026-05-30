import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { GameCard } from "@/components/game-card";
import { ButtonLink } from "@/components/button";
import { ArrowRight } from "@/components/icons";
import { listGameMetas } from "@/lib/games/registry";

export default function Home() {
  const games = listGameMetas();

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        {/* Hero */}
        <section className="flex flex-col items-center pt-16 pb-14 text-center sm:pt-24">
          <span className="animate-in mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Pensé pour vos vocaux entre potes
          </span>
          <h1 className="animate-in max-w-3xl text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            On joue à quoi ?{" "}
            <span className="text-primary">La réponse est là.</span>
          </h1>
          <p className="animate-in mt-5 max-w-xl text-balance text-lg leading-relaxed text-muted">
            Choisis un jeu, crée un salon, partage le code. Tes potes rejoignent en un clic et
            c&apos;est parti. Des parties rapides, zéro prise de tête.
          </p>
          <div className="animate-in mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/jeux" size="lg">
              Lancer une partie
              <ArrowRight size={18} />
            </ButtonLink>
            <ButtonLink href="#jeux" size="lg" variant="secondary">
              Voir les jeux
            </ButtonLink>
          </div>
        </section>

        {/* Jeux */}
        <section id="jeux" className="scroll-mt-20 pb-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold">Les jeux</h2>
              <p className="text-sm text-muted">Et il y en aura bien plus bientôt.</p>
            </div>
            <Link
              href="/jeux"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              Tout voir <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => (
              <Link key={g.id} href="/jeux" className="block">
                <GameCard meta={g} />
              </Link>
            ))}
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="border-t border-border py-16">
          <h2 className="mb-10 text-center text-2xl font-bold">Comment ça marche</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { n: "1", t: "Choisis un jeu", d: "Parcours la liste et lance le salon qui te tente." },
              { n: "2", t: "Partage le code", d: "Un code à 4 lettres, tes amis rejoignent direct." },
              { n: "3", t: "Jouez !", d: "Tout est synchronisé en temps réel. Que le meilleur gagne." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-surface p-6">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 font-bold text-primary">
                  {s.n}
                </div>
                <h3 className="mt-4 font-bold">{s.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        aqoj — à quoi on joue · fait pour jouer entre potes
      </footer>
    </>
  );
}
