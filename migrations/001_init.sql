-- Legajo: esquema inicial

CREATE TABLE workshops (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  cuit        text NOT NULL UNIQUE,
  city        text,
  verified    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id    uuid NOT NULL REFERENCES workshops(id),
  email          text NOT NULL UNIQUE,
  name           text NOT NULL,
  password_hash  text NOT NULL,
  role           text NOT NULL DEFAULT 'mechanic' CHECK (role IN ('owner', 'mechanic')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate                text NOT NULL UNIQUE,          -- normalizada: mayúsculas, sin espacios ni guiones
  vin                  text UNIQUE,
  make                 text NOT NULL,
  model                text NOT NULL,
  year                 integer CHECK (year BETWEEN 1900 AND 2100),
  public_slug          text NOT NULL UNIQUE,          -- aleatorio, para el link del informe
  created_by_workshop  uuid REFERENCES workshops(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE record_type AS ENUM (
  'service', 'repair', 'diagnosis', 'body', 'inspection', 'origin', 'correction'
);

CREATE TABLE service_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id    uuid NOT NULL REFERENCES vehicles(id),
  workshop_id   uuid NOT NULL REFERENCES workshops(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  type          record_type NOT NULL,
  odometer_km   integer NOT NULL CHECK (odometer_km >= 0),
  performed_on  date NOT NULL,
  items         text[] NOT NULL DEFAULT '{}',
  notes         text,
  corrects_id   uuid REFERENCES service_records(id),
  prev_hash     text,
  hash          text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL
);

CREATE INDEX service_records_vehicle_idx ON service_records (vehicle_id, created_at);
CREATE INDEX service_records_workshop_idx ON service_records (workshop_id, created_at DESC);

-- Inmutabilidad: los registros no se pueden modificar ni borrar.
-- Un error se corrige con un registro nuevo de tipo 'correction'.
CREATE FUNCTION legajo_forbid_record_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de Legajo son inmutables: carga una correccion en lugar de modificar.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_records_immutable
  BEFORE UPDATE OR DELETE ON service_records
  FOR EACH ROW EXECUTE FUNCTION legajo_forbid_record_changes();

CREATE TRIGGER service_records_no_truncate
  BEFORE TRUNCATE ON service_records
  FOR EACH STATEMENT EXECUTE FUNCTION legajo_forbid_record_changes();
