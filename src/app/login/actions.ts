"use server";

import { prisma } from "@/lib/prisma";

// Le lien magique ne transporte que l'email. Pour associer un pseudo, on
// pré-crée (ou retrouve) le compte AVANT l'envoi du lien. On n'écrase JAMAIS le
// pseudo d'un compte existant (sinon n'importe qui pourrait le changer sans
// vérifier l'email) — le pseudo se modifie ensuite depuis le profil.
export async function prepareEmailLogin(
  emailRaw: string,
  pseudoRaw: string,
): Promise<{ ok: boolean; error?: string }> {
  const email = emailRaw.trim().toLowerCase();
  const name = pseudoRaw.trim().slice(0, 24);

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Adresse email invalide." };
  if (name.length < 2) return { ok: false, error: "Choisis un pseudo (2 caractères min)." };

  try {
    await prisma.user.upsert({
      where: { email },
      update: {}, // compte existant : on garde son pseudo actuel
      create: { email, name },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Impossible de préparer la connexion. Réessaie." };
  }
}
