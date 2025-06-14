/**
 * Direct API Test Script
 * 
 * Tests API route handlers directly without HTTP server
 */

import { logger } from '@/lib/utils/logger';
import { ChatDatabaseService } from '@/lib/services/database/chat.service';
import { ChartDrawingDatabaseService } from '@/lib/services/database/chart-drawing.service';
import { prisma } from '@/lib/db/prisma';

// Color codes for output
const colors = {
  success: '\x1b[32m',
  error: '\x1b[31m',
  info: '\x1b[36m',
  warning: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(type: 'success' | 'error' | 'info' | 'warning', message: string) {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

async function runDirectTests() {
  log('info', '=== Starting Direct API Tests ===\n');
  
  let testSessionId = `test-session-${Date.now()}`;
  
  try {
    // 1. Test Chat Service
    log('info', '--- Testing Chat Database Service ---');
    
    // Create session
    log('info', 'Creating chat session...');
    const session = await ChatDatabaseService.createSession(undefined, 'Test Session from Direct API Test');
    log('success', `✓ Created session: ${session.id}`);
    
    // Add message
    log('info', 'Adding message to session...');
    const message = await ChatDatabaseService.addMessage(session.id, {
      role: 'user',
      content: 'Test message from direct API test',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });
    log('success', `✓ Added message: ${message.id}`);
    
    // Get messages
    log('info', 'Getting messages from session...');
    const messages = await ChatDatabaseService.getMessages(session.id, 10);
    log('success', `✓ Retrieved ${messages.length} messages`);
    
    // Update session title
    log('info', 'Updating session title...');
    const updatedSession = await ChatDatabaseService.updateSessionTitle(session.id, 'Updated Test Session');
    log('success', `✓ Updated session title: ${updatedSession.summary}`);
    
    // 2. Test Chart Drawing Service
    log('info', '\n--- Testing Chart Drawing Database Service ---');
    
    // Create a session for chart drawings
    log('info', 'Creating session for chart drawings...');
    const chartSession = await prisma.conversationSession.create({
      data: {
        id: testSessionId,
        summary: 'Chart test session',
      }
    });
    log('success', `✓ Created chart session: ${chartSession.id}`);
    
    // Save drawings
    log('info', 'Saving chart drawings...');
    await ChartDrawingDatabaseService.saveDrawings([
      {
        id: `drawing-${Date.now()}`,
        type: 'trendline',
        points: [
          { time: Date.now() - 3600000, value: 100 },
          { time: Date.now(), value: 110 }
        ],
        style: {
          color: '#00ff00',
          lineWidth: 2,
          lineStyle: 'solid',
          showLabels: true
        },
        visible: true,
        interactive: true
      }
    ], testSessionId);
    log('success', '✓ Saved chart drawings');
    
    // Load drawings
    log('info', 'Loading chart drawings...');
    const drawings = await ChartDrawingDatabaseService.loadDrawings(testSessionId);
    log('success', `✓ Loaded ${drawings.length} drawings`);
    
    // Save pattern
    log('info', 'Saving chart pattern...');
    await ChartDrawingDatabaseService.savePattern({
      id: `pattern-${Date.now()}`,
      type: 'ascendingTriangle',
      name: 'Ascending Triangle',
      symbol: 'BTCUSDT',
      interval: '1h',
      confidence: 0.85,
      startTime: Date.now() - 7200000,
      endTime: Date.now(),
      visualization: {
        lines: [
          {
            start: { time: Date.now() - 7200000, value: 100 },
            end: { time: Date.now(), value: 105 }
          }
        ]
      },
      metrics: {
        height: 5,
        duration: 7200000
      },
      description: 'Test ascending triangle pattern',
      tradingImplication: 'bullish'
    }, testSessionId);
    log('success', '✓ Saved chart pattern');
    
    // Load patterns
    log('info', 'Loading chart patterns...');
    const patterns = await ChartDrawingDatabaseService.loadPatterns(testSessionId);
    log('success', `✓ Loaded ${patterns.length} patterns`);
    
    // 3. Test Conversation Memory
    log('info', '\n--- Testing Conversation Memory ---');
    
    // Create conversation message
    log('info', 'Creating conversation message...');
    const convMessage = await prisma.conversationMessage.create({
      data: {
        sessionId: testSessionId,
        role: 'user',
        content: 'Test conversation memory message',
        agentId: 'test-agent',
        metadata: {
          intent: 'test',
          confidence: 0.95,
          symbols: ['BTCUSDT'],
          topics: ['testing', 'api']
        }
      }
    });
    log('success', `✓ Created conversation message: ${convMessage.id}`);
    
    // Query messages
    log('info', 'Querying conversation messages...');
    const convMessages = await prisma.conversationMessage.findMany({
      where: { sessionId: testSessionId },
      orderBy: { timestamp: 'desc' },
      take: 5
    });
    log('success', `✓ Found ${convMessages.length} conversation messages`);
    
    // 4. Test Database Health
    log('info', '\n--- Testing Database Health ---');
    const health = await prisma.$queryRaw`SELECT 1`;
    log('success', '✓ Database health check passed');
    
    // Cleanup
    log('info', '\n--- Cleanup ---');
    
    // Delete test data
    await prisma.conversationMessage.deleteMany({
      where: { sessionId: testSessionId }
    });
    await prisma.chartDrawing.deleteMany({
      where: { sessionId: testSessionId }
    });
    await prisma.patternAnalysis.deleteMany({
      where: { sessionId: testSessionId }
    });
    await prisma.conversationSession.deleteMany({
      where: { id: { in: [session.id, testSessionId] } }
    });
    
    log('success', '✓ Test data cleaned up');
    
    log('success', '\n=== All Direct API Tests Passed! ===');
    
  } catch (error) {
    log('error', `\nTest failed: ${error}`);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
runDirectTests();