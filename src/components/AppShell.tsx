import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { homeFor, isAdmin, type SessionUser } from "@/lib/auth";

/** Encabezado y avisos comunes a talleres y agencias. */
export function AppShell({ user, children }: { user: SessionUser; children?: React.ReactNode }) {
  const agency = user.workshopKind === "agencia";
  return (
    <div className="pb-10">
      <header className="flex items-center justify-between gap-3 px-5 pt-6 pb-3 print:hidden">
        <Link href={homeFor(user)} className="flex min-w-0 flex-col">
          <span className="text-xl font-extrabold tracking-tight">Legajo</span>
          <span className="truncate text-xs text-muted">{user.workshopName}</span>
        </Link>
        <div className="flex items-center gap-2">
          {isAdmin(user) && (
            <Link href="/admin" className="flex h-11 items-center rounded-xl bg-ink px-3 text-sm font-semibold text-white">
              Admin
            </Link>
          )}
          <Link href="/taller/equipo" className="flex h-11 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold">
            Equipo
          </Link>
          <form action={logout}>
            <button type="submit" className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold">
              Salir
            </button>
          </form>
        </div>
      </header>
      {user.role === "owner" && !user.workshopComplete && (
        <Link href="/taller/datos" className="mx-5 mb-3 block rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 print:hidden">
          Falta el teléfono y la ubicación {agency ? "de la agencia" : "del taller"}. <span className="font-semibold underline">Completalos acá</span>
        </Link>
      )}
      {!user.workshopVerified && (
        <p className="mx-5 mb-3 rounded-xl bg-amber-50 print:hidden px-3.5 py-3 text-sm text-amber-900">
          {agency
            ? "Tu agencia está pendiente de verificación. Ya podés consultar legajos; los informes verificados se habilitan cuando verifiquemos el CUIT."
            : "Tu taller está pendiente de verificación. Ya podés consultar legajos; la carga se habilita cuando verifiquemos el CUIT."}
        </p>
      )}
      {children}
    </div>
  );
}
