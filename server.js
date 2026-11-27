// ABI RedSound — локальный сервер с авторизацией (ARS-67 / ARS-12), статистикой визитов и мок-API
// Запуск: node server.js  или  npm start  →  http://localhost:8080

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, 'site');
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml'
};

// === Персистентное хранилище (статистика + настройки админа) ===

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_STORE = {
  visits: {
    total: 0,
    today: 0,
    todayDate: todayStr(),
    uniqueVisitors: [],
    log: []
  },
  config: {
    motd: 'Добро пожаловать в ABI RedSound! Для максимальной незаметности включи режим «Stealth: Только звук».',
    motdEnabled: true,
    userCode: 'ARS-67',
    adminCode: 'ARS-12',
    allowUsers: true,
    showLab: true,
    defaultStealthAudio: true
  }
};

function loadStore() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      return {
        visits: { ...DEFAULT_STORE.visits, ...(parsed.visits || {}) },
        config: { ...DEFAULT_STORE.config, ...(parsed.config || {}) }
      };
    }
  } catch (e) {
    console.warn('⚠ Ошибка чтения store.json, используется дефолт:', e.message);
  }
  return structuredClone(DEFAULT_STORE);
}

let store = loadStore();

function saveStore() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.warn('⚠ Не удалось сохранить store.json:', e.message);
  }
}

function rollDayIfNeeded() {
  const t = todayStr();
  if (store.visits.todayDate !== t) {
    store.visits.todayDate = t;
    store.visits.today = 0;
  }
}

function recordVisit({ code, role, req, visitorId }) {
  rollDayIfNeeded();
  store.visits.total += 1;
  store.visits.today += 1;

  const vid = String(visitorId || '').slice(0, 64) || crypto.randomBytes(6).toString('hex');
  if (!store.visits.uniqueVisitors.includes(vid)) {
    store.visits.uniqueVisitors.push(vid);
    if (store.visits.uniqueVisitors.length > 5000) {
      store.visits.uniqueVisitors = store.visits.uniqueVisitors.slice(-5000);
    }
  }

  const ua = String(req.headers['user-agent'] || 'Unknown').slice(0, 120);
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'local';

  store.visits.log.unshift({
    at: new Date().toISOString(),
    code,
    role,
    visitorId: vid,
    ip,
    ua
  });
  if (store.visits.log.length > 60) {
    store.visits.log.length = 60;
  }
  saveStore();
}

// Сессии в памяти: token -> { role, code, createdAt }
const sessions = new Map();

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return out;
}

function getSession(req) {
  const token = req.headers['x-rs-token'] || parseCookies(req).rs_token;
  if (!token) return null;
  const s = sessions.get(token);
  return s ? { ...s, token } : null;
}

// === Хелперы HTTP ===

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

function json(res, data, status = 200, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

// Загружаем снапшот каталога
let catalogData = null;
try {
  catalogData = fs.readFileSync(path.join(ROOT, 'api', 'catalog'), 'utf8');
} catch (e) {
  console.warn('⚠ api/catalog snapshot not found, /api/catalog will return empty');
  catalogData = JSON.stringify({ version: '0', profiles: [], types: [], sounds: [], pools: [], items: [] });
}

// === API ===

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, x-rs-token',
      'access-control-max-age': '86400'
    });
    return res.end();
  }

  // Публичный конфиг (без секретных кодов)
  const publicConfig = {
    motd: store.config.motd,
    motdEnabled: store.config.motdEnabled,
    allowUsers: store.config.allowUsers,
    showLab: store.config.showLab,
    defaultStealthAudio: store.config.defaultStealthAudio
  };

  // Статус авторизации для Gate
  if (pathname === '/api/auth/status') {
    const sess = getSession(req);
    if (!sess) {
      return json(res, { authenticated: false, config: publicConfig });
    }
    if (sess.role === 'user' && !store.config.allowUsers) {
      sessions.delete(sess.token);
      return json(res, { authenticated: false, reason: 'maintenance', config: publicConfig });
    }
    return json(res, {
      authenticated: true,
      role: sess.role,
      code: sess.code,
      config: publicConfig
    });
  }

  // Вход по коду (ARS-67 или ARS-12)
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const raw = await readBody(req);
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch {}
    const inputCode = String(body.code || '').trim().toUpperCase();
    const adminCode = String(store.config.adminCode || 'ARS-12').trim().toUpperCase();
    const userCode = String(store.config.userCode || 'ARS-67').trim().toUpperCase();

    let role = null;
    if (inputCode && inputCode === adminCode) {
      role = 'admin';
    } else if (inputCode && inputCode === userCode) {
      if (!store.config.allowUsers) {
        return json(res, { ok: false, error: 'maintenance', message: 'Доступ для пользователей временно приостановлен администратором.' }, 403);
      }
      role = 'user';
    } else {
      return json(res, { ok: false, error: 'invalid', message: 'Неверный код доступа.' }, 401);
    }

    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { role, code: inputCode, createdAt: Date.now() });
    recordVisit({ code: inputCode, role, req, visitorId: body.visitorId });
    console.log(`  ✓ auth: role=${role} code=${inputCode} totalVisits=${store.visits.total}`);

    return json(
      res,
      { ok: true, role, code: inputCode, token, config: publicConfig },
      200,
      { 'set-cookie': `rs_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` }
    );
  }

  // Логаут (выход)
  if (pathname === '/api/logout') {
    const sess = getSession(req);
    if (sess) sessions.delete(sess.token);
    return json(
      res,
      { ok: true },
      200,
      { 'set-cookie': 'rs_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' }
    );
  }

  // === Админ-панель (только ARS-12) ===
  if (pathname.startsWith('/api/admin/')) {
    const sess = getSession(req);
    if (!sess || sess.role !== 'admin') {
      return json(res, { ok: false, error: 'forbidden' }, 403);
    }

    if (pathname === '/api/admin/stats') {
      rollDayIfNeeded();
      return json(res, {
        ok: true,
        total: store.visits.total,
        today: store.visits.today,
        uniqueCount: store.visits.uniqueVisitors.length,
        activeSessions: sessions.size,
        log: store.visits.log,
        config: store.config
      });
    }

    if (pathname === '/api/admin/config' && req.method === 'POST') {
      const raw = await readBody(req);
      let patch = {};
      try { patch = JSON.parse(raw || '{}'); } catch {}

      if (typeof patch.motd === 'string') store.config.motd = patch.motd.slice(0, 400);
      if (typeof patch.motdEnabled === 'boolean') store.config.motdEnabled = patch.motdEnabled;
      if (typeof patch.allowUsers === 'boolean') store.config.allowUsers = patch.allowUsers;
      if (typeof patch.showLab === 'boolean') store.config.showLab = patch.showLab;
      if (typeof patch.defaultStealthAudio === 'boolean') store.config.defaultStealthAudio = patch.defaultStealthAudio;
      if (typeof patch.userCode === 'string' && patch.userCode.trim().length >= 3) {
        store.config.userCode = patch.userCode.trim().toUpperCase().slice(0, 24);
      }

      saveStore();
      return json(res, { ok: true, config: store.config });
    }

    if (pathname === '/api/admin/clear-stats' && req.method === 'POST') {
      store.visits = { total: 0, today: 0, todayDate: todayStr(), uniqueVisitors: [], log: [] };
      saveStore();
      return json(res, { ok: true });
    }

    return json(res, { ok: false, error: 'unknown admin endpoint' }, 404);
  }

  // === Родные эндпоинты приложения ===
  if (pathname === '/api/session') {
    return json(res, { ok: true });
  }

  if (pathname === '/api/login') {
    return json(res, { ok: true });
  }

  if (pathname === '/api/catalog') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store'
    });
    return res.end(catalogData);
  }

  if (pathname === '/api/finds/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'connection': 'keep-alive',
      'access-control-allow-origin': '*'
    });
    res.write('event: init\ndata: {"now":' + Date.now() + ',"list":[],"stats":{"total":0,"sum":0,"day":0}}\n\n');
    const keepalive = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => clearInterval(keepalive));
    return;
  }

  if (pathname === '/api/finds' || pathname === '/api/device' || pathname.startsWith('/api/report')) {
    return json(res, { ok: true });
  }

  if (pathname === '/api/sync/push') {
    return json(res, { viewers: 0 });
  }

  if (['/api/mod', '/api/pin', '/api/tel', '/api/dev', '/api/fin'].includes(pathname)) {
    return json(res, { ok: true });
  }

  json(res, { ok: false, error: 'unknown endpoint' }, 404);
}

// === Статический сервер ===

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(ROOT, decodeURIComponent(pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': 'no-store, must-revalidate'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// === Запуск ===

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/finds/stream')) {
    const time = new Date().toLocaleTimeString('ru');
    console.log(`${time}  ${req.method} ${pathname}`);
  }

  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname);
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`
╔═════════════════════════════════════════════════════╗
║  ABI RedSound — Local Server                        ║
║  http://localhost:${PORT}                              ║
║                                                     ║
║  Коды входа: ARS-67 (Юзер) | ARS-12 (Админ)         ║
║  Статика: ./site/          | Firefox & Stealth OK   ║
╚═════════════════════════════════════════════════════╝
`);
});
