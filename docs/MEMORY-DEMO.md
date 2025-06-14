# Memory機能の動作デモ

## 🎯 デモ実行方法

### 1. 環境準備
```bash
# 環境変数の設定
export OPENAI_API_KEY="your-api-key"
export TELEMETRY_SAMPLING_RATE=0.001  # 0.1%サンプリング

# 依存関係のインストール
npm install
```

### 2. 単体デモ実行（AIエージェント直接実行）
```bash
npm run test:memory-demo
```

このコマンドで以下の動作を確認できます：
- 会話履歴の自動記録
- コンテキスト参照による文脈理解
- セマンティック検索
- テレメトリー情報の表示

### 3. API統合テスト（サーバー経由）
```bash
# まず開発サーバーを起動
npm run dev

# 別ターミナルでテスト実行
npm run test:memory-api
```

## 📊 実行結果の見方

### Memory機能デモの出力例

```
🧠 Memory機能デモンストレーション開始

=== テレメトリー設定 ===
Sampling Rate: 0.001
Environment: development
Telemetry Mode: Always On

✅ 新しいセッション作成: demo-session-1234567890

📝 シナリオ1: 初回の質問
User: "BTCの現在価格を教えて"

🤖 Orchestrator分析結果:
Intent: price_inquiry
Confidence: 0.9
Symbol: BTCUSDT
実行時間: 245ms

📚 メモリコンテキスト:
User: BTCの現在価格を教えて

=== セッション情報 ===
Session ID: demo-session-1234567890
Messages: 2
Started: 2025/1/3 15:30:00
Last Active: 2025/1/3 15:30:01

📝 シナリオ2: フォローアップ質問（文脈依存）
User: "それを詳しく分析して"

🤖 Orchestrator分析結果:
Intent: trading_analysis
Confidence: 0.85
実行時間: 189ms

=== 最新5件のメッセージ ===
1. User: BTCの現在価格を教えて...
   Metadata: {"symbols":["BTC"],"topics":["price"]}
2. Assistant: BTCは現在$45,000で取引されています...
   Metadata: {"intent":"price_inquiry","confidence":0.9}
3. User: それを詳しく分析して...
   Metadata: {"topics":["analysis"]}
```

### 主要な確認ポイント

1. **メモリ永続化**
   - セッション間で会話履歴が保持される
   - ブラウザリロード後も履歴が残る

2. **コンテキスト理解**
   - 「それを」のような指示語を理解
   - 前の会話内容を参照した応答

3. **セマンティック検索**
   - 「価格について聞いたこと」で関連メッセージを検索
   - 意味的類似度による検索結果

4. **メタデータ自動抽出**
   - symbols: ["BTC", "ETH"]
   - topics: ["price", "analysis", "chart"]
   - intent分類とconfidence

5. **テレメトリー情報**
   - サンプリングレート確認
   - 環境別の動作モード

## 🔍 トラブルシューティング

### OpenAI APIエラー
```
エラー: Failed to generate embedding
```
→ `OPENAI_API_KEY`が正しく設定されているか確認

### メモリ関連エラー
```
[ConversationMemory] Session not found
```
→ セッションIDが正しいか確認、または新規セッション作成

### パフォーマンス問題
- 埋め込み生成は非同期で実行される
- キャッシュにより2回目以降は高速化
- セマンティック検索は初回のみ遅い可能性あり

## 📈 パフォーマンスメトリクス

典型的な実行時間：
- 意図分析: 150-300ms
- メモリ追加: 10-20ms
- セマンティック検索: 500-1000ms（初回）
- キャッシュヒット時: 50-100ms

## 🎥 デモシナリオ

1. **基本的な会話フロー**
   - 価格質問 → 詳細分析要求 → チャート操作

2. **文脈参照デモ**
   - 「BTCの価格は？」→「それについてもっと詳しく」

3. **マルチセッション**
   - 複数セッション作成して個別管理を確認

4. **検索機能デモ**
   - 過去の会話からキーワード検索
   - セマンティック検索で関連内容を発見