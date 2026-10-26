import Link from "next/link";
import { grantCourtesyAction, saveBillingAction, setDiscountAction } from "@/app/actions/billing";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/billing";
import { formatARS, PLANS, PURCHASES, type PlanKey, type PriceKey } from "@/lib/billing-plans";
import { db } from "@/lib/db";
import { mpMode } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

const PRICE_LABELS: Record<PriceKey, string> = {
  report_single: "Informe particular",
  report_pack3: "Pack de 3 informes",
  report_extra: "Informe extra (agencias)",
  agencia: "Agencia / mes",
  agencia_pro: "Agencia Pro / mes",
  taller_pro: "Taller Pro / mes",
};

const SUB_STATUS: Record<string, string> = {
  pending: "Pendiente",
  authorized: "Activa",
  paused: "Pausada",
  cancelled: "Cancelada",
  courtesy: "Cortesía",
};
const BUY_STATUS: Record<string, string> = { pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado", refunded: "Devuelto" };

const day = (d: Date | null) => (d ? d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Mendoza", day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
const input = "h-11 w-full rounded-xl border border-line bg-white px-3 font-mono text-sm";

/** Cobros: llave general, precios, cortesías, descuentos y lo que entró por Mercado Pago. */
export default async function AdminCobros({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string; cortesia?: string; descuento?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const settings = await getSettings();
  const mode = mpMode();

  const [accounts, subs, buys, totals] = await Promise.all([
    db()<{ id: string; name: string; kind: "taller" | "agencia"; discount: number; plan: PlanKey | null; status: string | null; until: Date | null }[]>`
      SELECT w.id, w.name, w.kind, w.price_discount_pct AS discount, s.plan, s.status, s.current_period_end AS until
      FROM workshops w
      LEFT JOIN LATERAL (
        SELECT plan, status, current_period_end FROM subscriptions WHERE workshop_id = w.id ORDER BY created_at DESC LIMIT 1
      ) s ON true
      ORDER BY w.name
    `,
    db()<{ id: string; name: string; plan: PlanKey; status: string; amount: number; until: Date | null; createdAt: Date }[]>`
      SELECT s.id, w.name, s.plan, s.status, s.amount, s.current_period_end AS until, s.created_at
      FROM subscriptions s JOIN workshops w ON w.id = s.workshop_id
      ORDER BY s.created_at DESC LIMIT 100
    `,
    db()<{ id: string; kind: keyof typeof PURCHASES; status: string; amount: number; who: string | null; plate: string | null; credits: number; creditsUsed: number; createdAt: Date }[]>`
      SELECT p.id, p.kind, p.status, p.amount, coalesce(w.name, p.email) AS who, v.plate, p.credits, p.credits_used, p.created_at
      FROM purchases p LEFT JOIN workshops w ON w.id = p.workshop_id LEFT JOIN vehicles v ON v.id = p.vehicle_id
      ORDER BY p.created_at DESC LIMIT 100
    `,
    db()<{ month: number; active: number }[]>`
      SELECT
        (SELECT coalesce(sum(amount), 0) FROM purchases WHERE status = 'approved' AND paid_at >= date_trunc('month', now()))::int AS month,
        (SELECT count(*) FROM subscriptions WHERE status = 'authorized')::int AS active
    `,
  ]);
  const t = totals[0];
  const mrr = subs.filter((s) => s.status === "authorized").reduce((a, s) => a + s.amount, 0);

  return (
    <main className="space-y-8 px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-muted">← Admin</Link>
          <h1 className="text-xl font-extrabold tracking-tight">Cobros</h1>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${mode === "produccion" ? "bg-emerald-50 text-ok" : "bg-amber-50 text-warn"}`}>
          Mercado Pago: {mode === "produccion" ? "producción" : mode}
        </span>
      </div>

      {sp.guardado && <Ok>Guardado.</Ok>}
      {sp.cortesia && <Ok>Cortesía otorgada.</Ok>}
      {sp.descuento && <Ok>Descuento actualizado.</Ok>}
      {sp.error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">Revisá los datos ({sp.error}).</p>}

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Suscripciones activas" value={String(t.active)} />
        <Stat label="Recurrente / mes" value={formatARS(mrr)} />
        <Stat label="Ventas del mes" value={formatARS(t.month)} />
      </div>

      <form action={saveBillingAction} className="card space-y-4 p-5">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-1 size-5 accent-[#C2410C]" />
          <span>
            <span className="block font-bold">Cobro activado</span>
            <span className="block text-sm text-muted">Apagado = piloto gratis para todos. Encendido = el historial completo pasa a ser pago según los planes.</span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(PRICE_LABELS) as PriceKey[]).map((k) => (
            <label key={k} className="space-y-1 text-sm">
              <span className="text-muted">{PRICE_LABELS[k]}</span>
              <input name={k} inputMode="numeric" defaultValue={settings.prices[k]} className={input} />
            </label>
          ))}
        </div>
        <button type="submit" className="btn-primary">Guardar</button>
        <p className="text-xs text-muted">Los precios nuevos aplican a las próximas compras y suscripciones; las vigentes mantienen su monto.</p>
      </form>

      <section className="space-y-3">
        <h2 className="font-bold">Cuentas</h2>
        <div className="space-y-2">
          {accounts.map((a) => (
            <details key={a.id} className="card p-4">
              <summary className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{a.name}</span> <span className="text-xs text-muted">{a.kind}</span>
                </span>
                <span className="text-right text-xs text-muted">
                  {a.plan && a.status !== "cancelled" ? `${PLANS[a.plan].name} · ${SUB_STATUS[a.status ?? ""] ?? a.status} · ${day(a.until)}` : "Sin plan"}
                  {a.discount > 0 && <span className="ml-2 font-semibold text-accent">-{a.discount}%</span>}
                </span>
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <form action={grantCourtesyAction} className="space-y-2">
                  <input type="hidden" name="workshopId" value={a.id} />
                  <p className="text-sm font-semibold">Plan de cortesía</p>
                  <select name="plan" className={input} defaultValue={a.kind === "agencia" ? "agencia" : "taller_pro"}>
                    {(Object.keys(PLANS) as PlanKey[]).filter((k) => PLANS[k].kind === a.kind).map((k) => (
                      <option key={k} value={k}>{PLANS[k].name}</option>
                    ))}
                  </select>
                  <input name="months" type="number" min={1} max={24} defaultValue={6} className={input} aria-label="Meses" />
                  <button type="submit" className="h-11 w-full rounded-xl bg-ink text-sm font-semibold text-white">Dar cortesía (meses)</button>
                </form>
                <form action={setDiscountAction} className="space-y-2">
                  <input type="hidden" name="workshopId" value={a.id} />
                  <p className="text-sm font-semibold">Descuento permanente</p>
                  <input name="pct" type="number" min={0} max={100} defaultValue={a.discount} className={input} aria-label="Porcentaje" />
                  <button type="submit" className="h-11 w-full rounded-xl border border-line bg-white text-sm font-semibold">Guardar %</button>
                  <p className="text-xs text-muted">Aplica a las suscripciones que contrate desde ahora.</p>
                </form>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">Suscripciones</h2>
        {subs.length === 0 ? <Empty /> : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span><span className="font-semibold">{s.name}</span> · {PLANS[s.plan].name}<span className="block text-xs text-muted">Desde {day(s.createdAt)} · hasta {day(s.until)}</span></span>
                <span className="text-right"><span className="block font-mono">{s.status === "courtesy" ? "—" : formatARS(s.amount)}</span><span className="text-xs text-muted">{SUB_STATUS[s.status] ?? s.status}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">Compras</h2>
        {buys.length === 0 ? <Empty /> : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white text-sm">
            {buys.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="font-semibold">{PURCHASES[b.kind].name}</span>
                  <span className="block text-xs text-muted">{day(b.createdAt)} · {b.who ?? "sin email"}{b.plate ? ` · ${b.plate}` : ""} · usados {b.creditsUsed}/{b.credits}</span>
                </span>
                <span className="text-right"><span className="block font-mono">{formatARS(b.amount)}</span><span className="text-xs text-muted">{BUY_STATUS[b.status] ?? b.status}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Ok({ children }: { children?: React.ReactNode }) {
  return <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">{children}</p>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-2 py-3">
      <p className="font-mono text-lg font-bold">{value}</p>
      <p className="text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}
function Empty() {
  return <p className="text-sm text-muted">Todavía nada.</p>;
}
