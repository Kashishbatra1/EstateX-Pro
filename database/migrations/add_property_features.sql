-- Additive migration: property features / amenities
-- Safe to re-run (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS property_features (
  property_id         BIGINT PRIMARY KEY
                        REFERENCES properties(id) ON DELETE CASCADE,
  parking             BOOLEAN NOT NULL DEFAULT FALSE,
  parking_capacity    INT,
  security            BOOLEAN NOT NULL DEFAULT FALSE,
  lift                BOOLEAN NOT NULL DEFAULT FALSE,
  gym                 BOOLEAN NOT NULL DEFAULT FALSE,
  pool                BOOLEAN NOT NULL DEFAULT FALSE,
  garden              BOOLEAN NOT NULL DEFAULT FALSE,
  generator           BOOLEAN NOT NULL DEFAULT FALSE,
  solar               BOOLEAN NOT NULL DEFAULT FALSE,
  water_supply        VARCHAR(100),
  appliances          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_parking_capacity
    CHECK (parking_capacity IS NULL OR parking_capacity >= 0)
);

DROP TRIGGER IF EXISTS trg_property_features_updated_at ON property_features;
CREATE TRIGGER trg_property_features_updated_at
  BEFORE UPDATE ON property_features
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
