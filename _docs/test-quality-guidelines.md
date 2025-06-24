# テスト品質ガイドライン

## 目的
このガイドラインは、Cryptradeプロジェクトにおける高品質なテストの作成と維持のための指針を提供します。

## 基本原則

### 1. テストの独立性
- **原則**: 各テストは他のテストに依存せず、単独で実行可能であること
- **実装**:
  ```typescript
  beforeEach(() => {
    jest.clearAllMocks();
    // テストごとに必要な初期化を行う
  });
  ```

### 2. 実装のテスト、モックではない
- **禁止事項**: テスト対象のサービス/コンポーネント自体をモックすること
- **推奨**: 依存関係のみをモックし、実際の実装をテストする

### 3. 意味のあるアサーション
- **避けるべき**:
  ```typescript
  expect(result).toBe(true); // 何をテストしているか不明
  ```
- **推奨**:
  ```typescript
  expect(user.isActive).toBe(true); // 明確な意図
  expect(result.status).toBe('success'); // 具体的な期待値
  ```

## アンチパターンと解決策

### 1. 自己モック
**問題例**:
```typescript
jest.mock('@/services/UserService'); // ❌ テスト対象をモック
```

**解決策**:
```typescript
jest.mock('@/lib/api/client'); // ✅ 依存関係のみモック
import { UserService } from '@/services/UserService';
// 実際のUserServiceをテスト
```

### 2. スキップされたテスト
**問題例**:
```typescript
it.skip('should handle complex scenario', () => { // ❌ 理由なくスキップ
  // ...
});
```

**解決策**:
```typescript
// スキップする場合は必ず理由を記載
it.skip('should handle circular references', () => {
  // TODO: タイミング問題により失敗。Issue #123で対応予定
});
```

### 3. ハードコードされた値
**問題例**:
```typescript
expect(result.date).toBe('2024-01-01'); // ❌ 固定日付
```

**解決策**:
```typescript
const now = new Date();
const expectedDate = new Date(now.getTime() - 86400000); // 1日前
expect(result.date).toEqual(expectedDate);
```

### 4. バリデーションロジックのモック
**問題例**:
```typescript
jest.mock('@/validators', () => ({
  validateEmail: jest.fn(() => true) // ❌ バリデーションをモック
}));
```

**解決策**:
```typescript
// バリデーションロジックは実際に実行する
import { validateEmail } from '@/validators';
expect(validateEmail('test@example.com')).toBe(true);
```

## ベストプラクティス

### 1. テストの構造化
```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should handle success case', () => {});
    it('should handle error case', () => {});
    it('should validate input', () => {});
  });
});
```

### 2. エラーケースのテスト
```typescript
it('should handle API errors gracefully', async () => {
  mockApiClient.get.mockRejectedValueOnce(new Error('Network error'));
  
  await expect(service.fetchData())
    .rejects.toThrow('Network error');
    
  expect(logger.error).toHaveBeenCalledWith(
    expect.stringContaining('Failed to fetch'),
    expect.any(Object)
  );
});
```

### 3. 非同期処理のテスト
```typescript
// ❌ 避けるべき
it('should fetch data', (done) => {
  service.fetchData().then(result => {
    expect(result).toBeDefined();
    done();
  });
});

// ✅ 推奨
it('should fetch data', async () => {
  const result = await service.fetchData();
  expect(result).toBeDefined();
});
```

### 4. モックの適切な使用
```typescript
// グローバルモック（ファイルの先頭）
jest.mock('@/lib/utils/logger');

// ローカルモック（テスト内）
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

## 型安全性

### TypeScriptとの統合
```typescript
import { describe, it, expect, jest } from '@jest/globals';
import type { MockedFunction } from 'jest-mock';

// 型安全なモック
const mockFunction = jest.fn() as MockedFunction<typeof originalFunction>;
```

## パフォーマンス考慮事項

### 1. 適切なsetup/teardown
```typescript
let heavyResource: HeavyResource;

beforeAll(async () => {
  heavyResource = await createHeavyResource();
});

afterAll(async () => {
  await heavyResource.cleanup();
});
```

### 2. 並列実行の活用
```typescript
// 独立したテストは並列実行可能
describe.concurrent('Parallel tests', () => {
  it('test 1', async () => {});
  it('test 2', async () => {});
});
```

## 継続的改善

### テスト品質の監視
1. カバレッジ目標: 80%以上
2. 定期的なテストレビュー
3. 失敗したテストの即座の修正

### 問題の報告
テスト品質に関する問題を発見した場合:
1. `_docs/`ディレクトリに記録
2. ToDoリストに追加
3. 優先度に基づいて修正

## チェックリスト

新しいテストを作成する際の確認事項:
- [ ] テスト対象の実装をテストしているか（モックではない）
- [ ] 各テストは独立して実行可能か
- [ ] エラーケースをカバーしているか
- [ ] アサーションは明確で意味があるか
- [ ] ハードコードされた値を避けているか
- [ ] 適切なsetup/teardownを実装しているか
- [ ] TypeScriptの型安全性を活用しているか

## 参考資料
- [Jest公式ドキュメント](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- プロジェクト固有のテストユーティリティ: `/tests/helpers/`