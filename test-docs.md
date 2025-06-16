# Cryptrade テストドキュメント

このドキュメントは、Cryptradeプロジェクトの主要なテストケースとその実装について説明します。

## 目次

- [チャート分析](#チャート分析)
- [インジケーター](#インジケーター)
- [ユーティリティ](#ユーティリティ)
- [API関連](#api関連)
- [フック](#フック)

---

## チャート分析

### ChartAnalyzer (`lib/chart/analyzer.test.ts`)

チャート分析クラスのテスト。トレンドラインとサポート・レジスタンスラインの検出機能をテストします。

**主要なテストケース:**

- **初期化**
  - `creates analyzer instance with data` - データを使用してアナライザーインスタンスを作成
  - `stores data internally` - データが内部に保存され、メソッドが呼び出し可能

- **トレンドライン検出** (`detectTrendLines`)
  - `returns empty array (placeholder implementation)` - 現在はプレースホルダー実装で空配列を返す
  - `accepts configuration parameters` - 設定パラメータを受け入れる
  - `TODO: should detect upward trend lines` - 上昇トレンドラインを検出（未実装）
  - `TODO: should detect downward trend lines` - 下降トレンドラインを検出（未実装）

- **サポート・レジスタンス検出** (`detectSupportResistance`)
  - `returns empty array (placeholder implementation)` - 現在はプレースホルダー実装で空配列を返す
  - `accepts configuration object` - 設定オブジェクトを受け入れる
  - `TODO: should detect support levels` - サポートレベルを検出（未実装）
  - `TODO: should detect resistance levels` - レジスタンスレベルを検出（未実装）

- **エッジケース**
  - `handles empty data array` - 空のデータ配列を処理
  - `handles single data point` - 単一のデータポイントを処理
  - `handles invalid configuration gracefully` - 無効な設定を適切に処理

### PatternRenderer (`lib/chart/pattern-renderer.test.ts`)

パターンレンダラーのテスト。チャート上のパターンを描画する機能をテストします。

---

## インジケーター

### RSI (`lib/indicators/rsi.test.ts`)

相対力指数（RSI）の計算とユーティリティ関数のテスト。

**主要なテストケース:**

- **基本的な計算** (`calculateRSI`)
  - `should calculate RSI with default period (14)` - デフォルト期間（14）でRSIを計算
  - `should calculate RSI with custom period` - カスタム期間でRSIを計算
  - `should return empty array when insufficient data` - データ不足時は空配列を返す
  - `should handle minimum required data points` - 最小必要データポイントを処理

- **RSI極値**
  - `should approach 100 in strong uptrend` - 強い上昇トレンドでは100に近づく
  - `should approach 0 in strong downtrend` - 強い下降トレンドでは0に近づく
  - `should be around 50 for sideways market` - 横ばい市場では50前後

- **Wilderのスムージング**
  - `should use Wilder's smoothing method correctly` - Wilderのスムージング手法を正しく使用
  - `should produce smooth RSI values` - スムーズなRSI値を生成

- **エッジケース**
  - `should handle constant price (RSI = 50)` - 価格一定時の処理（RSI = 100）
  - `should handle only gains correctly` - 上昇のみの場合を正しく処理（RSI = 100）
  - `should handle only losses correctly` - 下落のみの場合を正しく処理（RSI = 0）
  - `should maintain time alignment` - 時間の整合性を維持

- **ユーティリティ関数**
  - `getRSIColor` - RSI値に基づいて色を返す（70以上:赤、30以下:ティール、その他:紫）
  - `getRSISignal` - RSI値に基づいてシグナルを返す（overbought/oversold/neutral）

### MACD (`lib/indicators/macd.test.ts`)

MACD（移動平均収束拡散法）の計算テスト。

### ボリンジャーバンド (`lib/indicators/bollinger-bands.test.ts`)

ボリンジャーバンドの計算テスト。

---

## ユーティリティ

### RetryWrapper (`lib/utils/retry-wrapper.test.ts`)

リトライ機能を提供するラッパークラスのテスト。

**主要なテストケース:**

- **execute メソッド**
  - `should succeed on first attempt` - 初回試行で成功
  - `should retry and succeed on second attempt` - リトライして2回目で成功
  - `should fail after all retries exhausted` - すべてのリトライが尽きた後に失敗
  - `should apply exponential backoff` - 指数バックオフを適用
  - `should respect maxDelay` - 最大遅延時間を遵守

- **wrap メソッド**
  - `should create a retryable function` - リトライ可能な関数を作成

### ValidationUtils (`lib/utils/validation.test.ts`)

バリデーションユーティリティのテスト。

### LoggerUtils (`lib/utils/logger.test.ts`)

ロギングユーティリティのテスト。

---

## API関連

### API ハンドラー作成 (`lib/api/create-api-handler.test.ts`)

APIハンドラーの作成と処理のテスト。

### ストリーミング (`lib/api/streaming.test.ts`)

ストリーミングAPIのテスト。

### ミドルウェア (`lib/api/middleware.test.ts`)

APIミドルウェアのテスト。

### エラーハンドリング (`lib/api/error-boundary.test.ts`)

エラー境界とエラーハンドリングのテスト。

---

## フック

### useAIChat (`hooks/__tests__/use-ai-chat.test.ts`)

AIチャット機能のカスタムフックのテスト。

### useCandlestickData (`hooks/market/__tests__/use-candlestick-data.test.ts`)

ローソク足データを取得・管理するフックのテスト。

### useAsyncState (`hooks/base/__tests__/use-async-state.test.ts`)

非同期状態管理のベースフックのテスト。

---

## テスト実行

### 全テストの実行

```bash
npm test
```

### 特定のテストファイルの実行

```bash
npm test -- path/to/test-file.test.ts
```

### カバレッジレポート付きでテストを実行

```bash
npm run test:coverage
```

### ウォッチモードでテストを実行

```bash
npm test -- --watch
```

---

## テスト命名規則

テスト名は以下の規則に従います：

1. **動作を明確に説明する** - `should [期待される動作]` の形式を使用
2. **状態や条件を含める** - `when [条件], should [動作]` の形式を使用
3. **TODOマーカーを使用** - 未実装の機能には `TODO:` プレフィックスを付ける
4. **日本語コメントを活用** - 複雑なロジックには日本語でコメントを追加

## テストのベストプラクティス

1. **AAA パターン** - Arrange（準備）、Act（実行）、Assert（検証）の構造を維持
2. **独立性** - 各テストは他のテストに依存しない
3. **明確なアサーション** - 何をテストしているか明確にする
4. **エッジケースのカバー** - 正常系だけでなく異常系もテスト
5. **モックの適切な使用** - 外部依存はモック化する

---

## 貢献ガイドライン

新しいテストを追加する際は：

1. 対応する実装ファイルと同じディレクトリ構造でテストファイルを配置
2. テストファイル名は `*.test.ts` の形式にする
3. 各テストケースに適切な説明を記載
4. 実装とテストのドキュメントの同期を保つ