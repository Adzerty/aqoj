import { type GameDefinition, type GameMeta, toMeta } from "./types";
import { tuPreferes } from "./tu-preferes";
import { reaction } from "./reaction";
import { codenames } from "./codenames";
import { seulementUn } from "./seulement-un";
import { fascistVsDemocrats } from "./fascist-vs-democrats";
import { pow } from "./pow";
import { desDeToucan } from "./des-de-toucan";
import { laPegre } from "./la-pegre";
import { cranesFleuris } from "./cranes-fleuris";

// Registre central de tous les jeux. Ajouter un jeu = l'importer et l'ajouter ici.
const GAMES: GameDefinition[] = [
  tuPreferes,
  reaction,
  codenames,
  seulementUn,
  fascistVsDemocrats,
  pow,
  desDeToucan,
  laPegre,
  cranesFleuris,
];

const BY_ID = new Map<string, GameDefinition>(GAMES.map((g) => [g.id, g]));

export function getGame(id: string): GameDefinition | undefined {
  return BY_ID.get(id);
}

export function listGames(): GameDefinition[] {
  return GAMES;
}

/** Métadonnées sérialisables (sûres à envoyer au client / au réseau). */
export function listGameMetas(): GameMeta[] {
  return GAMES.map(toMeta);
}

export function getGameMeta(id: string): GameMeta | undefined {
  const g = BY_ID.get(id);
  return g ? toMeta(g) : undefined;
}
