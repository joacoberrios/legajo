-- Stickers QR "vírgenes": se imprimen en tandas sin auto y el taller los asigna al pegarlos.
-- Una vez asignado, un sticker no cambia de auto (solo un admin puede anularlo). Un auto puede tener varios.

CREATE TABLE sticker_batches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL,
  quantity    integer NOT NULL,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stickers (
  code                  text PRIMARY KEY,
  batch_id              uuid NOT NULL REFERENCES sticker_batches(id),
  vehicle_id            uuid REFERENCES vehicles(id),
  assigned_at           timestamptz,
  assigned_by           uuid REFERENCES users(id),
  assigned_workshop_id  uuid REFERENCES workshops(id),
  voided_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CHECK ((vehicle_id IS NULL) = (assigned_at IS NULL))
);

CREATE INDEX stickers_batch_idx ON stickers (batch_id);
CREATE INDEX stickers_vehicle_idx ON stickers (vehicle_id);

-- La asignación es definitiva: un sticker asignado no puede pasar a otro auto ni volver a quedar libre.
CREATE FUNCTION legajo_sticker_assign_once() RETURNS trigger AS $$
BEGIN
  IF OLD.vehicle_id IS NOT NULL AND NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
    RAISE EXCEPTION 'Un sticker asignado no cambia de auto';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stickers_assign_once BEFORE UPDATE ON stickers
  FOR EACH ROW EXECUTE FUNCTION legajo_sticker_assign_once();
