import Link from "next/link";
import { ForgotForm } from "@/components/PasswordForms";
import { emailEnabled } from "@/lib/email";
import { toWhatsAppNumber } from "@/lib/phone";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  const support = toWhatsAppNumber(process.env.SUPPORT_WHATSAPP ?? "");
  return (
    <main className="space-y-8 px-5 py-10">
      <div>
        <Link href="/" className="text-2xl font-extrabold tracking-tight">Legajo</Link>
        <h1 className="mt-6 text-2xl font-bold">Recuperar contraseña</h1>
      </div>

      {emailEnabled() && <ForgotForm />}

      <div className="space-y-3 text-sm">
        {emailEnabled() && <p className="font-semibold">¿No te llega el email?</p>}
        <div className="card space-y-1 px-4 py-3">
          <p className="font-semibold">Si sos mecánico</p>
          <p className="text-muted">Pedile al dueño del taller un link de contraseña nueva. Lo genera desde la sección Equipo.</p>
        </div>
        <div className="card space-y-2 px-4 py-3">
          <p className="font-semibold">Si sos el dueño del taller</p>
          <p className="text-muted">Escribinos y te mandamos un link para elegir una contraseña nueva.</p>
          {support && (
            <a
              href={`https://wa.me/${support}?text=${encodeURIComponent("Hola! Necesito recuperar la contraseña de mi taller en Legajo.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center rounded-xl bg-[#1f7a4d] font-semibold text-white"
            >
              Escribir por WhatsApp
            </a>
          )}
        </div>
      </div>

      <p className="text-sm text-muted">
        <Link href="/login" className="font-semibold text-accent">Volver a ingresar</Link>
      </p>
    </main>
  );
}
