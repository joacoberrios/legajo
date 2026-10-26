"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function setWorkshopVerified(form: FormData) {
  await requireAdmin();
  const id = String(form.get("workshopId") ?? "");
  const verified = form.get("verified") === "true";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db()`UPDATE workshops SET verified = ${verified} WHERE id = ${id}`;
  revalidatePath("/admin");
}

/** Cambia el tipo de cuenta: taller (carga registros) o agencia (consulta, sigue autos, emite informes). */
export async function setWorkshopKind(form: FormData) {
  await requireAdmin();
  const id = String(form.get("workshopId") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || (kind !== "taller" && kind !== "agencia")) return;
  await db()`UPDATE workshops SET kind = ${kind} WHERE id = ${id}`;
  revalidatePath("/admin");
}

/**
 * Elimina una cuenta (taller o agencia) con sus usuarios. Solo si no dejó nada en el historial público:
 * los registros firmados y los informes verificados son inmutables y no se pueden borrar.
 */
export async function deleteWorkshop(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("workshopId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  if (id === admin.workshopId) redirect("/admin?error=propia");

  const sql = db();
  const [w] = await sql<{ name: string; records: number; reports: number; batches: number }[]>`
    SELECT w.name,
      (SELECT count(*) FROM service_records r WHERE r.workshop_id = w.id)::int AS records,
      (SELECT count(*) FROM verified_reports v WHERE v.workshop_id = w.id)::int AS reports,
      (SELECT count(*) FROM sticker_batches b JOIN users u ON u.id = b.created_by WHERE u.workshop_id = w.id)::int AS batches
    FROM workshops w WHERE w.id = ${id}
  `;
  if (!w) redirect("/admin");
  if (w.records > 0 || w.reports > 0 || w.batches > 0) redirect(`/admin?error=historial&cuenta=${encodeURIComponent(w.name)}`);

  await sql.begin(async (tx) => {
    await tx`UPDATE stickers SET assigned_by = NULL WHERE assigned_by IN (SELECT id FROM users WHERE workshop_id = ${id})`;
    await tx`UPDATE stickers SET assigned_workshop_id = NULL WHERE assigned_workshop_id = ${id}`;
    await tx`UPDATE vehicles SET created_by_workshop = NULL WHERE created_by_workshop = ${id}`;
    await tx`DELETE FROM vehicle_views WHERE workshop_id = ${id} OR user_id IN (SELECT id FROM users WHERE workshop_id = ${id})`;
    await tx`DELETE FROM agency_vehicles WHERE workshop_id = ${id} OR added_by IN (SELECT id FROM users WHERE workshop_id = ${id})`;
    await tx`UPDATE password_resets SET created_by = NULL WHERE created_by IN (SELECT id FROM users WHERE workshop_id = ${id})`;
    await tx`DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE workshop_id = ${id})`;
    await tx`UPDATE invitations SET used_by = NULL WHERE used_by IN (SELECT id FROM users WHERE workshop_id = ${id})`;
    await tx`DELETE FROM invitations WHERE workshop_id = ${id} OR created_by IN (SELECT id FROM users WHERE workshop_id = ${id})`;
    await tx`DELETE FROM users WHERE workshop_id = ${id}`;
    await tx`DELETE FROM workshops WHERE id = ${id}`;
  });
  redirect(`/admin?eliminado=${encodeURIComponent(w.name)}`);
}
