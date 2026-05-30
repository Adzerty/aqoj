import crypto from "node:crypto";

// Petit jeton signé (HMAC-SHA256) pour authentifier les connexions Socket.IO.
// Émis par une route API protégée par la session Auth.js, vérifié côté serveur
// Socket.IO. Évite d'exposer la session JWT au handshake et empêche un client
// d'usurper l'identité d'un autre joueur.

export interface SocketTokenPayload {
  id: string;
  name: string;
  image: string | null;
  guest: boolean;
}

const TTL_SECONDS = 60 * 10; // 10 min, le client le redemande au besoin

// Lu à l'appel (et non au chargement du module) : selon le contexte (runtime
// Next vs serveur custom), l'env n'est pas chargé au même moment.
function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(data: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(data).digest());
}

export function signSocketToken(payload: SocketTokenPayload): string {
  const body = b64url(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS }),
  );
  return `${body}.${sign(body)}`;
}

export function verifySocketToken(token: string): SocketTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  // Comparaison à temps constant
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(body, "base64").toString());
    if (typeof data.exp !== "number" || data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { id: data.id, name: data.name, image: data.image ?? null, guest: !!data.guest };
  } catch {
    return null;
  }
}
