import Link from "next/link";
import type { Attachment, RecordRow } from "@/lib/data";
import { ATTACHMENT_LABELS, hasBacking, RECORD_LABELS, type RecordType } from "@/lib/records-meta";

const isPhoto = (a: Attachment) => a.contentType.startsWith("image/") && !/hei[cf]/.test(a.contentType);

/**
 * Miniaturas de los adjuntos. En el informe público los comprobantes no se abren
 * (pueden tener datos del dueño): solo se indica que existen.
 */
function Attachments({ items, mode }: { items: Attachment[]; mode: "taller" | "public" }) {
  return (
    <ul className="flex flex-wrap gap-2 pt-1">
      {items.map((a) => {
        const label = ATTACHMENT_LABELS[a.kind];
        if (mode === "public" && a.kind === "document") {
          return (
            <li key={a.id} className="flex h-16 items-center rounded-lg border border-line bg-paper px-2.5 text-[11px] font-semibold text-muted">
              Comprobante adjunto
            </li>
          );
        }
        return (
          <li key={a.id}>
            <a href={`/api/adjuntos/${a.id}`} target="_blank" rel="noopener noreferrer" title={label} className="block">
              {isPhoto(a) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/adjuntos/${a.id}`} alt={label} loading="lazy" className="h-16 w-16 rounded-lg border border-line object-cover" />
              ) : (
                <span className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-line bg-paper text-center">
                  <span className="font-mono text-xs font-semibold">{a.contentType === "application/pdf" ? "PDF" : "FOTO"}</span>
                  <span className="px-1 text-[9px] leading-tight text-muted">{label}</span>
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

const DOT: Record<RecordType, string> = {
  service: "bg-accent",
  repair: "bg-blue-700",
  diagnosis: "bg-violet-700",
  body: "bg-sky-700",
  inspection: "bg-ok",
  origin: "bg-ink",
  correction: "bg-warn",
};

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatKm(km: number) {
  return `${km.toLocaleString("es-AR")} km`;
}

/**
 * Línea de tiempo del legajo, del más nuevo al más viejo.
 * mode "taller" muestra notas, quién cargó y el link para corregir; "public" oculta lo interno.
 */
export function Timeline({
  records,
  mode,
  plate,
  workshopId,
}: {
  records: RecordRow[];
  mode: "taller" | "public";
  plate?: string;
  workshopId?: string;
}) {
  const corrected = new Map(records.filter((r) => r.correctsId).map((r) => [r.correctsId as string, r]));
  const items = [...records].sort(
    (a, b) => b.performedOn.localeCompare(a.performedOn) || b.createdAt.getTime() - a.createdAt.getTime(),
  );

  if (items.length === 0) {
    return <p className="text-sm text-muted">Este auto todavía no tiene registros.</p>;
  }

  return (
    <ol>
      {items.map((r) => {
        const fix = corrected.get(r.id);
        const canCorrect = mode === "taller" && !fix && r.type !== "correction" && r.workshopId === workshopId;
        return (
          <li key={r.id} className="flex gap-3">
            <div className="flex w-3.5 flex-col items-center" aria-hidden="true">
              <span className={`mt-4 h-3.5 w-3.5 shrink-0 rounded-full border-[3px] border-paper ${DOT[r.type]}`} />
              <span className="w-0.5 flex-1 bg-line" />
            </div>
            <div className="min-w-0 flex-1 pb-3.5">
              <div className={`card space-y-1.5 px-3.5 py-3 ${fix ? "opacity-60" : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="flex flex-wrap items-center gap-x-1.5 text-sm font-semibold">
                    {RECORD_LABELS[r.type]}
                    {fix && <span className="text-xs font-medium text-warn">· corregido</span>}
                    {hasBacking(r.attachments) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-ok">
                        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        Con respaldo
                      </span>
                    )}
                  </h3>
                  <span className="font-mono text-xs whitespace-nowrap text-muted">{formatKm(r.odometerKm)}</span>
                </div>
                <p className="text-xs text-muted">
                  {r.workshopName} · {formatDay(r.performedOn)}
                  {mode === "taller" && <> · cargó {r.userName}</>}
                </p>
                {r.items.length > 0 && <p className="text-sm leading-snug">{r.items.join(", ")}.</p>}
                {mode === "taller" && r.notes && <p className="text-sm leading-snug text-muted">{r.notes}</p>}
                {r.attachments.length > 0 && <Attachments items={r.attachments} mode={mode} />}
                {canCorrect && plate && (
                  <Link href={`/taller/auto/${plate}/nuevo?corrige=${r.id}`} className="inline-block pt-1 text-xs font-semibold text-accent">
                    Corregir este registro
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
