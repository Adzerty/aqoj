import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { sendMagicLink } from "@/lib/email";

const enableGuest = process.env.ENABLE_DEV_GUEST === "true";
// Connexion par email (lien magique) : active si SMTP configuré, ou toujours en dev
// (le lien s'affiche alors dans la console du serveur).
export const emailAuthEnabled =
  !!process.env.EMAIL_HOST || !!process.env.EMAIL_SERVER || process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Derrière un reverse proxy (Caddy/Nginx) on fait confiance à l'en-tête Host.
  trustHost: true,
  // JWT obligatoire car le provider Credentials (invité) ne persiste pas de session.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
      authorization: { params: { scope: "identify email" } },
      // Mappe le profil Discord : on privilégie le « display name » (global_name)
      // et on construit l'URL d'avatar — y compris animé (.gif) le cas échéant.
      profile(profile) {
        let image: string | null = null;
        if (profile.avatar) {
          const ext = profile.avatar.startsWith("a_") ? "gif" : "png";
          image = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${ext}`;
        } else {
          // Avatar par défaut Discord — index dérivé de l'ID de façon déterministe
          // (sans BigInt pour rester compatible avec la cible TS du projet).
          const idx = [...profile.id].reduce((a, c) => (a + c.charCodeAt(0)) % 5, 0);
          image = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
        }
        return {
          id: profile.id,
          name: profile.global_name ?? profile.username,
          email: profile.email,
          image,
        };
      },
    }),
    // Connexion par email (lien magique, sans mot de passe).
    ...(emailAuthEnabled
      ? [
          Nodemailer({
            server: process.env.EMAIL_SERVER || "smtp://localhost:587",
            from: process.env.EMAIL_FROM || "AQOJ <no-reply@aqoj.local>",
            maxAge: 60 * 30, // lien valable 30 minutes
            sendVerificationRequest: ({ identifier, url }) => sendMagicLink(identifier, url),
          }),
        ]
      : []),
    // Login "invité" — utile pour tester en local tant que Discord n'est pas
    // configuré. Désactivé en production (sauf override explicite via env).
    ...(enableGuest
      ? [
          Credentials({
            id: "guest",
            name: "Invité (dev)",
            credentials: { name: { label: "Pseudo", type: "text" } },
            async authorize(creds) {
              const raw = typeof creds?.name === "string" ? creds.name.trim() : "";
              const name = raw.slice(0, 24) || "Invité";
              const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
              const email = `guest+${slug}@aqoj.local`;
              const user = await prisma.user.upsert({
                where: { email },
                update: { name },
                create: { email, name },
              });
              return { id: user.id, name: user.name, image: user.image, email: user.email };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
