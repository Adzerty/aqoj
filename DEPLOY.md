# 🚀 Déployer AQOJ en production (VPS + Docker + Postgres + Caddy)

Ce guide met AQOJ en ligne sur **ton propre VPS**, avec :

- **Docker Compose** : 3 services — `app` (Next + Socket.IO), `db` (PostgreSQL), `caddy` (reverse proxy + HTTPS automatique).
- **PostgreSQL** persistant (volume Docker).
- **Caddy** : HTTPS Let's Encrypt automatique + relai WebSocket (Socket.IO).

> ⚠️ **Une seule instance.** Les tables/lobbies vivent **en mémoire** dans le serveur.
> On ne lance donc **qu'un seul conteneur `app`** (pas de scaling horizontal sans Redis).
> C'est parfait pour un lancement ; voir « Aller plus loin » en bas pour scaler.

---

## 0. Prérequis

- Un **VPS** (Hetzner, DigitalOcean, OVH…) sous Ubuntu/Debian, avec accès `ssh root@IP`.
- Un **nom de domaine** que tu contrôles (ex. `aqoj.exemple.com`).
- Le code poussé sur un **dépôt Git** (GitHub/GitLab). Si ce n'est pas fait, en local :
  ```bash
  git init && git add -A && git commit -m "AQOJ"
  git remote add origin git@github.com:toi/aqoj.git
  git push -u origin main
  ```

---

## 1. DNS — pointer le domaine vers le VPS

Chez ton registrar / DNS, crée un enregistrement **A** :

| Type | Nom (hôte)      | Valeur (cible) |
| ---- | --------------- | -------------- |
| A    | `aqoj` (ou `@`) | `IP_DU_VPS`    |

Attends que ça se propage (`ping aqoj.exemple.com` doit renvoyer l'IP du VPS).

---

## 2. Discord — autoriser l'URL de prod

Sur https://discord.com/developers/applications → ton application → **OAuth2** :

1. Dans **Redirects**, ajoute :
   ```
   https://aqoj.exemple.com/api/auth/callback/discord
   ```
2. Note le **Client ID** et le **Client Secret** (onglet OAuth2) — ils iront dans `.env`.

> Tu peux garder l'URL `http://localhost:3000/...` en plus pour continuer à dev en local.

---

## 3. Installer Docker sur le VPS

Connecte-toi : `ssh root@IP_DU_VPS`, puis :

```bash
# Docker + plugin compose (script officiel)
curl -fsSL https://get.docker.com | sh

# Vérifie
docker --version
docker compose version
```

(Optionnel mais conseillé) **pare-feu** : n'ouvre que SSH + HTTP + HTTPS :

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

---

## 4. Récupérer le code

```bash
cd /opt
git clone https://github.com/toi/aqoj.git
cd aqoj
```

---

## 5. Configurer le `.env`

```bash
cp .env.production.example .env
# Génère un secret d'auth solide :
openssl rand -base64 33
nano .env
```

Remplis **au minimum** :

| Variable                                | Valeur                                                            |
| --------------------------------------- | ---------------------------------------------------------------- |
| `DOMAIN`                                | `aqoj.exemple.com`                                                |
| `ACME_EMAIL`                            | ton email (certificats Let's Encrypt)                            |
| `POSTGRES_PASSWORD`                     | un mot de passe fort                                             |
| `DATABASE_URL`                          | `postgresql://aqoj:<le-même-mdp>@db:5432/aqoj`                   |
| `AUTH_SECRET`                           | la sortie de `openssl rand -base64 33`                           |
| `AUTH_URL` / `NEXTAUTH_URL`             | `https://aqoj.exemple.com`                                        |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | depuis le portail Discord                                      |

> ⚠️ Le mot de passe dans `DATABASE_URL` **doit** être identique à `POSTGRES_PASSWORD`.
> `ENABLE_DEV_GUEST` reste `false` en prod (pas de login invité).

---

## 6. Lancer 🚀

```bash
docker compose up -d --build
```

Ce que ça fait :

1. **build** l'image de l'app (install + `next build`).
2. démarre **Postgres** (volume persistant `pgdata`).
3. au démarrage, l'app applique les **migrations Prisma** (`prisma migrate deploy`).
4. **Caddy** obtient le certificat HTTPS et relaie le trafic vers l'app.

Ouvre **https://aqoj.exemple.com** 🎉

---

## 7. Vérifier

```bash
docker compose ps            # les 3 services "Up"
docker compose logs -f app   # logs de l'app (Ctrl-C pour quitter)
docker compose logs -f caddy # vérifie l'obtention du certificat
```

Teste : connexion Discord, création d'une table, partie à plusieurs onglets.

---

## 8. Mettre à jour (redéployer)

Quand tu pushes du nouveau code :

```bash
cd /opt/aqoj
git pull
docker compose up -d --build
```

Les migrations en attente sont appliquées automatiquement au redémarrage.

---

## 9. Faire évoluer le schéma de base

Le schéma est versionné via **migrations Prisma**. Quand tu modifies `prisma/schema.prisma` :

1. **En local** (avec un Postgres local), génère la migration :
   ```bash
   pnpm db:migrate:dev --name decris_le_changement
   ```
2. **Commit** le dossier `prisma/migrations/` généré, puis `git push`.
3. **En prod**, `git pull && docker compose up -d --build` : `prisma migrate deploy`
   applique la nouvelle migration au démarrage.

> Ne lance **jamais** `prisma db push` en prod : il ne versionne rien et peut être destructif.

---

## 10. Sauvegardes (Postgres)

Sauvegarde manuelle :

```bash
docker compose exec db pg_dump -U aqoj aqoj > backup-$(date +%F).sql
```

Restauration :

```bash
cat backup-2026-05-30.sql | docker compose exec -T db psql -U aqoj -d aqoj
```

(Idéalement, mets ça dans un `cron` quotidien + copie hors-serveur.)

---

## 10 bis. Nettoyage Docker (éviter le disque plein)

Chaque `docker compose up -d --build` laisse derrière lui l'**ancienne image** et du
**cache de build** → le disque se remplit. Vérifie ce que ça pèse :

```bash
docker system df
```

Nettoyage **sûr** (ne touche ni aux conteneurs qui tournent, ni aux volumes) :

```bash
docker image prune -f      # vieilles images orphelines
docker builder prune -f    # cache de build (le plus gros avec --build)
# …ou tout en une fois (+ conteneurs arrêtés + réseaux inutilisés) :
docker system prune -f
```

> ⚠️ **Ne JAMAIS** ajouter `--volumes`, ni faire `docker volume prune` :
> ça effacerait `aqoj_pgdata` (= **toute ta base de données**). Tant que la stack
> tourne, ces commandes ne suppriment de toute façon pas les images/volumes utilisés.

Bonne habitude : nettoyer juste après chaque déploiement —

```bash
git pull && docker compose up -d --build && docker image prune -f
```

Ou automatise un nettoyage hebdo via cron :

```bash
( crontab -l 2>/dev/null; echo "0 4 * * 0 docker image prune -f && docker builder prune -f" ) | crontab -
```

La **rotation des logs** est déjà configurée dans `docker-compose.yml`
(`max-size: 10m`, `max-file: 3`) → applique-la avec un simple `docker compose up -d`.

## 11. Dépannage

| Symptôme                              | Piste                                                                 |
| ------------------------------------- | --------------------------------------------------------------------- |
| Certificat HTTPS non obtenu           | DNS pas encore propagé, ports 80/443 fermés, `ACME_EMAIL` manquant.   |
| `redirect_uri_mismatch` (Discord)     | L'URL de redirect dans Discord ≠ `https://DOMAIN/api/auth/callback/discord`. |
| `Untrusted host` / erreur NextAuth    | Vérifie `AUTH_URL` et `AUTH_TRUST_HOST=true` dans `.env`.             |
| L'app ne joint pas la base            | `DATABASE_URL` doit utiliser l'hôte `db` et le bon mot de passe.      |
| WebSocket qui ne se connecte pas      | Caddy relaie nativement ; vérifie que tu passes bien par `https://`.  |

Logs ciblés : `docker compose logs app`, `docker compose logs db`, `docker compose logs caddy`.

Tout réinitialiser (⚠️ supprime la base) :

```bash
docker compose down -v && docker compose up -d --build
```

---

## 12. Aller plus loin (plus tard)

- **Scaler horizontalement** : il faudrait sortir l'état des tables de la mémoire
  (store partagé) + un **adapter Socket.IO Redis** + sticky sessions. Aujourd'hui : 1 instance.
- **Monitoring** : `docker compose logs` → un agent (Grafana/Loki, Uptime Kuma…).
- **CI/CD** : un workflow GitHub Actions qui `ssh` sur le VPS et fait `git pull && docker compose up -d --build`.
