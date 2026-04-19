"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWarehouse = exports.getWarehouseFloors = exports.getWarehouse = exports.getUserWarehouses = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Get user's warehouses
// Uses stocktake_users (the actual auth table) and stocktake_entries for floor data.
const getUserWarehouses = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const isManager = req.user.role === "INVENTORY_MANAGER" ||
            req.user.role === "SUPERUSER" ||
            req.user.role === "ADMIN";
        if (isManager) {
            // Managers see all distinct warehouses that have entries
            const rows = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT warehouse AS name,
          COUNT(DISTINCT floor_name) AS "floorCount"
        FROM stocktake_entries
        GROUP BY warehouse
        ORDER BY warehouse
      `);
            return res.json(rows.map((r) => ({
                id: r.name,
                name: r.name,
                floorCount: Number(r.floorCount),
            })));
        }
        // Floor manager: fetch their assigned warehouse from stocktake_users
        const users = await prisma.$queryRawUnsafe(`SELECT warehouse FROM stocktake_users WHERE id::text = $1 OR email = $2 LIMIT 1`, req.user.userId, req.user.email);
        const assignedWarehouse = users[0]?.warehouse;
        if (!assignedWarehouse)
            return res.json([]);
        res.json([{ id: assignedWarehouse, name: assignedWarehouse }]);
    }
    catch (error) {
        console.error("Get warehouses error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getUserWarehouses = getUserWarehouses;
// Get warehouse with all floors
const getWarehouse = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { warehouseId } = req.params;
        const warehouse = await prisma.warehouse.findUnique({
            where: { id: warehouseId },
            include: {
                floors: {
                    orderBy: { name: "asc" },
                },
            },
        });
        if (!warehouse)
            return res.status(404).json({ error: "Warehouse not found" });
        res.json(warehouse);
    }
    catch (error) {
        console.error("Get warehouse error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getWarehouse = getWarehouse;
// Get warehouse floors
const getWarehouseFloors = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { warehouseId } = req.params;
        const floors = await prisma.floor.findMany({
            where: { warehouseId },
            orderBy: { name: "asc" },
        });
        res.json(floors);
    }
    catch (error) {
        console.error("Get warehouse floors error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getWarehouseFloors = getWarehouseFloors;
// Create warehouse (admin only)
const createWarehouse = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        if (req.user.role !== "ADMIN") {
            return res.status(403).json({ error: "Only admins can create warehouses" });
        }
        const { name, location } = req.body;
        const warehouse = await prisma.warehouse.create({
            data: {
                name,
                location,
            },
            include: {
                floors: true,
            },
        });
        res.status(201).json(warehouse);
    }
    catch (error) {
        console.error("Create warehouse error:", error);
        if (error.code === "P2002") {
            return res.status(400).json({ error: "Warehouse name already exists" });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.createWarehouse = createWarehouse;
