/** Puntaje del historial en una celda: verde, ámbar o gris; rojo si la cadena está alterada. */
export function ScoreBadge({ score, ok }: { score: number | null; ok: boolean }) {
  if (!ok) return <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">Alterado</span>;
  if (score === null) return <span className="text-muted">—</span>;
  const tone = score >= 80 ? "bg-emerald-50 text-ok" : score >= 60 ? "bg-amber-50 text-warn" : "bg-[#F3F2EE] text-muted";
  return <span className={`inline-block min-w-10 rounded-md px-2 py-1 text-center font-mono text-xs font-semibold ${tone}`}>{score}</span>;
}
