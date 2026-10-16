"use client";

// OCR gratis en el propio celular (Tesseract.js). La primera vez descarga el motor y el idioma (unos MB)
// y después queda en caché. Las fotos no salen del teléfono.
import type { Worker } from "tesseract.js";
import { parseVehicleCard, plateCandidates, vinCandidates } from "./ocr-parse";
import type { CardRead, Confidence, PlateRead, ReadResult, VinRead } from "./vision-types";

type Lang = "eng" | "spa";
const workers: Partial<Record<Lang, Promise<Worker>>> = {};

export function getWorker(lang: Lang): Promise<Worker> {
  if (!workers[lang]) {
    workers[lang] = (async () => {
      const T = await import("tesseract.js");
      return T.createWorker(lang, 1);
    })().catch((e) => {
      delete workers[lang];
      throw e;
    });
  }
  return workers[lang]!;
}

async function psm(kind: "block" | "line" | "auto" | "sparse") {
  const T = await import("tesseract.js");
  return { block: T.PSM.SINGLE_BLOCK, line: T.PSM.SINGLE_LINE, auto: T.PSM.AUTO, sparse: T.PSM.SPARSE_TEXT }[kind];
}

const PLATE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"; // sin I, O ni Q

/** Escala de grises con contraste estirado; opcionalmente binariza (Otsu) e invierte. */
export function preprocess(canvas: HTMLCanvasElement, opts: { binarize?: boolean; invert?: boolean } = {}) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const gray = new Uint8ClampedArray(d.length / 4);
  let min = 255;
  let max = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  const hist = new Array(256).fill(0);
  for (let j = 0; j < gray.length; j++) {
    gray[j] = ((gray[j] - min) * 255) / range;
    hist[gray[j]]++;
  }
  let threshold = 128;
  if (opts.binarize) {
    // Otsu: umbral que mejor separa fondo y caracteres.
    const total = gray.length;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0;
    let wB = 0;
    let best = 0;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) ** 2;
      if (between > best) {
        best = between;
        threshold = t;
      }
    }
  }
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    let v = opts.binarize ? (gray[j] > threshold ? 255 : 0) : gray[j];
    if (opts.invert) v = 255 - v;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Copia un recorte de una imagen/video a un canvas del ancho pedido. */
export function crop(source: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, width: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round((width * sh) / sw);
  canvas.getContext("2d")?.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function fileToCanvas(file: File, width: number) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const w = Math.min(width, Math.max(bmp.width, 1200));
  return crop(bmp, 0, 0, bmp.width, bmp.height, w);
}

const toConfidence = (c: number): Confidence => (c >= 85 ? "alta" : c >= 65 ? "media" : "baja");

/** Lee un recorte de patente (un cuadro del video). Devuelve candidatos válidos y la confianza del OCR. */
export async function readPlateCanvas(canvas: HTMLCanvasElement) {
  const worker = await getWorker("eng");
  await worker.setParameters({ tessedit_char_whitelist: PLATE_CHARS, tessedit_pageseg_mode: await psm("block") });
  const { data } = await worker.recognize(canvas);
  return { candidates: plateCandidates(data.text), confidence: data.confidence };
}

export async function readPlateFile(file: File): Promise<ReadResult> {
  const worker = await getWorker("eng");
  await worker.setParameters({ tessedit_char_whitelist: PLATE_CHARS, tessedit_pageseg_mode: await psm("sparse") });
  for (const invert of [false, true]) {
    const canvas = preprocess(await fileToCanvas(file, 1600), { binarize: true, invert });
    const { data } = await worker.recognize(canvas);
    const c = plateCandidates(data.text);
    if (c.length) {
      const out: PlateRead = { ok: true, kind: "plate", plate: c[0].plate, confidence: c[0].fixes ? "media" : toConfidence(data.confidence), alternatives: c.slice(1, 4).map((x) => x.plate) };
      return out;
    }
  }
  return { ok: false, error: "No encontramos una patente en la foto. Usá el escáner en vivo o tipeala." };
}

export async function readVinFile(file: File): Promise<ReadResult> {
  const worker = await getWorker("eng");
  await worker.setParameters({ tessedit_char_whitelist: VIN_CHARS, tessedit_pageseg_mode: await psm("block") });
  const tries: { binarize: boolean; invert?: boolean }[] = [{ binarize: false }, { binarize: true }, { binarize: true, invert: true }];
  for (const t of tries) {
    const canvas = preprocess(await fileToCanvas(file, 2000), t);
    const { data } = await worker.recognize(canvas);
    const c = vinCandidates(data.text);
    if (c.length) {
      const out: VinRead = { ok: true, kind: "vin", vin: c[0], confidence: toConfidence(data.confidence), alternatives: c.slice(1, 3) };
      return out;
    }
  }
  return { ok: false, error: "No se pudo leer un VIN de 17 caracteres. Sacá la foto de cerca, de frente y con buena luz, o tipealo." };
}

export async function readCardFile(file: File): Promise<ReadResult> {
  const worker = await getWorker("spa");
  await worker.setParameters({ tessedit_char_whitelist: "", tessedit_pageseg_mode: await psm("auto") });
  const canvas = preprocess(await fileToCanvas(file, 2400));
  const { data } = await worker.recognize(canvas);
  const f = parseVehicleCard(data.text);
  if (!f.plate && !f.vin && !f.make) {
    return { ok: false, error: "No pudimos leer la tarjeta verde. Sacá la foto de frente, sin reflejos y que ocupe toda la imagen." };
  }
  const warnings: string[] = ["Lectura automática en el celular: revisá cada dato contra la tarjeta."];
  if (!f.vin) warnings.push("No se leyó el número de chasis: cargalo con la foto del chasis o tipealo.");
  const out: CardRead = { ok: true, kind: "card", ...f, confidence: toConfidence(data.confidence) === "alta" ? "media" : "baja", warnings };
  return out;
}
