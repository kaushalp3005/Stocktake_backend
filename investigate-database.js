const { PrismaClient } = require('@prisma/client');

async function investigateDatabase() {
  const prisma = new PrismaClient();
  try {
    console.log('🔍 DETAILED DATABASE INVESTIGATION');
    console.log('='.repeat(50));
    
    // Check connection details
    console.log('\n📡 Connection Details:');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    console.log('');
    
    // Run raw SQL to get database and table info
    const dbInfo = await prisma.$queryRaw`SELECT current_database(), current_schema()`;
    console.log('📊 Current Database:', dbInfo);
    
    // Get table structure
    const tableInfo = await prisma.$queryRaw`
      SELECT 
        table_schema,
        table_name,
        column_name,
        data_type
      FROM information_schema.columns 
      WHERE table_name = 'stocktake_entries'
      ORDER BY ordinal_position
    `;
    console.log('\n📋 Table Structure:');
    console.log(tableInfo);
    
    // Count entries
    const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM stocktake_entries`;
    console.log('\n📈 Total Entries via SQL:', count[0].count);
    
    // Get ID range
    const idRange = await prisma.$queryRaw`
      SELECT 
        MIN(id) as min_id,
        MAX(id) as max_id
      FROM stocktake_entries
    `;
    console.log('🔢 ID Range:', idRange[0]);
    
    // Get first few entries
    const firstEntries = await prisma.$queryRaw`
      SELECT id, item_name, entered_by, created_at
      FROM stocktake_entries
      ORDER BY id ASC
      LIMIT 5
    `;
    console.log('\n📝 First 5 Entries:');
    firstEntries.forEach(e => {
      console.log(`   ID: ${e.id} | ${e.item_name} | ${e.entered_by}`);
    });
    
    // Get latest entries
    const latestEntries = await prisma.$queryRaw`
      SELECT id, item_name, entered_by, created_at
      FROM stocktake_entries
      ORDER BY id DESC
      LIMIT 5
    `;
    console.log('\n📝 Latest 5 Entries:');
    latestEntries.forEach(e => {
      console.log(`   ID: ${e.id} | ${e.item_name} | ${e.entered_by} | ${e.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateDatabase();