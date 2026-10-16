-- Datos de contacto y ubicación del taller, nombre y apellido de las personas,
-- y datos extra del vehículo que salen de la tarjeta verde.

ALTER TABLE workshops
  ADD COLUMN phone   text,              -- 10 dígitos nacionales (área + número)
  ADD COLUMN address text,              -- dirección tal como la confirmó el taller
  ADD COLUMN lat     double precision,
  ADD COLUMN lng     double precision;

ALTER TABLE users
  ADD COLUMN first_name text,
  ADD COLUMN last_name  text;

ALTER TABLE vehicles
  ADD COLUMN engine_number text,
  ADD COLUMN body_type     text;        -- tipo según la tarjeta verde (sedán 4 puertas, pick-up, etc.)
