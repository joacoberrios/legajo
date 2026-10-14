"use server";

import { redirect } from "next/navigation";
import { checkPassword, endSession, hashPassword, startSession } from "@/lib/auth";
import { db } from "@/lib/db";

export type FormState = { error?: string } | undefined;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = text(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Completá email y contraseña." };

  const rows = await db()<{ id: string; passwordHash: string }[]>`
    SELECT id, password_hash FROM users WHERE email = ${email}
  `;
  const user = rows[0];
  if (!user || !(await checkPassword(password, user.passwordHash))) {
    return { error: "Email o contraseña incorrectos." };
  }
  await startSession(user.id);
  redirect("/taller");
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const workshopName = text(form, "workshopName");
  const cuit = text(form, "cuit").replace(/\D/g, "");
  const city = text(form, "city");
  const name = text(form, "name");
  const email = text(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!workshopName || !name || !email) return { error: "Completá todos los campos obligatorios." };
  if (cuit.length !== 11) return { error: "El CUIT debe tener 11 dígitos." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "El email no es válido." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const sql = db();
  const taken = await sql`
    SELECT
      EXISTS (SELECT 1 FROM users WHERE email = ${email}) AS email_taken,
      EXISTS (SELECT 1 FROM workshops WHERE cuit = ${cuit}) AS cuit_taken
  `;
  if (taken[0].emailTaken) return { error: "Ya hay una cuenta con ese email." };
  if (taken[0].cuitTaken) return { error: "Ese CUIT ya está registrado. Pedile al dueño del taller que te sume." };

  const verified = process.env.AUTO_VERIFY_WORKSHOPS === "true";
  const passwordHash = await hashPassword(password);

  const userId = await sql.begin(async (tx) => {
    const [w] = await tx<{ id: string }[]>`
      INSERT INTO workshops (name, cuit, city, verified)
      VALUES (${workshopName}, ${cuit}, ${city || null}, ${verified})
      RETURNING id
    `;
    const [u] = await tx<{ id: string }[]>`
      INSERT INTO users (workshop_id, email, name, password_hash, role)
      VALUES (${w.id}, ${email}, ${name}, ${passwordHash}, 'owner')
      RETURNING id
    `;
    return u.id;
  });

  await startSession(userId);
  redirect("/taller");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
