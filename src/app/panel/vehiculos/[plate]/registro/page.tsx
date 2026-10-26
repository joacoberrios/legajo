import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plate } from "@/components/Plate";
import { RecordForm } from "@/components/RecordForm";
import { PageHeader } from "@/components/panel/PanelShell";
import { requireUser } from "@/lib/auth";
import { BLOB_ACCESS } from "@/lib/blob";
import { findVehicleByPlate, lastOdometer, listRecords } from "@/lib/data";
import { RECORD_LABELS } from "@/lib/ledger";
import { normalizePlate } from "@/lib/plate";

export const dynamic = "force-dynamic";

/** Agregar un registro (o corregir uno propio) desde la computadora. */
export default async function PanelRecord({ params, searchParams }: { params: Promise<{ plate: string }>; searchParams: Promise<{ corrige?: string }> }) {
  const user = await requireUser();
  const plate = normalizePlate((await params).plate);
  if (user.workshopKind !== "taller" || !user.workshopVerified) redirect(`/panel/vehiculos/${plate}`);
  const vehicle = await findVehicleByPlate(plate);
  if (!vehicle) notFound();
  const { corrige } = await searchParams;

  let correcting = null;
  if (corrige) {
    const target = (await listRecords(vehicle.id)).find((r) => r.id === corrige && r.workshopId === user.workshopId);
    if (!target) notFound();
    correcting = {
      id: target.id,
      label: `${RECORD_LABELS[target.type]} del ${target.performedOn.split("-").reverse().join("/")}`,
      km: target.odometerKm,
      performedOn: target.performedOn,
      items: target.items,
    };
  }

  return (
    <div className="max-w-2xl">
      <Link href={`/panel/vehiculos/${plate}`} className="text-sm font-semibold text-muted hover:text-ink">← Volver a la ficha</Link>
      <div className="mt-2">
        <PageHeader
          title={correcting ? "Corregir registro" : "Agregar registro"}
          sub={correcting ? "El registro original queda visible como corregido; este lo reemplaza." : "Queda firmado con tu nombre y no se puede modificar después."}
        >
          <div className="flex items-center gap-2 text-sm text-muted">
            <Plate plate={plate} size="sm" /> {vehicle.make} {vehicle.model}
          </div>
        </PageHeader>
      </div>
      <section className="rounded-xl border border-line bg-white p-6">
        <RecordForm plate={plate} lastKm={await lastOdometer(vehicle.id)} correcting={correcting} workshopId={user.workshopId} blobAccess={BLOB_ACCESS} base="panel" />
      </section>
    </div>
  );
}
