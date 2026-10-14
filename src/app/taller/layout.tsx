import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";

export default async function TallerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="pb-10">
      <header className="flex items-center justify-between px-5 pt-6 pb-3 print:hidden">
        <Link href="/taller" className="flex flex-col">
          <span className="text-xl font-extrabold tracking-tight">Legajo</span>
          <span className="text-xs text-muted">{user.workshopName}</span>
        </Link>
        <form action={logout}>
          <button type="submit" className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold">
            Salir
          </button>
        </form>
      </header>
      {!user.workshopVerified && (
        <p className="mx-5 mb-3 rounded-xl bg-amber-50 print:hidden px-3.5 py-3 text-sm text-amber-900">
          Tu taller está pendiente de verificación. Ya podés consultar legajos; la carga se habilita cuando verifiquemos el CUIT.
        </p>
      )}
      {children}
    </div>
  );
}
