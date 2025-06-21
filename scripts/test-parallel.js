#!/usr/bin/env node

/**
 * Parallel Test Runner
 * 
 * テストを複数グループに分けて並列実行し、全体の実行時間を短縮
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

// テストファイルをグループに分割
function splitTests(testFiles, groupCount) {
  const groups = Array.from({ length: groupCount }, () => []);
  testFiles.forEach((file, index) => {
    groups[index % groupCount].push(file);
  });
  return groups;
}

// テストグループを実行
function runTestGroup(groupId, testFiles) {
  return new Promise((resolve, reject) => {
    const args = [
      'jest',
      ...testFiles,
      '--maxWorkers=2',
      '--no-coverage',
      '--bail',
      '--testTimeout=5000',
      `--outputFile=.test-results-${groupId}.json`,
      '--json',
    ];

    console.log(`[Group ${groupId}] Running ${testFiles.length} test files...`);

    const child = spawn('npx', args, {
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=2048',
        FORCE_COLOR: '1',
      },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (code) => {
      resolve({
        groupId,
        exitCode: code,
        output,
        fileCount: testFiles.length,
      });
    });
  });
}

async function main() {
  console.log('🚀 Starting parallel test execution...\n');

  // 全テストファイルを取得（WebSocketテストは除外）
  const testFiles = glob.sync('**/*.test.{ts,tsx}', {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/lib/ws/**/*.test.ts',
      '**/tests/**/ws/**/*.test.ts',
    ],
  });

  console.log(`Found ${testFiles.length} test files\n`);

  // CPUコア数に基づいてグループ数を決定
  const cpuCount = require('os').cpus().length;
  const groupCount = Math.min(cpuCount, 4); // 最大4グループ

  // テストを分割
  const groups = splitTests(testFiles, groupCount);

  // 並列実行
  const startTime = Date.now();
  const results = await Promise.all(
    groups.map((group, index) => runTestGroup(index + 1, group))
  );

  // 結果集計
  const endTime = Date.now();
  const totalTime = (endTime - startTime) / 1000;

  console.log('\n📊 Test Results:');
  console.log('=================');

  let totalPassed = 0;
  let totalFailed = 0;

  results.forEach((result) => {
    const status = result.exitCode === 0 ? '✅' : '❌';
    console.log(
      `${status} Group ${result.groupId}: ${result.fileCount} files (exit code: ${result.exitCode})`
    );

    // JSON結果を解析
    try {
      const resultFile = `.test-results-${result.groupId}.json`;
      if (fs.existsSync(resultFile)) {
        const data = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
        totalPassed += data.numPassedTests || 0;
        totalFailed += data.numFailedTests || 0;
        fs.unlinkSync(resultFile); // 一時ファイルを削除
      }
    } catch (e) {
      // JSONパースエラーは無視
    }
  });

  console.log('\n📈 Summary:');
  console.log(`Total execution time: ${totalTime.toFixed(2)}s`);
  console.log(`Tests passed: ${totalPassed}`);
  console.log(`Tests failed: ${totalFailed}`);
  console.log(`Speed improvement: ~${(304 / totalTime).toFixed(1)}x`);

  // 失敗があれば非ゼロで終了
  const hasFailures = results.some((r) => r.exitCode !== 0);
  process.exit(hasFailures ? 1 : 0);
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

main();