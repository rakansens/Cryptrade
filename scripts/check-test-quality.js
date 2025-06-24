#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * テスト品質チェックスクリプト
 * CI/CDパイプラインで実行し、テストの品質問題を検出します
 */

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

let hasErrors = false;
const issues = [];

/**
 * ファイルを再帰的に検索
 */
function findFiles(dir, pattern) {
  const results = [];
  
  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        walk(filePath);
      } else if (stat.isFile() && pattern.test(file)) {
        results.push(filePath);
      }
    }
  }
  
  walk(dir);
  return results;
}

/**
 * テストファイルの内容をチェック
 */
function checkTestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.relative(process.cwd(), filePath);
  const fileIssues = [];
  
  // 1. 自己モックのチェック
  const serviceName = path.basename(filePath).replace('.test.ts', '').replace('.test.js', '');
  const selfMockPattern = new RegExp(`jest\\.mock\\(['"]\\..*${serviceName}['"]\\)`, 'g');
  
  if (selfMockPattern.test(content)) {
    fileIssues.push({
      type: 'error',
      message: 'Self-mocking detected - test is mocking the service it should be testing',
      pattern: selfMockPattern.source
    });
  }
  
  // 2. スキップされたテストのチェック（理由なし）
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('.skip(') || line.includes('xit(')) {
      // 次の行にTODOやコメントがあるかチェック
      const nextLines = lines.slice(index + 1, index + 5).join(' ');
      if (!nextLines.includes('TODO') && !nextLines.includes('FIXME') && !nextLines.includes('Issue')) {
        fileIssues.push({
          type: 'warning',
          line: index + 1,
          message: 'Skipped test without explanation',
          code: line.trim()
        });
      }
    }
  });
  
  // 3. ハードコードされた日付
  const hardcodedDatePattern = /new Date\(['"](\d{4})-(\d{2})-(\d{2})/g;
  const dateMatches = [...content.matchAll(hardcodedDatePattern)];
  
  dateMatches.forEach(match => {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    fileIssues.push({
      type: 'warning',
      line: lineNumber,
      message: 'Hardcoded date detected',
      code: match[0]
    });
  });
  
  // 4. バリデーションロジックのモック
  const validationMockPattern = /jest\.mock\([^)]*validate[^)]*\)/gi;
  if (validationMockPattern.test(content)) {
    fileIssues.push({
      type: 'error',
      message: 'Validation logic is being mocked',
      pattern: validationMockPattern.source
    });
  }
  
  // 5. 曖昧なアサーション
  const vagueAssertionPattern = /expect\([^)]+\)\.toBe\((true|false)\)/g;
  const vagueMatches = [...content.matchAll(vagueAssertionPattern)];
  
  // 型ガード関数のテストは除外
  const isTypeGuardTest = fileName.includes('.types.test.') || 
                         content.includes('type guard') || 
                         content.includes('isValid');
  
  if (vagueMatches.length > 10 && !isTypeGuardTest) {
    fileIssues.push({
      type: 'warning',
      message: `Too many vague assertions (${vagueMatches.length} instances of .toBe(true/false))`,
      suggestion: 'Consider using more specific assertions'
    });
  }
  
  // 6. console.logの残存
  const consoleLogPattern = /console\.(log|error|warn|debug)\(/g;
  const consoleMatches = [...content.matchAll(consoleLogPattern)];
  
  consoleMatches.forEach(match => {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    fileIssues.push({
      type: 'warning',
      line: lineNumber,
      message: 'Console statement in test',
      code: match[0]
    });
  });
  
  if (fileIssues.length > 0) {
    issues.push({
      file: fileName,
      issues: fileIssues
    });
    
    if (fileIssues.some(issue => issue.type === 'error')) {
      hasErrors = true;
    }
  }
}

/**
 * テストカバレッジをチェック
 */
function checkTestCoverage() {
  try {
    console.log(`${colors.blue}Checking test coverage...${colors.reset}`);
    
    // カバレッジレポートを生成
    execSync('npm test -- --coverage --silent', { 
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    // カバレッジサマリーを読み込む
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    if (fs.existsSync(coveragePath)) {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      const total = coverage.total;
      
      console.log(`\n${colors.blue}Coverage Summary:${colors.reset}`);
      console.log(`  Lines:       ${total.lines.pct}%`);
      console.log(`  Statements:  ${total.statements.pct}%`);
      console.log(`  Functions:   ${total.functions.pct}%`);
      console.log(`  Branches:    ${total.branches.pct}%`);
      
      if (total.lines.pct < 80) {
        issues.push({
          file: 'Coverage',
          issues: [{
            type: 'warning',
            message: `Line coverage (${total.lines.pct}%) is below 80% threshold`
          }]
        });
      }
    }
  } catch (error) {
    console.log(`${colors.yellow}Could not generate coverage report${colors.reset}`);
  }
}

/**
 * 結果を表示
 */
function displayResults() {
  console.log(`\n${colors.blue}=== Test Quality Check Results ===${colors.reset}\n`);
  
  if (issues.length === 0) {
    console.log(`${colors.green}✓ No quality issues found!${colors.reset}`);
    return;
  }
  
  issues.forEach(({ file, issues: fileIssues }) => {
    console.log(`${colors.yellow}${file}${colors.reset}`);
    
    fileIssues.forEach(issue => {
      const prefix = issue.type === 'error' ? `${colors.red}✗` : `${colors.yellow}⚠`;
      const lineInfo = issue.line ? `:${issue.line}` : '';
      
      console.log(`  ${prefix} ${issue.message}${lineInfo}${colors.reset}`);
      
      if (issue.code) {
        console.log(`    ${colors.blue}>${colors.reset} ${issue.code}`);
      }
      
      if (issue.suggestion) {
        console.log(`    ${colors.blue}→${colors.reset} ${issue.suggestion}`);
      }
    });
    
    console.log('');
  });
  
  const errorCount = issues.reduce((sum, { issues }) => 
    sum + issues.filter(i => i.type === 'error').length, 0
  );
  const warningCount = issues.reduce((sum, { issues }) => 
    sum + issues.filter(i => i.type === 'warning').length, 0
  );
  
  console.log(`${colors.blue}Summary:${colors.reset}`);
  console.log(`  ${colors.red}Errors: ${errorCount}${colors.reset}`);
  console.log(`  ${colors.yellow}Warnings: ${warningCount}${colors.reset}`);
}

/**
 * メイン処理
 */
function main() {
  const args = process.argv.slice(2);
  const skipCoverage = args.includes('--no-coverage');
  
  console.log(`${colors.blue}Starting test quality check...${colors.reset}\n`);
  
  // テストファイルを検索
  const testDir = path.join(process.cwd(), 'tests');
  const testFiles = findFiles(testDir, /\.(test|spec)\.(ts|js)$/);
  
  console.log(`Found ${testFiles.length} test files\n`);
  
  // 各テストファイルをチェック
  testFiles.forEach(file => {
    checkTestFile(file);
  });
  
  // カバレッジをチェック（オプション）
  if (!skipCoverage) {
    checkTestCoverage();
  }
  
  // 結果を表示
  displayResults();
  
  // エラーがある場合は終了コード1で終了
  if (hasErrors) {
    console.log(`\n${colors.red}Test quality check failed!${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}Test quality check passed!${colors.reset}`);
    process.exit(0);
  }
}

// 実行
if (require.main === module) {
  main();
}