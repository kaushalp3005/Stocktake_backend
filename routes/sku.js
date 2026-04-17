"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSkuUploadStatus = exports.uploadSkuFile = exports.upload = void 0;
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const exceljs_1 = __importDefault(require("exceljs"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const prisma = new client_1.PrismaClient();
// Configure multer for file upload
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = path_1.default.join(__dirname, "../uploads");
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `sku-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    },
});
const fileFilter = (_req, file, cb) => {
    const allowedMimes = [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
    ];
    const allowedExts = [".xlsx", ".xls", ".csv"];
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
        cb(null, true);
    }
    else {
        cb(new Error("Invalid file type. Only Excel (.xlsx, .xls) or CSV files are allowed."));
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
});
// Column mapping from Excel to database (case insensitive)
// Excel column name -> database column name
const COLUMN_MAPPING = {
    "particular": "particulars",
    "particulars": "particulars",
    "group": "group",
    "sub-group": "sub_group",
    "sub_group": "sub_group",
    "subgroup": "sub_group",
    "uom": "uom",
    "fg/rm/pm": "fg_rm_pm",
    "fg_rm_pm": "fg_rm_pm",
    "fgrmpm": "fg_rm_pm",
    "sale group": "sale_group",
    "sale_group": "sale_group",
    "salegroup": "sale_group",
    "for inventory": "inventory_group",
    "for_inventory": "inventory_group",
    "forinventory": "inventory_group",
    "inventory_group": "inventory_group",
    "inventorygroup": "inventory_group",
    "customer": "customer",
    "gst": "gst",
    "g%": "gst",
    "hsn/sac": "hsn_sac",
    "hsn_sac": "hsn_sac",
    "hsnsac": "hsn_sac",
};
// Normalize column name for mapping
function normalizeColumnName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, " ");
}
// Get database column name from Excel column name
function getDbColumnName(excelColumn) {
    const normalized = normalizeColumnName(excelColumn);
    return COLUMN_MAPPING[normalized] || null;
}
// Parse Excel file and extract data from all tables
async function parseExcelFile(filePath) {
    const workbook = new exceljs_1.default.Workbook();
    await workbook.xlsx.readFile(filePath);
    const allRows = [];
    // Process each worksheet (could have CFPL and CDPL tables)
    workbook.eachSheet((worksheet) => {
        console.log(`Processing worksheet: ${worksheet.name}`);
        let headerRow = [];
        let headerRowIndex = -1;
        // Find header row by looking for known column names
        worksheet.eachRow((row, rowNumber) => {
            if (headerRowIndex === -1) {
                const rowValues = row.values;
                // Check if this row contains header columns
                const hasParticulars = rowValues.some((v) => v &&
                    typeof v === "string" &&
                    (normalizeColumnName(v) === "particulars" ||
                        normalizeColumnName(v) === "particular"));
                const hasGroup = rowValues.some((v) => v && typeof v === "string" && normalizeColumnName(v) === "group");
                if (hasParticulars || hasGroup) {
                    headerRowIndex = rowNumber;
                    headerRow = rowValues.map((v) => v ? String(v).trim() : "");
                    console.log(`Found header row at index ${rowNumber}:`, headerRow);
                }
            }
        });
        if (headerRowIndex === -1) {
            console.log(`No header row found in worksheet ${worksheet.name}`);
            return;
        }
        // Map header indices to database columns
        const columnIndexMap = new Map();
        headerRow.forEach((header, index) => {
            if (header) {
                const dbColumn = getDbColumnName(header);
                if (dbColumn) {
                    columnIndexMap.set(index, dbColumn);
                    console.log(`  Column ${index} (${header}) -> ${dbColumn}`);
                }
            }
        });
        // Process data rows (after header)
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber <= headerRowIndex)
                return;
            const rowValues = row.values;
            const parsedRow = {};
            let hasData = false;
            columnIndexMap.forEach((dbColumn, index) => {
                const value = rowValues[index];
                if (value !== undefined && value !== null && value !== "") {
                    hasData = true;
                    if (dbColumn === "uom") {
                        // Parse UOM as number
                        const numValue = typeof value === "number" ? value : parseFloat(String(value));
                        if (!isNaN(numValue)) {
                            parsedRow.uom = numValue;
                        }
                    }
                    else {
                        // Store as string, trimmed and uppercased for consistency
                        const strValue = String(value).trim();
                        parsedRow[dbColumn] = strValue;
                    }
                }
            });
            // Only add rows that have at least particulars or group
            if (hasData && (parsedRow.particulars || parsedRow.group)) {
                allRows.push(parsedRow);
            }
        });
        console.log(`Extracted ${allRows.length} rows from worksheet ${worksheet.name}`);
    });
    return allRows;
}
// Upload and process SKU file
const uploadSkuFile = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Check role - only ADMIN and INVENTORY_MANAGER can upload
        if (!["ADMIN", "INVENTORY_MANAGER", "SUPERUSER"].includes(req.user.role)) {
            return res.status(403).json({
                error: "Only Admin or Inventory Manager can upload SKU data",
            });
        }
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        console.log(`Processing uploaded file: ${req.file.originalname}`);
        const filePath = req.file.path;
        try {
            // Parse Excel file
            const parsedRows = await parseExcelFile(filePath);
            console.log(`Total parsed rows: ${parsedRows.length}`);
            if (parsedRows.length === 0) {
                // Cleanup file
                fs_1.default.unlinkSync(filePath);
                return res.status(400).json({
                    error: "No valid data found in the uploaded file",
                    details: "Ensure the file has header columns like 'Particulars', 'Group', 'Sub-Group', etc.",
                });
            }
            // Get existing records from database for comparison
            // Use a unique key: particulars + fg_rm_pm (case insensitive)
            const existingQuery = client_1.Prisma.sql `
        SELECT
          LOWER(TRIM(CAST("particulars" AS VARCHAR))) as particulars_key,
          LOWER(TRIM(CAST("fg/rm/pm" AS VARCHAR))) as type_key
        FROM categorial_inv
        WHERE "particulars" IS NOT NULL
      `;
            const existingRecords = await prisma.$queryRaw(existingQuery);
            // Create a Set of existing keys for O(1) lookup
            const existingKeys = new Set(existingRecords.map((r) => `${(r.particulars_key || "").toLowerCase()}_${(r.type_key || "").toLowerCase()}`));
            console.log(`Existing records in database: ${existingKeys.size}`);
            // Filter out rows that already exist
            const newRows = parsedRows.filter((row) => {
                const key = `${(row.particulars || "").toLowerCase().trim()}_${(row.fg_rm_pm || "").toLowerCase().trim()}`;
                return !existingKeys.has(key);
            });
            console.log(`New rows to insert: ${newRows.length}`);
            if (newRows.length === 0) {
                // Cleanup file
                fs_1.default.unlinkSync(filePath);
                return res.json({
                    success: true,
                    message: "All items already exist in the database",
                    processedItems: parsedRows.length,
                    insertedItems: 0,
                    skippedItems: parsedRows.length,
                    errors: 0,
                });
            }
            // Insert new records into database
            let insertedCount = 0;
            let errorCount = 0;
            const errors = [];
            for (const row of newRows) {
                try {
                    // Build insert query with available columns
                    // Note: The database column is "fg/rm/pm" with special characters
                    const particulars = (row.particulars || "").toUpperCase().trim();
                    const group = (row.group || "").toUpperCase().trim();
                    const subGroup = (row.sub_group || "").toUpperCase().trim();
                    const fgRmPm = (row.fg_rm_pm || "").toLowerCase().trim();
                    const uom = row.uom || 0;
                    const saleGroup = (row.sale_group || "").toUpperCase().trim();
                    const inventoryGroup = (row.inventory_group || "").toUpperCase().trim();
                    // Skip rows without particulars
                    if (!particulars) {
                        console.log(`Skipping row without particulars`);
                        continue;
                    }
                    // Insert using raw query to handle special column name "fg/rm/pm"
                    await prisma.$executeRaw `
            INSERT INTO categorial_inv (
              "particulars",
              "group",
              "sub_group",
              "fg/rm/pm",
              "uom",
              "sale_group",
              "inventory_group"
            ) VALUES (
              ${particulars},
              ${group || null},
              ${subGroup || null},
              ${fgRmPm || null},
              ${uom},
              ${saleGroup || null},
              ${inventoryGroup || null}
            )
          `;
                    insertedCount++;
                }
                catch (insertError) {
                    errorCount++;
                    const errorMsg = `Error inserting row (${row.particulars}): ${insertError.message}`;
                    console.error(errorMsg);
                    errors.push(errorMsg);
                    // If it's a duplicate key error, don't count as error
                    if (insertError.code === "P2002" || insertError.message?.includes("duplicate")) {
                        errorCount--;
                    }
                }
            }
            // Cleanup uploaded file
            fs_1.default.unlinkSync(filePath);
            console.log(`Upload complete: ${insertedCount} inserted, ${errorCount} errors`);
            res.json({
                success: true,
                message: `SKU data processed successfully`,
                processedItems: parsedRows.length,
                insertedItems: insertedCount,
                skippedItems: parsedRows.length - newRows.length,
                errors: errorCount,
                errorDetails: errors.length > 0 ? errors.slice(0, 10) : undefined, // Show first 10 errors
            });
        }
        catch (parseError) {
            // Cleanup file on error
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
            throw parseError;
        }
    }
    catch (error) {
        console.error("Upload SKU file error:", error);
        res.status(500).json({
            error: "Failed to process SKU file",
            details: error.message,
        });
    }
};
exports.uploadSkuFile = uploadSkuFile;
// Get SKU upload status/history (optional endpoint)
const getSkuUploadStatus = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // Get count of records in categorial_inv
        const countResult = await prisma.$queryRaw `
      SELECT COUNT(*) as count FROM categorial_inv
    `;
        const totalCount = Number(countResult[0]?.count || 0);
        // Get count by type
        const typeCountResult = await prisma.$queryRaw `
      SELECT "fg/rm/pm" as type, COUNT(*) as count
      FROM categorial_inv
      GROUP BY "fg/rm/pm"
    `;
        const typeCounts = typeCountResult.map((r) => ({
            type: r.type || "unknown",
            count: Number(r.count),
        }));
        res.json({
            success: true,
            totalItems: totalCount,
            itemsByType: typeCounts,
        });
    }
    catch (error) {
        console.error("Get SKU status error:", error);
        res.status(500).json({
            error: "Failed to get SKU status",
            details: error.message,
        });
    }
};
exports.getSkuUploadStatus = getSkuUploadStatus;
