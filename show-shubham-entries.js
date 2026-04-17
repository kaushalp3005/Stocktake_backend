const { PrismaClient } = require('@prisma/client');

async function showShubhamEntries() {
  const prisma = new PrismaClient();
  try {
    console.log('🔍 SHUBHAM ke saare entries:');
    console.log('================================');
    
    const entries = await prisma.stockTakeEntry.findMany({
      where: { 
        enteredBy: { 
          in: ['SHUBHAMLOHAR', 'shubhamlohar', 'SHUBHAM', 'shubham']
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Total entries found: ${entries.length}`);
    console.log('');
    
    entries.forEach((entry, i) => {
      console.log(`${i+1}. Entry ID: ${entry.id}`);
      console.log(`   📦 Item: ${entry.itemName}`);
      console.log(`   🏢 Warehouse: ${entry.warehouse}`);
      console.log(`   🏭 Floor: ${entry.floorName}`);
      console.log(`   📊 Quantity: ${entry.totalQuantity} | Weight: ${entry.totalWeight}kg`);
      console.log(`   🏷️ Category: ${entry.itemCategory} - ${entry.itemSubcategory}`);
      console.log(`   ✨ Stock Type: ${entry.stockType}`);
      console.log(`   👤 Entered By: ${entry.enteredBy}`);
      console.log(`   📧 Email: ${entry.enteredByEmail}`);
      console.log(`   📅 Created: ${entry.createdAt.toLocaleString()}`);
      console.log('   ----------------------------------------');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

showShubhamEntries();