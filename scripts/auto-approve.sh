#!/bin/bash
# 自動承認チェックスクリプト

while true; do
    # 30秒ごとにチェック
    sleep 30
    
    # 承認待ちをチェックして自動承認
    for pane in %6 %4 %7 %5 %8 %32 %33; do
        if tmux capture-pane -t $pane -p 2>/dev/null | grep -q "Do you want"; then
            # 承認待ちを発見
            echo "[$(date '+%H:%M:%S')] Pane $pane: 承認待ち検出"
            
            # オプション2があるか確認（新メンバー優先）
            if tmux capture-pane -t $pane -p | grep -q "2\. Yes, and don't ask again"; then
                tmux send-keys -t $pane "2" && sleep 0.1 && tmux send-keys -t $pane Enter
                echo "[$(date '+%H:%M:%S')] Pane $pane: オプション2で承認"
            else
                tmux send-keys -t $pane "1" && sleep 0.1 && tmux send-keys -t $pane Enter
                echo "[$(date '+%H:%M:%S')] Pane $pane: オプション1で承認"
            fi
        fi
    done
    
    # メインpaneに状況報告
    tmux send-keys -t %3 "[自動承認] $(date '+%H:%M:%S') チェック完了" C-m
done