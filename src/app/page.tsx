import Link from "next/link";
import { redirect } from "next/navigation";
import { PitchActions, PitchIntro } from "@/components/Pitch";
import { currentUser, homeFor } from "@/lib/auth";

export default async function Home() {
  const user = await currentUser();
  if (user) redirect(homeFor(user));

  return (
    <main className="space-y-6 px-5 py-6">
      <PitchIntro
        headline="Que el auto hable por sí solo."
        sub="El historial de cada auto, cargado por los talleres que lo atienden y firmado para siempre. Quien compra un usado ve lo que realmente le hicieron."
      />
      <PitchActions />
      <Link href="/login" className="btn-secondary">Ya tengo cuenta</Link>
    </main>
  );
}
