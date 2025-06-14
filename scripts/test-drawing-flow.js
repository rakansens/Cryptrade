#!/usr/bin/env node

/**
 * トレンドライン描画フローのデバッグテスト
 * A2A → Tool → Event → UI の全体フローを検証
 */

const { registerAllAgents } = require('../lib/mastra/network/agent-registry');
const { agentNetwork } = require('../lib/mastra/network/agent-network');

async function testDrawingFlow() {
  console.log('=== Drawing Flow Debug Test ===\n');

  try {
    // 1. エージェント登録
    console.log('[1] Registering agents...');
    registerAllAgents();
    console.log('✓ Agents registered\n');

    // 2. UI制御エージェントに直接メッセージ送信
    console.log('[2] Sending drawing request to UI Control Agent...');
    const drawQuery = 'トレンドラインを引いて';
    
    const result = await agentNetwork.sendMessage(
      'orchestratorAgent',
      'uiControlAgent',
      'process_query',
      { 
        query: drawQuery,
        context: {
          chartData: {
            currentSymbol: 'BTCUSDT',
            currentTimeframe: '1h',
            priceRange: { high: 106000, low: 104000 }
          }
        }
      },
      `test-draw-${Date.now()}`
    );

    console.log('\n[3] A2A Result:');
    console.log('- Type:', result?.type);
    console.log('- Source:', result?.source);
    console.log('- Target:', result?.target);
    
    if (result?.type === 'response') {
      console.log('\n[4] Response Details:');
      console.log('- Result type:', typeof result.result);
      console.log('- Result preview:', result.result?.substring(0, 200));
      
      // レスポンスの構造を詳しく調査
      try {
        const parsed = JSON.parse(result.result);
        console.log('\n[5] Parsed Response Structure:');
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('\n[5] Response is not JSON:', result.result);
      }
    }

    // 3. Agent Selection Toolでの処理確認
    console.log('\n\n=== Agent Selection Tool Test ===\n');
    const { agentSelectionTool } = require('../lib/mastra/tools/agent-selection.tool');
    
    // A2A結果を模擬してbroadcastUIOperationsがどう動くか確認
    const mockA2AResult = {
      success: true,
      targetAgent: 'uiControlAgent',
      response: 'Test response',
      // steps構造でtoolResultsを含む（実際のA2A通信の構造）
      steps: [{
        toolResults: [{
          toolName: 'chartControlTool',
          result: {
            success: true,
            operations: [{
              type: 'drawing_operation',
              action: 'draw_trendline',
              parameters: { points: [
                { x: 100, y: 200, price: 105000, time: Date.now() - 3600000 },
                { x: 300, y: 150, price: 106000, time: Date.now() }
              ]},
              clientEvent: {
                event: 'draw:trendline',
                data: { points: [
                  { x: 100, y: 200, price: 105000, time: Date.now() - 3600000 },
                  { x: 300, y: 150, price: 106000, time: Date.now() }
                ]}
              }
            }]
          }
        }]
      }]
    };
    
    console.log('Mock A2A Result Structure:');
    console.log(JSON.stringify(mockA2AResult, null, 2));
    
    // 4. Chart Control Toolを直接テスト
    console.log('\n\n=== Direct Chart Control Tool Test ===\n');
    const { chartControlTool } = require('../lib/mastra/tools/chart-control.tool');
    
    const toolResult = await chartControlTool.execute({
      context: {
        userRequest: drawQuery,
        conversationHistory: [],
        currentState: {
          symbol: 'BTCUSDT',
          timeframe: '1h'
        }
      }
    });

    console.log('\n[Tool Result]:');
    console.log('- Success:', toolResult.success);
    console.log('- Operations count:', toolResult.operations?.length || 0);
    console.log('- Response:', toolResult.response);
    
    if (toolResult.operations && toolResult.operations.length > 0) {
      console.log('\n[Operations Detail]:');
      toolResult.operations.forEach((op, idx) => {
        console.log(`\nOperation ${idx + 1}:`);
        console.log('- Type:', op.type);
        console.log('- Action:', op.action);
        console.log('- Parameters:', JSON.stringify(op.parameters, null, 2));
        console.log('- Client Event:', op.clientEvent);
        console.log('- Execution Mode:', op.executionMode);
      });
    }

  } catch (error) {
    console.error('\n[ERROR]', error.message);
    console.error('Stack:', error.stack);
  }
}

// 実行
testDrawingFlow()
  .then(() => {
    console.log('\n✓ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  });