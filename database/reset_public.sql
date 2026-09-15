-- =============================================================================
-- EstateX Pro — Reset public schema (DEV ONLY)
-- Drops and recreates public schema so schema.sql + seed.sql can be re-applied.
-- WARNING: Destroys all data in database estatex_pro.
-- =============================================================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
