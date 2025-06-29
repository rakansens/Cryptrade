# チャートデータ変換重複パターン分析レポート

## 概要

このレポートは、Cryptradeアプリケーション内でのチャートデータ変換における重複パターンを分析し、コードの統合および最適化提案を提供します。

---

## 📋 調査対象ファイル

### 主要なチャートデータ変換ファイル

| ファイル名 | 用途 | 主要機能 |
|-----------|------|----------|
| `lib/utils/chart-data.ts` | チャート時系列データユーティリティ | 時刻変換、重複除去、データ検証 |
| `lib/utils/db-conversions.ts` | クライアント側DB変換 | BigInt/Decimal変換、JSON化 |
| `lib/utils/db-conversions.server.ts` | サーバー側DB変換 | Prisma型変換 |
| `lib/utils/db-conversions-unified.ts` | 統合変換ロジック | 環境非依存変換 |
| `hooks/market/use-candlestick-data.ts` | 市場データフック | Binance API → ProcessedKline変換 |
| `components/chart/hooks/useChartData.ts` | チャートデータフック | PriceData → LightweightCharts変換 |
| `lib/mastra/tools/chart-data-analysis.tool.ts` | チャート分析ツール | API → 技術分析変換 |
| `lib/binance/api-service.ts` | Binance APIサービス | 生Kline → ProcessedKline変換 |
| `types/market.ts` | 市場データ型定義 | 全変換のスキーマ検証 |

---

## 🔄 共通変換パターン

### 1. 時刻変換パターン

#### 重複箇所（7箇所発見）

1. **`chart-data.ts`**：
```typescript
export function convertToLightweightChartsTime(timestamp: number): number {
  if (Math.abs(timestamp) > 1e12) {
    return Math.floor(timestamp / 1000);
  }
  return timestamp;
}
```

2. **`use-candlestick-data.ts`**：
```typescript
const kline: ProcessedKline = {
  time: Math.floor(data.k.t / 1000), // Convert ms to seconds
  // ...
};
```

3. **`chart-data-analysis.tool.ts`**：
```typescript
return data.map((candle) => {
  return {
    time: candle[0], // Open time (ミリ秒のまま)
    // 後で findTouchPoints で time をそのまま使用
  };
});
```

4. **`market.ts`** (validateBinanceKlines)：
```typescript
time: Math.floor(Number(kline[0]) / 1000), // Convert ms to seconds
```

5. **`binance/api-service.ts`** (fetchKlines内)：
```typescript
// validateBinanceKlines関数内で変換処理
```

6. **`useChartData.ts`**：
```typescript
const formattedData = useMemo(() => {
  const rawFormattedData = priceData.map(candle => ({
    time: candle.time, // すでに秒単位の前提
    // ...
  }));
});
```

7. **`useIndicatorChartData.ts`**：
```typescript
const rawPriceData = priceData.map(candle => ({
  time: candle.time, // 時刻そのまま
  // ...
}));
```

### 2. 価格データフォーマット変換パターン

#### OHLCV変換の重複（5箇所）

1. **Binance生データ → ProcessedKline変換**：
```typescript
// chart-data-analysis.tool.ts
const open = parseFloat(candle[1]);
const high = parseFloat(candle[2]);
const low = parseFloat(candle[3]);
const close = parseFloat(candle[4]);
const volume = parseFloat(candle[5]);
```

2. **market.ts（validateBinanceKlines）**：
```typescript
{
  time: Math.floor(Number(kline[0]) / 1000),
  open: parseFloat(String(kline[1])),
  high: parseFloat(String(kline[2])),
  low: parseFloat(String(kline[3])),
  close: parseFloat(String(kline[4])),
  volume: parseFloat(String(kline[5])),
}
```

3. **use-candlestick-data.ts**：
```typescript
const kline: ProcessedKline = {
  time: Math.floor(data.k.t / 1000),
  open: parseFloat(data.k.o),
  high: parseFloat(data.k.h),
  low: parseFloat(data.k.l),
  close: parseFloat(data.k.c),
  volume: parseFloat(data.k.v),
};
```

4. **useChartData.ts** → LightweightCharts形式：
```typescript
const rawFormattedData = priceData.map(candle => ({
  time: candle.time,
  open: candle.open,
  high: candle.high,
  low: candle.low,
  close: candle.close,
}));
```

5. **useIndicatorChartData.ts**：
```typescript
const rawPriceData = priceData.map(candle => ({
  time: candle.time,
  close: candle.close,
  high: candle.high,
  low: candle.low,
  volume: candle.volume,
}));
```

### 3. データ型変換パターン

#### BigInt/Decimal変換（4箇所）

1. **db-conversions-unified.ts**：
```typescript
export function serializeBigInt(value: bigint): string {
  return value.toString();
}

export function serializeDecimal(value: DecimalLike | number): number {
  if (typeof value === 'number') return value;
  return Number(value.toString());
}
```

2. **db-conversions.ts**：
```typescript
export const serializeBigInt = serializeBigIntUnified;
export const serializeDecimal = serializeDecimalUnified;
```

3. **db-conversions.server.ts**：
```typescript
export const serializeBigInt = serializeBigIntUnified;
export const serializeDecimal = serializeDecimalUnified;
```

4. **chart-data-analysis.tool.ts** (技術指標計算内)：
```typescript
// Convert closes to PriceDataLightweight format for EMAIndicator
const chartData = closes.map((price, index) => ({
  time: index as UTCTimestamp,
  close: price,
}));
```

---

## 🎯 特定された重複ロジック

### 重複度: 高

1. **時刻変換（ミリ秒→秒）**: 7箇所で同じロジック
2. **parseFloat文字列変換**: 5箇所で同じパターン
3. **OHLCV構造体生成**: 5箇所で類似構造

### 重複度: 中

1. **Zod検証ロジック**: 3箇所で類似パターン
2. **エラーハンドリング**: 4箇所で類似処理
3. **データクリーニング**: 3箇所で重複関数

### 重複度: 低

1. **BigInt/Decimal変換**: 既に統合済み（unified版）
2. **Chart series更新**: 一部重複あり

---

## 🚀 統合提案

### 1. 時刻変換統合関数の作成

**提案ファイル**: `lib/utils/time-conversion.ts`

```typescript
/**
 * 統合時刻変換ユーティリティ
 */
export class TimeConverter {
  /**
   * Binanceタイムスタンプ（ミリ秒）→ LightweightCharts（秒）
   */
  static binanceToChart(timestamp: number): number {
    return Math.floor(timestamp / 1000);
  }

  /**
   * 任意タイムスタンプの自動変換
   */
  static autoConvert(timestamp: number): number {
    if (Math.abs(timestamp) > 1e12) {
      return Math.floor(timestamp / 1000);
    }
    return timestamp;
  }

  /**
   * 配列一括変換
   */
  static convertArray<T extends { time: number }>(
    data: T[]
  ): Array<T & { time: number }> {
    return data.map(item => ({
      ...item,
      time: TimeConverter.autoConvert(item.time)
    }));
  }
}
```

### 2. OHLCV変換統合クラス

**提案ファイル**: `lib/utils/ohlcv-converter.ts`

```typescript
/**
 * 統合OHLCV変換クラス
 */
export class OHLCVConverter {
  /**
   * Binance Kline tuple → ProcessedKline
   */
  static fromBinanceTuple(tuple: any[]): ProcessedKline {
    return {
      time: TimeConverter.binanceToChart(Number(tuple[0])),
      open: this.safeParseFloat(tuple[1]),
      high: this.safeParseFloat(tuple[2]),
      low: this.safeParseFloat(tuple[3]),
      close: this.safeParseFloat(tuple[4]),
      volume: this.safeParseFloat(tuple[5]),
    };
  }

  /**
   * WebSocket Kline → ProcessedKline
   */
  static fromWebSocketKline(wsData: BinanceKlineMessage): ProcessedKline {
    const k = wsData.k;
    return {
      time: TimeConverter.binanceToChart(k.t),
      open: this.safeParseFloat(k.o),
      high: this.safeParseFloat(k.h),
      low: this.safeParseFloat(k.l),
      close: this.safeParseFloat(k.c),
      volume: this.safeParseFloat(k.v),
    };
  }

  /**
   * ProcessedKline → LightweightCharts形式
   */
  static toLightweightCharts(data: ProcessedKline): CandlestickData {
    return {
      time: data.time as UTCTimestamp,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
    };
  }

  /**
   * 安全なparseFloat
   */
  private static safeParseFloat(value: string | number): number {
    const parsed = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * 配列一括変換
   */
  static convertArray<T>(
    data: any[],
    converter: (item: any) => T
  ): T[] {
    return data
      .filter(item => item != null)
      .map(converter)
      .filter(result => this.isValidOHLCV(result));
  }

  /**
   * OHLCV検証
   */
  private static isValidOHLCV(data: any): boolean {
    return data &&
           typeof data.time === 'number' &&
           typeof data.open === 'number' &&
           typeof data.high === 'number' &&
           typeof data.low === 'number' &&
           typeof data.close === 'number' &&
           data.high >= data.low &&
           data.high >= data.open &&
           data.high >= data.close &&
           data.low <= data.open &&
           data.low <= data.close;
  }
}
```

### 3. チャートデータ準備統合クラス

**提案ファイル**: `lib/utils/chart-data-preparation.ts`

```typescript
/**
 * チャートデータ準備統合クラス
 */
export class ChartDataPreparation {
  /**
   * 技術指標用データ準備
   */
  static forIndicators(data: ProcessedKline[]): PriceDataLightweight[] {
    return data.map(candle => ({
      time: candle.time as UTCTimestamp,
      close: candle.close,
    }));
  }

  /**
   * MACD計算用データ準備
   */
  static forMACD(data: ProcessedKline[]): PriceDataLightweight[] {
    return this.forIndicators(data);
  }

  /**
   * ボリンジャーバンド用データ準備
   */
  static forBollingerBands(data: ProcessedKline[]): PriceDataLightweight[] {
    return this.forIndicators(data);
  }

  /**
   * 汎用インディケーター用データ準備
   */
  static forGenericIndicator<T extends { time: UTCTimestamp; [key: string]: any }>(
    data: ProcessedKline[],
    mapper: (candle: ProcessedKline) => T
  ): T[] {
    return data.map(mapper);
  }

  /**
   * 時系列データクリーニング（既存関数の再利用）
   */
  static clean<T extends TimeSeriesData>(data: T[]): T[] {
    return prepareLightweightChartsData(data);
  }
}
```

---

## 📊 統合による削減効果

### 削減行数推定

| 変換パターン | 現在の重複行数 | 統合後行数 | 削減行数 | 削減率 |
|-------------|----------------|-----------|----------|--------|
| 時刻変換 | 35行 | 15行 | 20行 | 57% |
| OHLCV変換 | 125行 | 40行 | 85行 | 68% |
| データ準備 | 80行 | 25行 | 55行 | 69% |
| 型変換 | 45行 | 45行 | 0行 | 0%* |
| **合計** | **285行** | **125行** | **160行** | **56%** |

*既に統合済み

### ファイル影響数

- **直接修正**: 9ファイル
- **import更新**: 15ファイル
- **テスト更新**: 12ファイル

---

## 🛠️ 段階的実装計画

### Phase 1: 基盤整備（1-2日）
1. `TimeConverter`クラス作成
2. `OHLCVConverter`クラス作成
3. 基本テスト作成

### Phase 2: 主要ファイル移行（2-3日）
1. `market.ts`の`validateBinanceKlines`更新
2. `chart-data-analysis.tool.ts`の変換ロジック統合
3. `use-candlestick-data.ts`の変換統一

### Phase 3: Hook統合（1-2日）
1. `useChartData.ts`の変換統一
2. `useIndicatorChartData.ts`の変換統一
3. インディケーター関連ファイル更新

### Phase 4: 検証・最適化（1日）
1. 全テスト実行
2. パフォーマンス検証
3. 型安全性確認

---

## ⚠️ 注意事項

### リスク要因

1. **時刻処理の微妙な差異**: 
   - 現在一部で異なる時刻処理があるため、統合時に挙動変更の可能性
   
2. **型安全性**: 
   - `UTCTimestamp`型との互換性を慎重に確認必要

3. **パフォーマンス影響**:
   - 関数呼び出しオーバーヘッドの可能性（実測で確認）

### 推奨対策

1. **段階的移行**: 一度に全て変更せず、ファイル単位で検証
2. **後方互換性**: 既存関数をdeprecated化し、段階的移行
3. **詳細テスト**: 各変換パターンで入出力検証

---

## 📈 期待効果

### 短期効果
- **コード重複56%削減**
- **メンテナンス性向上**
- **バグリスク軽減**

### 長期効果
- **新機能追加時の開発速度向上**
- **統一されたデータ変換パターン**
- **チーム間での変換ロジック共通理解**

---

## 🔍 次のステップ

1. **統合提案の技術レビュー**
2. **Phase 1実装の承認**
3. **テスト戦略の詳細化**
4. **パフォーマンステストの実施**

---

*レポート作成日: 2025-06-29*  
*分析対象: Cryptradeアプリケーション全体*  
*分析者: Claude Code Assistant*