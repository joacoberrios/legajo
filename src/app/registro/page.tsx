import Link from "next/link";
import { RegisterForm } from "@/components/AuthForms";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  return (
    <main className="space-y-8 px-5 py-10">
      <div>
        <Link href="/" className="text-2xl font-extrabold tracking-tight">Legajo</Link>
        <h1 className="mt-6 text-2xl font-bold">Crear cuenta</h1>
        <p className="mt-2 text-sm text-muted">
          Para talleres y agencias de autos. Verificamos el CUIT antes de habilitar la carga de registros y los informes verificados.
        </p>
      </div>
      <RegisterForm defaultKind={tipo === "agencia" ? "agencia" : "taller"} />
      <p className="text-sm text-muted">
        ¿Ya tenés cuenta? <Link href="/login" className="font-semibold text-accent">Ingresá</Link>
      </p>
    </main>
  );
}
