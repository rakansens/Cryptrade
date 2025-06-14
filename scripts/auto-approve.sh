#!/bin/bash

# Auto-approve script for TypeScript error fixes
while true; do
    for pane in %44 %42 %45 %43 %46; do
        if tmux capture-pane -t $pane -p | tail -10 | grep -q "approve"; then
            echo "[$(date '+%H:%M:%S')] Approving changes in $pane"
            tmux send-keys -t $pane "2" Enter
            afplay /System/Library/Sounds/Glass.aiff &
        fi
    done
    
    # Check error count every minute
    SECONDS_NOW=$(date +%s)
    if [ $((SECONDS_NOW % 60)) -eq 0 ]; then
        ERROR_COUNT=$(cd /Users/hirosato/Downloads/Cryptrade && npm run typecheck 2>&1 | grep "error TS" | wc -l | tr -d ' ')
        echo "[$(date '+%H:%M:%S')] Current errors: $ERROR_COUNT"
        
        # Report to main pane
        tmux send-keys -t %41 "[PM] 現在のエラー数: $ERROR_COUNT" && sleep 0.1 && tmux send-keys -t %41 Enter
    fi
    
    sleep 5
done