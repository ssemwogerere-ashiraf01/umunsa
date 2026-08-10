// Client helper for server-issued math CAPTCHA (password-reset get_captcha action).
import { FUNCTIONS_BASE } from './auth.js';

/**
 * Mount a CAPTCHA widget into containerEl.
 * Returns an object:
 *   getPayload() -> { captcha_token, captcha_answer } | null
 *   refresh()    -> Promise<void>
 *   clear()      -> void
 */
export async function mountCaptcha(containerEl, options = {}) {
  if (!containerEl) throw new Error('CAPTCHA container required');

  const labelText = options.label || 'Security check';
  containerEl.innerHTML = `
    <div class="captcha-box form-group" data-captcha-root>
      <label for="captcha-answer">${labelText}</label>
      <div class="captcha-row">
        <span class="captcha-question" id="captcha-question">Loading...</span>
        <button type="button" class="captcha-refresh" id="captcha-refresh" title="New question" aria-label="New CAPTCHA question">↻</button>
      </div>
      <input type="text" id="captcha-answer" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Your answer" required />
      <input type="hidden" id="captcha-token" value="" />
    </div>
  `;

  const questionEl = containerEl.querySelector('#captcha-question');
  const tokenEl = containerEl.querySelector('#captcha-token');
  const answerEl = containerEl.querySelector('#captcha-answer');
  const refreshBtn = containerEl.querySelector('#captcha-refresh');

  async function refresh() {
    questionEl.textContent = 'Loading...';
    tokenEl.value = '';
    answerEl.value = '';
    refreshBtn.disabled = true;
    try {
      const res = await fetch(`${FUNCTIONS_BASE}/functions/v1/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_captcha' }),
      });
      const data = await res.json();
      if (!res.ok || !data.token || !data.question) {
        questionEl.textContent = 'Could not load CAPTCHA';
        return;
      }
      questionEl.textContent = data.question;
      tokenEl.value = data.token;
    } catch {
      questionEl.textContent = 'Could not load CAPTCHA';
    } finally {
      refreshBtn.disabled = false;
    }
  }

  refreshBtn.addEventListener('click', (e) => {
    e.preventDefault();
    refresh();
  });

  await refresh();

  return {
    getPayload() {
      const token = tokenEl.value.trim();
      const answer = answerEl.value.trim();
      if (!token || !answer) return null;
      return { captcha_token: token, captcha_answer: answer };
    },
    refresh,
    clear() {
      answerEl.value = '';
    },
    focus() {
      answerEl.focus();
    },
  };
}
