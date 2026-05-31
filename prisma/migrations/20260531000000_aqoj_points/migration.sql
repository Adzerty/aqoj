-- AQOJPoints : monnaie du jeu gagnée en fin de partie (3 joueurs ou plus).

-- AlterTable
ALTER TABLE "User" ADD COLUMN "aqojPoints" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GameResultPlayer" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0;
