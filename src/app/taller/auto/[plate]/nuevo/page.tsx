import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plate } from "@/components/Plate";
import { RecordForm } from "@/components/RecordForm";
import { formatDay } from "@/components/Timeline";
import { requireUser } from "@/lib/auth";
import { BLOB_ACCESS } from "@/lib/blob";
import { findVehicleByPlate, lastOdometer, listRecords } from "@/lib/data";
import { RECORD_LABELS } from "@/lib/ledger";
import { normalizePlate } from "@/lib/plate";

export default async function NewRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ plate: string }>;
  searchParams: Promise<{ corrige?: string }>;
}) {
  const user = await requireUser();
  const plate = normalizePlate((await params).plate);
  const { corrige } = await searchParams;

  const vehicle = await findVehicleByPlate(plate);
  if (!vehicle) notFound();
  if (!user.workshopVerified) redirect(`/taller/auto/${plate}`);

  let correcting = null;
  if (corrige) {
    const target = (await listRecords(vehicle.id)).find((r) => r.id === corrige && r.workshopId === user.workshopId);
    if (!target) notFound();
    correcting = {
      id: target.id,
      label: `${RECORD_LABELS[target.type]} del ${formatDay(target.performedOn)}`,
      km: target.odometerKm,
      performedOn: target.performedOn,
      items: target.items,
    };
  }

  return (
    <main className="space-y-5 px-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/taller/auto/${plate}`}
          aria-label="Cancelar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </Link>
        <div>
          <h1 className="font-bold">{correcting ? "Corregir registro" : "Nuevo registro"}</h1>
          <p className="flex items-center gap-2 text-xs text-muted">
            <Plate plate={plate} size="sm" /> {vehicle.make} {vehicle.model}
          </p>
        </div>
      </div>
      <RecordForm plate={plate} lastKm={await lastOdometer(vehicle.id)} correcting={correcting} workshopId={user.workshopId} blobAccess={BLOB_ACCESS} />
    </main>
  );
}
