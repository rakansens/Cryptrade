#\!/bin/bash
# 進捗監視スクリプト

while true; do
    echo "=== 進捗チェック $(date) ==="
    
    # 各paneの状況確認
    for pane in %37 %35 %38 %36 %39; do
        echo "Checking pane $pane"
        if tmux capture-pane -t $pane -p | tail -10 | grep -q "approve"; then
            echo "承認待ちを検出: $pane"
            tmux send-keys -t $pane "2" Enter
        fi
        
        if tmux capture-pane -t $pane -p | tail -10 | grep -q "error\|Error\|failed"; then
            echo "エラー検出: $pane"
        fi
    done
    
    sleep 30
done
