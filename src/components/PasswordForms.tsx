"use client";

import { useActionState, useState } from "react";
import { createResetLink, requestReset, setNewPassword } from "@/app/actions/password";

/** Botón para que el dueño (o un admin) genere un link de contraseña nueva para otra persona. */
export function ResetLinkButton({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState(createResetLink, undefined);
  const [copied, setCopied] = useState(false);
  const message = state?.link
    ? `Hola ${name}! Con este link elegís una contraseña nueva para Legajo. Vence en 24 horas y sirve una sola vez: ${state.link}`
    : "";

  return (
    <div className="space-y-2">
      {!state?.link && (
        <form action={action}>
          <input type="hidden" name="userId" value={userId} />
          <button type="submit" disabled={pending} className="h-9 text-xs font-semibold text-accent">
            {pending ? "Generando…" : "Link de contraseña nueva"}
          </button>
        </form>
      )}
      {state?.error && <p className="text-xs text-red-700">{state.error}</p>}
      {state?.link && (
        <div className="space-y-2 rounded-xl bg-paper p-3">
          <p className="text-xs text-muted">Mandáselo a {name}. Vence en 24 horas.</p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center justify-center rounded-xl bg-[#1f7a4d] text-xs font-semibold text-white"
            >
              WhatsApp
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.link ?? "");
                  setCopied(true);
                } catch {}
              }}
              className="h-10 rounded-xl border border-line bg-white text-xs font-semibold"
            >
              {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  if (state?.sent) {
    return (
      <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
        Si hay una cuenta con ese email, te mandamos un link para elegir una contraseña nueva. Revisá también el spam.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">Email de tu cuenta</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Enviando…" : "Mandarme el link"}
      </button>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(setNewPassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="label">Contraseña nueva (mínimo 8 caracteres)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Repetila</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="field" />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">{state.error}</p>
      )}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}
