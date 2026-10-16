// Tipos de las lecturas con cámara. Sin dependencias de servidor: los usa también el navegador.

export type ReadKind = "plate" | "card" | "vin";
export type Confidence = "alta" | "media" | "baja";

export type PlateRead = { ok: true; kind: "plate"; plate: string; confidence: Confidence; alternatives: string[] };

export type CardRead = {
  ok: true;
  kind: "card";
  plate: string;
  make: string;
  model: string;
  bodyType: string;
  year: string;
  vin: string;
  engineNumber: string;
  confidence: Confidence;
  warnings: string[];
};

export type VinRead = { ok: true; kind: "vin"; vin: string; confidence: Confidence; alternatives: string[] };

export type ReadError = { ok: false; error: string };

export type ReadResult = PlateRead | CardRead | VinRead | ReadError;

/** Datos de la tarjeta verde que viajan a la pantalla de alta del auto. */
export type VehiclePrefill = Partial<Pick<CardRead, "make" | "model" | "bodyType" | "year" | "vin" | "engineNumber">>;

export function encodePrefill(p: VehiclePrefill): string {
  const json = JSON.stringify(p);
  const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePrefill(s: string | undefined): VehiclePrefill | null {
  if (!s) return null;
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
    const o = JSON.parse(json) as Record<string, unknown>;
    const pick = (k: string) => (typeof o[k] === "string" ? (o[k] as string).slice(0, 80) : undefined);
    return { make: pick("make"), model: pick("model"), bodyType: pick("bodyType"), year: pick("year"), vin: pick("vin"), engineNumber: pick("engineNumber") };
  } catch {
    return null;
  }
}
