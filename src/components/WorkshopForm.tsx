"use client";

import { useActionState } from "react";
import { updateWorkshop } from "@/app/actions/auth";
import { AddressPicker } from "@/components/AddressPicker";
import { PhoneInput } from "@/components/FormFields";

export function WorkshopForm({
  phone,
  place,
  kind = "taller",
}: {
  kind?: "taller" | "agencia";
  phone: string | null;
  place: { address: string; lat: number; lng: number } | null;
}) {
  const [state, action, pending] = useActionState(updateWorkshop, undefined);
  return (
    <form action={action} className="space-y-5">
      <PhoneInput defaultValue={phone ?? ""} label={kind === "agencia" ? "Teléfono de la agencia" : "Teléfono del taller"} />
      <AddressPicker initial={place} kind={kind} />
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">{state.error}</p>}
      {state?.saved && <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">Datos guardados.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
