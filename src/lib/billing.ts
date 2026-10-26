import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { issueReport } from "./agency";
import { findVehicleById, listRecords } from "./data";
import { isActive, PLANS, PURCHASES, resolvePrices, type PlanKey, type Prices } from "./billing-plans";
import type { SessionUser } from "./auth";

// ---------- Configuración ----------

export type BillingSettings = { enabled: boolean; prices: Prices };

export async function getSettings(): Promise<BillingSettings> {
  try {
    const [s] = await db()<{ enabled: boolean; prices: Record<string, unknown> }[]>`SELECT enabled, prices FROM billing_settings WHERE id = 1`;
    return { enabled: Boolean(s?.enabled), prices: resolvePrices(s?.prices) };
  } catch {
    return { enabled: false, prices: resolvePrices(null) }; // sin la tabla (antes de migrar): todo gratis
  }
}

export async function saveSettings(enabled: boolean, prices: Prices) {
  await db()`UPDATE billing_settings SET enabled = ${enabled}, prices = ${db().json(prices)}, updated_at = now() WHERE id = 1`;
}

export async function discountOf(workshopId: string): Promise<number> {
  const [w] = await db()<{ pct: number }[]>`SELECT price_discount_pct AS pct FROM workshops WHERE id = ${workshopId}`;
  return w?.pct ?? 0;
}

// ---------- Suscripciones ----------

export type Subscription = {
  id: string;
  workshopId: string;
  plan: PlanKey;
  status: "pending" | "authorized" | "paused" | "cancelled" | "courtesy";
  amount: number;
  reportsQuota: number;
  mpPreapprovalId: string | null;
  periodStart: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
};

/** La suscripción que cuenta para la cuenta: la vigente más reciente o, si no hay, la última. */
export async function currentSubscription(workshopId: string): Promise<Subscription | null> {
  const rows = await db()<Subscription[]>`
    SELECT id, workshop_id, plan, status, amount, reports_quota, mp_preapproval_id, period_start, current_period_end, created_at
    FROM subscriptions WHERE workshop_id = ${workshopId} ORDER BY created_at DESC LIMIT 20
  `;
  return rows.find((s) => isActive(s)) ?? rows[0] ?? null;
}

export type Access = {
  paywall: boolean;
  sub: Subscription | null;
  active: boolean; // tiene un plan vigente
  reportsLeft: number; // informes del cupo + extras
};

/** Qué puede hacer la cuenta según la llave de cobro y su plan. */
export async function accessFor(user: SessionUser): Promise<Access> {
  const settings = await getSettings();
  if (!settings.enabled) return { paywall: false, sub: null, active: true, reportsLeft: Infinity };
  const sub = await currentSubscription(user.workshopId);
  const active = isActive(sub);
  const left = active && sub ? Math.max(0, sub.reportsQuota - (await reportsUsed(user.workshopId, sub))) : 0;
  return { paywall: true, sub, active, reportsLeft: left + (await extraCredits(user.workshopId)) };
}

async function reportsUsed(workshopId: string, sub: Subscription): Promise<number> {
  const since = sub.periodStart ?? sub.createdAt;
  const [r] = await db()<{ n: number }[]>`
    SELECT count(*)::int AS n FROM verified_reports WHERE workshop_id = ${workshopId} AND purchase_id IS NULL AND issued_at >= ${since}
  `;
  return r.n;
}

async function extraCredits(workshopId: string): Promise<number> {
  const [r] = await db()<{ n: number }[]>`
    SELECT coalesce(sum(credits - credits_used), 0)::int AS n FROM purchases
    WHERE workshop_id = ${workshopId} AND kind = 'report_extra' AND status = 'approved'
  `;
  return r.n;
}

/** ¿Ve el historial completo de este auto? Sin cobro: sí. Agencia: con plan. Taller: si lo atendió o con Taller Pro. */
export async function seesFullHistory(user: SessionUser, vehicleId: string, access?: Access): Promise<boolean> {
  const a = access ?? (await accessFor(user));
  if (!a.paywall || a.active) return true;
  if (user.workshopKind === "agencia") return false;
  const [r] = await db()<{ own: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM vehicles WHERE id = ${vehicleId} AND created_by_workshop = ${user.workshopId})
        OR EXISTS (SELECT 1 FROM service_records WHERE vehicle_id = ${vehicleId} AND workshop_id = ${user.workshopId}) AS own
  `;
  return r.own;
}

/**
 * Emite un informe de agencia descontando del cupo del plan o, si se terminó, de un informe extra comprado.
 * Devuelve el código o el motivo por el que no se pudo.
 */
export async function issueAgencyReport(user: SessionUser, vehicleId: string): Promise<{ code: string } | { error: "plan" | "cupo" }> {
  const access = await accessFor(user);
  const vehicle = await findVehicleById(vehicleId);
  if (!vehicle) throw new Error("Auto inexistente");
  const records = await listRecords(vehicle.id);
  if (!access.paywall) return { code: await issueReport(user, vehicle, records) };
  if (!access.active && access.reportsLeft === 0) return { error: "plan" };

  const quotaLeft = access.active && access.sub ? access.sub.reportsQuota - (await reportsUsed(user.workshopId, access.sub)) : 0;
  if (quotaLeft > 0) return { code: await issueReport(user, vehicle, records) };

  // Sin cupo: usar un informe extra (se descuenta de forma atómica).
  const [extra] = await db()<{ id: string }[]>`
    UPDATE purchases SET credits_used = credits_used + 1
    WHERE id = (
      SELECT id FROM purchases WHERE workshop_id = ${user.workshopId} AND kind = 'report_extra' AND status = 'approved'
        AND credits_used < credits ORDER BY paid_at LIMIT 1 FOR UPDATE SKIP LOCKED
    ) RETURNING id
  `;
  if (!extra) return { error: "cupo" };
  return { code: await issueReport(user, vehicle, records, extra.id) };
}

export async function createSubscriptionRow(workshopId: string, plan: PlanKey, amount: number, userId: string): Promise<string> {
  const [s] = await db()<{ id: string }[]>`
    INSERT INTO subscriptions (workshop_id, plan, status, amount, reports_quota, created_by)
    VALUES (${workshopId}, ${plan}, 'pending', ${amount}, ${PLANS[plan].quota}, ${userId}) RETURNING id
  `;
  return s.id;
}

export async function attachPreapproval(subId: string, preapprovalId: string) {
  await db()`UPDATE subscriptions SET mp_preapproval_id = ${preapprovalId}, updated_at = now() WHERE id = ${subId}`;
}

/** Actualiza la suscripción con el estado que informa Mercado Pago. */
export async function syncSubscription(p: { id: string; status: string; externalReference: string | null; nextPaymentDate: string | null }) {
  const subId = p.externalReference?.startsWith("sub:") ? p.externalReference.slice(4) : null;
  const status = ["pending", "authorized", "paused", "cancelled"].includes(p.status) ? p.status : null;
  if (!status) return "estado desconocido";
  const next = p.nextPaymentDate ? new Date(p.nextPaymentDate) : null;
  const rows = await db()`
    UPDATE subscriptions SET
      status = ${status},
      mp_preapproval_id = ${p.id},
      current_period_end = coalesce(${next}::timestamptz, current_period_end),
      period_start = CASE WHEN ${status} = 'authorized' AND period_start IS NULL THEN now() ELSE period_start END,
      updated_at = now()
    WHERE mp_preapproval_id = ${p.id} OR id::text = ${subId ?? ""}
    RETURNING id
  `;
  return rows.length ? `suscripción ${status}` : "suscripción no encontrada";
}

/** Cada débito mensual aprobado reinicia el cupo de informes. */
export async function renewSubscription(preapprovalId: string, paidAt: Date, nextPaymentDate: string | null) {
  const next = nextPaymentDate ? new Date(nextPaymentDate) : new Date(paidAt.getTime() + 31 * 86_400_000);
  const rows = await db()`
    UPDATE subscriptions SET status = 'authorized', period_start = ${paidAt}, current_period_end = ${next}, updated_at = now()
    WHERE mp_preapproval_id = ${preapprovalId} RETURNING id
  `;
  return rows.length ? "período renovado" : "suscripción no encontrada";
}

export async function setSubscriptionStatus(subId: string, status: "cancelled") {
  await db()`UPDATE subscriptions SET status = ${status}, updated_at = now() WHERE id = ${subId}`;
}

/** Cortesía del admin: plan gratis por N meses (piloto, acuerdos, compensaciones). */
export async function grantCourtesy(workshopId: string, plan: PlanKey, months: number, adminId: string) {
  await db()`
    INSERT INTO subscriptions (workshop_id, plan, status, amount, reports_quota, period_start, current_period_end, created_by)
    VALUES (${workshopId}, ${plan}, 'courtesy', 0, ${PLANS[plan].quota}, now(), now() + make_interval(months => ${months}), ${adminId})
  `;
}

// ---------- Compras únicas ----------

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export type Purchase = {
  id: string;
  kind: keyof typeof PURCHASES;
  amount: number;
  status: "pending" | "approved" | "rejected" | "refunded";
  vehicleId: string | null;
  workshopId: string | null;
  credits: number;
  creditsUsed: number;
  createdAt: Date;
  paidAt: Date | null;
};

export async function createPurchase(input: { kind: keyof typeof PURCHASES; amount: number; vehicleId: string | null; workshopId: string | null; email: string | null }) {
  const token = randomBytes(18).toString("base64url");
  const [p] = await db()<{ id: string }[]>`
    INSERT INTO purchases (kind, amount, vehicle_id, workshop_id, email, credits, access_token_hash)
    VALUES (${input.kind}, ${input.amount}, ${input.vehicleId}, ${input.workshopId}, ${input.email}, ${PURCHASES[input.kind].credits}, ${hashToken(token)})
    RETURNING id
  `;
  return { id: p.id, token };
}

export async function setPurchasePreference(id: string, preferenceId: string) {
  await db()`UPDATE purchases SET mp_preference_id = ${preferenceId} WHERE id = ${id}`;
}

/** La compra se abre solo con su token (el que va en el link de vuelta de Mercado Pago). */
export async function findPurchase(id: string, token: string): Promise<Purchase | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await db()<Purchase[]>`
    SELECT id, kind, amount, status, vehicle_id, workshop_id, credits, credits_used, created_at, paid_at
    FROM purchases WHERE id = ${id} AND access_token_hash = ${hashToken(token)}
  `;
  return rows[0] ?? null;
}

export async function purchaseReports(purchaseId: string): Promise<{ code: string; plate: string; make: string; model: string; issuedAt: Date }[]> {
  return db()`
    SELECT r.code, v.plate, v.make, v.model, r.issued_at FROM verified_reports r JOIN vehicles v ON v.id = r.vehicle_id
    WHERE r.purchase_id = ${purchaseId} AND r.workshop_id IS NULL ORDER BY r.issued_at
  `;
}

/**
 * Marca una compra como pagada (una sola vez, aunque el aviso llegue repetido) y, si es el informe de un auto,
 * lo emite en el momento.
 */
export async function approvePurchase(purchaseId: string, paymentId: string, amount: number): Promise<string> {
  const rows = await db()<Purchase[]>`
    UPDATE purchases SET status = 'approved', mp_payment_id = ${paymentId}, paid_at = now()
    WHERE id = ${purchaseId} AND status = 'pending' AND amount <= ${Math.ceil(amount)}
    RETURNING id, kind, amount, status, vehicle_id, workshop_id, credits, credits_used, created_at, paid_at
  `;
  const p = rows[0];
  if (!p) return "compra ya procesada o monto distinto";
  if (p.vehicleId && p.kind !== "report_extra") await redeemCredit(p.id, p.vehicleId);
  return "compra aprobada";
}

export async function rejectPurchase(purchaseId: string, paymentId: string, status: "rejected" | "refunded") {
  await db()`UPDATE purchases SET status = ${status}, mp_payment_id = coalesce(mp_payment_id, ${paymentId}) WHERE id = ${purchaseId} AND status IN ('pending', 'approved')`;
}

/** Usa un crédito de un pack para emitir el informe de un auto (lo emite Legajo). */
export async function redeemCredit(purchaseId: string, vehicleId: string): Promise<string | null> {
  const existing = await db()<{ code: string }[]>`
    SELECT code FROM verified_reports WHERE purchase_id = ${purchaseId} AND vehicle_id = ${vehicleId} AND workshop_id IS NULL
  `;
  if (existing[0]) return existing[0].code; // ya tenía el informe de ese auto: no se descuenta otro crédito
  const [ok] = await db()<{ id: string }[]>`
    UPDATE purchases SET credits_used = credits_used + 1
    WHERE id = ${purchaseId} AND status = 'approved' AND credits_used < credits AND kind <> 'report_extra' RETURNING id
  `;
  if (!ok) return null;
  const vehicle = await findVehicleById(vehicleId);
  if (!vehicle) return null;
  return issueReport(null, vehicle, await listRecords(vehicle.id), purchaseId);
}

export async function logMpEvent(topic: string, resourceId: string, result: string) {
  try {
    await db()`INSERT INTO mp_events (topic, resource_id, result) VALUES (${topic}, ${resourceId}, ${result})`;
  } catch {}
}
