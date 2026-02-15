-- Enterprise BOM System Migration
-- Run this against your existing database to add new columns
-- All statements are idempotent (safe to run multiple times)

-- ============================================================
-- 1. Components table — add enterprise inventory fields
-- ============================================================
ALTER TABLE components ADD COLUMN IF NOT EXISTS mounting_type VARCHAR(10);
ALTER TABLE components ADD COLUMN IF NOT EXISTS tolerance VARCHAR(50);
ALTER TABLE components ADD COLUMN IF NOT EXISTS voltage_rating VARCHAR(50);
ALTER TABLE components ADD COLUMN IF NOT EXISTS min_threshold INTEGER DEFAULT 0;
ALTER TABLE components ADD COLUMN IF NOT EXISTS location VARCHAR(100);
ALTER TABLE components ADD COLUMN IF NOT EXISTS supplier VARCHAR(200);
ALTER TABLE components ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;

-- ============================================================
-- 2. PCB Components Mapping — add BOM enrichment fields
-- ============================================================
ALTER TABLE pcb_components_mapping ADD COLUMN IF NOT EXISTS designators TEXT;
ALTER TABLE pcb_components_mapping ADD COLUMN IF NOT EXISTS dni BOOLEAN DEFAULT false;
ALTER TABLE pcb_components_mapping ADD COLUMN IF NOT EXISTS variant VARCHAR(50) DEFAULT 'default';

-- ============================================================
-- 3. New indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_components_supplier ON components(supplier);
CREATE INDEX IF NOT EXISTS idx_components_mounting ON components(mounting_type);
CREATE INDEX IF NOT EXISTS idx_bom_variant ON pcb_components_mapping(variant);
