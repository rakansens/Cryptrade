# Jest設定マイグレーションガイド

## 概要

Jest設定を単一の`jest.config.js`から、テストタイプ別の複数の設定ファイルに分割しました。この変更により、以下の改善が期待されます：

- **環境の適切な分離**: ユニットテストはNode環境、E2EテストはJSDOM環境で実行
- **Stryker一時ファイルの除外**: `.stryker-tmp`ディレクトリを全設定で除外
- **重複設定の解消**: ベース設定ファイルで共通設定を一元管理
- **パフォーマンスの最適化**: テストタイプごとに最適化されたタイムアウトとカバレッジ閾値

## 新しい設定ファイル構成

### 1. `jest.config.base.js`
共通設定を定義するベースファイル：
- TypeScript変換設定
- モジュール解決設定（moduleNameMapper）
- カバレッジ収集の共通設定
- `.stryker-tmp`を含む除外パターン

### 2. `jest.config.unit.js`
ユニットテスト用設定：
- **環境**: `node`
- **タイムアウト**: 10秒（デフォルト）
- **対象**: `lib/`, `app/api/`, `types/`, `config/`, `utils/`
- **カバレッジ閾値**: 70-85%（モジュールによって異なる）

### 3. `jest.config.integration.js`
統合テスト用設定：
- **環境**: プロジェクト別（node/jsdom）
- **タイムアウト**: 30秒
- **対象**: `tests/integration/`
- **カバレッジ閾値**: 65-70%（やや低め）

### 4. `jest.config.e2e.js`
E2Eテスト用設定：
- **環境**: `jsdom`
- **タイムアウト**: 60秒
- **対象**: `tests/e2e/`, `e2e/`
- **カバレッジ閾値**: 60-65%（最も低い）
- **追加機能**: JSX変換サポート

### 5. `jest.config.js`
環境変数`TEST_TYPE`に基づいて適切な設定ファイルを選択するディスパッチャー。

## 使用方法

### 基本的なコマンド

```bash
# ユニットテスト（デフォルト）
npm test
npm run test:unit

# 統合テスト
npm run test:integration

# E2Eテスト（Jest版）
npm run test:e2e:jest

# 全テスト実行
npm run test:all
```

### 個別テストの実行

既存のスクリプトはすべて新しい設定を使用するように更新されています：

```bash
# 特定のモジュールのテスト
npm run test:utils
npm run test:lib
npm run test:components

# ウォッチモード
npm run test:watch
npm run test:utils:watch
```

## 主な変更点

### 1. TypeScript設定の更新
- `globals`での`ts-jest`設定を`transform`オプションに移行
- `isolatedModules`オプションを削除（tsconfig.test.jsonで設定）

### 2. 除外パターンの強化
- `.stryker-tmp/`を全設定で除外
- `testPathIgnorePatterns`と`coveragePathIgnorePatterns`の両方で指定

### 3. モックファイルの追加
- `__mocks__/styleMock.js`: CSSインポートのモック
- `__mocks__/fileMock.js`: 画像ファイルのモック

### 4. jest.setup.jsの修正
- TypeScript構文（型アサーション）を削除
- 純粋なJavaScriptコードに変更

## トラブルシューティング

### 問題: テストが見つからない
**解決策**: `TEST_TYPE`環境変数が正しく設定されているか確認してください。

### 問題: カバレッジ閾値エラー
**解決策**: 各設定ファイルで異なる閾値が設定されています。テストタイプに応じた適切な閾値を確認してください。

### 問題: 環境エラー（Node vs JSDOM）
**解決策**: コンポーネントテストは`jest.config.e2e.js`を、APIテストは`jest.config.unit.js`を使用してください。

## 今後の改善案

1. **並列実行の最適化**: プロジェクト間での並列実行設定
2. **キャッシュ戦略**: `.jest-cache`ディレクトリの活用
3. **レポート統合**: 各テストタイプのレポートを統合
4. **CI/CD最適化**: GitHub ActionsでのSharding設定

## 移行チェックリスト

- [x] 新しい設定ファイルの作成
- [x] package.jsonスクリプトの更新
- [x] モックファイルの作成
- [x] jest.setup.jsの修正
- [x] 設定の動作確認
- [x] ドキュメントの作成