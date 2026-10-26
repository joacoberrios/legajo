import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { issueReportAction, setStageAction, unfollowAction } from "@/app/actions/agency";
import { Plate } from "@/components/Plate";
import { ReportSummary } from "@/components/ReportSummary";
import { CompleteVehicleForm } from "@/components/VehicleForm";
import { btnPrimary, btnSecondary } from "@/components/panel/PanelShell";
import { tableCls, tdCls, theadCls, trCls } from "@/components/panel/Table";
import { findFollow, markSeen, STAGE_LABELS, STAGES } from "@/lib/agency";
import { requireUser } from "@/lib/auth";
import { findVehicleByPlate, listRecords, type Attachment, type RecordRow } from "@/lib/data";
import { analyze } from "@/lib/ledger";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { ATTACHMENT_LABELS, RECORD_LABELS } from "@/lib/records-meta";
import { formatStickerCode } from "@/lib/sticker-code";
import { vehicleStickers } from "@/lib/stickers";
import { logView } from "@/lib/views";

export const dynamic = "force-dynamic";

const fmtDay = (iso: string) => iso.split("-").reverse().join("/");
const fmtAt = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Mendoza", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

/** Marca los registros con km menor a uno anterior vigente (ni corregido ni corrección). */
function kmFlags(records: RecordRow[]) {
  const corrected = new Set(records.map((r) => r.correctsId).filter(Boolean));
  const flagged = new Set<string>();
  let max = -1;
  for (const r of records) {
    if (r.type === "correction" || corrected.has(r.id)) continue;
    if (r.odometerKm < max) flagged.add(r.id);
    max = Math.max(max, r.odometerKm);
  }
  return flagged;
}

export default async function PanelVehicle({
  params,
  searchParams,
}: {
  params: Promise<{ plate: string }>;
  searchParams: Promise<{ cargado?: string; vinculado?: string; stickerError?: string; error?: string }>;
}) {
  const user = await requireUser();
  const agency = user.workshopKind === "agencia";
  const plate = normalizePlate((await params).plate);
  if (!isValidPlate(plate)) notFound();
  const sp = await searchParams;
  const vehicle = await findVehicleByPlate(plate);

  if (!vehicle) {
    if (!agency) redirect(`/panel/vehiculos/nuevo?patente=${plate}`);
    return (
      <div className="max-w-2xl space-y-4">
        <Plate plate={plate} size="lg" />
        <h1 className="text-2xl font-extrabold tracking-tight">Este auto todavía no tiene legajo</h1>
        <p className="text-sm text-muted">Ningún taller de la red le cargó trabajos. Pedile al vendedor que lo lleve a un taller con Legajo antes de cerrar la compra.</p>
        <Link href="/panel/vehiculos" className={btnSecondary}>← Volver</Link>
      </div>
    );
  }

  const [records, stickers, follow] = await Promise.all([
    listRecords(vehicle.id),
    vehicleStickers(vehicle.id),
    agency ? findFollow(user.workshopId, vehicle.id) : Promise.resolve(null),
    logView(vehicle.id, user, "patente"),
  ]);
  if (follow && follow.seenRecords !== records.length) await markSeen(user.workshopId, vehicle.id, records.length);

  const a = analyze(records);
  const flags = kmFlags(records);
  const correctedIds = new Set(records.map((r) => r.correctsId).filter(Boolean));
  const byId = new Map(records.map((r) => [r.id, r]));
  const canLoad = !agency && user.workshopVerified;

  return (
    <>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link href="/panel/vehiculos" className="text-sm font-semibold text-muted hover:text-ink">← {agency ? "Mis autos" : "Vehículos"}</Link>
          <div className="flex items-center gap-3">
            <Plate plate={vehicle.plate} />
            <h1 className="text-2xl font-extrabold tracking-tight">
              {vehicle.make} {vehicle.model}
              {vehicle.year ? <span className="font-normal text-muted"> · {vehicle.year}</span> : null}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={`/i/${vehicle.publicSlug}`} target="_blank" rel="noreferrer" className={btnSecondary}>Informe público ↗</a>
          {!agency && <Link href={`/taller/auto/${vehicle.plate}/qr`} className={btnSecondary}>QR para el auto</Link>}
          {canLoad && <Link href={`/panel/vehiculos/${vehicle.plate}/registro`} className={btnPrimary}>+ Agregar registro</Link>}
          {agency && (
            <form action={issueReportAction}>
              <input type="hidden" name="plate" value={vehicle.plate} />
              <input type="hidden" name="base" value="panel" />
              <button type="submit" className={btnPrimary}>Emitir informe verificado</button>
            </form>
          )}
        </div>
      </header>

      {sp.cargado && <Notice tone="ok">Registro firmado y agregado al legajo.</Notice>}
      {sp.vinculado && <Notice tone="ok">Sticker vinculado al auto.</Notice>}
      {sp.stickerError && <Notice tone="error">El auto quedó guardado, pero el sticker no se pudo asignar: {sp.stickerError}</Notice>}
      {sp.error === "verificacion" && <Notice tone="warn">Los informes verificados se habilitan cuando verifiquemos el CUIT de tu agencia.</Notice>}
      {a.kmIssues > 0 && <Notice tone="warn">Hay {a.kmIssues} registro{a.kmIssues > 1 ? "s" : ""} con km menor a uno anterior (marcados en la tabla).</Notice>}

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
            <section className="rounded-xl border border-line bg-white p-5">
              <h2 className="mb-3 font-bold">Datos del vehículo</h2>
              <dl className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
                <Row label="Marca" value={vehicle.make} />
                <Row label="Modelo" value={vehicle.model} />
                <Row label="Año" value={vehicle.year ? String(vehicle.year) : null} />
                <Row label="Tipo" value={vehicle.bodyType} />
                <Row label="Chasis (VIN)" value={vehicle.vin} mono />
                <Row label="Motor" value={vehicle.engineNumber} mono />
                <Row label="Stickers" value={stickers.length ? stickers.map((s) => `${formatStickerCode(s.code)}${s.voidedAt ? " (anulado)" : ""}`).join(", ") : null} mono />
                <Row label="Alta en Legajo" value={vehicle.createdAt.toLocaleDateString("es-AR")} />
              </dl>
            </section>

          {!agency && (!vehicle.vin || !vehicle.engineNumber) && (
            <CompleteVehicleForm plate={vehicle.plate} missingVin={!vehicle.vin} missingEngine={!vehicle.engineNumber} prefill={null} base="panel" />
          )}

          {agency && (
            <section className="space-y-3 rounded-xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{follow ? "Lo seguís" : "Seguir este auto"}</h2>
                {follow && (
                  <form action={unfollowAction}>
                    <input type="hidden" name="plate" value={vehicle.plate} />
                    <button type="submit" className="text-xs font-semibold text-muted hover:text-ink">Dejar de seguir</button>
                  </form>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {STAGES.map((stage) => (
                  <form key={stage} action={setStageAction}>
                    <input type="hidden" name="plate" value={vehicle.plate} />
                    <input type="hidden" name="stage" value={stage} />
                    <button type="submit" aria-pressed={follow?.stage === stage} className={`h-10 w-full rounded-lg border text-xs font-semibold ${follow?.stage === stage ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}>
                      {STAGE_LABELS[stage]}
                    </button>
                  </form>
                ))}
              </div>
            </section>
          )}
        </div>
        <div>
          <section className="space-y-1">
            <ReportSummary a={a} />
          </section>

        </div>
      </div>

        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="font-bold">Historial</h2>
            <span className="text-xs text-muted">{records.length} registro{records.length === 1 ? "" : "s"} · del más nuevo al más viejo</span>
          </div>
          {records.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Todavía no tiene registros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={tableCls}>
                <thead className={theadCls}>
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Tipo</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Km</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Trabajos</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Taller</th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold">Respaldo</th>
                    {canLoad && <th scope="col" className="px-4 py-3 text-right font-semibold"><span className="sr-only">Acciones</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {[...records].reverse().map((r) => {
                    const isCorrected = correctedIds.has(r.id);
                    const target = r.correctsId ? byId.get(r.correctsId) : null;
                    const own = r.workshopId === user.workshopId;
                    return (
                      <tr key={r.id} className={`${trCls} ${isCorrected ? "text-muted" : ""}`}>
                        <td className={`${tdCls} whitespace-nowrap`}>
                          <div className="font-mono">{fmtDay(r.performedOn)}</div>
                        </td>
                        <td className={tdCls}>
                          <div className={`whitespace-nowrap ${isCorrected ? "line-through" : "font-semibold"}`}>{RECORD_LABELS[r.type]}</div>
                          {isCorrected && <div className="text-[11px] font-semibold text-warn">Corregido</div>}
                          {target && <div className="text-[11px] text-muted">corrige {RECORD_LABELS[target.type].toLowerCase()} del {fmtDay(target.performedOn)}</div>}
                        </td>
                        <td className={`${tdCls} text-right font-mono whitespace-nowrap ${flags.has(r.id) ? "font-semibold text-red-700" : ""}`}>
                          {r.odometerKm.toLocaleString("es-AR")}
                          {flags.has(r.id) && <div className="text-[10px] font-semibold">km menor</div>}
                        </td>
                        <td className={`${tdCls} min-w-[220px]`}>
                          {r.items.length ? r.items.join(", ") : <span className="text-muted">—</span>}
                          {!agency && r.notes && <div className="mt-1 text-xs text-muted">Nota: {r.notes}</div>}
                        </td>
                        <td className={tdCls}>
                          <div className={`whitespace-nowrap ${own ? "font-semibold" : ""}`}>{r.workshopName}</div>
                          <div className="text-[11px] whitespace-nowrap text-muted">{own ? `${r.userName} · ` : ""}{fmtAt(r.createdAt)}</div>
                        </td>
                        <td className={tdCls}>
                          {r.attachments.length === 0 ? (
                            <span className="text-xs whitespace-nowrap text-muted">Sin adjuntos</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {(r.attachments as Attachment[]).map((at) => (
                                <a key={at.id} href={`/api/adjuntos/${at.id}`} target="_blank" rel="noreferrer" className="rounded-md border border-line bg-[#FAFAF8] px-2 py-1 text-[11px] font-semibold whitespace-nowrap hover:border-ink">
                                  {ATTACHMENT_LABELS[at.kind]}
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
                        {canLoad && (
                          <td className={`${tdCls} text-right`}>
                            {own && !isCorrected && r.type !== "correction" && (
                              <Link href={`/panel/vehiculos/${vehicle.plate}/registro?corrige=${r.id}`} className="text-xs font-semibold text-accent hover:underline">Corregir</Link>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#EDEBE5] pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`text-right font-semibold break-all ${mono ? "font-mono text-xs" : ""} ${value ? "" : "font-normal text-muted"}`}>{value ?? "sin cargar"}</dd>
    </div>
  );
}

function Notice({ tone, children }: { tone: "ok" | "warn" | "error"; children?: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-emerald-50 text-emerald-900" : tone === "warn" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800";
  return <p role={tone === "error" ? "alert" : "status"} className={`mb-5 rounded-lg px-4 py-3 text-sm ${cls}`}>{children}</p>;
}
