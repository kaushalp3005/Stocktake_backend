"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.createUser = exports.listAllUsers = exports.getManagerUsers = void 0;
exports.isBcryptHash = isBcryptHash;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
const BCRYPT_ROUNDS = 10;
// Detect bcrypt-hashed strings (used by login for backwards-compat plaintext upgrade)
function isBcryptHash(value) {
    if (!value || typeof value !== "string")
        return false;
    return /^\$2[aby]\$\d{2}\$/.test(value);
}
// Get all manager users (legacy endpoint — kept for backward compatibility)
const getManagerUsers = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const query = client_1.Prisma.sql `
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
        const managers = await prisma.$queryRaw(query);
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
    }
    catch (error) {
        console.error("Get manager users error:", error);
        res.status(500).json({
            error: "Internal server error",
            details: error.message,
        });
    }
};
exports.getManagerUsers = getManagerUsers;
// ── Manage Users CRUD (FLOOR_MANAGER only) ───────────────────────────
// GET /api/users — list every user in stocktake_users
const listAllUsers = async (req, res) => {
    try {
        const rows = await prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id, username, warehouse, role, name, email, is_active, created_at, updated_at
      FROM stocktake_users
      ORDER BY id ASC
    `);
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
    }
    catch (error) {
        console.error("List users error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.listAllUsers = listAllUsers;
// POST /api/users — create a new user
const createUser = async (req, res) => {
    try {
        const { username, password, name, email, warehouse, role, isActive } = req.body || {};
        if (!username || !password || !role) {
            return res.status(400).json({ error: "username, password and role are required" });
        }
        // Reject duplicates up front for a cleaner error than a Postgres unique-violation
        const existing = await prisma.$queryRaw(client_1.Prisma.sql `
      SELECT id FROM stocktake_users WHERE username = ${username} LIMIT 1
    `);
        if (existing.length > 0) {
            return res.status(409).json({ error: `Username "${username}" already exists` });
        }
        const hashed = await bcryptjs_1.default.hash(String(password), BCRYPT_ROUNDS);
        const activeFlag = isActive === undefined ? true : !!isActive;
        const inserted = await prisma.$queryRaw(client_1.Prisma.sql `
      INSERT INTO stocktake_users (username, password, name, email, warehouse, role, is_active, created_at, updated_at)
      VALUES (${username}, ${hashed}, ${name ?? null}, ${email ?? null}, ${warehouse ?? null}, ${role}, ${activeFlag}, NOW(), NOW())
      RETURNING id, username, warehouse, role, name, email, is_active, created_at, updated_at
    `);
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
    }
    catch (error) {
        console.error("Create user error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.createUser = createUser;
// PUT /api/users/:id — update fields. Password optional; if provided, hashed.
const updateUser = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "Invalid user id" });
        }
        const { username, password, name, email, warehouse, role, isActive } = req.body || {};
        // If username is being changed, ensure it's not taken by another user
        if (username) {
            const conflict = await prisma.$queryRaw(client_1.Prisma.sql `
        SELECT id FROM stocktake_users WHERE username = ${username} AND id <> ${id} LIMIT 1
      `);
            if (conflict.length > 0) {
                return res.status(409).json({ error: `Username "${username}" already exists` });
            }
        }
        const hashedPassword = password ? await bcryptjs_1.default.hash(String(password), BCRYPT_ROUNDS) : null;
        // Use COALESCE so undefined/missing fields don't overwrite existing values.
        // Pass NULL for any field not supplied; SQL keeps the previous value.
        const updated = await prisma.$queryRaw(client_1.Prisma.sql `
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
    `);
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
    }
    catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.updateUser = updateUser;
// DELETE /api/users/:id — hard delete
const deleteUser = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ error: "Invalid user id" });
        }
        // Prevent self-delete: a floor manager shouldn't lock themselves out mid-session
        if (req.user && req.user.userId === String(id)) {
            return res.status(400).json({ error: "You cannot delete your own account" });
        }
        const deleted = await prisma.$queryRaw(client_1.Prisma.sql `
      DELETE FROM stocktake_users WHERE id = ${id} RETURNING id
    `);
        if (deleted.length === 0) {
            return res.status(404).json({ error: `User ${id} not found` });
        }
        res.json({ success: true, deletedId: id.toString() });
    }
    catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
exports.deleteUser = deleteUser;
