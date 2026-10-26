import Link from "next/link";
import { notFound } from "next/navigation";
import { grantCourtesyAction, setDiscountAction } from "@/app/actions/billing";
import { AdminNav, BUY_STATUS, fmtDateTime, fmtDay, inputCls, money, PAY_STATUS, StatusPill, SUB_STATUS, tableWrap, td, th } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";
import { accessFor } from "@/lib/billing";
import { PLANS, PURCHASES, type PlanKey } from "@/lib/billing-plans";
import { maskCuit } from "@/lib/cuit";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

/** Ficha completa de una cuenta: datos, usuarios, plan, pagos, compras y uso. */
export default async function AdminAccount({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const sql = db();

  const [w] = await sql<{
    id: string; name: string; kind: "taller" | "agencia"; cuit: string; city: string | null; phone: string | null; address: string | null;
    lat: number | null; lng: number | null; verified: boolean; createdAt: Date; discount: number;
  }[]>`
    SELECT id, name, kind, cuit, city, phone, address, lat, lng, verified, created_at, price_discount_pct AS discount FROM workshops WHERE id = ${id}
  `;
  if (!w) notFound();

  const [users, subs, pays, buys, usage] = await Promise.all([
    sql<{ id: string; name: string; email: string; role: string; createdAt: Date; records: number; lastSeen: Date | null }[]>`
      SELECT u.id, u.name, u.email, u.role, u.created_at,
        (SELECT count(*) FROM service_records r WHERE r.user_id = u.id)::int AS records,
        greatest((SELECT max(r.created_at) FROM service_records r WHERE r.user_id = u.id), (SELECT max(v.last_at) FROM vehicle_views v WHERE v.user_id = u.id)) AS last_seen
      FROM users u WHERE u.workshop_id = ${id} ORDER BY u.role DESC, u.created_at
    `,
    sql<{ id: string; plan: PlanKey; status: string; amount: number; reportsQuota: number; mpPreapprovalId: string | null; periodStart: Date | null; until: Date | null; createdAt: Date; by: string | null }[]>`
      SELECT s.id, s.plan, s.status, s.amount, s.reports_quota, s.mp_preapproval_id, s.period_start, s.current_period_end AS until, s.created_at, u.name AS by
      FROM subscriptions s LEFT JOIN users u ON u.id = s.created_by WHERE s.workshop_id = ${id} ORDER BY s.created_at DESC
    `,
    sql<{ id: string; mpPaymentId: string; concept: string; amount: string; netAmount: string | null; status: string; statusDetail: string | null; method: string | null; paidAt: Date | null; createdAt: Date }[]>`
      SELECT id, mp_payment_id, concept, amount::text, net_amount::text, status, status_detail, method, paid_at, created_at
      FROM payments WHERE workshop_id = ${id} ORDER BY created_at DESC LIMIT 200
    `,
    sql<{ id: string; kind: keyof typeof PURCHASES; status: string; amount: number; credits: number; creditsUsed: number; createdAt: Date; paidAt: Date | null }[]>`
      SELECT id, kind, status, amount, credits, credits_used, created_at, paid_at FROM purchases WHERE workshop_id = ${id} ORDER BY created_at DESC
    `,
    sql<{ records: number; recordsMonth: number; vehicles: number; followed: number; reports: number; reportsMonth: number; views30: number; viewsTotal: number; stickers: number; paid: string }[]>`
      SELECT
        (SELECT count(*) FROM service_records WHERE workshop_id = ${id})::int AS records,
        (SELECT count(*) FROM service_records WHERE workshop_id = ${id} AND created_at >= date_trunc('month', now()))::int AS records_month,
        (SELECT count(*) FROM vehicles WHERE created_by_workshop = ${id})::int AS vehicles,
        (SELECT count(*) FROM agency_vehicles WHERE workshop_id = ${id})::int AS followed,
        (SELECT count(*) FROM verified_reports WHERE workshop_id = ${id})::int AS reports,
        (SELECT count(*) FROM verified_reports WHERE workshop_id = ${id} AND issued_at >= date_trunc('month', now()))::int AS reports_month,
        (SELECT coalesce(sum(count), 0) FROM vehicle_views WHERE workshop_id = ${id} AND view_date >= current_date - 30)::int AS views30,
        (SELECT coalesce(sum(count), 0) FROM vehicle_views WHERE workshop_id = ${id})::int AS views_total,
        (SELECT count(*) FROM stickers WHERE assigned_workshop_id = ${id})::int AS stickers,
        (SELECT coalesce(sum(amount), 0) FROM payments WHERE workshop_id = ${id} AND status = 'approved')::text AS paid
    `,
  ]);
  const u = usage[0];
  const owner = users.find((x) => x.role === "owner");
  const access = owner ? await accessFor({ id: owner.id, email: owner.email, name: owner.name, role: "owner", workshopId: w.id, workshopName: w.name, workshopKind: w.kind, workshopVerified: w.verified, workshopComplete: true }) : null;
  const back = `/admin/cuentas/${id}`;
  const agency = w.kind === "agencia";

  return (
    <main data-wide className="mx-auto max-w-[1400px] px-5 py-6">
      <AdminNav current="/admin/cuentas" />
      <Link href="/admin/cuentas" className="text-sm text-muted hover:text-ink">← Cuentas</Link>
      <header className="mt-2 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{w.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${agency ? "bg-ink text-white" : "bg-paper ring-1 ring-line"}`}>{w.kind}</span>
            <span className="font-mono">CUIT {maskCuit(w.cuit)}</span>
            <span>· alta {fmtDay(w.createdAt)}</span>
            <span className={w.verified ? "text-ok" : "font-semibold text-warn"}>· {w.verified ? "verificada" : "sin verificar"}</span>
          </p>
          <p className="mt-1 text-sm">
            {w.phone ? <a href={`tel:+54${w.phone}`} className="font-mono font-semibold text-accent">{formatPhone(w.phone)}</a> : <span className="text-warn">sin teléfono</span>}
            {" · "}
            {w.lat !== null && w.lng !== null ? (
              <a href={`https://www.google.com/maps?q=${w.lat},${w.lng}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">{w.address ?? "ver en el mapa"}</a>
            ) : (
              <span>{w.address ?? w.city ?? "sin dirección"}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/actividad?cuenta=${id}`} className="h-10 rounded-lg border border-line bg-white px-3 text-sm leading-10 font-semibold">Ver actividad</Link>
        </div>
      </header>

      {sp.cortesia && <Ok>Cortesía otorgada.</Ok>}
      {sp.descuento && <Ok>Descuento actualizado.</Ok>}
      {sp.error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">Revisá los datos.</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Total pagado" value={money(u.paid)} />
        {agency ? (
          <>
            <Stat label="Autos seguidos" value={u.followed} />
            <Stat label="Informes" value={u.reports} note={`${u.reportsMonth} este mes`} />
          </>
        ) : (
          <>
            <Stat label="Registros" value={u.records} note={`${u.recordsMonth} este mes`} />
            <Stat label="Autos dados de alta" value={u.vehicles} note={`${u.stickers} stickers asignados`} />
          </>
        )}
        <Stat label="Consultas 30 días" value={u.views30} note={`${u.viewsTotal} en total`} />
        <Stat label="Usuarios" value={users.length} />
        <Stat
          label="Acceso"
          value={access ? (access.paywall ? (access.active ? "Con plan" : "Limitado") : "Libre") : "—"}
          note={access?.paywall && agency ? `${access.reportsLeft} informes disponibles` : access?.paywall ? undefined : "Cobro apagado o cortesía"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Section title="Plan y suscripciones">
            {subs.length === 0 ? <Empty>Nunca tuvo plan.</Empty> : (
              <div className={tableWrap}>
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-[#FAFAF8]"><tr>
                    <th className={th}>Plan</th><th className={th}>Estado</th><th className={`${th} text-right`}>Monto</th><th className={th}>Período</th><th className={th}>Mercado Pago</th><th className={th}>Creada</th>
                  </tr></thead>
                  <tbody>
                    {subs.map((s) => (
                      <tr key={s.id} className="border-b border-line last:border-0">
                        <td className={`${td} font-semibold`}>{PLANS[s.plan].name}{s.reportsQuota > 0 && <span className="block text-xs font-normal text-muted">{s.reportsQuota} informes/mes</span>}</td>
                        <td className={td}><StatusPill status={s.status} map={SUB_STATUS} /></td>
                        <td className={`${td} text-right font-mono`}>{s.status === "courtesy" ? "—" : `${money(s.amount)}/mes`}</td>
                        <td className={`${td} font-mono text-xs whitespace-nowrap`}>{fmtDay(s.periodStart)} → {fmtDay(s.until)}</td>
                        <td className={`${td} font-mono text-xs text-muted`}>{s.mpPreapprovalId ?? "—"}</td>
                        <td className={`${td} text-xs whitespace-nowrap`}>{fmtDay(s.createdAt)}<span className="block text-muted">{s.by ?? ""}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Pagos">
            {pays.length === 0 ? <Empty>Sin pagos registrados.</Empty> : (
              <div className={tableWrap}>
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-[#FAFAF8]"><tr>
                    <th className={th}>Fecha</th><th className={th}>Concepto</th><th className={th}>Estado</th><th className={`${th} text-right`}>Monto</th><th className={`${th} text-right`}>Neto</th><th className={th}>Medio</th><th className={th}>ID MP</th>
                  </tr></thead>
                  <tbody>
                    {pays.map((p) => (
                      <tr key={p.id} className="border-b border-line last:border-0">
                        <td className={`${td} font-mono text-xs whitespace-nowrap`}>{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                        <td className={td}>{p.concept}</td>
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
          </Section>

          {buys.length > 0 && (
            <Section title="Compras de informes extra">
              <div className={tableWrap}>
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-[#FAFAF8]"><tr>
                    <th className={th}>Fecha</th><th className={th}>Producto</th><th className={th}>Estado</th><th className={`${th} text-right`}>Monto</th><th className={`${th} text-right`}>Usados</th>
                  </tr></thead>
                  <tbody>
                    {buys.map((b) => (
                      <tr key={b.id} className="border-b border-line last:border-0">
                        <td className={`${td} font-mono text-xs`}>{fmtDateTime(b.paidAt ?? b.createdAt)}</td>
                        <td className={td}>{PURCHASES[b.kind].name}</td>
                        <td className={td}><StatusPill status={b.status} map={BUY_STATUS} /></td>
                        <td className={`${td} text-right font-mono`}>{money(b.amount)}</td>
                        <td className={`${td} text-right font-mono`}>{b.creditsUsed}/{b.credits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <Section title={`Usuarios (${users.length})`}>
            <div className={tableWrap}>
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-[#FAFAF8]"><tr>
                  <th className={th}>Nombre</th><th className={th}>Email</th><th className={th}>Rol</th><th className={`${th} text-right`}>Registros</th><th className={th}>Última actividad</th><th className={th}>Alta</th>
                </tr></thead>
                <tbody>
                  {users.map((x) => (
                    <tr key={x.id} className="border-b border-line last:border-0">
                      <td className={`${td} font-semibold`}>{x.name}</td>
                      <td className={`${td} text-xs`}>{x.email}</td>
                      <td className={`${td} text-xs`}>{x.role === "owner" ? "Dueño" : agency ? "Vendedor" : "Mecánico"}</td>
                      <td className={`${td} text-right font-mono`}>{x.records}</td>
                      <td className={`${td} font-mono text-xs`}>{fmtDay(x.lastSeen)}</td>
                      <td className={`${td} font-mono text-xs text-muted`}>{fmtDay(x.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <aside className="space-y-4">
          <form action={grantCourtesyAction} className="space-y-2 rounded-xl border border-line bg-white p-4">
            <input type="hidden" name="workshopId" value={w.id} />
            <input type="hidden" name="back" value={back} />
            <p className="font-bold">Plan de cortesía</p>
            <p className="text-xs text-muted">Plan gratis por un tiempo (piloto, acuerdos, compensaciones).</p>
            <select name="plan" className={`${inputCls} w-full`} defaultValue={agency ? "agencia" : "taller_pro"}>
              {(Object.keys(PLANS) as PlanKey[]).filter((k) => PLANS[k].kind === w.kind).map((k) => <option key={k} value={k}>{PLANS[k].name}</option>)}
            </select>
            <label className="block text-xs text-muted">Meses
              <input name="months" type="number" min={1} max={24} defaultValue={6} className={`${inputCls} mt-1 w-full`} />
            </label>
            <button type="submit" className="h-10 w-full rounded-lg bg-ink text-sm font-semibold text-white">Dar cortesía</button>
          </form>
          <form action={setDiscountAction} className="space-y-2 rounded-xl border border-line bg-white p-4">
            <input type="hidden" name="workshopId" value={w.id} />
            <input type="hidden" name="back" value={back} />
            <p className="font-bold">Descuento permanente</p>
            <p className="text-xs text-muted">Aplica a las suscripciones que contrate desde ahora. Actual: {w.discount}%.</p>
            <input name="pct" type="number" min={0} max={100} defaultValue={w.discount} className={`${inputCls} w-full`} aria-label="Porcentaje" />
            <button type="submit" className="h-10 w-full rounded-lg border border-line bg-white text-sm font-semibold">Guardar %</button>
          </form>
        </aside>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
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
  return <p className="rounded-xl border border-dashed border-line bg-white px-4 py-6 text-center text-sm text-muted">{children}</p>;
}
function Ok({ children }: { children?: React.ReactNode }) {
  return <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{children}</p>;
}
