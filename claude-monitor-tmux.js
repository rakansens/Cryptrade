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
const contrib = require('blessed-contrib');

// ---- 設定 ----
const CONFIG = {
  UPDATE_INTERVAL_MS: 1000,   // 画面更新間隔
  CAPTURE_LINES: 50,          // pane から取得する行数
  ACTIVITY_LOG_MAX: 300,      // アクティビティ最大保持
};

// Claude 判定用コマンド名キーワード
const CLAUDE_CMD_REGEX = /(claude|cc|Claude|anthropic)/i;

// blessed スクリーン & grid
const screen = blessed.screen({
  smartCSR: true,
  title: 'Claude Tmux Monitor',
  fullUnicode: true,
  forceUnicode: true,
  terminal: 'xterm-256color'
});

const grid = new contrib.grid({ rows: 12, cols: 12, screen });

// パネル色
const colors = {
  border: 'white',
  active: 'green',
  inactive: 'gray'
};

// UI コンポーネント (grid)
const header = grid.set(0, 0, 1, 12, blessed.box, {
  style: { fg: 'cyan', bold: true },
  border: { type: 'line', fg: 'cyan' },
  tags: true,
  align: 'center'
});

// sparkline CPU/Mem
const sparklineBox = grid.set(1, 0, 2, 12, contrib.sparkline, {
  label: 'CPU / Mem Trend',
  tags: true,
  style: { fg: 'yellow', titleFg: 'white', border: { fg: colors.border } }
});

// Overview summary line (under sparkline)
const overview = grid.set(3, 0, 1, 12, blessed.box, {
  border: { type: 'line', fg: colors.border },
  label: ' 📊 Overview ',
  tags: true
});

// Pane list (collapsible)
const detailsList = grid.set(4, 0, 4, 12, blessed.list, {
  label: ' 🖥️  Pane List (Enterで詳細) ',
  border: { type: 'line', fg: colors.border },
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
  scrollbar: { ch: ' ', track: { bg: 'gray' }, style: { inverse: true } }
});

// Activity stream split columns
const activityLeft = grid.set(8, 0, 4, 6, blessed.box, {
  label: ' ⏳ Timeline ',
  border: { type: 'line', fg: colors.border },
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true
});

const activityRight = grid.set(8, 6, 4, 6, blessed.box, {
  label: ' ⚠️  Important ',
  border: { type: 'line', fg: colors.border },
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true
});

// データ構造
const panes = new Map(); // paneId -> { pid, command, lastLines, lastActivity, color }
const activityLog = [];
const importantLog = [];
const instanceColors = ['magenta', 'cyan', 'yellow', 'green', 'blue', 'red'];

// --- CPU/Mem Trend arrays ---
const cpuTrend = [];
const memTrend = [];

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
      // 推移取得（合計CPU/Memをsimple取得）
      const totalCpu = Array.from(panes.values()).reduce((s,p)=>s+parseFloat(p.cpu||0),0);
      const totalMem = Array.from(panes.values()).reduce((s,p)=>s+parseFloat(p.mem||0),0);
      cpuTrend.push(totalCpu);
      memTrend.push(totalMem);
      if(cpuTrend.length>30){cpuTrend.shift();memTrend.shift();}
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
    const inactiveMs = Date.now()-pane.lastActivity;
    let statusColor = 'green';
    if(inactiveMs>120000) statusColor='red';
    else if(inactiveMs>30000) statusColor='yellow';
    content += `{${statusColor}-fg}●{/} {${pane.color}-fg}${id}{/} `;
  });
  overview.setContent(content || 'No Claude pane detected');
}

function renderDetails() {
  const items=[];
  panes.forEach((pane,id)=>{
    const inactiveMs=Date.now()-pane.lastActivity;
    const status=inactiveMs<30000?'🟢':(inactiveMs<120000?'��':'🔴');
    items.push(`${status} ${id} PID:${pane.pid}`);
  });
  detailsList.setItems(items);
}

function renderActivity() {
  let content = '';
  activityLog.slice(0,100).forEach(a=>{
    const col = colorForPane(a.paneId);
    content += `{${col}-fg}[${a.paneId}]{/} ${a.line}\n`;
  });
  activityLeft.setContent(content);

  let imp='';
  importantLog.slice(0,100).forEach(a=>{
    imp+=a+'\n';
  });
  activityRight.setContent(imp);
}

async function tick() {
  await listClaudePanes();
  await updatePaneLogs();
  // CPU/Mem計測
  const pids = Array.from(panes.values()).map(p=>p.pid).join(',');
  if(pids){
    try{
      const { stdout } = await execPromise(`ps -o pid,%cpu,%mem -p ${pids}`);
      stdout.split('\n').slice(1).forEach(line=>{
        const parts=line.trim().split(/\s+/);
        if(parts.length>=3){
          const pid=parts[0];
          const cpu=parseFloat(parts[1]);
          const mem=parseFloat(parts[2]);
          for(const pane of panes.values()) if(pane.pid===pid){pane.cpu=cpu;pane.mem=mem;}
        }
      });
    }catch{}
  }

  // sparkline update (swap args order)
  if(cpuTrend.length>1){
    sparklineBox.setData(['CPU','Mem'], [cpuTrend, memTrend]);
  }

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

// list enter to open detail modal
detailsList.on('select', (_,index)=>{
  const paneId = Array.from(panes.keys())[index];
  if(!paneId) return;
  const pane = panes.get(paneId);
  const box = blessed.box({
    parent: screen,
    top: 'center',left:'center',width:'80%',height:'70%',
    border:{type:'line',fg:pane.color},
    label:` Details ${paneId} `,tags:true,scrollable:true,keys:true,vi:true,alwaysScroll:true
  });
  box.setContent(pane.lastLines.join('\n'));
  box.focus();
  box.key(['escape','q','C-c','enter'], ()=>{box.detach();screen.render();});
  screen.render();
});

// override renderDetails to populate list items
screen.key(['escape','q','C-c'], ()=>process.exit(0)); 