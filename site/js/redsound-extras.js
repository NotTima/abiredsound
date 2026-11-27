// ABI RedSound — Soundboard, Tactical Guides, Luck Detector & Red Alert HUD
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

const LUCK_LINES_RU = [
  { pct: 94, title: 'КРАСНЫЙ СИГНАЛ!', msg: 'Чайник или Лев уже дышат тебе в спину. Проверяй слоты 2×2 — не пропусти звук фарфора!', sound: 'audio/Prop_Acc_Teapot_UP.ogg' },
  { pct: 81, title: 'ГОРЯЧИЙ ЛУТ', msg: 'Торговец сегодня щедрый: высокий шанс поймать золотую цепь или часы.', sound: 'audio/Item_GoldChain_Up.ogg' },
  { pct: 63, title: 'НОРМАЛЬНЫЙ РЕЙД', msg: 'Золотишко будет, но придётся дёрнуть груз пару раз для двойного сигнала Up + Down.', sound: 'audio/Item_Coin_Up.ogg' },
  { pct: 42, title: 'ОСТОРОЖНО: СКАМ', msg: 'Слышишь звон пластика и бумаги? Торговец пытается впарить мыло по цене видеокарты.', sound: 'audio/Prop_Acc_Plastic_Small_UP.ogg' },
  { pct: 17, title: 'КРИТИЧЕСКИЙ ГОЛЯК', msg: 'Дикие всё вынесли до тебя. Но кто не рискует — тот не лутает красный в 3×2!', sound: 'audio/Item_Misc_Small_Paper_Up.ogg' },
  { pct: 99, title: 'ДЖЕКПОТ ARENA BREAKOUT', msg: 'Максимальная частота RedSound! Секретный документ на подходе — вкл. звук на максимум!', sound: 'audio/Prop_Acc_Statue_UP.ogg' }
];

const LUCK_LINES_EN = [
  { pct: 94, title: 'RED SIGNAL DETECTED!', msg: 'A Teapot or Golden Lion is breathing down your neck. Check 2×2 slots and listen for porcelain!', sound: 'audio/Prop_Acc_Teapot_UP.ogg' },
  { pct: 81, title: 'HOT CARGO', msg: 'The Field Merchant feels generous today: high odds for Gold Chain or Clock.', sound: 'audio/Item_GoldChain_Up.ogg' },
  { pct: 63, title: 'SOLID RAID', msg: 'Good profit ahead — remember to drag the cargo slightly to trigger both Pickup & Drop sounds.', sound: 'audio/Item_Coin_Up.ogg' },
  { pct: 42, title: 'SCAM ALERT', msg: 'Hearing light plastic and paper? The merchant is trying to sell junk at GPU prices.', sound: 'audio/Prop_Acc_Plastic_Small_UP.ogg' },
  { pct: 17, title: 'DRY RUN', msg: 'Scavs looted everything before you. Still, one cheeky 3×2 check never hurts!', sound: 'audio/Item_Misc_Small_Paper_Up.ogg' },
  { pct: 99, title: 'REDSOUND JACKPOT', msg: 'Peak red-tier resonance! Secret Document vibes detected — crank up your Firefox audio monitor!', sound: 'audio/Prop_Acc_Statue_UP.ogg' }
];

let currentAudio = null;
const soundToggleState = new Map();

function isRu() {
  return document.documentElement.lang !== 'en';
}

function playSoundFile(url, btn) {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    document.querySelectorAll('.rs-pad.playing').forEach(el => el.classList.remove('playing'));
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
  grid.innerHTML = SOUNDS.map(s => `
    <button type="button" class="rs-pad" data-id="${s.id}" title="${ru ? 'Клик: поднять / положить звук' : 'Click: alternate Up / Down sound'}">
      <span class="rs-pad-tag">${s.tag}</span>
      <span class="rs-pad-name">${ru ? s.ru : s.en}</span>
      <span class="rs-pad-mode">UP / DOWN</span>
    </button>
  `).join('');

  grid.querySelectorAll('.rs-pad').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const item = SOUNDS.find(x => x.id === id);
      if (!item) return;
      const nextDown = !!soundToggleState.get(id);
      soundToggleState.set(id, !nextDown);
      const modeEl = btn.querySelector('.rs-pad-mode');
      if (modeEl) modeEl.textContent = nextDown ? '▼ DROP' : '▲ PICKUP';
      playSoundFile(nextDown ? item.down : item.up, btn);
    });
  });
}

function initLuckDetector() {
  const btn = document.getElementById('rsLuckBtn');
  const out = document.getElementById('rsLuckResult');
  if (!btn || !out) return;

  btn.addEventListener('click', () => {
    const list = isRu() ? LUCK_LINES_RU : LUCK_LINES_EN;
    const pick = list[Math.floor(Math.random() * list.length)];
    out.hidden = false;
    out.classList.remove('pop');
    void out.offsetWidth;
    out.classList.add('pop');
    out.innerHTML = `
      <div class="rs-luck-meter">
        <span class="rs-luck-pct">${pick.pct}%</span>
        <div class="rs-luck-bar"><i style="width:${pick.pct}%"></i></div>
      </div>
      <div class="rs-luck-text">
        <b>${pick.title}</b>
        <p>${pick.msg}</p>
      </div>
    `;
    playSoundFile(pick.sound);
  });
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
initLuckDetector();
initRedAlert();
initBrandEasterEgg();

// Re-render soundboard labels if language switches
const langSwitch = document.querySelector('[data-lang-switch]');
if (langSwitch) {
  langSwitch.addEventListener('click', () => setTimeout(renderSoundboard, 50));
}
