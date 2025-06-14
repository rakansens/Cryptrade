# tmuxを使った相互通信によるClaude Code Company管理方法 - 改善版

## 概要
tmuxの複数paneでClaude Codeインスタンスを並列実行し、効率的にタスクを分散処理する方法。実践経験に基づく改善版。

## 基本セットアップ

### 1. tmux pane構成作成
```bash
# 5つのpaneに分割（基本的な分割方法）
tmux split-window -h && tmux split-window -v && tmux select-pane -t 0 && tmux split-window -v && tmux select-pane -t 2 && tmux split-window -v && tmux select-pane -t 4 && tmux split-window -v

# 推奨: プロマネ用レイアウトの適用（左側に広いプロマネpane、右側に部下pane）
tmux select-layout "9132,301x40,0,0{100x40,0,0,3,200x40,101,0[200x11,101,0,33,200x8,101,12,32,200x8,101,21,6,200x5,101,30,7,200x4,101,36,8]}"
```

### 2. pane番号の確認
```bash
# pane構造とIDの確認（実際の番号は環境により異なる）
tmux list-panes -F "#{pane_index}: #{pane_id} #{pane_current_command} #{pane_active}"
# 例の出力:
# 0: %22 zsh 1  (メインpane)
# 1: %27 zsh 0  (部下1)
# 2: %28 zsh 0  (部下2)
# 3: %25 zsh 0  (部下3) 
# 4: %29 zsh 0  (部下4)
# 5: %26 zsh 0  (部下5)
```

### 3. Claude Codeセッション起動
**注意**: ccはClaude Codeのエイリアスです。事前に`alias cc="claude"`を設定するか、直接claudeコマンドを使用してください。

**%27等の番号について**: これらはtmuxが自動割り当てするpane IDです。上記の確認コマンドで実際のIDを確認してから使用してください。

```bash
# 全paneで並列起動（実際のpane IDに置き換えて使用）
tmux send-keys -t %27 "cc" && sleep 0.1 && tmux send-keys -t %27 Enter & \
tmux send-keys -t %28 "cc" && sleep 0.1 && tmux send-keys -t %28 Enter & \
tmux send-keys -t %25 "cc" && sleep 0.1 && tmux send-keys -t %25 Enter & \
tmux send-keys -t %29 "cc" && sleep 0.1 && tmux send-keys -t %29 Enter & \
tmux send-keys -t %26 "cc" && sleep 0.1 && tmux send-keys -t %26 Enter & \
wait
```

## タスク割り当て方法

### 基本テンプレート
```bash
tmux send-keys -t %27 "cd 'ワーキングディレクトリ' && あなたはpane1です。タスク内容。エラー時は[pane1]でtmux send-keys -t %22でメイン報告。" && sleep 0.1 && tmux send-keys -t %27 Enter
```

### 並列タスク割り当て例
```bash
tmux send-keys -t %27 "タスク1の内容" && sleep 0.1 && tmux send-keys -t %27 Enter & \
tmux send-keys -t %28 "タスク2の内容" && sleep 0.1 && tmux send-keys -t %28 Enter & \
tmux send-keys -t %25 "タスク3の内容" && sleep 0.1 && tmux send-keys -t %25 Enter & \
wait
```

## 報連相システム

### 部下からメインへの報告形式
部下は以下のワンライナーで報告：

```bash
tmux send-keys -t %22 '[pane番号] 報告内容' && sleep 0.1 && tmux send-keys -t %22 Enter
```

部下から報連相できるように、タスク依頼時に上記の方法を教えて上げてください。また、/clear を頻繁にするので、2回目以降でもタスクの末尾に報連相の方法を加えておくと良いです。

#### 例
```bash
tmux send-keys -t %22 '[pane1] タスク完了しました' && sleep 0.1 && tmux send-keys -t %22 Enter
tmux send-keys -t %22 '[pane3] エラーが発生しました：詳細内容' && sleep 0.1 && tmux send-keys -t %22 Enter
```

## トークン管理

### /clearコマンドの実行
部下は自分で/clearできないため、メインが判断して実行：

**実行タイミングの判断基準:**
- タスク完了時（新しいタスクに集中させるため）
- トークン使用量が高くなった時（ccusageで確認）
- エラーが頻発している時（コンテキストをリセット）
- 複雑な作業から単純な作業に切り替える時

```bash
# 個別にクリア実行
tmux send-keys -t %27 "/clear" && sleep 0.1 && tmux send-keys -t %27 Enter

# 並列/clear
tmux send-keys -t %27 "/clear" && sleep 0.1 && tmux send-keys -t %27 Enter & \
tmux send-keys -t %28 "/clear" && sleep 0.1 && tmux send-keys -t %28 Enter & \
tmux send-keys -t %25 "/clear" && sleep 0.1 && tmux send-keys -t %25 Enter & \
wait
```

## 状況確認コマンド

**なぜ必要か**: 部下からの報告に加えて、以下の場面でコマンド確認が有効です：
- 部下が応答しない時（フリーズ、エラー状態の確認）
- 報告内容の詳細確認（エラーメッセージの全文確認）
- 作業状況の客観的把握（進捗の可視化）
- トラブルシューティング時（ログの確認）

### pane状況確認
```bash
# 各paneの最新状況確認
tmux capture-pane -t %27 -p | tail -10
tmux capture-pane -t %28 -p | tail -10

# 全pane一括確認
for pane in %27 %28 %25 %29 %26; do
    echo "=== $pane ==="
    tmux capture-pane -t $pane -p | tail -5
done
```

## ベストプラクティス

### 1. 明確な役割分担
- pane番号を必ず伝える
- 担当タスクを具体的に指示
- エラー時の報告方法を明記

### 2. 効率的なコミュニケーション
- ワンライナー形式での報告徹底
- [pane番号]プレフィックス必須
- 具体的なエラー内容の報告

### 3. トークン使用量管理
- 定期的な/clear実行
- 大量トークン消費の監視
- ccusageでの使用量確認

### 4. エラー対処
- Web検索による解決策調査を指示
- 具体的エラー内容の共有
- 成功事例の横展開

## 注意事項
- 部下は直接/clearできない（tmux経由でのみ可能）
- 報告は必ずワンライナー形式で
- pane番号の確認を怠らない
- トークン使用量の定期確認
- 複雑な指示は段階的に分割

## 活用例
- **大規模タスクの分散処理**
  - 資料作成: 各paneで異なる章を担当
  - エラー解決: 各paneで異なる角度から調査
  - 知見共有: 成功事例の文書化と横展開
  - 品質管理: 並列でのファイル修正と確認
  - 型安全性改善: any型削除作業の並列実行

## 実践的な追加ガイドライン

### 1. 自動承認システム
実際の運用では、ファイル変更の承認待ちが頻繁に発生します。以下の方法で効率化できます：

```bash
# 30秒ごとに全paneの承認待ちをチェック
watch -n 30 'for pane in %27 %28 %25 %29 %26; do tmux send-keys -t $pane "2" Enter; done'

# または、承認待ちの確認と自動承認
for pane in %27 %28 %25 %29 %26; do
    if tmux capture-pane -t $pane -p | grep -q "approve"; then
        tmux send-keys -t $pane "2" Enter
    fi
done

# 定期的な承認チェックスクリプト（バックグラウンド実行）
while true; do
    for pane in %27 %28 %25 %29 %26; do
        if tmux capture-pane -t $pane -p | tail -10 | grep -q "approve"; then
            echo "Approving changes in $pane"
            tmux send-keys -t $pane "2" Enter
        fi
    done
    sleep 30
done &
```

### 2. タスク管理の改善
TodoWriteツールを活用した進捗管理:
- 各paneに明確なタスクIDを割り当て
- 完了報告時にタスクIDを含める
- 定期的な進捗確認とタスク再割り当て
- タスクの優先順位付けと依存関係の管理

```bash
# タスク割り当て例
tmux send-keys -t %27 "タスクID: build-1 - テストファイルのインポートエラー修正" Enter
```

### 3. コマンド実行の確実性
tmuxコマンドが実際に実行されない問題への対処:

```bash
# コマンド送信後、確実にEnterキーを送信
tmux send-keys -t %27 "cc __tests__/file.ts" Enter

# 送信されていない場合は再度Enterを送信
tmux send-keys -t %27 Enter

# コマンドが入力欄に残っている場合の対処
tmux send-keys -t %27 C-c  # 現在の入力をキャンセル
tmux send-keys -t %27 "cc __tests__/file.ts" Enter
```

### 4. エラー監視とリカバリー
```bash
# エラー検知スクリプト
for pane in %27 %28 %25 %29 %26; do
    if tmux capture-pane -t $pane -p | grep -q "error\|Error\|failed"; then
        echo "Error detected in pane $pane"
        # 必要に応じて自動リカバリーや再割り当て
        # エラー内容をメインpaneに報告
        tmux send-keys -t %22 "[Error Monitor] Pane $pane でエラー検出" Enter
    fi
done

# Claude Codeがクラッシュした場合の再起動
for pane in %27 %28 %25 %29 %26; do
    if ! tmux capture-pane -t $pane -p | grep -q "✳"; then
        echo "Restarting Claude in pane $pane"
        tmux send-keys -t $pane "cc" Enter
    fi
done
```

### 5. pane管理のベストプラクティス
- 使用していないpaneは早めに削除してリソースを節約
- レイアウトは作業内容に応じて調整（main-verticalが見やすい）
- pane IDは変わることがあるので、定期的に確認
- 作業完了したpaneは`tmux kill-pane -t %ID`で削除

```bash
# 推奨レイアウト（プロマネ左側、部下右側に縦並び）
# このレイアウトは左側にプロマネ用の広いpane、右側に部下用の複数paneを配置
tmux select-layout "9132,301x40,0,0{100x40,0,0,3,200x40,101,0[200x11,101,0,33,200x8,101,12,32,200x8,101,21,6,200x5,101,30,7,200x4,101,36,8]}"

# または、シンプルなmain-verticalレイアウト
tmux select-layout main-vertical
tmux resize-pane -t %3 -x 100  # メインpane（プロマネ）を広く

# レイアウトの保存と復元
# 現在のレイアウトを保存
tmux list-windows -F "#{window_layout}" > layout.txt
# 保存したレイアウトを復元
tmux select-layout "$(cat layout.txt)"
```

### 6. 成功音の活用
タスク完了や重要なマイルストーンで音を鳴らすことで、視覚的な監視なしでも進捗を把握：

```bash
# 成功時
afplay /System/Library/Sounds/Glass.aiff

# エラー時
afplay /System/Library/Sounds/Basso.aiff

# 全タスク完了時
afplay /System/Library/Sounds/Hero.aiff

# 進捗に応じた音の使い分け
# 小タスク完了: Glass.aiff
# 中タスク完了: Ping.aiff
# 大タスク完了: Hero.aiff
# エラー発生: Basso.aiff
```

### 7. 効率的なビルドエラー対処
```bash
# ビルドエラーの分類と割り振り
npm run typecheck 2>&1 | grep "error TS" | head -30 > errors.txt

# エラータイプごとに部下に割り振り
# - インポートエラー → Pane1
# - 型定義エラー → Pane2
# - テストエラー → Pane3
```

### 8. 進捗の可視化
```bash
# 定期的な進捗レポート生成
echo "=== 進捗レポート $(date) ===" > progress.txt
for pane in %27 %28 %25 %29 %26; do
    echo "Pane $pane:" >> progress.txt
    tmux capture-pane -t $pane -p | grep -E "(完了|エラー|進行中)" | tail -5 >> progress.txt
done
```

このシステムにより、複数のClaude Codeインスタンスを効率的に管理し、大規模タスクの並列処理が可能になります。実践を通じて得られた知見を活用することで、より効率的なチーム運営が実現できます。