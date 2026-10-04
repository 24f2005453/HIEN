-- =============================================================
-- HIEN — Hyperlocal Inventory Exchange Network
-- Database initialisation script
-- Run once against your PostgreSQL 15+ database:
--   psql -U postgres -d hien -f init_db.sql
-- =============================================================

-- Enable PostGIS (requires the extension installed on the server)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is available
SELECT PostGIS_Full_Version();
