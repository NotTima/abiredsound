// ABI RedSound — Soundboard, Catalog Explorer (189 items), Red Alert HUD & Easter Egg
const SOUNDS = [
  { id: 'teapot', ru: 'Чайник', en: 'Teapot', tag: 'RED', up: 'audio/Prop_Acc_Teapot_UP.ogg', down: 'audio/Prop_Acc_Teapot_Down.ogg' },
  { id: 'goldchain', ru: 'Золотая цепь', en: 'Gold Chain', tag: 'GOLD', up: 'audio/Item_GoldChain_Up.ogg', down: 'audio/Item_GoldChain_Down.ogg' },
  { id: 'statue', ru: 'Статуя / Лев', en: 'Statue / Lion', tag: 'RED', up: 'audio/Prop_Acc_Statue_UP.ogg', down: 'audio/Prop_Acc_Statue_Down.ogg' },
  { id: 'clock', ru: 'Часы', en: 'Clock', tag: 'GOLD', up: 'audio/Prop_Acc_Clock_UP.ogg', down: 'audio/Prop_Acc_Clock_Down.ogg' },
  { id: 'radio', ru: 'Радио', en: 'Radio', tag: 'TECH', up: 'audio/Prop_Acc_Radio_UP.ogg', down: 'audio/Prop_Acc_Radio_Down.ogg' },
  { id: 'pc', ru: 'Электроника', en: 'PC / Module', tag: 'TECH', up: 'audio/Prop_Acc_PC_UP.ogg', down: 'audio/Prop_Acc_PC_Down.ogg' },
  { id: 'coin', ru: 'Монета', en: 'Coin', tag: 'LOOT', up: 'audio/Item_Coin_Up.ogg', down: 'audio/Item_Coin_Down.ogg' },
  { id: 'fuel', ru: 'Канистра', en: 'Fuel Can', tag: 'HEAVY', up: 'audio/Prop_Acc_Fuel_UP.ogg', down: 'audio/Prop_Acc_Fuel_Down.ogg' },
  { id: 'battery', ru: 'Батарея', en: 'Battery', tag: 'TECH', up: 'audio/Prop_Acc_Battery_Small_UP_01.ogg', down: 'audio/Prop_Acc_Battery_Small_Down_01.ogg' },
  { id: 'glass', ru: 'Стекло / Ваза', en: 'Glass / Vase', tag: 'RED', up: 'audio/Item_Glass_Up.ogg', down: 'audio/Item_Glass_Down.ogg' }
];

const RARITY_META = {
  6: { label: 'RED', cls: 'r-6' },
  5: { label: 'GOLD', cls: 'r-5' },
  4: { label: 'PURPLE', cls: 'r-4' },
  3: { label: 'BLUE', cls: 'r-3' },
  1: { label: 'COMMON', cls: 'r-1' }
};

let currentAudio = null;
const soundToggleState = new Map();

function isRu() {
  return document.documentElement.lang !== 'en';
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtPrice(n) {
  return new Intl.NumberFormat(isRu() ? 'ru-RU' : 'en-US').format(Math.round(n || 0));
}

function playSoundFile(url, btn) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    document.querySelectorAll('.rs-pad.playing, .rs-cat-play.playing').forEach((el) => el.classList.remove('playing'));
    const audio = new Audio(url);
    audio.volume = 0.7;
    currentAudio = audio;
    if (btn) btn.classList.add('playing');
    audio.addEventListener('ended', () => btn?.classList.remove('playing'));
    audio.play().catch(() => {});
  } catch {}
}

function renderSoundboard() {
  const grid = document.getElementById('rsSoundboardGrid');
  if (!grid) return;
  const ru = isRu();
  grid.innerHTML = SOUNDS.map(
    (s) => `
    <button type="button" class="rs-pad" data-id="${s.id}" title="${ru ? 'Клик: поднять / положить звук' : 'Click: alternate Up / Down sound'}">
      <span class="rs-pad-tag">${s.tag}</span>
      <span class="rs-pad-name">${ru ? s.ru : s.en}</span>
      <span class="rs-pad-mode">UP / DOWN</span>
    </button>
  `
  ).join('');

  grid.querySelectorAll('.rs-pad').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = SOUNDS.find((x) => x.id === id);
      if (!item) return;
      const nextDown = !!soundToggleState.get(id);
      soundToggleState.set(id, !nextDown);
      const modeEl = btn.querySelector('.rs-pad-mode');
      if (modeEl) modeEl.textContent = nextDown ? '▼ DROP' : '▲ PICKUP';
      playSoundFile(nextDown ? item.down : item.up, btn);
    });
  });
}

async function initCatalogExplorer() {
  const listEl = document.getElementById('rsCatList');
  const searchEl = document.getElementById('rsCatSearch');
  const filtersEl = document.getElementById('rsCatFilters');
  if (!listEl || !searchEl || !filtersEl) return;

  let items = [];
  let soundMap = new Map();
  let activeRarity = 'all';

  try {
    const res = await fetch('api/catalog');
    const data = await res.json();
    items = (data.items || []).slice().sort((a, b) => (b.rarity - a.rarity) || (b.referencePrice - a.referencePrice));
    for (const s of data.sounds || []) {
      soundMap.set(s.id, s);
    }
  } catch {
    listEl.innerHTML = `<div class="empty">${isRu() ? 'Не удалось загрузить каталог' : 'Failed to load catalog'}</div>`;
    return;
  }

  const render = () => {
    const q = searchEl.value.trim().toLowerCase();
    const filtered = items.filter((it) => {
      if (activeRarity !== 'all' && String(it.rarity) !== activeRarity) return false;
      if (!q) return true;
      const sz = `${it.size?.[0]}x${it.size?.[1]}`;
      const szAlt = `${it.size?.[0]}×${it.size?.[1]}`;
      return (
        it.name.toLowerCase().includes(q) ||
        (it.categoryName || '').toLowerCase().includes(q) ||
        sz.includes(q) ||
        szAlt.includes(q)
      );
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty">${isRu() ? 'Ничего не найдено' : 'No matching items'}</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .slice(0, 80)
      .map((it) => {
        const rm = RARITY_META[it.rarity] || RARITY_META[1];
        const sz = `${it.size?.[0] || 1}×${it.size?.[1] || 1}`;
        const snd = it.soundId ? soundMap.get(it.soundId) : null;
        const playBtn = snd
          ? `<button type="button" class="rs-cat-play" data-sound="audio/${esc(snd.pickup)}.ogg" title="${isRu() ? 'Послушать звук' : 'Play sound'}"><svg class="i"><use href="#i-play"/></svg></button>`
          : '';
        return `
          <div class="rs-cat-row ${rm.cls}">
            <img class="rs-cat-img" src="${esc(it.iconUrl)}" alt="" loading="lazy">
            <div class="rs-cat-info">
              <div class="rs-cat-name">${esc(it.name)}</div>
              <div class="rs-cat-meta">
                <span class="rs-cat-tag">${rm.label}</span>
                <span>${sz}</span>
                <span>${esc(it.categoryName || '')}</span>
              </div>
            </div>
            <div class="rs-cat-prices">
              <b>${fmtPrice(it.referencePrice)}</b>
              <small>${isRu() ? 'торг:' : 'merch:'} ${fmtPrice(it.contactPrice)}</small>
            </div>
            ${playBtn}
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.rs-cat-play').forEach((b) => {
      b.addEventListener('click', () => playSoundFile(b.dataset.sound, b));
    });
  };

  searchEl.addEventListener('input', render);
  filtersEl.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      filtersEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
      chip.classList.add('on');
      activeRarity = chip.dataset.rarity || 'all';
      render();
    });
  });

  render();
}

function initRedAlert() {
  const btn = document.getElementById('rsAlertBtn');
  if (!btn) return;
  const key = 'redsound.alert';
  const apply = (on) => {
    document.documentElement.classList.toggle('red-alert', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('on', on);
  };
  let saved = false;
  try { saved = localStorage.getItem(key) === '1'; } catch {}
  apply(saved);

  btn.addEventListener('click', () => {
    const next = !document.documentElement.classList.contains('red-alert');
    apply(next);
    try { localStorage.setItem(key, next ? '1' : '0'); } catch {}
    if (next) playSoundFile('audio/Item_Coin_Up.ogg');
  });
}

function initBrandEasterEgg() {
  const brand = document.querySelector('.rs-author');
  if (!brand) return;
  let clicks = 0;
  brand.addEventListener('click', () => {
    clicks++;
    if (clicks % 3 === 0) {
      playSoundFile('audio/Prop_Acc_Teapot_UP.ogg');
      brand.classList.add('flash');
      setTimeout(() => brand.classList.remove('flash'), 700);
    }
  });
}

renderSoundboard();
initCatalogExplorer();
initRedAlert();
initBrandEasterEgg();

const langSwitch = document.querySelector('[data-lang-switch]');
if (langSwitch) {
  langSwitch.addEventListener('click', () => setTimeout(() => { renderSoundboard(); }, 50));
}
