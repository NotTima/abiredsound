// ABI RedSound — Авторизация (ARS-67 / ARS-12), Админ-панель, Статистика и Stealth-режимы
const TOKEN_KEY = 'rs.auth.token';
const ROLE_KEY = 'rs.auth.role';
const CODE_KEY = 'rs.auth.code';
const VISITOR_KEY = 'rs.visitor.id';
const AUDIO_ONLY_KEY = 'rs.stealth.audioOnly';
const CLOAK_KEY = 'rs.stealth.cloak';
const LOCAL_STATS_KEY = 'rs.local.stats';
const LOCAL_CFG_KEY = 'rs.local.config';

const DEFAULT_CFG = {
  motd: 'Добро пожаловать в ABI RedSound! Для максимальной незаметности включи режим «Stealth: Только звук».',
  motdEnabled: true,
  userCode: 'ARS-67',
  adminCode: 'ARS-12',
  allowUsers: true,
  showLab: true,
  defaultStealthAudio: true
};

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return 'v_anon';
  }
}

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function saveSession(token, role, code) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, role);
    localStorage.setItem(CODE_KEY, code);
  } catch {}
}

function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(CODE_KEY);
  } catch {}
}

function isRu() {
  return document.documentElement.lang !== 'en';
}

// === Локальный fallback (для GitHub Pages без server.js) ===
function loadLocalCfg() {
  try {
    const raw = localStorage.getItem(LOCAL_CFG_KEY);
    return raw ? { ...DEFAULT_CFG, ...JSON.parse(raw) } : { ...DEFAULT_CFG };
  } catch {
    return { ...DEFAULT_CFG };
  }
}

function saveLocalCfg(cfg) {
  try { localStorage.setItem(LOCAL_CFG_KEY, JSON.stringify(cfg)); } catch {}
}

function recordLocalVisit(code, role) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(LOCAL_STATS_KEY);
    const data = raw ? JSON.parse(raw) : { total: 0, today: 0, todayDate: today, uniqueVisitors: [], log: [] };
    if (data.todayDate !== today) {
      data.todayDate = today;
      data.today = 0;
    }
    const vid = getVisitorId();
    data.total += 1;
    data.today += 1;
    if (!data.uniqueVisitors.includes(vid)) data.uniqueVisitors.push(vid);
    data.log.unshift({
      at: new Date().toISOString(),
      code,
      role,
      visitorId: vid,
      ip: 'static-mode',
      ua: navigator.userAgent.slice(0, 90)
    });
    if (data.log.length > 50) data.log.length = 50;
    localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(data));
  } catch {}
}

// === API обёртка (сервер или статический фолбэк) ===
let useStaticFallback = false;

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['x-rs-token'] = token;
  const res = await fetch(url, { ...options, headers });
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('NOT_JSON');
  }
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function checkAuthStatus() {
  try {
    const r = await apiFetch('/api/auth/status', { cache: 'no-store' });
    useStaticFallback = false;
    return r.data;
  } catch {
    useStaticFallback = true;
    const cfg = loadLocalCfg();
    const token = getToken();
    const role = (() => { try { return localStorage.getItem(ROLE_KEY); } catch { return null; } })();
    const code = (() => { try { return localStorage.getItem(CODE_KEY); } catch { return null; } })();
    if (token && (role === 'admin' || (role === 'user' && cfg.allowUsers))) {
      return { authenticated: true, role, code, config: cfg };
    }
    return { authenticated: false, config: cfg };
  }
}

async function performLogin(codeInput) {
  const code = String(codeInput || '').trim().toUpperCase();
  const visitorId = getVisitorId();

  if (!useStaticFallback) {
    try {
      const r = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ code, visitorId })
      });
      if (r.ok && r.data.ok) {
        saveSession(r.data.token, r.data.role, r.data.code);
        return { ok: true, role: r.data.role, code: r.data.code, config: r.data.config };
      }
      return { ok: false, error: r.data.error, message: r.data.message };
    } catch {
      useStaticFallback = true;
    }
  }

  // Fallback (GitHub Pages)
  const cfg = loadLocalCfg();
  if (code === cfg.adminCode.toUpperCase()) {
    const tok = 'local_' + Math.random().toString(36).slice(2);
    saveSession(tok, 'admin', code);
    recordLocalVisit(code, 'admin');
    return { ok: true, role: 'admin', code, config: cfg };
  }
  if (code === cfg.userCode.toUpperCase()) {
    if (!cfg.allowUsers) {
      return { ok: false, error: 'maintenance', message: 'Доступ для пользователей временно отключён админом.' };
    }
    const tok = 'local_' + Math.random().toString(36).slice(2);
    saveSession(tok, 'user', code);
    recordLocalVisit(code, 'user');
    return { ok: true, role: 'user', code, config: cfg };
  }
  return { ok: false, error: 'invalid', message: 'Неверный код доступа.' };
}

// === Применение конфигурации (MOTD, Lab, Stealth default) ===
let currentConfig = { ...DEFAULT_CFG };

function applySiteConfig(cfg, role) {
  currentConfig = { ...DEFAULT_CFG, ...(cfg || {}) };
  const motdEl = document.getElementById('rsMotdBar');
  const motdTextEl = document.getElementById('rsMotdText');
  if (motdEl && motdTextEl) {
    if (currentConfig.motdEnabled && currentConfig.motd.trim()) {
      motdTextEl.textContent = currentConfig.motd;
      motdEl.hidden = false;
    } else {
      motdEl.hidden = true;
    }
  }

  const labEl = document.getElementById('rsLab');
  if (labEl) {
    labEl.hidden = !currentConfig.showLab && role !== 'admin';
  }

  // Инициализация Stealth Audio-Only если не задано юзером вручную
  try {
    if (localStorage.getItem(AUDIO_ONLY_KEY) === null) {
      setAudioOnlyMode(!!currentConfig.defaultStealthAudio, false);
    }
  } catch {}
}

// === UI: Авторизация и Роли ===
function setLocked(locked) {
  document.documentElement.classList.toggle('rs-locked', locked);
  const gate = document.getElementById('rsGate');
  if (gate) gate.hidden = !locked;
}

function updateRoleUI(role, code) {
  const badge = document.getElementById('rsRoleBadge');
  const adminBtn = document.getElementById('rsAdminBtn');
  if (badge) {
    if (role === 'admin') {
      badge.textContent = `ADMIN · ${code || 'ARS-12'}`;
      badge.className = 'rs-role-badge admin';
      badge.hidden = false;
    } else if (role === 'user') {
      badge.textContent = `USER · ${code || 'ARS-67'}`;
      badge.className = 'rs-role-badge user';
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }
  if (adminBtn) {
    adminBtn.hidden = role !== 'admin';
  }
}

// === Stealth 1: Audio-Only (Без захвата окна игры) ===
function setAudioOnlyMode(on, persist = true) {
  window.__RS_AUDIO_ONLY = !!on;
  if (persist) {
    try { localStorage.setItem(AUDIO_ONLY_KEY, on ? '1' : '0'); } catch {}
  }
  const btn = document.getElementById('rsStealthAudioToggle');
  if (btn) {
    btn.setAttribute('aria-checked', String(!!on));
    btn.classList.toggle('on', !!on);
  }
  const hint = document.getElementById('rsStealthAudioHint');
  if (hint) {
    hint.textContent = on
      ? (isRu()
          ? 'Включено: игра не видит захвата экрана (слушает только аудиоканал).'
          : 'ON: zero screen capture (listens strictly to audio stream).')
      : (isRu()
          ? 'Выключено: захватывается окно игры + сетка (стандартный режим).'
          : 'OFF: captures game window video + cargo grid.');
  }
}

function initStealthAudioToggle() {
  let saved = true;
  try {
    const raw = localStorage.getItem(AUDIO_ONLY_KEY);
    saved = raw === null ? !!currentConfig.defaultStealthAudio : raw === '1';
  } catch {}
  setAudioOnlyMode(saved, false);

  const btn = document.getElementById('rsStealthAudioToggle');
  btn?.addEventListener('click', () => {
    setAudioOnlyMode(!window.__RS_AUDIO_ONLY, true);
  });
}

// === Stealth 2: Tab Cloak (Маскировка заголовка и фавиконки) ===
const ORIG_TITLE = document.title;
const CLOAK_TITLE = 'Google Документы — Рабочий конспект';
const CLOAK_ICON = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>');
let origFavicons = null;

function setTabCloak(on) {
  try { localStorage.setItem(CLOAK_KEY, on ? '1' : '0'); } catch {}
  const btn = document.getElementById('rsCloakBtn');
  if (btn) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  }
  if (!origFavicons) {
    origFavicons = [...document.querySelectorAll('link[rel*="icon"]')].map(l => ({ el: l, href: l.href }));
  }
  if (on) {
    document.title = CLOAK_TITLE;
    origFavicons.forEach(item => { item.el.href = CLOAK_ICON; });
  } else {
    document.title = ORIG_TITLE;
    origFavicons.forEach(item => { item.el.href = item.href; });
  }
}

function initTabCloak() {
  let saved = false;
  try { saved = localStorage.getItem(CLOAK_KEY) === '1'; } catch {}
  if (saved) setTabCloak(true);

  document.getElementById('rsCloakBtn')?.addEventListener('click', () => {
    const active = document.getElementById('rsCloakBtn')?.classList.contains('on');
    setTabCloak(!active);
  });

  // Хоткей Alt+X для мгновенной маскировки
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.code === 'KeyX' || e.key.toLowerCase() === 'x')) {
      e.preventDefault();
      const active = document.getElementById('rsCloakBtn')?.classList.contains('on');
      setTabCloak(!active);
    }
  });
}

// === Админ-панель (ARS-12) ===
async function loadAdminData() {
  if (!useStaticFallback) {
    try {
      const r = await apiFetch('/api/admin/stats', { cache: 'no-store' });
      if (r.ok && r.data.ok) return r.data;
    } catch {}
  }
  const raw = (() => { try { return localStorage.getItem(LOCAL_STATS_KEY); } catch { return null; } })();
  const st = raw ? JSON.parse(raw) : { total: 0, today: 0, uniqueVisitors: [], log: [] };
  return {
    ok: true,
    total: st.total || 0,
    today: st.today || 0,
    uniqueCount: (st.uniqueVisitors || []).length,
    activeSessions: 1,
    log: st.log || [],
    config: loadLocalCfg()
  };
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

async function renderAdminModal() {
  const data = await loadAdminData();
  document.getElementById('rsStatTotal').textContent = data.total ?? 0;
  document.getElementById('rsStatToday').textContent = data.today ?? 0;
  document.getElementById('rsStatUnique').textContent = data.uniqueCount ?? 0;
  document.getElementById('rsStatActive').textContent = data.activeSessions ?? 1;

  const cfg = data.config || DEFAULT_CFG;
  document.getElementById('rsAdmMotd').value = cfg.motd || '';
  document.getElementById('rsAdmMotdOn').checked = !!cfg.motdEnabled;
  document.getElementById('rsAdmAllowUsers').checked = !!cfg.allowUsers;
  document.getElementById('rsAdmShowLab').checked = !!cfg.showLab;
  document.getElementById('rsAdmStealthDef').checked = !!cfg.defaultStealthAudio;
  document.getElementById('rsAdmUserCode').value = cfg.userCode || 'ARS-67';

  const tbody = document.getElementById('rsAdmLogBody');
  if (tbody) {
    if (!data.log || !data.log.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="rs-adm-empty">Пока нет записей о входах</td></tr>';
    } else {
      tbody.innerHTML = data.log.slice(0, 20).map(item => {
        const dt = new Date(item.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const roleCls = item.role === 'admin' ? 'adm' : 'usr';
        const uaShort = (item.ua || '').includes('Firefox') ? 'Firefox' : (item.ua || '').includes('Chrome') ? 'Chrome' : (item.ua || '').slice(0, 24);
        return `<tr>
          <td>${esc(dt)}</td>
          <td><code>${esc(item.code)}</code></td>
          <td><span class="rs-tag ${roleCls}">${esc(item.role)}</span></td>
          <td title="${esc(item.ua)}">${esc(uaShort)} (${esc(item.ip || 'local')})</td>
        </tr>`;
      }).join('');
    }
  }
}

function initAdminModal() {
  const dlg = document.getElementById('rsAdminDialog');
  const openBtn = document.getElementById('rsAdminBtn');
  const closeBtn = document.getElementById('rsAdminClose');
  const refreshBtn = document.getElementById('rsAdmRefresh');
  const clearBtn = document.getElementById('rsAdmClearStats');
  const form = document.getElementById('rsAdmForm');
  const statusEl = document.getElementById('rsAdmStatus');

  openBtn?.addEventListener('click', async () => {
    await renderAdminModal();
    dlg?.showModal();
  });
  closeBtn?.addEventListener('click', () => dlg?.close());
  dlg?.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  refreshBtn?.addEventListener('click', () => renderAdminModal());

  clearBtn?.addEventListener('click', async () => {
    if (!useStaticFallback) {
      await apiFetch('/api/admin/clear-stats', { method: 'POST', body: '{}' }).catch(() => {});
    } else {
      try { localStorage.removeItem(LOCAL_STATS_KEY); } catch {}
    }
    await renderAdminModal();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patch = {
      motd: document.getElementById('rsAdmMotd').value.trim(),
      motdEnabled: document.getElementById('rsAdmMotdOn').checked,
      allowUsers: document.getElementById('rsAdmAllowUsers').checked,
      showLab: document.getElementById('rsAdmShowLab').checked,
      defaultStealthAudio: document.getElementById('rsAdmStealthDef').checked,
      userCode: document.getElementById('rsAdmUserCode').value.trim().toUpperCase() || 'ARS-67'
    };

    if (!useStaticFallback) {
      const r = await apiFetch('/api/admin/config', { method: 'POST', body: JSON.stringify(patch) }).catch(() => null);
      if (r?.ok) applySiteConfig(r.data.config, 'admin');
    } else {
      const merged = { ...loadLocalCfg(), ...patch };
      saveLocalCfg(merged);
      applySiteConfig(merged, 'admin');
    }

    if (statusEl) {
      statusEl.textContent = '✓ Настройки сохранены и применены';
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    }
  });
}

// === Улучшение UX навигации и теста звука ===
function initGuideScrollFix() {
  // Вместо битого видеоплеера плавно скроллим к тактическим гайдам
  document.querySelectorAll('[data-guide]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const sec = document.getElementById('rsGuides');
      if (sec) {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        sec.classList.add('rs-highlight');
        setTimeout(() => sec.classList.remove('rs-highlight'), 1400);
      }
    }, true);
  });
}

function initAudioTester() {
  const btn = document.getElementById('rsMicTestBtn');
  const meter = document.getElementById('rsMicMeter');
  const fill = document.getElementById('rsMicFill');
  const text = document.getElementById('rsMicText');
  if (!btn || !meter || !fill || !text) return;

  let activeStream = null;
  let rafId = null;
  let audioCtx = null;

  const stopTest = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (activeStream) activeStream.getTracks().forEach(t => t.stop());
    activeStream = null;
    if (audioCtx) audioCtx.close().catch(() => {});
    audioCtx = null;
    meter.hidden = true;
    btn.classList.remove('on');
    btn.querySelector('span').textContent = isRu() ? 'Тест звука' : 'Audio test';
  };

  btn.addEventListener('click', async () => {
    if (activeStream) {
      stopTest();
      return;
    }
    try {
      activeStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      audioCtx = new AudioContext();
      const src = audioCtx.createMediaStreamSource(activeStream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      meter.hidden = false;
      btn.classList.add('on');
      btn.querySelector('span').textContent = isRu() ? 'Стоп тест' : 'Stop test';
      const label = activeStream.getAudioTracks()[0]?.label || 'Audio input';
      text.textContent = label;

      const tick = () => {
        if (!activeStream) return;
        analyser.getByteTimeDomainData(data);
        let max = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128;
          if (v > max) max = v;
        }
        fill.style.width = Math.min(100, Math.round(max * 260)) + '%';
        rafId = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      meter.hidden = false;
      fill.style.width = '0%';
      text.textContent = isRu() ? 'Доступ к аудио отклонён браузером' : 'Audio permission denied';
      setTimeout(() => { meter.hidden = true; }, 3000);
    }
  });
}

// === Инициализация ===
async function bootstrap() {
  initGuideScrollFix();
  initTabCloak();
  initAdminModal();
  initAudioTester();

  // Очистка сессии при нажатии Выйти
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession();
  }, true);

  // Закрытие баннера MOTD
  document.getElementById('rsMotdClose')?.addEventListener('click', () => {
    const bar = document.getElementById('rsMotdBar');
    if (bar) bar.hidden = true;
  });

  const status = await checkAuthStatus();
  applySiteConfig(status.config, status.role);
  initStealthAudioToggle();

  if (status.authenticated) {
    updateRoleUI(status.role, status.code);
    setLocked(false);
  } else {
    updateRoleUI(null, null);
    setLocked(true);
  }

  // Форма входа по коду
  const form = document.getElementById('rsGateForm');
  const input = document.getElementById('rsGateCode');
  const errEl = document.getElementById('rsGateErr');

  input?.addEventListener('input', () => {
    input.value = input.value.toUpperCase();
    if (errEl) errEl.textContent = '';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = input?.value?.trim();
    if (!code) {
      if (errEl) errEl.textContent = 'Введите код доступа (например ARS-67)';
      return;
    }
    const res = await performLogin(code);
    if (res.ok) {
      applySiteConfig(res.config, res.role);
      updateRoleUI(res.role, res.code);
      setLocked(false);
      if (input) input.value = '';
    } else {
      if (errEl) errEl.textContent = res.message || 'Неверный код доступа';
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
    }
  });
}

bootstrap();
