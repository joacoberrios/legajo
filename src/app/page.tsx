import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default async function Home() {
  if (await currentUser()) redirect("/taller");

  return (
    <main className="flex min-h-dvh flex-col justify-between px-5 py-10">
      <div className="text-2xl font-extrabold tracking-tight">Legajo</div>
      <div className="space-y-4">
        <h1 className="text-4xl leading-tight font-extrabold tracking-tight">Que el auto hable por sí solo.</h1>
        <p className="text-muted">
          Los talleres cargan cada trabajo y queda firmado para siempre. Quien compra un usado ve el historial real.
        </p>
      </div>
      <div className="space-y-3">
        <Link href="/registro" className="btn-primary">
          Registrar mi taller
        </Link>
        <Link href="/login" className="btn-secondary">
          Ya tengo cuenta
        </Link>
      </div>
    </main>
  );
}
