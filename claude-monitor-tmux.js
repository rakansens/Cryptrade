#!/usr/bin/env node

/**
 * Claude Tmux Monitor - tmux内のClaude Codeインスタンス可視化ツール
 *
 * 既存の `claude-monitor-multi.js` と同等の UI/機能を tmux pane ベースで実現。
 * - tmux list-panes で Claude が動作している pane を検出
 * - tmux capture-pane でリアルタイム出力を取得
 * - blessed でダッシュボード表示（概要 / インスタンス詳細 / 活動ストリーム）
 *
 * 使い方:
 *   $ node claude-monitor-tmux.js
 *   (依存: tmux, Node.js, blessed, util.promisify)
 */

const blessed = require('blessed');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ---- 設定 ----
const CONFIG = {
  UPDATE_INTERVAL_MS: 1000,   // 画面更新間隔
  CAPTURE_LINES: 50,          // pane から取得する行数
  ACTIVITY_LOG_MAX: 300,      // アクティビティ最大保持
};

// Claude 判定用コマンド名キーワード
const CLAUDE_CMD_REGEX = /(claude|cc|Claude|anthropic)/i;

// blessed スクリーン
const screen = blessed.screen({
  smartCSR: true,
  title: 'Claude Tmux Monitor',
  fullUnicode: true,
  forceUnicode: true,
  terminal: 'xterm-256color'
});

// パネル色
const colors = {
  border: 'white',
  active: 'green',
  inactive: 'gray'
};

// UI コンポーネント
const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 3,
  style: { fg: 'cyan', bold: true },
  border: { type: 'line', fg: 'cyan' },
  tags: true,
  align: 'center'
});

const overview = blessed.box({
  parent: screen,
  top: 3,
  left: 0,
  width: '100%',
  height: 5,
  border: { type: 'line', fg: colors.border },
  label: ' 📊 Overview ',
  tags: true
});

const details = blessed.box({
  parent: screen,
  top: 8,
  left: 0,
  width: '100%',
  height: 12,
  border: { type: 'line', fg: colors.border },
  label: ' 🖥️  Pane Details ',
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true
});

const activity = blessed.box({
  parent: screen,
  top: 20,
  left: 0,
  width: '100%',
  height: '100%-20',
  border: { type: 'line', fg: colors.border },
  label: ' 📡 Activity Stream ',
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true
});

// データ構造
const panes = new Map(); // paneId -> { pid, command, lastLines, lastActivity, color }
const activityLog = [];
const instanceColors = ['magenta', 'cyan', 'yellow', 'green', 'blue', 'red'];

// ---- ヘルパ ----
function colorForPane(id) {
  if (!panes.has(id)) return 'white';
  return panes.get(id).color;
}

async function listClaudePanes() {
  try {
    const { stdout } = await execPromise('tmux list-panes -a -F "#{pane_id} #{pane_pid} #{pane_current_command}"');
    const lines = stdout.split('\n').filter(Boolean);
    const seenPaneIds = new Set();

    for (const line of lines) {
      const [paneId, pid, cmd] = line.split(' ');
      if (!CLAUDE_CMD_REGEX.test(cmd)) continue;

      seenPaneIds.add(paneId);
      if (!panes.has(paneId)) {
        panes.set(paneId, {
          pid,
          cmd,
          color: instanceColors[Math.floor(Math.random()*instanceColors.length)],
          lastLines: [],
          lastActivity: Date.now()
        });
      } else {
        const p = panes.get(paneId);
        p.pid = pid;
        p.cmd = cmd;
      }
    }

    // remove panes that no longer exist
    for (const id of panes.keys()) {
      if (!seenPaneIds.has(id)) panes.delete(id);
    }
  } catch (err) {
    // ignore
  }
}

async function updatePaneLogs() {
  const promises = Array.from(panes.keys()).map(async paneId => {
    try {
      const { stdout } = await execPromise(`tmux capture-pane -pJ -E -${CONFIG.CAPTURE_LINES} -t ${paneId}`);
      const lines = stdout.trim().split('\n');
      const pane = panes.get(paneId);
      if (!pane) return;
      // Detect new lines
      const newLines = lines.slice(pane.lastLines.length);
      if (newLines.length > 0) {
        pane.lastActivity = Date.now();
        newLines.forEach(l => {
          activityLog.unshift({ paneId, line: l.slice(0,100) });
        });
        while (activityLog.length > CONFIG.ACTIVITY_LOG_MAX) activityLog.pop();
      }
      pane.lastLines = lines;
    } catch {}
  });
  await Promise.all(promises);
}

function renderHeader() {
  const total = panes.size;
  const active = Array.from(panes.values()).filter(p=>Date.now()-p.lastActivity<30000).length;
  header.setContent(`{bold}{cyan-fg}Claude Tmux Monitor{/cyan-fg}{/bold}\nアクティブ: {green-fg}${active}{/green-fg}/${total} | ${new Date().toLocaleString('ja-JP')}`);
}

function renderOverview() {
  let content = '';
  panes.forEach((pane, id) => {
    const status = Date.now()-pane.lastActivity<30000 ? '●' : '○';
    content += `{${pane.color}-fg}${status} ${id}{/} `;
  });
  overview.setContent(content || 'No Claude pane detected');
}

function renderDetails() {
  let content = '';
  panes.forEach((pane, id) => {
    const active = Date.now()-pane.lastActivity<30000;
    content += `{bold}{${pane.color}-fg}${active?'🟢':'⚫'} Pane ${id}{/}{/bold}\n`;
    content += `  PID: ${pane.pid} | CMD: ${pane.cmd}\n`;
    const lastLine = pane.lastLines[pane.lastLines.length-1] || '';
    content += `  Last: ${lastLine.slice(0,80)}\n`;
    content += `{gray-fg}${'─'.repeat(40)}{/gray-fg}\n`;
  });
  details.setContent(content);
}

function renderActivity() {
  let content = '';
  activityLog.slice(0,100).forEach(a=>{
    const col = colorForPane(a.paneId);
    content += `{${col}-fg}[${a.paneId}]{/} ${a.line}\n`;
  });
  activity.setContent(content);
}

async function tick() {
  await listClaudePanes();
  await updatePaneLogs();
  renderHeader();
  renderOverview();
  renderDetails();
  renderActivity();
  screen.render();
}

// 初期化
(async ()=>{
  await tick();
  setInterval(tick, CONFIG.UPDATE_INTERVAL_MS);
})();

// キーバインド
screen.key(['escape','q','C-c'], ()=>process.exit(0)); 