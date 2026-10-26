import Link from "next/link";
import { notFound } from "next/navigation";
import { issueReportAction, setStageAction, unfollowAction } from "@/app/actions/agency";
import { Plate } from "@/components/Plate";
import { ReportSummary } from "@/components/ReportSummary";
import { Timeline } from "@/components/Timeline";
import { HistoryLock, REPORT_ERRORS } from "@/components/HistoryLock";
import { seesFullHistory } from "@/lib/billing";
import { findFollow, markSeen, STAGE_LABELS, STAGES } from "@/lib/agency";
import { requireAgency } from "@/lib/auth";
import { findVehicleByPlate, listRecords } from "@/lib/data";
import { analyze } from "@/lib/ledger";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { logView, viewSource } from "@/lib/views";

export const dynamic = "force-dynamic";

/** Ficha del auto para una agencia: historial completo (sin notas internas), seguimiento e informe verificado. */
export default async function AgencyVehicle({
  params,
  searchParams,
}: {
  params: Promise<{ plate: string }>;
  searchParams: Promise<{ via?: string; error?: string }>;
}) {
  const user = await requireAgency();
  const plate = normalizePlate((await params).plate);
  if (!isValidPlate(plate)) notFound();
  const { via, error } = await searchParams;
  const vehicle = await findVehicleByPlate(plate);

  if (!vehicle) {
    return (
      <main className="space-y-5 px-5">
        <BackLink />
        <Plate plate={plate} size="lg" />
        <h1 className="text-xl font-bold">Este auto todavía no tiene legajo</h1>
        <p className="text-sm text-muted">
          Ningún taller de la red le cargó trabajos. Pedile al vendedor que lo lleve a un taller con Legajo antes de cerrar la compra: así queda registrado el estado y el kilometraje de hoy.
        </p>
      </main>
    );
  }

  const [records, follow, full] = await Promise.all([
    listRecords(vehicle.id),
    findFollow(user.workshopId, vehicle.id),
    seesFullHistory(user, vehicle.id),
    logView(vehicle.id, user, viewSource(via)),
  ]);
  const a = analyze(records);
  const news = follow ? records.length - follow.seenRecords : 0;
  if (follow && news !== 0) await markSeen(user.workshopId, vehicle.id, records.length);

  return (
    <main className="space-y-5 px-5">
      <BackLink />

      {news > 0 && (
        <p role="status" className="rounded-xl bg-orange-50 px-3.5 py-3 text-sm text-orange-900">
          {news === 1 ? "Hay 1 registro nuevo" : `Hay ${news} registros nuevos`} desde la última vez que lo miraste.
        </p>
      )}

      <section className="space-y-3 rounded-3xl bg-ink p-5 text-paper">
        <Plate plate={vehicle.plate} />
        <h1 className="text-xl font-bold tracking-tight">{vehicle.make} {vehicle.model}{vehicle.year ? ` · ${vehicle.year}` : ""}</h1>
        <dl className="grid grid-cols-1 gap-1.5 border-t border-[#33363B] pt-3 font-mono text-xs">
          <Row label="Chasis (VIN)" value={vehicle.vin} />
          <Row label="Motor" value={vehicle.engineNumber} />
          {vehicle.bodyType && <Row label="Tipo" value={vehicle.bodyType} />}
        </dl>
        <p className="text-xs text-[#B9B7B0]">Comparalos con la tarjeta verde y el auto antes de comprar.</p>
      </section>

      <ReportSummary a={a} />

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{follow ? "Lo seguís" : "Seguir este auto"}</h2>
          {follow && (
            <form action={unfollowAction}>
              <input type="hidden" name="plate" value={vehicle.plate} />
              <button type="submit" className="h-11 px-1 text-sm font-semibold text-muted">Dejar de seguir</button>
            </form>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {STAGES.map((stage) => (
            <form key={stage} action={setStageAction}>
              <input type="hidden" name="plate" value={vehicle.plate} />
              <input type="hidden" name="stage" value={stage} />
              <button
                type="submit"
                aria-pressed={follow?.stage === stage}
                className={`h-11 w-full rounded-xl border text-sm font-semibold ${follow?.stage === stage ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
              >
                {STAGE_LABELS[stage]}
              </button>
            </form>
          ))}
        </div>
        <p className="text-xs text-muted">Te avisamos en «Mis autos» cuando un taller le cargue algo nuevo.</p>
      </section>

      <section className="space-y-2">
        {error && REPORT_ERRORS[error] && (
          <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
            {REPORT_ERRORS[error]}{" "}
            {(error === "plan" || error === "cupo") && <Link href="/taller/plan" className="font-semibold underline">Ver plan</Link>}
          </p>
        )}
        <form action={issueReportAction}>
          <input type="hidden" name="plate" value={vehicle.plate} />
          <button type="submit" className="btn-primary">Emitir informe verificado</button>
        </form>
        <p className="text-xs text-muted">Con fecha, código de validación y tu agencia como emisora. Para mandarle al comprador o imprimir.</p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold">Historial</h2>
          <span className="text-xs text-muted">Tu consulta queda registrada en el informe</span>
        </div>
        {full ? <Timeline records={records} mode="public" /> : <HistoryLock hidden={records.length} agency href="/taller/plan" />}
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[#B9B7B0]">{label}</dt>
      <dd className="font-semibold break-all">{value ?? "sin cargar"}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/agencia" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-muted">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      Volver
    </Link>
  );
}
