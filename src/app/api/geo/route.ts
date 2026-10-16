import { NextResponse } from "next/server";

/**
 * Geocodificación desde el servidor (búsqueda y dirección de un punto), con respaldo:
 * primero OpenStreetMap Nominatim y, si falla, Photon (Komoot). Se hace acá y no en el navegador
 * para identificarnos como pide la política de uso y no depender de bloqueos del celular.
 */

const UA = "Legajo/1.0 (historial de autos; contacto via legajo-nu.vercel.app)";

export type GeoPlace = { label: string; address: string; lat: number; lng: number };

// Límite simple por IP: 40 consultas por minuto.
const hits = new Map<string, number[]>();
function allowed(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 40) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

type NominatimItem = { display_name: string; lat: string; lon: string; address?: Record<string, string> };
type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string> };

function shortFromParts(p: { street?: string; number?: string; city?: string; state?: string }) {
  const street = [p.street, p.number].filter(Boolean).join(" ");
  return [street, p.city, p.state].filter(Boolean).join(", ");
}

function fromNominatim(r: NominatimItem): GeoPlace {
  const a = r.address ?? {};
  const address =
    shortFromParts({
      street: a.road || a.pedestrian || a.footway,
      number: a.house_number,
      city: a.city || a.town || a.village || a.suburb || a.city_district,
      state: a.state,
    }) || r.display_name;
  return { label: r.display_name, address, lat: Number(r.lat), lng: Number(r.lon) };
}

function fromPhoton(f: PhotonFeature): GeoPlace {
  const p = f.properties;
  const address = shortFromParts({ street: p.street || p.name, number: p.housenumber, city: p.city || p.district, state: p.state });
  const label = [p.name, p.street && `${p.street} ${p.housenumber ?? ""}`.trim(), p.city, p.state, p.country].filter(Boolean).join(", ");
  return { label: label || address, address: address || label, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "es" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

async function search(q: string): Promise<GeoPlace[]> {
  try {
    const data = await getJson<NominatimItem[]>(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ar&q=${encodeURIComponent(q)}`,
    );
    if (data.length) return data.map(fromNominatim);
  } catch {}
  const data = await getJson<{ features: PhotonFeature[] }>(
    // Rectángulo de Argentina continental para no traer resultados de otros países.
    `https://photon.komoot.io/api/?limit=5&bbox=-73.6,-55.1,-53.6,-21.7&q=${encodeURIComponent(q)}`,
  );
  return data.features.map(fromPhoton);
}

async function reverse(lat: number, lng: number): Promise<GeoPlace | null> {
  try {
    const r = await getJson<NominatimItem>(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`);
    if (r?.lat) return { ...fromNominatim(r), lat, lng };
  } catch {}
  try {
    const data = await getJson<{ features: PhotonFeature[] }>(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`);
    if (data.features[0]) return { ...fromPhoton(data.features[0]), lat, lng };
  } catch {}
  return null;
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowed(ip)) return NextResponse.json({ ok: false, error: "Demasiadas búsquedas seguidas. Esperá un minuto." }, { status: 429 });

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));

  try {
    if (q) {
      if (q.length < 4 || q.length > 200) return NextResponse.json({ ok: false, error: "Escribí calle, número y localidad." }, { status: 400 });
      return NextResponse.json({ ok: true, results: await search(q) });
    }
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return NextResponse.json({ ok: true, place: await reverse(lat, lng) });
    }
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "El servicio de mapas no respondió. Marcá el punto en el mapa a mano." }, { status: 502 });
  }
}
