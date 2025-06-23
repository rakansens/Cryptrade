# ドキュメント命名規則

## 概要
このドキュメントでは、`docs`ディレクトリ内のファイルとフォルダの命名規則を定義します。

## ファイル命名規則

### 基本フォーマット
```
[カテゴリ]-[サブカテゴリ]-[内容].md
```

### カテゴリプレフィックス

| プレフィックス | 用途 | 例 |
|--------------|------|-----|
| `guide-` | 実装ガイド、使い方 | `guide-api-middleware.md` |
| `setup-` | 環境構築、初期設定 | `setup-jest-coverage.md` |
| `report-` | 分析レポート、結果報告 | `report-test-final.md` |
| `spec-` | 仕様書、要件定義 | `spec-rate-limit-checklist.md` |
| `arch-` | アーキテクチャ設計 | `arch-system-design.md` |
| `ref-` | リファレンス、API仕様 | `ref-api-endpoints.md` |
| `checklist-` | チェックリスト | `checklist-deployment.md` |
| `policy-` | ポリシー、ルール | `policy-security.md` |

### 命名ルール

1. **小文字のみ使用**: すべて小文字で記述
2. **ハイフン区切り**: 単語間は`-`（ハイフン）で区切る
3. **アンダースコア禁止**: `_`は使用しない
4. **略語は避ける**: 可能な限り完全な単語を使用
5. **言語サフィックス**: 日本語文書には`-ja`を付ける

### 言語バージョン
- デフォルト: 英語（サフィックスなし）
- 日本語: `-ja`サフィックス
- 例: `guide-setup-testcontainers.md` (英語版)
- 例: `guide-setup-testcontainers-ja.md` (日本語版)

## ディレクトリ構造

```
docs/
├── guides/          # 実装ガイド、ハウツー
├── setup/           # セットアップ手順
├── architecture/    # アーキテクチャ設計文書
├── specifications/  # 仕様書、要件定義
├── reports/         # 分析レポート、結果報告
├── references/      # APIリファレンス、技術仕様
├── policies/        # セキュリティポリシー、コーディング規約
├── testing/         # テスト関連文書
├── development/     # 開発プロセス、ワークフロー
├── performance/     # パフォーマンス関連
└── archive/         # 古い文書、非推奨文書
```

## ディレクトリ別の内容

### guides/
実装方法、ベストプラクティス、チュートリアル
- `guide-api-middleware.md`
- `guide-error-handling.md`
- `guide-state-management.md`

### setup/
環境構築、ツール設定、初期設定
- `setup-development-env.md`
- `setup-ci-cd.md`
- `setup-database.md`

### architecture/
システム設計、技術選定、アーキテクチャ決定
- `arch-system-overview.md`
- `arch-microservices.md`
- `arch-data-flow.md`

### specifications/
機能仕様、API仕様、データ仕様
- `spec-api-v1.md`
- `spec-data-model.md`
- `spec-user-stories.md`

### reports/
分析結果、パフォーマンスレポート、監査結果
- `report-performance-2025-06.md`
- `report-security-audit.md`
- `report-test-coverage.md`

### references/
APIリファレンス、関数リファレンス、設定リファレンス
- `ref-api-endpoints.md`
- `ref-configuration.md`
- `ref-error-codes.md`

### policies/
セキュリティポリシー、コーディング規約、運用ルール
- `policy-security.md`
- `policy-code-review.md`
- `policy-deployment.md`

## バージョン管理

時系列が重要な文書には日付を含める：
- フォーマット: `YYYY-MM`
- 例: `report-performance-2025-06.md`
- 例: `report-security-audit-2025-q2.md`

## 移行ガイドライン

既存ファイルを新しい命名規則に移行する際：

1. 新しい名前を決定
2. ファイルを移動・リネーム
3. 参照箇所を更新（リンク、import文など）
4. コミットメッセージに移行内容を明記

## 例外

以下のファイルは特別な理由により規則の例外とする：
- `README.md` - 標準的な命名
- `api/` - TypeDoc生成ファイル（自動生成のため）

## チェックリスト

新しいドキュメントを作成する際：
- [ ] 適切なカテゴリプレフィックスを選択
- [ ] すべて小文字で記述
- [ ] ハイフンで単語を区切る
- [ ] 適切なディレクトリに配置
- [ ] 日本語版の場合は`-ja`サフィックスを追加
- [ ] README.mdのインデックスを更新