/**
 * Database Connection Test
 * 
 * Tests direct database connection and basic operations
 */

import { prisma } from '@/lib/db/prisma';

async function testDatabaseConnection() {
  console.log('Testing database connection...\n');
  
  try {
    // Test 1: Basic connection
    console.log('1. Testing basic connection...');
    await prisma.$connect();
    console.log('✓ Database connected successfully\n');
    
    // Test 2: Query database
    console.log('2. Testing database query...');
    const sessionCount = await prisma.conversationSession.count();
    console.log(`✓ Found ${sessionCount} conversation sessions\n`);
    
    // Test 3: Create test session
    console.log('3. Creating test session...');
    const testSession = await prisma.conversationSession.create({
      data: {
        id: `test-session-${Date.now()}`,
        summary: 'Test session from connection test',
      }
    });
    console.log(`✓ Created session: ${testSession.id}\n`);
    
    // Test 4: Create test message
    console.log('4. Creating test message...');
    const testMessage = await prisma.conversationMessage.create({
      data: {
        sessionId: testSession.id,
        role: 'user',
        content: 'Test message from connection test',
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      }
    });
    console.log(`✓ Created message: ${testMessage.id}\n`);
    
    // Test 5: Query created data
    console.log('5. Querying created data...');
    const messages = await prisma.conversationMessage.findMany({
      where: { sessionId: testSession.id }
    });
    console.log(`✓ Found ${messages.length} messages for session\n`);
    
    // Test 6: Clean up
    console.log('6. Cleaning up test data...');
    await prisma.conversationMessage.deleteMany({
      where: { sessionId: testSession.id }
    });
    await prisma.conversationSession.delete({
      where: { id: testSession.id }
    });
    console.log('✓ Test data cleaned up\n');
    
    console.log('All database tests passed! ✅');
    
  } catch (error) {
    console.error('Database test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDatabaseConnection();