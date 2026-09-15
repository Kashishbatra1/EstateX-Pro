-- =============================================================================
-- EstateX Pro — Run all database scripts
--
-- \ir = include relative to THIS file's directory (works from any CWD)
--
-- Usage (from any directory):
--   psql -U postgres -d estatex_pro -f "C:\Users\HP\EstateX-Pro\database\run_all.sql"
--
-- Or from project root:
--   psql -U postgres -d estatex_pro -f database/run_all.sql
--
-- Or from database folder:
--   psql -U postgres -d estatex_pro -f run_all.sql
-- =============================================================================

\echo '=== EstateX Pro: applying schema.sql ==='
\ir schema.sql

\echo '=== EstateX Pro: applying seed.sql ==='
\ir seed.sql

\echo '=== EstateX Pro: database setup complete ==='
\echo 'Default admin: admin@estatex.pro / Admin@123'
