"use client";

import { useState } from "react";
import { toWhatsAppNumber } from "@/lib/phone";

/** Le manda al dueño del auto el link de su legajo por WhatsApp. El teléfono no se guarda. */
export function ShareWithOwner({ message, defaultOpen = false }: { message: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [phone, setPhone] = useState("");
  const number = toWhatsAppNumber(phone);
  const invalid = phone.trim().length > 0 && !number;
  const href = `https://wa.me/${number ?? ""}?text=${encodeURIComponent(message)}`;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-sm">
        <WhatsAppIcon /> Mandar legajo al dueño
      </button>
    );
  }

  return (
    <div className="card space-y-3 px-4 py-3.5">
      <div>
        <p className="text-sm font-semibold">Mandale el legajo al dueño</p>
        <p className="text-xs text-muted">Recibe el link al historial verificado de su auto. El número no se guarda.</p>
      </div>
      <div>
        <label htmlFor="ownerPhone" className="label">Celular del dueño (opcional)</label>
        <input
          id="ownerPhone"
          inputMode="tel"
          autoComplete="off"
          placeholder="261 663 7057"
          value={phone}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)}
          className="field font-mono"
        />
        <p className={`mt-1 text-xs ${invalid ? "text-red-700" : "text-muted"}`}>
          {invalid ? "Revisá el número: código de área y número, sin 0 ni 15." : "Si lo dejás vacío, elegís el contacto en WhatsApp."}
        </p>
      </div>
      <p className="rounded-lg bg-paper px-3 py-2 text-xs leading-relaxed text-muted">{message}</p>
      <a
        href={invalid ? undefined : href}
        aria-disabled={invalid}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1f7a4d] font-semibold text-white ${invalid ? "pointer-events-none opacity-50" : ""}`}
      >
        <WhatsAppIcon /> Abrir WhatsApp
      </a>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
  );
}
