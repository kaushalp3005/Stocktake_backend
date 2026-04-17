-- Migration: Create stocktake_users table
-- This table is used by the authentication system (not Prisma's users table).
-- Run once on a fresh database before starting the application.

CREATE TABLE IF NOT EXISTS stocktake_users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(255) NOT NULL UNIQUE,
  email       VARCHAR(255),
  password    VARCHAR(255) NOT NULL,
  name        VARCHAR(255),
  role        VARCHAR(50)  NOT NULL DEFAULT 'floorhead',
  warehouse   VARCHAR(255),           -- assigned warehouse for floor-level users
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Index for fast username lookups (used on every login)
CREATE INDEX IF NOT EXISTS idx_stocktake_users_username ON stocktake_users (username);
CREATE INDEX IF NOT EXISTS idx_stocktake_users_email    ON stocktake_users (email);

-- Role values recognised by the application:
--   floorhead        → maps to FLOOR_MANAGER
--   manager          → maps to INVENTORY_MANAGER
--   INVENTORY_MANAGER→ maps to INVENTORY_MANAGER
--   superuser        → maps to SUPERUSER
--   admin            → maps to ADMIN

-- Seed a default admin account (CHANGE PASSWORD before production)
INSERT INTO stocktake_users (username, email, password, name, role, is_active)
VALUES ('admin', 'admin@stocktake.app', 'admin123', 'Administrator', 'admin', true)
ON CONFLICT (username) DO NOTHING;
