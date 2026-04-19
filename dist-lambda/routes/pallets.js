"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStockLine = exports.updateStockLine = exports.addStockLine = exports.deletePallet = exports.updatePallet = exports.createPallet = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Create pallet
const createPallet = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { sessionId } = req.params;
        const { locationNote } = req.body;
        const session = await prisma.floorSession.findUnique({
            where: { id: sessionId },
        });
        if (!session)
            return res.status(404).json({ error: "Session not found" });
        if (session.status === "APPROVED") {
            return res.status(400).json({ error: "Cannot edit approved sessions" });
        }
        // Get next pallet number
        const lastPallet = await prisma.pallet.findFirst({
            where: { floorSessionId: sessionId },
            orderBy: { palletNumber: "desc" },
        });
        const nextPalletNumber = (lastPallet?.palletNumber || 0) + 1;
        const pallet = await prisma.pallet.create({
            data: {
                floorSessionId: sessionId,
                palletNumber: nextPalletNumber,
                locationNote,
            },
            include: {
                stockLines: {
                    include: {
                        item: true,
                    },
                },
            },
        });
        res.status(201).json(pallet);
    }
    catch (error) {
        console.error("Create pallet error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.createPallet = createPallet;
// Update pallet location note
const updatePallet = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { palletId } = req.params;
        const { locationNote } = req.body;
        const pallet = await prisma.pallet.findUnique({
            where: { id: palletId },
            include: { floorSession: true },
        });
        if (!pallet)
            return res.status(404).json({ error: "Pallet not found" });
        if (pallet.floorSession.status === "APPROVED") {
            return res.status(400).json({ error: "Cannot edit approved sessions" });
        }
        const updated = await prisma.pallet.update({
            where: { id: palletId },
            data: { locationNote },
            include: {
                stockLines: {
                    include: {
                        item: true,
                    },
                },
            },
        });
        res.json(updated);
    }
    catch (error) {
        console.error("Update pallet error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.updatePallet = updatePallet;
// Delete pallet
const deletePallet = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { palletId } = req.params;
        const pallet = await prisma.pallet.findUnique({
            where: { id: palletId },
            include: { floorSession: true },
        });
        if (!pallet)
            return res.status(404).json({ error: "Pallet not found" });
        if (pallet.floorSession.status === "APPROVED") {
            return res.status(400).json({ error: "Cannot edit approved sessions" });
        }
        await prisma.pallet.delete({
            where: { id: palletId },
        });
        res.json({ message: "Pallet deleted" });
    }
    catch (error) {
        console.error("Delete pallet error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.deletePallet = deletePallet;
// Add stock item to pallet
const addStockLine = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { palletId } = req.params;
        const { itemId, units, measuredKg, remark } = req.body;
        const pallet = await prisma.pallet.findUnique({
            where: { id: palletId },
            include: { floorSession: true },
        });
        if (!pallet)
            return res.status(404).json({ error: "Pallet not found" });
        if (pallet.floorSession.status === "APPROVED") {
            return res.status(400).json({ error: "Cannot edit approved sessions" });
        }
        const item = await prisma.item.findUnique({
            where: { id: itemId },
        });
        if (!item)
            return res.status(404).json({ error: "Item not found" });
        const calculatedKg = units * item.kgPerUnit;
        const stockLine = await prisma.stockLine.create({
            data: {
                palletId,
                itemId,
                units,
                calculatedKg,
                measuredKg: measuredKg || null,
                remark: remark || null,
            },
            include: {
                item: true,
            },
        });
        res.status(201).json(stockLine);
    }
    catch (error) {
        console.error("Add stock line error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.addStockLine = addStockLine;
// Update stock line
const updateStockLine = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { stockLineId } = req.params;
        const { units, measuredKg, remark } = req.body;
        const stockLine = await prisma.stockLine.findUnique({
            where: { id: stockLineId },
            include: {
                pallet: {
                    include: { floorSession: true },
                },
                item: true,
            },
        });
        if (!stockLine)
            return res.status(404).json({ error: "Stock line not found" });
        if (stockLine.pallet.floorSession.status === "APPROVED") {
            return res.status(400).json({ error: "Cannot edit approved sessions" });
        }
        const calculatedKg = units
            ? units * stockLine.item.kgPerUnit
            : stockLine.calculatedKg;
        const updated = await prisma.stockLine.update({
            where: { id: stockLineId },
            data: {
                units: units || stockLine.units,
                calculatedKg,
                measuredKg: measuredKg !== undefined ? measuredKg : stockLine.measuredKg,
                remark: remark !== undefined ? remark : stockLine.remark,
            },
            include: {
                item: true,
            },
        });
        res.json(updated);
    }
    catch (error) {
        console.error("Update stock line error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.updateStockLine = updateStockLine;
// Delete stock line
const deleteStockLine = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const { stockLineId } = req.params;
        const stockLine = await prisma.stockLine.findUnique({
            where: { id: stockLineId },
            include: {
                pallet: {
                    include: { floorSession: true },
                },
            },
        });
        if (!stockLine)
            return res.status(404).json({ error: "Stock line not found" });
        if (stockLine.pallet.floorSession.status === "APPROVED") {
            return res.status(400).json({ error: "Cannot edit approved sessions" });
        }
        // Delete the stock line
        await prisma.stockLine.delete({
            where: { id: stockLineId },
        });
        // Check if pallet is empty, if so delete it too
        const remainingLines = await prisma.stockLine.count({
            where: { palletId: stockLine.palletId },
        });
        if (remainingLines === 0) {
            await prisma.pallet.delete({
                where: { id: stockLine.palletId },
            });
        }
        res.json({ message: "Stock line deleted" });
    }
    catch (error) {
        console.error("Delete stock line error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.deleteStockLine = deleteStockLine;
