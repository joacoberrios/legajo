-- Archivos adjuntos guardados en Postgres (en lugar de Vercel Blob, para no depender de sus límites del plan gratis).
-- El adjunto del registro apunta acá con url = 'db:<id>'. El SHA-256 sigue sellado en el registro.

CREATE TABLE stored_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id   uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  content_type  text NOT NULL,
  size_bytes    integer NOT NULL CHECK (size_bytes > 0),
  sha256        text NOT NULL,
  data          bytea NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stored_files_workshop_idx ON stored_files (workshop_id, created_at);
