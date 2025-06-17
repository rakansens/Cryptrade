// Quick test for pattern deletion issue
console.log('🔍 パターン削除問題のクイックテスト開始...\n');

// 1. アプリケーションを開く
console.log('1. ブラウザでアプリケーションを開いてください:');
console.log('   http://localhost:3000\n');

// 2. テスト手順
console.log('2. 以下の手順でテストしてください:\n');

console.log('   a) AIチャットで以下のメッセージを送信:');
console.log('      "チャート上でヘッドアンドショルダーパターンを探して、TP/SL/BOラインを含めて描画してください"\n');

console.log('   b) 提案が表示されたら「承認」ボタンをクリック\n');

console.log('   c) パターンが描画されたことを確認\n');

console.log('   d) 「取り消し」ボタンをクリック\n');

console.log('   e) TP/SL/BOラインが消えているか確認\n');

// 3. デバッグ情報の確認方法
console.log('3. デバッグ情報の確認:\n');

console.log('   ブラウザのコンソールで以下を実行:');
console.log('   - window.__debugPatternRenderers (全インスタンスを確認)');
console.log('   - window.__debugPatternRenderer.debugGetState() (現在の状態)');
console.log('   - window.__CHART_STORE.getState().patterns (ストアのパターン)\n');

// 4. ログの確認ポイント
console.log('4. コンソールログで確認すべきポイント:\n');

console.log('   - [PatternRenderer] Creating new instance');
console.log('     → instanceId を確認（複数作成されていないか）\n');

console.log('   - [PatternRenderer] Metric lines stored in map');
console.log('     → 保存時の instanceId と ID を確認\n');

console.log('   - [PatternRenderer] removePattern called');
console.log('     → 削除時の instanceId と ID を確認\n');

console.log('   - [PatternRenderer] No metric lines found for pattern');
console.log('     → このエラーが出た場合、ID の不一致を確認\n');

console.log('💡 ヒント: instanceId が異なる場合、PatternRenderer が再作成されている可能性があります。');
console.log('💡 ヒント: ID が異なる場合、保存時と削除時で ID の生成ロジックが異なる可能性があります。\n');

console.log('テストを実行してください...');