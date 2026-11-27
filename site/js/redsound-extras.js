// ABI RedSound — Soundboard, Slot & Loot Catalog Explorer (189 items, 38 sounds), Red Alert HUD & Easter Egg
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

function shortSoundName(pickupName) {
  return String(pickupName || '')
    .replace(/^(Item_Misc_|Item_|Prop_Acc_)/, '')
    .replace(/_(UP_01|Up_01|UP|Up)$/i, '')
    .replace(/_/g, ' ');
}

function playSoundFile(url, btn) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    document.querySelectorAll('.rs-pad.playing, .rs-cat-play.playing').forEach((el) => el.classList.remove('playing'));
    const audio = new Audio(url);
    audio.volume = 0.75;
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
  const sortEl = document.getElementById('rsCatSort');
  const filtersEl = document.getElementById('rsCatFilters');
  const sizesEl = document.getElementById('rsCatSizes');
  const soundEl = document.getElementById('rsCatSound');
  const soundPlayBtn = document.getElementById('rsCatSoundPlay');
  const resetBtn = document.getElementById('rsCatReset');
  const countEl = document.getElementById('rsCatCount');
  if (!listEl || !searchEl || !filtersEl || !sizesEl || !soundEl) return;

  let items = [];
  let sounds = [];
  let soundByPickup = new Map();
  let activeRarity = 'all';
  let activeSize = 'all';
  let activeSound = 'all';
  let previewToggle = false;

  try {
    const res = await fetch('api/catalog');
    const data = await res.json();
    items = data.items || [];
    sounds = data.sounds || [];
    for (const s of sounds) {
      soundByPickup.set(s.pickup, s);
    }

    // Populate sound dropdown with all 38 sounds + item count
    const counts = new Map();
    for (const it of items) {
      if (it.pickupSound) counts.set(it.pickupSound, (counts.get(it.pickupSound) || 0) + 1);
    }
    const sortedSounds = sounds
      .slice()
      .sort((a, b) => (counts.get(b.pickup) || 0) - (counts.get(a.pickup) || 0));

    for (const s of sortedSounds) {
      const cnt = counts.get(s.pickup) || 0;
      const opt = document.createElement('option');
      opt.value = s.pickup;
      opt.textContent = `${shortSoundName(s.pickup)} (${cnt})`;
      soundEl.appendChild(opt);
    }
  } catch {
    listEl.innerHTML = `<div class="empty">${isRu() ? 'Не удалось загрузить каталог' : 'Failed to load catalog'}</div>`;
    return;
  }

  const sortItems = (arr) => {
    const mode = sortEl?.value || 'rarity_desc';
    const ru = isRu();
    return arr.slice().sort((a, b) => {
      if (mode === 'price_desc') return (b.referencePrice || 0) - (a.referencePrice || 0);
      if (mode === 'price_asc') return (a.referencePrice || 0) - (b.referencePrice || 0);
      if (mode === 'merch_desc') return (b.contactPrice || 0) - (a.contactPrice || 0);
      if (mode === 'name_asc') {
        const na = (ru ? a.nameRu || a.name : a.name) || '';
        const nb = (ru ? b.nameRu || b.name : b.name) || '';
        return na.localeCompare(nb, ru ? 'ru' : 'en');
      }
      return (b.rarity - a.rarity) || ((b.referencePrice || 0) - (a.referencePrice || 0));
    });
  };

  const render = () => {
    const ru = isRu();
    const q = searchEl.value.trim().toLowerCase();
    const filtered = sortItems(
      items.filter((it) => {
        if (activeRarity !== 'all' && String(it.rarity) !== activeRarity) return false;
        const sz = `${it.size?.[0] || 1}x${it.size?.[1] || 1}`;
        if (activeSize !== 'all' && sz !== activeSize) return false;
        if (activeSound !== 'all' && it.pickupSound !== activeSound) return false;
        if (!q) return true;
        const szAlt = `${it.size?.[0] || 1}×${it.size?.[1] || 1}`;
        return (
          (it.name || '').toLowerCase().includes(q) ||
          (it.nameRu || '').toLowerCase().includes(q) ||
          (it.categoryName || '').toLowerCase().includes(q) ||
          shortSoundName(it.pickupSound).toLowerCase().includes(q) ||
          sz.includes(q) ||
          szAlt.includes(q)
        );
      })
    );

    if (countEl) {
      countEl.textContent = `${filtered.length} / ${items.length}`;
    }

    if (soundPlayBtn) {
      soundPlayBtn.disabled = activeSound === 'all';
    }

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty">${ru ? 'Нет предметов с такими параметрами' : 'No matching items'}</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((it) => {
        const rm = RARITY_META[it.rarity] || RARITY_META[1];
        const sz = `${it.size?.[0] || 1}×${it.size?.[1] || 1}`;
        const title = ru ? it.nameRu || it.name : it.name;
        const subName = ru && it.nameRu ? ` <span class="rs-cat-en">(${esc(it.name)})</span>` : '';
        const sndLabel = shortSoundName(it.pickupSound);
        const upUrl = it.pickupSound ? `audio/${esc(it.pickupSound)}.ogg` : '';
        const downUrl = it.dropSound ? `audio/${esc(it.dropSound)}.ogg` : upUrl;
        return `
          <div class="rs-cat-row ${rm.cls}">
            <img class="rs-cat-img" src="${esc(it.iconUrl)}" alt="${esc(title)}" loading="lazy">
            <div class="rs-cat-info">
              <div class="rs-cat-name">${esc(title)}${subName}</div>
              <div class="rs-cat-meta">
                <span class="rs-cat-tag">${rm.label}</span>
                <span>${sz}</span>
                <span title="${esc(it.pickupSound || '')}">${esc(sndLabel)}</span>
              </div>
            </div>
            <div class="rs-cat-prices">
              <b>${fmtPrice(it.referencePrice)}</b>
              <small>${ru ? 'торг:' : 'merch:'} ${fmtPrice(it.contactPrice)}</small>
            </div>
            ${
              upUrl
                ? `<button type="button" class="rs-cat-play" data-up="${upUrl}" data-down="${downUrl}" title="${ru ? 'Клик: Up / Down звук' : 'Click: Up / Down sound'}"><svg class="i"><use href="#i-play"/></svg></button>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.rs-cat-play').forEach((b) => {
      b.addEventListener('click', () => {
        const nextDown = b.dataset.state === 'down';
        b.dataset.state = nextDown ? 'up' : 'down';
        playSoundFile(nextDown ? b.dataset.down : b.dataset.up, b);
      });
    });
  };

  searchEl.addEventListener('input', render);
  sortEl?.addEventListener('change', render);

  filtersEl.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      filtersEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
      chip.classList.add('on');
      activeRarity = chip.dataset.rarity || 'all';
      render();
    });
  });

  sizesEl.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      sizesEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
      chip.classList.add('on');
      activeSize = chip.dataset.size || 'all';
      render();
    });
  });

  soundEl.addEventListener('change', () => {
    activeSound = soundEl.value || 'all';
    previewToggle = false;
    render();
  });

  soundPlayBtn?.addEventListener('click', () => {
    if (activeSound === 'all') return;
    const s = soundByPickup.get(activeSound);
    if (!s) return;
    previewToggle = !previewToggle;
    const url = previewToggle ? `audio/${s.pickup}.ogg` : `audio/${s.drop}.ogg`;
    playSoundFile(url, soundPlayBtn);
  });

  resetBtn?.addEventListener('click', () => {
    searchEl.value = '';
    activeRarity = 'all';
    activeSize = 'all';
    activeSound = 'all';
    soundEl.value = 'all';
    if (sortEl) sortEl.value = 'rarity_desc';
    filtersEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.rarity === 'all'));
    sizesEl.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.size === 'all'));
    render();
  });

  render();
  window.__rsCatalogRender = render;
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
  langSwitch.addEventListener('click', () =>
    setTimeout(() => {
      renderSoundboard();
      window.__rsCatalogRender?.();
    }, 50)
  );
}
