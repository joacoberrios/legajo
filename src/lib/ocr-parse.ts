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

/**
 * Candidatos de patente en un texto de OCR, del más probable al menos.
 * Primero prueba palabras completas (o 2-3 palabras seguidas, "AE 482 KD"); recién después ventanas
 * que cortan palabras, con penalización: así "HG0315 ORIGINAL" da HGO315 y no "HG031SO".
 */
export function plateCandidates(text: string): { plate: string; fixes: number }[] {
  const best = new Map<string, { fixes: number; score: number }>();
  const consider = (raw: string, penalty: number) => {
    for (const pattern of PATTERNS) {
      const fit = fitPlate(raw, pattern);
      if (!fit) continue;
      const score = fit.fixes * 2 + penalty;
      const prev = best.get(fit.plate);
      if (!prev || score < prev.score) best.set(fit.plate, { fixes: fit.fixes, score });
    }
  };

  const lines = text
    .toUpperCase()
    .replace(/REP[UÚ]BLICA|ARGENTINA|MERCOSUR/g, " ")
    .split(/\n+/);

  for (const line of lines) {
    const words = line.split(/\s+/).map((w) => w.replace(/[^A-Z0-9]/g, "")).filter(Boolean);
    // 1) Palabras completas y grupos de 2-3 palabras seguidas.
    for (let i = 0; i < words.length; i++) {
      let joined = "";
      for (let j = i; j < Math.min(words.length, i + 3); j++) {
        joined += words[j];
        if (joined.length === 6 || joined.length === 7) consider(joined, j - i);
        if (joined.length >= 7) break;
      }
    }
    // 2) Ventanas que cortan palabras (el OCR pegó ruido): penalizadas.
    const compact = words.join("");
    for (const n of [6, 7]) {
      for (let i = 0; i + n <= compact.length; i++) consider(compact.slice(i, i + n), 3);
    }
  }

  return [...best.entries()]
    .sort((a, b) => a[1].score - b[1].score || a[1].fixes - b[1].fixes)
    .map(([plate, v]) => ({ plate, fixes: v.fixes }));
}

/** Dos patentes que solo difieren en confusiones de lectura (O/0, I/1, B/8…) se consideran la misma. */
export function samePlateLoose(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (TO_DIGIT[a[i]] !== b[i] && TO_DIGIT[b[i]] !== a[i]) return false;
  }
  return true;
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

  const valueAfter = (...labels: RegExp[]): string => {
    for (const label of labels) {
      const v = valueAfterOne(label);
      if (v) return v;
    }
    return "";
  };
  const valueAfterOne = (label: RegExp): string => {
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

  const B = "(?:^|[^A-Z])"; // inicio de palabra (tolera ruido adelante)
  const plateText = valueAfter(/D[O0]MINI[O0]/);
  // La patente es la primera palabra (o grupo) después de "DOMINIO", no lo que sigue en la línea.
  const plate = plateCandidates(plateText)[0]?.plate ?? "";
  const chassisText = valueAfter(/N[°ºO0.]?\s*(DE\s*)?CHASIS/, /CHASIS\s*N[°ºO0.]?\s*[:.]/, new RegExp(`${B}(?<!MARCA\\s)CHASIS`));
  const vin = vinCandidates(chassisText)[0] ?? vinCandidates(text)[0] ?? "";
  const engineNumber = firstCode(
    valueAfter(/N[°ºO0.]?\s*(DE\s*)?MOTOR/, /MOTOR\s*N[°ºO0.]?\s*[:.]/, new RegExp(`${B}(?<!MARCA\\s)MOTOR`)),
  ).replace(/-/g, "");
  const make = valueAfter(new RegExp(`${B}MARCA(?!\\s*(DEL\\s*)?(MOTOR|CHASIS))`)).split(/\s{2,}|MODELO/)[0].trim();
  const model = valueAfter(new RegExp(`${B}MODELO(?!\\s*A[NÑ]O)`)).split(/\s{2,}|TIPO/)[0].trim();
  const bodyType = valueAfter(new RegExp(`${B}TIPO`)).split(/\s{2,}|USO/)[0].trim();
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
