import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { getSettings } from "@/lib/billing";
import { formatARS, PLANS, type PlanKey } from "@/lib/billing-plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Planes · Legajo" };

/** Precios públicos. Mientras el cobro esté apagado, aclara que el piloto es gratis. */
export default async function Planes() {
  const { enabled, prices } = await getSettings();
  const group = (kind: "agencia" | "taller") => (Object.keys(PLANS) as PlanKey[]).filter((k) => PLANS[k].kind === kind);

  return (
    <main className="space-y-8 px-5 py-6">
      <Link href="/" aria-label="Legajo"><Wordmark /></Link>
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Planes</h1>
        <p className="text-sm text-muted">Los talleres cargan gratis, siempre. Pagan quienes consultan.</p>
        {!enabled && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Estamos en <strong>piloto en el Gran Mendoza</strong>: hoy todo es gratis. Estos son los precios que vamos a usar después.
          </p>
        )}
      </div>

      <Section title="Si vas a comprar un usado">
        <Card name="Informe del auto" price={formatARS(prices.report_single)} items={["Historial completo con fechas, km y talleres", "Informe verificado con código de validación"]} />
        <Card name="Pack de 3 informes" price={formatARS(prices.report_pack3)} items={["Para comparar entre varios autos", "Usás cada informe cuando quieras"]} />
        <p className="text-xs text-muted">Se paga una vez, con Mercado Pago, desde el informe del auto (escaneando su QR o con su link).</p>
      </Section>

      <Section title="Agencias">
        {group("agencia").map((k) => (
          <Card key={k} name={PLANS[k].name} price={`${formatARS(prices[k])} / mes`} items={PLANS[k].features} />
        ))}
        <p className="text-xs text-muted">Informe extra cuando se termina el cupo: {formatARS(prices.report_extra)}.</p>
      </Section>

      <Section title="Talleres">
        <Card name="Taller" price="Gratis" items={["Cargá todos tus trabajos", "Historial completo de los autos que atendés", "De los demás, los últimos 2 registros"]} />
        {group("taller").map((k) => (
          <Card key={k} name={PLANS[k].name} price={`${formatARS(prices[k])} / mes`} items={PLANS[k].features} />
        ))}
      </Section>

      <div className="space-y-2">
        <Link href="/registro" className="btn-primary">Registrar mi taller</Link>
        <Link href="/registro?tipo=agencia" className="btn-secondary">Cuenta de agencia</Link>
      </div>
      <p className="text-xs text-muted">Precios en pesos argentinos, IVA incluido. Planes mensuales con débito automático; se cancelan cuando quieras.</p>
    </main>
  );
}

function Section({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Card({ name, price, items }: { name: string; price: string; items: string[] }) {
  return (
    <div className="card space-y-2 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold">{name}</p>
        <p className="font-mono font-semibold whitespace-nowrap">{price}</p>
      </div>
      <ul className="space-y-1 text-sm text-muted">
        {items.map((i) => <li key={i}>· {i}</li>)}
      </ul>
    </div>
  );
}
