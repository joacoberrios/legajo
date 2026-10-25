import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plate } from "@/components/Plate";
import { Timeline } from "@/components/Timeline";
import { findVehicleBySlug, listRecords } from "@/lib/data";
import { analyze } from "@/lib/ledger";
import { recentViews } from "@/lib/views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Informe Legajo",
  robots: { index: false, follow: false },
};

/** Informe público: lo abre cualquiera con el link o el QR. Sin datos del dueño ni notas internas. */
export default async function PublicReport({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await findVehicleBySlug(slug);
  if (!vehicle) notFound();

  const [records, consults] = await Promise.all([listRecords(vehicle.id), recentViews(vehicle.id)]);
  const a = analyze(records);
  const today = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const ring = !a.chainOk ? "border-red-400" : (a.score ?? 0) >= 80 ? "border-green-400" : (a.score ?? 0) >= 60 ? "border-amber-400" : "border-[#B9B7B0]";

  return (
    <main className="min-h-dvh bg-white px-5 py-6">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight">Legajo</span>
          <span className="text-xs text-muted">Informe al {today}</span>
        </div>

        <div className="space-y-1.5">
          <Plate plate={vehicle.plate} />
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            {vehicle.make} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}
          </h1>
        </div>

        <section className="flex items-center gap-4 rounded-2xl bg-ink p-4 text-paper">
          <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 font-mono text-xl font-semibold ${ring}`}>
            {a.score ?? "—"}
          </div>
          <div>
            <h2 className="font-bold">{a.verdict}</h2>
            <p className="text-xs leading-snug text-[#B9B7B0]">
              {a.effectiveCount} registro{a.effectiveCount === 1 ? "" : "s"} de {a.workshops} taller{a.workshops === 1 ? "" : "es"}
              {` · ${a.backedCount} con respaldo`}
              {a.currentKm !== null ? ` · último km: ${a.currentKm.toLocaleString("es-AR")}` : ""}
            </p>
          </div>
        </section>

        <ul>
          {a.checks.map((c) => (
            <li key={c.label} className="flex items-center gap-3 border-b border-[#EDEBE5] py-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${c.ok ? "bg-ok" : "bg-warn"}`}
                aria-label={c.ok ? "Correcto" : "Atención"}
              >
                {c.ok ? (
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                ) : (
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M12 7v6M12 17h.01" /></svg>
                )}
              </span>
              <span className="flex-1 text-sm font-medium">{c.label}</span>
              <span className="text-xs text-muted">{c.note}</span>
            </li>
          ))}
        </ul>

        <section className="space-y-3">
          <h2 className="font-bold">Historial</h2>
          <Timeline records={records} mode="public" />
        </section>

        <section className="space-y-2">
          <h2 className="font-bold">Consultas de talleres</h2>
          {consults.views.length === 0 ? (
            <p className="text-sm text-muted">Ningún taller consultó este legajo todavía.</p>
          ) : (
            <>
              <p className="text-sm text-muted">
                {consults.workshops90d} taller{consults.workshops90d === 1 ? "" : "es"} lo consult{consults.workshops90d === 1 ? "ó" : "aron"} en los últimos 90 días. Cada consulta queda registrada.
              </p>
              <ul>
                {consults.views.map((v) => (
                  <li key={`${v.workshopName}-${v.viewDate}`} className="flex items-center justify-between gap-3 border-b border-[#EDEBE5] py-2.5 text-sm">
                    <span className="font-medium">{v.workshopName}</span>
                    <span className="font-mono text-xs text-muted">{v.viewDate.split("-").reverse().join("/")}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <p className="pt-2 text-center text-xs text-muted">
          Cada registro está firmado por el taller que lo cargó y no se puede modificar. Las fotos y comprobantes quedan sellados con la firma.
        </p>
      </div>
    </main>
  );
}
