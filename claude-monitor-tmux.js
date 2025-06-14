#!/usr/bin/env node
/**
 * claude-monitor-tmux.js - Node.js orchestrator for tmux-based Claude monitor
 * -------------------------------------------------------
 * 2024-06-14  初版
 *   - tmux セッションを生成し 3 pane を自動レイアウト
 *   - 概要 / プロセス詳細 / アクティビティログ を可視化
 *   - ./claude-monitor-tmux.js           新規起動 or 既存へアタッチ
 *   - ./claude-monitor-tmux.js -a|--attach  既存へアタッチ
 *   - ./claude-monitor-tmux.js -k|--kill    セッション kill
 */

const { execSync } = require('child_process');
const SESSION = 'claude-monitor';
const LOG_FILE = '/tmp/claude_activity.log';
const UPDATE_INTERVAL = 2; // sec

function sh(cmd) {
  execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
}

function hasSession() {
  try {
    execSync(`tmux has-session -t ${SESSION} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

function killSession() {
  if (hasSession()) {
    sh(`tmux kill-session -t ${SESSION}`);
    console.log(`[OK] session '${SESSION}' killed`);
  }
}

function attachSession() {
  sh(`tmux attach -t ${SESSION}`);
}

function createSession() {
  // PS command for Claude processes
  const PS_CMD = "ps -u $(whoami) -o pid,tty,%cpu,%mem,command | grep -E '(claude|anthropic)' | grep -v grep";

  // Start session detached
  sh(`tmux new-session -d -s ${SESSION} -n monitor`);

  // Pane0: overview loop
  const overviewLoop = [
    'while :; do',
    'clear',
    'echo "========== Claude Monitor (tmux) =========="',
    'date +"日時        : %F %T"',
    `mapfile -t LINES < <(${PS_CMD})`,
    'TOTAL=${#LINES[@]}',
    'CPU_SUM=0; MEM_SUM=0',
    'for L in "${LINES[@]}"; do read -r P T C M CMD <<<"$L"; CPU_SUM=$(awk "BEGIN{print $CPU_SUM+$C}"); MEM_SUM=$(awk "BEGIN{print $MEM_SUM+$M}"); done',
    'echo "インスタンス: $TOTAL"',
    'printf "CPU合計     : %.1f%%\n" "$CPU_SUM"',
    'printf "Mem合計     : %.1f%%\n" "$MEM_SUM"',
    'echo "-------------------------------------------"',
    'printf "%-6s %-8s %-6s %-6s %s\n" PID TTY CPU MEM COMMAND',
    'printf "%-6s %-8s %-6s %-6s %s\n" ------ -------- --- --- -----------------------------',
    'for L in "${LINES[@]}"; do read -r P T C M CMD <<<"$L"; printf "%-6s %-8s %-6s %-6s %.40s\n" "$P" "$T" "$C" "$M" "$CMD"; done',
    `sleep ${UPDATE_INTERVAL}`,
    'done'
  ].join(' ; ');
  sh(`tmux send-keys -t ${SESSION}:0.0 "bash -c '${overviewLoop}'" C-m`);

  // Pane1: watch detailed ps
  sh(`tmux split-window -v -t ${SESSION}:0.0 -p 40`);
  sh(`tmux send-keys -t ${SESSION}:0.1 "watch -n ${UPDATE_INTERVAL} -c \"${PS_CMD}\"" C-m`);

  // Pane2: tail log
  sh(`tmux split-window -h -t ${SESSION}:0.1 -p 50`);
  sh(`tmux send-keys -t ${SESSION}:0.2 "touch ${LOG_FILE}; tail -n 200 -f ${LOG_FILE}" C-m`);

  // Layout tidy
  sh(`tmux select-pane -t ${SESSION}:0.0`);
  sh(`tmux select-layout -t ${SESSION}:0 tiled >/dev/null`);

  console.log(`[OK] tmux session '${SESSION}' created`);
}

const arg = process.argv[2] || '';
if (arg === '-k' || arg === '--kill') {
  killSession();
  process.exit(0);
}
if (arg === '-a' || arg === '--attach') {
  if (hasSession()) attachSession();
  else console.error(`session '${SESSION}' not found.`);
  process.exit(0);
}

if (hasSession()) {
  console.log(`[INFO] session '${SESSION}' already exists. Attaching...`);
  attachSession();
} else {
  createSession();
  attachSession();
} 