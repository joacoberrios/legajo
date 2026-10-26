import Link from "next/link";

/** Para admins: alternar entre toda la red y solo su cuenta. */
export function ScopeToggle({ path, all }: { path: string; all: boolean }) {
  const cls = (on: boolean) => `px-3 py-1.5 rounded-md text-xs font-semibold ${on ? "bg-ink text-white" : "text-muted hover:text-ink"}`;
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-white p-1" role="group" aria-label="Alcance">
      <Link href={path} className={cls(all)} aria-current={all ? "true" : undefined}>Toda la red</Link>
      <Link href={`${path}?vista=mia`} className={cls(!all)} aria-current={!all ? "true" : undefined}>Mi cuenta</Link>
    </div>
  );
}
