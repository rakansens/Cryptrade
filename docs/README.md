# Cryptrade ドキュメント

このディレクトリには、Cryptradeプロジェクトの技術文書、ガイド、仕様書が含まれています。

## 📚 ドキュメント構成

### 🎯 ガイド (guides/)
実装ガイドとベストプラクティス

#### API・ミドルウェア
- [APIクライアントミドルウェア](guides/guide-api-client-middleware.md)
- [エラーリカバリー戦略](guides/guide-error-recovery.md)
- [レート制限設定](guides/guide-rate-limiter.md)

#### データ・パフォーマンス
- [マーケットデータキャッシュ](guides/guide-market-data-cache.md)
- [並列処理実装](guides/guide-parallel-processing.md)
- [同時実行パターン](guides/guide-concurrency-patterns.md)
- [メモリ最適化](guides/guide-memory-optimization.md)

#### データベース・ストレージ
- [データベース接続ガイド](guides/guide-database-connection-guide.md)
- [データベースセットアップ](guides/guide-database-setup-guide.md)
- [Prisma概要](guides/guide-prisma-overview.md)

#### 認証・セキュリティ
- [認証実装](guides/guide-auth-implementation.md)
- [認証テスト](guides/guide-auth-testing.md)

#### その他
- [環境変数設定](guides/guide-environment-variables.md)
- [型安全性ガイドライン](guides/guide-type-safety-guidelines.md)
- [WebSocketマネージャー](guides/guide-ws-manager.md)
- [インテント分類](guides/guide-intent-classification.md)

### 🔧 セットアップ (setup/)
環境構築と初期設定

- [CI/CD設定](setup/setup-ci-cd.md)
- [E2Eテスト環境](setup/setup-e2e-testing.md)
- [Jestカバレッジ設定](setup/setup-jest-coverage.md)
- [テスト環境構築](setup/setup-test-environment.md)
- [テストジェネレーター](setup/setup-test-generator.md)
- [Testcontainers設定](setup/setup-testcontainers.md)
- [Testcontainers設定（日本語）](setup/setup-testcontainers-ja.md)

### 🏗️ アーキテクチャ (architecture/)
システム設計と技術アーキテクチャ

- [アーキテクチャ概要](architecture/guide-architecture.md)
- [システム設計ドキュメント](architecture/README.md)

### 📋 仕様書 (specifications/)
要件定義とチェックリスト

- [CSP本番デプロイチェックリスト](specifications/spec-csp-production-checklist.md)
- [レート制限チェックリスト](specifications/spec-rate-limit-checklist.md)

### 📊 レポート (reports/)
分析結果と進捗報告

#### 統合レポート
- [テスト修正最終レポート](reports/test-fix-final-report.md)
- [テスト改善最終レポート](reports/test-improvement-final-report.md)
- [テスト分析最終レポート](reports/test-analysis-final-report.md)
- [テストステータスレポート](reports/test-status-report.md)

#### 個別レポート
- [CI/CD更新サマリー](reports/report-cicd-update.md)
- [セキュリティ修正レポート](reports/report-security-fixes.md)
- [TypeScript修正レポート](reports/report-typescript-fixes.md)
- [型安全性改善レポート](reports/report-type-safety.md)
- [依存関係分析レポート](reports/report-dependency-analysis.md)
- [パフォーマンス比較レポート](reports/performance_comparison_report.md)
- [プロジェクト完了レポート](reports/project-completion-report.md)

#### 日本語レポート
- [パッチ適用ダイジェスト](reports/report-patch-application-ja.md)
- [最終診断レポート](reports/report-final-diagnosis-ja.md)

### 🔒 ポリシー (policies/)
セキュリティとガバナンス

- [セキュリティポリシー](policies/policy-security.md)
- [認証セキュリティポリシー](policies/policy-auth-security.md)

### 🧪 テスト (testing/)
テスト戦略とベストプラクティス

- [テストベストプラクティス](testing/TEST_BEST_PRACTICES.md)
- [テストドキュメンテーションガイド](testing/guide-test-documentation.md)
- [カバレッジ分析](testing/coverage/README.md)

### 📁 その他のディレクトリ

- **api/** - TypeDoc自動生成APIドキュメント
- **archive/** - 過去のドキュメントとアーカイブ
- **development/** - 開発プロセス関連
- **performance/** - パフォーマンス設定とガイド
- **references/** - リファレンスドキュメント
- **requirements/** - 要件定義書

## 📖 命名規則

詳細は[命名規則ドキュメント](NAMING-CONVENTION.md)を参照してください。

### 基本ルール
- **プレフィックス**: `guide-`, `setup-`, `report-`, `spec-`, `arch-`, `policy-`
- **フォーマット**: `[カテゴリ]-[サブカテゴリ]-[内容].md`
- **言語**: 日本語文書には`-ja`サフィックス

## 🔍 クイックリンク

### よく参照されるドキュメント
1. [環境変数設定ガイド](guides/guide-environment-variables.md)
2. [テスト環境構築](setup/setup-test-environment.md)
3. [APIクライアントミドルウェア](guides/guide-api-client-middleware.md)
4. [テストステータスレポート](reports/test-status-report.md)

### 最新の更新
- 2025-06-23: ドキュメント命名規則の統一とディレクトリ再構成
- 2025-06-22: テスト関連レポートの統合
- 2025-06-21: 大規模テスト修正の文書化

## 📝 貢献ガイドライン

新しいドキュメントを追加する際は：
1. [命名規則](NAMING-CONVENTION.md)に従う
2. 適切なディレクトリに配置
3. このREADME.mdのインデックスを更新
4. 関連するドキュメントへのリンクを追加