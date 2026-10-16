import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { readImage, visionEnabled } from "@/lib/vision";
import type { ReadKind } from "@/lib/vision-types";

export const maxDuration = 60;

const KINDS: ReadKind[] = ["plate", "card", "vin"];
const TYPES = ["image/jpeg", "image/png", "image/webp"];

// Límite simple por usuario (por instancia): 30 lecturas cada 10 minutos.
const hits = new Map<string, number[]>();
function allowed(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 30) return false;
  recent.push(now);
  hits.set(userId, recent);
  return true;
}

/**
 * Lee una foto (patente, tarjeta verde o chasis) y devuelve los datos para confirmar.
 * La foto no se guarda: se procesa y se descarta.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Tenés que ingresar." }, { status: 401 });
  if (!visionEnabled()) {
    return NextResponse.json({ ok: false, error: "La lectura con cámara no está configurada todavía. Tipeá los datos." }, { status: 503 });
  }
  if (!allowed(user.id)) {
    return NextResponse.json({ ok: false, error: "Hiciste muchas lecturas seguidas. Esperá unos minutos." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const kind = String(form?.get("kind") ?? "") as ReadKind;
  const file = form?.get("image");
  if (!KINDS.includes(kind) || !(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  }
  if (!TYPES.includes(file.type)) {
    return NextResponse.json({ ok: false, error: "Formato de foto no soportado. Sacala de nuevo con la cámara." }, { status: 400 });
  }
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "La foto es demasiado pesada." }, { status: 400 });
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return NextResponse.json(await readImage(kind, base64, file.type));
  } catch (e) {
    console.error("[leer]", e);
    return NextResponse.json({ ok: false, error: "No pudimos leer la foto. Probá de nuevo o tipeá los datos." }, { status: 502 });
  }
}
