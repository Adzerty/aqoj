"use client";

import type { GameAction } from "@/lib/games/types";
import type { LobbyMemberView } from "@/lib/socket/events";
import type { TuPreferesView } from "@/lib/games/tu-preferes";
import type { ReactionView } from "@/lib/games/reaction";
import type { CodenamesView } from "@/lib/games/codenames";
import type { SeulementUnView } from "@/lib/games/seulement-un";
import type { FvDView } from "@/lib/games/fascist-vs-democrats";
import type { PowView } from "@/lib/games/pow";
import type { ToucanView } from "@/lib/games/des-de-toucan";
import type { PegreView } from "@/lib/games/la-pegre";
import type { FleurView } from "@/lib/games/cranes-fleuris";
import type { CWView } from "@/lib/games/cold-war";
import { TuPreferesGame } from "./tu-preferes-game";
import { ReactionGame } from "./reaction-game";
import { CodenamesGame } from "./codenames-game";
import { SeulementUnGame } from "./seulement-un-game";
import { FascistVsDemocratsGame } from "./fascist-vs-democrats-game";
import { PowGame } from "./pow-game";
import { DesDeToucanGame } from "./des-de-toucan-game";
import { LaPegreGame } from "./la-pegre-game";
import { CranesFleurisGame } from "./cranes-fleuris-game";
import { ColdWarGame } from "./cold-war-game";

export function GameStage({
  gameId,
  view,
  members,
  meId,
  sendAction,
}: {
  gameId: string;
  view: unknown;
  members: LobbyMemberView[];
  meId: string | null;
  sendAction: (a: GameAction) => void;
}) {
  if (!view) {
    return <p className="py-10 text-center text-muted">Préparation de la partie…</p>;
  }

  switch (gameId) {
    case "tu-preferes":
      return (
        <TuPreferesGame
          view={view as TuPreferesView}
          members={members}
          meId={meId}
          sendAction={sendAction}
        />
      );
    case "reaction":
      return (
        <ReactionGame
          view={view as ReactionView}
          members={members}
          meId={meId}
          sendAction={sendAction}
        />
      );
    case "codenames":
      return (
        <CodenamesGame
          view={view as CodenamesView}
          members={members}
          meId={meId}
          sendAction={sendAction}
        />
      );
    case "seulement-un":
      return (
        <SeulementUnGame
          view={view as SeulementUnView}
          members={members}
          meId={meId}
          sendAction={sendAction}
        />
      );
    case "fascist-vs-democrats":
      return (
        <FascistVsDemocratsGame
          view={view as FvDView}
          members={members}
          meId={meId}
          sendAction={sendAction}
        />
      );
    case "pow":
      return (
        <PowGame view={view as PowView} members={members} meId={meId} sendAction={sendAction} />
      );
    case "des-de-toucan":
      return (
        <DesDeToucanGame view={view as ToucanView} members={members} meId={meId} sendAction={sendAction} />
      );
    case "la-pegre":
      return (
        <LaPegreGame view={view as PegreView} members={members} meId={meId} sendAction={sendAction} />
      );
    case "cranes-fleuris":
      return (
        <CranesFleurisGame view={view as FleurView} members={members} meId={meId} sendAction={sendAction} />
      );
    case "cold-war":
      return (
        <ColdWarGame view={view as CWView} members={members} meId={meId} sendAction={sendAction} />
      );
    default:
      return <p className="py-10 text-center text-muted">Jeu non pris en charge.</p>;
  }
}
