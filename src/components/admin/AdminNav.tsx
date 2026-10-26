import Link from "next/link";

const ITEMS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/cuentas", label: "Cuentas" },
  { href: "/admin/cobros", label: "Cobros" },
  { href: "/admin/actividad", label: "Actividad" },
  { href: "/admin/stickers", label: "Stickers" },
] as const;

/** Encabezado común de las pantallas anchas del admin. */
export function AdminNav({ current }: { current: (typeof ITEMS)[number]["href"] }) {
  return (
    <nav className="mb-6 flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-line pb-4" aria-label="Admin">
      <span className="mr-3 text-lg font-extrabold tracking-tight">Legajo · Admin</span>
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.href === current ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${i.href === current ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
        >
          {i.label}
        </Link>
      ))}
      <Link href="/panel" className="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:text-ink">Panel →</Link>
    </nav>
  );
}

export const fmtDay = (d: Date | null) =>
  d ? d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Mendoza", day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
export const fmtDateTime = (d: Date | null) =>
  d ? d.toLocaleString("es-AR", { timeZone: "America/Argentina/Mendoza", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
export const money = (n: number | string | null) => (n === null ? "—" : `$${Math.round(Number(n)).toLocaleString("es-AR")}`);

export const SUB_STATUS: Record<string, string> = { pending: "Pendiente", authorized: "Activa", paused: "Pausada", cancelled: "Cancelada", courtesy: "Cortesía" };
export const PAY_STATUS: Record<string, string> = {
  approved: "Aprobado",
  pending: "Pendiente",
  in_process: "En proceso",
  authorized: "Autorizado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Devuelto",
  charged_back: "Contracargo",
};
export const BUY_STATUS: Record<string, string> = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado", refunded: "Devuelto" };

export function StatusPill({ status, map }: { status: string; map: Record<string, string> }) {
  const good = status === "approved" || status === "authorized" || status === "courtesy";
  const bad = status === "rejected" || status === "cancelled" || status === "refunded" || status === "charged_back";
  const cls = good ? "bg-emerald-50 text-ok" : bad ? "bg-red-50 text-red-700" : "bg-amber-50 text-warn";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls}`}>{map[status] ?? status}</span>;
}

export const th = "px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-muted uppercase whitespace-nowrap";
export const td = "px-3 py-2.5 align-top";
export const tableWrap = "overflow-x-auto rounded-xl border border-line bg-white";
export const inputCls = "h-10 rounded-lg border border-line bg-white px-3 text-sm";
