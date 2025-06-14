# Proposal Generation Tool リファクタリング計画

## 現状の問題点

1. **ファイルサイズ**: 1073行の巨大ファイル
2. **any型の使用**: 
   - `proposalGroup: z.any()` (line 42)
   - 複数の `as any` キャスト
3. **責務の混在**:
   - ツール定義
   - トレンドライン生成ロジック
   - サポート・レジスタンス生成
   - フィボナッチ生成
   - パターン認識
   - 信頼度計算
   - 描画データ生成

## 提案する構造

```
lib/mastra/tools/proposal-generation/
├── index.ts                           # メインツール定義（エントリーポイント）
├── types.ts                          # 型定義とスキーマ
├── generators/                       # 各提案生成ロジック
│   ├── trendline-generator.ts       # トレンドライン生成
│   ├── support-resistance-generator.ts # サポート・レジスタンス生成
│   ├── fibonacci-generator.ts        # フィボナッチ生成
│   └── pattern-generator.ts         # パターン認識生成
├── analyzers/                        # 分析ロジック
│   ├── confidence-calculator.ts     # 信頼度計算
│   ├── market-analyzer.ts          # 市場分析
│   └── volume-analyzer.ts          # ボリューム分析
├── validators/                       # バリデーション
│   ├── proposal-validator.ts       # 提案バリデーション
│   └── drawing-validator.ts        # 描画データバリデーション
└── utils/                           # ユーティリティ
    ├── data-transformer.ts         # データ変換
    ├── scoring.ts                  # スコアリング
    └── constants.ts                # 定数定義
```

## リファクタリング手順

### Phase 1: 型定義の整理
1. `z.any()` を具体的な型に置き換え
2. インターフェースを明確に定義
3. 型ガードを実装

### Phase 2: ジェネレーターの分離
1. 各提案生成ロジックを個別ファイルに
2. 共通インターフェースで統一
3. ストラテジーパターンの適用

### Phase 3: 分析ロジックの抽出
1. 信頼度計算を独立モジュール化
2. 市場分析ロジックの分離
3. ボリューム分析の独立化

### Phase 4: ユーティリティの整理
1. マジックナンバーを定数化
2. スコアリングロジックの統一
3. データ変換の一元化

## 期待される効果

1. **保守性向上**: 各ファイル200行以下
2. **型安全性**: any型の完全排除
3. **テスタビリティ**: 個別モジュールのユニットテスト可能
4. **再利用性**: 各ジェネレーターの独立使用可能
5. **拡張性**: 新しい提案タイプの追加が容易

## 実装優先度

1. **HIGH**: 型定義の整理（any型排除）
2. **HIGH**: トレンドライン生成の分離（最も複雑）
3. **MEDIUM**: 他のジェネレーターの分離
4. **LOW**: ユーティリティの整理