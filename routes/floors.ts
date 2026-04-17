import { RequestHandler } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /api/floors
 * Returns distinct floor names the current user has entries in.
 * FLOOR_MANAGER: filtered by their username/email.
 * INVENTORY_MANAGER / SUPERUSER / ADMIN: all floors.
 */
export const getUserFloors: RequestHandler = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const isManager =
      req.user.role === "INVENTORY_MANAGER" ||
      req.user.role === "SUPERUSER" ||
      req.user.role === "ADMIN";

    let rows: any[];
    if (isManager) {
      rows = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT warehouse, floor_name AS "floorName"
        FROM stocktake_entries
        ORDER BY warehouse, floor_name
      `);
    } else {
      rows = await prisma.$queryRawUnsafe(
        `SELECT DISTINCT warehouse, floor_name AS "floorName"
         FROM stocktake_entries
         WHERE entered_by = $1 OR entered_by_email = $2
         ORDER BY warehouse, floor_name`,
        req.user.email,
        req.user.email
      );
    }

    res.json(rows);
  } catch (error: any) {
    console.error("getUserFloors error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/**
 * GET /api/floors/all
 * Returns all distinct warehouse+floorName combinations (managers only).
 */
export const getAllFloors: RequestHandler = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT warehouse, floor_name AS "floorName",
        COUNT(*) AS "entryCount",
        SUM(total_weight) AS "totalWeight"
      FROM stocktake_entries
      GROUP BY warehouse, floor_name
      ORDER BY warehouse, floor_name
    `);

    res.json(
      rows.map((r) => ({
        warehouse: r.warehouse,
        floorName: r.floorName,
        entryCount: Number(r.entryCount),
        totalWeight: parseFloat(r.totalWeight?.toString() || "0"),
      }))
    );
  } catch (error: any) {
    console.error("getAllFloors error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};
