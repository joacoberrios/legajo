-- Cobros con Mercado Pago: llave general, suscripciones (agencias y Taller Pro) y compras únicas (informes).

CREATE TABLE billing_settings (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled     boolean NOT NULL DEFAULT false,   -- llave de cobro: apagada = todo gratis (piloto)
  prices      jsonb NOT NULL DEFAULT '{}'::jsonb, -- precios editables desde el admin; vacío = precios por defecto
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO billing_settings (id) VALUES (1);

-- Descuento por cuenta (por ejemplo, precio fundador de agencias).
ALTER TABLE workshops ADD COLUMN price_discount_pct integer NOT NULL DEFAULT 0 CHECK (price_discount_pct BETWEEN 0 AND 100);

CREATE TABLE subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id         uuid NOT NULL REFERENCES workshops(id),
  plan                text NOT NULL CHECK (plan IN ('agencia', 'agencia_pro', 'taller_pro')),
  status              text NOT NULL CHECK (status IN ('pending', 'authorized', 'paused', 'cancelled', 'courtesy')),
  amount              integer NOT NULL,           -- pesos por mes
  reports_quota       integer NOT NULL DEFAULT 0, -- informes verificados incluidos por período
  mp_preapproval_id   text UNIQUE,
  period_start        timestamptz,
  current_period_end  timestamptz,                -- cortesía: hasta cuándo; MP: próximo débito
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_workshop_idx ON subscriptions (workshop_id, created_at DESC);

CREATE TABLE purchases (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL CHECK (kind IN ('report_single', 'report_pack3', 'report_extra')),
  amount             integer NOT NULL,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
  vehicle_id         uuid REFERENCES vehicles(id),   -- auto del que se compró el informe (particulares)
  workshop_id        uuid REFERENCES workshops(id),  -- cuenta que compró (informe extra de agencia)
  email              text,
  credits            integer NOT NULL DEFAULT 1,
  credits_used       integer NOT NULL DEFAULT 0,
  access_token_hash  text NOT NULL,                  -- el link de la compra lleva el token; acá solo su hash
  mp_preference_id   text,
  mp_payment_id      text UNIQUE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  paid_at            timestamptz
);
CREATE INDEX purchases_created_idx ON purchases (created_at DESC);

-- Registro de cada aviso de Mercado Pago (auditoría y reintentos).
CREATE TABLE mp_events (
  id          bigserial PRIMARY KEY,
  topic       text NOT NULL,
  resource_id text NOT NULL,
  result      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Los informes que compra un particular los emite Legajo (sin agencia ni usuario).
ALTER TABLE verified_reports ALTER COLUMN workshop_id DROP NOT NULL;
ALTER TABLE verified_reports ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE verified_reports ADD COLUMN purchase_id uuid REFERENCES purchases(id);
