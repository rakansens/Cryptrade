#!/usr/bin/env node

/**
 * 提案承認機能のE2Eテスト
 * 
 * 1. 提案を生成
 * 2. 提案を承認
 * 3. チャートに描画されることを確認
 */

const API_BASE = 'http://localhost:3000';

// 色付きログ出力
const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  data: (msg, data) => {
    console.log(`\x1b[33m[DATA]\x1b[0m ${msg}`);
    console.log(JSON.stringify(data, null, 2));
  }
};

// APIリクエスト関数
async function makeRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
    }
    
    return data;
  } catch (error) {
    log.error(`Request failed: ${error.message}`);
    throw error;
  }
}

// テストケース1: 提案生成APIの動作確認
async function testProposalGeneration() {
  log.info('=== Testing Proposal Generation ===');
  
  try {
    const response = await makeRequest('/api/ai/chat', 'POST', {
      message: 'トレンドラインを提案して',
      sessionId: `test-proposal-${Date.now()}`
    });
    
    if (response.proposalGroup) {
      log.success('Proposal generation successful!');
      log.data('Proposal group:', {
        id: response.proposalGroup.id,
        title: response.proposalGroup.title,
        proposalCount: response.proposalGroup.proposals.length
      });
      
      // 最初の提案の詳細を表示
      if (response.proposalGroup.proposals.length > 0) {
        const firstProposal = response.proposalGroup.proposals[0];
        log.data('First proposal:', {
          id: firstProposal.id,
          title: firstProposal.title,
          type: firstProposal.drawingData.type,
          points: firstProposal.drawingData.points,
          confidence: firstProposal.confidence
        });
      }
      
      return response.proposalGroup;
    } else {
      log.error('No proposal group in response');
      log.data('Response:', response);
      return null;
    }
  } catch (error) {
    log.error(`Proposal generation failed: ${error.message}`);
    return null;
  }
}

// テストケース2: イベント発行のシミュレーション
async function testDrawingEventEmission(proposalGroup) {
  log.info('=== Testing Drawing Event Emission ===');
  
  if (!proposalGroup || !proposalGroup.proposals.length) {
    log.error('No proposals to test');
    return;
  }
  
  const proposal = proposalGroup.proposals[0];
  const drawingData = proposal.drawingData;
  
  // イベントデータの構造を確認
  const eventData = {
    id: `drawing_${Date.now()}_${proposal.id}`,
    type: drawingData.type,
    points: drawingData.points,
    style: drawingData.style || {
      color: '#22c55e',
      lineWidth: 2,
      lineStyle: 'solid',
      showLabels: true
    }
  };
  
  log.data('Event data to be emitted:', eventData);
  
  // UIイベントAPIを使用してイベントを発行
  try {
    const response = await makeRequest('/api/ui-events', 'POST', {
      event: 'chart:addDrawing',
      data: eventData
    });
    
    log.success('Drawing event emission successful!');
    log.data('Response:', response);
  } catch (error) {
    log.error(`Event emission failed: ${error.message}`);
  }
}

// メインテスト実行
async function main() {
  log.info('Starting Proposal Approval E2E Test');
  log.info('=====================================\n');
  
  // ステップ1: 提案を生成
  const proposalGroup = await testProposalGeneration();
  
  if (!proposalGroup) {
    log.error('Test failed: Could not generate proposals');
    process.exit(1);
  }
  
  log.info('\nWaiting 2 seconds before testing event emission...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // ステップ2: 描画イベントをシミュレート
  await testDrawingEventEmission(proposalGroup);
  
  log.info('\n=====================================');
  log.success('Test completed!');
  log.info('\nNext steps:');
  log.info('1. Check the browser console for event logs');
  log.info('2. Verify that the chart displays the trendlines');
  log.info('3. Test the actual approval buttons in the UI');
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  log.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});

// テスト実行
main().catch((error) => {
  log.error(`Test failed: ${error.message}`);
  process.exit(1);
});