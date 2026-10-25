import type { Analysis } from "@/lib/ledger";

/** Puntaje y chequeos del historial: lo comparten el informe público, la ficha de agencia y el informe verificado. */
export function ReportSummary({ a }: { a: Analysis }) {
  const ring = !a.chainOk ? "border-red-400" : (a.score ?? 0) >= 80 ? "border-green-400" : (a.score ?? 0) >= 60 ? "border-amber-400" : "border-[#B9B7B0]";
  return (
    <>
      <section className="flex items-center gap-4 rounded-2xl bg-ink p-4 text-paper">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 font-mono text-xl font-semibold ${ring}`}>
          {a.score ?? "—"}
        </div>
        <div>
          <h2 className="font-bold">{a.verdict}</h2>
          <p className="text-xs leading-snug text-[#B9B7B0]">
            {a.effectiveCount} registro{a.effectiveCount === 1 ? "" : "s"} de {a.workshops} taller{a.workshops === 1 ? "" : "es"}
            {` · ${a.backedCount} con respaldo`}
            {a.currentKm !== null ? ` · último km: ${a.currentKm.toLocaleString("es-AR")}` : ""}
          </p>
        </div>
      </section>

      <ul>
        {a.checks.map((c) => (
          <li key={c.label} className="flex items-center gap-3 border-b border-[#EDEBE5] py-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${c.ok ? "bg-ok" : "bg-warn"}`}
              aria-label={c.ok ? "Correcto" : "Atención"}
            >
              {c.ok ? (
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M12 7v6M12 17h.01" /></svg>
              )}
            </span>
            <span className="flex-1 text-sm font-medium">{c.label}</span>
            <span className="text-xs text-muted">{c.note}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
