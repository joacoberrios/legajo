import "server-only";

/**
 * Cliente mínimo de la API de Mercado Pago (sin SDK). El Access Token vive solo en la variable de
 * entorno MP_ACCESS_TOKEN: el de prueba para probar y el de producción para cobrar de verdad.
 */
const API = "https://api.mercadopago.com";

export function mpConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

/** Las credenciales de prueba de Mercado Pago empiezan con TEST- o son de un usuario de prueba. */
export function mpMode(): "prueba" | "produccion" | "sin configurar" {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) return "sin configurar";
  return t.startsWith("TEST-") || process.env.MP_TEST_MODE === "true" ? "prueba" : "produccion";
}

async function mp<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MP_ACCESS_TOKEN");
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Mercado Pago ${res.status} en ${path}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

export type Preference = { id: string; init_point: string; sandbox_init_point?: string };

/** Checkout Pro: pago único. Devuelve el link de pago. */
export function createPreference(input: {
  title: string;
  amount: number;
  externalReference: string;
  backUrl: string;
  notificationUrl: string;
  email?: string | null;
}) {
  return mp<Preference>("/checkout/preferences", {
    method: "POST",
    idempotencyKey: input.externalReference,
    body: {
      items: [{ id: input.externalReference, title: input.title, quantity: 1, unit_price: input.amount, currency_id: "ARS" }],
      external_reference: input.externalReference,
      back_urls: { success: input.backUrl, pending: input.backUrl, failure: input.backUrl },
      auto_return: "approved",
      notification_url: input.notificationUrl,
      statement_descriptor: "LEGAJO",
      ...(input.email ? { payer: { email: input.email } } : {}),
    },
  });
}

export type Payment = {
  id: number;
  status: string;
  status_detail: string;
  external_reference: string | null;
  transaction_amount: number;
  date_approved: string | null;
  date_created?: string | null;
  payment_method_id?: string | null;
  payer?: { email?: string | null } | null;
  transaction_details?: { net_received_amount?: number | null } | null;
  metadata?: Record<string, unknown> | null;
  preapproval_id?: string | null;
  point_of_interaction?: { transaction_data?: { subscription_id?: string | null } | null } | null;
};

export function getPayment(id: string) {
  return mp<Payment>(`/v1/payments/${encodeURIComponent(id)}`);
}

export type Preapproval = {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  init_point: string;
  external_reference: string | null;
  next_payment_date?: string | null;
  auto_recurring?: { transaction_amount: number };
};

/** Suscripción mensual con débito automático (preapproval sin plan asociado). */
export function createPreapproval(input: { reason: string; amount: number; externalReference: string; payerEmail: string; backUrl: string }) {
  return mp<Preapproval>("/preapproval", {
    method: "POST",
    body: {
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: input.amount, currency_id: "ARS" },
      back_url: input.backUrl,
      status: "pending",
    },
  });
}

export function getPreapproval(id: string) {
  return mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`);
}

export function cancelPreapproval(id: string) {
  return mp<Preapproval>(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: { status: "cancelled" } });
}

export type AuthorizedPayment = { id: number; preapproval_id: string; status: string; date_created?: string; payment?: { id: number; status: string } };

export function getAuthorizedPayment(id: string) {
  return mp<AuthorizedPayment>(`/authorized_payments/${encodeURIComponent(id)}`);
}
