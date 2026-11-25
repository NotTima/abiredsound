# ABI Merchant — что собрано и что доделать

Дата: 25.11.2026. Цель: своя рабочая копия функционала abiear.ru (слушать игру → показывать предметы у торговца).

---

## 1. Что уже есть

### 1.1 Полная копия сайта — папка `site/`
Снято из HAR-дампа живой сессии. 149 файлов, 2.2 МБ:

| Что | Где |
|---|---|
| HTML приложения | `site/index.html` |
| Весь JS-код (36 файлов) | `site/js/` |
| CSS | `site/css/` |
| **Все 65 звуковых шаблонов** (pickup/drop) | `site/audio/*.ogg` |
| Картинки карт, постеры | `site/img/` |
| Ответы API (снапшоты) | `site/api/catalog`, `site/api/device`, `site/api/report/access`, `site/api/sync/push` |
| QR-библиотека | `site/vendor/qrcode/qrcode.mjs` |

### 1.2 Локальный сервер — `server.js`
Отдаёт `site/` и проксирует `/api/*` на `https://abiear.ru` (подставляя cookie).
Запуск:
```
cd /home/tima/Проекты/abiproject
node server.js
# открыть http://localhost:8080/index.html в Chrome
```
Проверено: `index.html` 200, `js/main.js` 200, `audio/*.ogg` 200, `/api/session` проксируется.

### 1.3 Деобфусцированный код — папка `deob/`
Все 36 файлов прогнаны через свой декодер строкового массива (`deobf_all.js`).
Читаемость частичная: имена свойств местами «плывут» (`a0['.wav']` вместо `a0['map']`), но логика видна.
Исходники без обфускации: `logout.js`, `m15c900.js`, `m276188.js`, `m3738f9.js`, `m600e70.js`, `m7d35f4.js`, `mc0aaf4.js`, `me3169b.js`, `mobile.js`, `model-core.js`.

### 1.4 Разведка и инструменты
- `_scrape/` — лендинг, гейт, мобилка, публичные JS/CSS, `sitemap.xml`, `robots.txt`.
- `_scrape/strings.txt` — 427 расшифрованных строк `gate.js` (карта API авторизации).
- `_scrape/deob.js`, `deobf_all.js` — декодеры обфускации.
- `unhar.py`, `unhar_all.py` — распаковка HAR.
- `hz.md` — сохранённая страница гайда (не нужна для ядра).

---

## 2. Архитектура (восстановлена по коду)

Статика на nginx, ванильный JS (ES-модули), обфускация `javascript-obfuscator`.
Приложение закрыто на сервере: `/index.html`, `/js/*.js` → 401 без cookie.

### Модули ядра
| Файл | Роль |
|---|---|
| `js/main.js` | оркестратор UI, карты/режимы, состояние |
| `js/m1a0fa4.js` | **AudioEngine**: `getDisplayMedia`, AudioWorklet, загрузка шаблонов |
| `js/m7d35f4.js` | Worker: буфер Int16 16 кГц, обмен с NCC-детектором |
| `js/m600e70.js` | `NccDetector`, `prepareTemplate` |
| `js/m15c900.js` | `useWasm` (подключение `engine.wasm`) |
| `js/m0a958a.js` | `GridTracker`, `cargoAt`, `lightArea` — сетка груза по видео |
| `js/mb44042.js` | `LabelReader` — чтение подписей/цен |
| `js/me9d808.js` | `TopWatch`, `matchTop`, `snapshot`, `jpeg` — кадры, верхняя панель |
| `js/mf9f6d6.js` | `TooltipReader` — тултипы |
| `js/m3d35d3.js` | `MerchantModel`, `RARITY`, `summarize`, `turns` — шансы и окупаемость |
| `js/m322f13.js` | `classify`, `store`, `KEYS`, `DEFAULTS`, `mapNameOf` — настройки |
| `js/md87705.js` | `RemoteModel` — модель с сервера |
| `js/mbdf1ff.js` | `startTelemetry` |
| `js/model-core.js` | геометрия груза, `summarize` (EV, цена, профит) |

### Пайплайн
1. `navigator.mediaDevices.getDisplayMedia({video, audio})` — захват **окна игры** (видео для UI, аудио для звуков).
2. Аудио: AudioWorklet `blob` → даунсэмпл в Int16 16 кГц → Worker → NCC (нормированная взаимная корреляция) по шаблонам `pickup`/`drop` → id предмета.
3. Видео: снимки кадра → `TopWatch`/`GridTracker`/`LabelReader` → сетка груза, цены.
4. `MerchantModel` + `summarize` → шансы на «красное», EV, окупаемость.

### Ключевые константы
- `AudioContext({sampleRate: 48000, latencyHint: 'interactive'})`
- `floorDb = -70`
- шаблоны: `{id, pickup, drop}` → `/audio/<name>.ogg`, сводятся в моно (`mixdown`)

### API
| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/session` | проверка сессии |
| POST | `/api/login` | `{key, os, mobile, dev}` |
| POST | `/api/logout` | выход |
| GET | `/api/catalog` | каталог предметов |
| POST | `/api/finds` | красные находки (`{item, v, x}`) |
| POST | `/api/report`, `/api/report/done` | репорты |
| GET | `/api/mod`, `/api/pin`, `/api/tel`, `/api/dev`, `/api/fin` | модель, пин, телеметрия, устройство, фидбек |

Ошибки логина: `invalid` (ключ не подошёл), `locked` + `retryAfter` (429, ~5 попыток / 2 мин), `busy`.
`dev` — отпечаток из `device-key.js` (IndexedDB `me-device`), `os` — `Windows 11`/`Windows 10`/`null`.

---

## 3. Что НЕ работает / чего нет

1. **`site/js/engine.wasm` отсутствует** — в HAR не попал (грузился из воркера), по cookie отдаётся 401.
   В `m7d35f4.js` есть JS-фолбэк: `compileStreaming(...).catch(() => false)`, поэтому без wasm приложение должно работать медленнее, но работать.
2. **Сессия мертва.** Cookie `me_session` из DevTools сервер уже не принимает (`/api/session` → `{"ok":false}`), вероятно привязка к отпечатку/UA. Ключ `PAID-6BDT-F7HG-B7R8` тоже отдавал `invalid`.
3. `/api/catalog` в снапшоте — один срез, не полный каталог.

---

## 4. Что доделать (по шагам)

1. **Достать `engine.wasm`**: в браузере на живой сессии DevTools → Network → фильтр `wasm` → F5 → правый клик → Copy response → сохранить в `site/js/engine.wasm`. Если не появится — Sources → `js/engine.wasm`.
2. **Обновить снапшоты API**: с живой сессии сохранить актуальные `/api/catalog` и `/api/mod` в `site/api/`.
3. **Оживить сессию**: получить новый ключ у `@abiear_bot`, залогиниться, взять свежую cookie, вписать в `const COOKIE` в `server.js`.
4. **Проверить запуск**: `node server.js` → `http://localhost:8080/index.html` → «Слушать игру» → выбрать окно игры. Убедиться, что детектор ловит `pickup`/`drop`.
5. **Довести деобфускацию**: прогнать `core/*.js` через `webcrack` (уже установлен в `node_modules`):
   ```
   ./node_modules/.bin/webcrack core/m1a0fa4.js -o wc/audio
   ```
   Цель — читаемый код вместо `deob/`.
6. **Свой бэкенд** (когда надоест прокси): `POST /api/login` (ключи), `GET /api/catalog`, `POST /api/finds`. Формат ответов — по снапшотам в `site/api/`.
7. **Свои ключи**: таблица ключей (срок, привязка к `dev`, лимит устройств), выдача через Telegram-бота.

---

## 5. Правовая заметка
Код и звуки принадлежат автору abiear.ru. Для своей копии нужно: свой домен, свои ключи и бэкенд; ассеты (звуки/картинки) — либо оставить как есть, либо перезаписать.
