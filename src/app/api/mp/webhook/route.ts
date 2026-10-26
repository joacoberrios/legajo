import { NextResponse } from "next/server";
import { approvePurchase, logMpEvent, recordPayment, rejectPurchase, renewSubscription, syncSubscription } from "@/lib/billing";
import { getAuthorizedPayment, getPayment, getPreapproval } from "@/lib/mercadopago";
import { verifyMpSignature } from "@/lib/mp-signature";

/**
 * Avisos de Mercado Pago. Nunca se confía en el contenido del aviso: con el id se consulta el recurso
 * en la API de Mercado Pago (con nuestro Access Token) y se actúa según lo que devuelve.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let body: { type?: string; topic?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await request.json();
  } catch {}
  const topic = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!topic || !id) return NextResponse.json({ ok: true, ignored: true });

  const secret = process.env.MP_WEBHOOK_SECRET;
  if (secret) {
    const valid = verifyMpSignature({
      secret,
      signature: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      dataId: url.searchParams.get("data.id") ?? id,
    });
    if (!valid) {
      await logMpEvent(topic, id, "firma inválida");
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  try {
    const result = await handle(topic, id);
    await logMpEvent(topic, id, result);
    return NextResponse.json({ ok: true });
  } catch (e) {
    await logMpEvent(topic, id, `error: ${String(e).slice(0, 200)}`);
    // 500 = Mercado Pago reintenta más tarde.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

async function handle(topic: string, id: string): Promise<string> {
  if (topic === "payment") {
    const p = await getPayment(id);
    await recordPayment(p);
    const ref = p.external_reference ?? "";
    if (!ref.startsWith("buy:")) return `pago ${p.status} registrado`;
    const purchaseId = ref.slice(4);
    if (p.status === "approved") return approvePurchase(purchaseId, String(p.id), p.transaction_amount);
    if (p.status === "rejected" || p.status === "cancelled") {
      await rejectPurchase(purchaseId, String(p.id), "rejected");
      return "compra rechazada";
    }
    if (p.status === "refunded" || p.status === "charged_back") {
      await rejectPurchase(purchaseId, String(p.id), "refunded");
      return "compra devuelta";
    }
    return `pago ${p.status}`;
  }
  if (topic === "subscription_preapproval" || topic === "preapproval") {
    const pre = await getPreapproval(id);
    return syncSubscription({ id: pre.id, status: pre.status, externalReference: pre.external_reference, nextPaymentDate: pre.next_payment_date ?? null });
  }
  if (topic === "subscription_authorized_payment" || topic === "authorized_payment") {
    const ap = await getAuthorizedPayment(id);
    if (ap.payment?.id) await recordPayment(await getPayment(String(ap.payment.id)), ap.preapproval_id);
    const approved = ap.payment?.status === "approved" || ap.status === "processed";
    if (!approved) return `débito ${ap.status}`;
    const pre = await getPreapproval(ap.preapproval_id);
    return renewSubscription(ap.preapproval_id, ap.date_created ? new Date(ap.date_created) : new Date(), pre.next_payment_date ?? null);
  }
  return `tema ${topic} ignorado`;
}

// Mercado Pago a veces prueba la URL con GET.
export async function GET() {
  return NextResponse.json({ ok: true });
}
