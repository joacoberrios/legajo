import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Plate } from "@/components/Plate";
import { ReportSummary } from "@/components/ReportSummary";
import { ShareLink } from "@/components/ShareLink";
import { Timeline } from "@/components/Timeline";
import { Wordmark } from "@/components/Wordmark";
import { findReport } from "@/lib/agency";
import { findVehicleById, listRecords } from "@/lib/data";
import { analyze, verifyChain } from "@/lib/ledger";
import { formatPlate } from "@/lib/plate";
import { formatStickerCode, normalizeStickerCode } from "@/lib/sticker-code";
import { appUrl } from "@/lib/url";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Informe verificado Legajo", robots: { index: false, follow: false } };

/**
 * Informe verificado: el historial tal como estaba al emitirlo, con su código de validación.
 * Se comprueba en cada apertura que esa parte del historial no cambió y se avisa si hay registros posteriores.
 */
export default async function VerifiedReportPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const code = normalizeStickerCode((await params).code);
  if (!code) notFound();
  const report = await findReport(code);
  if (!report) notFound();
  const vehicle = await findVehicleById(report.vehicleId);
  if (!vehicle) notFound();
  const { nuevo } = await searchParams;

  const all = await listRecords(vehicle.id);
  const snapshot = all.slice(0, report.recordCount);
  const intact = verifyChain(snapshot).ok && (snapshot.at(-1)?.hash ?? null) === report.headHash;
  const newer = all.length - report.recordCount;
  const a = analyze(snapshot, report.issuedAt);

  const base = await appUrl();
  const url = `${base}/v/${code}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#15171a", light: "#ffffff" } });
  const issued = report.issuedAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Mendoza", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const car = `${vehicle.make} ${vehicle.model} (${formatPlate(vehicle.plate)})`;

  return (
    <main className="min-h-dvh bg-white px-5 py-6">
      <div className="space-y-5">
        {nuevo && (
          <div className="space-y-3 rounded-2xl bg-emerald-50 p-4 print:hidden">
            <p className="text-sm font-semibold text-emerald-900">Informe emitido. Mandáselo al comprador o guardalo en PDF.</p>
            <ShareLink url={url} message={`Te paso el informe verificado de Legajo del ${car}:`} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Wordmark height={20} color="#15171a" dot="#C2410C" />
          <span className="font-mono text-xs text-muted">{formatStickerCode(code)}</span>
        </div>

        <section className="space-y-1">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">Informe verificado</p>
          <p className="text-sm">Emitido el <strong>{issued}</strong> por <strong>{report.agencyName}</strong></p>
        </section>

        {intact ? (
          <p className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
            Validado: el historial de este informe no tuvo cambios desde que se emitió.
          </p>
        ) : (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm font-semibold text-red-800">
            Atención: el historial no coincide con el que se emitió. No uses este informe.
          </p>
        )}
        {newer > 0 && (
          <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 print:hidden">
            Desde la emisión se cargaron {newer} registro{newer === 1 ? "" : "s"} nuevo{newer === 1 ? "" : "s"}.{" "}
            <Link href={`/i/${vehicle.publicSlug}`} className="font-semibold underline">Ver el historial actualizado</Link>
          </p>
        )}

        <section className="space-y-1.5">
          <Plate plate={vehicle.plate} />
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
            {vehicle.make} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}
          </h1>
          <dl className="space-y-1 pt-1 font-mono text-xs">
            <div className="flex justify-between gap-3"><dt className="text-muted">Chasis (VIN)</dt><dd className="font-semibold break-all">{vehicle.vin ?? "sin cargar"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Motor</dt><dd className="font-semibold break-all">{vehicle.engineNumber ?? "sin cargar"}</dd></div>
          </dl>
        </section>

        <ReportSummary a={a} />

        <section className="space-y-3">
          <h2 className="font-bold">Historial al {issued.split(",")[0]}</h2>
          <Timeline records={snapshot} mode="public" />
        </section>

        <section className="flex items-center gap-4 border-t border-line pt-5">
          <div className="w-24 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-xs leading-relaxed text-muted">
            Validá este informe escaneando el código o entrando a <span className="font-mono break-all text-ink">{url.replace(/^https?:\/\//, "")}</span>. Cada registro está firmado por el taller que lo cargó y no se puede modificar.
          </p>
        </section>

        {!nuevo && (
          <div className="print:hidden">
            <ShareLink url={url} message={`Informe verificado de Legajo del ${car}:`} />
          </div>
        )}
      </div>
    </main>
  );
}
