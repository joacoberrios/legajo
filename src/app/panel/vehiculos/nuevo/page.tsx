import Link from "next/link";
import { redirect } from "next/navigation";
import { Plate } from "@/components/Plate";
import { btnPrimary, input, PageHeader } from "@/components/panel/PanelShell";
import { VehicleForm } from "@/components/VehicleForm";
import { requireUser } from "@/lib/auth";
import { findVehicleByPlate } from "@/lib/data";
import { isValidPlate, normalizePlate } from "@/lib/plate";

export const dynamic = "force-dynamic";

/** Alta de un auto desde la computadora: primero la patente; si ya tiene legajo, se abre su ficha. */
export default async function PanelNewVehicle({ searchParams }: { searchParams: Promise<{ patente?: string }> }) {
  const user = await requireUser();
  const agency = user.workshopKind === "agencia";
  const raw = (await searchParams).patente ?? "";
  const plate = normalizePlate(raw);
  const valid = isValidPlate(plate);

  if (valid && (agency || (await findVehicleByPlate(plate)))) redirect(`/panel/vehiculos/${plate}`);

  return (
    <div className="max-w-2xl">
      <PageHeader title={agency ? "Revisar una patente" : "Nuevo auto"} sub={agency ? "Abrí el legajo de cualquier auto de la red." : "Si el auto ya tiene legajo en otro taller, se abre su ficha para cargarle trabajos."} />

      <form action="/panel/vehiculos/nuevo" className="mb-8 flex items-end gap-3 rounded-xl border border-line bg-white p-5">
        <div className="flex-1">
          <label htmlFor="patente" className="mb-1 block text-xs font-semibold text-muted">Patente</label>
          <input id="patente" name="patente" defaultValue={raw} required placeholder="AE 482 KD" autoCapitalize="characters" autoComplete="off" className={`${input} w-full font-mono text-base font-semibold tracking-wider uppercase`} />
        </div>
        <button type="submit" className={btnPrimary}>Continuar</button>
      </form>
      {raw && !valid && <p role="alert" className="-mt-5 mb-6 text-sm text-red-700">Esa patente no tiene un formato válido (AA123BB, A123BCD o ABC123).</p>}

      {valid && !agency && (
        <section className="rounded-xl border border-line bg-white p-6">
          <div className="mb-5 flex items-center gap-3">
            <Plate plate={plate} />
            <p className="text-sm text-muted">Todavía no tiene legajo. Cargá sus datos una vez y queda disponible para todos los talleres.</p>
          </div>
          <VehicleForm plate={plate} prefill={null} base="panel" />
        </section>
      )}

      <p className="mt-6 text-sm text-muted">
        <Link href="/panel/vehiculos" className="font-semibold hover:text-ink">← Volver a {agency ? "Mis autos" : "Vehículos"}</Link>
      </p>
    </div>
  );
}
