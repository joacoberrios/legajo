import Link from "next/link";
import { createBatchAction, voidStickerAction } from "@/app/actions/stickers";
import { requireAdmin } from "@/lib/auth";
import { formatStickerCode } from "@/lib/sticker-code";
import { listBatches } from "@/lib/stickers";

export const dynamic = "force-dynamic";

export default async function StickersAdmin({ searchParams }: { searchParams: Promise<{ error?: string; anulado?: string }> }) {
  await requireAdmin();
  const { error, anulado } = await searchParams;
  const batches = await listBatches();
  const free = batches.reduce((n, b) => n + b.quantity - b.assigned - b.voided, 0);

  return (
    <main className="space-y-6 px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-extrabold tracking-tight">Stickers QR</div>
          <div className="text-xs text-muted">{free} sin asignar en total</div>
        </div>
        <Link href="/admin" className="flex h-11 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold">Admin</Link>
      </div>

      {error === "cantidad" && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">La cantidad va de 1 a 600 por tanda.</p>}
      {error && error !== "cantidad" && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">No encontramos ese sticker o ya estaba anulado.</p>}
      {anulado && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">Sticker {formatStickerCode(anulado)} anulado.</p>}

      <form action={createBatchAction} className="card space-y-4 p-4">
        <h1 className="font-bold">Nueva tanda para imprimir</h1>
        <p className="text-sm text-muted">Se imprimen sin auto. El taller los asigna cuando los pega, escaneándolos.</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="label" className="label">Nombre</label>
            <input id="label" name="label" placeholder="Piloto Mendoza #1" className="field" />
          </div>
          <div>
            <label htmlFor="quantity" className="label">Cantidad</label>
            <input id="quantity" name="quantity" type="number" min={1} max={600} defaultValue={120} required className="field font-mono" />
          </div>
        </div>
        <p className="text-xs text-muted">Van 12 por hoja A4: 120 son 10 hojas.</p>
        <button type="submit" className="btn-primary">Generar e ir a imprimir</button>
      </form>

      <section className="space-y-3">
        <h2 className="font-bold">Tandas</h2>
        {batches.length === 0 && <p className="text-sm text-muted">Todavía no generaste stickers.</p>}
        <ul className="card divide-y divide-[#EDEBE5]">
          {batches.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/stickers/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{b.label}</div>
                  <div className="text-xs text-muted">{b.createdAt.toLocaleDateString("es-AR")} · {b.quantity} stickers</div>
                </div>
                <div className="shrink-0 text-right font-mono text-xs">
                  <div>{b.assigned} asignados</div>
                  <div className="text-muted">{b.quantity - b.assigned - b.voided} libres</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form action={voidStickerAction} className="card space-y-3 p-4">
        <h2 className="font-bold">Anular un sticker</h2>
        <p className="text-sm text-muted">Para uno perdido, roto o pegado en el auto equivocado. Deja de llevar al legajo; el auto conserva sus otros stickers.</p>
        <div className="flex gap-2">
          <input name="code" required placeholder="ABCD-2345" autoCapitalize="characters" autoComplete="off" aria-label="Código del sticker" className="field font-mono uppercase" />
          <button type="submit" className="h-[52px] shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-white">Anular</button>
        </div>
      </form>
    </main>
  );
}
