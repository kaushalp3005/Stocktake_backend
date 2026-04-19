import { RequestHandler } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

// Detect bcrypt-hashed strings (used by login for backwards-compat plaintext upgrade)
export function isBcryptHash(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

// Get all manager users (legacy endpoint — kept for backward compatibility)
export const getManagerUsers: RequestHandler = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const query = Prisma.sql`
      SELECT
        id,
        username,
        password,
        warehouse,
        role,
        name,
        email,
        is_active,
        created_at
      FROM stocktake_users
      WHERE LOWER(role) = 'manager' OR role = 'manager' OR role = 'MANAGER'
      ORDER BY username
    `;

    const managers: any[] = await prisma.$queryRaw(query) as any[];

    res.json({
      success: true,
      count: managers.length,
      managers: managers.map((m) => ({
        id: m.id.toString(),
        username: m.username,
        password: m.password,
        warehouse: m.warehouse,
        role: m.role,
        name: m.name,
        email: m.email,
        isActive: m.is_active,
        createdAt: m.created_at,
      })),
    });
  } catch (error: any) {
    console.error("Get manager users error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// ── Manage Users CRUD (FLOOR_MANAGER only) ───────────────────────────

// GET /api/users — list every user in stocktake_users
export const listAllUsers: RequestHandler = async (req, res) => {
  try {
    const rows: any[] = await prisma.$queryRaw(Prisma.sql`
      SELECT id, username, warehouse, role, name, email, is_active, created_at, updated_at
      FROM stocktake_users
      ORDER BY id ASC
    `) as any[];

    res.json({
      success: true,
      count: rows.length,
      users: rows.map((u) => ({
        id: u.id.toString(),
        username: u.username,
        warehouse: u.warehouse,
        role: u.role,
        name: u.name,
        email: u.email,
        isActive: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
    });
  } catch (error: any) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// POST /api/users — create a new user
export const createUser: RequestHandler = async (req, res) => {
  try {
    const { username, password, name, email, warehouse, role, isActive } = req.body || {};

    if (!username || !password || !role) {
      return res.status(400).json({ error: "username, password and role are required" });
    }

    // Reject duplicates up front for a cleaner error than a Postgres unique-violation
    const existing: any[] = await prisma.$queryRaw(Prisma.sql`
      SELECT id FROM stocktake_users WHERE username = ${username} LIMIT 1
    `) as any[];
    if (existing.length > 0) {
      return res.status(409).json({ error: `Username "${username}" already exists` });
    }

    const hashed = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const activeFlag = isActive === undefined ? true : !!isActive;

    const inserted: any[] = await prisma.$queryRaw(Prisma.sql`
      INSERT INTO stocktake_users (username, password, name, email, warehouse, role, is_active, created_at, updated_at)
      VALUES (${username}, ${hashed}, ${name ?? null}, ${email ?? null}, ${warehouse ?? null}, ${role}, ${activeFlag}, NOW(), NOW())
      RETURNING id, username, warehouse, role, name, email, is_active, created_at, updated_at
    `) as any[];

    const u = inserted[0];
    res.status(201).json({
      success: true,
      user: {
        id: u.id.toString(),
        username: u.username,
        warehouse: u.warehouse,
        role: u.role,
        name: u.name,
        email: u.email,
        isActive: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      },
    });
  } catch (error: any) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// PUT /api/users/:id — update fields. Password optional; if provided, hashed.
export const updateUser: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const { username, password, name, email, warehouse, role, isActive } = req.body || {};

    // If username is being changed, ensure it's not taken by another user
    if (username) {
      const conflict: any[] = await prisma.$queryRaw(Prisma.sql`
        SELECT id FROM stocktake_users WHERE username = ${username} AND id <> ${id} LIMIT 1
      `) as any[];
      if (conflict.length > 0) {
        return res.status(409).json({ error: `Username "${username}" already exists` });
      }
    }

    const hashedPassword = password ? await bcrypt.hash(String(password), BCRYPT_ROUNDS) : null;

    // Use COALESCE so undefined/missing fields don't overwrite existing values.
    // Pass NULL for any field not supplied; SQL keeps the previous value.
    const updated: any[] = await prisma.$queryRaw(Prisma.sql`
      UPDATE stocktake_users SET
        username   = COALESCE(${username ?? null}, username),
        password   = COALESCE(${hashedPassword},   password),
        name       = COALESCE(${name ?? null},     name),
        email      = COALESCE(${email ?? null},    email),
        warehouse  = COALESCE(${warehouse ?? null}, warehouse),
        role       = COALESCE(${role ?? null},     role),
        is_active  = COALESCE(${isActive === undefined ? null : !!isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, username, warehouse, role, name, email, is_active, created_at, updated_at
    `) as any[];

    if (updated.length === 0) {
      return res.status(404).json({ error: `User ${id} not found` });
    }

    const u = updated[0];
    res.json({
      success: true,
      user: {
        id: u.id.toString(),
        username: u.username,
        warehouse: u.warehouse,
        role: u.role,
        name: u.name,
        email: u.email,
        isActive: u.is_active,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      },
    });
  } catch (error: any) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

// DELETE /api/users/:id — hard delete
export const deleteUser: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    // Prevent self-delete: a floor manager shouldn't lock themselves out mid-session
    if (req.user && req.user.userId === String(id)) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const deleted: any[] = await prisma.$queryRaw(Prisma.sql`
      DELETE FROM stocktake_users WHERE id = ${id} RETURNING id
    `) as any[];

    if (deleted.length === 0) {
      return res.status(404).json({ error: `User ${id} not found` });
    }

    res.json({ success: true, deletedId: id.toString() });
  } catch (error: any) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};
