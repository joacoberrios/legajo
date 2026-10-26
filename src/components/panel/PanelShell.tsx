import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Wordmark } from "@/components/Wordmark";
import { isAdmin, type SessionUser } from "@/lib/auth";
import { PanelNav } from "./PanelNav";

/** Panel de computadora: barra lateral fija con navegación y contenido ancho. */
export function PanelShell({ user, children }: { user: SessionUser; children?: React.ReactNode }) {
  const agency = user.workshopKind === "agencia";
  const admin = isAdmin(user);
  const items = [
    { href: "/panel", label: "Resumen", icon: "home" },
    { href: "/panel/vehiculos", label: admin ? "Vehículos" : agency ? "Mis autos" : "Vehículos", icon: "car" },
    ...(!agency || admin ? [{ href: "/panel/registros", label: "Registros", icon: "list" }] : []),
    ...(agency || admin ? [{ href: "/panel/informes", label: "Informes", icon: "doc" }] : []),
    { href: "/panel/plan", label: "Plan", icon: "card" },
    { href: "/panel/equipo", label: "Equipo", icon: "team" },
    { href: "/panel/datos", label: agency ? "Datos de la agencia" : "Datos del taller", icon: "pin" },
  ] as const;

  return (
    <div data-wide className="min-h-dvh bg-[#F7F6F3] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <div className="bg-ink print:hidden">
      <aside className="flex flex-col text-paper lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex items-center justify-between gap-3 px-5 py-5 lg:block lg:space-y-1">
          <Link href="/panel" aria-label="Legajo, resumen" className="block">
            <Wordmark height={18} color="#F3F2EE" />
          </Link>
          <p className="truncate text-xs text-[#9A9890] lg:pt-2">{user.workshopName}</p>
        </div>
        <PanelNav items={items.map((i) => ({ ...i }))} />
        <div className="mt-auto hidden space-y-1 border-t border-[#2E3237] px-3 py-4 lg:block">
          {isAdmin(user) && (
            <Link href="/admin" className="flex h-9 items-center rounded-lg px-3 text-sm text-[#C9C7BF] hover:bg-[#1E2125] hover:text-white">Admin de Legajo</Link>
          )}
          <Link href={agency ? "/agencia" : "/taller"} className="flex h-9 items-center rounded-lg px-3 text-sm text-[#C9C7BF] hover:bg-[#1E2125] hover:text-white">
            Versión celular
          </Link>
          <form action={logout}>
            <button type="submit" className="flex h-9 w-full items-center rounded-lg px-3 text-left text-sm text-[#C9C7BF] hover:bg-[#1E2125] hover:text-white">
              Salir
            </button>
          </form>
          <p className="truncate px-3 pt-2 text-[11px] text-[#6B6A64]">{user.name}</p>
        </div>
      </aside>
      </div>
      <div className="min-w-0">
        {!user.workshopVerified && (
          <p className="border-b border-amber-200 bg-amber-50 px-8 py-2.5 text-sm text-amber-900 print:hidden">
            {agency
              ? "Tu agencia está pendiente de verificación: podés consultar legajos; los informes verificados se habilitan cuando verifiquemos el CUIT."
              : "Tu taller está pendiente de verificación: podés consultar legajos; la carga se habilita cuando verifiquemos el CUIT."}
          </p>
        )}
        <main className="mx-auto max-w-[1360px] px-5 py-7 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}

/** Encabezado de cada pantalla del panel: título, bajada y acciones a la derecha. */
export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

export function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1.5 font-mono text-[28px] leading-none font-semibold">{value}</p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}

export const btn = "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold";
export const btnPrimary = `${btn} bg-accent text-white hover:bg-accent-dark`;
export const btnSecondary = `${btn} border border-line bg-white hover:border-ink`;
export const input = "h-10 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink";
