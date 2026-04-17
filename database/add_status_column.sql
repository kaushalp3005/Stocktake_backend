-- Add status column to stocktake_entries table
-- Values: 'draft' (item just added, not finalized) or 'submitted' (finalized)
-- Default 'submitted' so existing entries are treated as submitted

ALTER TABLE stocktake_entries
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'submitted';

-- Add indexes for efficient draft queries
CREATE INDEX IF NOT EXISTS idx_stocktake_entries_status ON stocktake_entries(status);
CREATE INDEX IF NOT EXISTS idx_stocktake_entries_email_status ON stocktake_entries(entered_by_email, status);
