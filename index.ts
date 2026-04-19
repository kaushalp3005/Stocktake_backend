import "dotenv/config";

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

import express from "express";
import cors from "cors";
import { authMiddleware, requireRole } from "./middleware/auth.js";
import { blockFloorManagerWritesDuringAudit } from "./middleware/auditLock.js";
import { login, register, me } from "./routes/auth.js";
import {
  getUserWarehouses,
  getWarehouse,
  getWarehouseFloors,
  createWarehouse,
} from "./routes/warehouses.js";
import {
  startAudit,
  getAudit,
  getWarehouseAudits,
  getOrCreateFloorSession,
  getFloorSession,
  submitFloorSession,
  approveFloorSession,
} from "./routes/audits.js";
import {
  createPallet,
  updatePallet,
  deletePallet,
  addStockLine,
  updateStockLine,
  deleteStockLine,
} from "./routes/pallets.js";
import {
  getCategories,
  getItemsByCategory,
  getAllItems,
  getItem,
  createItem,
  createCategory,
  createSubCategory,
  getCategorialInventory,
  submitStocktakeEntries,
  getStocktakeEntries,
  getGroupedStocktakeEntries,
  getAvailableEntryDates,
  updateStocktakeEntry,
  deleteStocktakeEntry,
  getAuditSessionStatus,
  saveStocktakeResultsheet,
  clearAllEntries,
  clearWarehouseEntries,
  clearFloorEntries,
  getResultsheetList,
  getResultsheetData,
  getResultsheetMultiDate,
  deleteResultsheet,
  searchItemDescriptions,
  saveFloorReviewRecords,
  getFloorReviewRecords,
  addDraftEntry,
  getDraftEntries,
  finalizeDraftEntries,
  deleteStocktakeEntriesBySession,
} from "./routes/items.js";
import { getUserFloors, getAllFloors } from "./routes/floors.js";
import { generateExport, getExports, exportStocktakeEntries } from "./routes/exports.js";
import {
  getManagerUsers,
  listAllUsers,
  createUser,
  updateUser,
  deleteUser,
} from "./routes/users.js";
import { upload, uploadSkuFile, getSkuUploadStatus } from "./routes/sku.js";
import { lookupBox } from "./routes/boxes.js";

export function createServer() {
  const app = express();

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
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-Api-Key', 'X-Amz-Date', 'X-Amz-Security-Token'],
    credentials: false, // Must be false when origin is *
    optionsSuccessStatus: 200
  }));

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
  app.post("/api/auth/login", login);
  app.post("/api/auth/register", register);
  app.get("/api/auth/me", authMiddleware, me);

  // ============ Floor Routes ============
  app.get("/api/floors", authMiddleware, getUserFloors);
  app.get("/api/floors/all", authMiddleware, requireRole("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), getAllFloors);

  // ============ Warehouse Routes ============
  app.get("/api/warehouses", authMiddleware, getUserWarehouses);
  app.get("/api/warehouses/:warehouseId", authMiddleware, getWarehouse);
  app.get(
    "/api/warehouses/:warehouseId/floors",
    authMiddleware,
    getWarehouseFloors
  );
  app.post(
    "/api/warehouses",
    authMiddleware,
    requireRole("ADMIN"),
    createWarehouse
  );

  // ============ Audit Routes ============
  app.post(
    "/api/audits/start",
    authMiddleware,
    requireRole("INVENTORY_MANAGER", "ADMIN"),
    startAudit
  );
  app.get(
    "/api/audits/:auditId",
    authMiddleware,
    getAudit
  );
  app.get(
    "/api/warehouses/:warehouseId/audits",
    authMiddleware,
    getWarehouseAudits
  );

  // ============ Floor Session Routes ============
  app.post(
    "/api/audits/:auditId/floors/:floorId/session",
    authMiddleware,
    getOrCreateFloorSession
  );
  app.get("/api/sessions/:sessionId", authMiddleware, getFloorSession);
  app.post("/api/sessions/:sessionId/submit", authMiddleware, submitFloorSession);
  app.post(
    "/api/sessions/:sessionId/approve",
    authMiddleware,
    requireRole("INVENTORY_MANAGER", "ADMIN"),
    approveFloorSession
  );

  // ============ Pallet Routes ============
  app.post(
    "/api/sessions/:sessionId/pallets",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    createPallet
  );
  app.patch(
    "/api/pallets/:palletId",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    updatePallet
  );
  app.delete(
    "/api/pallets/:palletId",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    deletePallet
  );

  // ============ Stock Line Routes ============
  app.post(
    "/api/pallets/:palletId/stock",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    addStockLine
  );
  app.patch(
    "/api/stock/:stockLineId",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    updateStockLine
  );
  app.delete(
    "/api/stock/:stockLineId",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    deleteStockLine
  );

  // ============ Item & Category Routes ============
  app.get("/api/categories", authMiddleware, getCategories);
  app.get(
    "/api/categories/:categoryId/items",
    authMiddleware,
    getItemsByCategory
  );
  app.get("/api/items", authMiddleware, getAllItems);
  app.get("/api/items/:itemId", authMiddleware, getItem);
  app.get("/api/categorial-inv/:itemType/search", authMiddleware, searchItemDescriptions);
  app.get("/api/categorial-inv/:itemType", authMiddleware, getCategorialInventory);
  app.post(
    "/api/items",
    authMiddleware,
    requireRole("ADMIN"),
    createItem
  );
  app.post(
    "/api/categories",
    authMiddleware,
    requireRole("ADMIN"),
    createCategory
  );
  app.post(
    "/api/categories/sub-categories",
    authMiddleware,
    requireRole("ADMIN"),
    createSubCategory
  );

  // ============ StockTake Entries Routes ============
  app.post(
    "/api/stocktake-entries/submit",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    submitStocktakeEntries
  );
  // Draft entry endpoints (must come before parameterized :entryId routes)
  app.post(
    "/api/stocktake-entries/draft",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    addDraftEntry
  );
  app.get("/api/stocktake-entries/drafts", authMiddleware, getDraftEntries);
  app.post(
    "/api/stocktake-entries/finalize-drafts",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    finalizeDraftEntries
  );
  app.delete(
    "/api/stocktake-entries/delete-session",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    deleteStocktakeEntriesBySession
  );
  app.get("/api/stocktake-entries", authMiddleware, getStocktakeEntries);
  app.get("/api/stocktake-entries/available-dates", authMiddleware, getAvailableEntryDates);
  app.get("/api/stocktake-entries/grouped", authMiddleware, getGroupedStocktakeEntries);
  app.get("/api/stocktake-entries/audit-status", authMiddleware, requireRole("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), getAuditSessionStatus);
  app.post(
    "/api/stocktake-entries/save-resultsheet",
    authMiddleware,
    requireRole("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"),
    saveStocktakeResultsheet
  );
  app.delete("/api/stocktake-entries/clear-all", authMiddleware, requireRole("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), clearAllEntries);
  app.delete("/api/stocktake-entries/warehouse/:warehouse", authMiddleware, requireRole("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), clearWarehouseEntries);
  app.delete("/api/stocktake-entries/warehouse/:warehouse/floor/:floor", authMiddleware, requireRole("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), clearFloorEntries);
  // Note: Specific routes (like clear-all) must come before parameterized routes (like :entryId)
  app.put(
    "/api/stocktake-entries/:entryId",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    updateStocktakeEntry
  );
  app.delete(
    "/api/stocktake-entries/:entryId",
    authMiddleware,
    blockFloorManagerWritesDuringAudit,
    deleteStocktakeEntry
  );
  
  // ============ Stocktake Resultsheet Routes ============
  app.get("/api/stocktake-resultsheet/list", authMiddleware, getResultsheetList);
  app.get("/api/stocktake-resultsheet/merged", authMiddleware, getResultsheetMultiDate);
  app.get("/api/stocktake-resultsheet/:date", authMiddleware, getResultsheetData);
  app.delete("/api/stocktake-resultsheet/:date", authMiddleware, requireRole("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), deleteResultsheet);

  // ============ Floor Review Records Routes ============
  app.post("/api/floor-review-records", authMiddleware, requireRole("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"), saveFloorReviewRecords);
  app.get("/api/floor-review-records", authMiddleware, getFloorReviewRecords);

  // ============ Users Routes ============
  app.get("/api/users/managers", authMiddleware, getManagerUsers);

  // Manage Users CRUD — FLOOR_MANAGER, ADMIN, SUPERUSER
  app.get("/api/users",        authMiddleware, requireRole("FLOOR_MANAGER", "ADMIN", "SUPERUSER"), listAllUsers);
  app.post("/api/users",       authMiddleware, requireRole("FLOOR_MANAGER", "ADMIN", "SUPERUSER"), createUser);
  app.put("/api/users/:id",    authMiddleware, requireRole("FLOOR_MANAGER", "ADMIN", "SUPERUSER"), updateUser);
  app.delete("/api/users/:id", authMiddleware, requireRole("FLOOR_MANAGER", "ADMIN", "SUPERUSER"), deleteUser);

  // Box QR-code lookup (CDPL / CFPL boxes → article details for StockTake)
  app.get("/api/boxes/lookup", authMiddleware, lookupBox);

  // ============ Export Routes ============
  app.post(
    "/api/export/generate",
    authMiddleware,
    requireRole("INVENTORY_MANAGER", "SUPERUSER", "ADMIN"),
    generateExport
  );
  app.post(
    "/api/export/stocktake-entries",
    authMiddleware,
    exportStocktakeEntries
  );
  app.get(
    "/api/exports",
    authMiddleware,
    requireRole("ADMIN"),
    getExports
  );

  // ============ SKU Upload Routes ============
  app.post(
    "/api/sku/upload",
    authMiddleware,
    requireRole("INVENTORY_MANAGER", "ADMIN", "SUPERUSER"),
    upload.single("skuFile"),
    uploadSkuFile
  );
  app.get(
    "/api/sku/status",
    authMiddleware,
    getSkuUploadStatus
  );

  // 404 handler for unmatched API routes (must be after all route definitions)
  // This will only run if no route matched above
  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "API endpoint not found", path: req.path });
    } else {
      res.status(404).json({ error: "Not found" });
    }
  });

  // Global error handler - must be last
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
export const handler = serverless(app);
