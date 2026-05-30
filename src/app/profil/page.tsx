import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/navbar";
import { Avatar } from "@/components/avatar";
import { accentOf } from "@/components/games/accent";
import { getGameMeta } from "@/lib/games/registry";

export default async function ProfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const recent = await prisma.gameResultPlayer.findMany({
    where: { userId: user.id },
    include: { result: true },
    orderBy: { result: { createdAt: "desc" } },
    take: 12,
  });

  const winrate = user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0;

  const stats = [
    { label: "Parties jouées", value: user.gamesPlayed },
    { label: "Victoires", value: user.gamesWon },
    { label: "Taux de victoire", value: `${winrate}%` },
    { label: "Points cumulés", value: user.totalScore },
  ];

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {/* En-tête profil */}
        <div className="mb-8 flex items-center gap-4">
          <Avatar name={user.name ?? "Joueur"} image={user.image} size={72} ring />
          <div>
            <h1 className="text-2xl font-extrabold">{user.name ?? "Joueur"}</h1>
            <p className="text-sm text-muted">
              Membre depuis{" "}
              {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
                user.createdAt,
              )}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-3xl font-extrabold tabular-nums">{s.value}</div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Historique */}
        <h2 className="mb-3 text-lg font-bold">Dernières parties</h2>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            Aucune partie pour l&apos;instant. Lance-toi !
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((r) => {
              const meta = getGameMeta(r.result.gameId);
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg ${
                      meta ? accentOf(meta.accent).tile : "bg-surface-2"
                    }`}
                  >
                    {meta?.emoji ?? "🎲"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {meta?.name ?? r.result.gameId}
                    </div>
                    <div className="text-xs text-muted">
                      {new Intl.DateTimeFormat("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(r.result.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      {r.won ? "🏆 Victoire" : `${ordinal(r.rank)}`}
                    </div>
                    <div className="font-mono text-xs text-muted">{r.score} pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function ordinal(n: number): string {
  if (n === 1) return "1er";
  return `${n}e`;
}
