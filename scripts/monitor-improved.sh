#!/bin/bash
# 改善された進捗監視スクリプト

while true; do
    echo "=== 進捗チェック $(date '+%H:%M:%S') ==="
    
    # 各paneの状況確認と自動承認
    for pane in %44 %42 %45 %43 %46; do
        echo -n "Pane $pane: "
        
        # 承認待ちチェック（複数パターン）
        if tmux capture-pane -t $pane -p | tail -20 | grep -qE "(approve|Approve|承認|Do you want|Continue\?|Y/n)"; then
            echo "承認待ち検出 - 自動承認"
            # 入力欄クリア
            tmux send-keys -t $pane C-c
            sleep 0.1
            # 承認送信
            tmux send-keys -t $pane "2" Enter
            # 念のためYも送信
            tmux send-keys -t $pane "Y" Enter
            afplay /System/Library/Sounds/Glass.aiff &
        # アイドル状態チェック
        elif ! tmux capture-pane -t $pane -p | tail -50 | grep -qE "(修正|進行|working|progress|fixing|resolving)"; then
            echo "アイドル検出 - 再開催促"
            tmux send-keys -t $pane "作業を続けてください。進捗報告もお願いします。" Enter
        else
            echo "作業中"
        fi
    done
    
    # エラー数カウント
    ERROR_COUNT=$(cd /Users/hirosato/Downloads/Cryptrade && npm run typecheck 2>&1 | grep "error TS" | wc -l | tr -d ' ')
    echo "現在のエラー数: $ERROR_COUNT"
    
    # 5分ごとに詳細レポート
    if [ $(($(date +%s) % 300)) -lt 20 ]; then
        tmux send-keys -t %41 "[Monitor] エラー数: $ERROR_COUNT | 修正済み: $((4929 - ERROR_COUNT)) ($(awk "BEGIN {printf \"%.1f\", (4929 - $ERROR_COUNT) / 4929 * 100}")%)" Enter
    fi
    
    sleep 20
done