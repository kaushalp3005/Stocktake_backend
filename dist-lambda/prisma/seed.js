"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🌱 Starting seed...");
    // Create warehouses
    const warehouses = await Promise.all([
        prisma.warehouse.create({
            data: {
                name: "Main Warehouse",
                location: "New Delhi",
            },
        }),
        prisma.warehouse.create({
            data: {
                name: "Secondary Warehouse",
                location: "Mumbai",
            },
        }),
    ]);
    console.log(`✅ Created ${warehouses.length} warehouses`);
    // Create floors for main warehouse (7 floors)
    const mainWarehouseFloors = await Promise.all([
        prisma.floor.create({ data: { warehouseId: warehouses[0].id, name: "Floor 1" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[0].id, name: "Floor 2" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[0].id, name: "Floor 3" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[0].id, name: "Floor 4" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[0].id, name: "Floor 5" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[0].id, name: "Floor 6" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[0].id, name: "Floor 7" } }),
    ]);
    // Create floors for secondary warehouse (7 floors)
    const secondaryWarehouseFloors = await Promise.all([
        prisma.floor.create({ data: { warehouseId: warehouses[1].id, name: "Floor 1" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[1].id, name: "Floor 2" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[1].id, name: "Floor 3" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[1].id, name: "Floor 4" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[1].id, name: "Floor 5" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[1].id, name: "Floor 6" } }),
        prisma.floor.create({ data: { warehouseId: warehouses[1].id, name: "Floor 7" } }),
    ]);
    console.log(`✅ Created ${mainWarehouseFloors.length + secondaryWarehouseFloors.length} floors`);
    // Create users
    const hashedPassword = await bcryptjs_1.default.hash("password123", 10);
    const users = await Promise.all([
        prisma.user.create({
            data: {
                email: "admin@candorfoods.com",
                password: hashedPassword,
                name: "Admin",
                role: "ADMIN",
            },
        }),
        prisma.user.create({
            data: {
                email: "manager@candorfoods.com",
                password: hashedPassword,
                name: "Inventory Manager",
                role: "INVENTORY_MANAGER",
            },
        }),
        prisma.user.create({
            data: {
                email: "floor1@candorfoods.com",
                password: hashedPassword,
                name: "Floor Manager - Floor 1",
                role: "FLOOR_MANAGER",
            },
        }),
        prisma.user.create({
            data: {
                email: "floor2@candorfoods.com",
                password: hashedPassword,
                name: "Floor Manager - Floor 2",
                role: "FLOOR_MANAGER",
            },
        }),
        prisma.user.create({
            data: {
                email: "floor3@candorfoods.com",
                password: hashedPassword,
                name: "Floor Manager - Floor 3",
                role: "FLOOR_MANAGER",
            },
        }),
    ]);
    console.log(`✅ Created ${users.length} users`);
    // Assign users to warehouses
    const admin = users.find((u) => u.email === "admin@candorfoods.com");
    const manager = users.find((u) => u.email === "manager@candorfoods.com");
    const floorManager1 = users.find((u) => u.email === "floor1@candorfoods.com");
    const floorManager2 = users.find((u) => u.email === "floor2@candorfoods.com");
    const floorManager3 = users.find((u) => u.email === "floor3@candorfoods.com");
    await Promise.all([
        prisma.userWarehouse.create({ data: { userId: admin.id, warehouseId: warehouses[0].id } }),
        prisma.userWarehouse.create({ data: { userId: admin.id, warehouseId: warehouses[1].id } }),
        prisma.userWarehouse.create({ data: { userId: manager.id, warehouseId: warehouses[0].id } }),
        prisma.userWarehouse.create({ data: { userId: manager.id, warehouseId: warehouses[1].id } }),
        prisma.userWarehouse.create({ data: { userId: floorManager1.id, warehouseId: warehouses[0].id } }),
        prisma.userWarehouse.create({ data: { userId: floorManager2.id, warehouseId: warehouses[0].id } }),
        prisma.userWarehouse.create({ data: { userId: floorManager3.id, warehouseId: warehouses[1].id } }),
    ]);
    console.log("✅ Assigned users to warehouses");
    // Create item categories
    const categories = await Promise.all([
        prisma.itemCategory.create({ data: { name: "Dry Goods" } }),
        prisma.itemCategory.create({ data: { name: "Oils & Fats" } }),
        prisma.itemCategory.create({ data: { name: "Spices & Seasonings" } }),
        prisma.itemCategory.create({ data: { name: "Packaged Foods" } }),
    ]);
    console.log(`✅ Created ${categories.length} item categories`);
    // Create sub-categories
    const dryGoodsCategory = categories.find((c) => c.name === "Dry Goods");
    const oilsCategory = categories.find((c) => c.name === "Oils & Fats");
    const spicesCategory = categories.find((c) => c.name === "Spices & Seasonings");
    const subCategories = await Promise.all([
        prisma.itemSubCategory.create({
            data: { categoryId: dryGoodsCategory.id, name: "Rice & Grains" },
        }),
        prisma.itemSubCategory.create({
            data: { categoryId: dryGoodsCategory.id, name: "Flour & Pulses" },
        }),
        prisma.itemSubCategory.create({
            data: { categoryId: oilsCategory.id, name: "Cooking Oils" },
        }),
        prisma.itemSubCategory.create({
            data: { categoryId: spicesCategory.id, name: "Whole Spices" },
        }),
        prisma.itemSubCategory.create({
            data: { categoryId: spicesCategory.id, name: "Ground Spices" },
        }),
    ]);
    console.log(`✅ Created ${subCategories.length} sub-categories`);
    // Create items
    const items = await Promise.all([
        prisma.item.create({
            data: {
                name: "Rice - Basmati",
                categoryId: dryGoodsCategory.id,
                subCategoryId: subCategories[0].id,
                description: "Premium Basmati Rice",
                kgPerUnit: 50,
                unitName: "Bag",
            },
        }),
        prisma.item.create({
            data: {
                name: "Wheat Flour",
                categoryId: dryGoodsCategory.id,
                subCategoryId: subCategories[1].id,
                description: "All-Purpose Wheat Flour",
                kgPerUnit: 25,
                unitName: "Bag",
            },
        }),
        prisma.item.create({
            data: {
                name: "Refined Cooking Oil",
                categoryId: oilsCategory.id,
                subCategoryId: subCategories[2].id,
                description: "Premium Vegetable Oil",
                kgPerUnit: 15,
                unitName: "Can",
            },
        }),
        prisma.item.create({
            data: {
                name: "Black Pepper",
                categoryId: spicesCategory.id,
                subCategoryId: subCategories[3].id,
                description: "Whole Black Peppercorns",
                kgPerUnit: 2,
                unitName: "Box",
            },
        }),
        prisma.item.create({
            data: {
                name: "Turmeric Powder",
                categoryId: spicesCategory.id,
                subCategoryId: subCategories[4].id,
                description: "Ground Turmeric",
                kgPerUnit: 1,
                unitName: "Jar",
            },
        }),
        prisma.item.create({
            data: {
                name: "Salt",
                categoryId: dryGoodsCategory.id,
                subCategoryId: subCategories[1].id,
                description: "Iodized Salt",
                kgPerUnit: 10,
                unitName: "Bag",
            },
        }),
    ]);
    console.log(`✅ Created ${items.length} items`);
    console.log("🎉 Seed completed successfully!");
}
main()
    .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
