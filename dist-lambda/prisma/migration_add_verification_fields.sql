-- Migration: Add verification fields to stocktake_entries
-- Run this BEFORE deploying the new backend code
-- Safe: All new columns are optional (nullable) — existing records are unaffected

ALTER TABLE stocktake_entries ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE stocktake_entries ADD COLUMN IF NOT EXISTS verified_by VARCHAR(255);
ALTER TABLE stocktake_entries ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE stocktake_entries ADD COLUMN IF NOT EXISTS remark VARCHAR(255);
ALTER TABLE stocktake_entries ADD COLUMN IF NOT EXISTS edits JSONB;

-- Index for filtering by verification status
CREATE INDEX IF NOT EXISTS idx_stocktake_entries_verified ON stocktake_entries (verified);
