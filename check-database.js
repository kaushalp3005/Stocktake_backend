const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  const prisma = new PrismaClient();
  try {
    // Check if entries actually exist in database
    const totalCount = await prisma.stockTakeEntry.count();
    console.log('📊 Total entries in database:', totalCount);
    
    const shubhamCount = await prisma.stockTakeEntry.count({
      where: { enteredBy: { contains: 'SHUBHAM' } }
    });
    console.log('👤 Entries for SHUBHAM:', shubhamCount);
    
    // Show latest 10 entries with all details
    const recent = await prisma.stockTakeEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    console.log('📋 Latest 10 entries:');
    recent.forEach(entry => {
      console.log(`ID: ${entry.id} | User: ${entry.enteredBy} | Item: ${entry.itemName}`);
      console.log(`   Warehouse: ${entry.warehouse} | Floor: ${entry.floorName} | Stock: ${entry.stockType}`);
      console.log(`   Created: ${entry.createdAt}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Database check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();