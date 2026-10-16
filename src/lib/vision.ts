import "server-only";
import { cleanVin, isValidPlate, normalizePlate } from "./plate";
import type { CardRead, Confidence, PlateRead, ReadKind, ReadResult, VinRead } from "./vision-types";

/**
 * Lectura de patentes, tarjeta verde y chasis con un modelo de visión (Claude).
 * Cada lectura pide JSON con schema fijo y después se valida el formato acá:
 * el modelo propone, las reglas argentinas (patente, VIN) deciden, y el taller confirma en pantalla.
 */

const MODEL = process.env.OCR_MODEL || "claude-sonnet-5-5";
const CONFIDENCE = { type: "string", enum: ["alta", "media", "baja"] };

export function visionEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}

const PROMPTS: Record<ReadKind, string> = {
  plate: `Sos un lector experto de patentes argentinas. Leé la patente del vehículo de la foto.
Formatos válidos:
- Mercosur autos: 2 letras, 3 números, 2 letras (ej. AE 482 KD).
- Mercosur motos: 1 letra, 3 números, 3 letras (ej. A 123 BCD).
- Formato anterior autos: 3 letras, 3 números (ej. OKB 903).
Leé cada carácter exactamente. Cuidado con las confusiones típicas: 0/O/D/Q, 1/I/L, 2/Z, 5/S, 8/B, 6/G, 7/T. Usá la estructura del formato para resolverlas: en Mercosur autos las posiciones 1-2 y 6-7 son letras y 3-5 son números; en el formato anterior 1-3 letras y 4-6 números.
Ignorá el texto "REPUBLICA ARGENTINA", banderas, logos de concesionarias y calcomanías.
Si hay varias patentes, elegí la del vehículo principal (la más grande o centrada).
plate: en mayúsculas, sin espacios ni guiones.
confidence: "alta" solo si todos los caracteres se ven nítidos; "media" si alguno es dudoso; "baja" si está borrosa, cortada o tapada.
alternatives: otras lecturas posibles si algún carácter es dudoso (sin espacios). Vacío si no hay dudas.
Si no hay una patente legible, found=false y explicá en reason qué pasa (borrosa, reflejo, muy lejos, cortada).`,

  card: `La foto es (o debería ser) la Cédula de Identificación del Automotor de Argentina ("tarjeta verde", o "tarjeta azul" de autorizado), de frente o dorso.
Extraé SOLO los datos del vehículo:
- plate: dominio/patente, en mayúsculas sin espacios.
- make: marca. model: modelo tal como figura. body_type: tipo (ej. SEDAN 4 PUERTAS, PICK-UP CABINA DOBLE).
- year: año del modelo o de fabricación si figura (4 dígitos), si no, vacío.
- vin: número de chasis (campo "Chasis" o "N° de chasis"); copiá los 17 caracteres exactos.
- engine_number: número de motor exacto.
NO transcribas datos personales (nombre del titular, DNI, CUIT, domicilio): no los incluyas en ningún campo.
Si un dato no aparece o no se puede leer con seguridad, dejá cadena vacía. No inventes.
is_vehicle_card=false si la imagen no es una cédula del automotor.
confidence: "alta" si los códigos (patente, chasis, motor) se leen nítidos; "media" o "baja" si hay dudas.`,

  vin: `Leé el número de chasis (VIN) del vehículo en la foto. Puede estar en una chapita al pie del parabrisas, en una etiqueta del marco de la puerta, grabado en el chasis o en un documento.
El VIN tiene exactamente 17 caracteres alfanuméricos y nunca usa las letras I, O ni Q: si ves algo parecido, es 1 o 0.
Copiá cada carácter exactamente, en mayúsculas, sin espacios ni guiones. Ignorá otros números (motor, fechas, códigos de pintura).
confidence: "alta" solo si los 17 caracteres se ven nítidos; "media" si alguno es dudoso; "baja" si no se lee bien.
alternatives: otras lecturas posibles si hay caracteres dudosos.
Si no hay un VIN legible, found=false y explicá en reason qué pasa.`,
};

const SCHEMAS: Record<ReadKind, object> = {
  plate: {
    type: "object",
    properties: {
      found: { type: "boolean" },
      plate: { type: "string" },
      confidence: CONFIDENCE,
      alternatives: { type: "array", items: { type: "string" } },
      reason: { type: "string" },
    },
    required: ["found", "plate", "confidence", "alternatives", "reason"],
    additionalProperties: false,
  },
  card: {
    type: "object",
    properties: {
      is_vehicle_card: { type: "boolean" },
      plate: { type: "string" },
      make: { type: "string" },
      model: { type: "string" },
      body_type: { type: "string" },
      year: { type: "string" },
      vin: { type: "string" },
      engine_number: { type: "string" },
      confidence: CONFIDENCE,
      reason: { type: "string" },
    },
    required: ["is_vehicle_card", "plate", "make", "model", "body_type", "year", "vin", "engine_number", "confidence", "reason"],
    additionalProperties: false,
  },
  vin: {
    type: "object",
    properties: {
      found: { type: "boolean" },
      vin: { type: "string" },
      confidence: CONFIDENCE,
      alternatives: { type: "array", items: { type: "string" } },
      reason: { type: "string" },
    },
    required: ["found", "vin", "confidence", "alternatives", "reason"],
    additionalProperties: false,
  },
};

async function ask(kind: ReadKind, base64: string, mediaType: string): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: PROMPTS[kind] },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: SCHEMAS[kind] } },
    }),
  });
  if (!res.ok) throw new Error(`vision ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
  if (data.stop_reason === "refusal") throw new Error("refusal");
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("empty");
  return JSON.parse(text) as Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const conf = (v: unknown): Confidence => (v === "alta" || v === "media" || v === "baja" ? v : "baja");
const lower = (a: Confidence, b: Confidence): Confidence => (a === "baja" || b === "baja" ? "baja" : a === "media" || b === "media" ? "media" : "alta");

function bestPlate(primary: string, alternatives: string[]) {
  const candidates = [primary, ...alternatives].map(normalizePlate).filter((p, i, a) => p && a.indexOf(p) === i);
  const valid = candidates.filter(isValidPlate);
  return { plate: valid[0] ?? null, usedAlternative: !!valid[0] && valid[0] !== normalizePlate(primary), others: valid.slice(1) };
}

export async function readImage(kind: ReadKind, base64: string, mediaType: string): Promise<ReadResult> {
  const r = await ask(kind, base64, mediaType);

  if (kind === "plate") {
    if (r.found === false) return { ok: false, error: str(r.reason) || "No se ve una patente en la foto." };
    const alts = Array.isArray(r.alternatives) ? r.alternatives.map(str) : [];
    const best = bestPlate(str(r.plate), alts);
    if (!best.plate) return { ok: false, error: "La lectura no coincide con ningún formato de patente. Sacá la foto más cerca y de frente." };
    const out: PlateRead = {
      ok: true,
      kind: "plate",
      plate: best.plate,
      confidence: best.usedAlternative ? lower(conf(r.confidence), "media") : conf(r.confidence),
      alternatives: best.others,
    };
    return out;
  }

  if (kind === "vin") {
    if (r.found === false) return { ok: false, error: str(r.reason) || "No se ve un número de chasis en la foto." };
    const candidates = [str(r.vin), ...(Array.isArray(r.alternatives) ? r.alternatives.map(str) : [])]
      .map(cleanVin)
      .filter((v, i, a): v is string => !!v && a.indexOf(v) === i);
    if (!candidates.length) return { ok: false, error: "No se pudo leer un VIN de 17 caracteres. Probá con más luz y de frente." };
    const out: VinRead = { ok: true, kind: "vin", vin: candidates[0], confidence: conf(r.confidence), alternatives: candidates.slice(1) };
    return out;
  }

  // Tarjeta verde
  if (r.is_vehicle_card === false) return { ok: false, error: "La foto no parece una tarjeta verde (cédula del automotor)." };
  const warnings: string[] = [];
  const plate = normalizePlate(str(r.plate));
  const vinRaw = str(r.vin);
  const vin = vinRaw ? cleanVin(vinRaw) : null;
  if (vinRaw && !vin) warnings.push("El número de chasis no se leyó completo: revisalo o cargalo con una foto del chasis.");
  const yearRaw = str(r.year).match(/\b(19[5-9]\d|20\d\d)\b/)?.[1] ?? "";
  const year = yearRaw && Number(yearRaw) <= new Date().getFullYear() + 1 ? yearRaw : "";
  if (plate && !isValidPlate(plate)) warnings.push("La patente leída no tiene un formato válido: revisala.");
  const out: CardRead = {
    ok: true,
    kind: "card",
    plate: isValidPlate(plate) ? plate : "",
    make: str(r.make).slice(0, 60),
    model: str(r.model).slice(0, 80),
    bodyType: str(r.body_type).slice(0, 60),
    year,
    vin: vin ?? "",
    engineNumber: str(r.engine_number).toUpperCase().replace(/\s+/g, "").slice(0, 30),
    confidence: conf(r.confidence),
    warnings,
  };
  return out;
}
