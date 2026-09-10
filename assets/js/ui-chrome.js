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
  if (document.getElementById('scroll-top-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'scroll-top-btn';
  btn.type = 'button';
  btn.className = 'scroll-top-btn';
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`;
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.body.appendChild(btn);

  const onScroll = () => {
    if (window.scrollY > 320) btn.classList.add('visible');
    else btn.classList.remove('visible');
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
}
