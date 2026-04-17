-- Migration to remove NOT NULL constraints from stocktake_entries table
-- Run this SQL query in your PostgreSQL database to allow NULL values

-- Remove NOT NULL constraints for fields that might be empty
ALTER TABLE stocktake_entries ALTER COLUMN item_name DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN item_type DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN item_category DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN item_subcategory DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN floor_name DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN warehouse DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN total_quantity DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN unit_uom DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN total_weight DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN entered_by DROP NOT NULL;
ALTER TABLE stocktake_entries ALTER COLUMN authority DROP NOT NULL;

-- Optional: Set default values for fields that should have them
ALTER TABLE stocktake_entries ALTER COLUMN item_name SET DEFAULT 'UNSPECIFIED';
ALTER TABLE stocktake_entries ALTER COLUMN total_quantity SET DEFAULT 0;
ALTER TABLE stocktake_entries ALTER COLUMN unit_uom SET DEFAULT 0.0;
ALTER TABLE stocktake_entries ALTER COLUMN total_weight SET DEFAULT 0.0;

-- Update any existing NULL values to defaults
UPDATE stocktake_entries 
SET 
    item_name = COALESCE(item_name, 'UNSPECIFIED'),
    total_quantity = COALESCE(total_quantity, 0),
    unit_uom = COALESCE(unit_uom, 0.0),
    total_weight = COALESCE(total_weight, 0.0)
WHERE item_name IS NULL OR total_quantity IS NULL OR unit_uom IS NULL OR total_weight IS NULL;

-- Verify the changes
\d stocktake_entries;