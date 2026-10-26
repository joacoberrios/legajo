import Link from "next/link";
import { saveBillingAction } from "@/app/actions/billing";
import { BUY_STATUS, fmtDateTime, fmtDay, inputCls, money, PAY_STATUS, StatusPill, SUB_STATUS, tableWrap, td, th } from "@/components/admin/AdminNav";
import { getSettings } from "@/lib/billing";
import { PLANS, PURCHASES, type PlanKey, type PriceKey } from "@/lib/billing-plans";
import { db } from "@/lib/db";
import { mpMode } from "@/lib/mercadopago";

const PRICE_LABELS: Record<PriceKey, string> = {
  report_single: "Informe particular",
  report_pack3: "Pack de 3 informes",
  report_extra: "Informe extra (agencias)",
  agencia: "Agencia / mes",
  agencia_pro: "Agencia Pro / mes",
  taller_pro: "Taller Pro / mes",
};
const TABS = { pagos: "Pagos", suscripciones: "Suscripciones", compras: "Compras", avisos: "Avisos de MP", precios: "Precios y cobro" } as const;
type Tab = keyof typeof TABS;
const PAGE = 50;
const isoDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Cobros: ingresos, historial de pagos, suscripciones, compras, avisos de Mercado Pago y precios. */
export async function BillingView({ sp, base }: { sp: Record<string, string | undefined>; base: string }) {
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : "pagos";
  const sql = db();
  const mode = mpMode();
  const settings = await getSettings();

  const [k] = await sql<{
    total: string; month: string; prevMonth: string; netMonth: string; mrr: string; active: number; courtesy: number;
    approvedMonth: number; rejectedMonth: number; buyers: number; payingAccounts: number;
  }[]>`
    SELECT
      (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'approved')::text AS total,
      (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'approved' AND coalesce(paid_at, created_at) >= date_trunc('month', now()))::text AS month,
      (SELECT coalesce(sum(amount), 0) FROM payments WHERE status = 'approved' AND coalesce(paid_at, created_at) >= date_trunc('month', now()) - interval '1 month' AND coalesce(paid_at, created_at) < date_trunc('month', now()))::text AS prev_month,
      (SELECT coalesce(sum(coalesce(net_amount, amount)), 0) FROM payments WHERE status = 'approved' AND coalesce(paid_at, created_at) >= date_trunc('month', now()))::text AS net_month,
      (SELECT coalesce(sum(amount), 0) FROM subscriptions WHERE status = 'authorized')::text AS mrr,
      (SELECT count(*) FROM subscriptions WHERE status = 'authorized')::int AS active,
      (SELECT count(*) FROM subscriptions WHERE status = 'courtesy' AND current_period_end > now())::int AS courtesy,
      (SELECT count(*) FROM payments WHERE status = 'approved' AND created_at >= date_trunc('month', now()))::int AS approved_month,
      (SELECT count(*) FROM payments WHERE status IN ('rejected', 'cancelled') AND created_at >= date_trunc('month', now()))::int AS rejected_month,
      (SELECT count(DISTINCT email) FROM purchases WHERE status = 'approved' AND workshop_id IS NULL)::int AS buyers,
      (SELECT count(DISTINCT workshop_id) FROM subscriptions WHERE status = 'authorized')::int AS paying_accounts
  `;
  const byPlan = await sql<{ plan: PlanKey; status: string; n: number; amount: string }[]>`
    SELECT plan, status, count(*)::int AS n, coalesce(sum(amount), 0)::text AS amount FROM subscriptions
    WHERE status IN ('authorized', 'courtesy', 'pending', 'paused') AND (status <> 'courtesy' OR current_period_end > now())
    GROUP BY plan, status
  `;
  const delta = Number(k.month) - Number(k.prevMonth);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Cobros</h1>
          <p className="text-sm text-muted">
            Cobro {settings.enabled ? <strong className="text-ok">activado</strong> : <strong className="text-warn">apagado (piloto gratis)</strong>}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === "produccion" ? "bg-emerald-50 text-ok" : "bg-amber-50 text-warn"}`}>
          Mercado Pago: {mode === "produccion" ? "producción" : mode}
        </span>
      </div>

      {sp.guardado && <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Guardado.</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Ingresos del mes" value={money(k.month)} note={`${delta >= 0 ? "+" : ""}${money(delta)} vs. mes anterior`} />
        <Stat label="Neto del mes" value={money(k.netMonth)} note="Después de comisiones de MP" />
        <Stat label="Recurrente mensual" value={money(k.mrr)} note={`${k.active} suscripciones · ${k.payingAccounts} cuentas`} />
        <Stat label="Ingresos totales" value={money(k.total)} />
        <Stat label="Pagos del mes" value={k.approvedMonth} note={`${k.rejectedMonth} rechazados`} />
        <Stat label="Compradores particulares" value={k.buyers} note={`${k.courtesy} cortesías vigentes`} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanKey[]).map((p) => {
          const rows = byPlan.filter((b) => b.plan === p);
          const n = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
          return (
            <div key={p} className="rounded-xl border border-line bg-white px-4 py-3">
              <div className="flex items-baseline justify-between">
                <p className="font-bold">{PLANS[p].name}</p>
                <p className="font-mono text-sm">{money(settings.prices[p])}/mes</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                <strong className="text-ink">{n("authorized")}</strong> activas · {n("courtesy")} cortesía · {n("pending")} pendientes{n("paused") ? ` · ${n("paused")} pausadas` : ""}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted">{money(rows.find((r) => r.status === "authorized")?.amount ?? 0)}/mes facturado</p>
            </div>
          );
        })}
      </div>

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-line" aria-label="Secciones">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link key={t} href={`${base}/cobros?tab=${t}`} aria-current={t === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${t === tab ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {TABS[t]}
          </Link>
        ))}
      </nav>

      {tab === "pagos" && <Payments sp={sp} base={base} />}
      {tab === "suscripciones" && <Subscriptions sp={sp} base={base} />}
      {tab === "compras" && <Purchases base={base} />}
      {tab === "avisos" && <Events />}
      {tab === "precios" && (
        <form action={saveBillingAction} className="max-w-2xl space-y-4 rounded-xl border border-line bg-white p-5">
          <input type="hidden" name="back" value={`${base}/cobros`} />
          <label className="flex items-start gap-3">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-1 size-5 accent-[#C2410C]" />
            <span>
              <span className="block font-bold">Cobro activado</span>
              <span className="block text-sm text-muted">Apagado = piloto gratis para todos. Encendido = el historial completo pasa a ser pago según los planes.</span>
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(PRICE_LABELS) as PriceKey[]).map((p) => (
              <label key={p} className="space-y-1 text-sm">
                <span className="text-muted">{PRICE_LABELS[p]}</span>
                <input name={p} inputMode="numeric" defaultValue={settings.prices[p]} className={`${inputCls} w-full font-mono`} />
              </label>
            ))}
          </div>
          <button type="submit" className="h-11 w-full rounded-xl bg-accent text-sm font-semibold text-white">Guardar</button>
          <p className="text-xs text-muted">Los precios nuevos aplican a las próximas compras y suscripciones; las vigentes mantienen su monto. Cortesías y descuentos: desde la ficha de cada cuenta.</p>
        </form>
      )}
    </>
  );
}

async function Payments({ sp, base }: { sp: Record<string, string | undefined>; base: string }) {
  const q = (sp.q ?? "").trim().slice(0, 60);
  const status = (sp.estado ?? "").trim();
  const source = sp.origen === "compra" || sp.origen === "suscripcion" ? sp.origen : "";
  const from = isoDate(sp.desde);
  const to = isoDate(sp.hasta);
  const page = Math.max(1, Math.floor(Number(sp.p) || 1));
  const like = `%${q}%`;
  const rows = await db()<{
    id: string; mpPaymentId: string; source: string; concept: string; amount: string; netAmount: string | null; status: string; statusDetail: string | null;
    method: string | null; payerEmail: string | null; paidAt: Date | null; createdAt: Date; workshopId: string | null; account: string | null; total: number; sum: string;
  }[]>`
    SELECT p.id::text, p.mp_payment_id, p.source, p.concept, p.amount::text, p.net_amount::text, p.status, p.status_detail, p.method, p.payer_email,
      p.paid_at, p.created_at, p.workshop_id, w.name AS account,
      count(*) OVER()::int AS total,
      (sum(CASE WHEN p.status = 'approved' THEN p.amount ELSE 0 END) OVER())::text AS sum
    FROM payments p LEFT JOIN workshops w ON w.id = p.workshop_id
    WHERE (${q} = '' OR p.concept ILIKE ${like} OR coalesce(p.payer_email, '') ILIKE ${like} OR coalesce(w.name, '') ILIKE ${like} OR p.mp_payment_id = ${q})
      AND (${status} = '' OR p.status = ${status})
      AND (${source} = '' OR p.source = ${source})
      AND (${from}::date IS NULL OR coalesce(p.paid_at, p.created_at) >= ${from}::date)
      AND (${to}::date IS NULL OR coalesce(p.paid_at, p.created_at) < ${to}::date + 1)
    ORDER BY coalesce(p.paid_at, p.created_at) DESC
    LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}
  `;
  const total = rows[0]?.total ?? 0;
  const qs = (p: number) => {
    const u = new URLSearchParams({ tab: "pagos", ...(q && { q }), ...(status && { estado: status }), ...(source && { origen: source }), ...(from && { desde: from }), ...(to && { hasta: to }), p: String(p) });
    return `${base}/cobros?${u}`;
  };

  return (
    <section className="space-y-3">
      <form className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="pagos" />
        <input name="q" defaultValue={q} placeholder="Cuenta, email, concepto o ID" className={`${inputCls} w-60`} />
        <select name="estado" defaultValue={status} className={inputCls} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(PAY_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="origen" defaultValue={source} className={inputCls} aria-label="Origen">
          <option value="">Compras y suscripciones</option>
          <option value="compra">Compras</option>
          <option value="suscripcion">Suscripciones</option>
        </select>
        <input name="desde" type="date" defaultValue={from ?? ""} className={inputCls} aria-label="Desde" />
        <input name="hasta" type="date" defaultValue={to ?? ""} className={inputCls} aria-label="Hasta" />
        <button type="submit" className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">Filtrar</button>
        {total > 0 && <span className="ml-auto text-sm text-muted">{total} pagos · aprobados {money(rows[0].sum)}</span>}
      </form>
      {rows.length === 0 ? (
        <Empty>Todavía no hay pagos{q || status || source || from || to ? " con esos filtros" : ""}. Aparecen acá apenas Mercado Pago avisa.</Empty>
      ) : (
        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-[#FAFAF8]"><tr>
              <th className={th}>Fecha</th><th className={th}>Cuenta / comprador</th><th className={th}>Concepto</th><th className={th}>Estado</th>
              <th className={`${th} text-right`}>Monto</th><th className={`${th} text-right`}>Neto</th><th className={th}>Medio</th><th className={th}>ID MP</th>
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className={`${td} font-mono text-xs whitespace-nowrap`}>{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                  <td className={td}>
                    {p.workshopId ? <Link href={`${base}/cuentas/${p.workshopId}`} className="font-semibold hover:text-accent">{p.account}</Link> : <span className="text-muted">Particular</span>}
                    {p.payerEmail && <span className="block text-xs text-muted">{p.payerEmail}</span>}
                  </td>
                  <td className={td}>{p.concept}<span className="block text-[11px] text-muted">{p.source === "suscripcion" ? "Suscripción" : p.source === "compra" ? "Compra" : "Otro"}</span></td>
                  <td className={td}><StatusPill status={p.status} map={PAY_STATUS} />{p.statusDetail && p.status !== "approved" && <span className="block text-[11px] text-muted">{p.statusDetail}</span>}</td>
                  <td className={`${td} text-right font-mono`}>{money(p.amount)}</td>
                  <td className={`${td} text-right font-mono text-muted`}>{money(p.netAmount)}</td>
                  <td className={`${td} text-xs`}>{p.method ?? "—"}</td>
                  <td className={`${td} font-mono text-xs text-muted`}>{p.mpPaymentId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > PAGE && (
        <div className="flex items-center justify-end gap-2 text-sm">
          {page > 1 && <Link href={qs(page - 1)} className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold">← Anterior</Link>}
          <span className="text-muted">Página {page} de {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total && <Link href={qs(page + 1)} className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold">Siguiente →</Link>}
        </div>
      )}
    </section>
  );
}

async function Subscriptions({ sp, base }: { sp: Record<string, string | undefined>; base: string }) {
  const status = sp.estado && sp.estado in SUB_STATUS ? sp.estado : "";
  const rows = await db()<{ id: string; workshopId: string; name: string; kind: string; plan: PlanKey; status: string; amount: number; until: Date | null; periodStart: Date | null; createdAt: Date; paid: string; payments: number }[]>`
    SELECT s.id, s.workshop_id, w.name, w.kind, s.plan, s.status, s.amount, s.current_period_end AS until, s.period_start, s.created_at,
      (SELECT coalesce(sum(amount), 0) FROM payments p WHERE p.subscription_id = s.id AND p.status = 'approved')::text AS paid,
      (SELECT count(*) FROM payments p WHERE p.subscription_id = s.id AND p.status = 'approved')::int AS payments
    FROM subscriptions s JOIN workshops w ON w.id = s.workshop_id
    WHERE (${status} = '' OR s.status = ${status})
    ORDER BY s.created_at DESC LIMIT 300
  `;
  return (
    <section className="space-y-3">
      <form className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="suscripciones" />
        <select name="estado" defaultValue={status} className={inputCls} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(SUB_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="submit" className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>
      {rows.length === 0 ? <Empty>Sin suscripciones.</Empty> : (
        <div className={tableWrap}>
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-[#FAFAF8]"><tr>
              <th className={th}>Cuenta</th><th className={th}>Plan</th><th className={th}>Estado</th><th className={`${th} text-right`}>Monto</th>
              <th className={th}>Período actual</th><th className={`${th} text-right`}>Cobrado</th><th className={th}>Creada</th>
            </tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className={td}><Link href={`${base}/cuentas/${s.workshopId}`} className="font-semibold hover:text-accent">{s.name}</Link><span className="block text-[11px] text-muted uppercase">{s.kind}</span></td>
                  <td className={`${td} font-semibold`}>{PLANS[s.plan].name}</td>
                  <td className={td}><StatusPill status={s.status} map={SUB_STATUS} /></td>
                  <td className={`${td} text-right font-mono`}>{s.status === "courtesy" ? "—" : `${money(s.amount)}/mes`}</td>
                  <td className={`${td} font-mono text-xs whitespace-nowrap`}>{fmtDay(s.periodStart)} → {fmtDay(s.until)}</td>
                  <td className={`${td} text-right font-mono`}>{money(s.paid)}<span className="block text-[11px] text-muted">{s.payments} pagos</span></td>
                  <td className={`${td} font-mono text-xs text-muted`}>{fmtDay(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

async function Purchases({ base }: { base: string }) {
  const rows = await db()<{ id: string; kind: keyof typeof PURCHASES; status: string; amount: number; email: string | null; workshopId: string | null; account: string | null; plate: string | null; credits: number; creditsUsed: number; createdAt: Date; paidAt: Date | null }[]>`
    SELECT p.id, p.kind, p.status, p.amount, p.email, p.workshop_id, w.name AS account, v.plate, p.credits, p.credits_used, p.created_at, p.paid_at
    FROM purchases p LEFT JOIN workshops w ON w.id = p.workshop_id LEFT JOIN vehicles v ON v.id = p.vehicle_id
    ORDER BY p.created_at DESC LIMIT 300
  `;
  return rows.length === 0 ? <Empty>Sin compras todavía.</Empty> : (
    <div className={tableWrap}>
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-[#FAFAF8]"><tr>
          <th className={th}>Fecha</th><th className={th}>Producto</th><th className={th}>Comprador</th><th className={th}>Auto</th><th className={th}>Estado</th>
          <th className={`${th} text-right`}>Monto</th><th className={`${th} text-right`}>Informes usados</th>
        </tr></thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-b border-line last:border-0">
              <td className={`${td} font-mono text-xs whitespace-nowrap`}>{fmtDateTime(b.paidAt ?? b.createdAt)}</td>
              <td className={td}>{PURCHASES[b.kind].name}</td>
              <td className={td}>{b.workshopId ? <Link href={`${base}/cuentas/${b.workshopId}`} className="font-semibold hover:text-accent">{b.account}</Link> : <span className="text-xs">{b.email ?? "sin email"}</span>}</td>
              <td className={`${td} font-mono text-xs`}>{b.plate ?? "—"}</td>
              <td className={td}><StatusPill status={b.status} map={BUY_STATUS} /></td>
              <td className={`${td} text-right font-mono`}>{money(b.amount)}</td>
              <td className={`${td} text-right font-mono`}>{b.creditsUsed}/{b.credits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Events() {
  const rows = await db()<{ id: string; topic: string; resourceId: string; result: string | null; createdAt: Date }[]>`
    SELECT id::text, topic, resource_id, result, created_at FROM mp_events ORDER BY created_at DESC LIMIT 100
  `;
  return rows.length === 0 ? <Empty>Mercado Pago todavía no mandó avisos.</Empty> : (
    <div className={tableWrap}>
      <table className="w-full text-sm">
        <thead className="border-b border-line bg-[#FAFAF8]"><tr>
          <th className={th}>Fecha</th><th className={th}>Tema</th><th className={th}>ID</th><th className={th}>Resultado</th>
        </tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-line last:border-0">
              <td className={`${td} font-mono text-xs whitespace-nowrap`}>{fmtDateTime(e.createdAt)}</td>
              <td className={`${td} text-xs`}>{e.topic}</td>
              <td className={`${td} font-mono text-xs text-muted`}>{e.resourceId}</td>
              <td className={`${td} text-xs ${e.result?.startsWith("error") || e.result === "firma inválida" ? "font-semibold text-red-700" : ""}`}>{e.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
    </div>
  );
}
function Empty({ children }: { children?: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line bg-white px-4 py-8 text-center text-sm text-muted">{children}</p>;
}
