import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";

export default function LoginPage() {
  return (
    <main className="space-y-8 px-5 py-10">
      <div>
        <Link href="/" className="text-2xl font-extrabold tracking-tight">Legajo</Link>
        <h1 className="mt-6 text-2xl font-bold">Ingresar al taller</h1>
      </div>
      <LoginForm />
      <p className="-mt-4 text-sm">
        <Link href="/recuperar" className="font-semibold text-accent">¿Olvidaste tu contraseña?</Link>
      </p>
      <p className="text-sm text-muted">
        ¿Tu taller no tiene cuenta? <Link href="/registro" className="font-semibold text-accent">Registralo</Link>
      </p>
    </main>
  );
}
