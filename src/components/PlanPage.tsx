import Link from "next/link";
import { buyExtraAction, cancelSubscriptionAction, subscribeAction } from "@/app/actions/billing";
import { accessFor, discountOf, getSettings, syncSubscription } from "@/lib/billing";
import { discounted, formatARS, isActive, PLANS, type PlanKey } from "@/lib/billing-plans";
import type { SessionUser } from "@/lib/auth";
import { getPreapproval, mpConfigured } from "@/lib/mercadopago";
import { db } from "@/lib/db";

const STATUS: Record<string, string> = {
  pending: "Esperando la autorización del débito",
  authorized: "Activo",
  paused: "Pausado",
  cancelled: "Cancelado",
  courtesy: "Cortesía de Legajo",
};

const ERRORS: Record<string, string> = {
  dueno: "Solo el dueño de la cuenta puede contratar o cancelar el plan.",
  pagos: "Los pagos no están disponibles en este momento. Probá más tarde.",
  activa: "Ya tenés un plan activo. Para cambiarlo, cancelá el actual primero.",
};

const day = (d: Date | null) => (d ? d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Mendoza" }) : "—");

/** Plan de la cuenta: estado, cupo, contratar, cancelar e informes extra. La usan la app y el panel. */
export async function PlanPage({ user, sp }: { user: SessionUser; sp: { sub?: string; error?: string; cancelada?: string } }) {
  // Vuelta de Mercado Pago: se consulta el estado sin esperar al aviso.
  if (sp.sub && /^[0-9a-f-]{36}$/i.test(sp.sub) && mpConfigured()) {
    const [row] = await db()<{ mpPreapprovalId: string | null }[]>`
      SELECT mp_preapproval_id FROM subscriptions WHERE id = ${sp.sub} AND workshop_id = ${user.workshopId}
    `;
    if (row?.mpPreapprovalId) {
      try {
        const pre = await getPreapproval(row.mpPreapprovalId);
        await syncSubscription({ id: pre.id, status: pre.status, externalReference: pre.external_reference, nextPaymentDate: pre.next_payment_date ?? null });
      } catch {}
    }
  }

  const agency = user.workshopKind === "agencia";
  const [settings, access, pct] = await Promise.all([getSettings(), accessFor(user), discountOf(user.workshopId)]);
  const sub = access.sub;
  const active = isActive(sub);
  const plans = (Object.keys(PLANS) as PlanKey[]).filter((k) => PLANS[k].kind === user.workshopKind);
  const owner = user.role === "owner";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Plan</h1>
        <p className="mt-1 text-sm text-muted">{user.workshopName}</p>
      </div>

      {sp.error && ERRORS[sp.error] && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">{ERRORS[sp.error]}</p>}
      {sp.cancelada && <p role="status" className="rounded-xl bg-paper px-3.5 py-3 text-sm ring-1 ring-line">Plan cancelado. No se te va a debitar más.</p>}

      {!settings.enabled && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Estás en el <strong>piloto gratuito</strong>: hoy tenés todo habilitado sin pagar. Te avisamos antes de empezar a cobrar.
        </p>
      )}

      <section className="card space-y-3 p-5">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Tu plan</p>
        {sub && sub.status !== "cancelled" ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xl font-bold">{PLANS[sub.plan].name}</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-ok" : "bg-amber-50 text-warn"}`}>{STATUS[sub.status]}</span>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-muted">Precio</dt><dd className="font-mono font-semibold">{sub.status === "courtesy" ? "Sin cargo" : `${formatARS(sub.amount)} / mes`}</dd></div>
              <div><dt className="text-muted">{sub.status === "courtesy" ? "Vence" : "Próximo débito"}</dt><dd className="font-mono font-semibold">{day(sub.currentPeriodEnd)}</dd></div>
              {agency && settings.enabled && (
                <div className="col-span-2"><dt className="text-muted">Informes disponibles</dt><dd className="font-mono font-semibold">{access.reportsLeft}</dd></div>
              )}
            </dl>
            {owner && sub.status !== "courtesy" && (
              <form action={cancelSubscriptionAction}>
                <button type="submit" className="text-sm font-semibold text-muted underline hover:text-ink">Cancelar el plan</button>
              </form>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{settings.enabled ? "Todavía no tenés un plan." : "Piloto gratuito."}</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">{agency ? "Planes para agencias" : "Planes para talleres"}</h2>
        {!agency && (
          <div className="card space-y-1 p-5">
            <div className="flex items-baseline justify-between"><p className="font-bold">Taller</p><p className="font-mono font-semibold">Gratis</p></div>
            <p className="text-sm text-muted">Cargá trabajos y mirá completos los autos que atendés. De los demás, los últimos 2 registros.</p>
          </div>
        )}
        {plans.map((k) => {
          const price = discounted(settings.prices[k], pct);
          const current = sub?.plan === k && active;
          return (
            <div key={k} className={`card space-y-3 p-5 ${current ? "ring-2 ring-accent" : ""}`}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">{PLANS[k].name}</p>
                <p className="font-mono font-semibold">
                  {pct > 0 && <span className="mr-2 text-xs text-muted line-through">{formatARS(settings.prices[k])}</span>}
                  {formatARS(price)}<span className="text-xs font-normal text-muted"> / mes</span>
                </p>
              </div>
              <ul className="space-y-1 text-sm">
                {PLANS[k].features.map((f) => <li key={f}>· {f}</li>)}
              </ul>
              {current ? (
                <p className="text-sm font-semibold text-ok">Es tu plan actual</p>
              ) : owner ? (
                <form action={subscribeAction}>
                  <input type="hidden" name="plan" value={k} />
                  <button type="submit" className="btn-primary">Contratar con Mercado Pago</button>
                </form>
              ) : (
                <p className="text-xs text-muted">Lo contrata el dueño de la cuenta.</p>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted">Débito automático mensual con Mercado Pago. Cancelás cuando quieras desde acá.</p>
      </section>

      {agency && settings.enabled && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="font-bold">Informe extra</p>
            <p className="text-sm text-muted">Para cuando se termina el cupo del mes · {formatARS(settings.prices.report_extra)}</p>
          </div>
          <form action={buyExtraAction}>
            <button type="submit" className="h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold hover:border-ink">Comprar</button>
          </form>
        </section>
      )}

      <p className="text-sm text-muted">
        ¿Dudas con el plan? <Link href="/planes" className="font-semibold text-accent">Ver todos los planes</Link>
      </p>
    </div>
  );
}
