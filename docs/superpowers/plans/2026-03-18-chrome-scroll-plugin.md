# Chrome Auto-Scroll Plugin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that smoothly auto-scrolls any web page over a user-specified MM:SS duration, with a fixed top bar overlay showing countdown, progress, and Pause/Resume/Stop controls.

**Architecture:** The popup collects a MM:SS duration and sends a `start` message to the content script. The content script runs a `requestAnimationFrame` loop that interpolates scroll position from elapsed time (not from position), and injects a fixed top bar overlay with live controls. All state lives in the content script. Pure math functions are extracted and tested with Jest; DOM/Chrome API code is tested manually.

**Tech Stack:** Vanilla JS (no ES modules, no build step), Chrome Extension Manifest V3, Jest 29 (dev dependency for unit tests only)

---

## File Map

| File | Responsibility |
|---|---|
| `manifest.json` | MV3 manifest: popup, content script injection, permissions |
| `package.json` | devDependencies: jest only |
| `scripts/generate-icons.js` | Node script that writes valid PNG icons with no external deps |
| `icons/icon16.png` | 16x16 extension icon (purple solid) |
| `icons/icon48.png` | 48x48 extension icon |
| `icons/icon128.png` | 128x128 extension icon |
| `popup/popup.html` | Popup shell: MM:SS input, Avvia button, inline error area |
| `popup/popup.css` | Dark theme styles (background `#16213e`, accent `#a78bfa`) |
| `popup/popup.js` | `parseMMSS`, `formatMMSS` (pure, exported for tests) + Chrome interaction code |
| `content/content.js` | `calculateProgress`, `formatMMSS` (pure, exported for tests) + overlay management + rAF scroll engine + message listener |
| `content/content.css` | Fixed top bar overlay styles (z-index max, slide-in transition) |
| `tests/popup.test.js` | Jest tests for `parseMMSS` and `formatMMSS` from popup.js |
| `tests/content.test.js` | Jest tests for `calculateProgress` and `formatMMSS` from content.js |

---

## Task 1: Project scaffold, manifest, icons

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `scripts/generate-icons.js`
- Create: `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`
- Create empty shells: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`, `content/content.js`, `content/content.css`, `tests/popup.test.js`, `tests/content.test.js`
- Create: `.gitignore`

---

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chrome-scroll-plugin",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Auto Scroll",
  "version": "1.0",
  "description": "Automatically scroll any page at your chosen speed",
  "permissions": ["activeTab", "scripting"],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/content.css"]
    }
  ]
}
```

- [ ] **Step 4: Create `scripts/generate-icons.js`**

Generates minimal valid PNG files using only Node built-ins (no external deps):

```js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function uint32BE(n) {
  return Buffer.from([(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
}

function crc32(buf) {
  const table = [];
  for (let i = 0; i < 256; i++) {
    let v = i;
    for (let j = 0; j < 8; j++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    table[i] = v;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  const crcBuf = Buffer.concat([typeBytes, data]);
  return Buffer.concat([uint32BE(data.length), typeBytes, data, uint32BE(crc32(crcBuf))]);
}

function createPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([
    uint32BE(size), uint32BE(size),
    Buffer.from([8, 2, 0, 0, 0])
  ]));
  const rowBytes = 1 + size * 3;
  const raw = Buffer.alloc(size * rowBytes);
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * rowBytes + 1 + x * 3;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b;
    }
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

const iconsDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

[16, 48, 128].forEach(size => {
  // #a78bfa = RGB(167, 139, 250) — matches the accent color used in popup and overlay
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), createPNG(size, 167, 139, 250));
  console.log('Created icon' + size + '.png');
});
```

- [ ] **Step 5: Generate icons**

Run: `node scripts/generate-icons.js`
Expected:
```
Created icon16.png
Created icon48.png
Created icon128.png
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
.superpowers/
```

- [ ] **Step 7: Create empty shell files**

Create these as empty files (just create the file — content added in later tasks):
- `popup/popup.html`
- `popup/popup.css`
- `popup/popup.js`
- `content/content.js`
- `content/content.css`
- `tests/popup.test.js`
- `tests/content.test.js`

- [ ] **Step 8: Load extension in Chrome and verify manifest is valid**

Open `chrome://extensions` → Enable "Developer mode" (top right toggle) → Click "Load unpacked" → Select the project root directory.
Expected: Extension listed with name "Auto Scroll", no errors shown.

- [ ] **Step 9: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold extension with manifest, icons, and empty shells"
```

---

## Task 2: Popup UI

> Note: `content/content.css` (the overlay bar styles) is added in Task 4. Tasks are ordered popup-first so the extension is loadable in Chrome from the start.

**Files:**
- Modify: `popup/popup.html`
- Modify: `popup/popup.css`

---

- [ ] **Step 1: Write `popup/popup.html`**

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="container">
    <div class="header">AUTO SCROLL</div>
    <label class="label" for="duration">DURATA SCROLL</label>
    <input
      id="duration"
      class="duration-input"
      type="text"
      placeholder="MM:SS"
      maxlength="5"
      autocomplete="off"
      spellcheck="false"
    >
    <div class="hint">es. 05:30 = 5 minuti e 30 secondi</div>
    <div id="error" class="error" aria-live="polite"></div>
    <button id="start-btn" class="start-btn">AVVIA</button>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `popup/popup.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  width: 260px;
  background: #16213e;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  padding: 20px;
}

.header {
  font-size: 13px;
  font-weight: 700;
  color: #a78bfa;
  letter-spacing: 1.5px;
  text-align: center;
  margin-bottom: 16px;
}

.label {
  display: block;
  font-size: 10px;
  color: #888;
  letter-spacing: 0.8px;
  margin-bottom: 6px;
}

.duration-input {
  width: 100%;
  background: #0f3460;
  border: 2px solid #a78bfa;
  color: white;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 22px;
  text-align: center;
  font-family: 'Courier New', monospace;
  letter-spacing: 3px;
  outline: none;
  transition: border-color 0.2s;
}

.duration-input:focus { border-color: #c4b5fd; }
.duration-input.invalid { border-color: #f87171; }

.hint {
  font-size: 10px;
  color: #555;
  text-align: center;
  margin-top: 4px;
  margin-bottom: 10px;
}

.error {
  font-size: 11px;
  color: #f87171;
  text-align: center;
  min-height: 16px;
  margin-bottom: 8px;
}

.start-btn {
  width: 100%;
  background: linear-gradient(135deg, #a78bfa, #7c3aed);
  color: white;
  border: none;
  padding: 11px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.start-btn:hover { opacity: 0.9; }
.start-btn:active { opacity: 0.8; }
```

- [ ] **Step 3: Visual check in Chrome**

Reload extension in `chrome://extensions` (click the refresh icon on the extension card). Click the extension toolbar icon.
Expected: Dark popup (260px wide) with label, MM:SS input with violet border, hint text, and violet gradient button.

- [ ] **Step 4: Commit**

```bash
git add popup/popup.html popup/popup.css
git commit -m "feat: add popup UI — dark theme with MM:SS input"
```

---

## Task 3: Popup logic — pure functions + tests + Chrome wiring

**Files:**
- Modify: `popup/popup.js`
- Modify: `tests/popup.test.js`

---

- [ ] **Step 1: Write failing tests in `tests/popup.test.js`**

```js
const { parseMMSS, formatMMSS } = require('../popup/popup.js');

describe('parseMMSS', () => {
  test('parses valid MM:SS to milliseconds', () => {
    expect(parseMMSS('05:30')).toBe(330000);
  });
  test('parses 00:05 — minimum valid duration', () => {
    expect(parseMMSS('00:05')).toBe(5000);
  });
  test('parses 99:59 — maximum', () => {
    expect(parseMMSS('99:59')).toBe(5999000);
  });
  test('returns null for 00:00', () => {
    expect(parseMMSS('00:00')).toBeNull();
  });
  test('returns null for duration under 5 seconds', () => {
    expect(parseMMSS('00:04')).toBeNull();
  });
  test('returns null for letters', () => {
    expect(parseMMSS('ab:cd')).toBeNull();
  });
  test('returns null for missing colon', () => {
    expect(parseMMSS('0530')).toBeNull();
  });
  test('returns null for seconds >= 60', () => {
    expect(parseMMSS('05:60')).toBeNull();
  });
  test('returns null for empty string', () => {
    expect(parseMMSS('')).toBeNull();
  });
});

describe('formatMMSS', () => {
  test('formats ms to MM:SS', () => {
    expect(formatMMSS(330000)).toBe('05:30');
  });
  test('formats 0 to 00:00', () => {
    expect(formatMMSS(0)).toBe('00:00');
  });
  test('pads single digits', () => {
    expect(formatMMSS(5000)).toBe('00:05');
  });
  test('floors partial seconds', () => {
    expect(formatMMSS(5999)).toBe('00:05');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `npm test -- tests/popup.test.js`
Expected: FAIL with "Cannot find module" or "parseMMSS is not a function".

- [ ] **Step 3: Write pure functions in `popup/popup.js`**

```js
/**
 * Parses "MM:SS" string to milliseconds.
 * Returns null if format is invalid or duration < 5000ms.
 */
function parseMMSS(input) {
  if (typeof input !== 'string') return null;
  var match = input.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  var minutes = parseInt(match[1], 10);
  var seconds = parseInt(match[2], 10);
  if (seconds > 59) return null;
  var ms = (minutes * 60 + seconds) * 1000;
  return ms < 5000 ? null : ms;
}

/**
 * Formats milliseconds to "MM:SS" string.
 */
function formatMMSS(ms) {
  var totalSeconds = Math.max(0, Math.floor(ms / 1000));
  var minutes = Math.floor(totalSeconds / 60);
  var seconds = totalSeconds % 60;
  return (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

// Export for Jest (module is undefined in browsers)
if (typeof module !== 'undefined') {
  module.exports = { parseMMSS, formatMMSS };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

Run: `npm test -- tests/popup.test.js`
Expected: All 13 tests PASS.

- [ ] **Step 5: Append Chrome interaction code to `popup/popup.js`**

Add after the `module.exports` block:

```js
// Chrome popup interaction — not executed in Jest (chrome is not defined in Node.js)
if (typeof chrome !== 'undefined' && chrome.tabs) {
  document.addEventListener('DOMContentLoaded', function () {
    var input = document.getElementById('duration');
    var btn = document.getElementById('start-btn');
    var errorEl = document.getElementById('error');

    // Auto-format: insert colon after 2 digits while typing
    input.addEventListener('input', function () {
      var digits = input.value.replace(/\D/g, '');
      if (digits.length >= 3) {
        input.value = digits.slice(0, 2) + ':' + digits.slice(2, 4);
      } else {
        input.value = digits;
      }
      clearError();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btn.click();
    });

    btn.addEventListener('click', function () {
      var durationMs = parseMMSS(input.value);
      if (!durationMs) {
        showError('Formato non valido. Es: 05:30 (minimo 00:05)');
        return;
      }
      btn.disabled = true;
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'start', durationMs: durationMs },
          function (response) {
            if (chrome.runtime.lastError) {
              showError('Impossibile comunicare con la pagina.');
              btn.disabled = false;
              return;
            }
            if (response && response.status === 'started') {
              window.close();
            } else if (response && response.status === 'error') {
              var messages = {
                not_scrollable: 'Pagina non scrollabile.',
                already_running: 'Scroll gia in corso.'
              };
              showError(messages[response.reason] || 'Errore sconosciuto.');
              btn.disabled = false;
            }
          }
        );
      });
    });

    function showError(msg) {
      errorEl.textContent = msg;
      input.classList.add('invalid');
    }

    function clearError() {
      errorEl.textContent = '';
      input.classList.remove('invalid');
    }
  });
}
```

- [ ] **Step 6: Re-run all tests — confirm still passing**

Run: `npm test -- tests/popup.test.js`
Expected: All 13 tests PASS.

- [ ] **Step 7: Manual smoke test**

Reload extension. Click icon. Click "AVVIA" with empty input.
Expected: Red "Formato non valido" error, input border turns red.

Type `0530` — should auto-format to `05:30`.
Expected: Input shows `05:30`.

- [ ] **Step 8: Commit**

```bash
git add popup/popup.js tests/popup.test.js
git commit -m "feat: add popup logic with parseMMSS/formatMMSS tests and Chrome wiring"
```

---

## Task 4: Overlay CSS + content.js pure functions + tests

**Files:**
- Modify: `content/content.css`
- Modify: `content/content.js`
- Modify: `tests/content.test.js`

---

- [ ] **Step 1: Write `content/content.css`**

```css
#autoscroll-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2147483647;
  background: rgba(15, 22, 41, 0.95);
  border-bottom: 2px solid #a78bfa;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 12px;
  backdrop-filter: blur(4px);
  transform: translateY(-100%);
  transition: transform 0.25s ease;
}

#autoscroll-bar.as-visible {
  transform: translateY(0);
}

#autoscroll-label {
  color: #a78bfa;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 1px;
  white-space: nowrap;
}

#autoscroll-progress-track {
  flex: 1;
  height: 4px;
  background: #1e293b;
  border-radius: 2px;
  overflow: hidden;
}

#autoscroll-progress-fill {
  height: 100%;
  width: 0%;
  background: #a78bfa;
  border-radius: 2px;
  transition: width 0.1s linear;
}

#autoscroll-countdown {
  color: white;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: 700;
  min-width: 42px;
  text-align: center;
}

#autoscroll-pause-btn,
#autoscroll-stop-btn {
  border: none;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

#autoscroll-pause-btn {
  background: #334155;
  color: #a78bfa;
  border: 1px solid #a78bfa;
}
#autoscroll-pause-btn:hover { background: #3f4f6a; }

#autoscroll-stop-btn {
  background: #7f1d1d;
  color: white;
}
#autoscroll-stop-btn:hover { background: #991b1b; }
```

- [ ] **Step 2: Write failing tests in `tests/content.test.js`**

```js
const { calculateProgress, formatMMSS } = require('../content/content.js');

describe('calculateProgress', () => {
  test('returns 0 at start', () => {
    expect(calculateProgress(0, 60000)).toBe(0);
  });
  test('returns 0.5 at halfway', () => {
    expect(calculateProgress(30000, 60000)).toBe(0.5);
  });
  test('returns 1.0 at end', () => {
    expect(calculateProgress(60000, 60000)).toBe(1);
  });
  test('clamps to 1.0 past the end', () => {
    expect(calculateProgress(70000, 60000)).toBe(1);
  });
  test('returns 1 when totalDuration is 0', () => {
    expect(calculateProgress(0, 0)).toBe(1);
  });
});

describe('formatMMSS (content)', () => {
  test('formats ms to MM:SS', () => {
    expect(formatMMSS(330000)).toBe('05:30');
  });
  test('clamps negative ms to 00:00', () => {
    expect(formatMMSS(-1000)).toBe('00:00');
  });
  test('floors partial seconds', () => {
    expect(formatMMSS(5999)).toBe('00:05');
  });
});
```

- [ ] **Step 3: Run tests — confirm they fail**

Run: `npm test -- tests/content.test.js`
Expected: FAIL with "Cannot find module".

- [ ] **Step 4: Write pure functions at top of `content/content.js`**

```js
// ─── Pure utility functions (tested with Jest) ─────────────────────────

/**
 * Calculates scroll progress [0.0 to 1.0], clamped.
 * @param {number} elapsed  - ms elapsed, excluding paused time
 * @param {number} totalDuration  - total ms for full page traverse
 * @returns {number}
 */
function calculateProgress(elapsed, totalDuration) {
  if (totalDuration <= 0) return 1;
  return Math.min(1, elapsed / totalDuration);
}

/**
 * Formats milliseconds to "MM:SS". Clamps negative values to 0.
 * @param {number} ms
 * @returns {string}
 */
function formatMMSS(ms) {
  var totalSeconds = Math.max(0, Math.floor(ms / 1000));
  var minutes = Math.floor(totalSeconds / 60);
  var seconds = totalSeconds % 60;
  return (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

// Export for Jest (module is undefined in browsers)
if (typeof module !== 'undefined') {
  module.exports = { calculateProgress, formatMMSS };
}
```

- [ ] **Step 5: Run tests — confirm they pass**

Run: `npm test -- tests/content.test.js`
Expected: All 8 tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All 21 tests PASS (13 popup + 8 content).

- [ ] **Step 7: Commit**

```bash
git add content/content.css content/content.js tests/content.test.js
git commit -m "feat: add overlay CSS and content.js pure functions with tests"
```

---

## Task 5: Scroll engine + overlay injection + message listener

**Files:**
- Modify: `content/content.js`

Add DOM overlay management, the rAF scroll loop, pause/resume/stop, pagehide cleanup, and the Chrome message listener. All code is guarded by `typeof document !== 'undefined'` so tests remain unaffected.

---

- [ ] **Step 1: Append all browser-only code to `content/content.js`**

Add everything below after the `module.exports` block:

```js
// ─── Browser-only code ────────────────────────────────────────────
// Guarded so Jest tests (which have no document/chrome) are unaffected.

if (typeof document !== 'undefined') {

  // ─── Overlay DOM builders ──────────────────────────────────────

  function makeEl(tag, id, styles) {
    var el = document.createElement(tag);
    if (id) el.id = id;
    if (styles) el.setAttribute('style', styles);
    return el;
  }

  function createOverlay() {
    var bar = makeEl('div', 'autoscroll-bar', null);

    var label = makeEl('span', 'autoscroll-label', null);
    label.textContent = 'AUTO SCROLL';

    var track = makeEl('div', 'autoscroll-progress-track', null);
    var fill = makeEl('div', 'autoscroll-progress-fill', null);
    track.appendChild(fill);

    var countdown = makeEl('span', 'autoscroll-countdown', null);
    countdown.textContent = '00:00';

    var pauseBtn = makeEl('button', 'autoscroll-pause-btn', null);
    pauseBtn.textContent = 'Pausa';
    pauseBtn.setAttribute('type', 'button');

    var stopBtn = makeEl('button', 'autoscroll-stop-btn', null);
    stopBtn.textContent = 'Stop';
    stopBtn.setAttribute('type', 'button');

    bar.appendChild(label);
    bar.appendChild(track);
    bar.appendChild(countdown);
    bar.appendChild(pauseBtn);
    bar.appendChild(stopBtn);

    document.body.appendChild(bar);

    // Trigger CSS slide-in transition on next frame
    requestAnimationFrame(function () {
      bar.classList.add('as-visible');
    });

    return bar;
  }

  function removeOverlay() {
    var bar = document.getElementById('autoscroll-bar');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  }

  function updateOverlay(progress, remainingMs, isPaused) {
    var fill = document.getElementById('autoscroll-progress-fill');
    var countdown = document.getElementById('autoscroll-countdown');
    var pauseBtn = document.getElementById('autoscroll-pause-btn');
    if (fill) fill.style.width = (progress * 100).toFixed(1) + '%';
    if (countdown) countdown.textContent = formatMMSS(remainingMs);
    if (pauseBtn) pauseBtn.textContent = isPaused ? 'Riprendi' : 'Pausa';
  }

  // ─── State ────────────────────────────────────────────────────

  var state = {
    status: 'IDLE',    // IDLE | RUNNING | PAUSED
    totalDuration: 0,
    totalHeight: 0,
    startTime: 0,
    elapsedBeforePause: 0,
    pauseStart: 0,
    rafId: null,
    pagehideHandler: null
  };

  // ─── Scroll engine ─────────────────────────────────────────────

  function tick() {
    if (state.status !== 'RUNNING') return;

    var now = performance.now();
    var elapsed = now - state.startTime - state.elapsedBeforePause;
    var progress = calculateProgress(elapsed, state.totalDuration);
    var remainingMs = Math.max(0, state.totalDuration - elapsed);

    window.scrollTo(0, progress * state.totalHeight);
    updateOverlay(progress, remainingMs, false);

    if (progress >= 1 || window.scrollY >= state.totalHeight) {
      stopScroll();
      return;
    }

    state.rafId = requestAnimationFrame(tick);
  }

  function startScroll(durationMs) {
    state.totalHeight = document.body.scrollHeight - window.innerHeight;

    if (state.totalHeight <= 0) {
      return { status: 'error', reason: 'not_scrollable' };
    }
    if (state.status === 'RUNNING' || state.status === 'PAUSED') {
      return { status: 'error', reason: 'already_running' };
    }

    state.status = 'RUNNING';
    state.totalDuration = durationMs;
    state.startTime = performance.now();
    state.elapsedBeforePause = 0;

    createOverlay();
    wirePauseStop();

    state.pagehideHandler = function () { stopScroll(); };
    window.addEventListener('pagehide', state.pagehideHandler);

    state.rafId = requestAnimationFrame(tick);
    return { status: 'started' };
  }

  function pauseScroll() {
    if (state.status !== 'RUNNING') return;
    state.status = 'PAUSED';
    state.pauseStart = performance.now();
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    var elapsed = state.pauseStart - state.startTime - state.elapsedBeforePause;
    updateOverlay(
      calculateProgress(elapsed, state.totalDuration),
      Math.max(0, state.totalDuration - elapsed),
      true
    );
  }

  function resumeScroll() {
    if (state.status !== 'PAUSED') return;
    state.elapsedBeforePause += performance.now() - state.pauseStart;
    state.status = 'RUNNING';
    state.rafId = requestAnimationFrame(tick);
  }

  function stopScroll() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    if (state.pagehideHandler) {
      window.removeEventListener('pagehide', state.pagehideHandler);
      state.pagehideHandler = null;
    }
    state.status = 'IDLE';
    removeOverlay();
  }

  // ─── Overlay button wiring ────────────────────────────────────

  function wirePauseStop() {
    var pauseBtn = document.getElementById('autoscroll-pause-btn');
    var stopBtn = document.getElementById('autoscroll-stop-btn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function () {
        if (state.status === 'RUNNING') pauseScroll();
        else if (state.status === 'PAUSED') resumeScroll();
      });
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', stopScroll);
    }
  }

  // ─── Message listener ─────────────────────────────────────────

  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (message.action === 'start') {
        sendResponse(startScroll(message.durationMs));
      } else if (message.action === 'pause') {
        pauseScroll();
        sendResponse({ status: 'ok' });
      } else if (message.action === 'resume') {
        resumeScroll();
        sendResponse({ status: 'ok' });
      } else if (message.action === 'stop') {
        stopScroll();
        sendResponse({ status: 'ok' });
      }
      return true;
    });
  }

} // end browser-only block
```

- [ ] **Step 2: Re-run full test suite — confirm still passing**

Run: `npm test`
Expected: All 21 tests PASS.

- [ ] **Step 3: Manual integration test — happy path**

Open a long page (e.g. `https://en.wikipedia.org/wiki/Main_Page`). Click extension icon, type `00:30`, click "AVVIA".
Expected:
- Popup closes
- Top bar slides down from the top of the page
- Page scrolls smoothly over 30 seconds
- Progress bar fills left-to-right
- Countdown decreases from `00:30` to `00:00`
- Bar disappears when the bottom is reached

- [ ] **Step 4: Manual test — Pause and Resume**

Start a 30-second scroll. After a few seconds, click "Pausa".
Expected: Scroll stops, countdown freezes, button text changes to "Riprendi".

Click "Riprendi".
Expected: Scroll continues from the same position, countdown resumes.

- [ ] **Step 5: Manual test — Stop button**

Start a scroll. Click "Stop".
Expected: Scroll stops immediately, top bar disappears.

- [ ] **Step 6: Manual test — non-scrollable page**

On a very short page with no overflow, open popup and click "AVVIA".
Expected: Popup shows "Pagina non scrollabile." and stays open.

- [ ] **Step 7: Manual test — already running**

Start a scroll. Open popup again and try to start another.
Expected: Popup shows "Scroll gia in corso." and stays open.

- [ ] **Step 8: Manual test — page navigation during scroll**

Start a 60-second scroll. Navigate to a different URL in the same tab.
Expected: The top bar disappears when the page unloads (pagehide fires before the new page loads).

- [ ] **Step 9: Commit**

```bash
git add content/content.js
git commit -m "feat: add scroll engine, overlay, pause/resume/stop, and message listener"
```

---

## Task 6: Final verification

---

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All 21 tests PASS.

- [ ] **Step 2: Run full manual checklist**

| Test | Expected result |
|---|---|
| Popup opens with correct dark UI | Pass |
| Typing `0530` auto-formats to `05:30` | Pass |
| Empty input gives validation error | Pass |
| Duration `00:04` gives "too short" error | Pass |
| Valid `00:30` starts scroll, popup closes | Pass |
| Top bar slides in from top | Pass |
| Countdown decreases in MM:SS | Pass |
| Progress bar fills left-to-right | Pass |
| Pause freezes scroll and countdown | Pass |
| Resume continues from exact position | Pass |
| Stop removes bar immediately | Pass |
| Auto-stop at page bottom removes bar | Pass |
| Second Avvia during scroll shows error | Pass |
| Navigation during scroll removes bar | Pass |

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore: verify all tests pass and manual checklist complete"
```
