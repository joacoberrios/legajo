"use client";

import { useActionState } from "react";
import { login, register } from "@/app/actions/auth";

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">
      {message}
    </p>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <ErrorBox message={state?.error} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">El taller</legend>
        <div>
          <label htmlFor="workshopName" className="label">Nombre del taller</label>
          <input id="workshopName" name="workshopName" required className="field" />
        </div>
        <div>
          <label htmlFor="cuit" className="label">CUIT</label>
          <input id="cuit" name="cuit" inputMode="numeric" placeholder="20-12345678-9" required className="field font-mono" />
        </div>
        <div>
          <label htmlFor="city" className="label">Ciudad</label>
          <input id="city" name="city" placeholder="Godoy Cruz, Mendoza" className="field" />
        </div>
      </fieldset>
      <fieldset className="space-y-4 pt-2">
        <legend className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Tu usuario</legend>
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
      </fieldset>
      <ErrorBox message={state?.error} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
