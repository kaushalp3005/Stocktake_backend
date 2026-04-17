-- Create stocktake_entries1 table with exact same structure as stocktake_entries
-- Run this SQL query in your PostgreSQL database

CREATE TABLE IF NOT EXISTS stocktake_entries1 (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(10) NOT NULL, -- 'PM', 'RM', 'FG'
    item_category VARCHAR(255) NOT NULL, -- Group
    item_subcategory VARCHAR(255) NOT NULL, -- Sub-group
    floor_name VARCHAR(255) NOT NULL,
    warehouse VARCHAR(255) NOT NULL,
    total_quantity INTEGER NOT NULL, -- Number of units
    unit_uom DECIMAL(10, 3) NOT NULL, -- UOM (weight per unit in kg)
    total_weight DECIMAL(10, 2) NOT NULL, -- Calculated: total_quantity * unit_uom
    entered_by VARCHAR(255) NOT NULL, -- Username
    entered_by_email VARCHAR(255), -- User email
    authority VARCHAR(255) NOT NULL,
    stock_type VARCHAR(50) DEFAULT 'Fresh Stock', -- 'Fresh Stock' or 'Off Grade/Rejection'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stocktake_entries1_item_name ON stocktake_entries1(item_name);
CREATE INDEX IF NOT EXISTS idx_stocktake_entries1_warehouse ON stocktake_entries1(warehouse);
CREATE INDEX IF NOT EXISTS idx_stocktake_entries1_floor_name ON stocktake_entries1(floor_name);
CREATE INDEX IF NOT EXISTS idx_stocktake_entries1_entered_by ON stocktake_entries1(entered_by);
CREATE INDEX IF NOT EXISTS idx_stocktake_entries1_created_at ON stocktake_entries1(created_at);
CREATE INDEX IF NOT EXISTS idx_stocktake_entries1_item_type ON stocktake_entries1(item_type);
CREATE INDEX IF NOT EXISTS idx_stocktake_entries1_stock_type ON stocktake_entries1(stock_type);
CREATE INDEX IF NOT EXISTS idx_stocktake_entries1_warehouse_floor ON stocktake_entries1(warehouse, floor_name);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_stocktake_entries1_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER stocktake_entries1_updated_at
    BEFORE UPDATE ON stocktake_entries1
    FOR EACH ROW
    EXECUTE FUNCTION update_stocktake_entries1_updated_at();

-- Verify table creation
SELECT 
    table_name, 
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'stocktake_entries1'
ORDER BY ordinal_position;