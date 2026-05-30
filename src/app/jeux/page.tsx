import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navbar } from "@/components/navbar";
import { GamesBrowser } from "@/components/games-browser";
import { listGameMetas } from "@/lib/games/registry";

export default async function JeuxPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const metas = listGameMetas();

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-3xl font-extrabold tracking-tight">Choisis ton jeu</h1>
        <p className="mb-8 text-muted">Crée un salon ou rejoins celui d&apos;un ami.</p>
        <GamesBrowser metas={metas} />
      </main>
    </>
  );
}
