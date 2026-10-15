"use server";

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
