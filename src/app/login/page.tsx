import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/jeux");

  const discordEnabled = !!process.env.AUTH_DISCORD_ID && !!process.env.AUTH_DISCORD_SECRET;
  const guestEnabled = process.env.ENABLE_DEV_GUEST === "true";

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-5xl items-center px-6 py-5">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-20">
        <LoginForm discordEnabled={discordEnabled} guestEnabled={guestEnabled} />
      </div>
    </main>
  );
}
