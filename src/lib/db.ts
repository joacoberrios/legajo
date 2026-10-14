import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __legajoSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable DATABASE_URL.");
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    transform: postgres.camel, // columnas snake_case -> propiedades camelCase
    onnotice: () => {},
  });
}

/** Cliente de Postgres compartido (uno por proceso, sobrevive al hot reload). */
export function db() {
  if (!globalThis.__legajoSql) globalThis.__legajoSql = createClient();
  return globalThis.__legajoSql;
}
