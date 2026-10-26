import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInviteForm } from "@/components/TeamInvite";
import { findInvite, inviteStatus } from "@/lib/invitations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invitación · Legajo", robots: { index: false, follow: false } };

const MESSAGES = {
  used: "Este link ya se usó para crear una cuenta.",
  expired: "Este link venció.",
  revoked: "Anularon este link.",
  missing: "Este link no existe.",
} as const;

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findInvite(token);
  const status = inviteStatus(invite);

  return (
    <main className="space-y-8 px-5 py-10">
      <Link href="/" className="text-2xl font-extrabold tracking-tight">Legajo</Link>
      {status === "valid" && invite ? (
        <>
          <div>
            <h1 className="text-2xl font-bold">Sumate a {invite.workshopName}</h1>
            <p className="mt-2 text-sm text-muted">
              {invite.workshopKind === "agencia"
                ? "Creá tu usuario para revisar autos, seguir el stock y emitir informes verificados."
                : "Creá tu usuario para cargar los trabajos del taller. Cada registro queda firmado con tu nombre."}
            </p>
          </div>
          <AcceptInviteForm token={token} agency={invite.workshopKind === "agencia"} />
          <p className="text-sm text-muted">
            ¿Ya tenés cuenta? <Link href="/login" className="font-semibold text-accent">Ingresá</Link>
          </p>
        </>
      ) : (
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Invitación no válida</h1>
          <p className="text-sm text-muted">{MESSAGES[status as keyof typeof MESSAGES]} Pedile un link nuevo a quien te invitó.</p>
        </div>
      )}
    </main>
  );
}
