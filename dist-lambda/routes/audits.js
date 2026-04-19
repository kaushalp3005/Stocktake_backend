"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveFloorSession = exports.submitFloorSession = exports.getFloorSession = exports.getOrCreateFloorSession = exports.getWarehouseAudits = exports.getAudit = exports.startAudit = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Start new audit (inventory manager only)
const startAudit = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (req.user.role !== "INVENTORY_MANAGER" && req.user.role !== "SUPERUSER" && req.user.role !== "ADMIN") {
            return res
                .status(403)
                .json({ error: "Only managers can start audits" });
        }
        const { warehouseId, warehouseName, auditDate, auditTime } = req.body;
        // Resolve warehouse ID from name if needed
        let resolvedWarehouseId = warehouseId;
        if (!resolvedWarehouseId && warehouseName) {
            const warehouse = await prisma.warehouse.findFirst({
                where: {
                    name: {
                        equals: warehouseName,
                        mode: "insensitive",
                    },
                },
            });
            if (!warehouse) {
                return res.status(404).json({ error: `Warehouse "${warehouseName}" not found` });
            }
            resolvedWarehouseId = warehouse.id;
        }
        if (!resolvedWarehouseId) {
            return res.status(400).json({ error: "warehouseId or warehouseName is required" });
        }
        // Check if audit already exists for this warehouse and date
        const existingAudit = await prisma.auditSession.findUnique({
            where: {
                warehouseId_auditDate: {
                    warehouseId: resolvedWarehouseId,
                    auditDate: new Date(auditDate),
                },
            },
        });
        if (existingAudit) {
            return res
                .status(400)
                .json({ error: "Audit already exists for this date" });
        }
        const auditSession = await prisma.auditSession.create({
            data: {
                warehouseId: resolvedWarehouseId,
                userId: req.user.userId,
                auditDate: new Date(auditDate),
                auditTime: auditTime ? new Date(auditTime) : null,
                status: "IN_PROGRESS",
            },
            include: {
                warehouse: { include: { floors: true } },
                user: { select: { id: true, name: true, email: true } },
            },
        });
        res.status(201).json(auditSession);
    }
    catch (error) {
        console.error("Start audit error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.startAudit = startAudit;
// Get audit session
const getAudit = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { auditId } = req.params;
        const audit = await prisma.auditSession.findUnique({
            where: { id: auditId },
            include: {
                warehouse: { include: { floors: true } },
                user: { select: { id: true, name: true, email: true } },
                floorSessions: {
                    include: {
                        floor: true,
                        user: { select: { id: true, name: true, email: true } },
                        pallets: {
                            include: {
                                stockLines: {
                                    include: { item: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!audit)
            return res.status(404).json({ error: "Audit not found" });
        res.json(audit);
    }
    catch (error) {
        console.error("Get audit error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getAudit = getAudit;
// Get warehouse audits
const getWarehouseAudits = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { warehouseId } = req.params;
        const audits = await prisma.auditSession.findMany({
            where: { warehouseId },
            include: {
                warehouse: true,
                user: { select: { id: true, name: true, email: true } },
                floorSessions: {
                    include: {
                        floor: true,
                        pallets: {
                            include: {
                                stockLines: true,
                            },
                        },
                    },
                },
            },
            orderBy: { auditDate: "desc" },
        });
        res.json(audits);
    }
    catch (error) {
        console.error("Get warehouse audits error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getWarehouseAudits = getWarehouseAudits;
// Get or create floor session for audit
const getOrCreateFloorSession = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { auditId, floorId } = req.params;
        let session = await prisma.floorSession.findUnique({
            where: {
                auditId_floorId: {
                    auditId,
                    floorId,
                },
            },
            include: {
                pallets: {
                    include: {
                        stockLines: {
                            include: { item: true },
                        },
                    },
                },
            },
        });
        if (!session) {
            session = await prisma.floorSession.create({
                data: {
                    auditId,
                    floorId,
                    userId: req.user.userId,
                    status: "DRAFT",
                },
                include: {
                    pallets: {
                        include: {
                            stockLines: {
                                include: { item: true },
                            },
                        },
                    },
                },
            });
        }
        res.json(session);
    }
    catch (error) {
        console.error("Get or create floor session error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getOrCreateFloorSession = getOrCreateFloorSession;
// Get floor session
const getFloorSession = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { sessionId } = req.params;
        const session = await prisma.floorSession.findUnique({
            where: { id: sessionId },
            include: {
                audit: { include: { warehouse: true } },
                floor: true,
                user: { select: { id: true, name: true, email: true } },
                pallets: {
                    include: {
                        stockLines: {
                            include: { item: true },
                        },
                    },
                },
            },
        });
        if (!session)
            return res.status(404).json({ error: "Session not found" });
        res.json(session);
    }
    catch (error) {
        console.error("Get floor session error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getFloorSession = getFloorSession;
// Submit floor session
const submitFloorSession = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { sessionId } = req.params;
        const session = await prisma.floorSession.update({
            where: { id: sessionId },
            data: {
                status: "SUBMITTED",
                submittedAt: new Date(),
            },
            include: {
                pallets: {
                    include: {
                        stockLines: {
                            include: { item: true },
                        },
                    },
                },
            },
        });
        res.json(session);
    }
    catch (error) {
        console.error("Submit floor session error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.submitFloorSession = submitFloorSession;
// Approve and verify floor session
const approveFloorSession = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (req.user.role !== "INVENTORY_MANAGER" && req.user.role !== "SUPERUSER" && req.user.role !== "ADMIN") {
            return res
                .status(403)
                .json({ error: "Only managers can approve sessions" });
        }
        const { sessionId } = req.params;
        const session = await prisma.floorSession.update({
            where: { id: sessionId },
            data: {
                status: "APPROVED",
                isVerified: true,
                approvedAt: new Date(),
                verifiedAt: new Date(),
            },
            include: {
                pallets: {
                    include: {
                        stockLines: {
                            include: { item: true },
                        },
                    },
                },
            },
        });
        res.json(session);
    }
    catch (error) {
        console.error("Approve floor session error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.approveFloorSession = approveFloorSession;
