/*
 * CYBERSHIELD server: Express routes that call the C engine (engine.c).
 * Node only passes requests along; every data structure runs inside the C program.
 */
const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ENGINE = path.join(__dirname, process.platform === 'win32' ? 'engine.exe' : 'engine');
const DATA_FILE = path.join(__dirname, 'data', 'logs.csv');
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* Run the engine; calls are queued one at a time so two requests never write the file together. */
let chain = Promise.resolve();
function runEngine(args, input) {
  const job = () => new Promise(resolve => {
    const p = execFile(ENGINE, [DATA_FILE, ...args], { timeout: 10000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err && err.code === 'ENOENT') return resolve({ code: 500, body: { error: 'C engine not found. Compile it first: gcc -o engine engine.c' } });
      let body;
      try { body = JSON.parse(stdout); } catch { body = { error: 'Engine returned an unexpected result.' }; }
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, body });
    });
    if (input !== undefined) p.stdin.end(input);
  });
  const result = chain.then(job);
  chain = result.catch(() => {});
  return result;
}

function reply(res, r, okStatus = 200) {
  if (r.code === 0) return res.status(okStatus).json(r.body);
  res.status(r.code === 2 ? 404 : r.code === 500 ? 500 : 400).json(r.body);
}
const bad = (res, msg) => res.status(400).json({ error: msg });
const clean = v => String(v == null ? '' : v).trim();
const unsafe = v => /[\r\n,]/.test(v);

/* ---------- routes ---------- */
app.get('/api/logs', async (req, res) => reply(res, await runEngine(['list'])));

app.post('/api/logs', async (req, res) => {
  const { ip, user, status } = req.body || {};
  const a = [clean(ip), clean(user), clean(status)];
  if (a.some(unsafe)) return bad(res, 'Invalid characters in input.');
  reply(res, await runEngine(['add', ...a]), 201);
});

app.post('/api/logs/bulk', async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length > 5000) return bad(res, 'Send an array of at most 5000 logs.');
  const lines = [];
  for (const r of rows) {
    const f = [clean(r && r.ip), clean(r && r.user), clean(r && r.status)];
    if (f.some(unsafe)) return bad(res, 'Invalid characters in input.');
    const t = clean(r && r.time);
    lines.push([...f, unsafe(t) ? '' : t].join(','));
  }
  reply(res, await runEngine(['addbulk'], lines.join('\n') + '\n'), 201);
});

app.delete('/api/logs/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return bad(res, 'Invalid id.');
  reply(res, await runEngine(['delete', req.params.id]));
});

app.get('/api/summary', async (req, res) => {
  const f = parseInt(req.query.fail) || 3, q = parseInt(req.query.freq) || 5;
  reply(res, await runEngine(['summary', String(f), String(q)]));
});

app.get('/api/search/:ip', async (req, res) => {
  if (!/^[\d.]{7,15}$/.test(req.params.ip)) return bad(res, 'Invalid IP address.');
  reply(res, await runEngine(['search', req.params.ip]));
});

app.get('/api/sorted', async (req, res) => reply(res, await runEngine(['sorted'])));
app.get('/api/recent', async (req, res) => reply(res, await runEngine(['recent'])));

app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown API route.' }));
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status === 400 ? 'Invalid JSON body.' : 'Server error.' }));

app.listen(PORT, () => console.log(`CYBERSHIELD (C engine) running at http://localhost:${PORT}`));