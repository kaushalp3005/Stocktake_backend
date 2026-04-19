import { RequestHandler } from "express";
import { generateToken } from "../utils/auth.js";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { isBcryptHash } from "./users.js";

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

// Map database roles to application roles
function mapRoleToAppRole(dbRole: string): "ADMIN" | "SUPERUSER" | "INVENTORY_MANAGER" | "FLOOR_MANAGER" {
  const roleUpper = dbRole.toUpperCase();
  if (roleUpper === "FLOORHEAD" || roleUpper === "FLOOR_HEAD") {
    return "FLOOR_MANAGER";
  }
  if (roleUpper === "MANAGER" || roleUpper === "INVENTORY_MANAGER") {
    return "INVENTORY_MANAGER";
  }
  if (roleUpper === "SUPERUSER" || roleUpper === "SUPER_USER") {
    return "SUPERUSER";
  }
  if (roleUpper === "ADMIN") {
    return "ADMIN";
  }
  // Default to FLOOR_MANAGER for unknown roles
  return "FLOOR_MANAGER";
}

interface LoginRequest {
  username: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
}

export const login: RequestHandler<{}, any, LoginRequest> = async (
  req,
  res
) => {
  console.log("Login request received:", { 
    body: req.body, 
    hasUsername: !!req.body?.username,
    hasPassword: !!req.body?.password 
  });
  
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Find user in stocktake_users table
    let users: any[] = [];
    try {
    const query = Prisma.sql`
      SELECT id, username, password, warehouse, role, name, email, is_active
      FROM stocktake_users
      WHERE username = ${username}
      LIMIT 1
    `;
    
      console.log("Executing database query for username:", username);
      users = await prisma.$queryRaw(query) as any[];
      console.log("Database query result:", {
        userCount: users.length,
        foundUser: users.length > 0 ? {
          id: users[0]?.id,
          username: users[0]?.username,
          hasPassword: !!users[0]?.password,
          is_active: users[0]?.is_active,
          role: users[0]?.role
        } : null
      });
    } catch (dbError: any) {
      console.error("Database query error:", dbError);
      // Check if table doesn't exist
      if (dbError.message?.includes("does not exist") || dbError.message?.includes("relation")) {
        return res.status(500).json({ 
          error: "Database table not found",
          message: "The stocktake_users table does not exist. Please run database migrations."
        });
      }
      // Check if connection error
      if (dbError.message?.includes("connect") || dbError.message?.includes("timeout")) {
        return res.status(500).json({ 
          error: "Database connection failed",
          message: "Unable to connect to the database. Please check your DATABASE_URL."
        });
      }
      throw dbError; // Re-throw if it's a different error
    }

    if (users.length === 0) {
      console.log("User not found in database for username:", username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const dbUser = users[0];

    // Check if user is active
    if (!dbUser.is_active) {
      console.log("User account is disabled:", username);
      return res.status(403).json({ error: "Account is disabled" });
    }

    // Check password — supports both bcrypt-hashed and legacy plaintext.
    // If stored value looks like a bcrypt hash, use bcrypt.compare.
    // Otherwise fall back to plaintext compare and, on success, upgrade
    // the stored password to a bcrypt hash so future logins use the secure path.
    let passwordOk = false;
    let needsUpgrade = false;

    if (isBcryptHash(dbUser.password)) {
      passwordOk = await bcrypt.compare(String(password), dbUser.password);
    } else {
      passwordOk = dbUser.password === password;
      needsUpgrade = passwordOk;
    }

    if (!passwordOk) {
      console.log("Password mismatch for user:", username);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (needsUpgrade) {
      try {
        const newHash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
        await prisma.$queryRaw(Prisma.sql`
          UPDATE stocktake_users SET password = ${newHash}, updated_at = NOW() WHERE id = ${dbUser.id}
        `);
        console.log("Auto-upgraded plaintext password to bcrypt for user:", username);
      } catch (upgradeErr: any) {
        // Don't fail the login if the upgrade write fails — just log.
        console.error("Password upgrade failed for user:", username, upgradeErr?.message);
      }
    }

    // Map database role to application role
    const appRole = mapRoleToAppRole(dbUser.role || "");

    const token = generateToken({
      userId: dbUser.id.toString(),
      email: dbUser.email || dbUser.username,
      role: appRole,
    });

    res.json({
      token,
      user: {
        id: dbUser.id.toString(),
        username: dbUser.username,
        email: dbUser.email || dbUser.username,
        name: dbUser.name || dbUser.username,
        role: appRole,
        warehouse: dbUser.warehouse,
        dbRole: dbUser.role, // Keep original role from DB
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    // Ensure we always send JSON response
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Internal server error",
        message: error?.message || "An unexpected error occurred",
        details: process.env.NODE_ENV === "development" ? error?.stack : undefined
      });
    }
  }
};

export const register: RequestHandler<{}, any, RegisterRequest> = async (
  req,
  res
) => {
  try {
    const { email, password, name, role = "FLOOR_MANAGER" } = req.body;

    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "Email, password, and name are required" });
    }

    // Check if user already exists in database
    const existingQuery = Prisma.sql`
      SELECT id, email, username
      FROM stocktake_users
      WHERE email = ${email} OR username = ${email}
      LIMIT 1
    `;
    
    const existingUsers: any[] = await prisma.$queryRaw(existingQuery) as any[];
    
    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "Email or username already in use" });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

    // Create new user in database
    const insertQuery = Prisma.sql`
      INSERT INTO stocktake_users (username, email, password, name, role, is_active, created_at)
      VALUES (${email}, ${email}, ${hashedPassword}, ${name}, ${role}, true, NOW())
      RETURNING id, username, email, name, role
    `;
    
    const newUsers: any[] = await prisma.$queryRaw(insertQuery) as any[];
    
    if (newUsers.length === 0) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    const newUser = newUsers[0];
    const appRole = mapRoleToAppRole(newUser.role || role);

    const token = generateToken({
      userId: newUser.id.toString(),
      email: newUser.email || newUser.username,
      role: appRole,
    });

    res.status(201).json({
      token,
      user: {
        id: newUser.id.toString(),
        email: newUser.email || newUser.username,
        name: newUser.name,
        role: appRole,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const me: RequestHandler = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Find user in stocktake_users table by ID
    const query = Prisma.sql`
      SELECT id, username, warehouse, role, name, email, is_active
      FROM stocktake_users
      WHERE id = ${parseInt(req.user.userId)} OR id::text = ${req.user.userId}
      LIMIT 1
    `;
    
    const users: any[] = await prisma.$queryRaw(query) as any[];

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const dbUser = users[0];
    const appRole = mapRoleToAppRole(dbUser.role || "");

    res.json({
      id: dbUser.id.toString(),
      username: dbUser.username,
      email: dbUser.email || dbUser.username,
      name: dbUser.name || dbUser.username,
      role: appRole,
      warehouse: dbUser.warehouse,
      dbRole: dbUser.role,
    });
  } catch (error) {
    console.error("Me error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
