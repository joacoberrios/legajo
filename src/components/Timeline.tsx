import Link from "next/link";
import type { RecordRow } from "@/lib/data";
import { RECORD_LABELS, type RecordType } from "@/lib/records-meta";

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
                  <h3 className="text-sm font-semibold">
                    {RECORD_LABELS[r.type]}
                    {fix && <span className="ml-1.5 text-xs font-medium text-warn">· corregido</span>}
                  </h3>
                  <span className="font-mono text-xs whitespace-nowrap text-muted">{formatKm(r.odometerKm)}</span>
                </div>
                <p className="text-xs text-muted">
                  {r.workshopName} · {formatDay(r.performedOn)}
                  {mode === "taller" && <> · cargó {r.userName}</>}
                </p>
                {r.items.length > 0 && <p className="text-sm leading-snug">{r.items.join(", ")}.</p>}
                {mode === "taller" && r.notes && <p className="text-sm leading-snug text-muted">{r.notes}</p>}
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
