-- Invitaciones para que el dueño del taller sume mecánicos.
-- Se guarda solo el hash del token: el link completo existe únicamente en el mensaje que se comparte.

CREATE TABLE invitations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  uuid NOT NULL REFERENCES workshops(id),
  token_hash   text NOT NULL UNIQUE,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  used_at      timestamptz,
  used_by      uuid REFERENCES users(id),
  revoked_at   timestamptz
);

CREATE INDEX invitations_workshop_idx ON invitations (workshop_id, created_at DESC);
