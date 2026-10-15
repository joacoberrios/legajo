"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashToken, INVITE_DAYS, newToken } from "@/lib/invitations";
import { appUrl } from "@/lib/url";

export type InviteState = { link?: string; error?: string } | undefined;

/** Solo el dueño del taller crea links de invitación. El link se muestra una sola vez. */
export async function createInvite(_: InviteState): Promise<InviteState> {
  const user = await requireUser();
  if (user.role !== "owner") return { error: "Solo el dueño del taller puede invitar." };

  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  await db()`
    INSERT INTO invitations (workshop_id, token_hash, created_by, expires_at)
    VALUES (${user.workshopId}, ${hashToken(token)}, ${user.id}, ${expiresAt})
  `;
  revalidatePath("/taller/equipo");
  return { link: `${await appUrl()}/invitacion/${token}` };
}

export async function revokeInvite(form: FormData) {
  const user = await requireUser();
  if (user.role !== "owner") return;
  const id = String(form.get("inviteId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db()`
    UPDATE invitations SET revoked_at = now()
    WHERE id = ${id} AND workshop_id = ${user.workshopId} AND used_at IS NULL
  `;
  revalidatePath("/taller/equipo");
}

export type AcceptState = { error?: string } | undefined;

/** El mecánico crea su cuenta desde el link. Se usa una sola vez y queda asociado al taller que invitó. */
export async function acceptInvite(_: AcceptState, form: FormData): Promise<AcceptState> {
  const token = String(form.get("token") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!name) return { error: "Completá tu nombre." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "El email no es válido." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const passwordHash = await hashPassword(password);
  const result = await db().begin(async (tx) => {
    const [inv] = await tx<{ id: string; workshopId: string; expiresAt: Date; usedAt: Date | null; revokedAt: Date | null }[]>`
      SELECT id, workshop_id, expires_at, used_at, revoked_at FROM invitations
      WHERE token_hash = ${hashToken(token)} FOR UPDATE
    `;
    if (!inv || inv.revokedAt || inv.usedAt || inv.expiresAt.getTime() < Date.now()) {
      return { error: "Este link de invitación ya no es válido. Pedile uno nuevo al dueño del taller." };
    }
    const taken = await tx`SELECT 1 FROM users WHERE email = ${email}`;
    if (taken.length) return { error: "Ya hay una cuenta con ese email. Ingresá con ella o usá otro email." };

    const [u] = await tx<{ id: string }[]>`
      INSERT INTO users (workshop_id, email, name, password_hash, role)
      VALUES (${inv.workshopId}, ${email}, ${name}, ${passwordHash}, 'mechanic')
      RETURNING id
    `;
    await tx`UPDATE invitations SET used_at = now(), used_by = ${u.id} WHERE id = ${inv.id}`;
    return { userId: u.id };
  });

  if ("error" in result) return { error: result.error };
  await startSession(result.userId);
  redirect("/taller");
}
