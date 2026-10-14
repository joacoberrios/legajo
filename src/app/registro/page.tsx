import Link from "next/link";
import { RegisterForm } from "@/components/AuthForms";

export default function RegisterPage() {
  return (
    <main className="space-y-8 px-5 py-10">
      <div>
        <Link href="/" className="text-2xl font-extrabold tracking-tight">Legajo</Link>
        <h1 className="mt-6 text-2xl font-bold">Registrar taller</h1>
        <p className="mt-2 text-sm text-muted">
          Es gratis. Verificamos el CUIT antes de habilitar la carga de registros.
        </p>
      </div>
      <RegisterForm />
      <p className="text-sm text-muted">
        ¿Ya tenés cuenta? <Link href="/login" className="font-semibold text-accent">Ingresá</Link>
      </p>
    </main>
  );
}
