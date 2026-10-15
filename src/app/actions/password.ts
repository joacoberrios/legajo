"use server";

import { redirect } from "next/navigation";
import { hashPassword, isAdmin, requireUser, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailEnabled, sendEmail } from "@/lib/email";
import { hashToken, newToken } from "@/lib/invitations";
import { appUrl } from "@/lib/url";

const RESET_HOURS = 24;

async function createResetToken(userId: string, createdBy: string | null) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + RESET_HOURS * 3_600_000);
  await db()`
    INSERT INTO password_resets (user_id, token_hash, created_by, expires_at)
    VALUES (${userId}, ${hashToken(token)}, ${createdBy}, ${expiresAt})
  `;
  return `${await appUrl()}/restablecer/${token}`;
}

export type ResetLinkState = { link?: string; error?: string } | undefined;

/**
 * Link de contraseña nueva generado por otra persona:
 * el dueño para alguien de su equipo, o un admin de Legajo para cualquier usuario.
 */
export async function createResetLink(_: ResetLinkState, form: FormData): Promise<ResetLinkState> {
  const me = await requireUser();
  const userId = String(form.get("userId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { error: "Usuario inválido." };

  const [target] = await db()<{ id: string; workshopId: string }[]>`SELECT id, workshop_id FROM users WHERE id = ${userId}`;
  if (!target) return { error: "Usuario inválido." };
  const allowed = isAdmin(me) || (me.role === "owner" && target.workshopId === me.workshopId);
  if (!allowed) return { error: "No tenés permiso para hacer esto." };

  return { link: await createResetToken(target.id, me.id) };
}

export type ForgotState = { sent?: boolean; error?: string } | undefined;

/** Autoservicio por email (solo si hay proveedor configurado). Siempre responde igual, exista o no la cuenta. */
export async function requestReset(_: ForgotState, form: FormData): Promise<ForgotState> {
  if (!emailEnabled()) return { error: "La recuperación por email no está disponible todavía." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "El email no es válido." };

  const [user] = await db()<{ id: string; name: string }[]>`SELECT id, name FROM users WHERE email = ${email}`;
  if (user) {
    const link = await createResetToken(user.id, null);
    await sendEmail(
      email,
      "Elegí una contraseña nueva para Legajo",
      `<p>Hola ${user.name.replace(/[<>&]/g, "")},</p>
       <p>Para elegir una contraseña nueva, entrá a este link. Vence en ${RESET_HOURS} horas y sirve una sola vez:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Si no lo pediste, ignorá este email.</p>`,
    );
  }
  return { sent: true };
}

export type NewPasswordState = { error?: string } | undefined;

export async function setNewPassword(_: NewPasswordState, form: FormData): Promise<NewPasswordState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };

  const passwordHash = await hashPassword(password);
  const userId = await db().begin(async (tx) => {
    const [r] = await tx<{ id: string; userId: string; expiresAt: Date; usedAt: Date | null }[]>`
      SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ${hashToken(token)} FOR UPDATE
    `;
    if (!r || r.usedAt || r.expiresAt.getTime() < Date.now()) return null;
    await tx`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${r.userId}`;
    await tx`UPDATE password_resets SET used_at = now() WHERE id = ${r.id}`;
    // Los demás links pendientes de ese usuario dejan de servir.
    await tx`UPDATE password_resets SET used_at = now() WHERE user_id = ${r.userId} AND used_at IS NULL`;
    return r.userId;
  });

  if (!userId) return { error: "Este link ya no es válido. Pedí uno nuevo." };
  await startSession(userId);
  redirect("/taller");
}
