# Savla & Rishi Excel Upload Field Mapping

## Excel Sheet Structure

**Header Information:**
- Company: Savla Foods & Rishi Cold Storage Pvt Ltd
- Report Date: (from cell - e.g., 22-Jan-26)
- As On Date: (from cell - e.g., 23-Jan-26)
- Stock Details Report
- Total Inventory: (from cell - e.g., 7,56,450)

## Column Mapping

| Excel Column Header | Database Column | Data Type | Example Values | Notes |
|---------------------|-----------------|-----------|----------------|-------|
| **Inward Dt** | `inward_date` | DATE | 24/07/2023, 06/12/2023 | Parse DD/MM/YYYY format |
| **Lot No** | `lot_no` | VARCHAR(50) | 56059, 77517, 69864 | Can be numeric or alphanumeric |
| **Total Inventory Kgs** | `total_inventory_kgs` | DECIMAL(10,2) | 420, 21, 63, 9230 | Numeric value in kilograms |
| **Tally Name** | `tally_name` | VARCHAR(255) | "10KG AL BARAKAH DATE POWDER V2", "DRY DATES-GRADE 2" | Product/item name |
| **Company Name** | `company_name` | VARCHAR(100) | CDPL | Company identifier |
| **Storage Location** | `storage_location` | VARCHAR(100) | Savla, Rishi | Storage warehouse location |
| **Ageing** | `ageing_days` | INTEGER | 914, 779, 776 | Number of days since inward |
| **Ageing Bucket** | `ageing_bucket` | VARCHAR(50) | ">24 Months", "18-24 Months", "12-18 Months", "06-12 Months" | Categorized ageing period |

## Additional Database Fields (Auto-populated)

| Database Column | Source | Notes |
|----------------|--------|-------|
| `id` | AUTO INCREMENT | Primary key |
| `report_date` | From header "Report Date" or "As On Date" | Should be extracted from Excel header |
| `created_at` | CURRENT_TIMESTAMP | Auto-generated on insert |
| `updated_at` | CURRENT_TIMESTAMP | Auto-generated on insert/update |

## Data Extraction Rules

1. **Skip Header Rows**: First 3-4 rows contain report title and metadata
2. **Column Headers Row**: Look for row containing "Inward Dt", "Lot No", "Total Inventory Kgs", etc.
3. **Data Rows**: Start reading from row after column headers until empty row
4. **Date Parsing**: Convert DD/MM/YYYY to YYYY-MM-DD for PostgreSQL
5. **Number Parsing**: Remove commas from large numbers (e.g., "7,56,450" → 756450)
6. **Storage Location**: Extract from header or data column
7. **Report Date**: Extract from header cells (typically "Report Date:" or "As On Date:")

## Sample Data Patterns

### Ageing Bucket Values:
- `>24 Months` - More than 24 months old
- `18-24 Months` - 18 to 24 months old
- `12-18 Months` - 12 to 18 months old  
- `06-12 Months` - 6 to 12 months old

### Company Names:
- `CDPL` - Most common
- May have other company codes

### Storage Locations:
- `Savla` - Savla Foods
- `Rishi` - Rishi Cold Storage

## Upload Process Flow

1. **Read Excel file** (accept .xlsx, .xls)
2. **Extract header metadata** (Report Date, As On Date, Total)
3. **Find column header row** (contains "Inward Dt", "Lot No", etc.)
4. **Map columns** to database fields
5. **Parse and validate data**:
   - Date format conversion
   - Number validation
   - Required field checks
6. **Insert/Update database**:
   - Check for duplicates (lot_no + inward_date + storage_location)
   - Update if exists, insert if new
7. **Return summary**:
   - Total rows processed
   - Successful inserts
   - Errors/skipped rows

## Validation Rules

- **inward_date**: Must be valid date, not future date
- **lot_no**: Required, non-empty
- **total_inventory_kgs**: Must be positive number
- **tally_name**: Required, non-empty
- **company_name**: Required, non-empty
- **storage_location**: Must be "Savla" or "Rishi"
- **ageing_days**: Must be non-negative integer
- **ageing_bucket**: Must match predefined categories
