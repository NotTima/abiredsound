// ABI RedSound — Простой доступ по ключу, Stealth-режимы и UX-утилиты
const TOKEN_KEY = 'rs.auth.token';
const AUDIO_ONLY_KEY = 'rs.stealth.audioOnly';
const CLOAK_KEY = 'rs.stealth.cloak';

// Простые ключи доступа (для себя и друзей)
const VALID_KEYS = new Set(['REDSOUND']);

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function saveSession(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}

function clearSession() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

function isRu() {
  return document.documentElement.lang !== 'en';
}

async function checkAuthStatus() {
  if (getToken()) {
    return { authenticated: true };
  }
  if (!window.__RS_STATIC_HOST) {
    try {
      const res = await fetch('/api/auth/status', { cache: 'no-store' });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        if (data.authenticated) return { authenticated: true };
      }
    } catch {}
  }
  return { authenticated: false };
}

async function performLogin(codeInput) {
  const code = String(codeInput || '').trim().toUpperCase();
  if (!code) {
    return { ok: false, message: isRu() ? 'Введите ключ доступа' : 'Enter access key' };
  }

  if (!window.__RS_STATIC_HOST) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.ok) {
          saveSession(data.token || 'ok_' + Date.now());
          return { ok: true };
        }
        return { ok: false, message: data.message || (isRu() ? 'Неверный ключ' : 'Invalid key') };
      }
    } catch {}
  }

  if (VALID_KEYS.has(code)) {
    saveSession('rs_' + Math.random().toString(36).slice(2));
    return { ok: true };
  }
  return { ok: false, message: isRu() ? 'Неверный ключ доступа' : 'Invalid access key' };
}

function setLocked(locked) {
  document.documentElement.classList.toggle('rs-locked', locked);
  const gate = document.getElementById('rsGate');
  if (gate) gate.hidden = !locked;
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
    saved = raw === null ? true : raw === '1';
  } catch {}
  setAudioOnlyMode(saved, false);

  document.getElementById('rsStealthAudioToggle')?.addEventListener('click', () => {
    setAudioOnlyMode(!window.__RS_AUDIO_ONLY, true);
  });
}

// === Stealth 2: Tab Cloak (Маскировка заголовка и фавиконки) ===
const ORIG_TITLE = document.title;
const CLOAK_TITLE = 'Google Документы — Рабочий конспект';
const CLOAK_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#8ab4f8" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  );
let origFavicons = null;

function setTabCloak(on) {
  try { localStorage.setItem(CLOAK_KEY, on ? '1' : '0'); } catch {}
  const btn = document.getElementById('rsCloakBtn');
  if (btn) {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
  }
  if (!origFavicons) {
    origFavicons = [...document.querySelectorAll('link[rel*="icon"]')].map((l) => ({
      el: l,
      href: l.href
    }));
  }
  if (on) {
    document.title = CLOAK_TITLE;
    origFavicons.forEach((item) => { item.el.href = CLOAK_ICON; });
  } else {
    document.title = ORIG_TITLE;
    origFavicons.forEach((item) => { item.el.href = item.href; });
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

  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.code === 'KeyX' || e.key.toLowerCase() === 'x')) {
      e.preventDefault();
      const active = document.getElementById('rsCloakBtn')?.classList.contains('on');
      setTabCloak(!active);
    }
  });
}

// === Плавный скролл к гайдам ===
function initGuideScrollFix() {
  document.querySelectorAll('[data-guide]').forEach((btn) => {
    btn.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const sec = document.getElementById('rsGuides');
        if (sec) {
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          sec.classList.add('rs-highlight');
          setTimeout(() => sec.classList.remove('rs-highlight'), 1400);
        }
      },
      true
    );
  });
}

// === Тест звука ===
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
    if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
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
      text.textContent = activeStream.getAudioTracks()[0]?.label || 'Audio input';

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
  initAudioTester();
  initStealthAudioToggle();

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession();
    setLocked(true);
  }, true);

  const status = await checkAuthStatus();
  setLocked(!status.authenticated);

  const form = document.getElementById('rsGateForm');
  const input = document.getElementById('rsGateCode');
  const errEl = document.getElementById('rsGateErr');

  input?.addEventListener('input', () => {
    if (errEl) errEl.textContent = '';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await performLogin(input?.value);
    if (res.ok) {
      setLocked(false);
      if (input) input.value = '';
    } else {
      if (errEl) errEl.textContent = res.message;
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
    }
  });
}

bootstrap();
