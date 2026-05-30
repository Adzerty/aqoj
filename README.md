# 🎲 AQOJ — À Quoi On Joue

Une web app pour lancer des **mini-jeux rapides entre potes** (pensée pour les vocaux Discord) :
on choisit un jeu, on crée un salon, on partage un code à 4 lettres, et c'est parti. Tout est
synchronisé en temps réel.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** — design dark-first avec bascule de thème
- **Auth.js (NextAuth v5)** — connexion **Discord OAuth** (+ mode invité en dev)
- **Prisma + PostgreSQL** (même base en dev et en prod, pour la parité)
- **Socket.IO** sur un serveur Node custom (`server.ts`) — tables & parties temps réel
- Un **moteur de jeu générique** (`src/lib/games`) pour coder de nouveaux jeux facilement

> 🚀 **Mise en production :** voir **[DEPLOY.md](./DEPLOY.md)** (VPS + Docker + Postgres + Caddy).

## Démarrer en local

Il te faut un **PostgreSQL local**. Le plus simple, via Docker :

```bash
docker run --name aqoj-pg -e POSTGRES_USER=aqoj -e POSTGRES_PASSWORD=aqoj \
  -e POSTGRES_DB=aqoj -p 5432:5432 -d postgres:16-alpine
```

Puis :

```bash
cp .env.example .env  # DATABASE_URL pointe déjà vers le Postgres ci-dessus
pnpm install          # installe + génère le client Prisma
pnpm db:migrate:dev   # applique les migrations à la base
pnpm dev              # lance Next + Socket.IO sur http://localhost:3000
```

Par défaut, le **login invité (dev)** est activé (`ENABLE_DEV_GUEST=true` dans `.env`) : tu peux
jouer immédiatement sans configurer Discord. Ouvre plusieurs onglets/navigateurs pour simuler
plusieurs joueurs.

### Activer la connexion Discord

1. Crée une application sur https://discord.com/developers/applications
2. Onglet **OAuth2** → ajoute l'URL de redirection :
   `http://localhost:3000/api/auth/callback/discord`
3. Renseigne dans `.env` :
   ```
   AUTH_DISCORD_ID="..."
   AUTH_DISCORD_SECRET="..."
   ```
4. Passe `ENABLE_DEV_GUEST="false"` pour ne garder que Discord.

## Architecture

```
server.ts                 Serveur custom : Next + Socket.IO
src/
  auth.ts                 Config Auth.js (Discord + invité dev)
  lib/
    games/                Moteur de jeu générique + jeux
      types.ts            Interface GameDefinition (logique server-authoritative)
      registry.ts         Registre central des jeux
      tu-preferes/        Jeu : dilemmes & votes
      reaction/           Jeu : buzzer de réflexes
    socket/events.ts      Contrat d'événements client ⇄ serveur
    socket-token.ts       Jeton signé (HMAC) pour authentifier les sockets
  server/
    lobby.ts              Gestionnaire de lobbies en mémoire + boucle de jeu
    io.ts                 Mise en place Socket.IO
    results.ts            Persistance des résultats & stats
  app/                    Pages (accueil, /jeux, /lobby/[code], /profil, /login)
  components/             UI (navbar, cartes, écrans de jeu, providers…)
```

### Modèle temps réel (server-authoritative)

Les clients n'envoient que des **actions** (`{ type, payload }`). Le serveur applique le `reducer`
du jeu, calcule le nouvel état, puis renvoie à **chaque joueur** une **vue filtrée** (`viewFor`)
qui masque les infos secrètes. Les phases minutées (chrono de vote, délai avant le « GO »…) sont
gérées par des **timers** retournés par le reducer.

## Ajouter un nouveau jeu

1. Crée `src/lib/games/<mon-jeu>/index.ts` exportant une `GameDefinition` :

   ```ts
   export const monJeu: GameDefinition<State, View> = {
     id: "mon-jeu",
     name: "Mon Jeu",
     // …métadonnées (emoji, gradient, min/maxPlayers, tags…)
     createInitialState(ctx) { /* état de départ */ },
     reducer(state, action, ctx) { /* logique pure, renvoie { state, timers? } */ },
     viewFor(state, playerId, players) { /* projection par joueur */ },
     isFinished(state) { /* true quand la partie est finie */ },
     getResults(state, players) { /* classement final */ },
   };
   ```

2. Enregistre-le dans `src/lib/games/registry.ts`.
3. Ajoute son rendu dans `src/components/games/` et branche-le dans `game-stage.tsx`.

Aucune autre plomberie : lobby, réseau, scoring et stats sont génériques.

## Scripts

| Commande          | Effet                                            |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | Serveur de dev (Next + Socket.IO, hot reload)    |
| `pnpm build`      | Build de production Next                          |
| `pnpm start`      | Serveur de production (`server.ts`)              |
| `pnpm db:push`    | Applique le schéma Prisma à la base               |
| `pnpm db:studio`  | Ouvre Prisma Studio                               |
