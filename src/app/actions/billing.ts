"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import {
  attachPreapproval,
  createPurchase,
  createSubscriptionRow,
  currentSubscription,
  discountOf,
  findPurchase,
  getSettings,
  grantCourtesy,
  redeemCredit,
  saveSettings,
  setPurchasePreference,
  setSubscriptionStatus,
} from "@/lib/billing";
import { DEFAULT_PRICES, discounted, isActive, PLANS, PURCHASES, resolvePrices, type PlanKey, type PriceKey } from "@/lib/billing-plans";
import { db } from "@/lib/db";
import { findVehicleByPlate, findVehicleBySlug } from "@/lib/data";
import { cancelPreapproval, createPreapproval, createPreference, mpConfigured } from "@/lib/mercadopago";
import { normalizePlate } from "@/lib/plate";
import { appUrl } from "@/lib/url";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);
/** Vuelta a una pantalla del admin (solo rutas internas /admin/...). */
const adminBack = (f: FormData) => {
  const b = text(f, "back");
  return /^\/admin(\/[\w-]+)*$/.test(b) ? b : "/admin/cobros";
};

// ---------- Particulares ----------

/** Comprar el informe verificado de un auto (o un pack de 3) desde el informe público. */
export async function buyReportAction(form: FormData) {
  const slug = text(form, "slug");
  const kind = text(form, "kind") === "report_pack3" ? "report_pack3" : "report_single";
  const email = text(form, "email").toLowerCase().slice(0, 120);
  const vehicle = await findVehicleBySlug(slug);
  if (!vehicle) redirect("/");
  if (!mpConfigured()) redirect(`/i/${slug}?pago=no-disponible`);

  const { prices } = await getSettings();
  const amount = prices[kind];
  const { id, token } = await createPurchase({ kind, amount, vehicleId: vehicle.id, workshopId: null, email: /^\S+@\S+\.\S+$/.test(email) ? email : null });
  const base = await appUrl();
  const pref = await createPreference({
    title: `${PURCHASES[kind].name} · ${vehicle.make} ${vehicle.model}`,
    amount,
    externalReference: `buy:${id}`,
    backUrl: `${base}/compra/${id}?t=${token}`,
    notificationUrl: `${base}/api/mp/webhook`,
    email: /^\S+@\S+\.\S+$/.test(email) ? email : null,
  });
  await setPurchasePreference(id, pref.id);
  redirect(pref.init_point);
}

/** Usar otro crédito del pack para el informe de otra patente. */
export async function redeemAction(form: FormData) {
  const id = text(form, "id");
  const token = text(form, "t");
  const purchase = await findPurchase(id, token);
  if (!purchase) redirect("/");
  const back = `/compra/${id}?t=${encodeURIComponent(token)}`;
  const vehicle = await findVehicleByPlate(normalizePlate(text(form, "plate")));
  if (!vehicle) redirect(`${back}&error=patente`);
  const code = await redeemCredit(purchase.id, vehicle.id);
  if (!code) redirect(`${back}&error=creditos`);
  redirect(`/v/${code}?nuevo=1`);
}

// ---------- Cuentas (agencias y talleres) ----------

export async function subscribeAction(form: FormData) {
  const user = await requireUser();
  const plan = text(form, "plan") as PlanKey;
  if (!(plan in PLANS) || PLANS[plan].kind !== user.workshopKind) redirect("/taller/plan");
  if (user.role !== "owner") redirect("/taller/plan?error=dueno");
  if (!mpConfigured()) redirect("/taller/plan?error=pagos");
  const current = await currentSubscription(user.workshopId);
  if (current && isActive(current) && current.status === "authorized") redirect("/taller/plan?error=activa");

  const { prices } = await getSettings();
  const amount = discounted(prices[plan], await discountOf(user.workshopId));
  const subId = await createSubscriptionRow(user.workshopId, plan, amount, user.id);
  const base = await appUrl();
  const pre = await createPreapproval({
    reason: `Legajo ${PLANS[plan].name} · ${user.workshopName}`,
    amount,
    externalReference: `sub:${subId}`,
    payerEmail: user.email,
    backUrl: `${base}/taller/plan?sub=${subId}`,
  });
  await attachPreapproval(subId, pre.id);
  redirect(pre.init_point);
}

export async function cancelSubscriptionAction() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/taller/plan?error=dueno");
  const sub = await currentSubscription(user.workshopId);
  if (!sub || sub.status === "cancelled") redirect("/taller/plan");
  if (sub.mpPreapprovalId) await cancelPreapproval(sub.mpPreapprovalId);
  await setSubscriptionStatus(sub.id, "cancelled");
  revalidatePath("/taller/plan");
  redirect("/taller/plan?cancelada=1");
}

/** Informe extra para agencias que se quedaron sin cupo. */
export async function buyExtraAction() {
  const user = await requireUser();
  if (user.workshopKind !== "agencia") redirect("/taller/plan");
  if (!mpConfigured()) redirect("/taller/plan?error=pagos");
  const { prices } = await getSettings();
  const { id, token } = await createPurchase({ kind: "report_extra", amount: prices.report_extra, vehicleId: null, workshopId: user.workshopId, email: user.email });
  const base = await appUrl();
  const pref = await createPreference({
    title: `${PURCHASES.report_extra.name} · ${user.workshopName}`,
    amount: prices.report_extra,
    externalReference: `buy:${id}`,
    backUrl: `${base}/compra/${id}?t=${token}`,
    notificationUrl: `${base}/api/mp/webhook`,
    email: user.email,
  });
  await setPurchasePreference(id, pref.id);
  redirect(pref.init_point);
}

// ---------- Admin ----------

export async function saveBillingAction(form: FormData) {
  await requireAdmin();
  const enabled = form.get("enabled") === "on";
  const raw: Record<string, number> = {};
  for (const k of Object.keys(DEFAULT_PRICES) as PriceKey[]) raw[k] = Number(text(form, k).replace(/\D/g, ""));
  await saveSettings(enabled, resolvePrices(raw));
  revalidatePath("/admin/cobros");
  redirect("/admin/cobros?guardado=1");
}

export async function grantCourtesyAction(form: FormData) {
  const admin = await requireAdmin();
  const workshopId = text(form, "workshopId");
  const plan = text(form, "plan") as PlanKey;
  const months = Math.floor(Number(text(form, "months")));
  const back = adminBack(form);
  if (!isUuid(workshopId) || !(plan in PLANS) || !(months >= 1 && months <= 24)) redirect(`${back}?error=cortesia`);
  await grantCourtesy(workshopId, plan, months, admin.id);
  revalidatePath(back);
  redirect(`${back}?cortesia=1`);
}

export async function setDiscountAction(form: FormData) {
  await requireAdmin();
  const workshopId = text(form, "workshopId");
  const pct = Math.floor(Number(text(form, "pct")));
  const back = adminBack(form);
  if (!isUuid(workshopId) || !(pct >= 0 && pct <= 100)) redirect(`${back}?error=descuento`);
  await db()`UPDATE workshops SET price_discount_pct = ${pct} WHERE id = ${workshopId}`;
  revalidatePath(back);
  redirect(`${back}?descuento=1`);
}
