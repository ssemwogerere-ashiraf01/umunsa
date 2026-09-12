/** Shared chrome: digital clock, marquee, scroll-top, smooth scroll */

export function formatDigitalClock(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hr = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return { date: `${dd}/${mm}/${yy}`, time: `${hr}:${min}:${sec}` };
}

export function startDigitalClock(el) {
  if (!el) return;
  const tick = () => {
    const { date, time } = formatDigitalClock();
    el.innerHTML = `<span class="clock-date">${date}</span><span class="clock-sep">·</span><span class="clock-time">${time}</span>`;
  };
  tick();
  return setInterval(tick, 1000);
}

export function ensureScrollTopButton() {
  if (document.getElementById('scroll-top-wrap')) return;
  // New Vision style: bottom-center button with a horizontal line through it
  const wrap = document.createElement('div');
  wrap.id = 'scroll-top-wrap';
  wrap.className = 'scroll-top-wrap';
  wrap.innerHTML = `
    <div class="scroll-top-line" aria-hidden="true"></div>
    <button type="button" id="scroll-top-btn" class="scroll-top-btn" aria-label="Scroll to top" title="Back to top">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
    </button>
  `;
  document.body.appendChild(wrap);
  const btn = wrap.querySelector('#scroll-top-btn');
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  const onScroll = () => {
    if (window.scrollY > 280) wrap.classList.add('visible');
    else wrap.classList.remove('visible');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

export function enableSmoothAnchors() {
  document.documentElement.style.scrollBehavior = 'smooth';
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href === '#' || href.startsWith('http')) return;
    const hash = href.includes('#') ? href.slice(href.indexOf('#')) : '';
    if (!hash || hash === '#') return;
    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', hash);
    }
  });
}

const DEFAULT_MARQUEE = [
  "Welcome to the Nkobazambogo Students' Association: Uganda Martyrs University, Nkozi.",
  'Membership is by approval. Register with your .umu.ac.ug email, then wait for admin review.',
  'Join club activities, contribute to projects, and take part in member discussions.',
  'Questions? Visit Contact or reach out from your member dashboard.',
];

export async function loadMarqueeItems(supabase) {
  try {
    if (!supabase) return DEFAULT_MARQUEE;
    const { data } = await supabase
      .from('site_announcements')
      .select('message')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .limit(20);
    if (data?.length) return data.map((r) => r.message).filter(Boolean);
  } catch {
    /* table may not exist yet */
  }
  return DEFAULT_MARQUEE;
}

export function renderMarquee(container, items) {
  if (!container) return;
  const list = (items?.length ? items : DEFAULT_MARQUEE).join('   ·   ');
  // Duplicate content for seamless loop
  container.innerHTML = `
    <div class="marquee-track" aria-hidden="false">
      <span class="marquee-text">${escapeHtml(list)}   ·   ${escapeHtml(list)}</span>
    </div>`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

/* ---------- Cookie consent ---------- */
const COOKIE_KEY = 'nsa_cookie_consent';

export function getCookieConsent() {
  try {
    return localStorage.getItem(COOKIE_KEY) || null;
  } catch {
    return null;
  }
}

export function setCookieConsent(value) {
  try {
    localStorage.setItem(COOKIE_KEY, value);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `nsa_consent=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
  } catch { /* ignore */ }
}

export function ensureCookieBanner() {
  if (getCookieConsent() || document.getElementById('nsa-cookie-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'nsa-cookie-banner';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Cookie consent');
  bar.innerHTML = `
    <div class="nsa-cookie-inner">
      <p>We use cookies and similar storage to keep you signed in, remember preferences, and improve the site. By continuing you agree to essential cookies.</p>
      <div class="nsa-cookie-actions">
        <button type="button" class="btn btn-gold" id="nsa-cookie-accept">Accept</button>
        <button type="button" class="btn btn-outline-light" id="nsa-cookie-essential" style="border-color:rgba(255,255,255,0.4);color:#fff;">Essential only</button>
      </div>
    </div>`;
  document.body.appendChild(bar);
  const style = document.createElement('style');
  style.textContent = `
    #nsa-cookie-banner {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
      background: var(--navy-surface, #0f1f1a); color: #fff;
      border-top: 1px solid rgba(255,255,255,0.12);
      padding: 0.9rem 1.25rem; box-shadow: 0 -4px 24px rgba(0,0,0,0.25);
    }
    #nsa-cookie-banner .nsa-cookie-inner {
      max-width: 960px; margin: 0 auto; display: flex; flex-wrap: wrap;
      gap: 0.85rem; align-items: center; justify-content: space-between;
    }
    #nsa-cookie-banner p { margin: 0; font-size: 0.88rem; line-height: 1.45; flex: 1; min-width: 200px; }
    #nsa-cookie-banner .nsa-cookie-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  `;
  document.head.appendChild(style);
  document.getElementById('nsa-cookie-accept')?.addEventListener('click', () => {
    setCookieConsent('all');
    bar.remove();
    requestSiteNotifications();
  });
  document.getElementById('nsa-cookie-essential')?.addEventListener('click', () => {
    setCookieConsent('essential');
    bar.remove();
  });
}

/* ---------- Browser / in-app notifications ---------- */
export function requestSiteNotifications() {
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  return Notification.requestPermission().then(p => p === 'granted');
}

export function notifySite(title, options = {}) {
  const body = options.body || '';
  showInAppToast(title, body);
  // Prefer service worker notification (works better on mobile / background)
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      body,
      tag: options.tag || 'nsa-site',
      url: options.url || window.location.pathname,
    });
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: options.icon || '/assets/img/favicon-64.png',
      tag: options.tag || 'nsa-site',
    });
    if (options.onClick) n.onclick = options.onClick;
  } catch { /* ignore */ }
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('Service worker registration failed', err);
    return null;
  }
}

function showInAppToast(title, body) {
  let host = document.getElementById('nsa-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'nsa-toast-host';
    host.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:10000;display:flex;flex-direction:column;gap:0.5rem;max-width:min(360px,92vw);pointer-events:none;';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.style.cssText = 'pointer-events:auto;background:var(--paper,#fff);border:1px solid var(--border,#ddd);border-radius:10px;padding:0.75rem 1rem;box-shadow:0 8px 28px rgba(0,0,0,0.12);font-size:0.9rem;';
  toast.innerHTML = `<strong style="display:block;margin-bottom:0.2rem;">${escapeHtml(title)}</strong><span style="color:var(--text-muted,#555);">${escapeHtml(body)}</span>`;
  host.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.35s';
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

export function initUiChrome({ clockEl, marqueeEl, supabase } = {}) {
  enableSmoothAnchors();
  ensureScrollTopButton();
  ensureCookieBanner();
  registerServiceWorker();
  if (clockEl) startDigitalClock(clockEl);
  if (marqueeEl) {
    loadMarqueeItems(supabase).then((items) => renderMarquee(marqueeEl, items));
  }
  // Always mount floating AI on chrome init
  try { ensureAiAssistant(); } catch (e) { console.warn('AI float', e); }
  setTimeout(() => { try { ensureAiAssistant(); } catch (_) {} }, 500);
}


/** Floating UMUNSA Quick Chat (member pages). */
export function ensureAiAssistant() {
  if (document.getElementById('ai-float-btn')) return;
  const path = (location.pathname || '').toLowerCase();
  if (/login|register|apply\.html|reset-password/.test(path)) return;

  let isOpen = false;

  const btn = document.createElement('button');
  btn.id = 'ai-float-btn';
  btn.type = 'button';
  btn.className = 'ai-float-btn ai-float-btn-live';
  btn.setAttribute('aria-label', 'UMUNSA Quick Chat');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `<span class="ai-float-pulse" aria-hidden="true"></span><span class="ai-float-label">Chat</span>`;

  const panel = document.createElement('div');
  panel.id = 'ai-float-panel';
  panel.hidden = true;
  panel.className = 'ai-float-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'UMUNSA Quick Chat');
  panel.innerHTML = `
    <div class="ai-float-head">
      <div>
        <strong>UMUNSA Quick Chat</strong>
        <div class="ai-float-sub"><span class="ai-live-dot"></span> Live · guidance only</div>
      </div>
      <div class="ai-float-head-actions">
        <button type="button" id="ai-float-new" class="mini-btn good" title="New chat">New chat</button>
        <button type="button" id="ai-float-close" aria-label="Close">×</button>
      </div>
    </div>
    <div class="ai-float-body">
      <aside id="ai-float-sidebar" class="ai-float-sidebar" aria-label="Chat history">
        <div style="font-size:0.72rem;font-weight:700;opacity:0.75;padding:0.2rem 0.35rem 0.45rem;">History</div>
        <div id="ai-float-history-list"></div>
      </aside>
      <div class="ai-float-main">
        <div id="ai-float-log" class="ai-float-log"></div>
        <div class="ai-float-compose">
          <textarea id="ai-float-input" rows="2" placeholder="Message UMUNSA Quick Chat…"></textarea>
          <button type="button" class="btn btn-gold" id="ai-float-ask">Send</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  const logEl = panel.querySelector('#ai-float-log');
  const input = panel.querySelector('#ai-float-input');
  const sendBtn = panel.querySelector('#ai-float-ask');
  const histList = panel.querySelector('#ai-float-history-list');
  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function setOpen(open) {
    isOpen = !!open;
    panel.hidden = !isOpen;
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    btn.classList.toggle('ai-float-open', isOpen);
    if (isOpen) setTimeout(() => input?.focus(), 40);
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(!isOpen);
  });

  panel.addEventListener('mousedown', (e) => e.stopPropagation());
  panel.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) setOpen(false);
  });

  import('./ai.js').then(async (ai) => {
    const {
      askAI,
      createNewChatSession,
      upsertChatSession,
      loadChatSessions,
      loadChatSessionsAsync,
      getChatSession,
      deleteChatSession,
    } = ai;

    let session = createNewChatSession();
    let messages = session.messages || [];
    try { await loadChatSessionsAsync(); } catch (_) {}

    const render = () => {
      logEl.innerHTML = messages.map((m) => {
        const user = m.role === 'user';
        return `<div style="display:flex;justify-content:${user ? 'flex-end' : 'flex-start'};">
          <div style="max-width:92%;padding:0.5rem 0.75rem;border-radius:${user ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};font-size:0.88rem;line-height:1.4;white-space:pre-wrap;background:${user ? '#16a34a' : '#6d28d9'};color:#fff;">${esc(m.content)}</div>
        </div>`;
      }).join('');
      logEl.scrollTop = logEl.scrollHeight;
    };

    const renderHistory = async () => {
      let sessions = loadChatSessions();
      try { sessions = await loadChatSessionsAsync(); } catch (_) {}
      sessions = [...sessions].sort(
        (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
      );
      if (!histList) return;
      histList.innerHTML = sessions.length
        ? sessions.map((s) => {
            const active = s.id === session.id ? ' active' : '';
            const when = s.updatedAt
              ? new Date(s.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '';
            return `<div class="ai-hist-row${active}">
              <button type="button" data-load="${esc(s.id)}">${esc((s.title || 'Chat').slice(0, 48))}<br><span class="ai-hist-time">${esc(when)}</span></button>
              <button type="button" class="mini-btn bad" data-del="${esc(s.id)}" title="Delete">×</button>
            </div>`;
          }).join('')
        : '<p style="color:var(--text-muted);font-size:0.78rem;margin:0.35rem;">No chats yet.</p>';

      histList.querySelectorAll('[data-load]').forEach((b) => {
        b.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const s = getChatSession(b.getAttribute('data-load'));
          if (!s) return;
          session = s;
          messages = s.messages?.length ? s.messages : messages;
          render();
          renderHistory();
        });
      });
      histList.querySelectorAll('[data-del]').forEach((b) => {
        b.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const id = b.getAttribute('data-del');
          deleteChatSession(id);
          if (session.id === id) {
            session = createNewChatSession();
            messages = session.messages;
            render();
          }
          await renderHistory();
        });
      });
    };

    const send = async () => {
      const text = (input.value || '').trim();
      if (!text) return;
      input.value = '';
      messages.push({ role: 'user', content: text });
      const aIdx = messages.length;
      messages.push({ role: 'assistant', content: '' });
      render();
      session = upsertChatSession({ ...session, messages });
      renderHistory();
      sendBtn.disabled = true;
      btn.classList.add('ai-float-busy');
      const history = messages.slice(0, aIdx).filter((m) => m.content);
      const result = await askAI({
        task: 'faq',
        prompt: text,
        history: history.slice(0, -1),
        onToken: (_piece, full) => {
          messages[aIdx] = { role: 'assistant', content: full };
          render();
        },
      });
      messages[aIdx] = {
        role: 'assistant',
        content: result.error || result.text || messages[aIdx].content || '(No reply)',
      };
      session = upsertChatSession({ ...session, messages });
      render();
      renderHistory();
      sendBtn.disabled = false;
      btn.classList.remove('ai-float-busy');
      input.focus();
    };

    sendBtn.addEventListener('click', (e) => { e.stopPropagation(); send(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    panel.querySelector('#ai-float-new')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (messages.some((m) => m.role === 'user')) upsertChatSession({ ...session, messages });
      session = createNewChatSession();
      messages = session.messages;
      render();
      renderHistory();
    });
    panel.querySelector('#ai-float-close')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    });

    render();
    await renderHistory();
  }).catch((err) => {
    logEl.innerHTML = `<p style="color:#f87171;padding:0.75rem;">Chat failed to load: ${esc(err?.message || err)}</p>`;
  });
}


try {
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      try { ensureAiAssistant(); } catch (_) {}
    });
  }
} catch (_) {}
