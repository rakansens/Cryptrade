/**
 * Database Schema Comprehensive Test
 * 
 * Tests all tables, relationships, and constraints in the database
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

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

// Type guard for Prisma errors
function isPrismaError(error: unknown): error is Error & { code: string } {
  return error instanceof Error && 'code' in error && typeof (error as any).code === 'string';
}

async function testDatabaseSchema() {
  log('info', '=== Database Schema Comprehensive Test ===\n');
  
  const testResults: { table: string; status: 'passed' | 'failed'; error?: string }[] = [];
  
  try {
    // 1. Test User table
    log('info', '1. Testing User table...');
    try {
      const testUser = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          name: 'Test User',
        }
      });
      
      // Test read
      const foundUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      });
      
      if (!foundUser) throw new Error('User not found after creation');
      
      // Test update
      await prisma.user.update({
        where: { id: testUser.id },
        data: { name: 'Updated Test User' }
      });
      
      // Test delete
      await prisma.user.delete({
        where: { id: testUser.id }
      });
      
      log('success', '✓ User table tests passed');
      testResults.push({ table: 'User', status: 'passed' });
    } catch (error) {
      log('error', `✗ User table tests failed: ${error}`);
      testResults.push({ table: 'User', status: 'failed', error: String(error) });
    }
    
    // 2. Test ConversationSession table
    log('info', '\n2. Testing ConversationSession table...');
    try {
      const testSession = await prisma.conversationSession.create({
        data: {
          summary: 'Test Session',
          metadata: { test: true, timestamp: new Date().toISOString() }
        }
      });
      
      // Test with user relationship
      const testUserForSession = await prisma.user.create({
        data: {
          email: `session-test-${Date.now()}@example.com`,
          name: 'Session Test User',
        }
      });
      
      const sessionWithUser = await prisma.conversationSession.create({
        data: {
          userId: testUserForSession.id,
          summary: 'Session with User',
        }
      });
      
      // Test read with relations
      const sessionWithRelations = await prisma.conversationSession.findUnique({
        where: { id: sessionWithUser.id },
        include: {
          user: true,
          messages: true,
          analyses: true,
          drawings: true,
          patterns: true,
        }
      });
      
      if (!sessionWithRelations?.user) throw new Error('User relation not loaded');
      
      // Cleanup
      await prisma.conversationSession.deleteMany({
        where: { id: { in: [testSession.id, sessionWithUser.id] } }
      });
      await prisma.user.delete({ where: { id: testUserForSession.id } });
      
      log('success', '✓ ConversationSession table tests passed');
      testResults.push({ table: 'ConversationSession', status: 'passed' });
    } catch (error) {
      log('error', `✗ ConversationSession table tests failed: ${error}`);
      testResults.push({ table: 'ConversationSession', status: 'failed', error: String(error) });
    }
    
    // 3. Test ConversationMessage table
    log('info', '\n3. Testing ConversationMessage table...');
    try {
      const messageSession = await prisma.conversationSession.create({
        data: { summary: 'Message Test Session' }
      });
      
      const testMessage = await prisma.conversationMessage.create({
        data: {
          sessionId: messageSession.id,
          role: 'user',
          content: 'Test message content',
          agentId: 'test-agent',
          metadata: { intent: 'test', confidence: 0.95 }
        }
      });
      
      // Test different roles
      const roles: ('user' | 'assistant' | 'system')[] = ['user', 'assistant', 'system'];
      for (const role of roles) {
        await prisma.conversationMessage.create({
          data: {
            sessionId: messageSession.id,
            role,
            content: `Test ${role} message`,
          }
        });
      }
      
      // Test query with filters
      const userMessages = await prisma.conversationMessage.findMany({
        where: {
          sessionId: messageSession.id,
          role: 'user'
        }
      });
      
      if (userMessages.length !== 2) throw new Error('Expected 2 user messages');
      
      // Cleanup
      await prisma.conversationMessage.deleteMany({
        where: { sessionId: messageSession.id }
      });
      await prisma.conversationSession.delete({
        where: { id: messageSession.id }
      });
      
      log('success', '✓ ConversationMessage table tests passed');
      testResults.push({ table: 'ConversationMessage', status: 'passed' });
    } catch (error) {
      log('error', `✗ ConversationMessage table tests failed: ${error}`);
      testResults.push({ table: 'ConversationMessage', status: 'failed', error: String(error) });
    }
    
    // 4. Test AnalysisRecord table
    log('info', '\n4. Testing AnalysisRecord table...');
    try {
      const analysisSession = await prisma.conversationSession.create({
        data: { summary: 'Analysis Test Session' }
      });
      
      const testAnalysis = await prisma.analysisRecord.create({
        data: {
          sessionId: analysisSession.id,
          proposalId: `proposal-${Date.now()}`,
          timestamp: BigInt(Date.now()),
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
          proposalData: {
            price: 42000,
            confidence: 0.85,
            zones: [
              {
                type: 'support',
                startPrice: 41800,
                endPrice: 42200,
                strength: 0.9
              }
            ]
          },
          trackingData: {
            status: 'active',
            touches: 0
          },
          performanceData: {
            accuracy: 0,
            totalTouches: 0
          }
        }
      });
      
      // Test all analysis types
      const types: ('support' | 'resistance' | 'trendline' | 'pattern' | 'fibonacci')[] = 
        ['support', 'resistance', 'trendline', 'pattern', 'fibonacci'];
      
      for (const type of types) {
        await prisma.analysisRecord.create({
          data: {
            sessionId: analysisSession.id,
            timestamp: BigInt(Date.now()),
            symbol: 'ETHUSDT',
            interval: '4h',
            type,
            proposalData: { test: true, type }
          }
        });
      }
      
      // Test query with JSON field
      const supportAnalyses = await prisma.analysisRecord.findMany({
        where: {
          type: 'support',
          proposalData: {
            path: ['confidence'],
            gte: 0.8
          }
        }
      });
      
      // Cleanup
      await prisma.analysisRecord.deleteMany({
        where: { sessionId: analysisSession.id }
      });
      await prisma.conversationSession.delete({
        where: { id: analysisSession.id }
      });
      
      log('success', '✓ AnalysisRecord table tests passed');
      testResults.push({ table: 'AnalysisRecord', status: 'passed' });
    } catch (error) {
      log('error', `✗ AnalysisRecord table tests failed: ${error}`);
      testResults.push({ table: 'AnalysisRecord', status: 'failed', error: String(error) });
    }
    
    // 5. Test TouchEvent table
    log('info', '\n5. Testing TouchEvent table...');
    try {
      const touchSession = await prisma.conversationSession.create({
        data: { summary: 'Touch Event Test Session' }
      });
      
      const touchAnalysis = await prisma.analysisRecord.create({
        data: {
          sessionId: touchSession.id,
          timestamp: BigInt(Date.now()),
          symbol: 'BTCUSDT',
          interval: '1h',
          type: 'support',
          proposalData: { price: 42000 }
        }
      });
      
      // Test all touch results
      const touchResults: ('bounce' | 'break' | 'test')[] = ['bounce', 'break', 'test'];
      
      for (const result of touchResults) {
        await prisma.touchEvent.create({
          data: {
            recordId: touchAnalysis.id,
            timestamp: BigInt(Date.now()),
            price: 42100 + Math.random() * 100,
            result,
            volume: Math.random() * 1000000,
            strength: Math.random()
          }
        });
      }
      
      // Test query with aggregation
      const touchEvents = await prisma.touchEvent.findMany({
        where: { recordId: touchAnalysis.id },
        orderBy: { timestamp: 'desc' }
      });
      
      if (touchEvents.length !== 3) throw new Error('Expected 3 touch events');
      
      // Test cascade delete
      await prisma.analysisRecord.delete({
        where: { id: touchAnalysis.id }
      });
      
      // Verify cascade delete worked
      const remainingTouches = await prisma.touchEvent.count({
        where: { recordId: touchAnalysis.id }
      });
      
      if (remainingTouches !== 0) throw new Error('Touch events not cascade deleted');
      
      // Cleanup
      await prisma.conversationSession.delete({
        where: { id: touchSession.id }
      });
      
      log('success', '✓ TouchEvent table tests passed');
      testResults.push({ table: 'TouchEvent', status: 'passed' });
    } catch (error) {
      log('error', `✗ TouchEvent table tests failed: ${error}`);
      testResults.push({ table: 'TouchEvent', status: 'failed', error: String(error) });
    }
    
    // 6. Test ChartDrawing table
    log('info', '\n6. Testing ChartDrawing table...');
    try {
      const drawingSession = await prisma.conversationSession.create({
        data: { summary: 'Drawing Test Session' }
      });
      
      // Test all drawing types
      const drawingTypes: ('trendline' | 'fibonacci' | 'horizontal' | 'vertical' | 'pattern')[] = 
        ['trendline', 'fibonacci', 'horizontal', 'vertical', 'pattern'];
      
      for (const type of drawingTypes) {
        await prisma.chartDrawing.create({
          data: {
            sessionId: drawingSession.id,
            type,
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
            interactive: true,
            metadata: { test: true, type }
          }
        });
      }
      
      // Test query
      const drawings = await prisma.chartDrawing.findMany({
        where: { sessionId: drawingSession.id },
        orderBy: { createdAt: 'desc' }
      });
      
      if (drawings.length !== 5) throw new Error('Expected 5 drawings');
      
      // Test update
      await prisma.chartDrawing.update({
        where: { id: drawings[0].id },
        data: { visible: false }
      });
      
      // Cleanup
      await prisma.chartDrawing.deleteMany({
        where: { sessionId: drawingSession.id }
      });
      await prisma.conversationSession.delete({
        where: { id: drawingSession.id }
      });
      
      log('success', '✓ ChartDrawing table tests passed');
      testResults.push({ table: 'ChartDrawing', status: 'passed' });
    } catch (error) {
      log('error', `✗ ChartDrawing table tests failed: ${error}`);
      testResults.push({ table: 'ChartDrawing', status: 'failed', error: String(error) });
    }
    
    // 7. Test PatternAnalysis table
    log('info', '\n7. Testing PatternAnalysis table...');
    try {
      const patternSession = await prisma.conversationSession.create({
        data: { summary: 'Pattern Test Session' }
      });
      
      // Test all pattern types
      const patternTypes: ('headAndShoulders' | 'doubleTop' | 'ascendingTriangle' | 'flag' | 'wedge')[] = 
        ['headAndShoulders', 'doubleTop', 'ascendingTriangle', 'flag', 'wedge'];
      
      for (const type of patternTypes) {
        await prisma.patternAnalysis.create({
          data: {
            session: {
              connect: { id: patternSession.id }
            },
            type,
            symbol: 'BTCUSDT',
            interval: '1h',
            confidence: 0.75 + Math.random() * 0.25,
            startTime: BigInt(Date.now() - 7200000),
            endTime: BigInt(Date.now()),
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
            description: `Test ${type} pattern`,
            tradingImplication: Math.random() > 0.5 ? 'bullish' : 'bearish'
          }
        });
      }
      
      // Test query with filters
      const bullishPatterns = await prisma.patternAnalysis.findMany({
        where: {
          sessionId: patternSession.id,
          tradingImplication: 'bullish'
        }
      });
      
      // Cleanup
      await prisma.patternAnalysis.deleteMany({
        where: { session: { id: patternSession.id } }
      });
      await prisma.conversationSession.delete({
        where: { id: patternSession.id }
      });
      
      log('success', '✓ PatternAnalysis table tests passed');
      testResults.push({ table: 'PatternAnalysis', status: 'passed' });
    } catch (error) {
      log('error', `✗ PatternAnalysis table tests failed: ${error}`);
      testResults.push({ table: 'PatternAnalysis', status: 'failed', error: String(error) });
    }
    
    // 8. Test SystemLog table
    log('info', '\n8. Testing SystemLog table...');
    try {
      const logUser = await prisma.user.create({
        data: {
          email: `log-test-${Date.now()}@example.com`,
          name: 'Log Test User',
        }
      });
      
      const logSession = await prisma.conversationSession.create({
        data: {
          userId: logUser.id,
          summary: 'Log Test Session'
        }
      });
      
      // Test all log levels
      const logLevels: ('info' | 'warn' | 'error' | 'debug')[] = ['info', 'warn', 'error', 'debug'];
      
      for (const level of logLevels) {
        await prisma.systemLog.create({
          data: {
            level,
            source: 'test-suite',
            message: `Test ${level} log message`,
            userId: logUser.id,
            sessionId: logSession.id,
            metadata: {
              test: true,
              timestamp: new Date().toISOString(),
              level
            }
          }
        });
      }
      
      // Test query with relations
      const logs = await prisma.systemLog.findMany({
        where: { userId: logUser.id },
        include: {
          user: true,
          session: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (logs.length !== 4) throw new Error('Expected 4 log entries');
      if (!logs[0].user || !logs[0].session) throw new Error('Relations not loaded');
      
      // Cleanup
      await prisma.systemLog.deleteMany({
        where: { userId: logUser.id }
      });
      await prisma.conversationSession.delete({
        where: { id: logSession.id }
      });
      await prisma.user.delete({
        where: { id: logUser.id }
      });
      
      log('success', '✓ SystemLog table tests passed');
      testResults.push({ table: 'SystemLog', status: 'passed' });
    } catch (error) {
      log('error', `✗ SystemLog table tests failed: ${error}`);
      testResults.push({ table: 'SystemLog', status: 'failed', error: String(error) });
    }
    
    // 9. Test Cascade Deletes
    log('info', '\n9. Testing cascade deletes...');
    try {
      // Create a user with all related data
      const cascadeUser = await prisma.user.create({
        data: {
          email: `cascade-test-${Date.now()}@example.com`,
          name: 'Cascade Test User',
          sessions: {
            create: {
              summary: 'Cascade Test Session',
              messages: {
                create: [
                  { role: 'user', content: 'Test message 1' },
                  { role: 'assistant', content: 'Test response' }
                ]
              },
              analyses: {
                create: {
                  timestamp: BigInt(Date.now()),
                  symbol: 'BTCUSDT',
                  interval: '1h',
                  type: 'support',
                  proposalData: { test: true }
                }
              }
            }
          }
        },
        include: {
          sessions: {
            include: {
              messages: true,
              analyses: true
            }
          }
        }
      });
      
      const sessionId = cascadeUser.sessions[0].id;
      const analysisId = cascadeUser.sessions[0].analyses[0].id;
      
      // Add touch event to analysis
      await prisma.touchEvent.create({
        data: {
          recordId: analysisId,
          timestamp: BigInt(Date.now()),
          price: 42000,
          result: 'bounce',
          strength: 0.8
        }
      });
      
      // Delete user and verify cascade
      await prisma.user.delete({
        where: { id: cascadeUser.id }
      });
      
      // Verify all related data is deleted
      const remainingSessions = await prisma.conversationSession.count({
        where: { id: sessionId }
      });
      const remainingMessages = await prisma.conversationMessage.count({
        where: { sessionId }
      });
      const remainingAnalyses = await prisma.analysisRecord.count({
        where: { id: analysisId }
      });
      const remainingTouchEvents = await prisma.touchEvent.count({
        where: { recordId: analysisId }
      });
      
      if (remainingSessions !== 0 || remainingMessages !== 0 || 
          remainingAnalyses !== 0 || remainingTouchEvents !== 0) {
        throw new Error('Cascade delete failed');
      }
      
      log('success', '✓ Cascade delete tests passed');
      testResults.push({ table: 'Cascade Deletes', status: 'passed' });
    } catch (error) {
      log('error', `✗ Cascade delete tests failed: ${error}`);
      testResults.push({ table: 'Cascade Deletes', status: 'failed', error: String(error) });
    }
    
    // 10. Test Unique Constraints
    log('info', '\n10. Testing unique constraints...');
    try {
      // Test unique email constraint
      const uniqueEmail = `unique-test-${Date.now()}@example.com`;
      await prisma.user.create({
        data: { email: uniqueEmail, name: 'First User' }
      });
      
      try {
        await prisma.user.create({
          data: { email: uniqueEmail, name: 'Duplicate User' }
        });
        throw new Error('Unique constraint not enforced');
      } catch (error) {
        if (!isPrismaError(error) || error.code !== 'P2002') {
          throw new Error('Expected unique constraint violation');
        }
      }
      
      // Cleanup
      await prisma.user.deleteMany({
        where: { email: uniqueEmail }
      });
      
      log('success', '✓ Unique constraint tests passed');
      testResults.push({ table: 'Unique Constraints', status: 'passed' });
    } catch (error) {
      log('error', `✗ Unique constraint tests failed: ${error}`);
      testResults.push({ table: 'Unique Constraints', status: 'failed', error: String(error) });
    }
    
    // Summary
    log('info', '\n=== Test Summary ===\n');
    
    const passed = testResults.filter(r => r.status === 'passed').length;
    const failed = testResults.filter(r => r.status === 'failed').length;
    
    testResults.forEach(result => {
      const icon = result.status === 'passed' ? '✓' : '✗';
      const color = result.status === 'passed' ? 'success' : 'error';
      log(color, `${icon} ${result.table}: ${result.status}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });
    
    log('info', `\nTotal: ${testResults.length} tests`);
    log('success', `Passed: ${passed}`);
    log('error', `Failed: ${failed}`);
    
    if (failed === 0) {
      log('success', '\n🎉 All database schema tests passed!');
    } else {
      log('error', `\n❌ ${failed} tests failed`);
      process.exit(1);
    }
    
  } catch (error) {
    log('error', `\nUnexpected error: ${error}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
testDatabaseSchema();