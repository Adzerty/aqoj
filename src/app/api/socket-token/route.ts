import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { signSocketToken } from "@/lib/socket-token";

// Émet un jeton court signé pour le handshake Socket.IO.
// Protégé par la session : seul un utilisateur connecté peut en obtenir un,
// et il ne peut obtenir que SON identité.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const token = signSocketToken({
    id: session.user.id,
    name: session.user.name ?? "Joueur",
    image: session.user.image ?? null,
    guest: (session.user.email ?? "").endsWith("@aqoj.local"),
  });

  return NextResponse.json({ token });
}
