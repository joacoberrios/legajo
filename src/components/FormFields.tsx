"use client";

import { useState } from "react";
import { isValidCuit, maskCuit } from "@/lib/cuit";
import { formatPhone, nationalPhone } from "@/lib/phone";

/** CUIT con guiones automáticos y aviso si el dígito verificador no cierra. */
export function CuitInput({ defaultValue = "" }: { defaultValue?: string }) {
  const [value, setValue] = useState(maskCuit(defaultValue));
  const complete = value.replace(/\D/g, "").length === 11;
  const invalid = complete && !isValidCuit(value);
  return (
    <div>
      <label htmlFor="cuit" className="label">CUIT</label>
      <input
        id="cuit"
        name="cuit"
        inputMode="numeric"
        placeholder="20-12345678-9"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(maskCuit(e.target.value))}
        required
        aria-invalid={invalid}
        className={`field font-mono ${invalid ? "border-red-600" : ""}`}
      />
      {invalid && <p className="mt-1 text-xs text-red-700">Ese CUIT no es válido. Revisá los números.</p>}
    </div>
  );
}

/** Teléfono del taller: acepta cualquier formato y muestra cómo quedó. */
export function PhoneInput({ defaultValue = "", label = "Teléfono del taller" }: { defaultValue?: string; label?: string }) {
  const [value, setValue] = useState(defaultValue ? formatPhone(defaultValue) : "");
  const national = nationalPhone(value);
  const typed = value.replace(/\D/g, "").length >= 10;
  return (
    <div>
      <label htmlFor="phone" className="label">{label}</label>
      <input
        id="phone"
        name="phone"
        inputMode="tel"
        autoComplete="tel"
        placeholder="261 423-1234"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
        required
        className="field font-mono"
      />
      <p className={`mt-1 text-xs ${typed && !national ? "text-red-700" : "text-muted"}`}>
        {national ? `Queda como ${formatPhone(national)}` : typed ? "Revisá el número: código de área y número, sin 0 ni 15." : "Fijo o celular, con código de área."}
      </p>
    </div>
  );
}

/** Contraseña y repetición, con aviso en vivo si no coinciden. */
export function PasswordPair() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const mismatch = b.length > 0 && a !== b;
  return (
    <>
      <div>
        <label htmlFor="password" className="label">Contraseña (mínimo 8 caracteres)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required value={a} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setA(e.target.value)} className="field" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">Repetí la contraseña</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required value={b} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setB(e.target.value)} className={`field ${mismatch ? "border-red-600" : ""}`} />
        {mismatch && <p className="mt-1 text-xs text-red-700">Las contraseñas no coinciden.</p>}
      </div>
    </>
  );
}

/** Nombre y apellido en dos columnas. */
export function NameFields({ firstName, lastName }: { firstName?: string; lastName?: string } = {}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor="firstName" className="label">Nombre</label>
        <input id="firstName" name="firstName" autoComplete="given-name" defaultValue={firstName} required className="field" />
      </div>
      <div>
        <label htmlFor="lastName" className="label">Apellido</label>
        <input id="lastName" name="lastName" autoComplete="family-name" defaultValue={lastName} required className="field" />
      </div>
    </div>
  );
}
