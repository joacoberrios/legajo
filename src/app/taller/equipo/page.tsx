import Link from "next/link";
import { revokeInvite } from "@/app/actions/team";
import { InviteCreator } from "@/components/TeamInvite";
import { formatDay } from "@/components/Timeline";
import { requireUser } from "@/lib/auth";
import { teamOf } from "@/lib/invitations";

export default async function TeamPage() {
  const user = await requireUser();
  const { members, pending } = await teamOf(user.workshopId);
  const isOwner = user.role === "owner";

  return (
    <main className="space-y-6 px-5">
      <Link href="/taller" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-muted">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        Volver
      </Link>

      <div>
        <h1 className="text-xl font-bold">Equipo del taller</h1>
        <p className="mt-1 text-sm text-muted">
          Cada registro queda firmado por la persona que lo cargó, así que cada mecánico usa su propio usuario.
        </p>
      </div>

      <ul className="card divide-y divide-[#EDEBE5]">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {m.name}
                {m.id === user.id && <span className="font-normal text-muted"> (vos)</span>}
              </p>
              <p className="truncate text-xs text-muted">{m.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] font-semibold text-muted">
              {m.role === "owner" ? "Dueño" : "Mecánico"}
            </span>
          </li>
        ))}
      </ul>

      {isOwner ? (
        <section className="space-y-3">
          <InviteCreator workshopName={user.workshopName} />
          {pending.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Invitaciones sin usar</h2>
              <ul className="card divide-y divide-[#EDEBE5]">
                {pending.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-xs text-muted">
                      Creada el {formatDay(p.createdAt.toISOString().slice(0, 10))} · vence el {formatDay(p.expiresAt.toISOString().slice(0, 10))}
                    </span>
                    <form action={revokeInvite}>
                      <input type="hidden" name="inviteId" value={p.id} />
                      <button type="submit" className="h-11 px-2 text-xs font-semibold text-accent">
                        Anular
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted">Para sumar a alguien, pedile un link de invitación al dueño del taller.</p>
      )}
    </main>
  );
}
