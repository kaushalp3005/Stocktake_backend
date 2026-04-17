const { PrismaClient } = require('@prisma/client');

async function verifyDatabaseConnection() {
  const prisma = new PrismaClient();
  try {
    console.log('🔍 Checking DATABASE connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
    console.log('');
    
    // Get max ID to see if we're in the right database
    const maxEntry = await prisma.stockTakeEntry.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true, itemName: true, enteredBy: true, createdAt: true }
    });
    
    console.log('📊 Latest entry in database:');
    console.log(`   ID: ${maxEntry?.id}`);
    console.log(`   Item: ${maxEntry?.itemName}`);
    console.log(`   User: ${maxEntry?.enteredBy}`);
    console.log(`   Created: ${maxEntry?.createdAt}`);
    console.log('');
    
    // Count total entries
    const totalCount = await prisma.stockTakeEntry.count();
    console.log(`📈 Total entries in database: ${totalCount}`);
    console.log('');
    
    // Check if our recent entries exist
    const recentEntries = await prisma.stockTakeEntry.findMany({
      where: {
        id: { in: [1540, 1541, 1542, 1543, 1544, 1545, 1546, 1547] }
      },
      select: { id: true, itemName: true, enteredBy: true }
    });
    
    if (recentEntries.length > 0) {
      console.log('✅ Recent test entries FOUND:');
      recentEntries.forEach(e => {
        console.log(`   ID: ${e.id} - ${e.itemName} (${e.enteredBy})`);
      });
    } else {
      console.log('❌ Recent test entries NOT FOUND!');
      console.log('   This means we are NOT connected to the same database shown in CSV');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabaseConnection();