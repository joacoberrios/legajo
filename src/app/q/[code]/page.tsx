import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { assignStickerByPlate } from "@/app/actions/stickers";
import { Plate } from "@/components/Plate";
import { Wordmark } from "@/components/Wordmark";
import { currentUser } from "@/lib/auth";
import { findVehicleByPlate, recentVehicles } from "@/lib/data";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { formatStickerCode, normalizeStickerCode } from "@/lib/sticker-code";
import { findSticker } from "@/lib/stickers";

export const dynamic = "force-dynamic";

/**
 * Destino de los stickers impresos sin auto. Asignado: lleva al informe (o al legajo, si es un taller).
 * Libre: el taller elige a qué patente se lo pegó.
 */
export default async function StickerPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string; confirmar?: string }>;
}) {
  const code = normalizeStickerCode((await params).code);
  if (!code) notFound();
  const sticker = await findSticker(code);
  if (!sticker) notFound();
  const user = await currentUser();

  if (sticker.publicSlug && sticker.plate && !sticker.voidedAt) {
    redirect(user ? `/taller/auto/${sticker.plate}` : `/i/${sticker.publicSlug}`);
  }

  const { error, confirmar } = await searchParams;
  const pretty = formatStickerCode(code);
  const confirmPlate = confirmar ? normalizePlate(confirmar) : "";
  const toConfirm = user && isValidPlate(confirmPlate) ? await findVehicleByPlate(confirmPlate) : null;

  return (
    <main className="mx-auto max-w-md space-y-6 px-5 py-8">
      <Link href={user ? "/taller" : "/"} aria-label="Legajo, inicio" className="inline-block text-ink">
        <Wordmark height={22} />
      </Link>

      {sticker.voidedAt ? (
        <section className="space-y-2">
          <h1 className="text-2xl font-bold">Sticker anulado</h1>
          <p className="text-sm text-muted">El sticker <span className="font-mono">{pretty}</span> ya no se usa. Pedile al taller uno nuevo.</p>
        </section>
      ) : !user ? (
        <section className="space-y-4">
          <h1 className="text-2xl font-bold">Sticker sin activar</h1>
          <p className="text-sm text-muted">
            Este sticker <span className="font-mono">{pretty}</span> todavía no está asignado a ningún auto. Si sos del taller que lo pegó, ingresá para asignarlo.
          </p>
          <Link href={`/login?next=/q/${code}`} className="btn-primary">Ingresar y asignar</Link>
        </section>
      ) : (
        <section className="space-y-5">
          <div className="space-y-1.5">
            <p className="font-mono text-xs tracking-widest text-muted uppercase">Sticker {pretty}</p>
            <h1 className="text-2xl font-bold">¿En qué auto lo pegaste?</h1>
            <p className="text-sm text-muted">Queda vinculado para siempre: después no se puede pasar a otro auto.</p>
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">
              {error === "patente" ? "La patente no es válida." : error}
            </p>
          )}

          {toConfirm && user.workshopVerified ? (
            <form action={assignStickerByPlate} className="card space-y-4 p-4">
              <input type="hidden" name="code" value={code} />
              <input type="hidden" name="plate" value={toConfirm.plate} />
              <input type="hidden" name="confirm" value="1" />
              <div className="space-y-1.5">
                <Plate plate={toConfirm.plate} size="lg" />
                <p className="font-semibold">{toConfirm.make} {toConfirm.model}</p>
              </div>
              <p className="text-sm text-muted">¿Confirmás que el sticker {pretty} está pegado en este auto?</p>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/q/${code}`} className="btn-secondary text-sm">Cambiar</Link>
                <button type="submit" className="btn-primary text-sm">Sí, asignar</button>
              </div>
            </form>
          ) : !user.workshopVerified ? (
            <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900">Podés asignar stickers cuando verifiquemos tu taller.</p>
          ) : (
            <>
              <form action={assignStickerByPlate} className="space-y-3">
                <input type="hidden" name="code" value={code} />
                <div>
                  <label htmlFor="plate" className="label">Patente</label>
                  <input id="plate" name="plate" required autoCapitalize="characters" autoComplete="off" placeholder="AE 482 KD" className="field font-mono text-lg font-semibold tracking-wider uppercase" />
                </div>
                <button type="submit" className="btn-primary">Asignar sticker</button>
                <p className="text-xs text-muted">Si el auto todavía no tiene legajo, lo das de alta y el sticker queda asignado al guardar.</p>
              </form>
              <Recent code={code} workshopId={user.workshopId} />
            </>
          )}
        </section>
      )}
    </main>
  );
}

async function Recent({ code, workshopId }: { code: string; workshopId: string }) {
  const recent = await recentVehicles(workshopId, 6);
  if (!recent.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted uppercase">O elegí uno reciente</p>
      <div className="grid grid-cols-2 gap-2">
        {recent.map((v) => (
          <form key={v.id} action={assignStickerByPlate}>
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="plate" value={v.plate} />
            <button type="submit" className="card flex w-full flex-col items-start gap-1.5 px-3 py-3 text-left">
              <Plate plate={v.plate} size="sm" />
              <span className="truncate text-xs text-muted">{v.make} {v.model}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
