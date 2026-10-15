"use client";

import { useActionState, useState } from "react";
import { acceptInvite, createInvite } from "@/app/actions/team";

/** Botón del dueño: crea un link de invitación y lo deja listo para mandar por WhatsApp o copiar. */
export function InviteCreator({ workshopName }: { workshopName: string }) {
  const [state, action, pending] = useActionState(createInvite, undefined);
  const [copied, setCopied] = useState(false);
  const message = state?.link
    ? `Te invito a cargar los trabajos de ${workshopName} en Legajo. Creá tu usuario acá (vence en 7 días): ${state.link}`
    : "";

  return (
    <div className="space-y-3">
      <form action={action}>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Creando link…" : state?.link ? "Crear otro link" : "Invitar a un mecánico"}
        </button>
      </form>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.link && (
        <div className="card space-y-3 px-4 py-3.5">
          <p className="text-sm font-semibold">Link listo. Sirve para una sola persona y vence en 7 días.</p>
          <p className="rounded-lg bg-paper px-3 py-2 font-mono text-xs break-all">{state.link}</p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center rounded-xl bg-[#1f7a4d] text-sm font-semibold text-white"
            >
              Mandar por WhatsApp
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.link ?? "");
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="h-11 rounded-xl border border-line bg-white text-sm font-semibold"
            >
              {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Formulario del mecánico invitado para crear su cuenta. */
export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="name" className="label">Tu nombre</label>
        <input id="name" name="name" autoComplete="name" required className="field" />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña (mínimo 8 caracteres)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">{state.error}</p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creando cuenta…" : "Unirme al taller"}
      </button>
    </form>
  );
}
