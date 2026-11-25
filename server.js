// ABI Merchant — локальный сервер с мок-API
// Запуск: node server.js → http://localhost:8080

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'site');
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

// === Мок API ===

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store'
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

async function handleApi(req, res, pathname) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400'
    });
    return res.end();
  }

  // Session — always ok (no real auth)
  if (pathname === '/api/session') {
    return json(res, { ok: true });
  }

  // Login — accept any key
  if (pathname === '/api/login') {
    const body = await readBody(req);
    let key = 'unknown';
    try { key = JSON.parse(body).key || key; } catch {}
    console.log(`  ✓ login: key=${key}`);
    return json(res, { ok: true });
  }

  // Logout
  if (pathname === '/api/logout') {
    return json(res, {});
  }

  // Catalog — return snapshot
  if (pathname === '/api/catalog') {
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=300'
    });
    return res.end(catalogData);
  }

  // Device
  if (pathname === '/api/device') {
    return json(res, { ok: true });
  }

  // Finds
  if (pathname === '/api/finds') {
    return json(res, { ok: true });
  }

  // Report
  if (pathname.startsWith('/api/report')) {
    return json(res, { ok: true });
  }

  // Sync push
  if (pathname === '/api/sync/push') {
    return json(res, { viewers: 0 });
  }

  // Model / pin / tel / dev / fin — generic ok
  if (['/api/mod', '/api/pin', '/api/tel', '/api/dev', '/api/fin'].includes(pathname)) {
    return json(res, { ok: true });
  }

  // Fallback for unknown API
  json(res, { ok: false, error: 'unknown endpoint' }, 404);
}

// === Статический сервер ===

function serveStatic(req, res, pathname) {
  // Default to index.html
  if (pathname === '/') pathname = '/index.html';

  let filePath = path.join(ROOT, decodeURIComponent(pathname));

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('403 Forbidden');
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // Try without leading slash for api paths that are files
      res.writeHead(404);
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'content-type': contentType,
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

// === Сервер ===

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // Log
  const time = new Date().toLocaleTimeString('ru');
  console.log(`${time}  ${req.method} ${pathname}`);

  // API
  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname);
  }

  // Static files
  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║  ABI Merchant — Local Server             ║
║  http://localhost:${PORT}                   ║
║                                          ║
║  API: мок (без реальной авторизации)     ║
║  Статика: ./site/                        ║
╚══════════════════════════════════════════╝
`);
});
