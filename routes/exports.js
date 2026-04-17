"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExports = exports.exportStocktakeEntries = exports.generateExport = void 0;
const client_1 = require("@prisma/client");
const excelService_js_1 = require("../services/excelService.js");
const exceljs_1 = __importDefault(require("exceljs"));
const prisma = new client_1.PrismaClient();
// Generate and download audit Excel export
const generateExport = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (req.user.role !== "ADMIN" && req.user.role !== "INVENTORY_MANAGER") {
            return res
                .status(403)
                .json({ error: "Only admins and inventory managers can export" });
        }
        const { auditId } = req.body;
        if (!auditId) {
            return res.status(400).json({ error: "Audit ID is required" });
        }
        // Generate Excel file
        const filePath = await (0, excelService_js_1.generateAuditExcel)({
            auditId,
            userId: req.user.userId,
        });
        // Save export record to database
        const fileName = `audit_${auditId}_${new Date().toISOString().split("T")[0]}.xlsx`;
        await prisma.exportFile.create({
            data: {
                auditId,
                fileName,
                filePath,
                generatedBy: req.user.userId,
            },
        });
        // Send file
        res.download(filePath, fileName, (err) => {
            if (err) {
                console.error("Download error:", err);
            }
        });
    }
    catch (error) {
        console.error("Generate export error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.generateExport = generateExport;
// Export stocktake entries to Excel
const exportStocktakeEntries = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { warehouse, floorName, startDate, endDate, enteredBy } = req.body;
        // Build query conditions
        let whereClause = "WHERE 1=1";
        const queryParams = [];
        let paramIndex = 1;
        if (warehouse) {
            whereClause += ` AND UPPER(warehouse) = UPPER($${paramIndex})`;
            queryParams.push(warehouse);
            paramIndex++;
        }
        if (floorName) {
            whereClause += ` AND UPPER(floor_name) = UPPER($${paramIndex})`;
            queryParams.push(floorName);
            paramIndex++;
        }
        if (enteredBy) {
            whereClause += ` AND UPPER(entered_by) = UPPER($${paramIndex})`;
            queryParams.push(enteredBy);
            paramIndex++;
        }
        if (startDate) {
            whereClause += ` AND created_at >= $${paramIndex}::timestamp`;
            queryParams.push(startDate);
            paramIndex++;
        }
        if (endDate) {
            whereClause += ` AND created_at <= $${paramIndex}::timestamp`;
            queryParams.push(endDate + " 23:59:59");
            paramIndex++;
        }
        // Get stocktake entries with raw SQL for better control
        const query = `
      SELECT
        id,
        item_name,
        item_type,
        item_category,
        item_subcategory,
        floor_name,
        warehouse,
        total_quantity,
        unit_uom,
        total_weight,
        entered_by,
        entered_by_email,
        authority,
        stock_type,
        created_at,
        updated_at
      FROM stocktake_entries
      ${whereClause}
      ORDER BY stock_type ASC, created_at DESC, warehouse, floor_name, item_name
    `;
        const entries = await prisma.$queryRawUnsafe(query, ...queryParams);
        if (entries.length === 0) {
            return res.status(404).json({
                error: "No entries found",
                message: "No stocktake entries match the specified criteria"
            });
        }
        // Separate entries by stock type
        const freshStockEntries = entries.filter((e) => !e.stock_type || e.stock_type === "Fresh Stock");
        const rejectionEntries = entries.filter((e) => e.stock_type === "Off Grade/Rejection" || e.stock_type === "Rejection");
        // Create Excel workbook
        const workbook = new exceljs_1.default.Workbook();
        // Helper function to create and populate a worksheet
        const createWorksheet = (name, data, headerColor) => {
            const worksheet = workbook.addWorksheet(name);
            worksheet.properties.defaultRowHeight = 18;
            // Add header
            const headerRow = worksheet.addRow([
                "Entry ID",
                "Item Name",
                "Item Type",
                "Category",
                "Subcategory",
                "Floor Name",
                "Warehouse",
                "Quantity (Units)",
                "Unit Weight (kg)",
                "Total Weight (kg)",
                "Entered By",
                "Email",
                "Authority",
                "Stock Type",
                "Created At",
                "Updated At"
            ]);
            // Style header
            headerRow.eachCell((cell, colNumber) => {
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: headerColor }
                };
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" }
                };
                cell.alignment = { horizontal: "center", vertical: "middle" };
            });
            // Add data rows
            data.forEach((entry) => {
                const dataRow = worksheet.addRow([
                    entry.id,
                    entry.item_name,
                    entry.item_type,
                    entry.item_category,
                    entry.item_subcategory,
                    entry.floor_name,
                    entry.warehouse,
                    parseFloat(entry.total_quantity?.toString() || "0"),
                    parseFloat(entry.unit_uom?.toString() || "0"),
                    parseFloat(entry.total_weight?.toString() || "0"),
                    entry.entered_by,
                    entry.entered_by_email,
                    entry.authority,
                    entry.stock_type || "Fresh Stock",
                    entry.created_at ? new Date(entry.created_at).toLocaleString() : "",
                    entry.updated_at ? new Date(entry.updated_at).toLocaleString() : ""
                ]);
                // Style data rows
                dataRow.eachCell((cell) => {
                    cell.border = {
                        top: { style: "thin" },
                        left: { style: "thin" },
                        bottom: { style: "thin" },
                        right: { style: "thin" }
                    };
                    cell.alignment = { vertical: "middle" };
                });
            });
            // Auto-fit columns
            worksheet.columns = [
                { width: 10 }, // Entry ID
                { width: 30 }, // Item Name
                { width: 12 }, // Item Type
                { width: 20 }, // Category
                { width: 20 }, // Subcategory
                { width: 15 }, // Floor Name
                { width: 15 }, // Warehouse
                { width: 15 }, // Quantity
                { width: 15 }, // Unit Weight
                { width: 15 }, // Total Weight
                { width: 15 }, // Entered By
                { width: 25 }, // Email
                { width: 15 }, // Authority
                { width: 18 }, // Stock Type
                { width: 20 }, // Created At
                { width: 20 } // Updated At
            ];
            // Add summary footer
            const totalWeight = data.reduce((sum, entry) => sum + parseFloat(entry.total_weight?.toString() || "0"), 0);
            const totalQuantity = data.reduce((sum, entry) => sum + parseFloat(entry.total_quantity?.toString() || "0"), 0);
            worksheet.addRow([]);
            const summaryRow = worksheet.addRow([
                "TOTAL:",
                "",
                "",
                "",
                "",
                "",
                `${data.length} entries`,
                totalQuantity,
                "",
                totalWeight,
                "",
                "",
                "",
                "",
                "",
                ""
            ]);
            summaryRow.eachCell((cell, colNumber) => {
                cell.font = { bold: true };
                if (colNumber === 1 || colNumber === 7 || colNumber === 8 || colNumber === 10) {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFEEEEEE" }
                    };
                }
            });
            return worksheet;
        };
        // Create Fresh Stock worksheet (green header)
        if (freshStockEntries.length > 0) {
            createWorksheet("Fresh Stock", freshStockEntries, "FF228B22"); // Forest green
        }
        // Create Rejection worksheet (red header)
        if (rejectionEntries.length > 0) {
            createWorksheet("Rejection", rejectionEntries, "FFB22222"); // Firebrick red
        }
        // Create Summary worksheet
        const summaryWorksheet = workbook.addWorksheet("Summary");
        summaryWorksheet.properties.defaultRowHeight = 20;
        // Summary header
        const summaryHeader = summaryWorksheet.addRow(["Stock Type Summary"]);
        summaryHeader.font = { bold: true, size: 14 };
        summaryWorksheet.addRow([]);
        // Summary table header
        const tableHeader = summaryWorksheet.addRow(["Stock Type", "Entries", "Total Quantity", "Total Weight (kg)"]);
        tableHeader.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF366092" }
            };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };
            cell.alignment = { horizontal: "center", vertical: "middle" };
        });
        // Fresh stock row
        const freshTotalWeight = freshStockEntries.reduce((sum, e) => sum + parseFloat(e.total_weight?.toString() || "0"), 0);
        const freshTotalQty = freshStockEntries.reduce((sum, e) => sum + parseFloat(e.total_quantity?.toString() || "0"), 0);
        const freshRow = summaryWorksheet.addRow(["Fresh Stock", freshStockEntries.length, freshTotalQty, freshTotalWeight.toFixed(2)]);
        freshRow.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };
            if (colNumber === 1) {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFE8F5E9" } // Light green
                };
            }
        });
        // Rejection row
        const rejTotalWeight = rejectionEntries.reduce((sum, e) => sum + parseFloat(e.total_weight?.toString() || "0"), 0);
        const rejTotalQty = rejectionEntries.reduce((sum, e) => sum + parseFloat(e.total_quantity?.toString() || "0"), 0);
        const rejRow = summaryWorksheet.addRow(["Rejection", rejectionEntries.length, rejTotalQty, rejTotalWeight.toFixed(2)]);
        rejRow.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };
            if (colNumber === 1) {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFFFEBEE" } // Light red
                };
            }
        });
        // Grand total row
        const grandTotalRow = summaryWorksheet.addRow([
            "GRAND TOTAL",
            entries.length,
            freshTotalQty + rejTotalQty,
            (freshTotalWeight + rejTotalWeight).toFixed(2)
        ]);
        grandTotalRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFEEEEEE" }
            };
            cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            };
        });
        summaryWorksheet.columns = [
            { width: 20 },
            { width: 15 },
            { width: 18 },
            { width: 18 }
        ];
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        let filename = `StockTakeEntries_${timestamp.split("T")[0]}`;
        if (warehouse)
            filename += `_${warehouse.replace(/\s+/g, "")}`;
        if (floorName)
            filename += `_${floorName.replace(/\s+/g, "")}`;
        if (enteredBy)
            filename += `_${enteredBy.replace(/\s+/g, "")}`;
        filename += ".xlsx";
        // Set response headers
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error("Export stocktake entries error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message
        });
    }
};
exports.exportStocktakeEntries = exportStocktakeEntries;
// Get export history
const getExports = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (req.user.role !== "ADMIN") {
            return res.status(403).json({ error: "Only admins can view exports" });
        }
        const exports = await prisma.exportFile.findMany({
            include: {
                audit: true,
                user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(exports);
    }
    catch (error) {
        console.error("Get exports error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getExports = getExports;
