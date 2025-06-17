# パッチ適用レポート - 日本語要約

## 概要
合計5つのパッチファイルを処理し、3つを正常に適用しました。9つのコンポーネントファイルを削除し、27個の未使用依存関係をpackage.jsonから除去しました。

## 適用結果
- **処理したパッチ数**: 5個（regression-tests, dead-functions, unused-imports, unreachable-code, unused-deps）
- **適用成功**: 3個（regression-tests, dead-functions, unused-deps）
- **スキップ**: 2個（unused-imports, unreachable-code - どちらも変更不要）
- **削除されたファイル**: 9個（MainLayout, AlertForm/List, チャート関連コンポーネント）
- **削除された依存関係**: 27個（未使用のnpmパッケージ）
- **競合やエラー**: 0件

## 注意事項
dead-functions.patchは直接適用できなかったため、ファイルを手動で削除しました。unused-deps.patchも非標準形式のため、package.jsonを手動編集しました。すべての変更は正常に完了し、競合は発生していません。