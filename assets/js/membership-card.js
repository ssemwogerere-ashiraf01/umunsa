// =========================================================================
// Membership ID card renderer.
// Draws the front and back of a CR80-size (85.6mm x 54mm, ratio 1.5882)
// membership card onto <canvas> elements, matching the brand palette in
// assets/css/style.css. Used by admin/membership-id.html.
//
// Loads the QR code library from a CDN at runtime (no npm install needed).
// Tries a few independent mirrors in turn — some campus/mobile networks
// block one CDN but not another — so one being unreachable doesn't fail
// the whole card. All three serve the same `qrcode` package (soldair/
// node-qrcode) and expose a global `QRCode` with
// `QRCode.toCanvas(canvas, text, opts)`.
// =========================================================================
import { BASE_URL, SITE_SHORT_SEAL } from './site-config.js';

// ---- brand palette (mirrors :root in assets/css/style.css) ----
export const CARD_COLORS = {
  inkNavy: '#16233a',
  forest: '#1f4b3f',
  forestDark: '#123128',
  gold: '#c9a227',
  goldSoft: '#e4c862',
  parchment: '#f7f4ec',
  paper: '#ffffff',
  textMuted: '#55605c',
  border: '#e2ddcf',
};

// CR80 card size @ 300dpi
export const CARD_W = 1013;
export const CARD_H = 638;
const RADIUS = 34;

const QR_LIB_SOURCES = [
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.4.4/qrcode.min.js',
  'https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js',
];
const QR_LIB_TIMEOUT_MS = 3500;

function loadScript(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading ${src}`));
    }, timeoutMs);
    script.src = src;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error(`Failed to load ${src}`)); };
    document.head.appendChild(script);
  });
}

let qrLibPromise = null;
async function loadQrLib() {
  if (window.QRCode) return window.QRCode;
  if (qrLibPromise) return qrLibPromise;

  qrLibPromise = (async () => {
    let lastError = null;
    for (const src of QR_LIB_SOURCES) {
      try {
        await loadScript(src, QR_LIB_TIMEOUT_MS);
        if (window.QRCode) return window.QRCode;
      } catch (err) {
        lastError = err;
      }
    }
    // All mirrors failed — let the next attempt try again from scratch
    // rather than caching a permanent failure.
    qrLibPromise = null;
    throw new Error(
      `Could not load the QR code library from any source (jsDelivr, cdnjs, unpkg). ` +
      `Check your internet connection or try a different network. (${lastError?.message || 'unknown error'})`
    );
  })();

  return qrLibPromise;
}

/** Student ID formula: last 2 digits of the registration year + '0050' + last 4 digits of the registration number. */
export function computeStudentId(registrationNumber) {
  const reg = String(registrationNumber || '').trim();
  if (reg.length < 4) return '';
  const yearPart = reg.slice(2, 4);
  const lastFour = reg.slice(-4);
  return `${yearPart}0050${lastFour}`;
}

/** The URL encoded into the QR code — opens the public verification page. */
export function verifyUrl(cardNumber) {
  return `${BASE_URL}/verify.html?card=${encodeURIComponent(cardNumber)}`;
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clipCardShape(ctx) {
  roundedRectPath(ctx, 0, 0, CARD_W, CARD_H, RADIUS);
  ctx.clip();
}

async function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 8000);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

function drawSeal(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = CARD_COLORS.gold;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r - 8, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = CARD_COLORS.gold;
  ctx.font = `700 ${Math.round(r * 1.05)}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(SITE_SHORT_SEAL, cx, cy + 1);
  ctx.restore();
}

function drawPlaceholderAvatar(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#e6e6e2';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#c8c8c2';
  ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.36, w * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.86, w * 0.36, h * 0.32, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

function pill(ctx, x, y, w, h, text, bg, fg) {
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = '700 12px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}

const STATUS_LABEL = { active: 'ACTIVE MEMBER', pending: 'PENDING', suspended: 'SUSPENDED', rejected: 'REJECTED' };

/**
 * Draws the FRONT of the card.
 * @param {HTMLCanvasElement} canvas
 * @param {object} member - { full_name, programme, tribe, clan, year_of_study, membership_card_number,
 *                             student_id, registration_number, avatar_url, membership_status }
 */
export async function drawCardFront(canvas, member) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  clipCardShape(ctx);

  ctx.fillStyle = CARD_COLORS.paper;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // top forest gradient band
  const bandH = 128;
  const grad = ctx.createLinearGradient(0, 0, 0, bandH);
  grad.addColorStop(0, CARD_COLORS.forest);
  grad.addColorStop(1, CARD_COLORS.forestDark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, bandH);

  drawSeal(ctx, 70, 64, 40);

  ctx.fillStyle = CARD_COLORS.paper;
  ctx.font = "700 21px Inter, Arial, sans-serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText("NKOBAZAMBOGO STUDENTS' ASSOCIATION", 128, 44);
  ctx.fillStyle = CARD_COLORS.goldSoft;
  ctx.font = '14px Inter, Arial, sans-serif';
  ctx.fillText('Uganda Martyrs University — Nkozi', 128, 68);

  ctx.fillStyle = CARD_COLORS.gold;
  ctx.font = '700 13px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('MEMBERSHIP CARD', CARD_W - 30, 34);

  const status = member.membership_status || 'active';
  pill(ctx, CARD_W - 150, 56, 120, 28, STATUS_LABEL[status] || status.toUpperCase(), CARD_COLORS.goldSoft, CARD_COLORS.inkNavy);

  ctx.fillStyle = CARD_COLORS.gold;
  ctx.fillRect(0, bandH, CARD_W, 4);

  // photo
  const photoW = 200, photoH = 240, px0 = 56, py0 = bandH + 34;
  ctx.strokeStyle = CARD_COLORS.gold;
  ctx.lineWidth = 3;
  roundedRectPath(ctx, px0 - 4, py0 - 4, photoW + 8, photoH + 8, 10);
  ctx.stroke();
  const img = await loadImage(member.avatar_url);
  if (img) {
    ctx.save();
    roundedRectPath(ctx, px0, py0, photoW, photoH, 6);
    ctx.clip();
    // cover-fit
    const scale = Math.max(photoW / img.width, photoH / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, px0 + (photoW - dw) / 2, py0 + (photoH - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    drawPlaceholderAvatar(ctx, px0, py0, photoW, photoH);
  }

  // name + details (clear labels; never ambiguous)
  const tx = px0 + photoW + 36;
  let ty = py0 + 4;
  const maxTextW = CARD_W - tx - 40;

  function fitText(text, font, maxW) {
    ctx.font = font;
    let s = String(text || '');
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 3 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  ctx.fillStyle = CARD_COLORS.inkNavy;
  ctx.font = "700 28px Fraunces, Georgia, serif";
  ctx.textAlign = 'left';
  ctx.fillText(fitText(member.full_name || 'Member', "700 28px Fraunces, Georgia, serif", maxTextW), tx, ty + 26);

  // Programme line
  ctx.fillStyle = CARD_COLORS.gold;
  ctx.font = '700 11px Inter, Arial, sans-serif';
  ctx.fillText('PROGRAMME', tx, ty + 52);
  ctx.fillStyle = CARD_COLORS.inkNavy;
  ctx.font = '16px Inter, Arial, sans-serif';
  ctx.fillText(fitText(member.programme || '—', '16px Inter, Arial, sans-serif', maxTextW), tx, ty + 72);

  // Tribe + Clan on separate clear lines
  ctx.fillStyle = CARD_COLORS.gold;
  ctx.font = '700 11px Inter, Arial, sans-serif';
  ctx.fillText('TRIBE', tx, ty + 96);
  ctx.fillStyle = CARD_COLORS.inkNavy;
  ctx.font = '16px Inter, Arial, sans-serif';
  ctx.fillText(fitText(member.tribe || '—', '16px Inter, Arial, sans-serif', maxTextW), tx, ty + 116);

  ctx.fillStyle = CARD_COLORS.gold;
  ctx.font = '700 11px Inter, Arial, sans-serif';
  ctx.fillText('CLAN', tx, ty + 140);
  ctx.fillStyle = CARD_COLORS.inkNavy;
  ctx.font = '16px Inter, Arial, sans-serif';
  ctx.fillText(fitText(member.clan || '—', '16px Inter, Arial, sans-serif', maxTextW), tx, ty + 160);

  function field(label, value, yy) {
    ctx.fillStyle = CARD_COLORS.gold;
    ctx.font = '700 11px Inter, Arial, sans-serif';
    ctx.fillText(label.toUpperCase(), tx, yy);
    ctx.fillStyle = CARD_COLORS.inkNavy;
    ctx.font = '700 18px Inter, Arial, sans-serif';
    ctx.fillText(fitText(value || '—', '700 18px Inter, Arial, sans-serif', maxTextW), tx, yy + 22);
  }
  // Shift membership fields down so they don't overlap tribe/clan
  field('Membership No.', member.membership_card_number, ty + 188);
  field('Student ID', member.student_id, ty + 238);

  // small QR bottom-right
  const qrSize = 118;
  const qx = CARD_W - qrSize - 46, qy = CARD_H - qrSize - 34;
  ctx.strokeStyle = CARD_COLORS.border;
  ctx.lineWidth = 2;
  ctx.fillStyle = CARD_COLORS.paper;
  roundedRectPath(ctx, qx - 8, qy - 8, qrSize + 16, qrSize + 16, 8);
  ctx.fill(); ctx.stroke();

  const QRCode = await loadQrLib().catch((err) => { console.warn('QR skipped on front:', err); return null; });
  if (QRCode) {
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, verifyUrl(member.membership_card_number || ''), { width: qrSize, margin: 0, color: { dark: '#16233a', light: '#ffffff00' } });
    ctx.drawImage(qrCanvas, qx, qy, qrSize, qrSize);
  } else {
    ctx.fillStyle = CARD_COLORS.textMuted;
    ctx.font = '10px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR unavailable', qx + qrSize / 2, qy + qrSize / 2);
  }

  ctx.fillStyle = CARD_COLORS.textMuted;
  ctx.font = '700 10px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN TO VERIFY', qx + qrSize / 2, qy + qrSize + 26);

  ctx.textAlign = 'left';
  ctx.fillStyle = CARD_COLORS.gold;
  ctx.font = '700 10px Inter, Arial, sans-serif';
  ctx.fillText('REGISTRATION NO.', 56, CARD_H - 34);
  ctx.fillStyle = CARD_COLORS.inkNavy;
  ctx.font = '700 13px Inter, Arial, sans-serif';
  ctx.fillText(member.registration_number || '—', 56, CARD_H - 18);

  ctx.restore(); // clip
}

/** Draws the BACK of the card (large verification QR + terms + signature line). */
export async function drawCardBack(canvas, member) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.save();
  clipCardShape(ctx);

  ctx.fillStyle = CARD_COLORS.parchment;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const bandH = 70;
  ctx.fillStyle = CARD_COLORS.forest;
  ctx.fillRect(0, 0, CARD_W, bandH);
  ctx.fillStyle = CARD_COLORS.goldSoft;
  ctx.font = '700 17px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('NSA MEMBERSHIP CARD', 30, bandH / 2);
  ctx.fillStyle = CARD_COLORS.paper;
  ctx.font = '700 15px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(member.membership_card_number || '', CARD_W - 30, bandH / 2);
  ctx.textBaseline = 'alphabetic';

  // big QR
  const qrSize = 260, qx = 70, qy = bandH + 46;
  ctx.strokeStyle = CARD_COLORS.gold;
  ctx.lineWidth = 3;
  ctx.fillStyle = CARD_COLORS.paper;
  roundedRectPath(ctx, qx - 14, qy - 14, qrSize + 28, qrSize + 28, 12);
  ctx.fill(); ctx.stroke();

  const QRCode = await loadQrLib().catch((err) => { console.warn('QR skipped on back:', err); return null; });
  if (QRCode) {
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, verifyUrl(member.membership_card_number || ''), { width: qrSize, margin: 0, color: { dark: '#16233a', light: '#ffffff00' } });
    ctx.drawImage(qrCanvas, qx, qy, qrSize, qrSize);
  } else {
    ctx.fillStyle = CARD_COLORS.textMuted;
    ctx.font = '13px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('QR code', qx + qrSize / 2, qy + qrSize / 2 - 8);
    ctx.fillText('unavailable', qx + qrSize / 2, qy + qrSize / 2 + 12);
  }

  const tx = qx + qrSize + 60;
  let ty = bandH + 50;
  ctx.fillStyle = CARD_COLORS.inkNavy;
  ctx.font = "700 22px Fraunces, Georgia, serif";
  ctx.textAlign = 'left';
  ctx.fillText('Scan to verify membership', tx, ty + 20);

  const body = [
    'Scan this QR code to open the official',
    'NSA verification page for this member.',
    'It shows their name, programme, tribe,',
    'clan, student ID, and membership status',
    'from the Association register.',
  ];
  ctx.fillStyle = CARD_COLORS.textMuted;
  ctx.font = '15px Inter, Arial, sans-serif';
  body.forEach((line, i) => ctx.fillText(line, tx, ty + 64 + i * 22));

  ctx.fillStyle = CARD_COLORS.gold;
  ctx.font = '700 11px Inter, Arial, sans-serif';
  ctx.fillText('STUDENT ID', tx, ty + 210);
  ctx.fillStyle = CARD_COLORS.inkNavy;
  ctx.font = '700 20px Inter, Arial, sans-serif';
  ctx.fillText(member.student_id || '—', tx, ty + 234);

  ctx.strokeStyle = CARD_COLORS.border;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(56, CARD_H - 150); ctx.lineTo(CARD_W - 56, CARD_H - 150); ctx.stroke();

  const terms = [
    "This card is property of the Nkobazambogo Students' Association and is",
    'non-transferable. If found, please return to the Association Office,',
    'Uganda Martyrs University, Nkozi, or email nsa@umu.ac.ug.',
  ];
  ctx.fillStyle = CARD_COLORS.textMuted;
  ctx.font = '12px Inter, Arial, sans-serif';
  terms.forEach((line, i) => ctx.fillText(line, 56, CARD_H - 132 + i * 18));

  ctx.strokeStyle = CARD_COLORS.inkNavy;
  ctx.beginPath(); ctx.moveTo(56, CARD_H - 56); ctx.lineTo(280, CARD_H - 56); ctx.stroke();
  ctx.fillStyle = CARD_COLORS.textMuted;
  ctx.font = '11px Inter, Arial, sans-serif';
  ctx.fillText('Authorized Signature', 56, CARD_H - 42);

  ctx.textAlign = 'right';
  const issued = member.card_issued_at ? new Date(member.card_issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  ctx.fillText(`Issued: ${issued}`, CARD_W - 56, CARD_H - 42);

  ctx.restore(); // clip
}

/** Triggers a PNG download of a canvas. */
export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/** Combines front+back canvases (stacked) into one downloadable PNG. */
export function downloadCombined(frontCanvas, backCanvas, filename) {
  const gap = 40;
  const combined = document.createElement('canvas');
  combined.width = CARD_W;
  combined.height = CARD_H * 2 + gap;
  const ctx = combined.getContext('2d');
  ctx.fillStyle = '#e9e5d9';
  ctx.fillRect(0, 0, combined.width, combined.height);
  ctx.drawImage(frontCanvas, 0, 0);
  ctx.drawImage(backCanvas, 0, CARD_H + gap);
  downloadCanvas(combined, filename);
}