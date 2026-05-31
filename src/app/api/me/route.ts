import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Renvoie les infos « live » du joueur connecté (utilisé par la navbar pour le
// solde d'AQOJPoints, qui change après chaque partie).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ aqojPoints: null }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { aqojPoints: true },
  });
  return NextResponse.json({ aqojPoints: user?.aqojPoints ?? 0 });
}
