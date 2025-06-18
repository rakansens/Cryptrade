#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Snapshot Tester for UI Components');
console.log('=====================================\n');

// Run Jest with snapshot testing using default config and testMatch override
const command = `npx jest --testMatch="**/tests/regression/**/*.test.{ts,tsx}" --testEnvironment=jsdom --updateSnapshot=false --verbose`;

console.log('Running snapshot tests...\n');

const child = exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {

  if (error) {
    console.error('❌ Error running snapshot tests:', error.message);
    console.error('\nSTDERR:', stderr);
    console.log('\nSTDOUT:', stdout);
    process.exit(1);
  }

  console.log(stdout);
  
  // Parse results
  const snapshotObsoleteMatch = stdout.match(/(\d+) snapshot files? obsolete/);
  const snapshotFailedMatch = stdout.match(/(\d+) snapshots? failed/);
  const snapshotWrittenMatch = stdout.match(/(\d+) snapshots? written/);
  const snapshotPassedMatch = stdout.match(/(\d+) snapshots? passed/);

  const obsolete = snapshotObsoleteMatch ? parseInt(snapshotObsoleteMatch[1]) : 0;
  const failed = snapshotFailedMatch ? parseInt(snapshotFailedMatch[1]) : 0;
  const written = snapshotWrittenMatch ? parseInt(snapshotWrittenMatch[1]) : 0;
  const passed = snapshotPassedMatch ? parseInt(snapshotPassedMatch[1]) : 0;

  console.log('\n📊 Snapshot Test Summary');
  console.log('========================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📝 Written: ${written}`);
  console.log(`🗑️  Obsolete: ${obsolete}`);

  // Create summary
  const summary = {
    timestamp: new Date().toISOString(),
    componentsTestęd: ['AlertForm', 'AlertList', 'MainLayout'],
    snapshotsPassed: passed,
    snapshotsFailed: failed,
    snapshotsWritten: written,
    snapshotsObsolete: obsolete,
    visualChangesDetected: failed > 0 || written > 0 || obsolete > 0,
  };

  // Write summary to file
  fs.writeFileSync(
    path.join(__dirname, '..', 'snapshot-test-results.json'),
    JSON.stringify(summary, null, 2)
  );

  // Japanese summary
  const components = ['AlertForm', 'AlertList', 'MainLayout'];
  const changesDetected = failed > 0 || written > 0 || obsolete > 0;
  
  console.log('\n📋 日本語サマリー');
  console.log('================');
  console.log(`テスト済みコンポーネント: ${components.join(', ')}`);
  console.log(`視覚的変更検出: ${changesDetected ? 'あり' : 'なし'}`);
  
  if (changesDetected) {
    console.log(`\n変更内容:`);
    if (failed > 0) console.log(`- ${failed}件のスナップショット不一致`);
    if (written > 0) console.log(`- ${written}件の新規スナップショット`);
    if (obsolete > 0) console.log(`- ${obsolete}件の古いスナップショット`);
    console.log('\n推奨: スナップショットの更新を検討してください');
  } else {
    console.log('すべてのコンポーネントが期待通りに表示されています');
  }
});

// Pass through output in real-time
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);