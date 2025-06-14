// test-current-trendline.js
// Test trendline drawing with current time range

async function testCurrentTrendline() {
  console.log('🎯 Testing trendline with current time...\n');

  try {
    // First, get current market data to understand the time range
    const klinesResponse = await fetch('http://localhost:3000/api/binance/klines?symbol=BTCUSDT&interval=1h&limit=100');
    const klines = await klinesResponse.json();
    
    console.log('📊 Market data info:');
    console.log(`  Total candles: ${klines.length}`);
    if (klines.length > 0) {
      const firstTime = new Date(klines[0].time);
      const lastTime = new Date(klines[klines.length - 1].time);
      console.log(`  First candle: ${firstTime.toISOString()}`);
      console.log(`  Last candle: ${lastTime.toISOString()}`);
      console.log(`  Time range: ${((lastTime - firstTime) / (1000 * 60 * 60)).toFixed(1)} hours`);
      
      // Get recent price range
      const recentKlines = klines.slice(-20);
      const prices = recentKlines.flatMap(k => [k.high, k.low]);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      console.log(`  Recent price range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`);
    }

    // Send trendline request with more details
    const message = "現在のチャートに見やすいトレンドラインを1本引いて";
    
    console.log(`\n📤 Sending: "${message}"`);

    const response = await fetch('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sessionId: 'test-current-' + Date.now()
      }),
    });

    if (!response.ok) {
      console.error('❌ API request failed:', response.status);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let trendlineData = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.event === 'tool_result' && data.data.name === 'chartControl') {
              const result = JSON.parse(data.data.result);
              if (result.operations && result.operations[0] && result.operations[0].clientEvent) {
                trendlineData = result.operations[0].clientEvent.data;
                console.log('\n✅ Trendline data generated:');
                console.log(JSON.stringify(trendlineData, null, 2));
                
                if (trendlineData.points) {
                  console.log('\n📍 Point details:');
                  trendlineData.points.forEach((p, i) => {
                    const date = new Date(p.time);
                    console.log(`  Point ${i + 1}:`);
                    console.log(`    Time: ${p.time} (${date.toISOString()})`);
                    console.log(`    Price: $${p.price.toFixed(2)}`);
                  });
                  
                  // Check if times are reasonable
                  const now = Date.now();
                  const p1Age = (now - trendlineData.points[0].time) / (1000 * 60 * 60);
                  const p2Age = (now - trendlineData.points[1].time) / (1000 * 60 * 60);
                  console.log(`\n⏰ Time check:`);
                  console.log(`  Point 1 is ${p1Age.toFixed(1)} hours from now`);
                  console.log(`  Point 2 is ${p2Age.toFixed(1)} hours from now`);
                  
                  if (p1Age > 1000) {
                    console.log('  ⚠️ WARNING: Points are in the future!');
                  }
                }
              }
            }
            
            if (data.event === 'content' && data.data.text) {
              console.log('\n💬 Assistant:', data.data.text.substring(0, 100) + '...');
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCurrentTrendline().catch(console.error);