# Binance API DI Migration Guide

## 概要

Binance APIサービスをシングルトンパターンから依存性注入（DI）パターンへ移行します。
これにより、テスタビリティと柔軟性が向上します。

## 移行前後の比較

### Before (Singleton)
```typescript
import { binanceAPI } from '@/lib/binance/api-service';

// 直接シングルトンインスタンスを使用
const data = await binanceAPI.fetchKlines('BTCUSDT', '1h');
```

### After (DI Pattern)

#### React Components
```typescript
import { useBinanceAPI } from '@/lib/binance/binance-context';

function MyComponent() {
  const binanceAPI = useBinanceAPI();
  
  useEffect(() => {
    const fetchData = async () => {
      const data = await binanceAPI.fetchKlines('BTCUSDT', '1h');
    };
    fetchData();
  }, [binanceAPI]);
}
```

#### Server-side / Scripts
```typescript
import { getBinanceAPI } from '@/lib/binance/binance-context';

const binanceAPI = getBinanceAPI();
const data = await binanceAPI.fetchKlines('BTCUSDT', '1h');
```

## アプリケーションセットアップ

`app/layout.tsx` または `_app.tsx` でProviderを追加:

```typescript
import { BinanceAPIProvider } from '@/lib/binance/binance-context';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <BinanceAPIProvider>
          {children}
        </BinanceAPIProvider>
      </body>
    </html>
  );
}
```

## テスト環境での使用

```typescript
import { BinanceAPIProvider } from '@/lib/binance/binance-context';
import { MockBinanceAPIService } from '@/test/mocks';

describe('MyComponent', () => {
  it('should fetch data', () => {
    const mockService = new MockBinanceAPIService();
    
    render(
      <BinanceAPIProvider service={mockService}>
        <MyComponent />
      </BinanceAPIProvider>
    );
  });
});
```

## 移行対象ファイル

1. ✅ `lib/binance/api-service.ts` - クラスのエクスポート追加
2. ✅ `lib/binance/binance-context.tsx` - Context/Provider作成
3. ⏳ `hooks/market/use-candlestick-data.ts`
4. ⏳ `hooks/market/use-market-stats.ts`
5. ⏳ `lib/mastra/tools/proposal-generation/index.ts`
6. ⏳ `lib/mastra/tools/helpers/proposal-analysis.ts`
7. ⏳ `__tests__/multi-timeframe-analysis.test.ts`

## 段階的移行戦略

1. **Phase 1**: Context/Providerの作成と後方互換性維持 ✅
2. **Phase 2**: React hooksの移行
3. **Phase 3**: Mastra toolsとサーバーサイドコードの移行
4. **Phase 4**: テストコードの移行
5. **Phase 5**: シングルトンエクスポートの削除

## 後方互換性

移行期間中は、既存のシングルトンエクスポート `binanceAPI` も維持されます。
全ての移行が完了後に削除予定です。