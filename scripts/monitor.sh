#!/bin/bash
# 進捗監視スクリプト

while true; do
    echo "=== 進捗チェック $(date) ==="
    
    # 各paneの状況確認
    for pane in %44 %42 %45 %43 %46; do
        echo "Checking pane $pane"
        if tmux capture-pane -t $pane -p | tail -10 | grep -q "approve"; then
            echo "承認待ちを検出: $pane"
            tmux send-keys -t $pane "2" Enter
            afplay /System/Library/Sounds/Glass.aiff &
        fi
        
        if tmux capture-pane -t $pane -p | tail -10 | grep -q "error\|Error\|failed"; then
            echo "エラー検出: $pane"
        fi
    done
    
    # エラー数カウント
    ERROR_COUNT=$(npm run typecheck 2>&1 | grep "error TS" | wc -l | tr -d ' ')
    echo "現在のエラー数: $ERROR_COUNT"
    tmux send-keys -t %41 "[Monitor] 現在のエラー数: $ERROR_COUNT" && sleep 0.1 && tmux send-keys -t %41 Enter
    
    sleep 30
done