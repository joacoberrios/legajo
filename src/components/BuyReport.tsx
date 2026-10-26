import { buyReportAction } from "@/app/actions/billing";
import { formatARS, type Prices } from "@/lib/billing-plans";

/** Candado del historial en el informe público: qué incluye el informe completo y botones de compra. */
export function BuyReport({ slug, records, workshops, prices, unavailable }: { slug: string; records: number; workshops: number; prices: Prices; unavailable?: boolean }) {
  return (
    <section className="space-y-4 rounded-2xl border-2 border-ink p-5">
      <div className="flex items-start gap-3">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <div className="space-y-1">
          <h2 className="font-bold">Historial completo y certificado</h2>
          <p className="text-sm leading-snug text-muted">
            {records > 0
              ? `${records} registro${records === 1 ? "" : "s"} de ${workshops} taller${workshops === 1 ? "" : "es"}: fechas, kilometraje, trabajos realizados y fotos del tablero.`
              : "Todavía no tiene registros cargados."}{" "}
            Recibís un informe verificado por Legajo, con fecha y código de validación.
          </p>
        </div>
      </div>
      {unavailable && <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900">Los pagos no están disponibles en este momento. Probá más tarde.</p>}
      <form action={buyReportAction} className="space-y-3">
        <input type="hidden" name="slug" value={slug} />
        <div>
          <label htmlFor="buyEmail" className="label">Tu email (para mandarte el informe)</label>
          <input id="buyEmail" name="email" type="email" autoComplete="email" placeholder="opcional" className="field" />
        </div>
        <button type="submit" name="kind" value="report_single" className="btn-primary">
          Ver historial completo · {formatARS(prices.report_single)}
        </button>
        <button type="submit" name="kind" value="report_pack3" className="btn-secondary text-sm">
          ¿Estás comparando autos? 3 informes por {formatARS(prices.report_pack3)}
        </button>
      </form>
      <p className="text-center text-xs text-muted">Pago seguro con Mercado Pago. El informe queda disponible al instante.</p>
    </section>
  );
}
