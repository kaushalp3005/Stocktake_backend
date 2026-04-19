"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
exports.createServer = createServer;
require("dotenv/config");
// Construct DATABASE_URL from individual DB variables if DATABASE_URL doesn't exist
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
    const dbUser = process.env.DB_USER || process.env.DB_USERNAME || "postgres";
    const dbPassword = process.env.DB_PASSWORD || "";
    const dbHost = process.env.DB_HOST;
    const dbPort = process.env.DB_PORT || "5432";
    const dbName = process.env.DB_NAME || process.env.DB_DATABASE || "postgres";
    const dbSchema = process.env.DB_SCHEMA || "public";
    // Construct PostgreSQL connection string
    process.env.DATABASE_URL = `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}?schema=${dbSchema}`;
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_js_1 = require("./middleware/auth.js");
const auditLock_js_1 = require("./middleware/auditLock.js");
const auth_js_2 = require("./routes/auth.js");
const warehouses_js_1 = require("./routes/warehouses.js");
const audits_js_1 = require("./routes/audits.js");
const pallets_js_1 = require("./routes/pallets.js");
const items_js_1 = require("./routes/items.js");
const floors_js_1 = require("./routes/floors.js");
const exports_js_1 = require("./routes/exports.js");
const users_js_1 = require("./routes/users.js");
const sku_js_1 = require("./routes/sku.js");
const boxes_js_1 = require("./routes/boxes.js");
function createServer() {
    const app = (0, express_1.default)();
    // Request logging middleware (development only)
    if (process.env.NODE_ENV === "development") {
        app.use((req, res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            if (req.body && Object.keys(req.body).length > 0) {
                console.log("Request body:", JSON.stringify(req.body).substring(0, 200));
            }
            next();
        });
    }
    // CORS middleware - MUST be first and handle ALL requests including OPTIONS
    // This is critical for AWS Lambda + API Gateway
    app.use((req, res, next) => {
        // Set CORS headers on EVERY response
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Api-Key, X-Amz-Date, X-Amz-Security-Token');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        // Handle OPTIONS preflight requests IMMEDIATELY - don't let them go further
        if (req.method === 'OPTIONS') {
            console.log(`✅ CORS preflight handled for: ${req.path}`);
            res.status(200).end();
            return;
        }
        next();
    });
    // Simple CORS - allow all origins for Lambda compatibility
    app.use((0, cors_1.default)({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Api-Key', 'X-Amz-Date', 'X-Amz-Security-Token'],
        credentials: false, // Must be false when origin is *
        optionsSuccessStatus: 200
    }));
    app.use(express_1.default.json({ limit: "50mb" }));
    app.use(express_1.default.urlencoded({ extended: true, limit: "50mb" }));
    // Health check
    app.get("/api/ping", (_req, res) => {
        res.json({ message: "pong" });
    });
    // CORS test endpoint
    app.get("/api/cors-test", (_req, res) => {
        res.json({
            message: "CORS test successful",
            timestamp: new Date().toISOString()
        });
    });
    // ============ Auth Routes (public) ============
    app.post("/api/auth/login", auth_js_2.login);
    app.post("/api/auth/register", auth_js_2.register);
    app.get("/api/auth/me", auth_js_1.authMiddleware, auth_js_2.me);
    // ============ Floor Routes ============
    app.get("/api/floors", auth_js_1.authMiddleware, floors_js_1.getUserFloors);
    app.get("/api/floors/all", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), floors_js_1.getAllFloors);
    // ============ Warehouse Routes ============
    app.get("/api/warehouses", auth_js_1.authMiddleware, warehouses_js_1.getUserWarehouses);
    app.get("/api/warehouses/:warehouseId", auth_js_1.authMiddleware, warehouses_js_1.getWarehouse);
    app.get("/api/warehouses/:warehouseId/floors", auth_js_1.authMiddleware, warehouses_js_1.getWarehouseFloors);
    app.post("/api/warehouses", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("ADMIN"), warehouses_js_1.createWarehouse);
    // ============ Audit Routes ============
    app.post("/api/audits/start", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "ADMIN"), audits_js_1.startAudit);
    app.get("/api/audits/:auditId", auth_js_1.authMiddleware, audits_js_1.getAudit);
    app.get("/api/warehouses/:warehouseId/audits", auth_js_1.authMiddleware, audits_js_1.getWarehouseAudits);
    // ============ Floor Session Routes ============
    app.post("/api/audits/:auditId/floors/:floorId/session", auth_js_1.authMiddleware, audits_js_1.getOrCreateFloorSession);
    app.get("/api/sessions/:sessionId", auth_js_1.authMiddleware, audits_js_1.getFloorSession);
    app.post("/api/sessions/:sessionId/submit", auth_js_1.authMiddleware, audits_js_1.submitFloorSession);
    app.post("/api/sessions/:sessionId/approve", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "ADMIN"), audits_js_1.approveFloorSession);
    // ============ Pallet Routes ============
    app.post("/api/sessions/:sessionId/pallets", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, pallets_js_1.createPallet);
    app.patch("/api/pallets/:palletId", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, pallets_js_1.updatePallet);
    app.delete("/api/pallets/:palletId", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, pallets_js_1.deletePallet);
    // ============ Stock Line Routes ============
    app.post("/api/pallets/:palletId/stock", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, pallets_js_1.addStockLine);
    app.patch("/api/stock/:stockLineId", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, pallets_js_1.updateStockLine);
    app.delete("/api/stock/:stockLineId", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, pallets_js_1.deleteStockLine);
    // ============ Item & Category Routes ============
    app.get("/api/categories", auth_js_1.authMiddleware, items_js_1.getCategories);
    app.get("/api/categories/:categoryId/items", auth_js_1.authMiddleware, items_js_1.getItemsByCategory);
    app.get("/api/items", auth_js_1.authMiddleware, items_js_1.getAllItems);
    app.get("/api/items/:itemId", auth_js_1.authMiddleware, items_js_1.getItem);
    app.get("/api/categorial-inv/:itemType/search", auth_js_1.authMiddleware, items_js_1.searchItemDescriptions);
    app.get("/api/categorial-inv/:itemType", auth_js_1.authMiddleware, items_js_1.getCategorialInventory);
    app.post("/api/items", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("ADMIN"), items_js_1.createItem);
    app.post("/api/categories", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("ADMIN"), items_js_1.createCategory);
    app.post("/api/categories/sub-categories", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("ADMIN"), items_js_1.createSubCategory);
    // ============ StockTake Entries Routes ============
    app.post("/api/stocktake-entries/submit", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, items_js_1.submitStocktakeEntries);
    // Draft entry endpoints (must come before parameterized :entryId routes)
    app.post("/api/stocktake-entries/draft", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, items_js_1.addDraftEntry);
    app.get("/api/stocktake-entries/drafts", auth_js_1.authMiddleware, items_js_1.getDraftEntries);
    app.post("/api/stocktake-entries/finalize-drafts", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, items_js_1.finalizeDraftEntries);
    app.delete("/api/stocktake-entries/delete-session", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, items_js_1.deleteStocktakeEntriesBySession);
    app.get("/api/stocktake-entries", auth_js_1.authMiddleware, items_js_1.getStocktakeEntries);
    app.get("/api/stocktake-entries/available-dates", auth_js_1.authMiddleware, items_js_1.getAvailableEntryDates);
    app.get("/api/stocktake-entries/grouped", auth_js_1.authMiddleware, items_js_1.getGroupedStocktakeEntries);
    app.get("/api/stocktake-entries/audit-status", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), items_js_1.getAuditSessionStatus);
    app.post("/api/stocktake-entries/save-resultsheet", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), items_js_1.saveStocktakeResultsheet);
    app.delete("/api/stocktake-entries/clear-all", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), items_js_1.clearAllEntries);
    app.delete("/api/stocktake-entries/warehouse/:warehouse", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), items_js_1.clearWarehouseEntries);
    app.delete("/api/stocktake-entries/warehouse/:warehouse/floor/:floor", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), items_js_1.clearFloorEntries);
    // Note: Specific routes (like clear-all) must come before parameterized routes (like :entryId)
    app.put("/api/stocktake-entries/:entryId", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, items_js_1.updateStocktakeEntry);
    app.delete("/api/stocktake-entries/:entryId", auth_js_1.authMiddleware, auditLock_js_1.blockFloorManagerWritesDuringAudit, items_js_1.deleteStocktakeEntry);
    // ============ Stocktake Resultsheet Routes ============
    app.get("/api/stocktake-resultsheet/list", auth_js_1.authMiddleware, items_js_1.getResultsheetList);
    app.get("/api/stocktake-resultsheet/merged", auth_js_1.authMiddleware, items_js_1.getResultsheetMultiDate);
    app.get("/api/stocktake-resultsheet/:date", auth_js_1.authMiddleware, items_js_1.getResultsheetData);
    app.delete("/api/stocktake-resultsheet/:date", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), items_js_1.deleteResultsheet);
    // ============ Floor Review Records Routes ============
    app.post("/api/floor-review-records", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), items_js_1.saveFloorReviewRecords);
    app.get("/api/floor-review-records", auth_js_1.authMiddleware, items_js_1.getFloorReviewRecords);
    // ============ Users Routes ============
    app.get("/api/users/managers", auth_js_1.authMiddleware, users_js_1.getManagerUsers);
    // Manage Users CRUD — FLOOR_MANAGER, ADMIN, SUPERUSER
    app.get("/api/users", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("FLOOR_MANAGER", "ADMIN", "SUPERUSER"), users_js_1.listAllUsers);
    app.post("/api/users", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("FLOOR_MANAGER", "ADMIN", "SUPERUSER"), users_js_1.createUser);
    app.put("/api/users/:id", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("FLOOR_MANAGER", "ADMIN", "SUPERUSER"), users_js_1.updateUser);
    app.delete("/api/users/:id", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("FLOOR_MANAGER", "ADMIN", "SUPERUSER"), users_js_1.deleteUser);
    // Box QR-code lookup (CDPL / CFPL boxes → article details for StockTake)
    app.get("/api/boxes/lookup", auth_js_1.authMiddleware, boxes_js_1.lookupBox);
    // ============ Export Routes ============
    app.post("/api/export/generate", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), exports_js_1.generateExport);
    app.post("/api/export/stocktake-entries", auth_js_1.authMiddleware, exports_js_1.exportStocktakeEntries);
    app.get("/api/exports", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("ADMIN"), exports_js_1.getExports);
    // ============ SKU Upload Routes ============
    app.post("/api/sku/upload", auth_js_1.authMiddleware, (0, auth_js_1.requireRole)("INVENTORY_MANAGER", "ADMIN", "SUPERUSER"), sku_js_1.upload.single("skuFile"), sku_js_1.uploadSkuFile);
    app.get("/api/sku/status", auth_js_1.authMiddleware, sku_js_1.getSkuUploadStatus);
    // 404 handler for unmatched API routes (must be after all route definitions)
    // This will only run if no route matched above
    app.use((req, res) => {
        if (req.path.startsWith("/api/")) {
            res.status(404).json({ error: "API endpoint not found", path: req.path });
        }
        else {
            res.status(404).json({ error: "Not found" });
        }
    });
    // Global error handler - must be last
    app.use((err, req, res, next) => {
        console.error("Unhandled error:", err);
        if (!res.headersSent) {
            res.status(err.status || 500).json({
                error: err.message || "Internal server error",
                ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
            });
        }
    });
    return app;
}
// For Lambda deployment
const serverless = require("serverless-http");
const app = createServer();
exports.handler = serverless(app);
