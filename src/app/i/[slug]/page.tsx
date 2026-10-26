import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plate } from "@/components/Plate";
import { ReportSummary } from "@/components/ReportSummary";
import { PitchActions, PitchIntro } from "@/components/Pitch";
import { currentUser } from "@/lib/auth";
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

  const [records, consults, user] = await Promise.all([listRecords(vehicle.id), recentViews(vehicle.id), currentUser()]);
  const visitor = !user; // alguien que escaneó el QR sin conocer Legajo
  const a = analyze(records);
  const today = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <main className="min-h-dvh bg-white px-5 py-6">
      <div className="space-y-5">
        {visitor && (
          <PitchIntro
            headline="Este auto habla por sí solo."
            sub="Estás viendo su historial: cada service y reparación, cargado y firmado por el taller que lo hizo. Nadie lo puede borrar ni cambiar."
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-lg font-extrabold tracking-tight">{visitor ? "Informe del auto" : "Legajo"}</span>
          <span className="text-xs text-muted">Al {today}</span>
        </div>

        <div className="space-y-1.5">
          <Plate plate={vehicle.plate} />
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            {vehicle.make} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}
          </h1>
        </div>

        <ReportSummary a={a} />

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

        {visitor && <PitchActions />}

        <p className="pt-2 text-center text-xs text-muted">
          Cada registro está firmado por el taller que lo cargó y no se puede modificar. Las fotos y comprobantes quedan sellados con la firma.
        </p>
      </div>
    </main>
  );
}
