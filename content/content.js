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
    startTimerId: null,
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
    state.elapsedBeforePause = 0;

    createOverlay();
    updateOverlay(0, durationMs, false);
    wirePauseStop();

    state.pagehideHandler = function () { stopScroll(); };
    window.addEventListener('pagehide', state.pagehideHandler);

    // 1-second delay before scroll begins
    state.startTimerId = setTimeout(function () {
      state.startTimerId = null;
      state.startTime = performance.now();
      state.rafId = requestAnimationFrame(tick);
    }, 1000);
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
    if (state.startTimerId) {
      clearTimeout(state.startTimerId);
      state.startTimerId = null;
    }
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
      } else {
        sendResponse({ status: 'error', reason: 'unknown_action' });
      }
      return true;
    });
  }

} // end browser-only block
