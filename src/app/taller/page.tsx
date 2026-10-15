import Link from "next/link";
import { searchPlate } from "@/app/actions/vehicles";
import { Plate } from "@/components/Plate";
import { InstallPrompt } from "@/components/InstallPrompt";
import { QrScanner } from "@/components/QrScanner";
import { requireUser } from "@/lib/auth";
import { recentVehicles } from "@/lib/data";
import { RECORD_LABELS } from "@/lib/ledger";

export default async function TallerHome({ searchParams }: { searchParams: Promise<{ error?: string; q?: string }> }) {
  const user = await requireUser();
  const { error, q } = await searchParams;
  const recent = await recentVehicles(user.workshopId);

  return (
    <main className="space-y-6 px-5">
      <InstallPrompt />
      <QrScanner />

      <form action={searchPlate} className="space-y-2">
        <label htmlFor="plate" className="label">Buscar por patente</label>
        <div className="flex gap-2">
          <input
            id="plate"
            name="plate"
            defaultValue={q}
            placeholder="AE 482 KD"
            autoCapitalize="characters"
            autoComplete="off"
            required
            className="field font-mono text-lg font-semibold tracking-wider uppercase"
          />
          <button type="submit" className="h-[52px] shrink-0 rounded-xl bg-ink px-5 font-semibold text-white">
            Buscar
          </button>
        </div>
        {error === "patente" && (
          <p role="alert" className="text-sm text-red-700">
            Esa patente no tiene un formato válido (AA123BB, A123BCD o ABC123).
          </p>
        )}
      </form>

      <section className="space-y-2.5">
        <h2 className="font-bold">Recientes en el taller</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Todavía no trabajaste con ningún auto. Buscá una patente para empezar.</p>
        ) : (
          <ul className="space-y-2.5">
            {recent.map((v) => (
              <li key={v.id}>
                <Link href={`/taller/auto/${v.plate}`} className="card flex min-h-14 items-center gap-3 px-3.5 py-3">
                  <Plate plate={v.plate} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {v.make} {v.model}{v.year ? ` · ${v.year}` : ""}
                    </span>
                    <span className="block text-xs text-muted">
                      {v.lastType ? `Último: ${RECORD_LABELS[v.lastType]}` : "Dado de alta, sin registros"}
                    </span>
                  </span>
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B5F66" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
