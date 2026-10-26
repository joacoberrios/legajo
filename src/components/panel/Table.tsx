import Link from "next/link";

/** Arma links del panel conservando los filtros actuales. */
export function makeHref(path: string, current: Record<string, string | number | null | undefined>) {
  return (over: Record<string, string | number | null | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...over })) {
      if (v === null || v === undefined || v === "" || (k === "p" && Number(v) === 1)) continue;
      q.set(k, String(v));
    }
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
}

/** Encabezado de columna que ordena: un clic ordena por esa columna, otro invierte el sentido. */
export function SortTh({
  label,
  col,
  sort,
  dir,
  href,
  align = "left",
  defaultDir = "asc",
}: {
  label: string;
  col: string;
  sort: string;
  dir: "asc" | "desc";
  href: (over: Record<string, string | number | null>) => string;
  align?: "left" | "right";
  defaultDir?: "asc" | "desc";
}) {
  const active = sort === col;
  const next = active ? (dir === "asc" ? "desc" : "asc") : defaultDir;
  return (
    <th scope="col" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined} className={`px-4 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      <Link href={href({ orden: col, dir: next, p: 1 })} className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}>
        {label}
        <span aria-hidden="true" className={`font-mono text-[10px] ${active ? "text-accent" : "text-[#B9B7B0]"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </Link>
    </th>
  );
}

export function Pager({ page, total, size, href }: { page: number; total: number; size: number; href: (over: Record<string, number>) => string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total ? (page - 1) * size + 1 : 0;
  const to = Math.min(total, page * size);
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link href={href({ p: page - 1 })} className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-ink hover:border-ink">Anterior</Link> : null}
        <span className="font-mono text-xs">{page} / {pages}</span>
        {page < pages ? <Link href={href({ p: page + 1 })} className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-ink hover:border-ink">Siguiente</Link> : null}
      </div>
    </div>
  );
}

export const tableCls = "w-full border-collapse text-sm";
export const theadCls = "border-b border-line bg-[#FAFAF8] text-xs tracking-wide whitespace-nowrap text-muted uppercase";
export const trCls = "border-b border-[#EDEBE5] last:border-0 hover:bg-[#FAFAF8]";
export const tdCls = "px-4 py-3 align-middle";
