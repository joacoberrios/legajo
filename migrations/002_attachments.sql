-- Adjuntos de cada registro: foto del tablero, fotos del trabajo y comprobantes.
-- El SHA-256 de cada archivo entra en el hash del registro, así que no se pueden cambiar sin romper la cadena.

CREATE TYPE attachment_kind AS ENUM ('odometer', 'work', 'document');

CREATE TABLE record_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id     uuid NOT NULL REFERENCES service_records(id),
  kind          attachment_kind NOT NULL,
  position      smallint NOT NULL,
  url           text NOT NULL,
  content_type  text NOT NULL,
  size_bytes    integer NOT NULL CHECK (size_bytes > 0),
  sha256        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, position)
);

CREATE INDEX record_attachments_record_idx ON record_attachments (record_id, position);

-- Igual que los registros: no se modifican ni se borran.
CREATE TRIGGER record_attachments_immutable
  BEFORE UPDATE OR DELETE ON record_attachments
  FOR EACH ROW EXECUTE FUNCTION legajo_forbid_record_changes();

CREATE TRIGGER record_attachments_no_truncate
  BEFORE TRUNCATE ON record_attachments
  FOR EACH STATEMENT EXECUTE FUNCTION legajo_forbid_record_changes();
