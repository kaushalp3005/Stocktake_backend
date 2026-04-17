// Shared types for frontend and backend

export interface User {
  id: string;
  email: string;
  name: string;
  role: "FLOOR_MANAGER" | "INVENTORY_MANAGER" | "SUPERUSER" | "ADMIN";
}

export interface Floor {
  id: string;
  name: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Item {
  id: string;
  name: string;
  unitName: string;
  kgPerUnit: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pallet {
  id: string;
  floorSessionId: string;
  palletNumber: number;
  locationNote?: string;
  stockLines: StockLine[];
  createdAt: string;
  updatedAt: string;
}

export interface StockLine {
  id: string;
  palletId: string;
  itemId: string;
  units: number;
  calculatedKg: number;
  measuredKg?: number;
  remark?: string;
  item?: Item;
  createdAt: string;
  updatedAt: string;
}

export interface FloorSession {
  id: string;
  floorId: string;
  userId: string;
  date: string;
  shift?: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  pallets: Pallet[];
  floor?: Floor;
  user?: User;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ExportFile {
  id: string;
  fileName: string;
  filePath?: string;
  generatedBy: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}
