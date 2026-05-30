import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LobbyClient } from "@/components/lobby-client";
import { listGameMetas } from "@/lib/games/registry";

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { code } = await params;
  const metas = listGameMetas();

  return <LobbyClient code={code.toUpperCase()} metas={metas} />;
}
