-- =============================================================================
-- EstateX Pro — Complete Database Schema
-- Smart Property Inventory & Office Expense Management System
-- PostgreSQL 17
--
-- Run against database: estatex_pro
--   psql -U postgres -d estatex_pro -f schema.sql
--
-- This file is DDL only (extensions, types, tables, constraints, indexes,
-- triggers). Seed data lives in seed.sql.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), crypt()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram indexes for Global Search

-- -----------------------------------------------------------------------------
-- Updated-at trigger function (shared)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- ENUM / DOMAIN TYPES
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE verification_status_enum AS ENUM ('unverified', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_role_enum AS ENUM ('super_admin', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE property_purpose_enum AS ENUM ('sale', 'rent', 'booking');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE property_category_enum AS ENUM ('residential', 'commercial', 'land');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- "available" = publicly listable / LISTED (business rule synonym)
DO $$ BEGIN
  CREATE TYPE property_status_enum AS ENUM (
    'draft', 'available', 'sold', 'rented', 'reserved'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE client_type_enum AS ENUM ('buyer', 'seller', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status_enum AS ENUM (
    'pending', 'confirmed', 'cancelled', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE installment_status_enum AS ENUM (
    'pending', 'partial', 'paid', 'overdue'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE commission_payment_status_enum AS ENUM (
    'unpaid', 'partial', 'paid'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transfer_type_enum AS ENUM ('resale', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE property_event_type_enum AS ENUM (
    'created',
    'price_update',
    'ownership_change',
    'status_change',
    'media_upload',
    'document_upload',
    'commission_override',
    'transfer',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE media_type_enum AS ENUM ('image', 'video', 'floor_plan');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE document_type_enum AS ENUM (
    'registry', 'agreement', 'tax_file', 'lease_certificate', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE expense_approval_status_enum AS ENUM (
    'requested', 'approved', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reimbursement_status_enum AS ENUM (
    'none', 'pending', 'reimbursed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inventory_status_enum AS ENUM (
    'in_stock', 'assigned', 'maintenance', 'retired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inventory_txn_type_enum AS ENUM (
    'purchase', 'assign', 'return', 'adjust', 'retire'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE recurring_frequency_enum AS ENUM (
    'weekly', 'monthly', 'quarterly', 'yearly'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE budget_period_enum AS ENUM ('monthly', 'annual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE petty_cash_txn_type_enum AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type_enum AS ENUM (
    'rent_due',
    'utility_bill',
    'missing_document',
    'high_expense',
    'maintenance_deadline',
    'booking_expiry',
    'budget_overspending',
    'vendor_contract_renewal',
    'document_expiry',
    'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE favorite_entity_enum AS ENUM (
    'property', 'client', 'owner', 'vendor', 'booking', 'expense'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE communication_type_enum AS ENUM (
    'call', 'email', 'whatsapp', 'sms', 'meeting', 'note'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE backup_status_enum AS ENUM (
    'pending', 'completed', 'failed', 'restored'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_status_enum AS ENUM (
    'scheduled', 'in_progress', 'completed', 'cancelled', 'overdue'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- A. AUTHENTICATION & PEOPLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS admins (
  id              BIGSERIAL PRIMARY KEY,
  full_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(150) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            admin_role_enum NOT NULL DEFAULT 'admin',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_admins_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS employees (
  id              BIGSERIAL PRIMARY KEY,
  full_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(150),
  phone           VARCHAR(30),
  designation     VARCHAR(100),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  admin_id        BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  deleted_by      BIGINT REFERENCES admins(id) ON DELETE SET NULL
);

-- =============================================================================
-- B. OWNERS, PAYMENT METHODS, BANK ACCOUNTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS owners (
  id                    BIGSERIAL PRIMARY KEY,
  owner_name            VARCHAR(150) NOT NULL,
  cnic                  VARCHAR(20),
  phone                 VARCHAR(30),
  email                 VARCHAR(150),
  address               TEXT,
  ntn                   VARCHAR(50),
  nominee_name          VARCHAR(150),
  nominee_cnic          VARCHAR(20),
  nominee_relation      VARCHAR(100),
  nominee_contact       VARCHAR(30),
  poa_holder_name       VARCHAR(150),
  poa_details           TEXT,
  poa_document_path     VARCHAR(500),
  verification_status   verification_status_enum NOT NULL DEFAULT 'unverified',
  verified_at           TIMESTAMPTZ,
  verified_by           BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at            TIMESTAMPTZ,
  deleted_by            BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT uq_owners_cnic UNIQUE (cnic)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id            SERIAL PRIMARY KEY,
  method_name   VARCHAR(50) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_payment_methods_name UNIQUE (method_name)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id                    BIGSERIAL PRIMARY KEY,
  bank_name             VARCHAR(150) NOT NULL,
  account_holder_name   VARCHAR(150) NOT NULL,
  account_number        VARCHAR(50) NOT NULL,
  iban                  VARCHAR(50),
  branch_name           VARCHAR(150),
  account_details       TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at            TIMESTAMPTZ,
  deleted_by            BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT uq_bank_accounts_number UNIQUE (bank_name, account_number)
);

-- =============================================================================
-- C. PROPERTIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS properties (
  id                          BIGSERIAL PRIMARY KEY,
  property_code               VARCHAR(30) NOT NULL,
  title                       VARCHAR(200) NOT NULL,
  property_type               VARCHAR(50),
  purpose                     property_purpose_enum NOT NULL,
  category                    property_category_enum NOT NULL,
  status                      property_status_enum NOT NULL DEFAULT 'draft',

  -- Location
  city                        VARCHAR(100),
  area                        VARCHAR(100),
  society                     VARCHAR(150),
  block                       VARCHAR(50),
  floor                       VARCHAR(50),
  street                      VARCHAR(150),
  flat_or_plot_number         VARCHAR(50),
  google_maps_url             TEXT,
  latitude                    DECIMAL(10, 7),
  longitude                   DECIMAL(10, 7),

  -- Specs / additional information
  year_built                  INT,
  property_age_years          INT,
  covered_area                DECIMAL(12, 2),
  plot_size                   DECIMAL(12, 2),
  area_unit                   VARCHAR(20),
  floor_number                INT,
  total_floors                INT,
  facing_direction            VARCHAR(30),
  furnishing_status           VARCHAR(30),
  possession_status           VARCHAR(30),
  ownership_type              VARCHAR(50),
  legal_status                VARCHAR(50),
  noc_status                  VARCHAR(50),
  utility_meter_electricity   VARCHAR(50),
  utility_meter_gas           VARCHAR(50),
  utility_meter_water         VARCHAR(50),
  property_tax_status         VARCHAR(50),
  mortgage_status             VARCHAR(50),
  nearby_landmarks            TEXT,
  video_walkthrough_url       TEXT,
  listing_type                VARCHAR(50),
  is_featured                 BOOLEAN NOT NULL DEFAULT FALSE,
  property_rating             DECIMAL(3, 2),
  renovation_history          TEXT,
  energy_rating               VARCHAR(20),
  insurance_details           TEXT,
  description                 TEXT,

  -- Pricing / rental (rental fields required by app when purpose = rent)
  asking_price                DECIMAL(14, 2),
  monthly_rent                DECIMAL(14, 2),
  advance_rent_months         INT,
  security_deposit            DECIMAL(14, 2),

  -- Listing prerequisite: payment method
  primary_payment_method_id   INT REFERENCES payment_methods(id) ON DELETE SET NULL,

  created_by                  BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  BIGINT REFERENCES admins(id) ON DELETE SET NULL,

  CONSTRAINT uq_properties_code UNIQUE (property_code),
  CONSTRAINT chk_property_rating
    CHECK (property_rating IS NULL OR (property_rating >= 0 AND property_rating <= 5)),
  CONSTRAINT chk_property_age
    CHECK (property_age_years IS NULL OR property_age_years >= 0),
  CONSTRAINT chk_covered_area
    CHECK (covered_area IS NULL OR covered_area >= 0),
  CONSTRAINT chk_plot_size
    CHECK (plot_size IS NULL OR plot_size >= 0),
  CONSTRAINT chk_asking_price
    CHECK (asking_price IS NULL OR asking_price >= 0),
  CONSTRAINT chk_monthly_rent
    CHECK (monthly_rent IS NULL OR monthly_rent >= 0),
  CONSTRAINT chk_security_deposit
    CHECK (security_deposit IS NULL OR security_deposit >= 0),
  CONSTRAINT chk_advance_rent_months
    CHECK (advance_rent_months IS NULL OR advance_rent_months >= 0),
  -- Non-draft properties must have a payment method (listing prerequisite)
  CONSTRAINT chk_listed_requires_payment_method
    CHECK (
      status = 'draft'
      OR primary_payment_method_id IS NOT NULL
    ),
  -- Rental properties must include rent economics (business rule)
  CONSTRAINT chk_rent_requires_fields
    CHECK (
      purpose <> 'rent'
      OR (
        monthly_rent IS NOT NULL
        AND advance_rent_months IS NOT NULL
        AND security_deposit IS NOT NULL
      )
    )
);

CREATE TABLE IF NOT EXISTS property_owners (
  id                        BIGSERIAL PRIMARY KEY,
  property_id               BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_id                  BIGINT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  share_percentage          DECIMAL(5, 2) NOT NULL,
  ownership_document_type   VARCHAR(100),
  is_primary                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_property_owner UNIQUE (property_id, owner_id),
  CONSTRAINT chk_share_percentage
    CHECK (share_percentage > 0 AND share_percentage <= 100)
);

CREATE TABLE IF NOT EXISTS property_bank_accounts (
  id                BIGSERIAL PRIMARY KEY,
  property_id       BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  bank_account_id   BIGINT NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_property_bank_account UNIQUE (property_id, bank_account_id)
);

-- Property features / amenities (Parking, Security, Lift, Gym, Pool, etc.)
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

CREATE TABLE IF NOT EXISTS property_history (
  id              BIGSERIAL PRIMARY KEY,
  property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  event_type      property_event_type_enum NOT NULL,
  old_value       JSONB,
  new_value       JSONB,
  description     TEXT,
  performed_by    BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS property_documents (
  id              BIGSERIAL PRIMARY KEY,
  property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  document_type   document_type_enum NOT NULL DEFAULT 'other',
  document_name   VARCHAR(200),
  file_path       VARCHAR(500) NOT NULL,
  file_name       VARCHAR(255),
  mime_type       VARCHAR(100),
  upload_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date     DATE,
  notes           TEXT,
  uploaded_by     BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  deleted_by      BIGINT REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS property_media (
  id              BIGSERIAL PRIMARY KEY,
  property_id     BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  media_type      media_type_enum NOT NULL,
  file_path       VARCHAR(500) NOT NULL,
  file_name       VARCHAR(255),
  mime_type       VARCHAR(100),
  caption         VARCHAR(255),
  sort_order      INT NOT NULL DEFAULT 0,
  is_cover        BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by     BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  deleted_by      BIGINT REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS property_transfers (
  id                        BIGSERIAL PRIMARY KEY,
  property_id               BIGINT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  transfer_type             transfer_type_enum NOT NULL,
  from_owner_id             BIGINT REFERENCES owners(id) ON DELETE SET NULL,
  to_owner_id               BIGINT REFERENCES owners(id) ON DELETE SET NULL,
  from_client_id            BIGINT, -- FK added after clients table
  to_client_id              BIGINT, -- FK added after clients table
  transfer_charges          DECIMAL(14, 2) DEFAULT 0,
  lease_charges             DECIMAL(14, 2) DEFAULT 0,
  transfer_tax              DECIMAL(14, 2) DEFAULT 0,
  stamp_duty                DECIMAL(14, 2) DEFAULT 0,
  noc_for_transfer          BOOLEAN NOT NULL DEFAULT FALSE,
  noc_status                VARCHAR(50),
  noc_document_path         VARCHAR(500),
  transfer_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_owner_snapshot   JSONB,
  notes                     TEXT,
  created_by                BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                TIMESTAMPTZ,
  deleted_by                BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT chk_transfer_charges CHECK (transfer_charges IS NULL OR transfer_charges >= 0),
  CONSTRAINT chk_lease_charges CHECK (lease_charges IS NULL OR lease_charges >= 0),
  CONSTRAINT chk_transfer_tax CHECK (transfer_tax IS NULL OR transfer_tax >= 0),
  CONSTRAINT chk_stamp_duty CHECK (stamp_duty IS NULL OR stamp_duty >= 0)
);

-- =============================================================================
-- D. CLIENTS & CRM
-- =============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id                          BIGSERIAL PRIMARY KEY,
  client_name                 VARCHAR(150) NOT NULL,
  cnic                        VARCHAR(20),
  phone                       VARCHAR(30),
  email                       VARCHAR(150),
  address                     TEXT,
  client_type                 client_type_enum NOT NULL DEFAULT 'buyer',
  budget_min                  DECIMAL(14, 2),
  budget_max                  DECIMAL(14, 2),
  investment_preference       VARCHAR(100),
  preferred_property_type     VARCHAR(50),
  preferred_location          VARCHAR(150),
  lead_source                 VARCHAR(100),
  referral_source             VARCHAR(150),
  crm_notes                   TEXT,
  whatsapp_sms_preference     VARCHAR(30) DEFAULT 'none',
  client_rating               DECIMAL(3, 2),
  next_follow_up_date         DATE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT uq_clients_cnic UNIQUE (cnic),
  CONSTRAINT chk_client_budget
    CHECK (
      budget_min IS NULL
      OR budget_max IS NULL
      OR budget_min <= budget_max
    ),
  CONSTRAINT chk_client_rating
    CHECK (client_rating IS NULL OR (client_rating >= 0 AND client_rating <= 5)),
  CONSTRAINT chk_whatsapp_sms_preference
    CHECK (whatsapp_sms_preference IN ('whatsapp', 'sms', 'both', 'none'))
);

-- Deferred FKs for property_transfers → clients (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transfer_from_client'
  ) THEN
    ALTER TABLE property_transfers
      ADD CONSTRAINT fk_transfer_from_client
      FOREIGN KEY (from_client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_transfer_to_client'
  ) THEN
    ALTER TABLE property_transfers
      ADD CONSTRAINT fk_transfer_to_client
      FOREIGN KEY (to_client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Property visits (Booking Calendar — site visits / viewings)
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

CREATE TABLE IF NOT EXISTS client_communications (
  id                    BIGSERIAL PRIMARY KEY,
  client_id             BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  communication_type    communication_type_enum NOT NULL DEFAULT 'note',
  subject               VARCHAR(200),
  notes                 TEXT,
  communicated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by            BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_kyc_documents (
  id              BIGSERIAL PRIMARY KEY,
  client_id       BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  document_type   VARCHAR(100) NOT NULL,
  file_path       VARCHAR(500) NOT NULL,
  file_name       VARCHAR(255),
  mime_type       VARCHAR(100),
  expiry_date     DATE,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by     BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  deleted_by      BIGINT REFERENCES admins(id) ON DELETE SET NULL
);

-- =============================================================================
-- E. BOOKINGS, INSTALLMENTS, PAYMENTS, COMMISSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id                            BIGSERIAL PRIMARY KEY,
  booking_code                  VARCHAR(30) NOT NULL,
  property_id                   BIGINT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  client_id                     BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  booking_amount                DECIMAL(14, 2) NOT NULL,   -- down payment
  total_price                   DECIMAL(14, 2) NOT NULL,
  remaining_balance             DECIMAL(14, 2) NOT NULL,
  installment_plan_name         VARCHAR(100),
  monthly_installment_amount    DECIMAL(14, 2),
  status                        booking_status_enum NOT NULL DEFAULT 'pending',
  cancellation_reason           TEXT,
  refund_amount                 DECIMAL(14, 2),
  refund_details                TEXT,
  token_receipt_number          VARCHAR(100),
  booking_expiry_date           DATE,
  digital_agreement_url         TEXT,
  booked_at                     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at                  TIMESTAMPTZ,
  cancelled_at                  TIMESTAMPTZ,
  completed_at                  TIMESTAMPTZ,
  created_by                    BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                    TIMESTAMPTZ,
  deleted_by                    BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT uq_bookings_code UNIQUE (booking_code),
  CONSTRAINT chk_booking_amount CHECK (booking_amount >= 0),
  CONSTRAINT chk_booking_total CHECK (total_price >= 0),
  CONSTRAINT chk_booking_remaining CHECK (remaining_balance >= 0),
  CONSTRAINT chk_booking_down_vs_total CHECK (booking_amount <= total_price),
  CONSTRAINT chk_refund_amount CHECK (refund_amount IS NULL OR refund_amount >= 0)
);

CREATE TABLE IF NOT EXISTS booking_installments (
  id                    BIGSERIAL PRIMARY KEY,
  booking_id            BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  installment_number    INT NOT NULL,
  due_date              DATE NOT NULL,
  amount_due            DECIMAL(14, 2) NOT NULL,
  amount_paid           DECIMAL(14, 2) NOT NULL DEFAULT 0,
  status                installment_status_enum NOT NULL DEFAULT 'pending',
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_booking_installment_number UNIQUE (booking_id, installment_number),
  CONSTRAINT chk_installment_amount_due CHECK (amount_due >= 0),
  CONSTRAINT chk_installment_amount_paid CHECK (amount_paid >= 0),
  CONSTRAINT chk_installment_paid_vs_due CHECK (amount_paid <= amount_due)
);

CREATE TABLE IF NOT EXISTS payments (
  id                  BIGSERIAL PRIMARY KEY,
  payment_code        VARCHAR(30),
  booking_id          BIGINT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  installment_id      BIGINT REFERENCES booking_installments(id) ON DELETE SET NULL,
  amount              DECIMAL(14, 2) NOT NULL,
  payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method_id   INT REFERENCES payment_methods(id) ON DELETE SET NULL,
  bank_account_id     BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  reference_number    VARCHAR(100),
  notes               TEXT,
  received_by         BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  created_by          BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          TIMESTAMPTZ,
  deleted_by          BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT uq_payments_code UNIQUE (payment_code),
  CONSTRAINT chk_payment_amount CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS commissions (
  id                      BIGSERIAL PRIMARY KEY,
  property_id             BIGINT NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  booking_id              BIGINT REFERENCES bookings(id) ON DELETE SET NULL,
  commission_percentage   DECIMAL(5, 2),
  calculated_amount       DECIMAL(14, 2),
  final_amount            DECIMAL(14, 2),
  is_manual_override      BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason         TEXT,
  brokerage_from_buyer    DECIMAL(14, 2) DEFAULT 0,
  brokerage_from_seller   DECIMAL(14, 2) DEFAULT 0,
  payment_status          commission_payment_status_enum NOT NULL DEFAULT 'unpaid',
  assigned_agent_id       BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  referral_source         VARCHAR(150),
  created_by              BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at              TIMESTAMPTZ,
  deleted_by              BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT chk_commission_percentage
    CHECK (commission_percentage IS NULL OR (commission_percentage >= 0 AND commission_percentage <= 100)),
  CONSTRAINT chk_calculated_amount CHECK (calculated_amount IS NULL OR calculated_amount >= 0),
  CONSTRAINT chk_final_amount CHECK (final_amount IS NULL OR final_amount >= 0),
  CONSTRAINT chk_brokerage_buyer CHECK (brokerage_from_buyer IS NULL OR brokerage_from_buyer >= 0),
  CONSTRAINT chk_brokerage_seller CHECK (brokerage_from_seller IS NULL OR brokerage_from_seller >= 0),
  CONSTRAINT chk_override_reason
    CHECK (is_manual_override = FALSE OR override_reason IS NOT NULL)
);

-- =============================================================================
-- F. VENDORS, EXPENSES, INVENTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS vendors (
  id                    BIGSERIAL PRIMARY KEY,
  vendor_name           VARCHAR(150) NOT NULL,
  contact_person        VARCHAR(150),
  phone                 VARCHAR(30),
  email                 VARCHAR(150),
  address               TEXT,
  services              TEXT,
  contract_start_date   DATE,
  contract_end_date     DATE,
  payment_terms         VARCHAR(200),
  is_preferred          BOOLEAN NOT NULL DEFAULT FALSE,
  outstanding_balance   DECIMAL(14, 2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at            TIMESTAMPTZ,
  deleted_by            BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT chk_vendor_outstanding CHECK (outstanding_balance >= 0),
  CONSTRAINT chk_vendor_contract_dates
    CHECK (
      contract_start_date IS NULL
      OR contract_end_date IS NULL
      OR contract_start_date <= contract_end_date
    )
);

CREATE TABLE IF NOT EXISTS vendor_payments (
  id                  BIGSERIAL PRIMARY KEY,
  vendor_id           BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount              DECIMAL(14, 2) NOT NULL,
  payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method_id   INT REFERENCES payment_methods(id) ON DELETE SET NULL,
  reference_number    VARCHAR(100),
  notes               TEXT,
  created_by          BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_vendor_payment_amount CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS vendor_documents (
  id              BIGSERIAL PRIMARY KEY,
  vendor_id       BIGINT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  document_name   VARCHAR(200),
  document_type   VARCHAR(100),
  file_path       VARCHAR(500) NOT NULL,
  file_name       VARCHAR(255),
  mime_type       VARCHAR(100),
  upload_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date     DATE,
  uploaded_by     BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at      TIMESTAMPTZ,
  deleted_by      BIGINT REFERENCES admins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id              SERIAL PRIMARY KEY,
  category_name   VARCHAR(100) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_expense_categories_name UNIQUE (category_name)
);

CREATE TABLE IF NOT EXISTS expense_subcategories (
  id                  SERIAL PRIMARY KEY,
  category_id         INT NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  subcategory_name    VARCHAR(100) NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_expense_subcategory UNIQUE (category_id, subcategory_name)
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id                  BIGSERIAL PRIMARY KEY,
  item_name           VARCHAR(150) NOT NULL,
  item_type           VARCHAR(100),
  quantity            DECIMAL(12, 2) NOT NULL DEFAULT 0,
  unit                VARCHAR(30) DEFAULT 'pcs',
  status              inventory_status_enum NOT NULL DEFAULT 'in_stock',
  assigned_to         BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  location_notes      TEXT,
  purchase_date       DATE,
  purchase_cost       DECIMAL(14, 2),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          TIMESTAMPTZ,
  deleted_by          BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT chk_inventory_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_inventory_purchase_cost
    CHECK (purchase_cost IS NULL OR purchase_cost >= 0)
);

CREATE TABLE IF NOT EXISTS expenses (
  id                      BIGSERIAL PRIMARY KEY,
  expense_code            VARCHAR(30) NOT NULL,
  expense_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id             INT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  subcategory_id          INT REFERENCES expense_subcategories(id) ON DELETE SET NULL,
  vendor_id               BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
  amount                  DECIMAL(14, 2) NOT NULL,
  gst_sales_tax           DECIMAL(14, 2) NOT NULL DEFAULT 0,
  remaining_amount        DECIMAL(14, 2) NOT NULL DEFAULT 0,
  payment_method_id       INT REFERENCES payment_methods(id) ON DELETE SET NULL,
  description             TEXT,
  paid_by_employee_id     BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  device_or_item_name     VARCHAR(150),
  quantity                DECIMAL(12, 2),
  receipt_path            VARCHAR(500),
  reimbursement_status    reimbursement_status_enum NOT NULL DEFAULT 'none',
  approval_status         expense_approval_status_enum NOT NULL DEFAULT 'requested',
  approved_by             BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  approved_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  inventory_item_id       BIGINT REFERENCES inventory_items(id) ON DELETE SET NULL,
  property_id             BIGINT REFERENCES properties(id) ON DELETE SET NULL, -- property-wise expense reports
  created_by              BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at              TIMESTAMPTZ,
  deleted_by              BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT uq_expenses_code UNIQUE (expense_code),
  CONSTRAINT chk_expense_amount CHECK (amount >= 0),
  CONSTRAINT chk_expense_gst CHECK (gst_sales_tax >= 0),
  CONSTRAINT chk_expense_remaining CHECK (remaining_amount >= 0),
  CONSTRAINT chk_expense_quantity CHECK (quantity IS NULL OR quantity >= 0),
  CONSTRAINT chk_expense_rejection
    CHECK (approval_status <> 'rejected' OR rejection_reason IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id                  BIGSERIAL PRIMARY KEY,
  inventory_item_id   BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  expense_id          BIGINT REFERENCES expenses(id) ON DELETE SET NULL,
  txn_type            inventory_txn_type_enum NOT NULL,
  quantity_change     DECIMAL(12, 2) NOT NULL,
  assigned_to         BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  notes               TEXT,
  performed_by        BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- G. RECURRING EXPENSES, BUDGETS, PETTY CASH
-- =============================================================================

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id                          BIGSERIAL PRIMARY KEY,
  title                       VARCHAR(150) NOT NULL,
  category_id                 INT REFERENCES expense_categories(id) ON DELETE SET NULL,
  vendor_id                   BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
  amount                      DECIMAL(14, 2) NOT NULL,
  frequency                   recurring_frequency_enum NOT NULL DEFAULT 'monthly',
  due_day                     INT,                          -- day of month (1-28) for monthly
  next_due_date               DATE,
  reminder_days_before        INT NOT NULL DEFAULT 3,
  auto_debit_flag             BOOLEAN NOT NULL DEFAULT FALSE,
  annual_escalation_pct       DECIMAL(5, 2) NOT NULL DEFAULT 0,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  notes                       TEXT,
  created_by                  BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at                  TIMESTAMPTZ,
  deleted_by                  BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT chk_recurring_amount CHECK (amount >= 0),
  CONSTRAINT chk_recurring_due_day CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 28)),
  CONSTRAINT chk_reminder_days CHECK (reminder_days_before >= 0),
  CONSTRAINT chk_escalation_pct CHECK (annual_escalation_pct >= 0)
);

CREATE TABLE IF NOT EXISTS budgets (
  id                      BIGSERIAL PRIMARY KEY,
  name                    VARCHAR(150) NOT NULL,
  period_type             budget_period_enum NOT NULL,
  year                    INT NOT NULL,
  month                   INT,                              -- required when period_type = monthly
  total_amount            DECIMAL(14, 2) NOT NULL,
  alert_threshold_pct     DECIMAL(5, 2) NOT NULL DEFAULT 80, -- notify when spent >= this %
  notes                   TEXT,
  created_by              BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at              TIMESTAMPTZ,
  deleted_by              BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT chk_budget_year CHECK (year >= 2000 AND year <= 2100),
  CONSTRAINT chk_budget_month
    CHECK (
      (period_type = 'annual' AND month IS NULL)
      OR (period_type = 'monthly' AND month BETWEEN 1 AND 12)
    ),
  CONSTRAINT chk_budget_total CHECK (total_amount >= 0),
  CONSTRAINT chk_budget_alert CHECK (alert_threshold_pct > 0 AND alert_threshold_pct <= 100),
  CONSTRAINT uq_budget_period UNIQUE (period_type, year, month)
);

CREATE TABLE IF NOT EXISTS budget_lines (
  id                  BIGSERIAL PRIMARY KEY,
  budget_id           BIGINT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id         INT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  allocated_amount    DECIMAL(14, 2) NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_budget_line UNIQUE (budget_id, category_id),
  CONSTRAINT chk_budget_line_amount CHECK (allocated_amount >= 0)
);

CREATE TABLE IF NOT EXISTS petty_cash_accounts (
  id                      BIGSERIAL PRIMARY KEY,
  account_name            VARCHAR(150) NOT NULL,
  custodian_employee_id   BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  float_amount            DECIMAL(14, 2) NOT NULL DEFAULT 0,
  current_balance         DECIMAL(14, 2) NOT NULL DEFAULT 0,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  notes                   TEXT,
  created_by              BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at              TIMESTAMPTZ,
  deleted_by              BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT chk_petty_float CHECK (float_amount >= 0),
  CONSTRAINT chk_petty_balance CHECK (current_balance >= 0)
);

CREATE TABLE IF NOT EXISTS petty_cash_transactions (
  id                  BIGSERIAL PRIMARY KEY,
  account_id          BIGINT NOT NULL REFERENCES petty_cash_accounts(id) ON DELETE CASCADE,
  txn_type            petty_cash_txn_type_enum NOT NULL,
  amount              DECIMAL(14, 2) NOT NULL,
  expense_id          BIGINT REFERENCES expenses(id) ON DELETE SET NULL,
  description         TEXT,
  txn_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  performed_by        BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  created_by          BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_petty_txn_amount CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS petty_cash_reconciliations (
  id                  BIGSERIAL PRIMARY KEY,
  account_id          BIGINT NOT NULL REFERENCES petty_cash_accounts(id) ON DELETE CASCADE,
  reconciled_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  system_balance      DECIMAL(14, 2) NOT NULL,
  counted_balance     DECIMAL(14, 2) NOT NULL,
  variance            DECIMAL(14, 2) NOT NULL,
  notes               TEXT,
  reconciled_by       BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  created_by          BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- H. SYSTEM: NOTIFICATIONS, FAVORITES, AUDIT, BACKUPS
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id              BIGSERIAL PRIMARY KEY,
  admin_id        BIGINT REFERENCES admins(id) ON DELETE CASCADE, -- NULL = broadcast to all admins
  notification_type notification_type_enum NOT NULL DEFAULT 'general',
  title           VARCHAR(200) NOT NULL,
  message         TEXT NOT NULL,
  entity_type     VARCHAR(50),
  entity_id       BIGINT,
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorites (
  id              BIGSERIAL PRIMARY KEY,
  admin_id        BIGINT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  entity_type     favorite_entity_enum NOT NULL,
  entity_id       BIGINT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_favorite UNIQUE (admin_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  admin_id        BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50),
  entity_id       BIGINT,
  old_data        JSONB,
  new_data        JSONB,
  ip_address      VARCHAR(45),
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backups (
  id              BIGSERIAL PRIMARY KEY,
  file_name       VARCHAR(255) NOT NULL,
  file_path       VARCHAR(500) NOT NULL,
  backup_type     VARCHAR(50) NOT NULL DEFAULT 'full',
  size_bytes      BIGINT,
  status          backup_status_enum NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_by      BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  restored_at     TIMESTAMPTZ,
  restored_by     BIGINT REFERENCES admins(id) ON DELETE SET NULL
);

-- =============================================================================
-- I. PROPERTY MAINTENANCE (supports Maintenance Deadline notifications)
-- =============================================================================

CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id                  BIGSERIAL PRIMARY KEY,
  property_id         BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  category            VARCHAR(100),                 -- e.g. plumbing, electrical, general
  status              maintenance_status_enum NOT NULL DEFAULT 'scheduled',
  priority            VARCHAR(20) NOT NULL DEFAULT 'medium',
  due_date            DATE NOT NULL,                -- maintenance deadline
  completed_at        TIMESTAMPTZ,
  assigned_to         BIGINT REFERENCES employees(id) ON DELETE SET NULL,
  vendor_id           BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
  estimated_cost      DECIMAL(14, 2),
  actual_cost         DECIMAL(14, 2),
  reminder_days_before INT NOT NULL DEFAULT 3,
  notes               TEXT,
  created_by          BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at          TIMESTAMPTZ,
  deleted_by          BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  CONSTRAINT chk_maintenance_priority
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT chk_maintenance_estimated_cost
    CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  CONSTRAINT chk_maintenance_actual_cost
    CHECK (actual_cost IS NULL OR actual_cost >= 0),
  CONSTRAINT chk_maintenance_reminder
    CHECK (reminder_days_before >= 0)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Admins / employees
CREATE INDEX IF NOT EXISTS idx_employees_admin_id ON employees(admin_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active) WHERE deleted_at IS NULL;

-- Owners
CREATE INDEX IF NOT EXISTS idx_owners_verification ON owners(verification_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_owners_name ON owners(owner_name);

-- Properties
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_purpose ON properties(purpose) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_city_area ON properties(city, area) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(is_featured) WHERE deleted_at IS NULL AND is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_code ON properties(property_code);

-- Property relations
CREATE INDEX IF NOT EXISTS idx_property_owners_property ON property_owners(property_id);
CREATE INDEX IF NOT EXISTS idx_property_owners_owner ON property_owners(owner_id);
CREATE INDEX IF NOT EXISTS idx_property_bank_accounts_property ON property_bank_accounts(property_id);
CREATE INDEX IF NOT EXISTS idx_property_history_property ON property_history(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_history_event ON property_history(event_type);
CREATE INDEX IF NOT EXISTS idx_property_documents_property ON property_documents(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_property_documents_expiry ON property_documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_media_property ON property_media(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_property_transfers_property ON property_transfers(property_id);

-- Clients
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(client_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_budget ON clients(budget_min, budget_max) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_location ON clients(preferred_location) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_investment ON clients(investment_preference) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_follow_up ON clients(next_follow_up_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_property_visits_date ON property_visits(visit_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_property_visits_property ON property_visits(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_comms_client ON client_communications(client_id, communicated_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_kyc_client ON client_kyc_documents(client_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_client_kyc_expiry ON client_kyc_documents(expiry_date) WHERE expiry_date IS NOT NULL;

-- Bookings / payments
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_expiry ON bookings(booking_expiry_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_booked_at ON bookings(booked_at DESC);
CREATE INDEX IF NOT EXISTS idx_installments_booking ON booking_installments(booking_id);
CREATE INDEX IF NOT EXISTS idx_installments_due ON booking_installments(due_date, status);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_commissions_property ON commissions(property_id);
CREATE INDEX IF NOT EXISTS idx_commissions_override ON commissions(is_manual_override) WHERE is_manual_override = TRUE;

-- Vendors / expenses / inventory
CREATE INDEX IF NOT EXISTS idx_vendors_preferred ON vendors(is_preferred) WHERE deleted_at IS NULL AND is_preferred = TRUE;
CREATE INDEX IF NOT EXISTS idx_vendors_contract_end ON vendors(contract_end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_approval ON expenses(approval_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_assigned ON inventory_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inventory_txn_item ON inventory_transactions(inventory_item_id, created_at DESC);

-- Recurring / budget / petty cash
CREATE INDEX IF NOT EXISTS idx_recurring_next_due ON recurring_expenses(next_due_date) WHERE is_active = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period_type, year, month) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);
CREATE INDEX IF NOT EXISTS idx_petty_txn_account ON petty_cash_transactions(account_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_petty_recon_account ON petty_cash_reconciliations(account_id, reconciled_on DESC);

-- System
CREATE INDEX IF NOT EXISTS idx_notifications_admin_unread
  ON notifications(admin_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_favorites_admin ON favorites(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backups_status ON backups(status, created_at DESC);

-- Maintenance
CREATE INDEX IF NOT EXISTS idx_maintenance_property ON maintenance_tasks(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_due ON maintenance_tasks(due_date, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_assigned ON maintenance_tasks(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_deleted ON maintenance_tasks(deleted_at) WHERE deleted_at IS NOT NULL;

-- Soft-delete helpers (Recycle Bin queries)
CREATE INDEX IF NOT EXISTS idx_properties_deleted ON properties(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_deleted ON clients(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_owners_deleted ON owners(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted ON expenses(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_deleted ON bookings(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employees_deleted ON employees(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_accounts_deleted ON bank_accounts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commissions_deleted ON commissions(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_deleted ON payments(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_documents_deleted ON property_documents(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_media_deleted ON property_media(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_transfers_deleted ON property_transfers(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_deleted ON recurring_expenses(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_deleted ON budgets(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_petty_accounts_deleted ON petty_cash_accounts(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_deleted ON vendors(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_deleted ON inventory_items(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_kyc_deleted ON client_kyc_documents(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_documents_deleted ON vendor_documents(deleted_at) WHERE deleted_at IS NOT NULL;

-- Global Search (trigram) — supports ILIKE / similarity across key entities
CREATE INDEX IF NOT EXISTS idx_properties_title_trgm
  ON properties USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_code_trgm
  ON properties USING gin (property_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_city_trgm
  ON properties USING gin (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_area_trgm
  ON properties USING gin (area gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_properties_society_trgm
  ON properties USING gin (society gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_owners_name_trgm
  ON owners USING gin (owner_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_owners_cnic_trgm
  ON owners USING gin (cnic gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm
  ON clients USING gin (client_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_cnic_trgm
  ON clients USING gin (cnic gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm
  ON clients USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vendors_name_trgm
  ON vendors USING gin (vendor_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bookings_code_trgm
  ON bookings USING gin (booking_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_expenses_code_trgm
  ON expenses USING gin (expense_code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_employees_name_trgm
  ON employees USING gin (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_maintenance_title_trgm
  ON maintenance_tasks USING gin (title gin_trgm_ops);

-- Combined full-text search vectors for broader Global Search queries
CREATE INDEX IF NOT EXISTS idx_properties_fts ON properties USING gin (
  to_tsvector(
    'simple',
    coalesce(property_code, '') || ' ' ||
    coalesce(title, '') || ' ' ||
    coalesce(city, '') || ' ' ||
    coalesce(area, '') || ' ' ||
    coalesce(society, '') || ' ' ||
    coalesce(flat_or_plot_number, '')
  )
);
CREATE INDEX IF NOT EXISTS idx_clients_fts ON clients USING gin (
  to_tsvector(
    'simple',
    coalesce(client_name, '') || ' ' ||
    coalesce(cnic, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(preferred_location, '')
  )
);
CREATE INDEX IF NOT EXISTS idx_owners_fts ON owners USING gin (
  to_tsvector(
    'simple',
    coalesce(owner_name, '') || ' ' ||
    coalesce(cnic, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(email, '')
  )
);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admins',
    'employees',
    'owners',
    'payment_methods',
    'bank_accounts',
    'properties',
    'property_features',
    'property_visits',
    'property_documents',
    'property_media',
    'property_transfers',
    'clients',
    'bookings',
    'booking_installments',
    'payments',
    'commissions',
    'vendors',
    'expense_categories',
    'expense_subcategories',
    'expenses',
    'inventory_items',
    'recurring_expenses',
    'budgets',
    'budget_lines',
    'petty_cash_accounts',
    'maintenance_tasks'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE PROCEDURE set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- =============================================================================
-- BUSINESS RULE FUNCTIONS & TRIGGERS (listing prerequisites)
-- =============================================================================

-- Auto-generate property codes: EXP-YYYY-####
CREATE OR REPLACE FUNCTION generate_property_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  yr TEXT := to_char(CURRENT_DATE, 'YYYY');
  next_num INT;
BEGIN
  IF NEW.property_code IS NULL OR btrim(NEW.property_code) = '' THEN
    SELECT COALESCE(MAX(
      NULLIF(regexp_replace(property_code, '^EXP-' || yr || '-', ''), property_code)::INT
    ), 0) + 1
    INTO next_num
    FROM properties
    WHERE property_code ~ ('^EXP-' || yr || '-[0-9]+$');

    NEW.property_code := 'EXP-' || yr || '-' || lpad(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_generate_code ON properties;
CREATE TRIGGER trg_properties_generate_code
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE PROCEDURE generate_property_code();

-- Shared listing prerequisite checks
CREATE OR REPLACE FUNCTION property_has_verified_owner(p_property_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM property_owners po
    JOIN owners o ON o.id = po.owner_id
    WHERE po.property_id = p_property_id
      AND o.verification_status = 'verified'
      AND o.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION property_has_bank_account(p_property_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM property_bank_accounts pba
    JOIN bank_accounts ba ON ba.id = pba.bank_account_id
    WHERE pba.property_id = p_property_id
      AND ba.deleted_at IS NULL
      AND ba.is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION property_owner_share_total(p_property_id BIGINT)
RETURNS DECIMAL
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(share_percentage), 0)
  FROM property_owners
  WHERE property_id = p_property_id;
$$;

CREATE OR REPLACE FUNCTION enforce_property_listing_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Soft-deleted rows are not actively listed
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'draft' THEN
    IF NEW.primary_payment_method_id IS NULL THEN
      RAISE EXCEPTION
        'Property % cannot be % without a payment method',
        COALESCE(NEW.property_code, NEW.id::TEXT), NEW.status
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT property_has_verified_owner(NEW.id) THEN
      RAISE EXCEPTION
        'Property % cannot be % without at least one verified owner',
        COALESCE(NEW.property_code, NEW.id::TEXT), NEW.status
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT property_has_bank_account(NEW.id) THEN
      RAISE EXCEPTION
        'Property % cannot be % without at least one active bank account',
        COALESCE(NEW.property_code, NEW.id::TEXT), NEW.status
        USING ERRCODE = 'check_violation';
    END IF;

    IF property_owner_share_total(NEW.id) <> 100 THEN
      RAISE EXCEPTION
        'Property % cannot be % unless owner share percentages total 100 (current: %)',
        COALESCE(NEW.property_code, NEW.id::TEXT), NEW.status,
        property_owner_share_total(NEW.id)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_listing_rules ON properties;
CREATE TRIGGER trg_properties_listing_rules
  BEFORE INSERT OR UPDATE OF status, primary_payment_method_id, deleted_at
  ON properties
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_property_listing_rules();

-- Prevent breaking listing prerequisites via owner/bank link changes
CREATE OR REPLACE FUNCTION enforce_listed_property_owner_links()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  pid BIGINT;
  pstatus property_status_enum;
  pcode TEXT;
BEGIN
  pid := COALESCE(NEW.property_id, OLD.property_id);

  SELECT status, property_code INTO pstatus, pcode
  FROM properties
  WHERE id = pid AND deleted_at IS NULL;

  IF pstatus IS NULL OR pstatus = 'draft' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Immediate: listed property must keep at least one verified owner
  IF NOT property_has_verified_owner(pid) THEN
    RAISE EXCEPTION
      'Non-draft property % must retain at least one verified owner',
      COALESCE(pcode, pid::TEXT)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Deferred-friendly: share total must be 100 when the transaction ends
  IF property_owner_share_total(pid) <> 100 THEN
    RAISE EXCEPTION
      'Owner share percentages for non-draft property % must total 100 (current: %)',
      COALESCE(pcode, pid::TEXT), property_owner_share_total(pid)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_property_owners_listing_guard ON property_owners;
CREATE CONSTRAINT TRIGGER trg_property_owners_listing_guard
  AFTER INSERT OR UPDATE OR DELETE ON property_owners
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_listed_property_owner_links();

CREATE OR REPLACE FUNCTION enforce_listed_property_bank_links()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  pid BIGINT;
  pstatus property_status_enum;
  pcode TEXT;
BEGIN
  pid := COALESCE(NEW.property_id, OLD.property_id);

  SELECT status, property_code INTO pstatus, pcode
  FROM properties
  WHERE id = pid AND deleted_at IS NULL;

  IF pstatus IS NULL OR pstatus = 'draft' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT property_has_bank_account(pid) THEN
    RAISE EXCEPTION
      'Cannot remove bank account links from non-draft property %',
      COALESCE(pcode, pid::TEXT)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_property_bank_accounts_listing_guard ON property_bank_accounts;
CREATE CONSTRAINT TRIGGER trg_property_bank_accounts_listing_guard
  AFTER INSERT OR UPDATE OR DELETE ON property_bank_accounts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_listed_property_bank_links();

-- Keep owner verification from invalidating an already-listed property
CREATE OR REPLACE FUNCTION enforce_owner_verification_for_listed_properties()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status <> 'verified' THEN
    IF EXISTS (
      SELECT 1
      FROM property_owners po
      JOIN properties p ON p.id = po.property_id
      WHERE po.owner_id = NEW.id
        AND p.deleted_at IS NULL
        AND p.status <> 'draft'
        AND NOT EXISTS (
          SELECT 1
          FROM property_owners po2
          JOIN owners o2 ON o2.id = po2.owner_id
          WHERE po2.property_id = p.id
            AND o2.id <> NEW.id
            AND o2.verification_status = 'verified'
            AND o2.deleted_at IS NULL
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot unverify owner % while they are the only verified owner on a listed property',
        NEW.owner_name
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owners_verification_listing_guard ON owners;
CREATE TRIGGER trg_owners_verification_listing_guard
  BEFORE UPDATE OF verification_status ON owners
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_owner_verification_for_listed_properties();

-- Soft-delete / deactivate guards for listing prerequisites
CREATE OR REPLACE FUNCTION enforce_owner_active_for_listed_properties()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM property_owners po
      JOIN properties p ON p.id = po.property_id
      WHERE po.owner_id = NEW.id
        AND p.deleted_at IS NULL
        AND p.status <> 'draft'
        AND NOT EXISTS (
          SELECT 1
          FROM property_owners po2
          JOIN owners o2 ON o2.id = po2.owner_id
          WHERE po2.property_id = p.id
            AND o2.id <> NEW.id
            AND o2.verification_status = 'verified'
            AND o2.deleted_at IS NULL
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot delete owner % while they are required for a listed property',
        NEW.owner_name
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owners_soft_delete_listing_guard ON owners;
CREATE TRIGGER trg_owners_soft_delete_listing_guard
  BEFORE UPDATE OF deleted_at ON owners
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_owner_active_for_listed_properties();

CREATE OR REPLACE FUNCTION enforce_bank_active_for_listed_properties()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
     OR (NEW.is_active = FALSE AND OLD.is_active = TRUE) THEN
    IF EXISTS (
      SELECT 1
      FROM property_bank_accounts pba
      JOIN properties p ON p.id = pba.property_id
      WHERE pba.bank_account_id = NEW.id
        AND p.deleted_at IS NULL
        AND p.status <> 'draft'
        AND NOT EXISTS (
          SELECT 1
          FROM property_bank_accounts pba2
          JOIN bank_accounts ba2 ON ba2.id = pba2.bank_account_id
          WHERE pba2.property_id = p.id
            AND ba2.id <> NEW.id
            AND ba2.deleted_at IS NULL
            AND ba2.is_active = TRUE
        )
    ) THEN
      RAISE EXCEPTION
        'Cannot remove or deactivate bank account % while required for a listed property',
        NEW.account_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_accounts_listing_guard ON bank_accounts;
CREATE TRIGGER trg_bank_accounts_listing_guard
  BEFORE UPDATE OF deleted_at, is_active ON bank_accounts
  FOR EACH ROW
  EXECUTE PROCEDURE enforce_bank_active_for_listed_properties();

-- Manual commission overrides must be recorded in property history
CREATE OR REPLACE FUNCTION log_commission_override_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_manual_override = TRUE
     AND (
       TG_OP = 'INSERT'
       OR OLD.is_manual_override IS DISTINCT FROM NEW.is_manual_override
       OR OLD.final_amount IS DISTINCT FROM NEW.final_amount
       OR OLD.override_reason IS DISTINCT FROM NEW.override_reason
     ) THEN
    INSERT INTO property_history (
      property_id, event_type, old_value, new_value, description, performed_by
    ) VALUES (
      NEW.property_id,
      'commission_override',
      CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
      to_jsonb(NEW),
      COALESCE(NEW.override_reason, 'Manual commission override'),
      NEW.created_by
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commissions_override_history ON commissions;
CREATE TRIGGER trg_commissions_override_history
  AFTER INSERT OR UPDATE ON commissions
  FOR EACH ROW
  EXECUTE PROCEDURE log_commission_override_history();

-- Mark maintenance overdue when past due_date and still open
CREATE OR REPLACE FUNCTION flag_maintenance_overdue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('scheduled', 'in_progress', 'overdue')
     AND NEW.due_date < CURRENT_DATE
     AND NEW.status <> 'overdue' THEN
    NEW.status := 'overdue';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintenance_flag_overdue ON maintenance_tasks;
CREATE TRIGGER trg_maintenance_flag_overdue
  BEFORE INSERT OR UPDATE OF due_date, status ON maintenance_tasks
  FOR EACH ROW
  EXECUTE PROCEDURE flag_maintenance_overdue();

-- =============================================================================
-- HELPER VIEWS (dashboard / recycle bin support — non-destructive)
-- =============================================================================

CREATE OR REPLACE VIEW v_active_properties AS
SELECT *
FROM properties
WHERE deleted_at IS NULL
  AND status <> 'draft';

CREATE OR REPLACE VIEW v_recycle_bin AS
SELECT 'property'::TEXT AS entity_type, id AS entity_id, title AS display_name,
       deleted_at, deleted_by
FROM properties WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'owner', id, owner_name, deleted_at, deleted_by
FROM owners WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'client', id, client_name, deleted_at, deleted_by
FROM clients WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'booking', id, booking_code, deleted_at, deleted_by
FROM bookings WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'expense', id, expense_code, deleted_at, deleted_by
FROM expenses WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'vendor', id, vendor_name, deleted_at, deleted_by
FROM vendors WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'inventory_item', id, item_name, deleted_at, deleted_by
FROM inventory_items WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'employee', id, full_name, deleted_at, deleted_by
FROM employees WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'bank_account', id,
       bank_name || ' — ' || account_number, deleted_at, deleted_by
FROM bank_accounts WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'commission', id,
       'Commission #' || id::TEXT, deleted_at, deleted_by
FROM commissions WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'payment', id,
       COALESCE(payment_code, 'Payment #' || id::TEXT), deleted_at, deleted_by
FROM payments WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'property_document', id,
       COALESCE(document_name, document_type::TEXT), deleted_at, deleted_by
FROM property_documents WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'property_media', id,
       COALESCE(file_name, media_type::TEXT), deleted_at, deleted_by
FROM property_media WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'property_transfer', id,
       transfer_type::TEXT || ' #' || id::TEXT, deleted_at, deleted_by
FROM property_transfers WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'recurring_expense', id, title, deleted_at, deleted_by
FROM recurring_expenses WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'budget', id, name, deleted_at, deleted_by
FROM budgets WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'petty_cash_account', id, account_name, deleted_at, deleted_by
FROM petty_cash_accounts WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'client_kyc_document', id, document_type, deleted_at, deleted_by
FROM client_kyc_documents WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'vendor_document', id,
       COALESCE(document_name, document_type), deleted_at, deleted_by
FROM vendor_documents WHERE deleted_at IS NOT NULL
UNION ALL
SELECT 'maintenance_task', id, title, deleted_at, deleted_by
FROM maintenance_tasks WHERE deleted_at IS NOT NULL;

COMMIT;

-- =============================================================================
-- End of schema.sql
-- =============================================================================
