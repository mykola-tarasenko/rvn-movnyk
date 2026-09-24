'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');
const approved = require('./shared-exceptions.js');

const root = __dirname;
const dataDir = path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'rvn-exceptions.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS exceptions (
    normalized TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS abbreviations (
    value TEXT PRIMARY KEY COLLATE NOCASE,
    source TEXT NOT NULL DEFAULT 'rvn'
  );
  CREATE TABLE IF NOT EXISTS genitive_overrides (
    from_form TEXT PRIMARY KEY COLLATE NOCASE,
    to_form TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'user'
  );
`);
const normalizeWord = word => word.normalize('NFC').replace(/[’ʼ]/g, "'").toLocaleLowerCase('uk');
const seedWord = db.prepare("INSERT OR IGNORE INTO exceptions (normalized, word, source) VALUES (?, ?, 'rvn')");
for (const word of approved.words) seedWord.run(normalizeWord(word), word.normalize('NFC'));
const seedAbbreviation = db.prepare("INSERT OR IGNORE INTO abbreviations (value, source) VALUES (?, 'rvn')");
for (const abbreviation of approved.abbreviations) seedAbbreviation.run(abbreviation);
const seedGenitive = db.prepare("INSERT OR IGNORE INTO genitive_overrides (from_form, to_form, source) VALUES (?, ?, 'rvn')");
for (const [from, to] of approved.genitive) seedGenitive.run(from.normalize('NFC'), to.normalize('NFC'));

const listUserWords = db.prepare("SELECT word FROM exceptions WHERE source = 'user' ORDER BY word COLLATE NOCASE");
const listAbbreviations = db.prepare('SELECT value FROM abbreviations ORDER BY value COLLATE NOCASE');
const listGenitive = db.prepare('SELECT from_form AS "from", to_form AS "to" FROM genitive_overrides ORDER BY from_form COLLATE NOCASE');
const insertWord = db.prepare("INSERT OR IGNORE INTO exceptions (normalized, word, source) VALUES (?, ?, 'user')");
const removeWord = db.prepare("DELETE FROM exceptions WHERE normalized = ? AND source = 'user'");
const insertGenitive = db.prepare("INSERT OR IGNORE INTO genitive_overrides (from_form, to_form, source) VALUES (?, ?, 'user')");

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 32000) { reject(new Error('Запит завеликий.')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Некоректний JSON.')); }
    });
    req.on('error', reject);
  });
}
function cleanWord(value) {
  if (typeof value !== 'string') return null;
  const word = value.normalize('NFC').trim();
  return word.length <= 99 && /^[\p{L}\p{M}]+(?:['’ʼ-][\p{L}\p{M}]+)*$/u.test(word) ? word : null;
}

const staticFiles = new Set(['index.html', 'app.js', 'proofreading-worker.js', 'styles.css', 'vendor/dictionary-uk-GPL-3.0.txt']);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (url.pathname === '/api/exceptions' && req.method === 'GET') {
      return json(res, 200, { words: listUserWords.all().map(row => row.word), genitive: listGenitive.all(), abbreviations: listAbbreviations.all().map(row => row.value) });
    }
    if (url.pathname === '/api/exceptions' && req.method === 'POST') {
      const body = await getBody(req);
      const values = Array.isArray(body.words) ? body.words : [body.word];
      if (!values.length || values.length > 500) return json(res, 400, { error: 'Додайте від 1 до 500 слів.' });
      const words = values.map(cleanWord);
      if (words.some(word => !word)) return json(res, 400, { error: 'Кожен виняток має бути одним словом або назвою.' });
      db.exec('BEGIN IMMEDIATE');
      try {
        let added = 0;
        for (const word of new Set(words)) added += Number(insertWord.run(normalizeWord(word), word).changes);
        db.exec('COMMIT');
        return json(res, 200, { added, words: listUserWords.all().map(row => row.word) });
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    }
    if (url.pathname.startsWith('/api/exceptions/') && req.method === 'DELETE') {
      let word;
      try { word = decodeURIComponent(url.pathname.slice('/api/exceptions/'.length)); }
      catch { return json(res, 400, { error: 'Некоректне слово.' }); }
      if (!cleanWord(word)) return json(res, 400, { error: 'Некоректне слово.' });
      removeWord.run(normalizeWord(word));
      return json(res, 200, { words: listUserWords.all().map(row => row.word) });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Метод не підтримується.' });
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\//, '');
    if (!staticFiles.has(relative)) return json(res, 404, { error: 'Не знайдено.' });
    const filename = path.join(root, relative);
    const content = fs.readFileSync(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': relative === 'proofreading-worker.js' ? 'no-cache' : 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (!res.headersSent) json(res, 500, { error: error.message || 'Помилка сервера.' });
    else res.destroy();
  }
});

const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => {
  console.log(`Редактор: http://127.0.0.1:${port}`);
  console.log(`Спільна база винятків: ${path.join(dataDir, 'rvn-exceptions.sqlite')}`);
  console.log('Сервер доступний лише на цьому комп’ютері. Для спільного доступу ГО потрібне розміщення на захищеному сервері.');
});
function shutdown() { server.close(() => { db.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
