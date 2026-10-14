-- Preview plans and durable idempotent receipts. No kitchen records are overwritten.
CREATE TABLE import_batches (
  import_id UUID PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(restaurant_id) ON DELETE CASCADE,
  source_hash VARCHAR(64) NOT NULL,
  snapshot_hash VARCHAR(64) NOT NULL,
  plan JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'preview' CHECK (status IN ('preview', 'committed')),
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  committed_at TIMESTAMPTZ,
  UNIQUE (restaurant_id, source_hash)
);
CREATE INDEX idx_import_batches_restaurant ON import_batches (restaurant_id, created_at);
