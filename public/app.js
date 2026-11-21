/* ═══════════════════════════════════════════════════════
   CYBERSHIELD – Complete Application Logic
   Data Structures: Linked List, Hash Table, Queue, BST, Stack
═══════════════════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════════════════
// DATA STRUCTURE IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════

/* ── Node for Linked List ── */
class LLNode {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}

/* ── Linked List – stores all log entries ── */
class LinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }
  append(data) {
    const node = new LLNode(data);
    if (!this.head) { this.head = node; }
    else {
      let cur = this.head;
      while (cur.next) cur = cur.next;
      cur.next = node;
    }
    this.size++;
    return node;
  }
  deleteById(id) {
    if (!this.head) return false;
    if (this.head.data.id === id) { this.head = this.head.next; this.size--; return true; }
    let cur = this.head;
    while (cur.next) {
      if (cur.next.data.id === id) { cur.next = cur.next.next; this.size--; return true; }
      cur = cur.next;
    }
    return false;
  }
  toArray() {
    const arr = [];
    let cur = this.head;
    while (cur) { arr.push(cur.data); cur = cur.next; }
    return arr;
  }
  searchByIP(ip) {
    const res = [];
    let cur = this.head;
    while (cur) {
      if (cur.data.ip === ip) res.push(cur.data);
      cur = cur.next;
    }
    return res;
  }
  clear() { this.head = null; this.size = 0; }
}

/* ── Queue – processes logs FIFO ── */
class Queue {
  constructor() { this.items = []; }
  enqueue(item) { this.items.push(item); }
  dequeue()     { return this.items.shift(); }
  peek()        { return this.items[0]; }
  isEmpty()     { return this.items.length === 0; }
  size()        { return this.items.length; }
  toArray()     { return [...this.items]; }
  clear()       { this.items = []; }
}

/* ── Stack – recently processed events LIFO ── */
class Stack {
  constructor(limit = 10) { this.items = []; this.limit = limit; }
  push(item) {
    this.items.unshift(item);
    if (this.items.length > this.limit) this.items.pop();
  }
  pop()     { return this.items.shift(); }
  peek()    { return this.items[0]; }
  isEmpty() { return this.items.length === 0; }
  toArray() { return [...this.items]; }
  clear()   { this.items = []; }
}

/* ── Hash Table – counts per IP ── */
class HashTable {
  constructor(size = 64) {
    this.size = size;
    this.table = new Array(size).fill(null).map(() => []);
  }
  _hash(key) {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % this.size;
    return h;
  }
  set(key, value) {
    const idx = this._hash(key);
    const bucket = this.table[idx];
    const existing = bucket.find(pair => pair[0] === key);
    if (existing) existing[1] = value;
    else bucket.push([key, value]);
  }
  get(key) {
    const idx = this._hash(key);
    const pair = this.table[idx].find(p => p[0] === key);
    return pair ? pair[1] : null;
  }
  has(key) { return this.get(key) !== null; }
  entries() {
    const res = [];
    for (const bucket of this.table) for (const pair of bucket) res.push(pair);
    return res;
  }
  clear() { this.table = new Array(this.size).fill(null).map(() => []); }
}

/* ── Binary Search Tree – IP address index ── */
class BSTNode {
  constructor(key, data) {
    this.key  = key;   // IP as comparable string
    this.data = data;  // array of log entries for this IP
    this.left  = null;
    this.right = null;
    this.flagged = false;
  }
}

class BST {
  constructor() { this.root = null; }
  _compare(a, b) {
    // Compare IPs numerically
    const toNum = s => s.split('.').map(Number);
    const aN = toNum(a), bN = toNum(b);
    for (let i = 0; i < 4; i++) {
      if (aN[i] < bN[i]) return -1;
      if (aN[i] > bN[i]) return  1;
    }
    return 0;
  }
  insert(ip, logEntry) {
    const node = this._insertRec(this.root, ip, logEntry);
    if (!this.root) this.root = node;
    return node;
  }
  _insertRec(node, ip, logEntry) {
    if (!node) return new BSTNode(ip, [logEntry]);
    const cmp = this._compare(ip, node.key);
    if (cmp === 0) { node.data.push(logEntry); return node; }
    else if (cmp < 0) node.left  = this._insertRec(node.left,  ip, logEntry);
    else              node.right = this._insertRec(node.right, ip, logEntry);
    return node;
  }
  search(ip) {
    let cur = this.root;
    while (cur) {
      const cmp = this._compare(ip, cur.key);
      if (cmp === 0) return cur;
      cur = cmp < 0 ? cur.left : cur.right;
    }
    return null;
  }
  inorder() {
    const result = [];
    const traverse = node => {
      if (!node) return;
      traverse(node.left);
      result.push(node);
      traverse(node.right);
    };
    traverse(this.root);
    return result;
  }
  clear() { this.root = null; }
}

// ═══════════════════════════════════════════════════════
// APPLICATION STATE
// ═══════════════════════════════════════════════════════
let idCounter = 1;
const logList  = new LinkedList();
const logQueue = new Queue();
const logStack = new Stack(8);
const ipHash   = new HashTable();
const ipBST    = new BST();

let activeFilter = 'all';
let searchQuery  = '';
let chartInstance    = null;
let donutInstance    = null;
let globeAnimId      = null;
let detectionThreshold = 3;
let freqThreshold      = 5;

// ═══════════════════════════════════════════════════════
// SAMPLE DATA
// ═══════════════════════════════════════════════════════
const SAMPLE_LOGS = [
  { ip:'192.168.1.10', username:'user1',  status:'Failed',  time:'2026-11-20T08:12:00' },
  { ip:'192.168.1.15', username:'user2',  status:'Success', time:'2026-11-20T08:13:22' },
  { ip:'192.168.1.10', username:'user1',  status:'Failed',  time:'2026-11-20T08:14:05' },
  { ip:'192.168.1.20', username:'user3',  status:'Success', time:'2026-11-20T08:15:30' },
  { ip:'192.168.1.10', username:'user1',  status:'Failed',  time:'2026-11-20T08:16:11' },
  { ip:'10.0.0.5',     username:'admin',  status:'Failed',  time:'2026-11-20T09:01:00' },
  { ip:'10.0.0.5',     username:'admin',  status:'Failed',  time:'2026-11-20T09:01:45' },
  { ip:'10.0.0.5',     username:'admin',  status:'Failed',  time:'2026-11-20T09:02:30' },
  { ip:'10.0.0.5',     username:'admin',  status:'Failed',  time:'2026-11-20T09:03:15' },
  { ip:'172.16.0.1',   username:'sysop',  status:'Success', time:'2026-11-20T09:30:00' },
  { ip:'172.16.0.1',   username:'sysop',  status:'Success', time:'2026-11-20T09:45:00' },
  { ip:'192.168.2.50', username:'guest',  status:'Failed',  time:'2026-11-20T10:00:01' },
  { ip:'192.168.2.50', username:'guest',  status:'Failed',  time:'2026-11-20T10:00:02' },
  { ip:'192.168.2.50', username:'guest',  status:'Failed',  time:'2026-11-20T10:00:03' },
  { ip:'192.168.2.50', username:'root',   status:'Failed',  time:'2026-11-20T10:00:04' },
  { ip:'192.168.2.50', username:'root',   status:'Success', time:'2026-11-20T10:00:50' },
  { ip:'203.0.113.42', username:'scanner',status:'Failed',  time:'2026-11-20T10:30:00' },
  { ip:'203.0.113.42', username:'scanner',status:'Failed',  time:'2026-11-20T10:30:01' },
  { ip:'192.168.1.1',  username:'router', status:'Success', time:'2026-11-20T11:00:00' },
  { ip:'10.10.10.10',  username:'testuser',status:'Success',time:'2026-11-20T11:15:00' },
];

// ═══════════════════════════════════════════════════════
// CORE LOG FUNCTIONS
// ═══════════════════════════════════════════════════════
function addLog(ip, username, status, time, backendId = null, refresh = true) {
  const id = backendId !== null ? Number(backendId) : idCounter++;
  idCounter = Math.max(idCounter, id + 1);

  const entry = {
    id,
    ip,
    username,
    status,
    time,
    addedAt: Date.now()
  };

  logList.append(entry);
  logQueue.enqueue(entry);

  const existing = ipHash.get(ip);

  if (existing) {
    existing.total++;
    if (status === 'Success') existing.success++;
    else existing.failed++;
  } else {
    ipHash.set(ip, {
      ip,
      total: 1,
      success: status === 'Success' ? 1 : 0,
      failed: status === 'Failed' ? 1 : 0
    });
  }

  ipBST.insert(ip, entry);
  logStack.push(entry);
  logQueue.dequeue();

  if (refresh) updateAllViews();

  return entry;
}

async function deleteLog(id) {
  try {
    const response = await fetch(`/api/logs/${id}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Could not delete log.');
    }

    await loadLogsFromAPI(false);
    showToast('Log entry deleted.', 'success');

  } catch (error) {
    console.error(error);
    showToast(error.message || 'Delete failed.', 'error');
  }
}
function clearAllLogs() {
  showToast(
    'Clear All is unavailable: the backend has no clear-all route.',
    'warning'
  );
}

function rebuildDS() {
  ipHash.clear();
  ipBST.clear();
  const all = logList.toArray();
  for (const e of all) {
    const ex = ipHash.get(e.ip);
    if (ex) {
      ex.total++;
      if (e.status === 'Success') ex.success++;
      else ex.failed++;
    } else {
      ipHash.set(e.ip, {
        ip: e.ip, total: 1,
        success: e.status === 'Success' ? 1 : 0,
        failed:  e.status === 'Failed'  ? 1 : 0,
      });
    }
    ipBST.insert(e.ip, e);
  }
}
async function loadLogsFromAPI(showMessage = true) {
  try {
    const response = await fetch('/api/logs');

    if (!response.ok) {
      throw new Error('Could not load backend logs.');
    }

    const logs = await response.json();

    logList.clear();
    logQueue.clear();
    logStack.clear();
    ipHash.clear();
    ipBST.clear();

    idCounter = 1;

    logs.forEach(log => {
      addLog(
        log.ip,
        log.user,
        log.status,
        log.time,
        Number(log.id),
        false
      );
    });

    updateAllViews();

    if (showMessage) {
      showToast(`${logs.length} backend logs loaded!`, 'success');
    }

  } catch (error) {
    console.error(error);
    showToast('Could not connect to backend.', 'error');
  }
}


// ═══════════════════════════════════════════════════════
// VIEW UPDATE FUNCTIONS
// ═══════════════════════════════════════════════════════
function updateAllViews() {
  updateKPIs();
  updateLogTable();
  updateLiveFeed();
  updateQueueViz();
  updateStackViz();
  updateHeatmap();
  renderBarChart();
  renderGlobe();
}

function updateKPIs() {
  const logs = logList.toArray();
  const total = logs.length;
  const success = logs.filter(l => l.status === 'Success').length;
  const failed  = logs.filter(l => l.status === 'Failed').length;

  // Detect threats
  const entries = ipHash.entries();
  let threats = 0;
  for (const [, v] of entries) {
    if (v.failed >= detectionThreshold) threats++;
  }

  animateNum('kpi-total-val', total);
  animateNum('kpi-success-val', success);
  animateNum('kpi-failed-val', failed);
  animateNum('kpi-threats-val', threats);

  // Top IP
  const sorted = entries.sort((a,b) => b[1].total - a[1].total);
  const topIP = sorted.length ? sorted[0][1].ip : '—';
  const uniqueIPs = entries.length;
  document.getElementById('top-ip-display').textContent = topIP;
  document.getElementById('unique-ip-display').textContent = uniqueIPs;
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const dur = 600;
  const startTime = performance.now();
  const step = (now) => {
    const t = Math.min((now - startTime) / dur, 1);
    el.textContent = Math.round(start + (target - start) * easeOut(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function updateLogTable() {
  const tbody = document.getElementById('log-tbody');
  let logs = logList.toArray();

  if (searchQuery) {
    // BST search
    const bstResult = ipBST.search(searchQuery);
    if (bstResult) logs = bstResult.data;
    else logs = logs.filter(l => l.ip.includes(searchQuery) || l.username.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  if (activeFilter !== 'all') {
    logs = logs.filter(l => l.status === activeFilter);
  }

  document.getElementById('log-count-badge').textContent = `${logList.size} entries`;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">
      <div class="table-empty">
        <div class="table-empty-icon">🔐</div>
        <div>No logs match your criteria.</div>
      </div></td></tr>`;
    return;
  }

  const ipData = {};
  for (const [k, v] of ipHash.entries()) ipData[k] = v;

  tbody.innerHTML = logs.map((log, idx) => {
    const ipInfo = ipData[log.ip] || { failed: 0, total: 0 };
    const failedCount = ipInfo.failed || 0;
    let risk = 'LOW', riskClass = 'risk-low';
    if (failedCount >= detectionThreshold && failedCount < detectionThreshold + 2) { risk = 'MEDIUM'; riskClass = 'risk-medium'; }
    if (failedCount >= detectionThreshold + 2) { risk = 'HIGH'; riskClass = 'risk-high'; }
    const isSuspicious = failedCount >= detectionThreshold;
    const statusClass = log.status === 'Success' ? 'success' : 'failed';
    const timeStr = log.time ? new Date(log.time).toLocaleString('en-IN', {dateStyle:'short',timeStyle:'short'}) : '—';

    return `<tr class="${isSuspicious ? 'suspicious-row' : ''}">
      <td style="color:var(--text-muted)">${idx + 1}</td>
      <td style="color:var(--cyan);font-weight:600">${escHtml(log.ip)}</td>
      <td>${escHtml(log.username)}</td>
      <td style="color:var(--text-secondary)">${timeStr}</td>
      <td><span class="status-pill ${statusClass}">${log.status === 'Success' ? '✓' : '✗'} ${log.status}</span></td>
      <td style="text-align:center">${ipInfo.total || 1}</td>
      <td><span class="risk-pill ${riskClass}">${risk}</span></td>
      <td><button class="btn-icon" onclick="deleteLog(${log.id})" title="Delete">🗑</button></td>
    </tr>`;
  }).join('');
}

function updateLiveFeed() {
  const feed = document.getElementById('live-feed');
  const stack = logStack.toArray();

  if (stack.length === 0) {
    feed.innerHTML = `<div class="feed-empty"><div class="feed-empty-icon">📡</div><div>Awaiting log entries...</div></div>`;
    return;
  }

  feed.innerHTML = stack.map(log => {
    const statusClass = log.status === 'Success' ? 'success' : 'failed';
    const timeStr = new Date(log.time || log.addedAt).toLocaleTimeString('en-IN');
    return `<div class="feed-item">
      <div class="feed-dot ${statusClass}"></div>
      <span class="feed-ip">${escHtml(log.ip)}</span>
      <span class="feed-user">${escHtml(log.username)}</span>
      <span class="feed-status-text ${statusClass}">${log.status}</span>
      <span class="feed-time">${timeStr}</span>
    </div>`;
  }).join('');
}

function updateQueueViz() {
  const container = document.getElementById('queue-items');
  // Show last 6 items from log list as "recently queued"
  const logs = logList.toArray().slice(-6);
  if (logs.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted);font-size:12px;font-family:var(--font-mono)">Queue empty</span>';
    return;
  }
  container.innerHTML = logs.map(l => `<div class="queue-cell">${escHtml(l.ip)}</div>`).join('');
}

function updateStackViz() {
  const container = document.getElementById('stack-viz');
  const stack = logStack.toArray();
  if (stack.length === 0) {
    container.innerHTML = `<div class="feed-empty"><div class="feed-empty-icon">📦</div><div>Stack is empty. Add logs to populate.</div></div>`;
    return;
  }
  container.innerHTML = stack.map(log => {
    const statusClass = log.status === 'Success' ? 'success' : 'failed';
    return `<div class="stack-item">
      <span class="feed-ip">${escHtml(log.ip)}</span>
      <span class="feed-user">${escHtml(log.username)}</span>
      <span class="feed-status-text ${statusClass}" style="font-family:var(--font-mono);font-size:11px">${log.status}</span>
    </div>`;
  }).join('');
}

function updateHeatmap() {
  const container = document.getElementById('ip-heatmap');
  const entries = ipHash.entries();

  if (entries.length === 0) {
    container.innerHTML = `<div class="feed-empty"><div class="feed-empty-icon">🗺️</div><div>No IP data yet...</div></div>`;
    return;
  }

  const max = Math.max(...entries.map(([,v]) => v.total));
  const sorted = [...entries].sort((a,b) => b[1].total - a[1].total);

  const html = `<div class="heatmap-grid">${sorted.map(([,v]) => {
    const ratio = v.total / max;
    const failRatio = v.failed / (v.total || 1);
    let bg, border;
    if (failRatio > 0.6) {
      const alpha = 0.1 + ratio * 0.5;
      bg = `rgba(255,59,92,${alpha})`;
      border = 'rgba(255,59,92,0.5)';
    } else if (failRatio > 0.3) {
      const alpha = 0.1 + ratio * 0.4;
      bg = `rgba(255,140,0,${alpha})`;
      border = 'rgba(255,140,0,0.4)';
    } else {
      const alpha = 0.1 + ratio * 0.4;
      bg = `rgba(0,245,255,${alpha})`;
      border = 'rgba(0,245,255,0.3)';
    }
    return `<div class="heatmap-cell" style="background:${bg};border-color:${border}" title="${v.ip}: ${v.total} attempts (${v.failed} failed)">
      ${v.ip} <strong>${v.total}</strong>
    </div>`;
  }).join('')}</div>`;

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
// ANALYSIS MODULE
// ═══════════════════════════════════════════════════════
function runAnalysis() {
  const logs = logList.toArray();
  const total   = logs.length;
  const success = logs.filter(l => l.status === 'Success').length;
  const failed  = logs.filter(l => l.status === 'Failed').length;
  const unique  = ipHash.entries().length;

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-success').textContent = success;
  document.getElementById('stat-failed').textContent  = failed;
  document.getElementById('stat-unique').textContent  = unique;

  const pct = total ? Math.round((success/total)*100) : 0;
  document.getElementById('donut-pct').textContent = pct + '%';

  setTimeout(() => {
    document.getElementById('bar-success').style.width = total ? (success/total*100)+'%' : '0%';
    document.getElementById('bar-failed').style.width  = total ? (failed/total*100)+'%'  : '0%';
    document.getElementById('bar-unique').style.width  = total ? Math.min(unique/total*100,100)+'%' : '0%';
  }, 50);

  renderDonut(success, failed);
  renderFreqTable();
  renderBST();

  showToast('Analysis complete!', 'success');
}

function renderFreqTable() {
  const tbody = document.getElementById('freq-tbody');
  const entries = ipHash.entries();

  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No data available.</td></tr>';
    return;
  }

  const sorted = [...entries].sort((a,b) => b[1].total - a[1].total);
  const maxTotal = sorted[0][1].total;

  tbody.innerHTML = sorted.map(([,v], i) => {
    const rank = i + 1;
    const rClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-n';
    const score = Math.round((v.failed / (v.total||1)) * 100);
    const scoreColor = score > 60 ? 'var(--red)' : score > 30 ? 'var(--orange)' : 'var(--green)';
    const fillW = Math.round(v.total / maxTotal * 100);

    return `<tr>
      <td><span class="rank-badge ${rClass}">${rank}</span></td>
      <td style="color:var(--cyan);font-family:var(--font-mono)">${escHtml(v.ip)}</td>
      <td style="font-weight:600">${v.total}</td>
      <td style="color:var(--green)">${v.success}</td>
      <td style="color:var(--red)">${v.failed}</td>
      <td>
        <div class="threat-score-bar">
          <div class="threat-mini-bar"><div class="threat-fill" style="width:${score}%;background:${scoreColor}"></div></div>
          <span style="color:${scoreColor};font-family:var(--font-hud);font-size:11px">${score}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// THREAT DETECTION
// ═══════════════════════════════════════════════════════
function runDetection() {
  const container = document.getElementById('alerts-container');
  const badgeEl   = document.getElementById('alert-count-badge');
  const entries   = ipHash.entries();
  const logs      = logList.toArray();
  const alerts    = [];

  for (const [, v] of entries) {
    // Rule 1: Repeated failed logins
    if (v.failed >= detectionThreshold) {
      alerts.push({
        type: 'critical',
        icon: '🚨',
        title: `BRUTE FORCE PATTERN – ${v.ip}`,
        desc: `${v.failed} failed login attempts detected from this IP. Threshold: ${detectionThreshold}`,
        meta: `IP: ${v.ip} | Failed: ${v.failed}/${v.total} | Risk: HIGH`,
        time: new Date().toLocaleTimeString('en-IN'),
      });
      // Flag in BST
      const node = ipBST.search(v.ip);
      if (node) node.flagged = true;
    }
    // Rule 2: High frequency
    if (v.total >= freqThreshold && v.failed < detectionThreshold) {
      alerts.push({
        type: 'warning',
        icon: '⚠️',
        title: `HIGH FREQUENCY ACCESS – ${v.ip}`,
        desc: `${v.total} total login events from this IP within the monitoring window.`,
        meta: `IP: ${v.ip} | Total: ${v.total} | Risk: MEDIUM`,
        time: new Date().toLocaleTimeString('en-IN'),
      });
    }
    // Rule 3: 100% fail rate with multiple attempts
    if (v.total > 1 && v.failed === v.total && v.total < detectionThreshold) {
      alerts.push({
        type: 'info',
        icon: '🔎',
        title: `SUSPICIOUS FAIL RATE – ${v.ip}`,
        desc: `All ${v.total} login attempts from this IP failed. Possible credential testing.`,
        meta: `IP: ${v.ip} | Failed: ${v.failed}/${v.total}`,
        time: new Date().toLocaleTimeString('en-IN'),
      });
    }
  }

  // Check for rapid successive attempts (timestamp-based)
  const ipTimestamps = {};
  for (const log of logs) {
    if (!ipTimestamps[log.ip]) ipTimestamps[log.ip] = [];
    ipTimestamps[log.ip].push(new Date(log.time || log.addedAt).getTime());
  }
  for (const [ip, times] of Object.entries(ipTimestamps)) {
    const sorted = times.sort((a,b)=>a-b);
    if (sorted.length >= 3) {
      const diff = sorted[sorted.length-1] - sorted[0];
      if (diff < 60000 && sorted.length >= 3) { // 3+ attempts in 1 minute
        const existing = alerts.find(a => a.title.includes(ip) && a.type === 'critical');
        if (!existing) {
          alerts.push({
            type: 'critical',
            icon: '⚡',
            title: `RAPID ATTACK DETECTED – ${ip}`,
            desc: `${sorted.length} login attempts within ${Math.round(diff/1000)} seconds. Possible automated attack.`,
            meta: `IP: ${ip} | Speed: ${(sorted.length / (diff/1000)).toFixed(1)} req/sec`,
            time: new Date().toLocaleTimeString('en-IN'),
          });
        }
      }
    }
  }

  badgeEl.textContent = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;
  animateNum('kpi-threats-val', alerts.filter(a=>a.type==='critical').length);

  if (alerts.length === 0) {
    container.innerHTML = `<div class="feed-empty"><div class="feed-empty-icon">✅</div><div>No threats detected with current thresholds.</div></div>`;
    return;
  }

  container.innerHTML = alerts.map(a => `
    <div class="alert-item alert-${a.type}">
      <div class="alert-icon">${a.icon}</div>
      <div class="alert-content">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
        <div class="alert-meta">${a.meta}</div>
      </div>
      <div class="alert-time">${a.time}</div>
    </div>
  `).join('');

  renderBST();
  showToast(`${alerts.length} alert(s) generated!`, alerts.some(a=>a.type==='critical') ? 'error' : 'warning');
}

// ═══════════════════════════════════════════════════════
// REPORT GENERATION
// ═══════════════════════════════════════════════════════
function generateReport() {
  const logs = logList.toArray();
  const total   = logs.length;
  const success = logs.filter(l => l.status === 'Success').length;
  const failed  = logs.filter(l => l.status === 'Failed').length;
  const unique  = ipHash.entries().length;
  const successRate = total ? Math.round(success/total*100) : 0;
  const entries = ipHash.entries().sort((a,b) => b[1].total - a[1].total);
  const maxTotal = entries.length ? entries[0][1].total : 1;

  let threats = 0;
  for (const [,v] of entries) if (v.failed >= detectionThreshold) threats++;

  const now = new Date().toLocaleString('en-IN', {dateStyle:'full', timeStyle:'medium'});

  const reportHtml = `
    <div class="report-container">
      <div class="report-card">
        <div class="report-card-header">
          <span>🛡️</span>
          <h3>CYBERSHIELD SECURITY REPORT</h3>
          <span style="margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">Generated: ${now}</span>
        </div>
        <div class="report-card-body">
          <div class="report-meta-grid">
            <div class="report-meta-item">
              <div class="report-meta-label">Total Events</div>
              <div class="report-meta-val" style="color:var(--cyan)">${total}</div>
            </div>
            <div class="report-meta-item">
              <div class="report-meta-label">Successful Logins</div>
              <div class="report-meta-val" style="color:var(--green)">${success}</div>
            </div>
            <div class="report-meta-item">
              <div class="report-meta-label">Failed Attempts</div>
              <div class="report-meta-val" style="color:var(--red)">${failed}</div>
            </div>
            <div class="report-meta-item">
              <div class="report-meta-label">Unique IPs</div>
              <div class="report-meta-val" style="color:var(--purple)">${unique}</div>
            </div>
            <div class="report-meta-item">
              <div class="report-meta-label">Success Rate</div>
              <div class="report-meta-val" style="color:${successRate >= 70 ? 'var(--green)' : 'var(--orange)'}">${successRate}%</div>
            </div>
            <div class="report-meta-item">
              <div class="report-meta-label">Threats Detected</div>
              <div class="report-meta-val" style="color:${threats > 0 ? 'var(--red)' : 'var(--green)'}">${threats}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="report-card">
        <div class="report-card-header">
          <span>🏆</span>
          <h3>TOP ACTIVE IP ADDRESSES (Ranked by Hash Table)</h3>
        </div>
        <div class="report-card-body">
          <div class="report-ip-list">
            ${entries.slice(0,10).map(([,v], i) => {
              const failRatio = v.failed / (v.total||1);
              const color = failRatio > 0.6 ? 'var(--red)' : failRatio > 0.3 ? 'var(--orange)' : 'var(--green)';
              const fillW = Math.round(v.total / maxTotal * 100);
              return `<div class="report-ip-row">
                <span style="color:var(--text-muted);font-size:11px;min-width:24px">${i+1}.</span>
                <span class="report-ip-addr">${v.ip}</span>
                <div class="report-bar-track">
                  <div class="report-bar-fill" style="width:${fillW}%;background:${color}"></div>
                </div>
                <span class="report-ip-count">${v.total} (${v.failed}F/${v.success}S)</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      ${threats > 0 ? `
      <div class="report-card">
        <div class="report-card-header">
          <span>🚨</span>
          <h3>SUSPICIOUS EVENTS (Auto-Detected)</h3>
        </div>
        <div class="report-card-body">
          ${entries.filter(([,v]) => v.failed >= detectionThreshold).map(([,v]) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="font-family:var(--font-hud);font-size:12px;color:var(--red);margin-bottom:4px">
                ⚠ ${v.ip} – ${v.failed} failed login attempts
              </div>
              <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)">
                Total: ${v.total} | Success: ${v.success} | Failed: ${v.failed} | Fail Rate: ${Math.round(v.failed/v.total*100)}%
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      <div class="report-card">
        <div class="report-card-header"><span>ℹ️</span><h3>DATA STRUCTURES USED</h3></div>
        <div class="report-card-body">
          <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:var(--font-mono)">
            <thead><tr>
              <th style="text-align:left;padding:8px 12px;color:var(--text-secondary);border-bottom:1px solid var(--border)">Data Structure</th>
              <th style="text-align:left;padding:8px 12px;color:var(--text-secondary);border-bottom:1px solid var(--border)">Application</th>
              <th style="text-align:right;padding:8px 12px;color:var(--text-secondary);border-bottom:1px solid var(--border)">Size</th>
            </tr></thead>
            <tbody>
              <tr><td style="padding:8px 12px;color:var(--cyan)">Linked List</td><td style="padding:8px 12px;color:var(--text-secondary)">Dynamic log record storage</td><td style="padding:8px 12px;text-align:right">${logList.size} nodes</td></tr>
              <tr><td style="padding:8px 12px;color:var(--cyan)">Hash Table</td><td style="padding:8px 12px;color:var(--text-secondary)">IP frequency counting (O(1))</td><td style="padding:8px 12px;text-align:right">${unique} buckets</td></tr>
              <tr><td style="padding:8px 12px;color:var(--cyan)">Queue (FIFO)</td><td style="padding:8px 12px;color:var(--text-secondary)">In-order log processing</td><td style="padding:8px 12px;text-align:right">64 capacity</td></tr>
              <tr><td style="padding:8px 12px;color:var(--cyan)">Binary Search Tree</td><td style="padding:8px 12px;color:var(--text-secondary)">IP-indexed searching (O(log n))</td><td style="padding:8px 12px;text-align:right">${unique} nodes</td></tr>
              <tr><td style="padding:8px 12px;color:var(--cyan)">Stack (LIFO)</td><td style="padding:8px 12px;color:var(--text-secondary)">Recent event review</td><td style="padding:8px 12px;text-align:right">${logStack.toArray().length}/8 items</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="disclaimer">
        ⚠ DISCLAIMER: This report is generated from simulated security logs. These patterns are suspicious indicators requiring further investigation — not confirmed cyberattacks. Always consult a qualified security professional before taking action.
      </div>
      <div class="report-timestamp">Report generated by CYBERSHIELD v2.0 • ${now}</div>
    </div>`;

  document.getElementById('report-output').innerHTML = reportHtml;
  showToast('Security report generated!', 'success');
}

// ═══════════════════════════════════════════════════════
// CANVAS VISUALIZATIONS
// ═══════════════════════════════════════════════════════

/* ── Particle Background ── */
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r  = Math.random() * 1.5 + 0.3;
      this.alpha = Math.random() * 0.4 + 0.1;
      this.color = Math.random() < 0.7 ? '#00f5ff' : '#7c3aed';
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0||this.x > W||this.y < 0||this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = this.alpha;
      ctx.fill();
    }
  }

  particles = Array.from({length:120}, ()=> new Particle());

  function drawConnections() {
    ctx.globalAlpha = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i+1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx*dx+dy*dy);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,245,255,${0.06*(1-d/100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }
  window.addEventListener('resize', resize);
  animate();
}

/* ── Globe ── */
function renderGlobe() {
  const canvas = document.getElementById('globe-canvas');
  if (!canvas) return;
  const size = Math.min(260, canvas.parentElement.clientWidth - 40);
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size/2, cy = size/2, r = size/2 - 8;
  let angle = 0;

  if (globeAnimId) cancelAnimationFrame(globeAnimId);

  const logs = logList.toArray();
  const ipEntries = ipHash.entries();
  const hasData = ipEntries.length > 0;

  function drawGlobe(a) {
    ctx.clearRect(0,0,size,size);

    // Outer glow
    const outerGlow = ctx.createRadialGradient(cx,cy,r*0.7,cx,cy,r+10);
    outerGlow.addColorStop(0,'transparent');
    outerGlow.addColorStop(1,'rgba(0,245,255,0.08)');
    ctx.beginPath(); ctx.arc(cx,cy,r+6,0,Math.PI*2);
    ctx.fillStyle = outerGlow; ctx.fill();

    // Globe sphere
    const grad = ctx.createRadialGradient(cx-r*0.3,cy-r*0.3,0,cx,cy,r);
    grad.addColorStop(0,'rgba(10,22,50,0.9)');
    grad.addColorStop(0.6,'rgba(6,15,35,0.95)');
    grad.addColorStop(1,'rgba(2,8,20,1)');
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle = grad; ctx.fill();

    // Grid lines (latitude)
    ctx.strokeStyle = 'rgba(0,245,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let lat = -60; lat <= 60; lat += 20) {
      const yr = r * Math.sin(lat * Math.PI/180);
      const xr = r * Math.cos(lat * Math.PI/180);
      ctx.beginPath(); ctx.ellipse(cx, cy + yr, xr, xr*0.3, 0, 0, Math.PI*2);
      ctx.stroke();
    }

    // Grid lines (longitude)
    for (let lon = 0; lon < 180; lon += 20) {
      const lRad = (lon + a) * Math.PI/180;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * Math.abs(Math.cos(lRad)), r, lRad, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(0,245,255,${Math.abs(Math.cos(lRad))*0.08})`;
      ctx.stroke();
    }

    // Data points
    if (hasData) {
      const topEntries = [...ipEntries].sort((x,y)=>y[1].total-x[1].total).slice(0,8);
      topEntries.forEach(([,v], i) => {
        const phi   = ((i * 137.5) % 360) * Math.PI / 180;
        const theta = ((i * 73.1 + a * 2) % 360) * Math.PI / 180;
        const px = cx + r * 0.85 * Math.sin(phi) * Math.cos(theta);
        const py = cy + r * 0.6  * Math.cos(phi);
        const isSusp = v.failed >= detectionThreshold;
        const col  = isSusp ? '#ff3b5c' : '#00f5ff';
        const size2 = Math.min(2 + v.total * 0.8, 7);

        // Pulse ring
        const pulse = (Math.sin(Date.now()/600 + i) + 1)/2;
        ctx.beginPath();
        ctx.arc(px, py, size2 + pulse*5, 0, Math.PI*2);
        ctx.strokeStyle = isSusp ? `rgba(255,59,92,${0.3*pulse})` : `rgba(0,245,255,${0.2*pulse})`;
        ctx.lineWidth = 1; ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, size2, 0, Math.PI*2);
        ctx.fillStyle = col;
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    // Rim
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(0,245,255,0.3)';
    ctx.lineWidth = 1.5; ctx.stroke();

    angle = (angle + 0.3) % 360;
    globeAnimId = requestAnimationFrame(() => drawGlobe(angle));
  }
  drawGlobe(0);
}

/* ── Bar Chart ── */
function renderBarChart() {
  const canvas = document.getElementById('bar-chart');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const entries = [...ipHash.entries()].sort((a,b)=>b[1].total-a[1].total).slice(0,6);

  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.clientWidth - 40;
  const H = canvas.parentElement.clientHeight - 40;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (entries.length === 0) {
    ctx.fillStyle = 'rgba(100,150,200,0.3)';
    ctx.font = '13px Share Tech Mono';
    ctx.textAlign = 'center';
    ctx.fillText('Add logs to see activity chart', W/2, H/2);
    return;
  }

  const pad = { top: 20, right: 20, bottom: 50, left: 48 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top  - pad.bottom;
  const maxVal = Math.max(...entries.map(([,v])=>v.total));

  // Grid
  ctx.strokeStyle = 'rgba(0,245,255,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + cH - (i/4)*cH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+cW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(100,150,200,0.5)';
    ctx.font = '10px Share Tech Mono';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal*i/4), pad.left-6, y+4);
  }

  // Bars
  const barW = cW / (entries.length * 2.5);
  entries.forEach(([,v], i) => {
    const x = pad.left + i*(cW/entries.length) + barW*0.5;
    const failH = (v.failed/maxVal)*cH;
    const succH = (v.success/maxVal)*cH;

    // Failed bar
    const failGrad = ctx.createLinearGradient(0, pad.top+cH-failH, 0, pad.top+cH);
    failGrad.addColorStop(0,'rgba(255,59,92,0.9)');
    failGrad.addColorStop(1,'rgba(255,59,92,0.2)');
    ctx.fillStyle = failGrad;
    ctx.beginPath();
    ctx.roundRect(x, pad.top+cH-failH, barW, failH, [4,4,0,0]);
    ctx.fill();

    // Success bar
    const succGrad = ctx.createLinearGradient(0, pad.top+cH-succH, 0, pad.top+cH);
    succGrad.addColorStop(0,'rgba(16,217,134,0.9)');
    succGrad.addColorStop(1,'rgba(16,217,134,0.2)');
    ctx.fillStyle = succGrad;
    ctx.beginPath();
    ctx.roundRect(x+barW+2, pad.top+cH-succH, barW, succH, [4,4,0,0]);
    ctx.fill();

    // Label
    const short = v.ip.split('.').slice(-1)[0];
    ctx.fillStyle = 'rgba(100,150,200,0.7)';
    ctx.font = '9px Share Tech Mono';
    ctx.textAlign = 'center';
    ctx.fillText(`.${short}`, x+barW, pad.top+cH+14);
    ctx.fillStyle = 'rgba(100,150,200,0.4)';
    ctx.font = '8px Share Tech Mono';
    ctx.fillText(v.ip.split('.').slice(0,3).join('.'), x+barW, pad.top+cH+26);
  });

  // Legend
  ctx.fillStyle = 'rgba(255,59,92,0.8)';  ctx.fillRect(pad.left, 4, 10, 8);
  ctx.fillStyle = 'rgba(100,150,200,0.6)'; ctx.font='10px Share Tech Mono'; ctx.textAlign='left';
  ctx.fillText('Failed', pad.left+14, 12);
  ctx.fillStyle = 'rgba(16,217,134,0.8)'; ctx.fillRect(pad.left+70, 4, 10, 8);
  ctx.fillStyle = 'rgba(100,150,200,0.6)';
  ctx.fillText('Success', pad.left+84, 12);
}

/* ── Donut Chart ── */
function renderDonut(success, failed) {
  const canvas = document.getElementById('donut-chart');
  if (!canvas) return;
  const size = 160;
  canvas.width = size; canvas.height = size;
  canvas.style.width = size+'px'; canvas.style.height = size+'px';
  const ctx = canvas.getContext('2d');
  const cx = size/2, cy = size/2, r = size/2 - 10, innerR = r - 24;
  const total = success + failed;

  if (total === 0) {
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 24; ctx.stroke();
    return;
  }

  const data = [
    { val: success, color: '#10d986' },
    { val: failed,  color: '#ff3b5c' },
  ];
  let startA = -Math.PI/2;
  for (const d of data) {
    const sweep = (d.val/total) * Math.PI*2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, startA, startA + sweep);
    ctx.arc(cx, cy, innerR, startA + sweep, startA, true);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    startA += sweep;
  }
}

/* ── BST Visualization ── */
function renderBST() {
  const canvas = document.getElementById('bst-canvas');
  if (!canvas) return;
  const nodes = ipBST.inorder();
  if (nodes.length === 0) {
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(100,150,200,0.3)';
    ctx.font = '12px Share Tech Mono';
    ctx.textAlign = 'center';
    ctx.fillText('BST empty. Add logs to see the IP tree.', canvas.parentElement.clientWidth/2, 30);
    return;
  }

  const W = canvas.parentElement.clientWidth - 32;
  // Build tree layout via recursive positioning
  function assignPositions(node, depth, leftBound, rightBound) {
    if (!node) return;
    const mid = (leftBound + rightBound) / 2;
    node._x = mid;
    node._y = depth * 72 + 36;
    assignPositions(node.left,  depth+1, leftBound, mid);
    assignPositions(node.right, depth+1, mid, rightBound);
  }
  assignPositions(ipBST.root, 0, 0, W);

  function treeHeight(node) {
    if (!node) return 0;
    return 1 + Math.max(treeHeight(node.left), treeHeight(node.right));
  }
  const H = treeHeight(ipBST.root) * 72 + 20;
  canvas.width = W; canvas.height = Math.max(H, 100);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  function drawEdges(node) {
    if (!node) return;
    if (node.left) {
      ctx.beginPath();
      ctx.moveTo(node._x, node._y);
      ctx.lineTo(node.left._x, node.left._y);
      ctx.strokeStyle = 'rgba(0,245,255,0.2)';
      ctx.lineWidth = 1; ctx.stroke();
    }
    if (node.right) {
      ctx.beginPath();
      ctx.moveTo(node._x, node._y);
      ctx.lineTo(node.right._x, node.right._y);
      ctx.strokeStyle = 'rgba(0,245,255,0.2)';
      ctx.lineWidth = 1; ctx.stroke();
    }
    drawEdges(node.left); drawEdges(node.right);
  }

  function drawNodes(node) {
    if (!node) return;
    const col = node.flagged ? '#ff3b5c' : '#00f5ff';
    const bg  = node.flagged ? 'rgba(255,59,92,0.15)' : 'rgba(0,245,255,0.1)';

    ctx.beginPath();
    ctx.arc(node._x, node._y, 22, 0, Math.PI*2);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.fillStyle = col;
    ctx.font = 'bold 8px Share Tech Mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const short = node.key.split('.').pop();
    ctx.fillText(`.${short}`, node._x, node._y - 5);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '7px Share Tech Mono';
    ctx.fillText(`${node.data.length}`, node._x, node._y + 7);

    if (node.flagged) {
      ctx.font = '10px sans-serif';
      ctx.fillText('⚠', node._x + 18, node._y - 18);
    }

    drawNodes(node.left); drawNodes(node.right);
  }

  drawEdges(ipBST.root);
  drawNodes(ipBST.root);
}

// ═══════════════════════════════════════════════════════
// UI UTILITIES
// ═══════════════════════════════════════════════════════
function showToast(msg, type='info') {
  const container = document.getElementById('toast-container');
  const icons = { success:'✅', error:'❌', info:'ℹ️', warning:'⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => { el.classList.add('toast-out'); setTimeout(()=>el.remove(), 300); }, 3000);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function updateLiveClock() {
  const el = document.getElementById('live-time');
  if (el) el.textContent = new Date().toLocaleString('en-IN', {
    weekday:'short', day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  });
}

// ═══════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // Set default datetime
  const timeInput = document.getElementById('time-input');
  if (timeInput) timeInput.value = new Date().toISOString().slice(0,16);

  // Navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const sec = btn.dataset.section;
      document.getElementById(`section-${sec}`).classList.add('active');
      if (sec === 'analysis') { renderBST(); renderBarChart(); }
      if (sec === 'report') {}
    });
  });

  // Add log form
 document.getElementById('log-form').addEventListener('submit', async e => {
  e.preventDefault();

  const ip = document.getElementById('ip-input').value.trim();
  const username = document.getElementById('user-input').value.trim();
  const status = document.getElementById('status-input').value;

  const ipRe = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (!ipRe.test(ip) || ip.split('.').some(part => Number(part) > 255)) {
    showToast('Invalid IP address.', 'error');
    return;
  }

  if (!username) {
    showToast('Enter a username.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, user: username, status })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Could not add log.');
    }

    await loadLogsFromAPI(false);
    showToast(`Log added: ${ip} (${status})`, 'success');

    document.getElementById('ip-input').value = '';
    document.getElementById('user-input').value = '';
    document.getElementById('time-input').value =
      new Date().toISOString().slice(0, 16);

  } catch (error) {
    console.error(error);
    showToast(error.message || 'Failed to add log.', 'error');
  }
});

  // Load sample data
 document.getElementById('load-sample-btn').addEventListener('click', async () => {
  try {
    const sampleData = SAMPLE_LOGS.map(log => ({
      ip: log.ip,
      user: log.username,
      status: log.status,
      time: log.time
    }));

    const response = await fetch('/api/logs/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Could not load sample data.');
    }

    await loadLogsFromAPI(false);
    showToast(`${SAMPLE_LOGS.length} sample logs added!`, 'success');

  } catch (error) {
    console.error(error);
    showToast(error.message || 'Sample data loading failed.', 'error');
  }
});
  // Clear all
  document.getElementById('clear-all-btn').addEventListener('click', () => {
    if (logList.size === 0) { showToast('No logs to clear.', 'info'); return; }
    clearAllLogs();
  });

  // Search
  document.getElementById('search-ip').addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    updateLogTable();
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      updateLogTable();
    });
  });

  // Analysis
  document.getElementById('run-analysis-btn').addEventListener('click', runAnalysis);

  // Threshold sliders
  const threshSlider = document.getElementById('threshold-slider');
  const threshVal    = document.getElementById('threshold-val');
  threshSlider.addEventListener('input', () => {
    detectionThreshold = parseInt(threshSlider.value);
    threshVal.textContent = detectionThreshold;
  });

  const freqSlider = document.getElementById('freq-slider');
  const freqVal    = document.getElementById('freq-val');
  freqSlider.addEventListener('input', () => {
    freqThreshold = parseInt(freqSlider.value);
    freqVal.textContent = freqThreshold;
  });

  // Detect
  document.getElementById('detect-btn').addEventListener('click', () => {
    if (logList.size === 0) { showToast('No logs to analyze.', 'info'); return; }
    runDetection();
  });

  // Report
  document.getElementById('gen-report-btn').addEventListener('click', () => {
    if (logList.size === 0) { showToast('No logs available for report.', 'info'); return; }
    generateReport();
  });

  // Modal
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.remove('open');
  });
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });

  // Live clock
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // Init particles
  initParticles();

  // Init views
updateAllViews();
renderGlobe();

// Load existing backend logs
loadLogsFromAPI();

// Welcome toast
setTimeout(() => {
  showToast('CYBERSHIELD initialized. Backend connected.', 'success');
}, 500);
  // Handle window resize
  window.addEventListener('resize', () => {
    renderBarChart();
    renderGlobe();
    renderBST();
  });
});
