// Interpretación del texto que devuelve el OCR. Lógica pura (sin navegador), con tests.
import { cleanVin } from "./plate.ts";

/** Confusiones típicas del OCR, según qué tipo de carácter va en esa posición. */
const TO_LETTER: Record<string, string> = { "0": "O", "1": "I", "2": "Z", "4": "A", "5": "S", "6": "G", "7": "T", "8": "B" };
const TO_DIGIT: Record<string, string> = { O: "0", Q: "0", D: "0", U: "0", I: "1", L: "1", J: "1", Z: "2", A: "4", S: "5", G: "6", T: "7", B: "8" };

// L = letra, D = dígito
const PATTERNS = ["LLDDDLL", "LLLDDD", "LDDDLLL"] as const;

/** Ajusta un texto de 6 o 7 caracteres a un formato de patente, corrigiendo confusiones. Devuelve null si no encaja. */
export function fitPlate(raw: string, pattern: string): { plate: string; fixes: number } | null {
  if (raw.length !== pattern.length) return null;
  let out = "";
  let fixes = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    const wantLetter = pattern[i] === "L";
    const isLetter = c >= "A" && c <= "Z";
    if (wantLetter === isLetter) {
      out += c;
    } else {
      const fixed = wantLetter ? TO_LETTER[c] : TO_DIGIT[c];
      if (!fixed) return null;
      out += fixed;
      fixes++;
    }
  }
  return { plate: out, fixes };
}

/** Candidatos de patente en un texto de OCR, ordenados del más probable al menos. */
export function plateCandidates(text: string): { plate: string; fixes: number }[] {
  const found = new Map<string, number>();
  const lines = text
    .toUpperCase()
    .replace(/REP[UÚ]BLICA|ARGENTINA|MERCOSUR/g, " ")
    .split(/\n+/)
    .map((l) => l.replace(/[^A-Z0-9]/g, ""))
    .filter((l) => l.length >= 6);

  for (const line of lines) {
    for (const pattern of PATTERNS) {
      const n = pattern.length;
      for (let i = 0; i + n <= line.length; i++) {
        const fit = fitPlate(line.slice(i, i + n), pattern);
        if (!fit) continue;
        // Penaliza ventanas que no son la línea entera (texto de más alrededor).
        const score = fit.fixes + (line.length === n ? 0 : 1);
        const prev = found.get(fit.plate);
        if (prev === undefined || score < prev) found.set(fit.plate, score);
      }
    }
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).map(([plate, fixes]) => ({ plate, fixes }));
}

/**
 * VIN dentro de un texto de OCR. Arma grupos de 1 a 3 palabras seguidas que sumen exactamente 17 caracteres
 * (el OCR suele partir el VIN en dos) y, en líneas cortas, tolera 1 a 3 caracteres de ruido en los bordes.
 */
export function vinCandidates(text: string): string[] {
  const out: string[] = [];
  const add = (raw: string) => {
    const v = cleanVin(raw);
    // Un VIN real mezcla letras y números.
    if (v && /[A-Z]/.test(v) && /\d/.test(v) && !out.includes(v)) out.push(v);
  };
  for (const line of text.toUpperCase().split(/\n+/)) {
    const words = line
      .split(/\s+/)
      .map((w) => w.replace(/[^A-Z0-9]/g, ""))
      // Fuera rótulos y pedacitos sueltos ("N°", "NRO"): un VIN partido no tiene trozos de 1 o 2 caracteres.
      .filter((w) => w.length >= 3 && !/^(CHASIS|MOTOR|VIN|NRO|NUMERO|MARCA|DOMINIO)$/.test(w));
    for (let i = 0; i < words.length; i++) {
      let joined = "";
      for (let j = i; j < Math.min(words.length, i + 3); j++) {
        joined += words[j];
        if (joined.length === 17) add(joined);
        if (joined.length >= 17) break;
      }
    }
    const compact = words.join("");
    if (compact.length > 17 && compact.length <= 20) {
      for (let i = 0; i + 17 <= compact.length; i++) add(compact.slice(i, i + 17));
    }
  }
  return out;
}

export type CardFields = { plate: string; make: string; model: string; bodyType: string; year: string; vin: string; engineNumber: string };

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Datos del vehículo en el texto de una tarjeta verde. Busca cada rótulo y toma el valor en la misma línea
 * o en la siguiente. Nunca toma titular, documento ni domicilio.
 */
export function parseVehicleCard(text: string): CardFields {
  const lines = strip(text.toUpperCase())
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const valueAfter = (label: RegExp): string => {
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(label);
      if (!m) continue;
      const rest = lines[i].slice((m.index ?? 0) + m[0].length).replace(/^[\s:.\-]+/, "").trim();
      if (rest) return rest;
      if (lines[i + 1] && !/TITULAR|DOCUMENTO|DOMICILIO|D\.?N\.?I/.test(lines[i + 1])) return lines[i + 1];
    }
    return "";
  };
  const firstCode = (s: string, min = 5) => s.split(/\s+/).find((t) => /^[A-Z0-9-]+$/.test(t) && t.replace(/-/g, "").length >= min) ?? "";

  const plateText = valueAfter(/DOMINIO/);
  const plate = plateCandidates(plateText)[0]?.plate ?? "";
  const chassisText = valueAfter(/(N[°ºO.]?\s*(DE\s*)?CHASIS|CHASIS\s*N[°ºO.]?|^CHASIS)/);
  const vin = vinCandidates(chassisText)[0] ?? vinCandidates(text)[0] ?? "";
  const engineNumber = firstCode(valueAfter(/(N[°ºO.]?\s*(DE\s*)?MOTOR|MOTOR\s*N[°ºO.]?|^MOTOR)/)).replace(/-/g, "");
  const make = valueAfter(/^MARCA(?!\s*(DEL\s*)?(MOTOR|CHASIS))/).split(/\s{2,}|MODELO/)[0].trim();
  const model = valueAfter(/^MODELO(?!\s*ANO)/).split(/\s{2,}|TIPO/)[0].trim();
  const bodyType = valueAfter(/^TIPO/).split(/\s{2,}|USO/)[0].trim();
  const yearMatch = (valueAfter(/(MODELO\s*ANO|ANO\s*(DE\s*)?(MODELO|FABRICACION)|^ANO)/) || "").match(/\b(19[5-9]\d|20\d\d)\b/);
  const year = yearMatch && Number(yearMatch[1]) <= new Date().getFullYear() + 1 ? yearMatch[1] : "";

  return {
    plate,
    make: make.slice(0, 60),
    model: model.slice(0, 80),
    bodyType: bodyType.slice(0, 60),
    year,
    vin,
    engineNumber: engineNumber.slice(0, 30),
  };
}
