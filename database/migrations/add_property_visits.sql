-- Additive migration: property visits + calendar support
-- Safe to re-run

CREATE TABLE IF NOT EXISTS property_visits (
  id              BIGSERIAL PRIMARY KEY,
  property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  client_id       BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  visit_date      DATE NOT NULL,
  visit_time      TIME,
  status          VARCHAR(30) NOT NULL DEFAULT 'scheduled',
  notes           TEXT,
  created_by      BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  deleted_by      BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT chk_property_visit_status
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'))
);

CREATE INDEX IF NOT EXISTS idx_property_visits_date
  ON property_visits(visit_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_property_visits_property
  ON property_visits(property_id) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_property_visits_updated_at ON property_visits;
CREATE TRIGGER trg_property_visits_updated_at
  BEFORE UPDATE ON property_visits
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
