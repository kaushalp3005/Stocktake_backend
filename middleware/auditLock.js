"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blockFloorManagerWritesDuringAudit = blockFloorManagerWritesDuringAudit;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * Blocks FLOOR_MANAGER write operations while an audit is IN_PROGRESS for their warehouse.
 *
 * Rationale: "Manager started audit session => floor managers cannot edit/insert/update/delete
 * until audit is ended." Floor managers can enter stock anytime, but when a manager starts
 * an audit (IN_PROGRESS), floor managers for that warehouse are locked from editing.
 */
async function blockFloorManagerWritesDuringAudit(req, res, next) {
    // Only protect authenticated users
    const user = req.user;
    if (!user?.role)
        return next();
    // Only block FLOOR_MANAGER
    if (user.role !== "FLOOR_MANAGER")
        return next();
    // Only block write methods
    const method = req.method.toUpperCase();
    const isWrite = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
    if (!isWrite)
        return next();
    try {
        // Extract warehouse from request (body, params, or query)
        let warehouseId;
        let warehouseName;
        // Try to get warehouse from body
        if (req.body?.warehouseId)
            warehouseId = req.body.warehouseId;
        if (req.body?.warehouse)
            warehouseName = req.body.warehouse;
        // Try to get from params (e.g., /api/warehouses/:warehouseId/...)
        if (!warehouseId && req.params?.warehouseId)
            warehouseId = req.params.warehouseId;
        // For stocktake entries, warehouse might be in body
        if (!warehouseName && req.body?.entries && Array.isArray(req.body.entries) && req.body.entries.length > 0) {
            warehouseName = req.body.entries[0]?.warehouse;
        }
        // If we have warehouse name, look up the warehouse ID
        if (warehouseName && !warehouseId) {
            try {
                const warehouse = await prisma.warehouse.findFirst({
                    where: {
                        name: {
                            equals: warehouseName,
                            mode: "insensitive",
                        },
                    },
                    select: { id: true },
                });
                if (warehouse)
                    warehouseId = warehouse.id;
            }
            catch (error) {
                // Handle case where warehouse table doesn't exist
                console.warn("Warehouse table not found, skipping warehouse lookup:", error.message);
                // Continue without warehouse ID - this allows the operation to proceed
            }
        }
        // If we still don't have warehouseId, try to get it from session/pallet/entry
        if (!warehouseId) {
            // For routes like /api/sessions/:sessionId/pallets, get warehouse from session
            if (req.params?.sessionId) {
                const session = await prisma.floorSession.findUnique({
                    where: { id: req.params.sessionId },
                    select: { audit: { select: { warehouseId: true } } },
                });
                if (session?.audit?.warehouseId) {
                    warehouseId = session.audit.warehouseId;
                }
            }
            // For routes like /api/stocktake-entries/:entryId, get warehouse from entry
            if (!warehouseId && req.params?.entryId) {
                try {
                    const entry = await prisma.stockTakeEntry.findUnique({
                        where: { id: parseInt(req.params.entryId) },
                        select: { warehouse: true },
                    });
                    if (entry?.warehouse) {
                        const warehouse = await prisma.warehouse.findFirst({
                            where: {
                                name: {
                                    equals: entry.warehouse,
                                    mode: "insensitive",
                                },
                            },
                            select: { id: true },
                        });
                        if (warehouse)
                            warehouseId = warehouse.id;
                    }
                }
                catch (e) {
                    // entryId might not be a number, or entry doesn't exist - continue
                    console.warn("Could not find entry for audit lock check:", req.params.entryId);
                }
            }
        }
        // If we still don't have warehouseId, we can't check - allow the request
        // (fail open to avoid blocking legitimate requests)
        if (!warehouseId) {
            console.warn("Audit lock: Could not determine warehouse from request", {
                path: req.path,
                method: req.method,
                body: req.body,
                params: req.params,
            });
            return next();
        }
        // Check if there's an IN_PROGRESS audit for this warehouse
        const activeAudit = await prisma.auditSession.findFirst({
            where: {
                warehouseId,
                status: "IN_PROGRESS",
            },
            select: { id: true, warehouseId: true, auditDate: true },
        });
        if (!activeAudit)
            return next();
        return res.status(423).json({
            error: "AUDIT_IN_PROGRESS",
            message: "An audit session is in progress for this warehouse. Floor managers cannot edit, insert, or update stock entries until the audit is completed.",
            auditId: activeAudit.id,
            warehouseId: activeAudit.warehouseId,
        });
    }
    catch (e) {
        // Fail open to avoid locking the system if DB has issues.
        console.error("Audit lock middleware error:", e);
        return next();
    }
}
