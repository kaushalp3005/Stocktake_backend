"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFloorReviewRecords = exports.saveFloorReviewRecords = exports.getAvailableEntryDates = exports.finalizeDraftEntries = exports.getDraftEntries = exports.addDraftEntry = exports.deleteResultsheet = exports.searchItemDescriptions = exports.getResultsheetData = exports.getResultsheetList = exports.clearFloorEntries = exports.clearWarehouseEntries = exports.clearAllEntries = exports.saveStocktakeResultsheet = exports.getAuditSessionStatus = exports.deleteStocktakeEntry = exports.updateStocktakeEntry = exports.getGroupedStocktakeEntries = exports.getStocktakeEntries = exports.submitStocktakeEntries = exports.getCategorialInventory = exports.createSubCategory = exports.createCategory = exports.createItem = exports.getItem = exports.getAllItems = exports.getItemsByCategory = exports.getCategories = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Get all item categories
const getCategories = async (_req, res) => {
    try {
        const categories = await prisma.itemCategory.findMany({
            include: {
                subCategories: true,
            },
            orderBy: { name: "asc" },
        });
        res.json(categories);
    }
    catch (error) {
        console.error("Get categories error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getCategories = getCategories;
// Get items by category
const getItemsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const items = await prisma.item.findMany({
            where: { categoryId },
            include: {
                category: true,
                subCategory: true,
            },
            orderBy: { name: "asc" },
        });
        res.json(items);
    }
    catch (error) {
        console.error("Get items by category error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getItemsByCategory = getItemsByCategory;
// Get all items with categories
const getAllItems = async (_req, res) => {
    try {
        const items = await prisma.item.findMany({
            include: {
                category: true,
                subCategory: true,
            },
            orderBy: { name: "asc" },
        });
        res.json(items);
    }
    catch (error) {
        console.error("Get all items error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getAllItems = getAllItems;
// Get single item
const getItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const item = await prisma.item.findUnique({
            where: { id: itemId },
            include: {
                category: true,
                subCategory: true,
            },
        });
        if (!item)
            return res.status(404).json({ error: "Item not found" });
        res.json(item);
    }
    catch (error) {
        console.error("Get item error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getItem = getItem;
// Create item (admin only)
const createItem = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (req.user.role !== "ADMIN") {
            return res.status(403).json({ error: "Only admins can create items" });
        }
        const { name, categoryId, subCategoryId, description, kgPerUnit, unitName, } = req.body;
        const item = await prisma.item.create({
            data: {
                name,
                categoryId,
                subCategoryId: subCategoryId || null,
                description,
                kgPerUnit,
                unitName,
            },
            include: {
                category: true,
                subCategory: true,
            },
        });
        res.status(201).json(item);
    }
    catch (error) {
        console.error("Create item error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.createItem = createItem;
// Create category (admin only)
const createCategory = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (req.user.role !== "ADMIN") {
            return res.status(403).json({ error: "Only admins can create categories" });
        }
        const { name } = req.body;
        const category = await prisma.itemCategory.create({
            data: { name },
            include: { subCategories: true },
        });
        res.status(201).json(category);
    }
    catch (error) {
        console.error("Create category error:", error);
        if (error.code === "P2002") {
            return res.status(400).json({ error: "Category already exists" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.createCategory = createCategory;
// Create sub-category (admin only)
const createSubCategory = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (req.user.role !== "ADMIN") {
            return res
                .status(403)
                .json({ error: "Only admins can create sub-categories" });
        }
        const { categoryId, name } = req.body;
        const subCategory = await prisma.itemSubCategory.create({
            data: {
                categoryId,
                name,
            },
        });
        res.status(201).json(subCategory);
    }
    catch (error) {
        console.error("Create sub-category error:", error);
        if (error.code === "P2002") {
            return res
                .status(400)
                .json({ error: "Sub-category already exists in this category" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.createSubCategory = createSubCategory;
// Get categorial inventory data based on item type (PM/RM/FG)
// Uses all_sku table with columns: item_type, item_group, sub_group, particulars, uom
const getCategorialInventory = async (req, res) => {
    try {
        const { itemType } = req.params;
        if (!["pm", "rm", "fg"].includes(itemType.toLowerCase())) {
            return res.status(400).json({ error: "Invalid item type. Must be PM, RM, or FG" });
        }
        const itemTypeValue = itemType.toLowerCase();
        const data = await prisma.$queryRawUnsafe(`SELECT DISTINCT item_group, sub_group, particulars, uom
       FROM all_sku
       WHERE LOWER(item_type) = $1
         AND item_group IS NOT NULL
         AND TRIM(CAST(item_group AS VARCHAR)) != ''
       ORDER BY item_group, sub_group, particulars`, itemTypeValue);
        // Group the data by item_group -> sub_group -> particulars with UOM
        const groupedData = {};
        data.forEach((row) => {
            const group = (row.item_group || "").toString().trim().toUpperCase();
            const subgroup = (row.sub_group || "").toString().trim().toUpperCase();
            const particulars = (row.particulars || "").toString().trim().toUpperCase();
            const uom = row.uom;
            let uomValue = null;
            if (uom !== null && uom !== undefined && uom !== '') {
                const parsedUom = parseFloat(uom.toString());
                if (!isNaN(parsedUom)) {
                    uomValue = parsedUom;
                }
            }
            if (!group)
                return;
            if (!groupedData[group]) {
                groupedData[group] = {};
            }
            if (subgroup) {
                if (!groupedData[group][subgroup]) {
                    groupedData[group][subgroup] = [];
                }
                if (particulars) {
                    const existingIndex = groupedData[group][subgroup].findIndex(p => p.name === particulars);
                    if (existingIndex === -1) {
                        groupedData[group][subgroup].push({ name: particulars, uom: uomValue });
                    }
                    else if (groupedData[group][subgroup][existingIndex].uom === null && uomValue !== null) {
                        groupedData[group][subgroup][existingIndex].uom = uomValue;
                    }
                }
            }
        });
        res.json({
            itemType: itemType.toUpperCase(),
            groups: Object.keys(groupedData).sort().map(group => ({
                name: group,
                subgroups: Object.keys(groupedData[group]).sort().map(subgroup => ({
                    name: subgroup,
                    particulars: groupedData[group][subgroup].sort((a, b) => a.name.localeCompare(b.name)),
                })),
            })),
        });
    }
    catch (error) {
        console.error("Get categorial inventory error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message
        });
    }
};
exports.getCategorialInventory = getCategorialInventory;
// Submit stocktake entries to database
const submitStocktakeEntries = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { entries } = req.body; // Array of entry objects
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: "Entries array is required and must not be empty" });
        }
        // Validate each entry
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            // Note: All field validations removed as requested
        }
        // Generate batch entry_id for all items in this submission
        // Format: YYMM0001 (e.g., 2502 for Feb 2025, then 4-digit sequence)
        let batchEntryId;
        try {
            console.log("🔧 Generating entry_id...");
            // Create/update the function to generate entry_id
            await prisma.$executeRaw `
        CREATE OR REPLACE FUNCTION generate_batch_entry_id()
        RETURNS VARCHAR(8) AS $$
        DECLARE
            year_month VARCHAR(4);
            next_sequence INTEGER;
            new_entry_id VARCHAR(8);
        BEGIN
            -- Get current year (last 2 digits) and month
            year_month := TO_CHAR(CURRENT_DATE, 'YYMM');

            -- Find the highest sequence number for current year-month
            SELECT COALESCE(
                MAX(CAST(RIGHT(entry_id, 4) AS INTEGER)),
                0
            ) + 1
            INTO next_sequence
            FROM stocktake_entries
            WHERE entry_id LIKE year_month || '%' AND entry_id IS NOT NULL;

            -- Format the new entry_id with leading zeros
            new_entry_id := year_month || LPAD(next_sequence::TEXT, 4, '0');

            RETURN new_entry_id;
        END;
        $$ LANGUAGE plpgsql;
      `;
            console.log("✅ Function created/updated");
            // Generate the entry_id
            const entryIdResult = await prisma.$queryRaw `SELECT generate_batch_entry_id() as entry_id`;
            batchEntryId = entryIdResult[0].entry_id;
            console.log(`✅ Generated batch entry_id: ${batchEntryId} for ${entries.length} items`);
        }
        catch (error) {
            console.error("❌ Error generating entry_id:", error);
            // Manual fallback using timestamp
            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const sequence = Math.floor(Math.random() * 9999) + 1;
            batchEntryId = year + month + sequence.toString().padStart(4, '0');
            console.log(`⚠️ Using manual fallback entry_id: ${batchEntryId}`);
        }
        if (!batchEntryId) {
            console.error("❌ Failed to generate entry_id, using timestamp fallback");
            const timestamp = Date.now().toString().slice(-8);
            batchEntryId = timestamp;
        }
        console.log(`🎯 Final entry_id to use: ${batchEntryId}`);
        // Prepare entries for insertion
        // DO NOT include id in INSERT - let DB auto-generate
        const insertPromises = entries.map(async (entry, idx) => {
            console.log(`🔍 Entry ${idx + 1} received:`, JSON.stringify(entry, null, 2));
            const itemName = (entry.item_name || entry.itemName || entry.description || "UNSPECIFIED").toUpperCase();
            const itemType = (entry.item_type || entry.itemType || "FG").toUpperCase(); // Default to FG if not specified
            const itemCategory = (entry.item_category || entry.category || entry.itemCategory || "GENERAL").toUpperCase();
            const itemSubcategory = (entry.item_subcategory || entry.subcategory || entry.itemSubcategory || "OTHER").toUpperCase();
            const floorName = (entry.floor_name || entry.floorName || entry.floor || "MAIN").toUpperCase();
            const warehouse = (entry.warehouse || "MAIN").toUpperCase();
            const totalQuantity = parseFloat(entry.total_quantity || entry.units || entry.totalQuantity || "0") || 0;
            const unitUom = parseFloat(entry.unit_uom || entry.packageSize || entry.unitUom || 0) || 0;
            const totalWeight = parseFloat(entry.total_weight || entry.totalWeight || (totalQuantity * unitUom).toFixed(2)) || 0;
            const enteredBy = (entry.entered_by || entry.enteredBy || entry.userName || "UNKNOWN").toUpperCase();
            const enteredByEmail = entry.entered_by_email || entry.enteredByEmail || entry.userEmail || null;
            const authority = (entry.authority || "FLOOR_MANAGER").toUpperCase();
            const stockType = entry.stock_type || entry.stockType || "Fresh Stock";
            console.log(`✅ Entry ${idx + 1} mapped to:`, {
                itemName, itemType, itemCategory, itemSubcategory,
                floorName, warehouse, totalQuantity, unitUom, totalWeight,
                enteredBy, enteredByEmail, authority, stockType, entryId: batchEntryId
            });
            // Use Prisma.sql for safe parameterized query with entry_id
            // RETURNING clause to get inserted row with generated ID
            const query = client_1.Prisma.sql `
        INSERT INTO stocktake_entries (
          item_name, item_type, item_category, item_subcategory,
          floor_name, warehouse, total_quantity, unit_uom, total_weight,
          entered_by, entered_by_email, authority, stock_type, entry_id, created_at, updated_at
        ) VALUES (${itemName}, ${itemType}, ${itemCategory}, ${itemSubcategory},
          ${floorName}, ${warehouse}, ${totalQuantity}, ${unitUom}, ${totalWeight},
          ${enteredBy}, ${enteredByEmail}, ${authority}, ${stockType}, ${batchEntryId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, item_name, warehouse, floor_name, total_quantity, total_weight, stock_type, entry_id
      `;
            const inserted = await prisma.$queryRaw(query);
            console.log(`✅ Entry ${idx + 1} inserted with entry_id:`, inserted[0]?.entry_id);
            return inserted[0]; // Return inserted row with generated ID
        });
        const insertedRows = await Promise.all(insertPromises);
        console.log(`🎉 Successfully inserted ${insertedRows.length} items with entry_id: ${batchEntryId}`);
        res.json({
            success: true,
            message: `Successfully submitted ${entries.length} entries with entry_id: ${batchEntryId}`,
            count: entries.length,
            entryId: batchEntryId,
            insertedIds: insertedRows.map(r => r.id), // Return generated IDs
        });
    }
    catch (error) {
        console.error("❌ Submit stocktake entries error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.submitStocktakeEntries = submitStocktakeEntries;
// Get stocktake entries with filters
const getStocktakeEntries = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { warehouse, floorName, itemName, enteredBy, itemType, startDate, endDate, limit, includeDrafts } = req.query;
        console.log('🔍 GET /api/stocktake-entries - Query params:', {
            warehouse, floorName, itemName, enteredBy, itemType, startDate, endDate, limit, includeDrafts
        });
        // Parse limit parameter (default: no limit, max: 1000)
        const limitValue = limit ? Math.min(Math.max(1, parseInt(limit, 10) || 1000), 1000) : null;
        // Build where clause
        const where = {};
        if (warehouse) {
            where.warehouse = warehouse;
        }
        if (floorName) {
            where.floorName = floorName;
        }
        if (itemName) {
            where.itemName = {
                contains: itemName.toUpperCase(),
                mode: 'insensitive',
            };
        }
        if (enteredBy) {
            where.enteredBy = {
                contains: enteredBy,
                mode: 'insensitive',
            };
        }
        if (itemType) {
            where.itemType = itemType.toUpperCase();
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) {
                where.createdAt.gte = new Date(startDate);
            }
            if (endDate) {
                where.createdAt.lte = new Date(endDate);
            }
        }
        // Build SQL query - validate and sanitize inputs first to prevent SQL injection
        const warehouseValue = warehouse ? String(warehouse).toUpperCase().replace(/[^A-Z0-9\s-]/g, '') : null;
        const floorNameValue = floorName ? String(floorName).toUpperCase().replace(/[^A-Z0-9\s-]/g, '') : null;
        const itemNamePattern = itemName ? `%${String(itemName).toUpperCase().replace(/[%_\\]/g, '')}%` : null;
        const enteredByPattern = enteredBy ? `%${String(enteredBy).toUpperCase().replace(/[%_\\]/g, '')}%` : null;
        const itemTypeValue = itemType ? String(itemType).toUpperCase().replace(/[^A-Z]/g, '') : null;
        const startDateValue = startDate ? new Date(startDate) : null;
        const endDateValue = endDate ? new Date(endDate) : null;
        // Build query using Prisma.sql for safe parameterization
        // Start with base query and add conditions conditionally
        let entries;
        // By default exclude draft entries unless includeDrafts=true is passed
        const excludeDrafts = includeDrafts !== 'true';
        if (warehouseValue && floorNameValue) {
            // Most common case: warehouse + floorName - use Prisma.sql for safety
            let query = excludeDrafts
                ? client_1.Prisma.sql `
          SELECT * FROM stocktake_entries
          WHERE UPPER(warehouse) = ${warehouseValue}
            AND UPPER(floor_name) = ${floorNameValue}
            AND (status IS NULL OR status != 'draft')
        `
                : client_1.Prisma.sql `
          SELECT * FROM stocktake_entries
          WHERE UPPER(warehouse) = ${warehouseValue}
            AND UPPER(floor_name) = ${floorNameValue}
        `;
            if (itemNamePattern) {
                query = client_1.Prisma.sql `${query} AND UPPER(item_name) LIKE ${itemNamePattern}`;
            }
            if (enteredByPattern) {
                query = client_1.Prisma.sql `${query} AND UPPER(entered_by) LIKE ${enteredByPattern}`;
            }
            if (itemTypeValue) {
                query = client_1.Prisma.sql `${query} AND item_type = ${itemTypeValue}`;
            }
            if (startDateValue) {
                query = client_1.Prisma.sql `${query} AND created_at >= ${startDateValue}`;
            }
            if (endDateValue) {
                query = client_1.Prisma.sql `${query} AND created_at <= ${endDateValue}`;
            }
            query = client_1.Prisma.sql `${query} ORDER BY created_at DESC`;
            if (limitValue) {
                query = client_1.Prisma.sql `${query} LIMIT ${limitValue}`;
            }
            entries = await prisma.$queryRaw(query);
        }
        else {
            // Fallback for other cases - build query with validated inputs
            const whereParts = [];
            // Exclude drafts by default
            if (excludeDrafts) {
                whereParts.push(`(status IS NULL OR status != 'draft')`);
            }
            if (warehouseValue) {
                whereParts.push(`UPPER(warehouse) = '${warehouseValue.replace(/'/g, "''")}'`);
            }
            if (floorNameValue) {
                whereParts.push(`UPPER(floor_name) = '${floorNameValue.replace(/'/g, "''")}'`);
            }
            if (itemNamePattern) {
                whereParts.push(`UPPER(item_name) LIKE '${itemNamePattern.replace(/'/g, "''")}'`);
            }
            if (enteredByPattern) {
                whereParts.push(`UPPER(entered_by) LIKE '${enteredByPattern.replace(/'/g, "''")}'`);
            }
            if (itemTypeValue) {
                whereParts.push(`item_type = '${itemTypeValue.replace(/'/g, "''")}'`);
            }
            if (startDateValue) {
                whereParts.push(`created_at >= '${startDateValue.toISOString()}'`);
            }
            if (endDateValue) {
                whereParts.push(`created_at <= '${endDateValue.toISOString()}'`);
            }
            const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
            const limitClause = limitValue ? ` LIMIT ${limitValue}` : '';
            const queryString = `SELECT * FROM stocktake_entries ${whereClause} ORDER BY created_at DESC${limitClause}`;
            // Values are validated and sanitized above - safe to use $queryRawUnsafe
            entries = await prisma.$queryRawUnsafe(queryString);
        }
        // Format entries for response (convert snake_case to camelCase)
        const formattedEntries = entries.map((entry) => ({
            id: entry.id,
            entryId: entry.entry_id || null,
            itemName: entry.item_name,
            itemType: entry.item_type,
            itemCategory: entry.item_category,
            itemSubcategory: entry.item_subcategory,
            floorName: entry.floor_name,
            warehouse: entry.warehouse,
            totalQuantity: parseFloat(entry.total_quantity?.toString() || "0"),
            unitUom: parseFloat(entry.unit_uom.toString()),
            totalWeight: parseFloat(entry.total_weight.toString()),
            enteredBy: entry.entered_by,
            enteredByEmail: entry.entered_by_email,
            authority: entry.authority,
            stockType: entry.stock_type || "Fresh Stock",
            createdAt: entry.created_at ? new Date(entry.created_at).toISOString() : null,
            updatedAt: entry.updated_at ? new Date(entry.updated_at).toISOString() : null,
        }));
        console.log(`✅ Returning ${formattedEntries.length} entries for query`);
        res.json({
            success: true,
            entries: formattedEntries,
            count: formattedEntries.length,
        });
    }
    catch (error) {
        console.error("Get stocktake entries error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.getStocktakeEntries = getStocktakeEntries;
// Get grouped stocktake entries (for manager review)
const getGroupedStocktakeEntries = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { warehouse, floorName } = req.query;
        if (!warehouse || !floorName) {
            return res.status(400).json({ error: "warehouse and floorName query parameters are required" });
        }
        // Get all entries for this warehouse and floor using raw SQL
        // Use case-insensitive matching for warehouse and floor_name
        const warehouseUpper = warehouse.toUpperCase();
        const floorNameUpper = floorName.toUpperCase();
        const query = client_1.Prisma.sql `
      SELECT * FROM stocktake_entries
      WHERE UPPER(warehouse) = UPPER(${warehouseUpper}) AND UPPER(floor_name) = UPPER(${floorNameUpper})
        AND (status IS NULL OR status != 'draft')
      ORDER BY created_at DESC
    `;
        const entries = await prisma.$queryRaw(query);
        // Group entries by item name (description)
        const grouped = {};
        entries.forEach((entry) => {
            const key = (entry.item_name || "").toUpperCase();
            if (!grouped[key]) {
                grouped[key] = {
                    description: entry.item_name,
                    category: entry.item_category,
                    subcategory: entry.item_subcategory,
                    itemType: entry.item_type,
                    entries: [],
                    totalEntries: 0,
                    totalQuantity: 0,
                    totalWeight: 0,
                };
            }
            grouped[key].entries.push({
                id: entry.id.toString(),
                description: entry.item_name,
                itemType: entry.item_type || "",
                category: entry.item_category,
                subcategory: entry.item_subcategory,
                packageSize: parseFloat(entry.unit_uom.toString()),
                units: parseFloat(entry.total_quantity?.toString() || "0"),
                totalWeight: parseFloat(entry.total_weight.toString()),
                userName: entry.entered_by,
                userEmail: entry.entered_by_email,
                authority: entry.authority,
                stockType: entry.stock_type || "Fresh Stock",
                createdAt: entry.created_at ? new Date(entry.created_at).toISOString() : new Date().toISOString(),
            });
            grouped[key].totalEntries++;
            grouped[key].totalQuantity += parseFloat(entry.total_quantity?.toString() || "0");
            grouped[key].totalWeight += parseFloat(entry.total_weight.toString());
        });
        res.json({
            success: true,
            warehouse,
            floorName,
            groups: Object.values(grouped).sort((a, b) => a.description.localeCompare(b.description)),
            totalEntries: entries.length,
        });
    }
    catch (error) {
        console.error("Get grouped stocktake entries error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.getGroupedStocktakeEntries = getGroupedStocktakeEntries;
// Helper function to check if audit session is active and locks entries
const checkAuditSessionLock = async (warehouse, floorName) => {
    try {
        // Check if there's an active audit session for this warehouse
        // Lock floor-manager edits ONLY while audit is IN_PROGRESS.
        // Once manager "saves" (resultsheet saved), we mark audit as SUBMITTED and unlock editing.
        const warehouseUpper = warehouse.toUpperCase();
        const query = client_1.Prisma.sql `
      SELECT a.status 
      FROM audit_sessions a
      JOIN warehouses w ON w.id = a.warehouse_id
      WHERE UPPER(w.name) = UPPER(${warehouseUpper})
        AND a.status IN ('IN_PROGRESS')
      ORDER BY a.created_at DESC
      LIMIT 1
    `;
        const result = await prisma.$queryRaw(query);
        return result.length > 0;
    }
    catch (error) {
        console.error("Check audit session lock error:", error);
        // Fail open - allow editing if we can't determine lock status
        return false;
    }
};
// Update stocktake entry
const updateStocktakeEntry = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { entryId } = req.params;
        const { itemName, itemType, category, subcategory, totalQuantity, unitUom, totalWeight, floorName, warehouse } = req.body;
        // Get the entry first to check authorization and audit status
        const getEntryQuery = client_1.Prisma.sql `
      SELECT * FROM stocktake_entries WHERE id = ${parseInt(entryId)}
    `;
        const entries = await prisma.$queryRaw(getEntryQuery);
        if (entries.length === 0) {
            return res.status(404).json({ error: "Entry not found" });
        }
        const entry = entries[0];
        // Check if audit session is active - if yes, only managers can edit
        const isAuditActive = await checkAuditSessionLock(entry.warehouse || warehouse, entry.floor_name || floorName);
        // Authorization check:
        // 1. Managers (INVENTORY_MANAGER, ADMIN) can always edit
        // 2. Floor managers can only edit their own entries, and only if audit is not active
        const isManager = req.user.role === "INVENTORY_MANAGER" || req.user.role === "ADMIN";
        const isOwner = entry.entered_by?.toUpperCase() === req.user.email.toUpperCase() ||
            entry.entered_by_email?.toUpperCase() === req.user.email.toUpperCase();
        if (!isManager && (isAuditActive || !isOwner)) {
            return res.status(403).json({
                error: isAuditActive
                    ? "Cannot edit entries while audit session is active"
                    : "You can only edit your own entries"
            });
        }
        // Prepare update data
        const updateData = {};
        if (itemName !== undefined)
            updateData.item_name = String(itemName).toUpperCase();
        if (itemType !== undefined)
            updateData.item_type = String(itemType).toUpperCase();
        if (category !== undefined)
            updateData.item_category = String(category).toUpperCase();
        if (subcategory !== undefined)
            updateData.item_subcategory = String(subcategory).toUpperCase();
        if (totalQuantity !== undefined)
            updateData.total_quantity = parseFloat(totalQuantity);
        if (unitUom !== undefined)
            updateData.unit_uom = parseFloat(unitUom);
        if (floorName !== undefined)
            updateData.floor_name = String(floorName).toUpperCase();
        if (warehouse !== undefined)
            updateData.warehouse = String(warehouse).toUpperCase();
        // Recalculate total weight if quantity or UOM changed
        if (totalQuantity !== undefined || unitUom !== undefined) {
            const qty = totalQuantity !== undefined ? parseFloat(totalQuantity) : parseFloat(entry.total_quantity.toString());
            const uom = unitUom !== undefined ? parseFloat(unitUom) : parseFloat(entry.unit_uom.toString());
            updateData.total_weight = parseFloat((qty * uom).toFixed(2));
        }
        else if (totalWeight !== undefined) {
            updateData.total_weight = parseFloat(totalWeight);
        }
        // Build update query with Prisma.sql
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }
        // Build update SET clause
        const setParts = [];
        const updateValues = [];
        let paramIndex = 1;
        Object.keys(updateData).forEach((key) => {
            setParts.push(`${key} = $${paramIndex++}`);
            updateValues.push(updateData[key]);
        });
        setParts.push(`updated_at = CURRENT_TIMESTAMP`);
        const updateQuery = `
      UPDATE stocktake_entries 
      SET ${setParts.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
        updateValues.push(parseInt(entryId));
        const updatedEntries = await prisma.$queryRawUnsafe(updateQuery, ...updateValues);
        if (updatedEntries.length === 0) {
            return res.status(404).json({ error: "Entry not found after update" });
        }
        const updated = updatedEntries[0];
        res.json({
            success: true,
            entry: {
                id: updated.id,
                itemName: updated.item_name,
                itemType: updated.item_type,
                itemCategory: updated.item_category,
                itemSubcategory: updated.item_subcategory,
                floorName: updated.floor_name,
                warehouse: updated.warehouse,
                totalQuantity: updated.total_quantity,
                unitUom: parseFloat(updated.unit_uom.toString()),
                totalWeight: parseFloat(updated.total_weight.toString()),
                enteredBy: updated.entered_by,
                enteredByEmail: updated.entered_by_email,
                authority: updated.authority,
                createdAt: updated.created_at ? new Date(updated.created_at).toISOString() : null,
                updatedAt: updated.updated_at ? new Date(updated.updated_at).toISOString() : null,
            },
        });
    }
    catch (error) {
        console.error("Update stocktake entry error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.updateStocktakeEntry = updateStocktakeEntry;
// Delete stocktake entry
const deleteStocktakeEntry = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { entryId } = req.params;
        // Get the entry first to check authorization and audit status
        const getEntryQuery = client_1.Prisma.sql `
      SELECT * FROM stocktake_entries WHERE id = ${parseInt(entryId)}
    `;
        const entries = await prisma.$queryRaw(getEntryQuery);
        if (entries.length === 0) {
            return res.status(404).json({ error: "Entry not found" });
        }
        const entry = entries[0];
        // Check if audit session is active - if yes, only managers can delete
        const isAuditActive = await checkAuditSessionLock(entry.warehouse, entry.floor_name);
        // Authorization check:
        // 1. Only SUPERUSER can always delete
        // 2. Floor managers can only delete their own entries, and only if audit is not active
        const isManager = req.user.role === "SUPERUSER";
        const isOwner = entry.entered_by?.toUpperCase() === req.user.email.toUpperCase() ||
            entry.entered_by_email?.toUpperCase() === req.user.email.toUpperCase();
        if (!isManager && (isAuditActive || !isOwner)) {
            return res.status(403).json({
                error: isAuditActive
                    ? "Cannot delete entries while audit session is active"
                    : "You can only delete your own entries"
            });
        }
        // Delete the entry
        const deleteQuery = client_1.Prisma.sql `
      DELETE FROM stocktake_entries WHERE id = ${parseInt(entryId)} RETURNING id
    `;
        const deleted = await prisma.$queryRaw(deleteQuery);
        if (deleted.length === 0) {
            return res.status(404).json({ error: "Entry not found" });
        }
        res.json({
            success: true,
            message: "Entry deleted successfully",
            entryId: deleted[0].id.toString(),
        });
    }
    catch (error) {
        console.error("Delete stocktake entry error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.deleteStocktakeEntry = deleteStocktakeEntry;
// Get audit session status for warehouse (check if entries are locked)
const getAuditSessionStatus = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { warehouse } = req.query;
        if (!warehouse) {
            return res.status(400).json({ error: "warehouse query parameter is required" });
        }
        // Check if there's an active audit session for this warehouse
        const warehouseUpper = String(warehouse).toUpperCase();
        const query = client_1.Prisma.sql `
      SELECT a.id, a.status, a.audit_date, a.created_at, u.name as manager_name
      FROM audit_sessions a
      JOIN warehouses w ON w.id = a.warehouse_id
      JOIN users u ON u.id = a.user_id
      WHERE UPPER(w.name) = UPPER(${warehouseUpper})
      AND a.status IN ('IN_PROGRESS', 'SUBMITTED', 'APPROVED')
      ORDER BY a.created_at DESC
      LIMIT 1
    `;
        const sessions = await prisma.$queryRaw(query);
        const isLocked = sessions.length > 0;
        const auditSession = sessions.length > 0 ? {
            id: sessions[0].id,
            status: sessions[0].status,
            auditDate: sessions[0].audit_date ? new Date(sessions[0].audit_date).toISOString() : null,
            createdAt: sessions[0].created_at ? new Date(sessions[0].created_at).toISOString() : null,
            managerName: sessions[0].manager_name,
        } : null;
        res.json({
            success: true,
            isLocked,
            auditSession,
            canEdit: !isLocked || req.user.role === "INVENTORY_MANAGER" || req.user.role === "ADMIN",
        });
    }
    catch (error) {
        console.error("Get audit session status error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.getAuditSessionStatus = getAuditSessionStatus;
// Save checked entries directly to stocktake_entries table
// Accepts full entry data instead of IDs to avoid ID mismatch issues
const saveStocktakeResultsheet = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { entries } = req.body;
        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: "Entries array is required and must not be empty" });
        }
        console.log(`Processing ${entries.length} entries. Will save to both stocktake_entries and stocktake_resultsheet`);
        // Get today's date for resultsheet
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        // Process entries - use provided data directly, no need to fetch from DB
        const processedEntries = [];
        // Validate and process all entries
        for (const entry of entries) {
            // Use provided entry data directly - no need to fetch from DB
            const entryAny = entry; // Type assertion for fallback properties
            const itemName = (entry.itemName || "").toString().trim().toUpperCase();
            const itemType = (entry.itemType || "").toString().trim().toUpperCase();
            const itemCategory = (entry.category || entryAny.itemCategory || "").toString().trim().toUpperCase();
            const itemSubcategory = (entry.subcategory || entryAny.itemSubcategory || "").toString().trim().toUpperCase();
            const floorName = (entry.floorName || "").toString().trim().toUpperCase();
            const warehouse = (entry.warehouse || "").toString().trim().toUpperCase();
            const totalQuantity = parseFloat(entry.quantity || entryAny.totalQuantity || "0");
            const unitUom = parseFloat(entry.uom || entryAny.unitUom || "0");
            const totalWeight = parseFloat(entry.weight || entryAny.totalWeight || (totalQuantity * unitUom).toFixed(2));
            const enteredBy = (req.user?.email || "MANAGER").toUpperCase();
            const enteredByEmail = req.user?.email || null;
            const authority = "MANAGER";
            const stockType = (entry.stockType || entryAny.stockType || "Fresh Stock").toString().trim();
            // Validate required fields
            if (!itemName || !warehouse || !floorName) {
                console.warn(`⚠ Skipping entry ${processedEntries.length + 1}: Missing required fields`);
                console.warn(`  - itemName: "${itemName}" (required: non-empty)`);
                console.warn(`  - warehouse: "${warehouse}" (required: non-empty)`);
                console.warn(`  - floorName: "${floorName}" (required: non-empty)`);
                continue;
            }
            if (totalQuantity <= 0 || totalWeight <= 0) {
                console.warn(`⚠ Skipping entry ${processedEntries.length + 1}: Invalid quantity/weight`);
                console.warn(`  - itemName: "${itemName}"`);
                console.warn(`  - quantity: ${totalQuantity} (required: > 0)`);
                console.warn(`  - weight: ${totalWeight} (required: > 0)`);
                continue;
            }
            console.log(`✓ Entry ${processedEntries.length + 1} validated: ${itemName} (${warehouse}/${floorName}) - Qty: ${totalQuantity}, Weight: ${totalWeight}kg`);
            processedEntries.push({
                itemName,
                itemType,
                itemCategory,
                itemSubcategory,
                floorName,
                warehouse,
                totalQuantity,
                unitUom,
                totalWeight,
                enteredBy,
                enteredByEmail,
                authority,
                stockType,
            });
        }
        if (processedEntries.length === 0) {
            return res.status(400).json({
                error: "No valid entries to save. Please check that all entries have required fields (itemName, warehouse, floorName, quantity, weight)."
            });
        }
        console.log(`\n=== VALIDATION COMPLETE ===`);
        console.log(`Processed ${processedEntries.length} valid entries (from ${entries.length} received)`);
        if (processedEntries.length < entries.length) {
            console.warn(`Skipped ${entries.length - processedEntries.length} invalid entries`);
        }
        // Insert into stocktake_entries table
        console.log("\n=== INSERTING INTO stocktake_entries ===");
        const entriesInsertPromises = processedEntries.map(async (entry) => {
            const insertQuery = client_1.Prisma.sql `
        INSERT INTO stocktake_entries (
          item_name, item_type, item_category, item_subcategory,
          floor_name, warehouse, total_quantity, unit_uom, total_weight,
          entered_by, entered_by_email, authority, stock_type, created_at, updated_at
        ) VALUES (${entry.itemName}, ${entry.itemType}, ${entry.itemCategory}, ${entry.itemSubcategory},
          ${entry.floorName}, ${entry.warehouse}, ${entry.totalQuantity}, ${entry.unitUom}, ${entry.totalWeight},
          ${entry.enteredBy}, ${entry.enteredByEmail || null}, ${entry.authority}, ${entry.stockType}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, item_name, warehouse, floor_name
      `;
            const inserted = await prisma.$queryRaw(insertQuery);
            return inserted[0];
        });
        const insertedEntries = await Promise.all(entriesInsertPromises);
        // Aggregate entries for resultsheet (group by item_name, category, subcategory, warehouse, floor_name, stock_type)
        // NOTE: item_type is NOT included in the key - same items are summed regardless of item_type
        const aggregatedForResultsheet = {};
        processedEntries.forEach((entry) => {
            // DO NOT include item_type in the key - same items with different item_types should be summed together
            const key = `${entry.itemName}_${entry.itemCategory}_${entry.itemSubcategory}_${entry.warehouse}_${entry.floorName}_${entry.stockType}`.toUpperCase();
            if (!aggregatedForResultsheet[key]) {
                aggregatedForResultsheet[key] = {
                    item_name: entry.itemName,
                    item_type: entry.itemType, // Keep first item_type encountered
                    group: entry.itemCategory,
                    subgroup: entry.itemSubcategory,
                    warehouse: entry.warehouse,
                    floor_name: entry.floorName,
                    stock_type: entry.stockType,
                    total_weight: 0,
                    total_quantity: 0,
                    uom: entry.unitUom,
                };
            }
            else if (entry.itemType && !aggregatedForResultsheet[key].item_type) {
                // If current entry has item_type and existing doesn't, use current item_type
                aggregatedForResultsheet[key].item_type = entry.itemType;
            }
            aggregatedForResultsheet[key].total_weight += entry.totalWeight;
            aggregatedForResultsheet[key].total_quantity += entry.totalQuantity;
        });
        // Ensure stock_type column exists in stocktake_resultsheet table
        try {
            await prisma.$executeRawUnsafe(`
        ALTER TABLE stocktake_resultsheet
        ADD COLUMN IF NOT EXISTS stock_type VARCHAR(50) DEFAULT 'Fresh Stock'
      `);
        }
        catch (alterError) {
            // Column might already exist - ignore error
            console.log("stock_type column check completed");
        }
        // Insert aggregated data into stocktake_resultsheet
        // Check if record exists first, then update or insert
        const resultsheetInsertPromises = Object.values(aggregatedForResultsheet).map(async (agg) => {
            // First check if a record exists for this combination (NOT including item_type - same items summed together)
            const checkQuery = client_1.Prisma.sql `
        SELECT id, weight, quantity, item_type
        FROM stocktake_resultsheet
        WHERE item_name = ${agg.item_name}
          AND "group" = ${agg.group}
          AND subgroup = ${agg.subgroup}
          AND warehouse = ${agg.warehouse}
          AND floor_name = ${agg.floor_name}
          AND COALESCE(stock_type, 'Fresh Stock') = ${agg.stock_type}
          AND date = ${dateStr}::date
        LIMIT 1
      `;
            const existing = await prisma.$queryRaw(checkQuery);
            if (existing.length > 0) {
                // Record exists, update it (sum quantities/weights)
                const existingRecord = existing[0];
                const newWeight = parseFloat(existingRecord.weight?.toString() || "0") + agg.total_weight;
                const newQuantity = parseFloat(existingRecord.quantity?.toString() || "0") + agg.total_quantity;
                // Keep existing item_type if it has one, otherwise use the new one
                const finalItemType = existingRecord.item_type || agg.item_type || "";
                const updateQuery = client_1.Prisma.sql `
          UPDATE stocktake_resultsheet
          SET
            item_type = ${finalItemType},
            stock_type = ${agg.stock_type},
            weight = ${newWeight},
            quantity = ${newQuantity},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existingRecord.id}
        `;
                await prisma.$executeRaw(updateQuery);
                console.log(`  ✓ Updated existing resultsheet entry: ${agg.item_name} (${agg.warehouse}/${agg.floor_name}) [${agg.stock_type}] - Qty: ${newQuantity}, Weight: ${newWeight}kg`);
                return { action: 'updated', id: existingRecord.id };
            }
            else {
                // Record doesn't exist, insert it
                const insertQuery = client_1.Prisma.sql `
          INSERT INTO stocktake_resultsheet (item_name, item_type, "group", subgroup, warehouse, floor_name, stock_type, weight, quantity, uom, date, created_at, updated_at)
          VALUES (${agg.item_name}, ${agg.item_type}, ${agg.group}, ${agg.subgroup}, ${agg.warehouse}, ${agg.floor_name}, ${agg.stock_type}, ${agg.total_weight}, ${agg.total_quantity}, ${agg.uom}, ${dateStr}::date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `;
                const inserted = await prisma.$queryRaw(insertQuery);
                console.log(`  ✓ Inserted new resultsheet entry: ${agg.item_name} (${agg.warehouse}/${agg.floor_name}) [${agg.stock_type}]`);
                return { action: 'inserted', id: inserted[0]?.id };
            }
        });
        await Promise.all(resultsheetInsertPromises);
        console.log(`✓ Inserted ${Object.keys(aggregatedForResultsheet).length} aggregated entries into stocktake_resultsheet`);
        // === END AUDIT on manager save ===
        // When manager saves resultsheet, mark latest IN_PROGRESS audit for this warehouse as SUBMITTED
        // so floor managers can resume editing.
        try {
            const warehouseToEnd = processedEntries[0]?.warehouse;
            if (warehouseToEnd) {
                const updateAuditQuery = client_1.Prisma.sql `
          UPDATE audit_sessions a
          SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP
          FROM warehouses w
          WHERE w.id = a.warehouse_id
            AND UPPER(w.name) = UPPER(${warehouseToEnd})
            AND a.status = 'IN_PROGRESS'
          RETURNING a.id
        `;
                const updatedAudits = await prisma.$queryRaw(updateAuditQuery);
                console.log(`✓ Audit ended for warehouse ${warehouseToEnd}. Updated audits: ${updatedAudits.length}`);
            }
        }
        catch (auditUpdateError) {
            // Fail open: saving resultsheet succeeded, so don't fail the request if audit status update fails.
            console.error("Failed to update audit status after save:", auditUpdateError);
        }
        console.log("\n=== SAVE COMPLETE ===");
        console.log(`Total entries saved: ${insertedEntries.length} to stocktake_entries`);
        console.log(`Total aggregated entries saved: ${Object.keys(aggregatedForResultsheet).length} to stocktake_resultsheet`);
        console.log(`Date used for resultsheet: ${dateStr}`);
        console.log("=== REQUEST FINISHED ===\n");
        res.json({
            success: true,
            message: "Stock take entries saved successfully to both stocktake_entries and stocktake_resultsheet",
            savedCount: insertedEntries.length,
            resultsheetCount: Object.keys(aggregatedForResultsheet).length,
            insertedIds: insertedEntries.map(r => r.id),
        });
    }
    catch (error) {
        console.error("Save stocktake entries error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.saveStocktakeResultsheet = saveStocktakeResultsheet;
// Clear all entries from stocktake_entries table
const clearAllEntries = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Only allow superuser to clear entries
        if (req.user.role !== "SUPERUSER") {
            return res.status(403).json({ error: "Only superuser can clear entries" });
        }
        // Delete all entries from stocktake_entries table
        const deleteQuery = client_1.Prisma.sql `
      DELETE FROM stocktake_entries
      RETURNING id
    `;
        const deleted = await prisma.$queryRaw(deleteQuery);
        res.json({
            success: true,
            message: "All entries cleared successfully",
            deletedCount: deleted.length,
        });
    }
    catch (error) {
        console.error("Clear all entries error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.clearAllEntries = clearAllEntries;
const clearWarehouseEntries = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Only allow superuser to clear warehouse entries
        if (req.user.role !== "SUPERUSER") {
            return res.status(403).json({ error: "Only superuser can clear warehouse entries" });
        }
        const { warehouse } = req.params;
        if (!warehouse) {
            return res.status(400).json({ error: "Warehouse name is required" });
        }
        // Delete all entries for the specified warehouse
        const deleteQuery = client_1.Prisma.sql `
      DELETE FROM stocktake_entries
      WHERE warehouse = ${warehouse}
      RETURNING id
    `;
        const deleted = await prisma.$queryRaw(deleteQuery);
        res.json({
            success: true,
            message: `All entries for warehouse ${warehouse} cleared successfully`,
            deletedCount: deleted.length,
            warehouse,
        });
    }
    catch (error) {
        console.error("Clear warehouse entries error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.clearWarehouseEntries = clearWarehouseEntries;
const clearFloorEntries = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Only allow superuser to clear floor entries
        if (req.user.role !== "SUPERUSER") {
            return res.status(403).json({ error: "Only superuser can clear floor entries" });
        }
        const { warehouse, floor } = req.params;
        if (!warehouse) {
            return res.status(400).json({ error: "Warehouse name is required" });
        }
        if (!floor) {
            return res.status(400).json({ error: "Floor name is required" });
        }
        // Delete all entries for the specified warehouse and floor
        const deleteQuery = client_1.Prisma.sql `
      DELETE FROM stocktake_entries
      WHERE warehouse = ${warehouse} AND floor_name = ${floor}
      RETURNING id
    `;
        const deleted = await prisma.$queryRaw(deleteQuery);
        res.json({
            success: true,
            message: `All entries for ${warehouse} - ${floor} cleared successfully`,
            deletedCount: deleted.length,
            warehouse,
            floor,
        });
    }
    catch (error) {
        console.error("Clear floor entries error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.clearFloorEntries = clearFloorEntries;
// Get stocktake resultsheet entries grouped by date/time
const getResultsheetList = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Get all resultsheet entries grouped by date and time
        // Group by date and created_at timestamp to get unique save sessions
        const query = client_1.Prisma.sql `
      SELECT 
        date,
        DATE_TRUNC('hour', created_at) as time_group,
        COUNT(*) as entry_count,
        SUM(weight) as total_weight,
        MIN(created_at) as first_created_at,
        MAX(created_at) as last_created_at
      FROM stocktake_resultsheet
      GROUP BY date, DATE_TRUNC('hour', created_at)
      ORDER BY date DESC, first_created_at DESC
    `;
        const entries = await prisma.$queryRaw(query);
        // Format the response
        const grouped = entries.map((entry) => {
            const timeGroup = entry.time_group ? new Date(entry.time_group).toISOString() : null;
            const timeStr = timeGroup ? new Date(timeGroup).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            }) : "";
            return {
                date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : null,
                time: timeStr,
                entryCount: parseInt(entry.entry_count?.toString() || "0"),
                totalWeight: parseFloat(entry.total_weight?.toString() || "0"),
                createdAt: entry.first_created_at ? new Date(entry.first_created_at).toISOString() : null,
            };
        });
        res.json({
            success: true,
            entries: grouped,
        });
    }
    catch (error) {
        console.error("Get resultsheet list error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.getResultsheetList = getResultsheetList;
// Get stocktake resultsheet data for a specific date/time (transformed for table view)
const getResultsheetData = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { date } = req.params;
        if (!date) {
            return res.status(400).json({ error: "Date parameter is required" });
        }
        // Parse date (format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: "Invalid date format" });
        }
        // Get all resultsheet entries for this date (including stock_type)
        const query = client_1.Prisma.sql `
      SELECT
        item_name,
        item_type,
        "group",
        subgroup,
        warehouse,
        floor_name,
        COALESCE(stock_type, 'Fresh Stock') as stock_type,
        weight,
        quantity,
        uom,
        date,
        created_at
      FROM stocktake_resultsheet
      WHERE date = ${date}::date
      ORDER BY stock_type ASC, item_name, warehouse, floor_name
    `;
        const entries = await prisma.$queryRaw(query);
        if (entries.length === 0) {
            return res.json({
                success: true,
                date,
                freshStock: { items: [], warehouses: [], data: {} },
                rejection: { items: [], warehouses: [], data: {} },
                items: [],
                warehouses: [],
                data: {},
            });
        }
        // Separate entries by stock type
        const freshStockEntries = entries.filter((e) => !e.stock_type || e.stock_type === "Fresh Stock");
        const rejectionEntries = entries.filter((e) => e.stock_type === "Off Grade/Rejection" || e.stock_type === "Rejection");
        // Helper function to process entries into table format
        // NOTE: Same items (same name, group, subgroup) are aggregated regardless of item_type
        const processEntries = (entryList) => {
            const itemsMap = new Map();
            const warehousesSet = new Set();
            const floorsByWarehouse = new Map();
            entryList.forEach((entry) => {
                // DO NOT include item_type in the key - same items are combined regardless of item_type
                const itemKey = `${entry.item_name?.toUpperCase() || ""}_${(entry.group || "").toUpperCase()}_${(entry.subgroup || "").toUpperCase()}`;
                if (!itemsMap.has(itemKey)) {
                    itemsMap.set(itemKey, {
                        item_name: entry.item_name,
                        item_type: entry.item_type?.toString().trim() || "",
                        group: entry.group || "",
                        subgroup: entry.subgroup || "",
                        stock_type: entry.stock_type || "Fresh Stock",
                    });
                }
                else if (entry.item_type && !itemsMap.get(itemKey)?.item_type) {
                    // If current entry has item_type and existing doesn't, update it
                    const existing = itemsMap.get(itemKey);
                    existing.item_type = entry.item_type?.toString().trim() || "";
                }
                const warehouse = entry.warehouse?.toUpperCase() || "";
                const floorName = entry.floor_name?.toUpperCase() || "";
                warehousesSet.add(warehouse);
                if (!floorsByWarehouse.has(warehouse)) {
                    floorsByWarehouse.set(warehouse, new Set());
                }
                floorsByWarehouse.get(warehouse)?.add(floorName);
            });
            const data = {};
            entryList.forEach((entry) => {
                // Use same key as itemsMap (without item_type) to ensure data matches items
                const itemKey = `${entry.item_name?.toUpperCase() || ""}_${(entry.group || "").toUpperCase()}_${(entry.subgroup || "").toUpperCase()}`;
                const warehouse = entry.warehouse?.toUpperCase() || "";
                const floorName = entry.floor_name?.toUpperCase() || "";
                const weight = parseFloat(entry.weight?.toString() || "0");
                const quantity = parseFloat(entry.quantity?.toString() || "0");
                const uom = parseFloat(entry.uom?.toString() || "0");
                if (!data[itemKey]) {
                    data[itemKey] = {};
                }
                if (!data[itemKey][warehouse]) {
                    data[itemKey][warehouse] = {};
                }
                // Sum up weights and quantities for same item/warehouse/floor
                if (!data[itemKey][warehouse][floorName]) {
                    data[itemKey][warehouse][floorName] = { weight: 0, quantity: 0, uom };
                }
                data[itemKey][warehouse][floorName].weight += weight;
                data[itemKey][warehouse][floorName].quantity += quantity;
                if (uom > 0 && data[itemKey][warehouse][floorName].uom === 0) {
                    data[itemKey][warehouse][floorName].uom = uom;
                }
            });
            const items = Array.from(itemsMap.values()).sort((a, b) => a.item_name.localeCompare(b.item_name));
            const warehouses = Array.from(warehousesSet).sort();
            const warehouseStructure = warehouses.map(warehouse => ({
                name: warehouse,
                floors: Array.from(floorsByWarehouse.get(warehouse) || []).sort(),
            }));
            return { items, warehouses: warehouseStructure, data };
        };
        // Process Fresh Stock and Rejection separately
        const freshStockData = processEntries(freshStockEntries);
        const rejectionData = processEntries(rejectionEntries);
        // Also process combined data for backwards compatibility
        const combinedData = processEntries(entries);
        res.json({
            success: true,
            date,
            // Separated data for new feature
            freshStock: freshStockData,
            rejection: rejectionData,
            // Combined data for backwards compatibility
            items: combinedData.items,
            warehouses: combinedData.warehouses,
            data: combinedData.data,
        });
    }
    catch (error) {
        console.error("Get resultsheet data error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.getResultsheetData = getResultsheetData;
// Search item descriptions from all_sku table
const searchItemDescriptions = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { itemType } = req.params;
        const { query } = req.query;
        if (!itemType || !query) {
            return res.status(400).json({ error: "itemType and query parameters are required" });
        }
        if (!["pm", "rm", "fg"].includes(itemType.toLowerCase())) {
            return res.status(400).json({ error: "Invalid item type. Must be PM, RM, or FG" });
        }
        const itemTypeValue = itemType.toLowerCase();
        const searchQuery = query.trim();
        if (searchQuery.length < 2) {
            return res.json({ success: true, results: [] });
        }
        const sanitizedQuery = searchQuery.replace(/[%_\\]/g, "\\$&");
        const searchPattern = `%${sanitizedQuery}%`;
        const data = await prisma.$queryRaw(client_1.Prisma.sql `
      SELECT DISTINCT
        item_group,
        sub_group,
        particulars,
        uom,
        LOWER(TRIM(CAST(particulars AS VARCHAR))) as particulars_lower
      FROM all_sku
      WHERE LOWER(item_type) = LOWER(${itemTypeValue})
        AND LOWER(TRIM(CAST(particulars AS VARCHAR))) LIKE LOWER(${searchPattern})
        AND item_group IS NOT NULL
        AND TRIM(CAST(item_group AS VARCHAR)) != ''
      ORDER BY particulars_lower
      LIMIT 50
    `);
        const results = data.map((row) => {
            const group = (row.item_group || "").toString().trim().toUpperCase();
            const subgroup = (row.sub_group || "").toString().trim().toUpperCase();
            const particulars = (row.particulars || "").toString().trim().toUpperCase();
            const uom = row.uom;
            let uomValue = null;
            if (uom !== null && uom !== undefined && uom !== '') {
                const parsedUom = parseFloat(uom.toString());
                if (!isNaN(parsedUom)) {
                    uomValue = parsedUom;
                }
            }
            return { group, subgroup, particulars, uom: uomValue };
        }).filter((item) => item.group && item.subgroup && item.particulars);
        res.json({
            success: true,
            results,
            count: results.length,
        });
    }
    catch (error) {
        console.error("Search item descriptions error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.searchItemDescriptions = searchItemDescriptions;
// Delete stocktake resultsheet entries for a specific date
const deleteResultsheet = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Only allow superuser to delete resultsheets
        if (req.user.role !== "SUPERUSER") {
            return res.status(403).json({ error: "Only superuser can delete resultsheets" });
        }
        const { date } = req.params;
        if (!date) {
            return res.status(400).json({ error: "Date parameter is required" });
        }
        // Parse date (format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ error: "Invalid date format" });
        }
        // Delete all resultsheet entries for this date
        const deleteQuery = client_1.Prisma.sql `
      DELETE FROM stocktake_resultsheet
      WHERE date = ${date}::date
      RETURNING id
    `;
        const deleted = await prisma.$queryRaw(deleteQuery);
        res.json({
            success: true,
            message: "Resultsheet entries deleted successfully",
            deletedCount: deleted.length,
            date,
        });
    }
    catch (error) {
        console.error("Delete resultsheet error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.deleteResultsheet = deleteResultsheet;
// ============ Draft Entry Endpoints ============
// Add a single draft entry (called when user clicks "Add Article")
const addDraftEntry = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const entry = req.body;
        const itemName = (entry.item_name || entry.itemName || entry.description || "UNSPECIFIED").toUpperCase();
        const itemType = (entry.item_type || entry.itemType || "FG").toUpperCase();
        const itemCategory = (entry.item_category || entry.category || entry.itemCategory || "GENERAL").toUpperCase();
        const itemSubcategory = (entry.item_subcategory || entry.subcategory || entry.itemSubcategory || "OTHER").toUpperCase();
        const floorName = (entry.floor_name || entry.floorName || entry.floor || "MAIN").toUpperCase();
        const warehouse = (entry.warehouse || "MAIN").toUpperCase();
        const totalQuantity = parseFloat(entry.total_quantity || entry.units || entry.totalQuantity || "0") || 0;
        const unitUom = parseFloat(entry.unit_uom || entry.packageSize || entry.unitUom || 0) || 0;
        const totalWeight = parseFloat(entry.total_weight || entry.totalWeight || (totalQuantity * unitUom).toFixed(2)) || 0;
        const enteredBy = (entry.entered_by || entry.enteredBy || entry.userName || "UNKNOWN").toUpperCase();
        const enteredByEmail = entry.entered_by_email || entry.enteredByEmail || entry.userEmail || null;
        const authority = (entry.authority || "FLOOR_MANAGER").toUpperCase();
        const stockType = entry.stock_type || entry.stockType || "Fresh Stock";
        const query = client_1.Prisma.sql `
      INSERT INTO stocktake_entries (
        item_name, item_type, item_category, item_subcategory,
        floor_name, warehouse, total_quantity, unit_uom, total_weight,
        entered_by, entered_by_email, authority, stock_type, status, created_at, updated_at
      ) VALUES (${itemName}, ${itemType}, ${itemCategory}, ${itemSubcategory},
        ${floorName}, ${warehouse}, ${totalQuantity}, ${unitUom}, ${totalWeight},
        ${enteredBy}, ${enteredByEmail}, ${authority}, ${stockType}, 'draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, item_name, item_type, item_category, item_subcategory, floor_name, warehouse,
                total_quantity, unit_uom, total_weight, entered_by, entered_by_email, authority,
                stock_type, status, entry_id, created_at
    `;
        const inserted = await prisma.$queryRaw(query);
        const row = inserted[0];
        res.json({
            success: true,
            entry: {
                id: row.id,
                entryId: row.entry_id || null,
                itemName: row.item_name,
                itemType: row.item_type,
                itemCategory: row.item_category,
                itemSubcategory: row.item_subcategory,
                floorName: row.floor_name,
                warehouse: row.warehouse,
                totalQuantity: parseFloat(row.total_quantity?.toString() || "0"),
                unitUom: parseFloat(row.unit_uom?.toString() || "0"),
                totalWeight: parseFloat(row.total_weight?.toString() || "0"),
                enteredBy: row.entered_by,
                enteredByEmail: row.entered_by_email,
                authority: row.authority,
                stockType: row.stock_type,
                status: row.status,
                createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
            },
        });
    }
    catch (error) {
        console.error("Add draft entry error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.addDraftEntry = addDraftEntry;
// Get draft entries for a user (filtered by warehouse + floor)
const getDraftEntries = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { warehouse, floorName, enteredBy, enteredByEmail } = req.query;
        // Build query - at minimum filter by status='draft'
        let query;
        const emailFilter = enteredByEmail || req.user.email;
        if (warehouse && floorName) {
            query = client_1.Prisma.sql `
        SELECT * FROM stocktake_entries
        WHERE status = 'draft'
          AND UPPER(entered_by_email) = UPPER(${String(emailFilter)})
          AND UPPER(warehouse) = UPPER(${String(warehouse)})
          AND UPPER(floor_name) = UPPER(${String(floorName)})
        ORDER BY created_at ASC
      `;
        }
        else if (emailFilter) {
            query = client_1.Prisma.sql `
        SELECT * FROM stocktake_entries
        WHERE status = 'draft'
          AND UPPER(entered_by_email) = UPPER(${String(emailFilter)})
        ORDER BY created_at ASC
      `;
        }
        else {
            query = client_1.Prisma.sql `
        SELECT * FROM stocktake_entries
        WHERE status = 'draft'
        ORDER BY created_at ASC
      `;
        }
        const entries = await prisma.$queryRaw(query);
        const formattedEntries = entries.map((entry) => ({
            id: entry.id,
            entryId: entry.entry_id || null,
            itemName: entry.item_name,
            itemType: entry.item_type,
            itemCategory: entry.item_category,
            itemSubcategory: entry.item_subcategory,
            floorName: entry.floor_name,
            warehouse: entry.warehouse,
            totalQuantity: parseFloat(entry.total_quantity?.toString() || "0"),
            unitUom: parseFloat(entry.unit_uom?.toString() || "0"),
            totalWeight: parseFloat(entry.total_weight?.toString() || "0"),
            enteredBy: entry.entered_by,
            enteredByEmail: entry.entered_by_email,
            authority: entry.authority,
            stockType: entry.stock_type || "Fresh Stock",
            status: entry.status,
            createdAt: entry.created_at ? new Date(entry.created_at).toISOString() : null,
            updatedAt: entry.updated_at ? new Date(entry.updated_at).toISOString() : null,
        }));
        res.json({
            success: true,
            entries: formattedEntries,
            count: formattedEntries.length,
        });
    }
    catch (error) {
        console.error("Get draft entries error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.getDraftEntries = getDraftEntries;
// Finalize draft entries - change status from 'draft' to 'submitted' and assign entry_id
const finalizeDraftEntries = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { warehouse, floorName, enteredByEmail } = req.body;
        const emailFilter = enteredByEmail || req.user.email;
        if (!warehouse || !floorName) {
            return res.status(400).json({ error: "warehouse and floorName are required" });
        }
        // First, check how many drafts exist
        const countResult = await prisma.$queryRaw(client_1.Prisma.sql `
      SELECT COUNT(*) as cnt FROM stocktake_entries
      WHERE status = 'draft'
        AND UPPER(entered_by_email) = UPPER(${String(emailFilter)})
        AND UPPER(warehouse) = UPPER(${String(warehouse)})
        AND UPPER(floor_name) = UPPER(${String(floorName)})
    `);
        const draftCount = parseInt(countResult[0]?.cnt?.toString() || "0");
        if (draftCount === 0) {
            return res.status(404).json({ error: "No draft entries found to finalize" });
        }
        // Generate batch entry_id
        let batchEntryId;
        try {
            await prisma.$executeRaw `
        CREATE OR REPLACE FUNCTION generate_batch_entry_id()
        RETURNS VARCHAR(8) AS $$
        DECLARE
            year_month VARCHAR(4);
            next_sequence INTEGER;
            new_entry_id VARCHAR(8);
        BEGIN
            year_month := TO_CHAR(CURRENT_DATE, 'YYMM');
            SELECT COALESCE(
                MAX(CAST(RIGHT(entry_id, 4) AS INTEGER)),
                0
            ) + 1
            INTO next_sequence
            FROM stocktake_entries
            WHERE entry_id LIKE year_month || '%' AND entry_id IS NOT NULL;
            new_entry_id := year_month || LPAD(next_sequence::TEXT, 4, '0');
            RETURN new_entry_id;
        END;
        $$ LANGUAGE plpgsql;
      `;
            const entryIdResult = await prisma.$queryRaw `SELECT generate_batch_entry_id() as entry_id`;
            batchEntryId = entryIdResult[0].entry_id;
        }
        catch (error) {
            console.error("Error generating entry_id:", error);
            const now = new Date();
            const year = now.getFullYear().toString().slice(-2);
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const sequence = Math.floor(Math.random() * 9999) + 1;
            batchEntryId = year + month + sequence.toString().padStart(4, '0');
        }
        // Update all matching drafts to submitted with the entry_id
        const updated = await prisma.$queryRaw(client_1.Prisma.sql `
      UPDATE stocktake_entries
      SET status = 'submitted',
          entry_id = ${batchEntryId},
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'draft'
        AND UPPER(entered_by_email) = UPPER(${String(emailFilter)})
        AND UPPER(warehouse) = UPPER(${String(warehouse)})
        AND UPPER(floor_name) = UPPER(${String(floorName)})
      RETURNING id
    `);
        res.json({
            success: true,
            message: `Successfully finalized ${updated.length} entries with entry_id: ${batchEntryId}`,
            count: updated.length,
            entryId: batchEntryId,
            finalizedIds: updated.map((r) => r.id),
        });
    }
    catch (error) {
        console.error("Finalize draft entries error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.finalizeDraftEntries = finalizeDraftEntries;
// ============ Available Entry Dates ============
const getAvailableEntryDates = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const result = await prisma.$queryRaw `
      SELECT DISTINCT created_at
      FROM stocktake_entries
      WHERE (status IS NULL OR status != 'draft')
      ORDER BY created_at DESC
    `;
        const dateCountMap = new Map();
        result.forEach((row) => {
            const d = new Date(row.created_at);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const dateStr = `${yyyy}-${mm}-${dd}`;
            dateCountMap.set(dateStr, (dateCountMap.get(dateStr) || 0) + 1);
        });
        const dates = Array.from(dateCountMap.entries()).map(([date, count]) => ({
            date,
            count,
        }));
        console.log("Available entry dates:", dates);
        res.json({ success: true, dates });
    }
    catch (error) {
        console.error("Get available entry dates error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.getAvailableEntryDates = getAvailableEntryDates;
// ============ Floor Review Records ============
const saveFloorReviewRecords = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { entryIds } = req.body;
        if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
            return res.status(400).json({ error: "entryIds array is required" });
        }
        const numericIds = entryIds
            .map((id) => parseInt(id, 10))
            .filter((id) => !isNaN(id));
        if (numericIds.length === 0) {
            return res.status(400).json({ error: "No valid entry IDs provided" });
        }
        // Use raw SQL to avoid dependency on Prisma Client generated types
        const idList = numericIds.join(',');
        const result = await prisma.$queryRawUnsafe(`UPDATE stocktake_entries SET is_checked = true, updated_at = CURRENT_TIMESTAMP WHERE id IN (${idList}) RETURNING id`);
        console.log(`Floor save: marked ${result.length} entries as checked by ${req.user.email || req.user.name}`);
        res.json({
            success: true,
            message: "Entries marked as checked successfully",
            updatedCount: result.length,
        });
    }
    catch (error) {
        console.error("Save floor review records error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.saveFloorReviewRecords = saveFloorReviewRecords;
const getFloorReviewRecords = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { warehouse, floorName } = req.query;
        if (!warehouse || !floorName) {
            return res.status(400).json({ error: "warehouse and floorName query parameters are required" });
        }
        // Use raw SQL to avoid dependency on Prisma Client generated types
        const records = await prisma.$queryRaw(client_1.Prisma.sql `
      SELECT * FROM stocktake_entries
      WHERE UPPER(warehouse) = UPPER(${String(warehouse)})
        AND UPPER(floor_name) = UPPER(${String(floorName)})
        AND is_checked = true
        AND (status IS NULL OR status != 'draft')
      ORDER BY item_name ASC
    `);
        const formatted = records.map((r) => ({
            id: r.id,
            entryId: r.entry_id,
            itemName: r.item_name,
            itemType: r.item_type,
            itemCategory: r.item_category,
            itemSubcategory: r.item_subcategory,
            floorName: r.floor_name,
            warehouse: r.warehouse,
            totalQuantity: parseFloat(r.total_quantity?.toString() || "0"),
            unitUom: parseFloat(r.unit_uom?.toString() || "0"),
            totalWeight: parseFloat(r.total_weight?.toString() || "0"),
            enteredBy: r.entered_by,
            enteredByEmail: r.entered_by_email,
            authority: r.authority,
            stockType: r.stock_type,
            isChecked: r.is_checked,
            createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        }));
        res.json({
            success: true,
            records: formatted,
            count: formatted.length,
        });
    }
    catch (error) {
        console.error("Get floor review records error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.getFloorReviewRecords = getFloorReviewRecords;
