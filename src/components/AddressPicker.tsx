"use client";

import { useState } from "react";

type Place = { address: string; lat: number; lng: number };
type Result = { display_name: string; lat: string; lon: string };

const NOMINATIM = "https://nominatim.openstreetmap.org";

/** Arma una dirección corta a partir de la respuesta de OpenStreetMap. */
function shortAddress(r: { display_name: string; address?: Record<string, string> }) {
  const a = r.address;
  if (!a) return r.display_name;
  const street = [a.road, a.house_number].filter(Boolean).join(" ");
  const city = a.city || a.town || a.village || a.suburb || a.city_district || "";
  const state = a.state || "";
  return [street, city, state].filter(Boolean).join(", ") || r.display_name;
}

/**
 * Dirección del taller ubicada en el mapa. Dos caminos:
 * - escribir la dirección y elegir el resultado correcto,
 * - o, estando en el taller, usar la ubicación del celular (lo más preciso).
 * Guarda dirección + coordenadas en inputs ocultos (address, lat, lng).
 */
export function AddressPicker({ initial }: { initial?: Place | null }) {
  const [query, setQuery] = useState(initial?.address ?? "");
  const [place, setPlace] = useState<Place | null>(initial ?? null);
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "locating">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function search() {
    if (query.trim().length < 5) {
      setMessage("Escribí calle, número y localidad.");
      return;
    }
    setStatus("searching");
    setMessage(null);
    setResults([]);
    try {
      const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ar&accept-language=es&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = (await res.json()) as (Result & { address?: Record<string, string> })[];
      if (!data.length) setMessage("No encontramos esa dirección. Probá agregando la localidad, o usá tu ubicación actual.");
      else if (data.length === 1) choose(data[0]);
      else setResults(data);
    } catch {
      setMessage("No pudimos buscar la dirección. Revisá la conexión.");
    } finally {
      setStatus("idle");
    }
  }

  function choose(r: Result & { address?: Record<string, string> }) {
    const p = { address: shortAddress(r), lat: Number(r.lat), lng: Number(r.lon) };
    setPlace(p);
    setQuery(p.address);
    setResults([]);
  }

  function locate() {
    if (!navigator.geolocation) {
      setMessage("Este celular no permite usar la ubicación.");
      return;
    }
    setStatus("locating");
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        let address = query;
        try {
          const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=es&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          address = shortAddress(data);
        } catch {}
        setPlace({ address, lat, lng });
        setQuery(address);
        setResults([]);
        setStatus("idle");
        if (accuracy > 100) setMessage(`La ubicación tiene un margen de ${Math.round(accuracy)} m. Si el punto no cae en el taller, buscá la dirección.`);
      },
      () => {
        setStatus("idle");
        setMessage("No pudimos obtener tu ubicación. Revisá el permiso del navegador o buscá la dirección.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  const d = 0.0025;
  const mapSrc = place
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${place.lng - d * 1.6},${place.lat - d},${place.lng + d * 1.6},${place.lat + d}&layer=mapnik&marker=${place.lat},${place.lng}`
    : null;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="addressQuery" className="label">Dirección del taller</label>
        <div className="flex gap-2">
          <input
            id="addressQuery"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setQuery(e.target.value);
              setPlace(null);
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            placeholder="San Martín 1234, Godoy Cruz"
            autoComplete="street-address"
            className="field"
          />
          <button type="button" onClick={search} disabled={status !== "idle"} className="h-[52px] shrink-0 rounded-xl bg-ink px-4 text-sm font-semibold text-white">
            {status === "searching" ? "…" : "Buscar"}
          </button>
        </div>
      </div>

      <button type="button" onClick={locate} disabled={status !== "idle"} className="btn-secondary text-sm">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></svg>
        {status === "locating" ? "Buscando tu ubicación…" : "Estoy en el taller: usar mi ubicación"}
      </button>

      {results.length > 0 && (
        <ul className="card divide-y divide-[#EDEBE5]">
          <li className="px-4 py-2 text-xs font-semibold text-muted">¿Cuál es?</li>
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button type="button" onClick={() => choose(r)} className="w-full px-4 py-3 text-left text-sm">
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {message && <p className="text-xs text-red-700">{message}</p>}

      {place && mapSrc && (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-2xl border border-line">
            <iframe title="Ubicación del taller" src={mapSrc} className="h-52 w-full" loading="lazy" />
          </div>
          <p className="flex items-start gap-2 text-xs text-ok">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M20 6 9 17l-5-5" /></svg>
            <span>Revisá que el marcador caiga sobre el taller. Si no, buscá de nuevo o usá tu ubicación estando ahí.</span>
          </p>
        </div>
      )}

      <input type="hidden" name="address" value={place?.address ?? ""} />
      <input type="hidden" name="lat" value={place ? String(place.lat) : ""} />
      <input type="hidden" name="lng" value={place ? String(place.lng) : ""} />
    </div>
  );
}
