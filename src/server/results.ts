import { prisma } from "../lib/prisma";
import { aqojPointsFor, type GamePlayer, type GameResultEntry } from "../lib/games/types";

// Enregistre une partie terminée et met à jour les stats agrégées des joueurs.
export async function persistResult(
  gameId: string,
  lobbyCode: string,
  results: GameResultEntry[],
  participants: GamePlayer[],
) {
  const byId = new Map(participants.map((p) => [p.id, p]));

  // AQOJPoints : monnaie gagnée selon le classement (à partir de 3 joueurs).
  const points = aqojPointsFor(results, participants.length);

  // Quels userId existent réellement en base (les invités en ont un aussi).
  const ids = results.map((r) => r.playerId);
  const known = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const knownIds = new Set(known.map((u) => u.id));

  await prisma.$transaction([
    prisma.gameResult.create({
      data: {
        gameId,
        lobbyCode,
        players: {
          create: results.map((r) => ({
            userId: knownIds.has(r.playerId) ? r.playerId : null,
            name: byId.get(r.playerId)?.name ?? "Joueur",
            score: r.score,
            rank: r.rank,
            won: r.won,
            points: points[r.playerId] ?? 0,
          })),
        },
      },
    }),
    ...results
      .filter((r) => knownIds.has(r.playerId))
      .map((r) =>
        prisma.user.update({
          where: { id: r.playerId },
          data: {
            gamesPlayed: { increment: 1 },
            gamesWon: { increment: r.won ? 1 : 0 },
            totalScore: { increment: r.score },
            aqojPoints: { increment: points[r.playerId] ?? 0 },
          },
        }),
      ),
  ]);
}
