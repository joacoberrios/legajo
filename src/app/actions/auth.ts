"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkPassword, endSession, hashPassword, requireUser, startSession } from "@/lib/auth";
import { isValidCuit } from "@/lib/cuit";
import { nationalPhone } from "@/lib/phone";
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

type RegisterValues = { workshopName: string; cuit: string; phone: string; firstName: string; lastName: string; email: string };
export type RegisterState = { error?: string; values?: RegisterValues } | undefined;

export async function register(_: RegisterState, form: FormData): Promise<RegisterState> {
  const values: RegisterValues = {
    workshopName: text(form, "workshopName"),
    cuit: text(form, "cuit"),
    phone: text(form, "phone"),
    firstName: text(form, "firstName"),
    lastName: text(form, "lastName"),
    email: text(form, "email").toLowerCase(),
  };
  const fail = (error: string): RegisterState => ({ error, values });

  const cuit = values.cuit.replace(/\D/g, "");
  const phone = nationalPhone(values.phone);
  const address = text(form, "address");
  const lat = Number(text(form, "lat"));
  const lng = Number(text(form, "lng"));
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (!values.workshopName || !values.firstName || !values.lastName || !values.email) return fail("Completá todos los campos.");
  if (!isValidCuit(cuit)) return fail("El CUIT no es válido. Revisá los números.");
  if (!phone) return fail("El teléfono del taller no es válido: código de área y número.");
  if (!address || !isArgentinePoint(lat, lng)) return fail("Ubicá el taller en el mapa: buscá la dirección o usá tu ubicación.");
  if (!/^\S+@\S+\.\S+$/.test(values.email)) return fail("El email no es válido.");
  if (password.length < 8) return fail("La contraseña debe tener al menos 8 caracteres.");
  if (password !== confirm) return fail("Las contraseñas no coinciden.");

  const sql = db();
  const taken = await sql`
    SELECT
      EXISTS (SELECT 1 FROM users WHERE email = ${values.email}) AS email_taken,
      EXISTS (SELECT 1 FROM workshops WHERE cuit = ${cuit}) AS cuit_taken
  `;
  if (taken[0].emailTaken) return fail("Ya hay una cuenta con ese email.");
  if (taken[0].cuitTaken) return fail("Ese CUIT ya está registrado. Pedile al dueño del taller que te sume.");

  const verified = process.env.AUTO_VERIFY_WORKSHOPS === "true";
  const passwordHash = await hashPassword(password);
  const fullName = `${values.firstName} ${values.lastName}`;

  const userId = await sql.begin(async (tx) => {
    const [w] = await tx<{ id: string }[]>`
      INSERT INTO workshops (name, cuit, phone, address, lat, lng, verified)
      VALUES (${values.workshopName}, ${cuit}, ${phone}, ${address}, ${lat}, ${lng}, ${verified})
      RETURNING id
    `;
    const [u] = await tx<{ id: string }[]>`
      INSERT INTO users (workshop_id, email, name, first_name, last_name, password_hash, role)
      VALUES (${w.id}, ${values.email}, ${fullName}, ${values.firstName}, ${values.lastName}, ${passwordHash}, 'owner')
      RETURNING id
    `;
    return u.id;
  });

  await startSession(userId);
  redirect("/taller");
}

/** Coordenadas dentro de Argentina continental (evita un 0,0 o un punto mal tomado). */
function isArgentinePoint(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat < -21 && lat > -56 && lng < -53 && lng > -74;
}

export type WorkshopState = { error?: string; saved?: boolean } | undefined;

/** El dueño actualiza teléfono y dirección del taller (el nombre y el CUIT no se cambian desde la app). */
export async function updateWorkshop(_: WorkshopState, form: FormData): Promise<WorkshopState> {
  const user = await requireUser();
  if (user.role !== "owner") return { error: "Solo el dueño del taller puede cambiar estos datos." };
  const phone = nationalPhone(text(form, "phone"));
  const address = text(form, "address");
  const lat = Number(text(form, "lat"));
  const lng = Number(text(form, "lng"));
  if (!phone) return { error: "El teléfono no es válido: código de área y número." };
  if (!address || !isArgentinePoint(lat, lng)) return { error: "Ubicá el taller en el mapa." };
  await db()`UPDATE workshops SET phone = ${phone}, address = ${address}, lat = ${lat}, lng = ${lng} WHERE id = ${user.workshopId}`;
  revalidatePath("/taller", "layout");
  return { saved: true };
}

export async function logout() {
  await endSession();
  redirect("/login");
}
