#!/usr/bin/env node

/**
 * Orchestrator経由でのUI操作テスト
 * 実際のチャット入力をシミュレート
 */

const { registerAllAgents } = require('../lib/mastra/network/agent-registry');
const { orchestratorAgent } = require('../lib/mastra/agents/orchestrator.agent');

async function testOrchestratorUI() {
  console.log('=== Orchestrator UI Control Test ===\n');

  try {
    // 1. エージェント登録
    console.log('[1] Registering agents...');
    registerAllAgents();
    console.log('✓ Agents registered\n');

    // 2. Orchestratorに直接メッセージ送信
    console.log('[2] Sending message to Orchestrator...');
    const messages = [
      {
        role: 'user',
        content: 'トレンドラインを引いて'
      }
    ];
    
    console.log('Messages:', JSON.stringify(messages, null, 2));
    
    const response = await orchestratorAgent.generate(messages, {
      maxSteps: 10,
      experimental_telemetry: { isEnabled: false }
    });
    
    console.log('\n[3] Orchestrator Response:');
    console.log('- Type:', typeof response);
    console.log('- Has text:', !!response.text);
    console.log('- Has steps:', !!response.steps);
    console.log('- Steps count:', response.steps?.length || 0);
    
    if (response.steps) {
      console.log('\n[4] Steps Analysis:');
      response.steps.forEach((step, idx) => {
        console.log(`\nStep ${idx + 1}:`);
        console.log('- Step type:', step.stepType);
        console.log('- Has tool calls:', !!step.toolCalls);
        console.log('- Has tool results:', !!step.toolResults);
        
        if (step.toolCalls) {
          console.log('- Tool calls:');
          step.toolCalls.forEach(tc => {
            console.log(`  * ${tc.toolName}`);
            if (tc.toolName === 'agentSelectionTool') {
              console.log('    Args:', JSON.stringify(tc.args, null, 4));
            }
          });
        }
        
        if (step.toolResults) {
          console.log('- Tool results:');
          step.toolResults.forEach(tr => {
            console.log(`  * ${tr.toolName}:`, tr.result?.success);
            if (tr.toolName === 'agentSelectionTool' && tr.result?.executionResult) {
              console.log('    ExecutionResult keys:', Object.keys(tr.result.executionResult));
              console.log('    Has data:', !!tr.result.executionResult.data);
              console.log('    Has response:', !!tr.result.executionResult.response);
            }
          });
        }
      });
    }

    // 5. 最終レスポンス
    console.log('\n[5] Final Response:');
    console.log(response.text?.substring(0, 200) + '...');

  } catch (error) {
    console.error('\n[ERROR]', error.message);
    console.error('Stack:', error.stack);
  }
}

// 実行
testOrchestratorUI()
  .then(() => {
    console.log('\n✓ Test completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  });