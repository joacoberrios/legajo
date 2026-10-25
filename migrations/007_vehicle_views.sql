-- Registro de consultas: qué taller abrió el legajo de qué auto y cuándo.
-- Una fila por auto, taller y día (las recargas suman a "count"); el dueño lo ve en el informe público.

CREATE TABLE vehicle_views (
  vehicle_id   uuid NOT NULL REFERENCES vehicles(id),
  workshop_id  uuid NOT NULL REFERENCES workshops(id),
  view_date    date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Argentina/Mendoza')::date,
  user_id      uuid NOT NULL REFERENCES users(id),
  source       text NOT NULL DEFAULT 'patente',
  first_at     timestamptz NOT NULL DEFAULT now(),
  last_at      timestamptz NOT NULL DEFAULT now(),
  count        integer NOT NULL DEFAULT 1,
  PRIMARY KEY (vehicle_id, workshop_id, view_date)
);

CREATE INDEX vehicle_views_workshop_idx ON vehicle_views (workshop_id, view_date DESC);
CREATE INDEX vehicle_views_date_idx ON vehicle_views (view_date DESC);
