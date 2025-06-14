/**
 * API Routes Test Script
 * 
 * Tests all database API routes to ensure they properly save and retrieve data
 */

import { logger } from '@/lib/utils/logger';

const API_BASE_URL = 'http://localhost:3001';

// Test data
const testSessionId = `test-session-${Date.now()}`;
const testRecordId = `test-record-${Date.now()}`;

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

async function testAPI(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>,
  expectedStatus = 200
): Promise<unknown> {
  try {
    log('info', `\nTesting ${method} ${endpoint}`);
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (response.status === expectedStatus) {
      log('success', `✓ ${method} ${endpoint} - Status: ${response.status}`);
      if (data) {
        console.log('Response:', JSON.stringify(data, null, 2));
      }
      return data;
    } else {
      log('error', `✗ ${method} ${endpoint} - Status: ${response.status}, Expected: ${expectedStatus}`);
      console.log('Error:', JSON.stringify(data, null, 2));
      return null;
    }
  } catch (error) {
    log('error', `✗ ${method} ${endpoint} - Error: ${error}`);
    return null;
  }
}

async function runTests() {
  log('info', '=== Starting API Routes Tests ===\n');
  
  // 1. Test Chat API
  log('info', '--- Testing Chat API ---');
  
  // Create session
  const sessionResult = await testAPI('POST', '/api/chat/sessions', {
    summary: 'Test Session'
  });
  
  if (sessionResult?.session) {
    const chatSessionId = sessionResult.session.id;
    
    // Add message
    const messageResult = await testAPI('POST', `/api/chat/sessions/${chatSessionId}/messages`, {
      role: 'user',
      content: 'Test message from API test script',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });
    
    // Get messages
    await testAPI('GET', `/api/chat/sessions/${chatSessionId}/messages?limit=10`);
    
    // Get session
    await testAPI('GET', `/api/chat/sessions/${chatSessionId}`);
  }
  
  // 2. Test Chart Drawing API
  log('info', '\n--- Testing Chart Drawing API ---');
  
  // Save drawings
  await testAPI('POST', `/api/chart/sessions/${testSessionId}/drawings`, {
    drawings: [
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
        interactive: true,
        data: {
          customData: 'test'
        }
      }
    ]
  });
  
  // Load drawings
  await testAPI('GET', `/api/chart/sessions/${testSessionId}/drawings`);
  
  // 3. Test Chart Pattern API
  log('info', '\n--- Testing Chart Pattern API ---');
  
  // Save patterns
  await testAPI('POST', `/api/chart/sessions/${testSessionId}/patterns`, {
    patterns: [
      {
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
        data: {
          customData: 'test pattern data'
        },
        description: 'Test ascending triangle pattern',
        tradingImplication: 'bullish'
      }
    ]
  });
  
  // Load patterns
  await testAPI('GET', `/api/chart/sessions/${testSessionId}/patterns`);
  
  // Save and load timeframe state
  await testAPI('POST', `/api/chart/sessions/${testSessionId}/timeframe`, {
    symbol: 'BTCUSDT',
    timeframe: '1h',
    timestamp: Date.now()
  });
  
  await testAPI('GET', `/api/chart/sessions/${testSessionId}/timeframe`);
  
  // 4. Test Conversation Memory API
  log('info', '\n--- Testing Conversation Memory API ---');
  
  // Add message
  const memoryMessage = await testAPI('POST', '/api/memory/messages', {
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
  });
  
  // Get recent messages
  await testAPI('GET', `/api/memory/sessions/${testSessionId}/messages?limit=5`);
  
  // Get session context
  await testAPI('GET', `/api/memory/sessions/${testSessionId}/context`);
  
  // Search messages
  await testAPI('GET', `/api/memory/search?query=test&sessionId=${testSessionId}`);
  
  // Update session summary
  await testAPI('PATCH', `/api/memory/sessions/${testSessionId}`, {
    summary: 'Test session with memory API'
  });
  
  // 5. Test Analysis API
  log('info', '\n--- Testing Analysis API ---');
  
  // Save analysis
  const analysisResult = await testAPI('POST', '/api/analysis/records', {
    sessionId: testSessionId,
    symbol: 'BTCUSDT',
    interval: '1h',
    type: 'support',
    proposalData: {
      price: 42000,
      confidence: 0.85,
      mlPrediction: {
        supportLevel: 42000,
        resistanceLevel: 44000,
        expectedBounces: 3,
        timeHorizon: '24h',
        modelConfidence: 0.82
      },
      zones: [
        {
          type: 'support',
          startPrice: 41800,
          endPrice: 42200,
          strength: 0.9,
          touches: 5
        }
      ],
      indicators: {
        rsi: 45,
        macd: { value: -50, signal: -40, histogram: -10 },
        volume: { current: 1000, average: 800, ratio: 1.25 }
      },
      patterns: ['double_bottom', 'support_retest'],
      chartImageUrl: 'https://example.com/chart.png'
    }
  });
  
  if (analysisResult?.recordId) {
    // Record touch event
    await testAPI('POST', `/api/analysis/records/${analysisResult.recordId}/touch`, {
      price: 42100,
      result: 'bounce',
      strength: 0.8,
      volume: 1200
    });
    
    // Get active analyses
    await testAPI('GET', '/api/analysis/active');
    
    // Get session analyses
    await testAPI('GET', `/api/analysis/sessions/${testSessionId}/records`);
  }
  
  // 6. Test Database Health
  log('info', '\n--- Testing Database Health ---');
  await testAPI('GET', '/api/health/db');
  
  // Cleanup
  log('info', '\n--- Cleanup ---');
  await testAPI('DELETE', `/api/chart/sessions/${testSessionId}`);
  
  log('success', '\n=== API Routes Tests Completed ===');
}

// Run the tests
runTests().catch(error => {
  log('error', `Test script error: ${error}`);
  process.exit(1);
});