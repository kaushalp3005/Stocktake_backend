-- Add stock_type column to stocktake_entries table
-- This column stores whether items are "Fresh Stock" or "Off Grade/Rejection"

ALTER TABLE stocktake_entries 
ADD COLUMN IF NOT EXISTS stock_type VARCHAR(50) DEFAULT 'Fresh Stock';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_stocktake_entries_stock_type ON stocktake_entries(stock_type);

-- Update existing entries to have default stock_type
UPDATE stocktake_entries 
SET stock_type = 'Fresh Stock' 
WHERE stock_type IS NULL;
