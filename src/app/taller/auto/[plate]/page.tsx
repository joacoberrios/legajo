import Link from "next/link";
import { notFound } from "next/navigation";
import { Plate } from "@/components/Plate";
import { Timeline, formatKm } from "@/components/Timeline";
import { CompleteVehicleForm, VehicleForm } from "@/components/VehicleForm";
import { decodePrefill } from "@/lib/vision-types";
import { requireUser } from "@/lib/auth";
import { findVehicleByPlate, listRecords } from "@/lib/data";
import { ShareWithOwner } from "@/components/ShareWithOwner";
import { analyze, RECORD_LABELS } from "@/lib/ledger";
import { formatPlate, isValidPlate, normalizePlate } from "@/lib/plate";
import { appUrl } from "@/lib/url";

export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ plate: string }>;
  searchParams: Promise<{ cargado?: string; tv?: string }>;
}) {
  const user = await requireUser();
  const plate = normalizePlate((await params).plate);
  if (!isValidPlate(plate)) notFound();
  const { cargado, tv } = await searchParams;
  const prefill = decodePrefill(tv); // datos leídos de la tarjeta verde

  const vehicle = await findVehicleByPlate(plate);

  if (!vehicle) {
    return (
      <main className="space-y-6 px-5">
        <BackLink />
        <div className="space-y-2">
          <Plate plate={plate} size="lg" />
          <h1 className="text-xl font-bold">Este auto todavía no tiene legajo</h1>
          <p className="text-sm text-muted">Cargá sus datos una vez y queda disponible para todos los talleres.</p>
        </div>
        <VehicleForm plate={plate} prefill={prefill} />
      </main>
    );
  }

  const records = await listRecords(vehicle.id);
  const a = analyze(records);

  // Mensaje para el dueño: el último trabajo que cargó este taller (o el último del auto) y el link al informe.
  const last = [...records].reverse().find((r) => r.workshopId === user.workshopId) ?? records.at(-1);
  const reportLink = `${await appUrl()}/i/${vehicle.publicSlug}`;
  const car = `tu ${vehicle.make} ${vehicle.model} (${formatPlate(vehicle.plate)})`;
  let ownerMessage = "";
  if (last && last.type === "correction") {
    // Una corrección reemplaza un registro anterior: se describe por el trabajo corregido.
    const original = records.find((r) => r.id === last.correctsId);
    const what = original ? `el registro de ${RECORD_LABELS[original.type].toLowerCase()}` : "un registro";
    ownerMessage = `Hola! Desde ${user.workshopName} actualizamos ${what} de ${car}, ahora a los ${formatKm(last.odometerKm)}. Queda firmado en el legajo del auto, junto con todo su historial. Lo podés ver y compartir acá: ${reportLink}`;
  } else if (last) {
    ownerMessage = `Hola! Desde ${user.workshopName} cargamos el trabajo de ${car}: ${RECORD_LABELS[last.type].toLowerCase()} a los ${formatKm(last.odometerKm)}. Queda firmado en el legajo del auto, junto con todo su historial. Lo podés ver y compartir acá: ${reportLink}`;
  }

  return (
    <main className="space-y-5 px-5">
      <BackLink />

      {cargado && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
          Registro firmado y agregado al legajo.
        </p>
      )}

      <section className="space-y-3.5 rounded-3xl bg-ink p-5 text-paper">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <Plate plate={vehicle.plate} />
            <h1 className="text-xl font-bold tracking-tight">{vehicle.make} {vehicle.model}</h1>
            <p className="font-mono text-xs text-[#B9B7B0]">
              {vehicle.vin ? `VIN ${vehicle.vin.slice(0, 8)}•••••${vehicle.vin.slice(-4)}` : "VIN sin cargar"}
              {vehicle.year ? ` · ${vehicle.year}` : ""}
              {vehicle.bodyType ? ` · ${vehicle.bodyType}` : ""}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${a.chainOk ? "bg-[#14532D] text-[#DCFCE7]" : "bg-red-900 text-red-100"}`}>
            {a.chainOk ? "Verificado" : "Alterado"}
          </span>
        </div>
        <dl className="grid grid-cols-3 gap-2 border-t border-[#33363B] pt-3">
          <Stat label="km actuales" value={a.currentKm !== null ? a.currentKm.toLocaleString("es-AR") : "—"} />
          <Stat label="registros" value={String(records.length)} />
          <Stat label="talleres" value={String(a.workshops)} />
        </dl>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href={`/i/${vehicle.publicSlug}`} className="btn-secondary text-sm">Informe público</Link>
        <Link href={`/taller/auto/${vehicle.plate}/qr`} className="btn-secondary text-sm">QR para el auto</Link>
      </div>

      {(!vehicle.vin || !vehicle.engineNumber) && (
        <CompleteVehicleForm plate={vehicle.plate} missingVin={!vehicle.vin} missingEngine={!vehicle.engineNumber} prefill={prefill} />
      )}

      {records.length > 0 && <ShareWithOwner key={cargado ?? "x"} message={ownerMessage} defaultOpen={!!cargado} />}

      {a.kmIssues > 0 && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          Hay {a.kmIssues} registro{a.kmIssues > 1 ? "s" : ""} con km menor a uno anterior. Último km válido: {formatKm(a.currentKm ?? 0)}.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-bold">Historial</h2>
        <Timeline records={records} mode="taller" plate={vehicle.plate} workshopId={user.workshopId} />
      </section>

      <div className="sticky bottom-0 -mx-5 border-t border-line bg-paper px-5 pt-3 pb-6">
        {user.workshopVerified ? (
          <Link href={`/taller/auto/${vehicle.plate}/nuevo`} className="btn-primary">+ Cargar registro</Link>
        ) : (
          <p className="text-center text-sm text-muted">La carga se habilita cuando verifiquemos tu taller.</p>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-[#B9B7B0]">{label}</dt>
      <dd className="font-mono text-base font-semibold">{value}</dd>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/taller" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-muted">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      Volver
    </Link>
  );
}
