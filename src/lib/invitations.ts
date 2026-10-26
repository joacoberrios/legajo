import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export const INVITE_DAYS = 7;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function newToken() {
  return randomBytes(18).toString("base64url"); // 24 caracteres, no adivinable
}

export type InviteStatus = "valid" | "used" | "expired" | "revoked" | "missing";

export type Invite = {
  id: string;
  workshopId: string;
  workshopName: string;
  workshopKind: "taller" | "agencia";
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
};

export function inviteStatus(inv: Invite | null): InviteStatus {
  if (!inv) return "missing";
  if (inv.revokedAt) return "revoked";
  if (inv.usedAt) return "used";
  if (inv.expiresAt.getTime() < Date.now()) return "expired";
  return "valid";
}

export async function findInvite(token: string): Promise<Invite | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const rows = await db()<Invite[]>`
    SELECT i.id, i.workshop_id, w.name AS workshop_name, w.kind AS workshop_kind, i.expires_at, i.used_at, i.revoked_at
    FROM invitations i JOIN workshops w ON w.id = i.workshop_id
    WHERE i.token_hash = ${hashToken(token)}
  `;
  return rows[0] ?? null;
}

export type TeamMember = { id: string; name: string; email: string; role: "owner" | "mechanic"; createdAt: Date };
export type PendingInvite = { id: string; createdAt: Date; expiresAt: Date };

export async function teamOf(workshopId: string) {
  const sql = db();
  const members = await sql<TeamMember[]>`
    SELECT id, name, email, role, created_at FROM users WHERE workshop_id = ${workshopId}
    ORDER BY role = 'owner' DESC, created_at
  `;
  const pending = await sql<PendingInvite[]>`
    SELECT id, created_at, expires_at FROM invitations
    WHERE workshop_id = ${workshopId} AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC
  `;
  return { members, pending };
}
