// Aplica en orden los archivos de /migrations que todavía no corrieron.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  if (process.env.VERCEL) {
    console.error("Falta DATABASE_URL: agregá una base Postgres al proyecto en Vercel.");
    process.exit(1);
  }
  console.warn("DATABASE_URL no está definida: se saltean las migraciones.");
  process.exit(0);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const done = new Set((await sql`SELECT name FROM schema_migrations`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) continue;
    const body = await readFile(path.join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    console.log(`Migración aplicada: ${file}`);
  }
  console.log("Base de datos al día.");
} finally {
  await sql.end();
}
