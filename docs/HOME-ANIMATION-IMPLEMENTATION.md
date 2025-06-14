# ホーム画面アニメーション実装

## 概要
AIチャットサービスでよく見られる、中央の入力欄からチャット画面への遷移アニメーションを実装しました。

## 実装内容

### 1. コンポーネント構成
- **HomeView**: ホーム画面のメインコンポーネント
- **AnimatedChatTransition**: アニメーション制御用ラッパー
- **MainLayout**: チャートとチャットを含むメインレイアウト

### 2. アニメーション詳細

#### ホーム画面
- 背景: グラデーションアニメーション（10秒周期）
- ロゴ: 360度回転アニメーション（20秒周期）
- 入力欄: フェードイン＋スケールアップ
- サジェスチョン: 順次表示（0.1秒間隔）

#### 遷移アニメーション
- ホーム画面: フェードアウト＋スケールダウン（0.95倍）
- チャット画面: フェードイン＋スケールアップ（1.05倍→1.0倍）
- サイドバー: 左からスライドイン（300px移動）
- エフェクトレイヤー: 斜めグラデーションのスワイプ効果

### 3. 使用技術
- **Framer Motion**: アニメーションライブラリ
- **LayoutGroup**: シームレスな遷移を実現
- **AnimatePresence**: コンポーネントの入退場制御

### 4. 状態管理
- 既存セッションがある場合は直接チャット画面を表示
- ホームボタンでいつでもホーム画面に戻れる
- グローバル関数でコンポーネント間の通信を実現

## 使い方

### 基本的な流れ
1. 初回アクセス時はホーム画面が表示
2. 入力欄にメッセージを入力してEnterキー
3. チャット画面へアニメーション遷移
4. 「ホームに戻る」ボタンでホーム画面へ

### サジェスチョン機能
- 3つのプリセットプロンプトを用意
- クリックで入力欄に自動入力
- カーソルは末尾に自動移動

## カスタマイズ

### アニメーション速度の調整
```typescript
// HomeView.tsx
transition={{ duration: 0.5 }} // 変更可能
```

### サジェスチョンの変更
```typescript
const SUGGESTION_PROMPTS = [
  { icon: TrendingUp, text: 'カスタムプロンプト', color: 'from-orange-500 to-pink-500' },
  // 追加可能
]
```

### 背景アニメーションの変更
```typescript
animate={{
  background: [
    'radial-gradient(...)', // カスタマイズ可能
  ]
}}
```

## トラブルシューティング

### アニメーションがカクつく場合
- GPUアクセラレーションを有効化
- `will-change: transform`をCSSに追加
- アニメーション要素を減らす

### 遷移が動作しない場合
- Framer Motionが正しくインストールされているか確認
- LayoutGroupが正しくラップされているか確認
- コンソールエラーをチェック

## 今後の改善案
1. モバイル対応の最適化
2. キーボードショートカットの追加
3. アニメーション設定の永続化
4. より高度な遷移エフェクト