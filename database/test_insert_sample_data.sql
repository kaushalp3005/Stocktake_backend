-- Test insert sample data into stocktake_entries table
-- This will verify the database connection and table structure

INSERT INTO stocktake_entries (
    item_name, item_type, item_category, item_subcategory,
    floor_name, warehouse, total_quantity, unit_uom, total_weight,
    entered_by, entered_by_email, authority, stock_type
) VALUES 
    ('ALMOND BLANCHED SLICED', 'RM', 'ALMOND', 'ALMOND - BROKEN', 
     'TEST FLOOR', 'A185', 154, 1.000, 154.00, 
     'SHUBHAMLOHAR', 'loharshubham31@gmail.com', 'SHUBHAM', 'Fresh Stock'),
     
    ('ALMOND KERNEL', 'RM', 'ALMOND', 'ALMOND - KERNELS', 
     'TEST FLOOR', 'A185', 451, 1.000, 451.00, 
     'SHUBHAMLOHAR', 'loharshubham31@gmail.com', 'SHUBHAM', 'Fresh Stock'),
     
    ('AMERICAN ALMONDS (23-25 COUNT)', 'RM', 'ALMOND', 'ALMOND - KERNELS', 
     'TEST FLOOR', 'A185', 114, 1.000, 114.00, 
     'SHUBHAMLOHAR', 'loharshubham31@gmail.com', 'SHUBHAM', 'Off Grade/Rejection'),
     
    ('AFGHAN BLACK RAISINS SEEDED 1*2', 'RM', 'RAISIN', 'RAISIN - BLACK', 
     'TEST FLOOR', 'A185', 14, 1.000, 14.00, 
     'SHUBHAMLOHAR', 'loharshubham31@gmail.com', 'SHUBHAM', 'Off Grade/Rejection');

-- Verify the data was inserted
SELECT 
    id, item_name, item_type, warehouse, floor_name, 
    total_quantity, total_weight, entered_by, stock_type, created_at
FROM stocktake_entries 
WHERE entered_by = 'SHUBHAMLOHAR'
ORDER BY created_at DESC
LIMIT 10;