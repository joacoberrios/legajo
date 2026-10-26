-- Historial de pagos: cada cobro que informa Mercado Pago (compras únicas y débitos de suscripciones).

CREATE TABLE payments (
  id               bigserial PRIMARY KEY,
  mp_payment_id    text NOT NULL UNIQUE,
  source           text NOT NULL CHECK (source IN ('compra', 'suscripcion', 'otro')),
  purchase_id      uuid REFERENCES purchases(id),
  subscription_id  uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  workshop_id      uuid REFERENCES workshops(id) ON DELETE SET NULL,
  concept          text NOT NULL,
  amount           numeric(12, 2) NOT NULL,
  net_amount       numeric(12, 2),          -- lo que queda después de la comisión de Mercado Pago
  status           text NOT NULL,           -- approved, pending, rejected, refunded, ...
  status_detail    text,
  method           text,                    -- visa, master, account_money, ...
  payer_email      text,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_created_idx ON payments (created_at DESC);
CREATE INDEX payments_workshop_idx ON payments (workshop_id, created_at DESC);
