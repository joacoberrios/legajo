"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Point } from "@/components/MapPicker";
import { typedNumber } from "@/lib/address";

// El mapa solo existe en el navegador.
const MapPicker = dynamic(() => import("@/components/MapPicker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center rounded-2xl border border-line bg-white text-sm text-muted">Cargando mapa…</div>,
});

type Place = { address: string; lat: number; lng: number };
type GeoPlace = { label: string; address: string; lat: number; lng: number; exact?: boolean };

async function geo(params: string): Promise<{ ok: boolean; results?: GeoPlace[]; place?: GeoPlace | null; error?: string }> {
  try {
    const res = await fetch(`/api/geo?${params}`);
    return await res.json();
  } catch {
    return { ok: false, error: "Sin conexión." };
  }
}

const geoErrors = (place: string): Record<number, string> => ({
  1: `El permiso de ubicación está bloqueado. En iPhone: Ajustes › Privacidad › Localización › tu navegador › "Al usar la app". En Android: tocá el candado de la barra de direcciones › Permisos › Ubicación. También podés marcar ${place} tocando el mapa.`,
  2: `El celular no pudo determinar la ubicación (¿GPS apagado?). Activalo o marcá ${place} tocando el mapa.`,
  3: `La ubicación tardó demasiado. Probá de nuevo cerca de una ventana o marcá ${place} tocando el mapa.`,
});

function getPosition(highAccuracy: boolean, timeout: number) {
  return new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: highAccuracy, timeout, maximumAge: 30_000 }),
  );
}

/**
 * Ubicación del taller en tres pasos que se complementan:
 * 1) buscar la dirección, 2) usar el GPS del celular estando en el taller,
 * 3) ajustar tocando el mapa o arrastrando el pin. Lo que vale es el pin.
 */
export function AddressPicker({ initial, kind = "taller" }: { initial?: Place | null; kind?: "taller" | "agencia" }) {
  const place = kind === "agencia" ? "la agencia" : "el taller";
  const GEO_ERRORS = geoErrors(place);
  const [address, setAddress] = useState(initial?.address ?? "");
  const [point, setPoint] = useState<Point | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "locating">("idle");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  async function fillAddressFrom(p: Point) {
    const r = await geo(`lat=${p.lat}&lng=${p.lng}`);
    if (r.ok && r.place?.address) setAddress((current) => current || r.place!.address);
  }

  async function search() {
    if (address.trim().length < 5) {
      setMessage({ tone: "error", text: "Escribí calle, número y localidad." });
      return;
    }
    setStatus("searching");
    setMessage(null);
    setResults([]);
    const r = await geo(`q=${encodeURIComponent(address)}`);
    setStatus("idle");
    if (!r.ok) return setMessage({ tone: "error", text: r.error ?? "No pudimos buscar la dirección." });
    const found = r.results ?? [];
    if (!found.length) {
      return setMessage({ tone: "error", text: "No encontramos esa dirección. Probá agregando la localidad, usá tu ubicación o tocá el mapa." });
    }
    if (found.length === 1) choose(found[0]);
    else setResults(found);
  }

  function choose(r: GeoPlace) {
    setPoint({ lat: r.lat, lng: r.lng });
    setResults([]);
    const number = typedNumber(address);
    if (!r.exact && number) {
      // El mapa encontró la calle pero no la altura: se conserva lo tipeado y se pide ubicar el pin.
      setMessage({ tone: "error", text: `Encontramos la calle pero no el ${number}. El pin quedó en algún punto de la calle: arrastralo o tocá el mapa sobre ${place}.` });
      return;
    }
    setAddress(r.address);
    setMessage({ tone: "info", text: `Revisá el pin. Si no está justo sobre ${place}, tocá el mapa o arrastralo.` });
  }

  async function locate() {
    setMessage(null);
    if (!window.isSecureContext || !navigator.geolocation) {
      return setMessage({ tone: "error", text: `Este navegador no permite usar la ubicación. Marcá ${place} tocando el mapa.` });
    }
    setStatus("locating");
    let pos: GeolocationPosition;
    try {
      pos = await getPosition(true, 12_000);
    } catch (e) {
      const code = (e as GeolocationPositionError)?.code;
      if (code === 1) {
        setStatus("idle");
        return setMessage({ tone: "error", text: GEO_ERRORS[1] });
      }
      try {
        pos = await getPosition(false, 15_000); // reintento con menos precisión (redes WiFi/celulares)
      } catch (e2) {
        setStatus("idle");
        return setMessage({ tone: "error", text: GEO_ERRORS[(e2 as GeolocationPositionError)?.code] ?? GEO_ERRORS[2] });
      }
    }
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setPoint(p);
    setResults([]);
    setStatus("idle");
    setMessage({
      tone: "info",
      text:
        pos.coords.accuracy > 60
          ? `Ubicación aproximada (±${Math.round(pos.coords.accuracy)} m). Ajustá el pin tocando el mapa sobre ${place}.`
          : `Revisá el pin. Si no está justo sobre ${place}, tocá el mapa o arrastralo.`,
    });
    fillAddressFrom(p);
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="address" className="label">Dirección {kind === "agencia" ? "de la agencia" : "del taller"}</label>
        <div className="flex gap-2">
          <input
            id="address"
            name="address"
            value={address}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            placeholder="San Martín 1234, Godoy Cruz"
            autoComplete="street-address"
            required
            className="field"
          />
          <button type="button" onClick={search} disabled={status !== "idle"} className="h-[52px] shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-white">
            {status === "searching" ? "…" : "Buscar"}
          </button>
        </div>
      </div>

      <button type="button" onClick={locate} disabled={status !== "idle"} className="btn-secondary text-sm">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></svg>
        {status === "locating" ? "Buscando tu ubicación…" : `Estoy en ${place}: usar mi ubicación`}
      </button>

      {results.length > 0 && (
        <ul className="card divide-y divide-[#EDEBE5]">
          <li className="px-4 py-2 text-xs font-semibold text-muted">¿Cuál es?</li>
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" onClick={() => choose(r)} className="w-full px-4 py-3 text-left text-sm">
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p className={`rounded-xl px-3.5 py-2.5 text-xs ${message.tone === "error" ? "bg-red-50 text-red-800" : "bg-paper text-muted"}`}>{message.text}</p>
      )}

      <MapPicker
        point={point}
        onPick={(p: Point) => {
          setPoint(p);
          setMessage({ tone: "info", text: "Pin ubicado. Podés seguir ajustándolo." });
          fillAddressFrom(p);
        }}
      />
      <p className={`text-xs ${point ? "font-semibold text-ok" : "text-muted"}`}>
        {point ? `${kind === "agencia" ? "Agencia" : "Taller"} marcado en el mapa (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})` : `Tocá el mapa sobre ${place} para marcarlo.`}
      </p>

      <input type="hidden" name="lat" value={point ? String(point.lat) : ""} />
      <input type="hidden" name="lng" value={point ? String(point.lng) : ""} />
    </div>
  );
}
