import Link from "next/link";
import { WorkshopForm } from "@/components/WorkshopForm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { maskCuit } from "@/lib/cuit";
import { formatPhone } from "@/lib/phone";

export default async function WorkshopDataPage() {
  const user = await requireUser();
  const [w] = await db()<{ name: string; cuit: string; phone: string | null; address: string | null; lat: number | null; lng: number | null }[]>`
    SELECT name, cuit, phone, address, lat, lng FROM workshops WHERE id = ${user.workshopId}
  `;
  const place = w.address && w.lat !== null && w.lng !== null ? { address: w.address, lat: w.lat, lng: w.lng } : null;

  return (
    <main className="space-y-6 px-5">
      <Link href="/taller" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-muted">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Volver
      </Link>
      <div>
        <h1 className="text-xl font-bold">Datos del taller</h1>
        <p className="mt-1 text-sm text-muted">
          {w.name} · CUIT <span className="font-mono">{maskCuit(w.cuit)}</span>
        </p>
      </div>

      {user.role === "owner" ? (
        <WorkshopForm phone={w.phone} place={place} />
      ) : (
        <div className="card space-y-1 px-4 py-3 text-sm">
          <p>Teléfono: {w.phone ? formatPhone(w.phone) : "sin cargar"}</p>
          <p>Dirección: {w.address ?? "sin cargar"}</p>
          <p className="pt-1 text-xs text-muted">Solo el dueño del taller puede cambiar estos datos.</p>
        </div>
      )}
    </main>
  );
}
