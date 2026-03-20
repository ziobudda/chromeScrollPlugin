/**
 * Parses input to milliseconds.
 * Accepts "MM:SS" format or a plain integer interpreted as seconds.
 * Returns null if format is invalid or duration < 5000ms.
 */
function parseMMSS(input) {
  if (typeof input !== 'string') return null;

  // Plain integer → treat as seconds (e.g. "90" → 90s → 1:30)
  if (/^\d+$/.test(input)) {
    var ms = parseInt(input, 10) * 1000;
    return ms < 5000 ? null : ms;
  }

  // MM:SS format
  var match = input.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  var minutes = parseInt(match[1], 10);
  var seconds = parseInt(match[2], 10);
  if (seconds > 59) return null;
  var total = (minutes * 60 + seconds) * 1000;
  return total < 5000 ? null : total;
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
        if (!tabs || tabs.length === 0) {
          showError('Impossibile comunicare con la pagina.');
          btn.disabled = false;
          return;
        }
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
            } else {
              showError('Nessuna risposta dalla pagina.');
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
