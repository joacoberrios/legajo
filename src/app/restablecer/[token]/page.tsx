import type { Metadata } from "next";
import Link from "next/link";
import { NewPasswordForm } from "@/components/PasswordForms";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/invitations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contraseña nueva · Legajo", robots: { index: false, follow: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[A-Za-z0-9_-]{16,64}$/.test(token)
    ? (
        await db()<{ name: string }[]>`
          SELECT u.name FROM password_resets r JOIN users u ON u.id = r.user_id
          WHERE r.token_hash = ${hashToken(token)} AND r.used_at IS NULL AND r.expires_at > now()
        `
      )[0]
    : undefined;

  return (
    <main className="space-y-8 px-5 py-10">
      <Link href="/" className="text-2xl font-extrabold tracking-tight">Legajo</Link>
      {valid ? (
        <>
          <div>
            <h1 className="text-2xl font-bold">Hola {valid.name}</h1>
            <p className="mt-2 text-sm text-muted">Elegí tu contraseña nueva. Después entrás directo al taller.</p>
          </div>
          <NewPasswordForm token={token} />
        </>
      ) : (
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Link no válido</h1>
          <p className="text-sm text-muted">Este link ya se usó o venció. Pedí uno nuevo.</p>
          <Link href="/recuperar" className="btn-secondary">Recuperar contraseña</Link>
        </div>
      )}
    </main>
  );
}
