-- Table for Savla & Rishi Cold Storage Stock Details
-- Based on Stock Details Report structure

CREATE TABLE IF NOT EXISTS stocktake_savla_rishi (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    lot_no VARCHAR(50) NOT NULL,
    total_inventory_kgs DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tally_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    storage_location VARCHAR(100) NOT NULL,
    ageing_days INTEGER NOT NULL DEFAULT 0,
    ageing_bucket VARCHAR(50) NOT NULL,
    report_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stocktake_savla_rishi_inward_date ON stocktake_savla_rishi(inward_date);
CREATE INDEX IF NOT EXISTS idx_stocktake_savla_rishi_lot_no ON stocktake_savla_rishi(lot_no);
CREATE INDEX IF NOT EXISTS idx_stocktake_savla_rishi_storage_location ON stocktake_savla_rishi(storage_location);
CREATE INDEX IF NOT EXISTS idx_stocktake_savla_rishi_company_name ON stocktake_savla_rishi(company_name);
CREATE INDEX IF NOT EXISTS idx_stocktake_savla_rishi_ageing_bucket ON stocktake_savla_rishi(ageing_bucket);
CREATE INDEX IF NOT EXISTS idx_stocktake_savla_rishi_report_date ON stocktake_savla_rishi(report_date);

-- Add comment to table
COMMENT ON TABLE stocktake_savla_rishi IS 'Stock details for Savla Foods & Rishi Cold Storage';

-- Add comments to columns
COMMENT ON COLUMN stocktake_savla_rishi.inward_date IS 'Date when stock was received';
COMMENT ON COLUMN stocktake_savla_rishi.lot_no IS 'Lot number of the stock';
COMMENT ON COLUMN stocktake_savla_rishi.total_inventory_kgs IS 'Total inventory weight in kilograms';
COMMENT ON COLUMN stocktake_savla_rishi.tally_name IS 'Item name as per Tally';
COMMENT ON COLUMN stocktake_savla_rishi.company_name IS 'Company name (e.g., CDPL)';
COMMENT ON COLUMN stocktake_savla_rishi.storage_location IS 'Storage location (Savla/Rishi)';
COMMENT ON COLUMN stocktake_savla_rishi.ageing_days IS 'Number of days since inward';
COMMENT ON COLUMN stocktake_savla_rishi.ageing_bucket IS 'Ageing category (e.g., 06-12 Months, 12-18 Months)';
COMMENT ON COLUMN stocktake_savla_rishi.report_date IS 'Date of the stock report';
