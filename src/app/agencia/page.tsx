import Link from "next/link";
import { searchPlate } from "@/app/actions/vehicles";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Plate } from "@/components/Plate";
import { QrScanner } from "@/components/QrScanner";
import { VehicleScan } from "@/components/VehicleScan";
import { listFollowed, listReports, STAGE_LABELS, STAGES, type FollowedVehicle } from "@/lib/agency";
import { requireAgency } from "@/lib/auth";
import { formatStickerCode } from "@/lib/sticker-code";

export const dynamic = "force-dynamic";

export default async function AgenciaHome({ searchParams }: { searchParams: Promise<{ error?: string; q?: string }> }) {
  const user = await requireAgency();
  const { error, q } = await searchParams;
  const [followed, reports] = await Promise.all([listFollowed(user.workshopId), listReports(user.workshopId, 5)]);
  const withNews = followed.filter((f) => f.records > f.seenRecords && f.stage !== "vendido").length;

  return (
    <main className="space-y-6 px-5">
      <InstallPrompt />

      <section className="space-y-3">
        <h1 className="text-xl font-bold">Revisar un auto</h1>
        <form action={searchPlate} className="space-y-2">
          <label htmlFor="plate" className="label">Patente</label>
          <div className="flex gap-2">
            <input id="plate" name="plate" defaultValue={q} placeholder="AE 482 KD" autoCapitalize="characters" autoComplete="off" required className="field font-mono text-lg font-semibold tracking-wider uppercase" />
            <button type="submit" className="h-[52px] shrink-0 rounded-xl bg-ink px-5 font-semibold text-white">Ver</button>
          </div>
          {error === "patente" && <p role="alert" className="text-sm text-red-700">Esa patente no tiene un formato válido (AA123BB, A123BCD o ABC123).</p>}
        </form>
        <VehicleScan />
        <QrScanner />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Mis autos</h2>
          {withNews > 0 && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">{withNews} con novedades</span>}
        </div>
        {followed.length === 0 ? (
          <p className="text-sm text-muted">Seguí los autos que evaluás o tenés en stock y te avisamos cuando un taller les cargue algo nuevo.</p>
        ) : (
          STAGES.map((stage) => {
            const list = followed.filter((f) => f.stage === stage);
            if (!list.length) return null;
            return (
              <div key={stage} className="space-y-2">
                <p className="text-xs font-semibold text-muted uppercase">{STAGE_LABELS[stage]} · {list.length}</p>
                <ul className="space-y-2">
                  {list.map((f) => <FollowedRow key={f.vehicleId} f={f} />)}
                </ul>
              </div>
            );
          })
        )}
      </section>

      {reports.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="font-bold">Últimos informes emitidos</h2>
          <ul className="card divide-y divide-[#EDEBE5]">
            {reports.map((r) => (
              <li key={r.code}>
                <Link href={`/v/${r.code}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.make} {r.model}</span>
                    <span className="block font-mono text-xs text-muted">{formatStickerCode(r.code)} · {r.issuedAt.toLocaleDateString("es-AR")}</span>
                  </span>
                  <Plate plate={r.plate} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function FollowedRow({ f }: { f: FollowedVehicle }) {
  const news = f.records - f.seenRecords;
  return (
    <li>
      <Link href={`/agencia/auto/${f.plate}`} className="card flex min-h-14 items-center gap-3 px-3.5 py-3">
        <Plate plate={f.plate} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{f.make} {f.model}{f.year ? ` · ${f.year}` : ""}</span>
          <span className="block text-xs text-muted">
            {f.records} registro{f.records === 1 ? "" : "s"}
            {f.lastKm !== null ? ` · ${f.lastKm.toLocaleString("es-AR")} km` : ""}
          </span>
        </span>
        {news > 0 && <span className="shrink-0 rounded-full bg-accent px-2 py-1 text-xs font-semibold text-white">+{news}</span>}
      </Link>
    </li>
  );
}
