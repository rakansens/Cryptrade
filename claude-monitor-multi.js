#!/usr/bin/env node

/**
 * Claude Multi-Instance Monitor - 複数Claude Code対応モニター
 * 並列実行されるClaude Codeインスタンスを個別に追跡・表示
 */

const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const crypto = require('crypto');
const chokidar = require('chokidar');

// スクリーンを作成（UTF-8対応）
const screen = blessed.screen({
  smartCSR: true,
  title: 'Claude Multi-Instance Monitor',
  fullUnicode: true,
  forceUnicode: true,
  terminal: 'xterm-256color',
  encoding: 'utf-8'
});

// カラーパレット（インスタンスごとに異なる色を割り当て）
const instanceColors = ['magenta', 'cyan', 'yellow', 'green', 'blue', 'red'];
const colors = {
  header: 'cyan',
  border: 'white',
  active: 'green',
  inactive: 'gray',
  warning: 'yellow',
  error: 'red'
};

// ファイル拡張子とアイコンのマッピング
const FILE_ICONS = {
  '.js': '📜', '.ts': '📘', '.tsx': '⚛️', '.jsx': '⚛️',
  '.json': '📋', '.md': '📝', '.txt': '📄', '.css': '🎨',
  '.html': '🌐', '.py': '🐍', '.sh': '🔧', '.yml': '⚙️',
  '.yaml': '⚙️', '.env': '🔐'
};

// 操作タイプとシンボルのマッピング
const OPERATION_SYMBOLS = {
  'create': '✨', 'edit': '✏️', 'delete': '🗑️', 'read': '👁️'
};

// 操作タイプとEmoji
const OPERATION_EMOJIS = {
  '作成': '✨',
  '編集': '✏️',
  '削除': '🗑️',
  '読み込み': '👁️'
};

// 推定トークン数（操作タイプ別）
const ESTIMATED_TOKENS = {
  'create': { input: 500, output: 1000 },
  'edit': { input: 800, output: 1200 },
  'delete': { input: 200, output: 300 },
  'read': { input: 300, output: 100 }
};

// 対象ファイル拡張子
const TARGET_EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx', '.json', '.md', '.css', '.html', '.py', '.sh', '.yml', '.yaml', '.txt', '.log', '.xml', '.env'];

// 設定値
const CONFIG = {
  // 時間関連
  ACTIVE_THRESHOLD_MS: 30000,        // アクティブ判定時間（30秒）
  LOG_CHECK_INTERVAL_MS: 100,        // ログファイル監視間隔
  PROCESS_CHECK_INTERVAL_MS: 2000,   // プロセス監視間隔
  UPDATE_INTERVAL_MS: 500,           // 画面更新間隔
  FILE_CHANGE_THRESHOLD_MS: 10000,   // ファイル変更検出閾値（10秒）
  FILE_READ_THRESHOLD_MS: 5000,      // ファイル読み込み検出閾値（5秒）
  
  // 数量関連
  MAX_ACTIVITY_LOG: 500,             // アクティビティログ最大保持数
  MAX_FILE_OPERATIONS: 30,           // ファイル操作履歴表示数
  FILE_TRACKER_CLEANUP_SIZE: 1000,   // ファイルトラッカークリーンアップサイズ
  INITIAL_LOG_LINES: 500,            // 初回読み込みログ行数
  
  // パネルサイズ
  HEADER_HEIGHT: 3,
  OVERVIEW_HEIGHT: 9,
  INSTANCES_HEIGHT: 12,
  ACTIVITY_HEIGHT: 12,
  HISTORY_PANEL_HEIGHT: 20,
  
  // コスト計算（Claude 3.5 Sonnet）
  COST_PER_MILLION_INPUT: 0.003,
  COST_PER_MILLION_OUTPUT: 0.015
};

// 共通関数
function getScrollbarConfig() {
  return {
    ch: ' ',
    track: {
      bg: 'gray'
    },
    style: {
      inverse: true
    }
  };
}

function getOperationType(line) {
  if (line.includes('作成')) return 'create';
  if (line.includes('編集')) return 'edit';
  if (line.includes('削除')) return 'delete';
  return 'read';
}

function recordFileOperation(instance, filePath, operation, time) {
  // グローバルな操作履歴に保存
  if (!fileOperations.has(filePath)) {
    fileOperations.set(filePath, []);
  }
  
  const operationRecord = {
    instanceId: instance.id,
    instanceColor: instance.color,
    operation,
    time,
    pid: instance.pid
  };
  
  fileOperations.get(filePath).push(operationRecord);
  
  // インスタンス固有の操作履歴に保存
  if (!instance.fileOperations) {
    instance.fileOperations = new Map();
  }
  if (!instance.fileOperations.has(filePath)) {
    instance.fileOperations.set(filePath, []);
  }
  instance.fileOperations.get(filePath).push(operationRecord);
  
  instance.fileCount++;
}

// レイアウトコンテナ（全体スクロール可能）
const container = blessed.box({
  parent: screen,
  width: '100%',
  height: '100%',
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true,
  mouse: true,
  scrollbar: getScrollbarConfig()
});

// ヘッダー
const header = blessed.box({
  parent: container,
  top: 0,
  left: 0,
  width: '100%',
  height: CONFIG.HEADER_HEIGHT,
  border: {
    type: 'line',
    fg: colors.header
  },
  style: {
    fg: colors.header,
    bold: true
  },
  align: 'center',
  tags: true
});

// インスタンス概要パネル
const overviewPanel = blessed.box({
  parent: container,
  top: CONFIG.HEADER_HEIGHT,
  left: 0,
  width: '100%',
  height: CONFIG.OVERVIEW_HEIGHT,
  border: {
    type: 'line',
    fg: colors.border
  },
  label: ' 📊 Claude Instances Overview ',
  tags: true,
  scrollable: true
});

// インスタンス詳細パネル
const instancesPanel = blessed.box({
  parent: container,
  top: CONFIG.HEADER_HEIGHT + CONFIG.OVERVIEW_HEIGHT,
  left: 0,
  width: '100%',
  height: CONFIG.INSTANCES_HEIGHT,
  border: {
    type: 'line',
    fg: colors.border
  },
  label: ' 🖥️  Instance Details ',
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true,
  mouse: true,
  scrollbar: getScrollbarConfig()
});

// アクティビティストリーム
const activityStream = blessed.box({
  parent: container,
  top: CONFIG.HEADER_HEIGHT + CONFIG.OVERVIEW_HEIGHT + CONFIG.INSTANCES_HEIGHT,
  left: 0,
  width: '100%',
  height: CONFIG.ACTIVITY_HEIGHT,
  border: {
    type: 'line',
    fg: colors.border
  },
  label: ' 📡 Live Activity Stream ',
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  keys: true,
  vi: true,
  mouse: true,
  scrollbar: getScrollbarConfig()
});

// トークン使用量パネルは削除（Overviewに統合）

// File Operations Matrixは削除（インスタンス別履歴に統合）

// データ構造
const claudeInstances = new Map(); // PID -> Instance情報
const activityLog = [];
const fileOperations = new Map(); // ファイルパス -> 操作履歴
const startTime = Date.now();
const instanceHistoryPanels = new Map(); // インスタンスID -> パネル

// インスタンス情報の構造
class ClaudeInstance {
  constructor(pid, command, tty) {
    this.pid = pid;
    this.command = command;
    this.tty = tty || 'unknown';
    this.startTime = Date.now();
    this.cpu = 0;
    this.memory = 0;
    this.activities = [];
    this.fileCount = 0;
    this.lastActivity = Date.now();
    this.color = instanceColors[Math.floor(Math.random() * instanceColors.length)];
    this.id = this.generateId();
    this.workingDir = this.extractWorkingDir(command);
    // トークン使用量追跡
    this.tokens = {
      input: 0,
      output: 0,
      total: 0,
      cost: 0,
      model: 'unknown'
    };
    this.fileOperations = new Map(); // インスタンス固有のファイル操作履歴
  }

  generateId() {
    // TTYとPIDから一意のIDを生成
    return `${this.tty.replace('/', '-')}_${this.pid}`;
  }

  extractWorkingDir(command) {
    // コマンドから作業ディレクトリを推測
    const match = command.match(/cd\s+([^\s;]+)|--workdir\s+([^\s]+)/);
    if (match) return match[1] || match[2];
    
    // プロセスの現在のディレクトリを取得
    try {
      const { stdout } = require('child_process').execSync(`lsof -p ${this.pid} | grep cwd | awk '{print $NF}'`);
      return stdout.trim();
    } catch {
      return 'unknown';
    }
  }

  get isActive() {
    // 設定された時間内にアクティビティがあればアクティブとみなす
    return Date.now() - this.lastActivity < CONFIG.ACTIVE_THRESHOLD_MS;
  }

  get uptime() {
    const elapsed = Date.now() - this.startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  get startTimeFormatted() {
    return new Date(this.startTime).toLocaleTimeString('ja-JP');
  }
}

// Claude関連プロセスを検索（詳細情報付き）
async function findClaudeProcesses() {
  try {
    // より幅広いパターンでClaude関連プロセスを検索
    const patterns = [
      'claude',
      'anthropic', 
      'node.*claude',
      'Claude.*Code',
      'ClaudeCode',
      'claude-code',
      'claude.*cli'
    ];
    const grepPattern = patterns.join('|');
    const { stdout } = await execPromise(`ps aux | grep -E '(${grepPattern})' | grep -v grep | grep -v ${process.pid}`);
    const lines = stdout.trim().split('\n').filter(line => line);
    
    const currentPIDs = new Set();
    
    for (const line of lines) {
      const parts = line.split(/\s+/);
      const pid = parts[1];
      const cpu = parseFloat(parts[2]);
      const mem = parseFloat(parts[3]);
      const command = parts.slice(10).join(' ');
      
      // TTY情報を取得
      let tty = 'unknown';
      try {
        const { stdout: ttyInfo } = await execPromise(`ps -p ${pid} -o tty=`);
        tty = ttyInfo.trim();
      } catch {}
      
      currentPIDs.add(pid);
      
      if (!claudeInstances.has(pid)) {
        // 新しいインスタンスを登録
        claudeInstances.set(pid, new ClaudeInstance(pid, command, tty));
        
        // 新規インスタンス検出をアクティビティに記録
        activityLog.unshift({
          time: new Date().toLocaleTimeString('ja-JP'),
          instanceId: claudeInstances.get(pid).id,
          color: claudeInstances.get(pid).color,
          message: `🚀 新しいClaude Codeインスタンスを検出 (PID: ${pid})`
        });
      }
      
      // 既存インスタンスの情報を更新
      const instance = claudeInstances.get(pid);
      instance.cpu = cpu;
      instance.memory = mem;
    }
    
    // 終了したインスタンスを検出
    for (const [pid, instance] of claudeInstances) {
      if (!currentPIDs.has(pid)) {
        activityLog.unshift({
          time: new Date().toLocaleTimeString('ja-JP'),
          instanceId: instance.id,
          color: instance.color,
          message: `🛑 Claude Codeインスタンスが終了 (PID: ${pid})`
        });
        claudeInstances.delete(pid);
      }
    }
    
  } catch (error) {
    // エラーは無視
  }
}

// ログファイルを監視（インスタンス識別機能付き）
function watchLogFile() {
  const logFile = '/tmp/claude_activity.log';
  
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '');
  }
  
  // 初回起動時に既存のログを読み込む
  // 注意: 過去のログを読み込む際は、現在存在するインスタンスのPIDのみを処理する
  try {
    const existingContent = fs.readFileSync(logFile, 'utf8');
    const lines = existingContent.split('\n').filter(line => line.trim());
    
    // 設定された行数を処理
    // ただし、processLogLineで存在しないPIDは自動的にスキップされる
    lines.slice(-CONFIG.INITIAL_LOG_LINES).forEach(line => {
      processLogLine(line);
    });
  } catch (error) {
    // エラーは無視
  }
  
  let lastSize = fs.statSync(logFile).size;
  
  setInterval(() => {
    try {
      const stats = fs.statSync(logFile);
      if (stats.size > lastSize) {
        const buffer = Buffer.alloc(stats.size - lastSize);
        const fd = fs.openSync(logFile, 'r');
        fs.readSync(fd, buffer, 0, buffer.length, lastSize);
        fs.closeSync(fd);
        
        const newContent = buffer.toString('utf8');
        const lines = newContent.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          processLogLine(line);
        });
        
        lastSize = stats.size;
      }
    } catch (error) {
      // エラーは無視
    }
  }, CONFIG.LOG_CHECK_INTERVAL_MS);
}

// ログ行を処理（インスタンス別に分類）
function processLogLine(line) {
  const time = new Date().toLocaleTimeString('ja-JP');
  
  // PIDやインスタンス識別子を抽出
  const pidMatch = line.match(/\[PID:(\d+)\]/);
  const pid = pidMatch ? pidMatch[1] : null;
  
  // トークン使用量情報を抽出
  const tokenMatch = line.match(/(?:tokens?|トークン).*?(?:input|入力)\s*[:：]\s*(\d+).*?(?:output|出力)\s*[:：]\s*(\d+)/i);
  const modelMatch = line.match(/(?:model|モデル)\s*[:：]\s*([\w-]+)/i);
  const costMatch = line.match(/(?:cost|コスト|\$)\s*[:：]?\s*([\d.]+)/i);
  
  // 該当するインスタンスを見つける
  let instance = null;
  if (pid && claudeInstances.has(pid)) {
    instance = claudeInstances.get(pid);
  } else if (pid && pid !== 'auto') {
    // PIDが指定されているが、インスタンスが見つからない場合はスキップ
    return;
  } else {
    // PIDが'auto'の場合のみ、アクティブなインスタンスから推測
    // ただし、複数のアクティブなインスタンスがある場合は処理をスキップ
    const activeInstances = Array.from(claudeInstances.values()).filter(inst => inst.isActive);
    if (activeInstances.length === 1) {
      instance = activeInstances[0];
    } else {
      // 複数のアクティブなインスタンスがある場合は、正確に特定できないのでスキップ
      return;
    }
  }
  
  if (instance) {
    instance.lastActivity = Date.now();
    instance.activities.push({
      time,
      message: line
    });
    
    // ファイル操作を検出
    const fileMatch = line.match(/file_operation:\s*(?:作成|編集|削除|読み込み)\s+(.+?\.(js|ts|tsx|jsx|json|md|css|html|py|sh|yml|yaml|txt|log|xml|env))/);
    if (fileMatch) {
      const filePath = fileMatch[1].trim();
      const operation = getOperationType(line);
      recordFileOperation(instance, filePath, operation, time);
    }
    
    // トークン使用量を更新（実際のトークン情報が取得できない場合は推定値を使用）
    if (tokenMatch) {
      const inputTokens = parseInt(tokenMatch[1]);
      const outputTokens = parseInt(tokenMatch[2]);
      instance.tokens.input += inputTokens;
      instance.tokens.output += outputTokens;
      instance.tokens.total = instance.tokens.input + instance.tokens.output;
    } else {
      // ファイル操作やアクティビティに基づいて推定
      if (fileMatch) {
        const operation = getOperationType(line);
        const est = ESTIMATED_TOKENS[operation];
        instance.tokens.input += est.input;
        instance.tokens.output += est.output;
        instance.tokens.total = instance.tokens.input + instance.tokens.output;
        instance.tokens.model = 'claude-3.5-sonnet';
        
        // 推定コスト計算
        instance.tokens.cost = (instance.tokens.input * CONFIG.COST_PER_MILLION_INPUT / 1000000) + 
                              (instance.tokens.output * CONFIG.COST_PER_MILLION_OUTPUT / 1000000);
      }
    }
    
    if (modelMatch) {
      instance.tokens.model = modelMatch[1];
    }
    
    if (costMatch) {
      instance.tokens.cost += parseFloat(costMatch[1]);
    }
    
    // アクティビティストリームに追加
    activityLog.unshift({
      time,
      instanceId: instance.id,
      color: instance.color,
      message: line.substring(0, 50) + (line.length > 50 ? '...' : '')
    });
  }
  
  // 最大保持数まで保持
  if (activityLog.length > CONFIG.MAX_ACTIVITY_LOG) {
    activityLog.pop();
  }
}

// ヘッダーを更新
function updateHeader() {
  const now = new Date();
  const elapsed = new Date(Date.now() - startTime);
  const elapsedStr = `${elapsed.getUTCHours().toString().padStart(2, '0')}:${elapsed.getUTCMinutes().toString().padStart(2, '0')}:${elapsed.getUTCSeconds().toString().padStart(2, '0')}`;
  
  const activeCount = Array.from(claudeInstances.values()).filter(i => i.isActive).length;
  
  header.setContent(
    `{bold}{cyan-fg}Claude Multi-Instance Monitor{/cyan-fg}{/bold}\n` +
    `稼働時間: ${elapsedStr} | アクティブ: {green-fg}${activeCount}{/green-fg} / 総数: ${claudeInstances.size} | ${now.toLocaleString('ja-JP')}`
  );
}

// 概要パネルを更新
function updateOverviewPanel() {
  let content = '';
  const instances = Array.from(claudeInstances.values());
  
  // CPU/メモリの合計
  const totalCPU = instances.reduce((sum, i) => sum + i.cpu, 0);
  const totalMem = instances.reduce((sum, i) => sum + i.memory, 0);
  
  content += `{bold}リソース使用状況:{/bold} `;
  content += `CPU: {${totalCPU > 50 ? 'red' : 'green'}-fg}${totalCPU.toFixed(1)}%{/} | `;
  content += `Memory: {${totalMem > 50 ? 'red' : 'green'}-fg}${totalMem.toFixed(1)}%{/}\n\n`;
  
  // インスタンスサマリー（横並び）
  content += `{bold}インスタンス:{/bold} `;
  instances.forEach(inst => {
    const status = inst.isActive ? '●' : '○';
    content += `{${inst.color}-fg}${status} ${inst.id}{/} `;
  });
  content += '\n\n';
  
  // トークン使用量統計（統合）
  const totalTokens = instances.reduce((sum, i) => sum + i.tokens.total, 0);
  const totalCost = instances.reduce((sum, i) => sum + i.tokens.cost, 0);
  
  content += `{bold}🪙 トークン使用量 (推定):{/bold}\n`;
  content += `総トークン: {yellow-fg}${totalTokens.toLocaleString()}{/} | `;
  content += `推定コスト: {green-fg}$${totalCost.toFixed(4)}{/}\n`;
  
  // 上位3インスタンスのトークン使用量
  const topInstances = instances
    .sort((a, b) => b.tokens.total - a.tokens.total)
    .slice(0, 3);
  
  if (topInstances.length > 0) {
    content += '\n{bold}上位使用:{/bold} ';
    topInstances.forEach(inst => {
      if (inst.tokens.total > 0) {
        content += `{${inst.color}-fg}${inst.id}: ${inst.tokens.total.toLocaleString()}{/} `;
      }
    });
  }
  
  overviewPanel.setContent(content);
}

// インスタンス詳細パネルを更新
function updateInstancesPanel() {
  let content = '';
  const instances = Array.from(claudeInstances.values()).sort((a, b) => b.lastActivity - a.lastActivity);
  
  instances.forEach(inst => {
    const statusIcon = inst.isActive ? '🟢' : '⚫';
    const cpuPercent = Math.min(Math.max(0, inst.cpu), 100);
    const cpuBarFilled = Math.floor(cpuPercent / 10);
    const cpuBar = '█'.repeat(cpuBarFilled) + '░'.repeat(10 - cpuBarFilled);
    
    content += `{bold}{${inst.color}-fg}${statusIcon} Instance: ${inst.id}{/}{/bold}\n`;
    content += `  PID: ${inst.pid} | TTY: ${inst.tty} | 開始: ${inst.startTimeFormatted}\n`;
    content += `  稼働時間: {bold}${inst.uptime}{/bold} | `;
    const lastActivityTime = new Date(inst.lastActivity).toLocaleTimeString('ja-JP');
    content += `最終活動: ${lastActivityTime}\n`;
    content += `  CPU: {${inst.cpu > 20 ? 'yellow' : 'green'}-fg}${cpuBar} ${inst.cpu.toFixed(1)}%{/} | `;
    content += `Mem: {${inst.memory > 20 ? 'yellow' : 'green'}-fg}${inst.memory.toFixed(1)}%{/}\n`;
    content += `  作業Dir: {gray-fg}${inst.workingDir}{/gray-fg}\n`;
    content += `  ファイル操作数: {cyan-fg}${inst.fileCount}{/cyan-fg} | `;
    content += `推定トークン: {yellow-fg}${inst.tokens.total.toLocaleString()}{/yellow-fg}\n`;
    content += `{gray-fg}${'─'.repeat(55)}{/gray-fg}\n`;
  });
  
  instancesPanel.setContent(content);
}

// アクティビティストリームを更新
function updateActivityStream() {
  let content = '';
  
  activityLog.slice(0, 50).forEach(activity => {
    content += `{gray-fg}${activity.time}{/} `;
    content += `{${activity.color}-fg}[${activity.instanceId}]{/} `;
    content += `${activity.message}\n`;
  });
  
  activityStream.setContent(content);
}

// File Operations Matrixは削除（インスタンス別履歴に統合）

// トークン使用量パネルは削除（Overviewに統合済み）

// インスタンス別ファイル履歴パネルを作成・更新
function updateInstanceHistoryPanels() {
  // 現在のインスタンス数に基づいてパネルを動的に作成
  const instances = Array.from(claudeInstances.values())
    .sort((a, b) => {
      // アクティブなインスタンスを上位に表示
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      // 両方アクティブまたは非アクティブの場合は、最終活動時間でソート
      return b.lastActivity - a.lastActivity;
    });
  let currentTop = 36; // File Operations Matrixの下から開始
  
  instances.forEach((instance, index) => {
    const panelId = `history_${instance.id}`;
    let panel = instanceHistoryPanels.get(panelId);
    
    // パネルが存在しない場合は作成
    if (!panel) {
      panel = blessed.box({
        parent: container,
        top: currentTop,
        left: 0,
        width: '100%',
        height: CONFIG.HISTORY_PANEL_HEIGHT,
        border: {
          type: 'line',
          fg: instance.color
        },
        label: ` 📂 ${instance.id} File History (開始: ${instance.startTimeFormatted}) `,
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        keys: true,
        vi: true,
        mouse: true,
        scrollbar: {
          ch: ' ',
          track: {
            bg: 'gray'
          },
          style: {
            inverse: true
          }
        }
      });
      
      // スクロールキーバインド
      panel.key(['up', 'k'], function() {
        panel.scroll(-1);
        screen.render();
      });
      
      panel.key(['down', 'j'], function() {
        panel.scroll(1);
        screen.render();
      });
      
      instanceHistoryPanels.set(panelId, panel);
      panels.push(panel); // タブ切り替え用配列に追加
    }
    
    // パネルの位置を更新
    panel.top = currentTop;
    
    // インスタンス固有のファイル操作履歴を使用
    const instanceFiles = instance.fileOperations || new Map();
    
    // コンテンツを生成
    let content = `{bold}ファイル操作数: ${instance.fileCount} | `;
    content += `推定トークン: ${instance.tokens.total.toLocaleString()} | `;
    content += `稼働時間: ${instance.uptime}{/bold}\n`;
    
    // アクティブ状態の表示
    const inactiveDuration = Date.now() - instance.lastActivity;
    const inactiveMinutes = Math.floor(inactiveDuration / 60000);
    if (instance.isActive) {
      content += `{green-fg}● アクティブ{/green-fg}\n\n`;
    } else {
      content += `{gray-fg}○ 非アクティブ (${inactiveMinutes}分間){/gray-fg}\n\n`;
    }
    
    if (instanceFiles.size === 0) {
      content += '{gray-fg}まだファイル操作がありません{/gray-fg}';
    } else {
      // 最新の操作順にソート
      const sortedFiles = Array.from(instanceFiles.entries())
        .sort((a, b) => {
          const lastA = a[1][a[1].length - 1].time;
          const lastB = b[1][b[1].length - 1].time;
          return lastB.localeCompare(lastA);
        });
      
      sortedFiles.forEach(([filePath, ops]) => {
        const fileName = path.basename(filePath);
        const relativeDir = path.relative(process.cwd(), path.dirname(filePath)) || '.';
        const ext = path.extname(fileName).toLowerCase();
        const fileIcon = FILE_ICONS[ext] || '📄';
        
        content += `${fileIcon} {bold}${fileName}{/bold} {gray-fg}(${relativeDir}){/gray-fg}\n`;
        
        // 操作履歴（設定された件数）
        const recentOps = ops.slice(-CONFIG.MAX_FILE_OPERATIONS);
        
        content += '   ';
        recentOps.forEach((op, index) => {
          // 10件ごとに改行
          if (index > 0 && index % 10 === 0) {
            content += '\n   ';
          }
          content += `${OPERATION_SYMBOLS[op.operation] || '?'} `;
        });
        
        if (ops.length > CONFIG.MAX_FILE_OPERATIONS) {
          content += `{gray-fg}... (計${ops.length}回){/gray-fg}`;
        }
        
        content += ` {gray-fg}最終: ${ops[ops.length - 1].time}{/gray-fg}\n`;
      });
    }
    
    panel.setContent(content);
    currentTop += CONFIG.HISTORY_PANEL_HEIGHT; // 次のパネルの位置
  });
  
  // 不要になったパネルを削除
  for (const [panelId, panel] of instanceHistoryPanels) {
    const instanceId = panelId.replace('history_', '');
    const stillExists = instances.some(inst => inst.id === instanceId);
    
    if (!stillExists) {
      panel.detach();
      instanceHistoryPanels.delete(panelId);
      const panelIndex = panels.indexOf(panel);
      if (panelIndex > -1) {
        panels.splice(panelIndex, 1);
      }
    }
  }
}

// ファイルシステムの変更を自動的に検出してログに記録
function startFileSystemWatcher() {
  const watchDir = process.cwd();
  const watcher = chokidar.watch(watchDir, {
    ignored: [
      /node_modules/,
      /\.git/,
      /\.next/,
      /dist/,
      /build/,
      /coverage/,
      /\.DS_Store/,
      /claude_activity\.log/,
      /\.idea/,
      /\.vscode/,
      /\.(jpg|jpeg|png|gif|svg|ico)$/i
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });
  
  // ファイル追加を検出
  watcher.on('add', async (filePath) => {
    const relativePath = path.relative(watchDir, filePath);
    await detectAndLogFileOperation('作成', filePath, relativePath);
  });
  
  // ファイル変更を検出
  watcher.on('change', async (filePath) => {
    const relativePath = path.relative(watchDir, filePath);
    await detectAndLogFileOperation('編集', filePath, relativePath);
  });
  
  // ファイル削除を検出
  watcher.on('unlink', async (filePath) => {
    const relativePath = path.relative(watchDir, filePath);
    await detectAndLogFileOperation('削除', filePath, relativePath);
  });
  
  activityLog.unshift({
    time: new Date().toLocaleTimeString('ja-JP'),
    instanceId: 'system',
    color: 'cyan',
    message: `📁 ファイルシステム監視を開始: ${watchDir}`
  });
}

// 他のClaudeインスタンスの出力を監視
function startClaudeOutputMonitor() {
  // ファイル監視用のキャッシュ
  const fileTracker = new Map(); // filePath -> { lastMtime, lastPids, lastSeen, accessCount }
  
  // 定期的に各Claudeプロセスが開いているファイルをチェック
  setInterval(async () => {
    // まず、すべてのファイルの現在の状態を記録
    const currentFiles = new Map(); // filePath -> { mtime, pids, isOpen }
    
    for (const [pid, instance] of claudeInstances) {
      try {
        // lsofでプロセスが開いているファイルを確認（REGタイプのみ）
        const { stdout } = await execPromise(`lsof -p ${pid} 2>/dev/null | grep REG | grep -E "\\.(js|ts|tsx|jsx|json|md|css|html|py|sh|yml|yaml|txt|log|xml|env)$"`);
        if (stdout) {
          const lines = stdout.trim().split('\n');
          for (const line of lines) {
            const fileMatch = line.match(/\s+(\/[^\s]+)\s*$/);
            if (fileMatch) {
              const filePath = fileMatch[1];
              
              try {
                const stats = fs.statSync(filePath);
                
                if (!currentFiles.has(filePath)) {
                  currentFiles.set(filePath, { 
                    mtime: stats.mtimeMs, 
                    pids: new Set(),
                    isOpen: true 
                  });
                }
                currentFiles.get(filePath).pids.add(pid);
              } catch {}
            }
          }
        }
      } catch {}
    }
    
    // ファイルの変更と読み込みを検出
    for (const [filePath, fileInfo] of currentFiles) {
      const tracked = fileTracker.get(filePath);
      
      if (!tracked) {
        // 新しくトラッキング開始
        fileTracker.set(filePath, { 
          lastMtime: fileInfo.mtime, 
          lastPids: fileInfo.pids,
          lastSeen: Date.now(),
          accessCount: 1
        });
      } else {
        const now = Date.now();
        
        if (fileInfo.mtime > tracked.lastMtime) {
          // ファイルが変更された
          const timeDiff = now - fileInfo.mtime;
          
          // 設定された時間以内の変更のみ記録
          if (timeDiff < CONFIG.FILE_CHANGE_THRESHOLD_MS) {
            // 最も可能性の高いPIDを特定
            let responsiblePid = null;
            
            // 現在このファイルを開いているPIDの中から選択
            if (fileInfo.pids.size === 1) {
              responsiblePid = [...fileInfo.pids][0];
            } else if (fileInfo.pids.size > 1) {
              // 複数のPIDが開いている場合、最もアクティブなものを選択
              let mostActive = null;
              let mostRecentActivity = 0;
              
              for (const pid of fileInfo.pids) {
                const instance = claudeInstances.get(pid);
                if (instance && instance.lastActivity > mostRecentActivity) {
                  mostActive = pid;
                  mostRecentActivity = instance.lastActivity;
                }
              }
              responsiblePid = mostActive || [...fileInfo.pids][0];
            }
            
            if (responsiblePid) {
              const instance = claudeInstances.get(responsiblePid);
              if (instance) {
                instance.lastActivity = Date.now();
                
                const operation = tracked.lastMtime === 0 ? '作成' : '編集';
                const logEntry = `[${new Date().toISOString()}] [PID:${responsiblePid}] file_operation: ${operation} ${filePath}`;
                
                // アクティビティに追加
                activityLog.unshift({
                  time: new Date().toLocaleTimeString('ja-JP'),
                  instanceId: instance.id,
                  color: instance.color,
                  message: `🔍 ${operation}: ${path.basename(filePath)} (検出)`
                });
                
                // ログファイルに記録
                fs.appendFileSync('/tmp/claude_activity.log', logEntry + '\n');
                processLogLine(logEntry);
              }
            }
          }
          
          // トラッカーを更新
          tracked.lastMtime = fileInfo.mtime;
        } else if (fileInfo.mtime === tracked.lastMtime) {
          // ファイルが変更されていないが開かれている（読み込みの可能性）
          const timeSinceLastSeen = now - tracked.lastSeen;
          
          // 設定された時間以上経過していて、新しくファイルが開かれた場合
          if (timeSinceLastSeen > CONFIG.FILE_READ_THRESHOLD_MS) {
            // 新しいPIDがファイルを開いているか確認
            const newPids = [...fileInfo.pids].filter(pid => !tracked.lastPids.has(pid));
            
            if (newPids.length > 0 || tracked.accessCount === 0) {
              // 読み込み操作として記録
              const responsiblePid = newPids[0] || [...fileInfo.pids][0];
              const instance = claudeInstances.get(responsiblePid);
              
              if (instance) {
                instance.lastActivity = Date.now();
                
                const logEntry = `[${new Date().toISOString()}] [PID:${responsiblePid}] file_operation: 読み込み ${filePath}`;
                
                // アクティビティに追加
                activityLog.unshift({
                  time: new Date().toLocaleTimeString('ja-JP'),
                  instanceId: instance.id,
                  color: instance.color,
                  message: `👁️ 読み込み: ${path.basename(filePath)} (検出)`
                });
                
                // ログファイルに記録
                fs.appendFileSync('/tmp/claude_activity.log', logEntry + '\n');
                processLogLine(logEntry);
                
                tracked.accessCount++;
              }
            }
          }
        }
        
        // トラッカーを更新
        tracked.lastPids = new Set(fileInfo.pids);
        tracked.lastSeen = now;
      }
    }
    
    // 閉じられたファイルの検出（読み込み完了）
    for (const [filePath, tracked] of fileTracker) {
      if (!currentFiles.has(filePath)) {
        const timeSinceLastSeen = Date.now() - tracked.lastSeen;
        
        // 最近まで開かれていたファイルが閉じられた場合
        if (timeSinceLastSeen < CONFIG.FILE_READ_THRESHOLD_MS && tracked.accessCount > 0) {
          // アクセスカウントをリセット
          tracked.accessCount = 0;
        }
      }
    }
    
    // 古いエントリをクリーンアップ（メモリ節約）
    if (fileTracker.size > CONFIG.FILE_TRACKER_CLEANUP_SIZE) {
      const entries = Array.from(fileTracker.entries());
      entries.sort((a, b) => a[1].lastSeen - b[1].lastSeen);
      
      // 古いエントリを半分削除
      const deleteCount = Math.floor(CONFIG.FILE_TRACKER_CLEANUP_SIZE / 2);
      for (let i = 0; i < deleteCount; i++) {
        fileTracker.delete(entries[i][0]);
      }
    }
  }, CONFIG.PROCESS_CHECK_INTERVAL_MS);
}

// ファイル操作を検出してログに記録
async function detectAndLogFileOperation(operation, filePath, relativePath) {
  // 対象ファイルタイプのみ処理
  const ext = path.extname(filePath).toLowerCase();
  
  if (!TARGET_EXTENSIONS.includes(ext)) return;
  
  // アクティブなClaudeプロセスを検出
  const instances = Array.from(claudeInstances.values());
  let activeInstance = instances.find(inst => inst.isActive);
  
  // アクティブなインスタンスがない場合は最新のものを使用
  if (!activeInstance && instances.length > 0) {
    activeInstance = instances.sort((a, b) => b.lastActivity - a.lastActivity)[0];
  }
  
  // ファイルが変更された時、どのインスタンスが操作したか推測
  // 方法1: lsofでファイルを開いているプロセスを確認
  let detectedPid = null;
  try {
    const { stdout } = await execPromise(`lsof "${filePath}" 2>/dev/null | grep -E "(claude|anthropic|node)" | head -1`);
    if (stdout) {
      const pidMatch = stdout.match(/\w+\s+(\d+)/);
      if (pidMatch) {
        detectedPid = pidMatch[1];
        const detectedInstance = claudeInstances.get(detectedPid);
        if (detectedInstance) {
          activeInstance = detectedInstance;
        }
      }
    }
  } catch {}
  
  // lsofで検出できなかった場合、複数のアクティブなインスタンスがある場合はスキップ
  if (!activeInstance) {
    const activeInstances = instances.filter(inst => inst.isActive);
    if (activeInstances.length === 1) {
      activeInstance = activeInstances[0];
    } else if (activeInstances.length > 1) {
      // 複数のアクティブなインスタンスがある場合は特定できないのでスキップ
      return;
    }
  }
  
  const pid = activeInstance ? activeInstance.pid : (detectedPid || 'auto');
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [PID:${pid}] file_operation: ${operation} ${filePath}\n`;
  
  // ログファイルに書き込み
  fs.appendFileSync('/tmp/claude_activity.log', logEntry);
  
  // 内部でも処理（ログファイル監視と同じ処理を実行）
  processLogLine(logEntry.trim());
  
  // アクティビティログに追加
  activityLog.unshift({
    time: new Date().toLocaleTimeString('ja-JP'),
    instanceId: activeInstance ? activeInstance.id : 'auto',
    color: activeInstance ? activeInstance.color : 'white',
    message: `${OPERATION_EMOJIS[operation] || '📄'} ${operation}: ${relativePath}`
  });
}

// 初期化
async function init() {
  // 初期メッセージ
  activityLog.push({
    time: new Date().toLocaleTimeString('ja-JP'),
    instanceId: 'system',
    color: 'green',
    message: '🚀 マルチインスタンスモニタリングを開始しました'
  });
  
  // 重要: 最初にClaudeプロセスを検出してから、ログファイルを読み込む
  await findClaudeProcesses();
  
  // ログファイル監視を開始（既存のログも処理）
  watchLogFile();
  
  // ファイルシステム監視を開始
  startFileSystemWatcher();
  
  // 他のClaudeインスタンスの出力を監視
  startClaudeOutputMonitor();
  
  // デモ用：複数のダミーインスタンスを生成（開発/テスト用）
  if (process.env.DEMO_MODE === 'true') {
    claudeInstances.set('demo1', new ClaudeInstance('12345', 'claude --workdir /project1', 'ttys001'));
    claudeInstances.set('demo2', new ClaudeInstance('67890', 'claude --workdir /project2', 'ttys002'));
    claudeInstances.get('demo1').cpu = 15.5;
    claudeInstances.get('demo1').memory = 8.2;
    claudeInstances.get('demo2').cpu = 23.1;
    claudeInstances.get('demo2').memory = 12.5;
  }
  
  // 定期的に更新
  setInterval(async () => {
    await findClaudeProcesses();
    
    updateHeader();
    updateOverviewPanel();
    updateInstancesPanel();
    updateActivityStream();
    updateInstanceHistoryPanels();
    
    screen.render();
  }, CONFIG.UPDATE_INTERVAL_MS);
  
  // 初回描画
  await findClaudeProcesses();
  updateHeader();
  updateOverviewPanel();
  updateInstancesPanel();
  updateActivityStream();
  updateInstanceHistoryPanels();
  
  screen.render();
}

// キーバインド
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

// インスタンスパネルのスクロール用キーバインド
instancesPanel.key(['up', 'k'], function() {
  instancesPanel.scroll(-1);
  screen.render();
});

instancesPanel.key(['down', 'j'], function() {
  instancesPanel.scroll(1);
  screen.render();
});

instancesPanel.key(['pageup'], function() {
  instancesPanel.scroll(-instancesPanel.height);
  screen.render();
});

instancesPanel.key(['pagedown'], function() {
  instancesPanel.scroll(instancesPanel.height);
  screen.render();
});

// アクティビティストリームのスクロール用キーバインド
activityStream.key(['up', 'k'], function() {
  activityStream.scroll(-1);
  screen.render();
});

activityStream.key(['down', 'j'], function() {
  activityStream.scroll(1);
  screen.render();
});

activityStream.key(['pageup'], function() {
  activityStream.scroll(-activityStream.height);
  screen.render();
});

activityStream.key(['pagedown'], function() {
  activityStream.scroll(activityStream.height);
  screen.render();
});

// File Operations Matrixのキーバインドは削除

// コンテナ（全体）のスクロール用キーバインド
container.key(['S-up', 'S-k'], function() {
  container.scroll(-1);
  screen.render();
});

container.key(['S-down', 'S-j'], function() {
  container.scroll(1);
  screen.render();
});

container.key(['S-pageup'], function() {
  container.scroll(-container.height);
  screen.render();
});

container.key(['S-pagedown'], function() {
  container.scroll(container.height);
  screen.render();
});

// タブキーでパネル間を切り替え
let focusedPanel = 0;
const panels = [container, instancesPanel, activityStream];

screen.key(['tab'], function() {
  if (focusedPanel < panels.length) {
    panels[focusedPanel].style.border = { fg: colors.border };
  }
  focusedPanel = (focusedPanel + 1) % panels.length;
  if (focusedPanel < panels.length) {
    panels[focusedPanel].style.border = { fg: colors.active };
    panels[focusedPanel].focus();
  }
  screen.render();
});

// 初期フォーカスを設定（コンテナから開始）
container.focus();
container.style.border = { fg: colors.active };

// インスタンス識別子をログに追加するヘルパー関数をエクスポート
if (process.env.CLAUDE_INSTANCE_PID) {
  // 環境変数からPIDを取得してログに含める
  const originalLog = console.log;
  console.log = function(...args) {
    const message = args.join(' ');
    originalLog(`[PID:${process.env.CLAUDE_INSTANCE_PID}] ${message}`);
  };
}

// 開始
init();

// エラーハンドリング
process.on('uncaughtException', (err) => {
  console.error('エラー:', err);
  process.exit(1);
});