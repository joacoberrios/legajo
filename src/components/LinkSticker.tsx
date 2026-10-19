"use client";

import { useState, useTransition } from "react";
import { linkStickerToVehicle } from "@/app/actions/stickers";
import { QrScanner } from "@/components/QrScanner";
import { formatPlate } from "@/lib/plate";
import { formatStickerCode, normalizeStickerCode } from "@/lib/sticker-code";

/** Vincular un sticker sin asignar a este auto: escaneándolo o tipeando el código impreso debajo del QR. */
export function LinkSticker({ plate }: { plate: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <div className="space-y-2">
        <button type="button" onClick={() => { setOpen(true); setResult(null); }} className="btn-secondary text-sm">
          Vincular sticker QR
        </button>
        {result?.ok && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">{result.text}</p>}
      </div>
    );
  }

  const confirm = () =>
    code &&
    start(async () => {
      const r = await linkStickerToVehicle(code, plate);
      if (r.ok) {
        setResult({ ok: true, text: `Sticker ${formatStickerCode(code)} vinculado. Ya lleva al legajo de este auto.` });
        setOpen(false);
        setCode(null);
      } else setResult({ ok: false, text: r.error });
    });

  return (
    <section className="card space-y-3.5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Vincular sticker</h2>
        <button type="button" onClick={() => { setOpen(false); setCode(null); setResult(null); }} className="h-11 px-2 text-sm font-semibold text-muted">Cerrar</button>
      </div>

      {code ? (
        <div className="space-y-3">
          <p className="text-sm">
            ¿Vincular el sticker <span className="font-mono font-semibold">{formatStickerCode(code)}</span> a <span className="font-mono font-semibold">{formatPlate(plate)}</span>? Es definitivo.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCode(null)} className="btn-secondary text-sm">Cambiar</button>
            <button type="button" onClick={confirm} disabled={pending} className="btn-primary text-sm">{pending ? "Vinculando…" : "Sí, vincular"}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">Pegá el sticker en el parabrisas y escanealo.</p>
          <QrScanner label="Escanear sticker" onSticker={(c) => { setResult(null); setCode(c); }} />
          <form
            onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const c = normalizeStickerCode(typed);
              if (c) { setResult(null); setCode(c); }
              else setResult({ ok: false, text: "El código tiene 8 caracteres, como ABCD-2345." });
            }}
            className="space-y-2"
          >
            <label htmlFor="stickerCode" className="label">O tipeá el código impreso debajo del QR</label>
            <div className="flex gap-2">
              <input id="stickerCode" value={typed} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTyped(e.target.value.toUpperCase())} placeholder="ABCD-2345" autoCapitalize="characters" autoComplete="off" className="field font-mono uppercase" />
              <button type="submit" className="h-[52px] shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-white">Seguir</button>
            </div>
          </form>
        </>
      )}

      {result && !result.ok && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">{result.text}</p>}
    </section>
  );
}
