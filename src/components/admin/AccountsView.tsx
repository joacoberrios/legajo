import Link from "next/link";
import { fmtDay, inputCls, money, StatusPill, SUB_STATUS, tableWrap, td, th } from "@/components/admin/AdminNav";
import { PLANS, type PlanKey } from "@/lib/billing-plans";
import { maskCuit } from "@/lib/cuit";
import { db } from "@/lib/db";

type Row = {
  id: string;
  name: string;
  kind: "taller" | "agencia";
  cuit: string;
  city: string | null;
  verified: boolean;
  createdAt: Date;
  discount: number;
  users: number;
  ownerName: string | null;
  ownerEmail: string | null;
  plan: PlanKey | null;
  subStatus: string | null;
  until: Date | null;
  records: number;
  vehicles: number;
  followed: number;
  reports: number;
  views30: number;
  lastActivity: Date | null;
  paid: string;
};

const SORTS = { actividad: "Última actividad", alta: "Alta", nombre: "Nombre", pagado: "Total pagado", registros: "Registros" } as const;
type Sort = keyof typeof SORTS;

/** Todas las cuentas (talleres y agencias) con su plan, uso y lo que pagaron. */
export async function AccountsView({ sp, base }: { sp: Record<string, string | undefined>; base: string }) {
  const q = (sp.q ?? "").trim().slice(0, 60);
  const kind = sp.tipo === "taller" || sp.tipo === "agencia" ? sp.tipo : "";
  const plan = sp.plan && (sp.plan === "sin" || sp.plan === "cortesia" || sp.plan in PLANS) ? sp.plan : "";
  const sort: Sort = sp.orden && sp.orden in SORTS ? (sp.orden as Sort) : "actividad";
  const like = `%${q}%`;

  const rows = await db()<Row[]>`
    SELECT * FROM (
      SELECT w.id, w.name, w.kind, w.cuit, w.city, w.verified, w.created_at, w.price_discount_pct AS discount,
        (SELECT count(*) FROM users u WHERE u.workshop_id = w.id)::int AS users,
        o.name AS owner_name, o.email AS owner_email,
        s.plan, s.status AS sub_status, s.current_period_end AS until,
        (SELECT count(*) FROM service_records r WHERE r.workshop_id = w.id)::int AS records,
        (SELECT count(*) FROM vehicles v WHERE v.created_by_workshop = w.id)::int AS vehicles,
        (SELECT count(*) FROM agency_vehicles av WHERE av.workshop_id = w.id)::int AS followed,
        (SELECT count(*) FROM verified_reports vr WHERE vr.workshop_id = w.id)::int AS reports,
        (SELECT coalesce(sum(vv.count), 0) FROM vehicle_views vv WHERE vv.workshop_id = w.id AND vv.view_date >= current_date - 30)::int AS views30,
        greatest(
          (SELECT max(r.created_at) FROM service_records r WHERE r.workshop_id = w.id),
          (SELECT max(vv.last_at) FROM vehicle_views vv WHERE vv.workshop_id = w.id)
        ) AS last_activity,
        (SELECT coalesce(sum(p.amount), 0) FROM payments p WHERE p.workshop_id = w.id AND p.status = 'approved')::text AS paid
      FROM workshops w
      LEFT JOIN LATERAL (SELECT name, email FROM users WHERE workshop_id = w.id AND role = 'owner' ORDER BY created_at LIMIT 1) o ON true
      LEFT JOIN LATERAL (SELECT plan, status, current_period_end FROM subscriptions WHERE workshop_id = w.id ORDER BY created_at DESC LIMIT 1) s ON true
    ) a
    WHERE (${q} = '' OR a.name ILIKE ${like} OR a.cuit ILIKE ${like} OR coalesce(a.owner_email, '') ILIKE ${like} OR coalesce(a.city, '') ILIKE ${like})
      AND (${kind} = '' OR a.kind = ${kind})
      AND (${plan} = ''
        OR (${plan} = 'sin' AND (a.plan IS NULL OR a.sub_status = 'cancelled'))
        OR (${plan} = 'cortesia' AND a.sub_status = 'courtesy')
        OR (a.plan = ${plan} AND a.sub_status <> 'cancelled'))
    ORDER BY
      CASE WHEN ${sort} = 'actividad' THEN a.last_activity END DESC NULLS LAST,
      CASE WHEN ${sort} = 'alta' THEN a.created_at END DESC,
      CASE WHEN ${sort} = 'nombre' THEN a.name END ASC,
      CASE WHEN ${sort} = 'pagado' THEN a.paid::numeric END DESC,
      CASE WHEN ${sort} = 'registros' THEN a.records END DESC,
      a.name ASC
  `;

  const talleres = rows.filter((r) => r.kind === "taller").length;
  const conPlan = rows.filter((r) => r.plan && r.subStatus !== "cancelled").length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Cuentas</h1>
          <p className="text-sm text-muted">{rows.length} cuentas · {talleres} talleres · {rows.length - talleres} agencias · {conPlan} con plan</p>
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <input name="q" defaultValue={q} placeholder="Nombre, CUIT, email o ciudad" className={`${inputCls} w-64`} />
          <select name="tipo" defaultValue={kind} className={inputCls} aria-label="Tipo">
            <option value="">Talleres y agencias</option>
            <option value="taller">Talleres</option>
            <option value="agencia">Agencias</option>
          </select>
          <select name="plan" defaultValue={plan} className={inputCls} aria-label="Plan">
            <option value="">Todos los planes</option>
            <option value="sin">Sin plan</option>
            <option value="cortesia">Cortesía</option>
            {(Object.keys(PLANS) as PlanKey[]).map((k) => <option key={k} value={k}>{PLANS[k].name}</option>)}
          </select>
          <select name="orden" defaultValue={sort} className={inputCls} aria-label="Orden">
            {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k]}</option>)}
          </select>
          <button type="submit" className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">Filtrar</button>
        </form>
      </div>

      <div className={tableWrap}>
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-[#FAFAF8]">
            <tr>
              <th className={th}>Cuenta</th>
              <th className={th}>Dueño</th>
              <th className={th}>Plan</th>
              <th className={`${th} text-right`}>Usuarios</th>
              <th className={`${th} text-right`}>Uso</th>
              <th className={`${th} text-right`}>Consultas 30 d</th>
              <th className={`${th} text-right`}>Pagado</th>
              <th className={th}>Actividad</th>
              <th className={th}>Alta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-[#FAFAF8]">
                <td className={td}>
                  <Link href={`${base}/cuentas/${r.id}`} className="font-semibold hover:text-accent">{r.name}</Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${r.kind === "agencia" ? "bg-ink text-white" : "bg-paper ring-1 ring-line"}`}>{r.kind}</span>
                    <span className="font-mono">{maskCuit(r.cuit)}</span>
                    {r.city && <span>· {r.city}</span>}
                    {!r.verified && <span className="font-semibold text-warn">· sin verificar</span>}
                  </div>
                </td>
                <td className={`${td} text-xs`}>
                  <div className="font-semibold">{r.ownerName ?? "—"}</div>
                  <div className="text-muted">{r.ownerEmail}</div>
                </td>
                <td className={td}>
                  {r.plan && r.subStatus !== "cancelled" ? (
                    <>
                      <div className="font-semibold">{PLANS[r.plan].name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <StatusPill status={r.subStatus ?? ""} map={SUB_STATUS} /> hasta {fmtDay(r.until)}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted">{r.kind === "taller" ? "Gratis" : "Sin plan"}</span>
                  )}
                  {r.discount > 0 && <div className="mt-0.5 text-xs font-semibold text-accent">-{r.discount}%</div>}
                </td>
                <td className={`${td} text-right font-mono`}>{r.users}</td>
                <td className={`${td} text-right font-mono text-xs whitespace-nowrap`}>
                  {r.kind === "taller" ? (
                    <>{r.records} registros<br /><span className="text-muted">{r.vehicles} altas</span></>
                  ) : (
                    <>{r.followed} autos<br /><span className="text-muted">{r.reports} informes</span></>
                  )}
                </td>
                <td className={`${td} text-right font-mono`}>{r.views30}</td>
                <td className={`${td} text-right font-mono`}>{money(r.paid)}</td>
                <td className={`${td} font-mono text-xs whitespace-nowrap`}>{fmtDay(r.lastActivity)}</td>
                <td className={`${td} font-mono text-xs whitespace-nowrap text-muted`}>{fmtDay(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">No hay cuentas con esos filtros.</p>}
      </div>
    </>
  );
}
