# Chrome Auto-Scroll Plugin — Design Spec

**Date:** 2026-03-17
**Project:** chromeScrollPlugin
**Status:** Approved

---

## Overview

A Chrome extension that automatically scrolls any web page from top to bottom at a user-defined speed. The user sets the total traversal time (MM:SS format) before starting. A fixed top bar overlay appears on the page during scrolling with real-time countdown, progress bar, and Pause/Resume/Stop controls.

---

## Requirements

### Functional

- **F1** — The user opens the extension popup and sets the scroll duration in `MM:SS` format (e.g. `05:30` = 5 minutes 30 seconds)
- **F2** — Pressing "Avvia" starts the auto-scroll on the currently active tab
- **F3** — The scroll covers the entire page height (`scrollHeight - innerHeight`) in exactly the specified duration
- **F4** — A fixed top bar appears on the page during scrolling showing:
  - Remaining time countdown (MM:SS)
  - Progress bar (0% → 100%)
  - Pause/Resume button
  - Stop button
- **F5** — Pause freezes scroll position and countdown; Resume continues from exact position
- **F6** — Stop cancels scroll and removes the overlay bar
- **F7** — When scroll reaches the bottom, it stops automatically and the overlay bar disappears

### Non-Functional

- **NF1** — Scroll must be smooth (60fps via `requestAnimationFrame`)
- **NF2** — Works on any public web page
- **NF3** — Uses Chrome Extension Manifest V3
- **NF4** — No external dependencies (vanilla JS only)

### Out of Scope

- Loop/repeat scrolling
- Per-site settings persistence
- Scroll speed adjustment during scroll (only pre-scroll configuration)
- Horizontal scrolling
- Dynamic content loading during scroll (e.g. infinite scroll pages): `totalHeight` is captured once at scroll start and not recalculated

---

## Architecture

### File Structure

```
chromeScrollPlugin/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/
│   ├── content.js
│   └── content.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Components

#### `manifest.json`
Manifest V3 configuration declaring:
- `action` with default popup pointing to `popup/popup.html`
- `content_scripts` injecting `content/content.js` and `content/content.css` on all URLs (`<all_urls>`)
- `permissions`: `activeTab`, `scripting`
- Icons at 16, 48, 128px

#### `popup/popup.html` + `popup.css` + `popup.js`
- Dark theme (background `#16213e`, accent `#a78bfa`)
- Single `<input type="text">` with `MM:SS` placeholder, monospace font
- Input validation: enforces `MM:SS` format (0–99 minutes, 0–59 seconds), minimum 5 seconds
- "Avvia" button sends `{ action: 'start', durationMs: Number }` to the active tab via `chrome.tabs.sendMessage`
- Popup waits for a response from the content script before closing:
  - On `{ status: 'started' }` → popup closes
  - On `{ status: 'error', reason: 'not_scrollable' }` → shows "Pagina non scrollabile" inline, stays open
  - On `{ status: 'error', reason: 'already_running' }` → shows "Scroll già in corso" inline, stays open

#### `content/content.js`
Injected into every page. Listens for messages from the popup and manages the scroll engine.

**State machine:**
```
IDLE → RUNNING → PAUSED → RUNNING → DONE
              ↘                    ↗
               STOPPED
```

**Scroll engine (`requestAnimationFrame`):**
- `startTime`: timestamp when scroll began (or resumed)
- `totalDuration`: user-specified duration in ms
- `elapsedBeforePause`: cumulative paused time subtracted from elapsed
- `totalHeight`: `document.body.scrollHeight - window.innerHeight` (captured at start)
- Each frame: `progress = (now - startTime - elapsedBeforePause) / totalDuration`
- `window.scrollTo(0, progress * totalHeight)`
- Stops when `progress >= 1.0` or `window.scrollY >= totalHeight`

**Pause/Resume logic:**
- Pause: records `pauseStart = performance.now()`, cancels rAF loop
- Resume: `elapsedBeforePause += performance.now() - pauseStart`, restarts rAF loop

**Messages received:**
- `{ action: 'start', durationMs }` — starts scroll, injects overlay. Responds with `{ status: 'started' }` on success, `{ status: 'error', reason: 'not_scrollable' }` if `totalHeight <= 0`, or `{ status: 'error', reason: 'already_running' }` if state is RUNNING or PAUSED
- `{ action: 'pause' }` — pauses scroll (only when RUNNING)
- `{ action: 'resume' }` — resumes scroll (only when PAUSED)
- `{ action: 'stop' }` — stops scroll, removes overlay (from any active state)

**Page navigation cleanup:**
- The content script registers a `window.addEventListener('pagehide', ...)` handler on start
- On `pagehide`: cancels the rAF loop and removes the overlay DOM element
- This ensures no orphaned overlay on page navigations or tab reload

#### `content/content.css`
Styles for the fixed top bar overlay:
- `position: fixed; top: 0; left: 0; right: 0; z-index: 999999`
- Dark semi-transparent background with purple accent (`#a78bfa`)
- Contains: label, progress bar, countdown display, Pause/Resume button, Stop button
- Smooth show/hide with CSS transition

---

## Data Flow

```
User opens popup
    └─> Sets MM:SS duration
    └─> Clicks "Avvia"
            └─> popup.js parses MM:SS → durationMs
            └─> chrome.tabs.sendMessage({ action: 'start', durationMs })
                    └─> content.js receives message
                    └─> Captures totalHeight
                    └─> Injects/shows overlay bar
                    └─> Starts rAF loop
                            └─> Each frame: updates scrollY + overlay (countdown, progress bar)
                            └─> On reach bottom OR progress >= 1: auto-stop, remove overlay
                    └─> Pause button → pauses rAF, freezes countdown
                    └─> Stop button → cancels rAF, removes overlay
```

---

## UI Design

### Popup (260×180px approx)
- Header: `⚡ AUTO SCROLL` (violet, uppercase, letter-spacing)
- Label: `DURATA SCROLL`
- Input: monospace `MM:SS`, dark blue background, violet border, large font (22px)
- Hint text: `es. 05:30 = 5 minuti e 30 secondi`
- Button: `▶ AVVIA` — full width, violet gradient

### Overlay Top Bar
- Fixed at top of page, full width
- Layout (left → right): `⚡ AUTO SCROLL` label | progress bar (flex-grow) | countdown `MM:SS` | ⏸ Pause | ■ Stop
- Progress bar fills left-to-right as scroll advances
- Colors: dark semi-transparent background, violet accent, red Stop button

---

## Error Handling

| Scenario | Handling |
|---|---|
| Invalid MM:SS input | Show inline validation error in popup, block Avvia |
| Duration < 5 seconds | Show error: "Durata minima: 5 secondi" |
| Page has no scroll | Content script detects `totalHeight <= 0`, responds `{ status: 'error', reason: 'not_scrollable' }` — popup shows "Pagina non scrollabile" and stays open |
| Scroll already in progress | Content script responds `{ status: 'error', reason: 'already_running' }` — popup shows "Scroll già in corso" and stays open |
| User scrolls manually during auto-scroll | Auto-scroll continues from correct interpolated position (rAF recalculates from time, not position) |
| Extension message to closed tab | Caught silently via `chrome.runtime.lastError` check |
| Page navigation during scroll | `pagehide` event handler cancels rAF loop and removes overlay DOM element |

---

## Testing

- Load unpacked extension in Chrome (`chrome://extensions` → Developer mode)
- Test on pages with varying heights (short page, very long page)
- Verify MM:SS input validation (invalid format, too short, zero duration)
- Verify Pause freezes both scroll and countdown
- Verify Resume continues from exact scroll position
- Verify auto-stop at bottom removes overlay
- Verify Stop button removes overlay immediately
- Verify no overlay persistence across page navigations
