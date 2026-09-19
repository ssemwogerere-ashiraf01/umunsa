/**
 * Generate a printable PDF of NSA leadership for a term (or set of terms).
 * Avatars are cropped to clean circles (face-centred) before embedding.
 */
import { CANONICAL_ORIGIN, SITE_SHORT_SEAL } from './site-config.js';

const JSPDF_SOURCES = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
];

/** Output size of circular avatar bitmap (px) — high enough for sharp print */
const AVATAR_PX = 256;

let jsPdfPromise = null;
async function loadJsPdf() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
  if (jsPdfPromise) return jsPdfPromise;
  jsPdfPromise = (async () => {
    let last = null;
    for (const src of JSPDF_SOURCES) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = src;
          s.onload = resolve;
          s.onerror = () => reject(new Error('load fail'));
          document.head.appendChild(s);
        });
        if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
      } catch (e) { last = e; }
    }
    jsPdfPromise = null;
    throw last || new Error('Could not load jsPDF');
  })();
  return jsPdfPromise;
}

function loadHtmlImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // Cache-bust helps some CDNs serve CORS headers consistently
    const sep = url.includes('?') ? '&' : '?';
    img.src = `${url}${sep}nsa_pdf=1`;
  });
}

/**
 * Cover-fit draw into a square, face bias toward upper third, then clip to circle.
 * Returns a transparent PNG data-URL of a circular portrait, or null.
 */
async function circularAvatarDataUrl(url) {
  if (!url) return null;

  let img = await loadHtmlImage(url);
  if (!img) {
    // fetch → blob → object URL (works when CORS allows)
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) return null;
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      img = await loadHtmlImage(obj);
      URL.revokeObjectURL(obj);
    } catch {
      return null;
    }
  }
  if (!img || !img.naturalWidth) return null;

  const size = AVATAR_PX;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  // Circular clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // object-fit: cover, object-position: center 20% (faces)
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(size / iw, size / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (size - dw) / 2;
  // Bias upward so faces stay in frame for wide photos
  const dy = (size - dh) * 0.2;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();

  // Subtle ring drawn on canvas (gold) so it is part of the image
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
  ctx.lineWidth = 6;
  ctx.stroke();

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}

/**
 * @param {object[]} leaders
 * @param {{ title?: string, subtitle?: string, filename?: string }} opts
 */
export async function downloadLeadershipPdf(leaders, opts = {}) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  const title = opts.title || 'UMUNSA Leadership';
  const subtitle = opts.subtitle || "Nkobazambogo Students' Association · Uganda Martyrs University, Nkozi";
  const filename = opts.filename || 'nsa-leadership.pdf';

  const rows = [...(leaders || [])].sort((a, b) => {
    const oa = a.display_order ?? 99;
    const ob = b.display_order ?? 99;
    if (oa !== ob) return oa - ob;
    return String(a.position || '').localeCompare(String(b.position || ''));
  });

  // Circular, face-centred avatars
  const photos = await Promise.all(
    rows.map(async (l) => {
      const url = l.photo_url || l.avatar_url || null;
      return url ? await circularAvatarDataUrl(url) : null;
    })
  );

  function drawPageHeader(pageNum, totalPages) {
    doc.setFillColor(27, 67, 50);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text("NKOBAZAMBOGO STUDENTS' ASSOCIATION", margin, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(212, 175, 55);
    doc.text(SITE_SHORT_SEAL || 'UMUNSA', pageW - margin, 12, { align: 'right' });
    doc.setTextColor(230, 230, 230);
    doc.setFontSize(8);
    doc.text(subtitle, margin, 20);
    doc.setTextColor(180, 180, 180);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, 20, { align: 'right' });
  }

  function drawFooter() {
    doc.setDrawColor(226, 221, 207);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated ${new Date().toLocaleString('en-GB')} · ${CANONICAL_ORIGIN}`, margin, pageH - 7);
    doc.text('Confidential — for Association records', pageW - margin, pageH - 7, { align: 'right' });
  }

  /** Draw circular photo or initials placeholder (mm units) */
  function drawAvatar(photoDataUrl, name, cx, cy, diameterMm) {
    const r = diameterMm / 2;
    if (photoDataUrl) {
      try {
        // PNG with transparency — already circular
        doc.addImage(photoDataUrl, 'PNG', cx - r, cy - r, diameterMm, diameterMm, undefined, 'FAST');
        return;
      } catch (_) {
        /* fall through to initials */
      }
    }
    doc.setFillColor(27, 67, 50);
    doc.circle(cx, cy, r, 'F');
    doc.setDrawColor(201, 162, 39);
    doc.setLineWidth(0.6);
    doc.circle(cx, cy, r, 'S');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.max(8, diameterMm * 0.35));
    doc.text(initials(name), cx, cy + diameterMm * 0.12, { align: 'center' });
  }

  const cardH = 38;
  const gap = 3.5;
  const titleBlockH = 22;
  const photoMm = 26; // small clear circle

  // Layout pass
  const positions = [];
  let page = 1;
  let y = 28 + 8 + titleBlockH;
  for (let i = 0; i < rows.length; i++) {
    if (y + cardH > pageH - 18) {
      page += 1;
      y = 28 + 10;
    }
    positions.push({ i, y, page });
    y += cardH + gap;
  }
  const totalPages = Math.max(1, page);

  let currentPage = 1;
  drawPageHeader(1, totalPages);

  doc.setTextColor(22, 35, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, margin, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`${rows.length} leader${rows.length === 1 ? '' : 's'}`, margin, 47);
  doc.setDrawColor(201, 162, 39);
  doc.setLineWidth(0.8);
  doc.line(margin, 50, margin + 40, 50);

  for (const pos of positions) {
    if (pos.page !== currentPage) {
      drawFooter();
      doc.addPage();
      currentPage = pos.page;
      drawPageHeader(currentPage, totalPages);
    }
    const l = rows[pos.i];
    const photo = photos[pos.i];
    const cy = pos.y;

    // Card
    doc.setFillColor(250, 248, 243);
    doc.setDrawColor(226, 221, 207);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, cy, contentW, cardH, 2.5, 2.5, 'FD');

    // Circle avatar centred vertically on the card
    const ax = margin + 8 + photoMm / 2;
    const ay = cy + cardH / 2;
    drawAvatar(photo, l.full_name, ax, ay, photoMm);

    const tx = margin + 8 + photoMm + 6;
    const maxTextW = contentW - photoMm - 18;

    doc.setTextColor(22, 35, 58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(String(l.full_name || '—').slice(0, 55), tx, cy + 9, { maxWidth: maxTextW });

    doc.setTextColor(27, 67, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(String(l.position || '—').slice(0, 70), tx, cy + 15.5, { maxWidth: maxTextW });

    doc.setTextColor(90, 90, 90);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    // Label matches the value: a leader with no faculty on file shows their programme, not a mislabelled "Faculty".
    const acadLine = l.faculty ? `Faculty: ${l.faculty}` : l.programme ? `Programme: ${l.programme}` : 'Faculty: -';
    doc.text(String(acadLine).slice(0, 95), tx, cy + 22, { maxWidth: maxTextW });

    const phone = (l.phone || '').trim() || '—';
    const email = (l.email || '').trim() || '—';
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);
    doc.text(`Phone: ${phone}`, tx, cy + 28.5, { maxWidth: maxTextW * 0.5 });
    doc.text(`Email: ${email}`, tx + maxTextW * 0.45, cy + 28.5, { maxWidth: maxTextW * 0.55 });

    if (l.term_label) {
      doc.setFontSize(7.5);
      doc.setTextColor(150, 120, 30);
      doc.text(`Term: ${l.term_label}`, tx, cy + 34);
    }
  }

  drawFooter();
  doc.save(filename);
}

/**
 * Enrich leaders with faculty, phone, email, avatar from profiles when user_id set.
 */
export async function enrichLeadersForPdf(supabase, leaders) {
  const list = leaders || [];
  const ids = [...new Set(list.map((l) => l.user_id).filter(Boolean))];
  if (!ids.length) return list;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, faculty, programme, phone, email, avatar_url')
    .in('id', ids);
  const map = new Map((profiles || []).map((p) => [p.id, p]));
  return list.map((l) => {
    const p = l.user_id ? map.get(l.user_id) : null;
    if (!p) return l;
    return {
      ...l,
      full_name: l.full_name || p.full_name,
      faculty: l.faculty || p.faculty || p.programme || null,
      phone: l.phone || p.phone || null,
      email: l.email || p.email || null,
      avatar_url: l.avatar_url || p.avatar_url || null,
      photo_url: l.photo_url || p.avatar_url || null,
    };
  });
}


/**
 * Show an on-screen preview of the leadership list before downloading.
 * Returns a Promise that resolves with 'download' | 'cancel'.
 */
export function openLeadershipPreview(leaders, opts = {}) {
  return new Promise((resolve) => {
    const existing = document.getElementById('nsa-leadership-pdf-preview');
    if (existing) existing.remove();

    const title = opts.title || 'NSA Leadership';
    const rows = [...(leaders || [])].sort((a, b) => {
      const oa = a.display_order ?? 99, ob = b.display_order ?? 99;
      if (oa !== ob) return oa - ob;
      return String(a.position || '').localeCompare(String(b.position || ''));
    });

    const esc = (s) => String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const cards = rows.map((l) => {
      const photo = l.photo_url || l.avatar_url || '';
      const name = l.full_name || '—';
      const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
      const acadLabel = l.faculty ? 'Faculty' : (l.programme ? 'Programme' : 'Faculty');
      const faculty = l.faculty || l.programme || '—';
      const phone = (l.phone || '').trim() || '—';
      const email = (l.email || '').trim() || '—';
      const avatar = photo
        ? `<img src="${esc(photo)}" alt="" class="nsa-pdf-av" />`
        : `<span class="nsa-pdf-av-fallback">${esc(initials)}</span>`;
      return `<article class="nsa-pdf-card">
        <div class="nsa-pdf-av-wrap">${avatar}</div>
        <div class="nsa-pdf-meta">
          <div class="nsa-pdf-name">${esc(name)}</div>
          <div class="nsa-pdf-pos">${esc(l.position || '—')}</div>
          <div class="nsa-pdf-line"><span>${acadLabel}</span> ${esc(faculty)}</div>
          <div class="nsa-pdf-line"><span>Phone</span> ${esc(phone)}</div>
          <div class="nsa-pdf-line"><span>Email</span> ${esc(email)}</div>
          ${l.term_label ? `<div class="nsa-pdf-term">Term: ${esc(l.term_label)}</div>` : ''}
        </div>
      </article>`;
    }).join('') || '<p class="nsa-pdf-empty">No leaders in this selection.</p>';

    const overlay = document.createElement('div');
    overlay.id = 'nsa-leadership-pdf-preview';
    overlay.innerHTML = `
      <style>
        #nsa-leadership-pdf-preview {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(15, 23, 32, 0.55);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem; box-sizing: border-box;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-dialog {
          background: #fff; color: #16233a;
          width: min(720px, 100%);
          max-height: min(90vh, 900px);
          border-radius: 14px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.28);
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-head {
          background: linear-gradient(135deg, #1b4332, #16233a);
          color: #fff; padding: 1rem 1.25rem;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-head h3 {
          margin: 0 0 0.25rem; font-size: 1.15rem; color: #fff;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-head p {
          margin: 0; font-size: 0.82rem; opacity: 0.88;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-body {
          overflow: auto; padding: 1rem 1.15rem;
          background: #f7f4ec;
          flex: 1;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-card {
          display: flex; gap: 0.9rem; align-items: center;
          background: #fff; border: 1px solid #e2ddcf;
          border-radius: 12px; padding: 0.75rem 0.9rem;
          margin-bottom: 0.65rem;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-av-wrap {
          flex-shrink: 0; width: 64px; height: 64px;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-av {
          width: 64px; height: 64px; border-radius: 50%;
          object-fit: cover; object-position: center 20%;
          border: 2px solid #c9a227; display: block;
          background: #eef1f5;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-av-fallback {
          width: 64px; height: 64px; border-radius: 50%;
          background: #1b4332; color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 1rem;
          border: 2px solid #c9a227;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-name {
          font-weight: 700; font-size: 1rem; color: #16233a;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-pos {
          font-weight: 600; font-size: 0.9rem; color: #1b4332;
          margin-bottom: 0.25rem;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-line {
          font-size: 0.8rem; color: #555; line-height: 1.35;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-line span {
          color: #888; font-weight: 600; margin-right: 0.25rem;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-term {
          font-size: 0.75rem; color: #a16207; margin-top: 0.2rem;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-empty {
          text-align: center; color: #666; padding: 2rem 1rem;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-foot {
          display: flex; flex-wrap: wrap; gap: 0.5rem;
          justify-content: flex-end; align-items: center;
          padding: 0.85rem 1.15rem;
          border-top: 1px solid #e2ddcf;
          background: #fff;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-foot button {
          border: none; border-radius: 8px; padding: 0.55rem 1rem;
          font-weight: 600; cursor: pointer; font-size: 0.9rem;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-cancel {
          background: #eef1f5; color: #16233a;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-download {
          background: #1b4332; color: #fff;
        }
        #nsa-leadership-pdf-preview .nsa-pdf-download:disabled {
          opacity: 0.65; cursor: wait;
        }
      </style>
      <div class="nsa-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="nsa-pdf-title">
        <div class="nsa-pdf-head">
          <h3 id="nsa-pdf-title">${esc(title)} — Preview</h3>
          <p>${rows.length} leader${rows.length === 1 ? '' : 's'} · Review before downloading the PDF</p>
        </div>
        <div class="nsa-pdf-body">${cards}</div>
        <div class="nsa-pdf-foot">
          <button type="button" class="nsa-pdf-cancel" data-act="cancel">Cancel</button>
          <button type="button" class="nsa-pdf-download" data-act="download" ${rows.length ? '' : 'disabled'}>Download PDF</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close('cancel');
    });
    overlay.querySelector('[data-act="cancel"]')?.addEventListener('click', () => close('cancel'));
    overlay.querySelector('[data-act="download"]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Generating…';
      close('download');
    });
    document.addEventListener('keydown', function onKey(ev) {
      if (ev.key === 'Escape') {
        document.removeEventListener('keydown', onKey);
        close('cancel');
      }
    });
  });
}

/**
 * Preview first; only generate/save PDF if the user confirms Download.
 */
export async function previewAndDownloadLeadershipPdf(leaders, opts = {}) {
  const action = await openLeadershipPreview(leaders, opts);
  if (action !== 'download') return false;
  await downloadLeadershipPdf(leaders, opts);
  return true;
}
