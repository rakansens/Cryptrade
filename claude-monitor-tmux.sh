#!/usr/bin/env bash
# claude-monitor-tmux.sh - tmux 版 Claude Multi-Instance Monitor
# -----------------------------------------------------------
# 変更履歴
# 2024-06-14  新規作成: tmux 内に 3 pane を生成し、Claude Code プロセスの概要/詳細/ログを可視化
# -----------------------------------------------------------
# 使い方:
#   ./claude-monitor-tmux.sh       # 新規セッション作成 & アタッチ
#   ./claude-monitor-tmux.sh -k    # 既存セッションを kill
#   ./claude-monitor-tmux.sh -a    # 既存セッションにアタッチ
# -----------------------------------------------------------
set -euo pipefail
SESSION="claude-monitor"
LOG_FILE="/tmp/claude_activity.log"
UPDATE_INTERVAL=2   # 秒

# Claude プロセスを抽出するコマンド
#   PID  TTY   CPU  MEM  COMMAND
PS_CMD="ps -u \"$USER\" -o pid,tty,%cpu,%mem,command | grep -E '(claude|anthropic)' | grep -v grep"

create_session() {
  tmux new-session -d -s "$SESSION" -n monitor
  # Pane0: 概要
  tmux send-keys -t "$SESSION":0.0 "bash -c 'while :; do clear; $(declare -f overview); overview; sleep $UPDATE_INTERVAL; done'" C-m
  # Pane1: プロセス詳細
  tmux split-window -v -t "$SESSION":0.0 -p 40
  tmux send-keys -t "$SESSION":0.1 "watch -n $UPDATE_INTERVAL -c \"$PS_CMD\"" C-m
  # Pane2: アクティビティログ
  tmux split-window -h -t "$SESSION":0.1 -p 50
  tmux send-keys -t "$SESSION":0.2 "touch $LOG_FILE; tail -n 200 -f $LOG_FILE" C-m
  tmux select-pane -t "$SESSION":0.0
  tmux select-layout -t "$SESSION":0 tiled >/dev/null
  echo "[OK] tmux session '$SESSION' created"
}

overview() {
  local instances cpu_total mem_total active_count total_count
  mapfile -t lines < <(eval "$PS_CMD")
  total_count=${#lines[@]}
  active_count=0
  cpu_total=0
  mem_total=0
  for l in "${lines[@]}"; do
    # shellcheck disable=SC2086
    read -r pid tty cpu mem cmd <<<"$l"
    cpu_total=$(awk "BEGIN{print $cpu_total+$cpu}")
    mem_total=$(awk "BEGIN{print $mem_total+$mem}")
    (( active_count++ ))
  done
  echo "========== Claude Monitor (tmux) =========="
  echo "日時        : $(date '+%F %T')"
  echo "インスタンス: $active_count / $total_count"
  printf 'CPU合計     : %.1f%%\n' "$cpu_total"
  printf 'Mem合計     : %.1f%%\n' "$mem_total"
  echo "-------------------------------------------"
  printf '%-6s %-8s %-6s %-6s %s\n' PID TTY CPU MEM COMMAND
  printf '%-6s %-8s %-6s %-6s %s\n' "------" "--------" "---" "---" "-----------------------------"
  for l in "${lines[@]}"; do
    # shellcheck disable=SC2086
    read -r pid tty cpu mem cmd <<<"$l"
    printf '%-6s %-8s %-6s %-6s %.40s\n' "$pid" "$tty" "$cpu" "$mem" "$cmd"
  done
}

kill_session() {
  tmux has-session -t "$SESSION" 2>/dev/null && tmux kill-session -t "$SESSION" && echo "[OK] session '$SESSION' killed"
}

attach_session() {
  tmux attach -t "$SESSION"
}

case "${1:-}" in
  -k|--kill) kill_session ; exit ;;
  -a|--attach) attach_session ; exit ;;
  *)
    if tmux has-session -t "$SESSION" 2>/dev/null; then
      echo "[INFO] session '$SESSION' already exists. Attaching..."
      attach_session
    else
      create_session
      attach_session
    fi
    ;;
esac 