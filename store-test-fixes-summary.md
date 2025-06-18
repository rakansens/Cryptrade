# Store Test Fixes Summary

## 問題と解決の概要

Zustandストアのモックに関する問題を調査し、以下の対応を実施：

1. **jest.setup.jsのZustandモック改善**
   - getInitialStateサポートを追加
   - reset()メソッドを持たないストアに対応

2. **ストアテストのリセット処理統一**
   - reset-stores.jsユーティリティを作成
   - 全ストアの初期状態を定義
   - resetAllStores()関数で一括リセット

3. **MSW関連のインポートエラー修正**
   - transformIgnorePatternsにmswを追加
   - msw/nodeインポートを修正

4. **自動修正スクリプトによる構文エラー**
   - analysis-history.store.test.tsなどで重複コード
   - chart.store.test.tsでテスト構造の破損

## 現在の状態

- 基本的なテスト（concurrent.test.ts）は正常動作
- ストアテストは依然として問題あり：
  - Zustandモックが完全に機能していない
  - 初期状態の設定に問題
  - アクション関数の呼び出しでエラー

## 次のステップ

1. Zustandモックの完全な再実装
2. 個別ストアテストの手動修正
3. テストカバレッジの段階的な改善

## 対応ファイル

- `/jest.setup.js` - Zustandモック改善
- `/config/jest/jest.config.base.js` - transformIgnorePatterns修正  
- `/tests/setup/reset-stores.js` - 新規作成
- `/scripts/fix-store-tests.js` - 自動修正スクリプト
- `/scripts/fix-all-store-tests.js` - 包括的修正スクリプト