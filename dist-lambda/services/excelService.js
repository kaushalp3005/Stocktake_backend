"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAuditExcel = generateAuditExcel;
const exceljs_1 = __importDefault(require("exceljs"));
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
async function generateAuditExcel(options) {
    const { auditId, userId } = options;
    // Get audit with all floor sessions and stock data
    const audit = await prisma.auditSession.findUnique({
        where: { id: auditId },
        include: {
            warehouse: { include: { floors: true } },
            floorSessions: {
                include: {
                    floor: true,
                    pallets: {
                        include: {
                            stockLines: {
                                include: {
                                    item: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!audit)
        throw new Error("Audit not found");
    // Build data structure: item -> floor -> kg
    const itemsMap = new Map();
    const dataMap = new Map();
    // Get all floors for the warehouse
    const floors = await prisma.floor.findMany({
        where: { warehouseId: audit.warehouseId },
        orderBy: { name: "asc" },
    });
    // Initialize floor data
    floors.forEach((floor) => {
        dataMap.set(floor.id, new Map());
    });
    // Get audit with proper includes for stock lines
    const auditWithItems = await prisma.auditSession.findUnique({
        where: { id: auditId },
        include: {
            floorSessions: {
                include: {
                    pallets: {
                        include: {
                            stockLines: {
                                include: {
                                    item: {
                                        include: {
                                            category: true,
                                            subCategory: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!auditWithItems)
        throw new Error("Audit not found");
    // Process sessions and aggregate stock data
    auditWithItems.floorSessions.forEach((session) => {
        const floorId = session.floorId;
        const floorData = dataMap.get(floorId);
        if (floorData) {
            session.pallets.forEach((pallet) => {
                pallet.stockLines.forEach((line) => {
                    // Add item to map
                    itemsMap.set(line.itemId, {
                        id: line.itemId,
                        name: line.item.name,
                        unitName: line.item.unitName,
                        category: line.item.category?.name || "Uncategorized",
                        subCategory: line.item.subCategory?.name,
                    });
                    // Add/sum stock data
                    if (floorData.has(line.itemId)) {
                        const existing = floorData.get(line.itemId);
                        existing.calculated += line.calculatedKg;
                        existing.measured += line.measuredKg || 0;
                    }
                    else {
                        floorData.set(line.itemId, {
                            calculated: line.calculatedKg,
                            measured: line.measuredKg || 0,
                        });
                    }
                });
            });
        }
    });
    // Create workbook
    const workbook = new exceljs_1.default.Workbook();
    const worksheet = workbook.addWorksheet("Stock Report");
    // Header section
    const currentDate = new Date();
    const headerRowStart = 1;
    worksheet.mergeCells(`A${headerRowStart}:E${headerRowStart}`);
    const companyCell = worksheet.getCell(`A${headerRowStart}`);
    companyCell.value = "Company: Candor Foods Pvt. Ltd";
    companyCell.font = { bold: true, size: 14 };
    worksheet.mergeCells(`A${headerRowStart + 1}:E${headerRowStart + 1}`);
    const warehouseCell = worksheet.getCell(`A${headerRowStart + 1}`);
    warehouseCell.value = `Warehouse: ${audit.warehouse.name}`;
    warehouseCell.font = { bold: true };
    worksheet.mergeCells(`A${headerRowStart + 2}:E${headerRowStart + 2}`);
    worksheet.getCell(`A${headerRowStart + 2}`).value = `Audit Date: ${audit.auditDate.toLocaleDateString()}`;
    worksheet.mergeCells(`A${headerRowStart + 3}:E${headerRowStart + 3}`);
    worksheet.getCell(`A${headerRowStart + 3}`).value = `Generated At: ${currentDate.toLocaleString()}`;
    worksheet.mergeCells(`A${headerRowStart + 4}:E${headerRowStart + 4}`);
    worksheet.getCell(`A${headerRowStart + 4}`).value = `Generated By: ${userId}`;
    // Column headers
    const headerRow = headerRowStart + 6;
    worksheet.getCell(`A${headerRow}`).value = "Item Name";
    worksheet.getCell(`B${headerRow}`).value = "Category";
    worksheet.getCell(`C${headerRow}`).value = "Unit";
    worksheet.getCell(`D${headerRow}`).value = "Warehouse Total (KG)";
    // Add floor columns
    let col = 5;
    floors.forEach((floor) => {
        const colLetter = String.fromCharCode(64 + col);
        worksheet.getCell(`${colLetter}${headerRow}`).value = `${floor.name} (KG)`;
        col++;
    });
    // Style header row
    const headerStyle = {
        font: { bold: true, color: { argb: "FFFFFFFF" } },
        fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1F6A2A" },
        },
        alignment: { horizontal: "center", vertical: "middle" },
    };
    for (let i = 1; i < col; i++) {
        const colLetter = String.fromCharCode(64 + i);
        worksheet.getCell(`${colLetter}${headerRow}`).font = headerStyle.font;
        worksheet.getCell(`${colLetter}${headerRow}`).fill = headerStyle.fill;
        worksheet.getCell(`${colLetter}${headerRow}`).alignment = headerStyle.alignment;
    }
    // Freeze header
    worksheet.views = [{ state: "frozen", ySplit: headerRow }];
    // Data rows
    const sortedItems = Array.from(itemsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    let rowNum = headerRow + 1;
    let totalRow = { warehouseTotal: 0 };
    floors.forEach((floor) => {
        totalRow[floor.id] = 0;
    });
    sortedItems.forEach((item) => {
        let warehouseTotal = 0;
        // Write item name
        worksheet.getCell(`A${rowNum}`).value = item.name;
        worksheet.getCell(`B${rowNum}`).value = item.category;
        worksheet.getCell(`C${rowNum}`).value = item.unitName;
        floors.forEach((floor, idx) => {
            const floorData = dataMap.get(floor.id);
            const itemData = floorData?.get(item.id);
            const kg = itemData ? itemData.measured || itemData.calculated : 0;
            const colLetter = String.fromCharCode(68 + idx); // D = 68
            worksheet.getCell(`${colLetter}${rowNum}`).value = kg;
            worksheet.getCell(`${colLetter}${rowNum}`).alignment = { horizontal: "right" };
            warehouseTotal += kg;
            totalRow[floor.id] = (totalRow[floor.id] || 0) + kg;
        });
        worksheet.getCell(`D${rowNum}`).value = warehouseTotal;
        worksheet.getCell(`D${rowNum}`).alignment = { horizontal: "right" };
        totalRow.warehouseTotal += warehouseTotal;
        rowNum++;
    });
    // Total row
    const totalRowNum = rowNum + 1;
    worksheet.getCell(`A${totalRowNum}`).value = "TOTAL";
    worksheet.getCell(`A${totalRowNum}`).font = { bold: true };
    worksheet.getCell(`D${totalRowNum}`).value = totalRow.warehouseTotal;
    worksheet.getCell(`D${totalRowNum}`).font = { bold: true };
    floors.forEach((floor, idx) => {
        const colLetter = String.fromCharCode(68 + idx);
        worksheet.getCell(`${colLetter}${totalRowNum}`).value = totalRow[floor.id] || 0;
        worksheet.getCell(`${colLetter}${totalRowNum}`).font = { bold: true };
    });
    // Set column widths
    worksheet.columns = [
        { width: 25 },
        { width: 20 },
        { width: 12 },
        { width: 18 },
        ...floors.map(() => ({ width: 15 })),
    ];
    // Save file
    const fileName = `audit_${audit.warehouse.name}_${audit.auditDate.toISOString().split("T")[0]}.xlsx`;
    const filePath = path.join(process.cwd(), "exports", fileName);
    // Ensure exports directory exists
    if (!fs.existsSync(path.join(process.cwd(), "exports"))) {
        fs.mkdirSync(path.join(process.cwd(), "exports"), { recursive: true });
    }
    await workbook.xlsx.writeFile(filePath);
    return filePath;
}
