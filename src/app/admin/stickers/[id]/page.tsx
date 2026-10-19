import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PrintButton } from "@/components/PrintButton";
import { Wordmark } from "@/components/Wordmark";
import { requireAdmin } from "@/lib/auth";
import { formatStickerCode } from "@/lib/sticker-code";
import { batchCodes } from "@/lib/stickers";
import { appUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

const PER_PAGE = 12; // 3 columnas x 4 filas en A4

/** Hoja para imprimir una tanda: 12 stickers de 60 x 66 mm por A4, cada uno con su QR y su código. */
export default async function PrintBatch({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ todos?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const batch = await batchCodes(id);
  if (!batch) notFound();
  const { todos } = await searchParams;

  const base = await appUrl();
  const codes = batch.codes.filter((c) => todos || !c.assigned);
  const stickers = await Promise.all(
    codes.map(async ({ code }) => ({
      code,
      svg: await QRCode.toString(`${base}/q/${code}`, { type: "svg", margin: 0, errorCorrectionLevel: "Q", color: { dark: "#15171a", light: "#ffffff" } }),
    })),
  );
  const pages = Array.from({ length: Math.ceil(stickers.length / PER_PAGE) }, (_, i) => stickers.slice(i * PER_PAGE, (i + 1) * PER_PAGE));

  return (
    <main className="space-y-5 px-5 py-6 print:p-0">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print { body > div { max-width: none !important; } .sheet { break-after: page; } .sheet:last-child { break-after: auto; } }
        .sheet, .sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="space-y-3 print:hidden">
        <Link href="/admin/stickers" className="inline-flex h-11 items-center text-sm font-semibold text-muted">← Stickers</Link>
        <h1 className="text-xl font-bold">{batch.label}</h1>
        <p className="text-sm text-muted">
          {codes.length} stickers en {pages.length} hoja{pages.length === 1 ? "" : "s"} A4. Imprimí en escala 100% (sin «ajustar a la página») o guardá como PDF para la imprenta.
          {!todos && batch.codes.length > codes.length && " Los ya asignados no se muestran."}
        </p>
        <PrintButton label="Imprimir / guardar PDF" />
      </div>

      <div className="space-y-6 overflow-x-auto print:space-y-0 print:overflow-visible">
        {pages.map((page, i) => (
          <div key={i} className="sheet grid w-[190mm] grid-cols-3 gap-[5mm] bg-white print:bg-transparent">
            {page.map((s) => (
              <div key={s.code} className="flex h-[66mm] w-[60mm] flex-col overflow-hidden rounded-[4mm] border-[0.4mm] border-ink bg-white">
                <div className="flex h-[10mm] items-center justify-center bg-ink">
                  <Wordmark height={14} color="#F3F2EE" />
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-[2mm] px-[5mm]">
                  <div className="w-[38mm]" dangerouslySetInnerHTML={{ __html: s.svg }} />
                  <div className="font-mono text-[11pt] font-semibold tracking-wider">{formatStickerCode(s.code)}</div>
                  <div className="text-center text-[7pt] leading-tight text-[#3F3E3A]">Escaneá para ver el historial verificado de este auto</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
