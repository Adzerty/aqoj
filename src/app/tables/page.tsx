import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Navbar } from "@/components/navbar";
import { TablesBrowser } from "@/components/tables-browser";

export default async function TablesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-3xl font-extrabold tracking-tight">Les tables</h1>
        <p className="mb-8 text-muted">
          Rejoins une table ouverte, ou crée la tienne et partage le code.
        </p>
        <TablesBrowser />
      </main>
    </>
  );
}
