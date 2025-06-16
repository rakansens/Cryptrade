#!/usr/bin/env tsx
/**
 * TypeDocと実装の不整合を検出するスクリプト
 * 
 * 検出項目:
 * - TODOコメントがある関数
 * - 空の実装（return []のみ）
 * - Placeholderコメント
 * - 未実装のthrow文
 */

import { readFileSync } from 'fs';
import { relative } from 'path';
import { glob } from 'glob';

interface Issue {
  file: string;
  line: number;
  type: 'TODO' | 'EMPTY_IMPL' | 'PLACEHOLDER' | 'NOT_IMPLEMENTED';
  message: string;
  functionName?: string;
}

function findIssuesInFile(filePath: string): Issue[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: Issue[] = [];
  const relativePath = relative(process.cwd(), filePath);

  // 関数名を追跡
  let currentFunction: string | undefined;

  lines.forEach((line, index) => {
    // 関数定義を検出
    const functionMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[\w\[\]<>]+)?\s*{/);
    if (functionMatch) {
      currentFunction = functionMatch[1] || functionMatch[2];
    }

    // メソッド定義を検出（クラス内）
    const methodMatch = line.match(/^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[\w\[\]<>|]+)?\s*{/);
    if (methodMatch && !line.includes('constructor')) {
      currentFunction = methodMatch[1];
    }

    // TODOコメントを検出
    if (line.includes('TODO:') || line.includes('// TODO')) {
      issues.push({
        file: relativePath,
        line: index + 1,
        type: 'TODO',
        message: line.trim(),
        ...(currentFunction && { functionName: currentFunction })
      });
    }

    // FIXMEコメントを検出
    if (line.includes('FIXME:') || line.includes('// FIXME')) {
      issues.push({
        file: relativePath,
        line: index + 1,
        type: 'TODO',
        message: line.trim(),
        ...(currentFunction && { functionName: currentFunction })
      });
    }

    // Placeholderコメントを検出
    if (line.toLowerCase().includes('placeholder')) {
      issues.push({
        file: relativePath,
        line: index + 1,
        type: 'PLACEHOLDER',
        message: line.trim(),
        ...(currentFunction && { functionName: currentFunction })
      });
    }

    // 空の実装を検出（return []）
    if (line.trim() === 'return [];' && currentFunction) {
      // 前後の行を確認して、実際に空の実装かチェック
      const prevLine = lines[index - 1]?.trim() || '';
      const nextLine = lines[index + 1]?.trim() || '';
      
      if (prevLine.includes('TODO') || prevLine.includes('Placeholder') || nextLine === '}') {
        issues.push({
          file: relativePath,
          line: index + 1,
          type: 'EMPTY_IMPL',
          message: `Empty implementation: ${currentFunction}() returns empty array`,
          functionName: currentFunction
        });
      }
    }

    // not implementedエラーを検出
    if (line.includes('throw new Error') && line.toLowerCase().includes('not implemented')) {
      issues.push({
        file: relativePath,
        line: index + 1,
        type: 'NOT_IMPLEMENTED',
        message: line.trim(),
        ...(currentFunction && { functionName: currentFunction })
      });
    }

    // 関数の終了を検出
    if (line.trim() === '}' && currentFunction) {
      // ネストレベルを考慮する簡易的な方法
      const openBraces = content.substring(0, content.split('\n').slice(0, index + 1).join('\n').length).split('{').length;
      const closeBraces = content.substring(0, content.split('\n').slice(0, index + 1).join('\n').length).split('}').length;
      if (openBraces === closeBraces) {
        currentFunction = undefined;
      }
    }
  });

  return issues;
}

async function main() {
  console.log('🔍 TypeDoc TODO/未実装チェッカー\n');

  // libディレクトリ内のTypeScriptファイルを検索
  const files = await glob('lib/**/*.ts', {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
  });

  const allIssues: Issue[] = [];

  for (const file of files) {
    const issues = findIssuesInFile(file);
    allIssues.push(...issues);
  }

  // 結果を表示
  if (allIssues.length === 0) {
    console.log('✅ 未実装やTODOは見つかりませんでした！');
    return;
  }

  // タイプ別に分類
  const todoIssues = allIssues.filter(i => i.type === 'TODO');
  const emptyImplIssues = allIssues.filter(i => i.type === 'EMPTY_IMPL');
  const placeholderIssues = allIssues.filter(i => i.type === 'PLACEHOLDER');
  const notImplementedIssues = allIssues.filter(i => i.type === 'NOT_IMPLEMENTED');

  // サマリーを表示
  console.log('📊 サマリー:');
  console.log(`  TODOコメント: ${todoIssues.length}件`);
  console.log(`  空の実装: ${emptyImplIssues.length}件`);
  console.log(`  Placeholder: ${placeholderIssues.length}件`);
  console.log(`  未実装エラー: ${notImplementedIssues.length}件`);
  console.log(`  合計: ${allIssues.length}件\n`);

  // 詳細を表示
  if (todoIssues.length > 0) {
    console.log('📝 TODOコメント:');
    todoIssues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} ${issue.functionName ? `[${issue.functionName}]` : ''}`);
      console.log(`    ${issue.message}\n`);
    });
  }

  if (emptyImplIssues.length > 0) {
    console.log('🚫 空の実装:');
    emptyImplIssues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} ${issue.message}\n`);
    });
  }

  if (placeholderIssues.length > 0) {
    console.log('🏗️  Placeholder:');
    placeholderIssues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} ${issue.functionName ? `[${issue.functionName}]` : ''}`);
      console.log(`    ${issue.message}\n`);
    });
  }

  if (notImplementedIssues.length > 0) {
    console.log('❌ 未実装エラー:');
    notImplementedIssues.forEach(issue => {
      console.log(`  ${issue.file}:${issue.line} ${issue.functionName ? `[${issue.functionName}]` : ''}`);
      console.log(`    ${issue.message}\n`);
    });
  }

  // TypeDocで特に注意すべきファイル
  const criticalFiles = allIssues
    .filter(issue => issue.functionName && (issue.type === 'EMPTY_IMPL' || issue.type === 'NOT_IMPLEMENTED'))
    .map(issue => ({
      file: issue.file,
      function: issue.functionName!,
      type: issue.type
    }));

  if (criticalFiles.length > 0) {
    console.log('⚠️  TypeDocに表示されているが実装されていない関数:');
    criticalFiles.forEach(item => {
      console.log(`  ${item.file} - ${item.function}() [${item.type}]`);
    });
  }

  // 終了コード
  process.exit(allIssues.length > 0 ? 1 : 0);
}

main().catch(console.error);