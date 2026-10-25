-- Cuentas de agencia de autos: consultan cualquier legajo, siguen su stock y emiten informes verificados.
-- Las agencias usan la misma tabla de organizaciones que los talleres, con kind = 'agencia'.

ALTER TABLE workshops ADD COLUMN kind text NOT NULL DEFAULT 'taller' CHECK (kind IN ('taller', 'agencia'));

-- Autos que sigue una agencia (evaluando una compra, en stock o vendidos).
CREATE TABLE agency_vehicles (
  workshop_id     uuid NOT NULL REFERENCES workshops(id),
  vehicle_id      uuid NOT NULL REFERENCES vehicles(id),
  stage           text NOT NULL DEFAULT 'evaluando' CHECK (stage IN ('evaluando', 'stock', 'vendido')),
  seen_records    integer NOT NULL DEFAULT 0, -- registros que había la última vez que la agencia lo abrió
  added_by        uuid NOT NULL REFERENCES users(id),
  added_at        timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workshop_id, vehicle_id)
);

-- Informe verificado: foto firmada del historial en un momento, con un código para validarlo.
CREATE TABLE verified_reports (
  code          text PRIMARY KEY,
  vehicle_id    uuid NOT NULL REFERENCES vehicles(id),
  workshop_id   uuid NOT NULL REFERENCES workshops(id),
  user_id       uuid NOT NULL REFERENCES users(id),
  record_count  integer NOT NULL,
  head_hash     text,          -- hash del último registro al emitir (null si no había registros)
  score         integer,
  issued_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX verified_reports_vehicle_idx ON verified_reports (vehicle_id, issued_at DESC);
CREATE INDEX verified_reports_workshop_idx ON verified_reports (workshop_id, issued_at DESC);

CREATE TRIGGER verified_reports_immutable BEFORE UPDATE OR DELETE ON verified_reports
  FOR EACH ROW EXECUTE FUNCTION legajo_forbid_record_changes();
