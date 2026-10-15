-- Links de un solo uso para elegir una contraseña nueva. Solo se guarda el hash del token.

CREATE TABLE password_resets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id),
  token_hash  text NOT NULL UNIQUE,
  created_by  uuid REFERENCES users(id),        -- NULL = pedido por email por el propio usuario
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE INDEX password_resets_user_idx ON password_resets (user_id, created_at DESC);
