# リファクタリング実装例

## 1. 非同期フックのリファクタリング例

### Before: useApproveProposal（重複コードを含む）

```typescript
export function useApproveProposal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const approveProposal = useCallback(async (message: ProposalMessage, proposalId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // バリデーション
      if (!message || !proposalId) {
        throw new Error('Invalid parameters');
      }
      
      // 処理実行
      const result = await api.approveProposal(proposalId);
      
      setLoading(false);
      showProposalApprovalSuccess();
      return result;
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      setLoading(false);
      showProposalApprovalError(error.message);
      throw error;
    }
  }, []);
  
  return { approveProposal, loading, error };
}
```

### After: useAsyncOperationを使用したリファクタリング

```typescript
export function useApproveProposal() {
  const approvalOperation = useAsyncOperation(
    async (message: ProposalMessage, proposalId: string) => {
      return api.approveProposal(proposalId);
    },
    {
      operationName: 'approveProposal',
      maxRetries: 2,
      retryDelay: 1000,
      validate: ([message, proposalId]) => {
        if (!message || !proposalId) {
          return { valid: false, error: 'Invalid parameters' };
        }
        return { valid: true, context: { proposalId } };
      },
      onSuccess: () => {
        showProposalApprovalSuccess();
      },
      onError: (error) => {
        showProposalApprovalError(error.message);
      }
    }
  );

  return {
    approveProposal: approvalOperation.execute,
    approveLoading: approvalOperation.loading,
    approveError: approvalOperation.error
  };
}
```

## 2. インディケーター計算のリファクタリング例

### Before: 重複したバリデーションとエラーハンドリング

```typescript
// calculateSMA
export function calculateSMA(data: PriceData[], period: number): SMAData[] {
  // 重複: バリデーション
  if (!data || data.length < period) {
    logger.error('[SMA] Insufficient data');
    return [];
  }
  
  try {
    // 計算ロジック
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      // ...
    }
    return result;
  } catch (error) {
    logger.error('[SMA] Calculation failed', { error });
    return [];
  }
}

// calculateEMA - ほぼ同じパターン
export function calculateEMA(data: PriceData[], period: number): EMAData[] {
  // 重複: バリデーション
  if (!data || data.length < period) {
    logger.error('[EMA] Insufficient data');
    return [];
  }
  
  try {
    // 計算ロジック
    const result = [];
    // ...
    return result;
  } catch (error) {
    logger.error('[EMA] Calculation failed', { error });
    return [];
  }
}
```

### After: 基底クラスを使用したリファクタリング

```typescript
// base-indicator.ts
export abstract class BaseIndicator<TInput, TOutput> {
  protected abstract name: string;
  protected abstract minDataPoints: number;
  
  protected abstract calculate(data: TInput[]): TOutput[];
  
  public execute(data: TInput[]): TOutput[] {
    // 共通バリデーション
    const validation = this.validate(data);
    if (!validation.valid) {
      logger.error(`[${this.name}] ${validation.error}`);
      return [];
    }
    
    try {
      return this.calculate(data);
    } catch (error) {
      logger.error(`[${this.name}] Calculation failed`, { error });
      return [];
    }
  }
  
  protected validate(data: TInput[]): { valid: boolean; error?: string } {
    if (!data || data.length < this.minDataPoints) {
      return { 
        valid: false, 
        error: `Insufficient data: ${data?.length || 0} < ${this.minDataPoints}` 
      };
    }
    return { valid: true };
  }
}

// SMAIndicator.ts
export class SMAIndicator extends BaseIndicator<PriceData, SMAData> {
  protected name = 'SMA';
  protected minDataPoints: number;
  
  constructor(private period: number) {
    super();
    this.minDataPoints = period;
  }
  
  protected calculate(data: PriceData[]): SMAData[] {
    const result: SMAData[] = [];
    for (let i = this.period - 1; i < data.length; i++) {
      // 計算ロジックのみに集中
      const sum = data.slice(i - this.period + 1, i + 1)
        .reduce((acc, d) => acc + d.close, 0);
      result.push({
        time: data[i].time,
        value: sum / this.period
      });
    }
    return result;
  }
}

// 使用例
const smaIndicator = new SMAIndicator(20);
const smaData = smaIndicator.execute(priceData);
```

## 3. テストユーティリティの統合例

### Before: 重複したモック作成関数

```typescript
// test-factory.ts
export function createMockCandlestickData() {
  return {
    time: Date.now(),
    open: 100,
    high: 110,
    low: 90,
    close: 105
  };
}

// test-utils.tsx
export function mockFetch() {
  return {
    time: Date.now(),
    open: 100,
    high: 110,
    low: 90,
    close: 105
  };
}
```

### After: 統合されたテストユーティリティ

```typescript
// tests/utils/data-factory.ts
export class TestDataFactory {
  private static basePrice = 100;
  
  static createCandlestickData(overrides?: Partial<CandlestickData>): CandlestickData {
    const base = {
      time: Date.now(),
      open: this.basePrice,
      high: this.basePrice * 1.1,
      low: this.basePrice * 0.9,
      close: this.basePrice * 1.05
    };
    
    return { ...base, ...overrides };
  }
  
  static createCandlestickSeries(
    count: number, 
    options?: { startTime?: number; volatility?: number }
  ): CandlestickData[] {
    const { startTime = Date.now(), volatility = 0.02 } = options || {};
    const result: CandlestickData[] = [];
    
    for (let i = 0; i < count; i++) {
      const prevClose = i > 0 ? result[i - 1].close : this.basePrice;
      const change = (Math.random() - 0.5) * volatility * prevClose;
      
      result.push({
        time: startTime + i * 60000, // 1分ごと
        open: prevClose,
        high: prevClose + Math.abs(change),
        low: prevClose - Math.abs(change),
        close: prevClose + change
      });
    }
    
    return result;
  }
}

// 使用例
const singleCandle = TestDataFactory.createCandlestickData({ close: 120 });
const series = TestDataFactory.createCandlestickSeries(100, { volatility: 0.05 });
```

## 効果測定

### コード削減量の見積もり

| カテゴリ | 削減前の行数 | 削減後の行数 | 削減率 |
|---------|------------|------------|--------|
| 非同期フック | 約2,500行 | 約1,500行 | 40% |
| インディケーター | 約1,200行 | 約800行 | 33% |
| テストユーティリティ | 約800行 | 約400行 | 50% |
| **合計** | **約4,500行** | **約2,700行** | **40%** |

### 保守性の向上

- バグ修正箇所: 複数箇所 → 1箇所
- 新機能追加: 各フックで実装 → 基底クラスで一括実装
- テストカバレッジ: 向上（共通ロジックのテストが統合）