"use client";

import { useActionState } from "react";
import { login, register } from "@/app/actions/auth";
import { AddressPicker } from "@/components/AddressPicker";
import { CuitInput, NameFields, PasswordPair, PhoneInput } from "@/components/FormFields";

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">
      {message}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
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
  const v = state?.values; // lo tipeado antes de un error
  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">El taller</legend>
        <div>
          <label htmlFor="workshopName" className="label">Nombre del taller</label>
          <input id="workshopName" name="workshopName" defaultValue={v?.workshopName} required className="field" />
        </div>
        <CuitInput defaultValue={v?.cuit} />
        <PhoneInput defaultValue={v?.phone} />
        <AddressPicker />
      </fieldset>
      <fieldset className="space-y-4 pt-2">
        <legend className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Tus datos</legend>
        <NameFields firstName={v?.firstName} lastName={v?.lastName} />
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" defaultValue={v?.email} required className="field" />
        </div>
        <PasswordPair />
      </fieldset>
      <ErrorBox message={state?.error} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
