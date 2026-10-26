import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redeemAction } from "@/app/actions/billing";
import { Plate } from "@/components/Plate";
import { Wordmark } from "@/components/Wordmark";
import { approvePurchase, findPurchase, purchaseReports, rejectPurchase } from "@/lib/billing";
import { formatARS, PURCHASES } from "@/lib/billing-plans";
import { getPayment, mpConfigured } from "@/lib/mercadopago";
import { formatStickerCode } from "@/lib/sticker-code";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu compra · Legajo", robots: { index: false, follow: false } };

/**
 * Vuelta de Mercado Pago. Si el aviso (webhook) todavía no llegó, se consulta el pago acá mismo
 * con el id que manda Mercado Pago en la URL, así el comprador no espera.
 */
export default async function PurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; payment_id?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const token = sp.t ?? "";
  let purchase = await findPurchase(id, token);
  if (!purchase) notFound();

  if (purchase.status === "pending" && sp.payment_id && /^\d+$/.test(sp.payment_id) && mpConfigured()) {
    try {
      const p = await getPayment(sp.payment_id);
      if (p.external_reference === `buy:${purchase.id}`) {
        if (p.status === "approved") await approvePurchase(purchase.id, String(p.id), p.transaction_amount);
        else if (p.status === "rejected" || p.status === "cancelled") await rejectPurchase(purchase.id, String(p.id), "rejected");
      }
    } catch {}
    purchase = (await findPurchase(id, token)) ?? purchase;
  }

  const reports = purchase.status === "approved" ? await purchaseReports(purchase.id) : [];
  const left = purchase.credits - purchase.creditsUsed;
  const self = `/compra/${purchase.id}?t=${encodeURIComponent(token)}`;

  return (
    <main className="min-h-dvh space-y-6 bg-white px-5 py-8">
      <Link href="/" aria-label="Legajo" className="inline-block"><Wordmark height={20} color="#15171a" dot="#C2410C" /></Link>

      <section className="space-y-1">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">{PURCHASES[purchase.kind].name}</p>
        <p className="text-sm text-muted">{formatARS(purchase.amount)} · {purchase.createdAt.toLocaleDateString("es-AR")}</p>
      </section>

      {purchase.status === "pending" && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold">Esperando la confirmación del pago</h1>
          <p className="text-sm text-muted">Mercado Pago nos avisa en unos segundos. Si pagaste en efectivo, puede tardar hasta que se acredite.</p>
          <Link href={self} className="btn-secondary">Actualizar</Link>
        </section>
      )}

      {purchase.status === "rejected" && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold">El pago no se aprobó</h1>
          <p className="text-sm text-muted">No se te cobró nada. Podés intentar de nuevo con otro medio de pago.</p>
          <Link href="/" className="btn-secondary">Volver</Link>
        </section>
      )}

      {purchase.status === "refunded" && (
        <section className="space-y-2">
          <h1 className="text-2xl font-bold">Compra devuelta</h1>
          <p className="text-sm text-muted">El pago fue devuelto y los informes de esta compra quedaron sin efecto.</p>
        </section>
      )}

      {purchase.status === "approved" && purchase.kind === "report_extra" && (
        <section className="space-y-3">
          <h1 className="text-2xl font-bold">Informe extra acreditado</h1>
          <p className="text-sm text-muted">Ya podés emitir un informe verificado más desde la ficha de cualquier auto.</p>
          <Link href="/taller/plan" className="btn-primary">Ir a mi plan</Link>
        </section>
      )}

      {purchase.status === "approved" && purchase.kind !== "report_extra" && (
        <section className="space-y-5">
          <h1 className="text-2xl font-bold">¡Listo! Pago aprobado</h1>
          {reports.length > 0 && (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.code}>
                  <Link href={`/v/${r.code}`} className="card flex items-center gap-3 px-3.5 py-3">
                    <Plate plate={r.plate} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.make} {r.model}</span>
                      <span className="block font-mono text-xs text-muted">Informe {formatStickerCode(r.code)}</span>
                    </span>
                    <span className="text-sm font-semibold text-accent">Ver →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {left > 0 && (
            <form action={redeemAction} className="card space-y-3 p-4">
              <input type="hidden" name="id" value={purchase.id} />
              <input type="hidden" name="t" value={token} />
              <p className="text-sm font-semibold">Te queda{left === 1 ? "" : "n"} {left} informe{left === 1 ? "" : "s"}. ¿De qué patente?</p>
              {sp.error === "patente" && <p role="alert" className="text-sm text-red-700">No encontramos un legajo con esa patente.</p>}
              {sp.error === "creditos" && <p role="alert" className="text-sm text-red-700">No quedan informes en esta compra.</p>}
              <div className="flex gap-2">
                <input name="plate" required placeholder="AE 482 KD" autoCapitalize="characters" autoComplete="off" aria-label="Patente" className="field font-mono uppercase" />
                <button type="submit" className="h-[52px] shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-white">Emitir</button>
              </div>
            </form>
          )}
          <p className="rounded-xl bg-paper px-3.5 py-3 text-xs text-muted">
            Guardá este link: desde acá ves tus informes{left > 0 ? " y usás los que te quedan" : ""}.
          </p>
        </section>
      )}
    </main>
  );
}
