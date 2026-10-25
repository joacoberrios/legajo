"use client";

import { useActionState, useState } from "react";
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
  const [kind, setKind] = useState<"taller" | "agencia">(v?.kind ?? "taller");
  const agency = kind === "agencia";
  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">Tipo de cuenta</legend>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["taller", "Taller mecánico", "Cargo los trabajos que hago"],
            ["agencia", "Agencia de autos", "Compro y vendo usados"],
          ] as const).map(([value, title, hint]) => (
            <label key={value} className={`card cursor-pointer space-y-1 px-3.5 py-3 ${kind === value ? "ring-2 ring-accent" : ""}`}>
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="sr-only" />
              <span className="block text-sm font-bold">{title}</span>
              <span className="block text-xs text-muted">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold tracking-wide text-muted uppercase">{agency ? "La agencia" : "El taller"}</legend>
        <div>
          <label htmlFor="workshopName" className="label">Nombre {agency ? "de la agencia" : "del taller"}</label>
          <input id="workshopName" name="workshopName" defaultValue={v?.workshopName} required className="field" />
        </div>
        <CuitInput defaultValue={v?.cuit} />
        <PhoneInput defaultValue={v?.phone} label={agency ? "Teléfono de la agencia" : "Teléfono del taller"} />
        <AddressPicker kind={kind} />
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
