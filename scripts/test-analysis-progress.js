/**
 * Test script for Analysis Progress SSE endpoint
 */

async function testAnalysisProgress() {
  console.log('🔬 Testing Analysis Progress SSE endpoint...\n');

  const params = {
    symbol: 'BTCUSDT',
    interval: '1h',
    analysisType: 'trendline',
    maxProposals: 3,
    sessionId: `test_${Date.now()}`
  };

  console.log('📊 Request parameters:', params);

  try {
    // Try different ports
    const ports = [3000, 3001, 3002];
    let response;
    let successPort;
    
    for (const port of ports) {
      try {
        response = await fetch(`http://localhost:${port}/api/ai/analysis-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
          body: JSON.stringify(params),
        });
        
        if (response.ok) {
          successPort = port;
          console.log(`✅ Connected to server on port ${port}`);
          break;
        }
      } catch (e) {
        // Try next port
      }
    }
    
    if (!response) {
      console.error('❌ Could not connect to any port');
      return;
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ HTTP Error:', response.status, error);
      return;
    }

    console.log('✅ Connected to SSE stream\n');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            handleEvent(event);
          } catch (e) {
            console.error('Failed to parse event:', e);
          }
        }
      }
    }

    console.log('\n✅ Stream completed');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

function handleEvent(event) {
  const timestamp = new Date().toLocaleTimeString();
  
  switch (event.type) {
    case 'analysis:start':
      console.log(`\n[${timestamp}] 🚀 ANALYSIS STARTED`);
      console.log(`  - Total Steps: ${event.data.totalSteps}`);
      console.log(`  - Symbol: ${event.data.symbol}`);
      console.log(`  - Interval: ${event.data.interval}`);
      console.log(`  - Type: ${event.data.analysisType}`);
      break;

    case 'analysis:step-start':
      console.log(`\n[${timestamp}] ▶️  STEP ${event.data.currentStepIndex + 1}/${event.data.totalSteps}: ${event.data.step.title}`);
      console.log(`  - ${event.data.step.description}`);
      break;

    case 'analysis:step-progress':
      process.stdout.write(`\r  - Progress: ${event.data.step.progress}%`);
      break;

    case 'analysis:step-complete':
      const duration = event.data.step.endTime && event.data.step.startTime
        ? ((event.data.step.endTime - event.data.step.startTime) / 1000).toFixed(1)
        : '0.0';
      console.log(`\n  ✅ Completed in ${duration}s`);
      if (event.data.step.details) {
        console.log(`  - Details:`, JSON.stringify(event.data.step.details, null, 2));
      }
      break;

    case 'analysis:complete':
      console.log(`\n[${timestamp}] 🎉 ANALYSIS COMPLETE`);
      console.log(`  - Duration: ${(event.data.duration / 1000).toFixed(1)}s`);
      console.log(`  - Proposals Created: ${event.data.proposalCount}`);
      console.log(`  - Proposal Group ID: ${event.data.proposalGroupId}`);
      break;

    case 'analysis:error':
      console.log(`\n[${timestamp}] ❌ ERROR: ${event.data.error}`);
      break;

    default:
      console.log(`\n[${timestamp}] Unknown event type: ${event.type}`);
  }
}

// Run the test
testAnalysisProgress().catch(console.error);