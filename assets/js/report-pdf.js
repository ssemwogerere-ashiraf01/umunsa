/**
 * Admin PDF reports:
 *   - vacant leadership positions
 *   - filled leadership positions (current leaders)
 *   - news (one post, or every post)
 *
 * Self-contained on purpose: it only relies on `downloadLeadershipPdf` and
 * `enrichLeadersForPdf` from leadership-pdf.js, both of which already exist.
 */
import { CANONICAL_ORIGIN, SITE_SHORT_SEAL } from './site-config.js';
import { downloadLeadershipPdf } from './leadership-pdf.js';

const JSPDF_SOURCES = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
  'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
];

const ORG_NAME = "NKOBAZAMBOGO STUDENTS' ASSOCIATION";
const GREEN = [27, 67, 50];
const GOLD = [212, 175, 55];
const NAVY = [22, 35, 58];
const RULE = [226, 221, 207];

const MARGIN = 14;
const HEADER_H = 28;
const BODY_TOP = HEADER_H + 8;   // first y available on every page
const FOOTER_RESERVE = 18;       // keep clear of the footer at the bottom

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

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
    throw last || new Error('Could not load the PDF library (check your internet connection).');
  })();
  return jsPdfPromise;
}

/** jsPDF's built-in fonts only cover Latin-1: swap typographic characters and drop the rest (emoji etc.). */
function pdfSafe(input) {
  return String(input ?? '')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u2022\u25CF\u25E6]/g, '-')
    .replace(/[\u00A0\u2007\u202F\u2009\u200A]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\n\t\u0020-\u007E\u00A1-\u00FF]/g, '');
}

function slug(text, fallback = 'file') {
  const s = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return s || fallback;
}

function fmtDate(value, withTime = false) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const opts = { day: 'numeric', month: 'long', year: 'numeric' };
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return d.toLocaleString('en-GB', opts);
}

function parseSettingString(val, fallback) {
  if (val == null) return fallback;
  const s = typeof val === 'string' ? val : String(val);
  return s.replace(/^"|"$/g, '') || fallback;
}

/** Green banner on every page + footer with page numbers. Call once, after all content is drawn. */
function decoratePages(doc, subtitle, footerRight) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, pageW, HEADER_H, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(ORG_NAME, MARGIN, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(SITE_SHORT_SEAL || 'NSA', pageW - MARGIN, 12, { align: 'right' });
    doc.setTextColor(230, 230, 230);
    doc.setFontSize(8);
    doc.text(pdfSafe(subtitle), MARGIN, 20);
    doc.setTextColor(180, 180, 180);
    doc.text(`Page ${p} of ${total}`, pageW - MARGIN, 20, { align: 'right' });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, pageH - 12, pageW - MARGIN, pageH - 12);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated ${new Date().toLocaleString('en-GB')} | ${CANONICAL_ORIGIN}`, MARGIN, pageH - 7);
    doc.text(pdfSafe(footerRight), pageW - MARGIN, pageH - 7, { align: 'right' });
  }
}

function drawTitleBlock(doc, title, line) {
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pdfSafe(title), MARGIN, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(pdfSafe(line), MARGIN, 49);
  doc.setDrawColor(201, 162, 39);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, 52, MARGIN + 40, 52);
}

/* ------------------------------------------------------------------ */
/* leadership data                                                     */
/* ------------------------------------------------------------------ */

/**
 * The same seat has existed under several names over time
 * ("Information Minister", "Information Secretary", "Secretary for Information").
 * This collapses all of them to one key so a seat is listed once and a leader
 * holding any of the names fills it.
 */
export function seatKey(name) {
  const s = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\band\b/g, '&');
  let deputy = false;
  let topic = s;
  let m = topic.match(/^deputy (.+)$/);
  if (m) { deputy = true; topic = m[1]; }
  if ((m = topic.match(/^(?:secretary|minister) (?:for|of) (?:the )?(.+)$/))) topic = m[1];
  else if ((m = topic.match(/^(.+) (?:secretary|minister)$/))) topic = m[1];
  return (deputy ? 'deputy ' : '') + topic;
}

const smallWords = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'to']);
/** "Faculty Of Business Administration And Management" -> "Faculty of Business Administration and Management" */
function tidyAcademic(v) {
  const t = String(v || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.split(' ').map((w, i) => (i > 0 && smallWords.has(w.toLowerCase()) ? w.toLowerCase() : w)).join(' ');
}

/** Ugandan numbers written as 0751428550., +2560744072651, 256..., etc. -> +256751428550 */
function tidyPhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+2560')) d = '+256' + d.slice(5);
  else if (d.startsWith('2560')) d = '+256' + d.slice(4);
  else if (d.startsWith('256') && d.length === 12) d = '+' + d;
  else if (d.startsWith('0') && d.length === 10) d = '+256' + d.slice(1);
  return d;
}

/** Faculty / contact details for the linked member, kept separate (faculty vs programme). */
async function attachProfiles(supabase, leaders) {
  const ids = [...new Set(leaders.map((l) => l.user_id).filter(Boolean))];
  if (!ids.length) return leaders;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, faculty, programme, phone, email, avatar_url')
    .in('id', ids);
  const byId = new Map((profiles || []).map((p) => [p.id, p]));
  return leaders.map((l) => {
    const p = l.user_id ? byId.get(l.user_id) : null;
    if (!p) return l;
    return {
      ...l,
      full_name: l.full_name || p.full_name,
      faculty: p.faculty || null,
      programme: p.programme || null,
      phone: p.phone || null,
      email: p.email || null,
      photo_url: l.photo_url || p.avatar_url || null,
    };
  });
}

/**
 * Loads seats + current leaders and works out which seats are vacant.
 * - legacy seats are ignored
 * - a seat that exists under several historical names is listed once
 * - a leader holding any name of a seat fills it
 * - a leader still on the retired generic "Faculty Representative / Coordinator"
 *   seat is placed on their own faculty's seat
 */
export async function fetchLeadershipReport(supabase, fallbackTerm = 'Current term') {
  const [posRes, leaderRes, termRes] = await Promise.all([
    supabase.from('positions').select('*').order('display_order'),
    // Only columns that exist on public.leaders; faculty/phone/email come from the linked profile below.
    supabase.from('leaders')
      .select('id, user_id, full_name, position, photo_url, term_label, display_order')
      .eq('is_current', true)
      .order('display_order'),
    supabase.from('club_settings').select('value').eq('key', 'current_leadership_term').maybeSingle(),
  ]);
  if (posRes.error) throw posRes.error;
  if (leaderRes.error) throw leaderRes.error;

  const term = parseSettingString(termRes?.data?.value, fallbackTerm);
  const norm = (x) => String(x || '').trim().toLowerCase();

  const leaders = (await attachProfiles(supabase, leaderRes.data || [])).map((l) => ({
    ...l,
    faculty: tidyAcademic(l.faculty),
    programme: tidyAcademic(l.programme),
    phone: tidyPhone(l.phone),
  }));

  // Live seats, one row per name
  const live = [];
  const seenNames = new Set();
  for (const p of (posRes.data || [])) {
    const key = norm(p.name);
    if (!key || seenNames.has(key)) continue;
    if (key.includes('legacy') || p.scope_value === '__legacy_generic__') continue;
    seenNames.add(key);
    live.push(p);
  }

  // Generic faculty seat -> the leader's own faculty seat
  const facultySeat = new Map(
    live.filter((p) => p.scope_type === 'faculty' && p.scope_value).map((p) => [seatKey(p.scope_value), p.name])
  );
  for (const l of leaders) {
    if (norm(l.position).startsWith('faculty representative / coordinator')) {
      const own = facultySeat.get(seatKey(l.faculty));
      if (own) l.position = own;
    }
  }

  // Collapse renamed seats into one row
  const heldKeys = new Set(leaders.map((l) => seatKey(l.position)));
  const heldNames = new Set(leaders.map((l) => norm(l.position)));
  const groups = new Map();
  for (const p of live) {
    const k = seatKey(p.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const positions = [];
  const displayName = new Map();
  for (const [k, list] of groups) {
    const pick =
      list.find((p) => heldNames.has(norm(p.name))) ||
      list.find((p) => /^(deputy )?secretary for /i.test(p.name)) ||
      list[0];
    const order = Math.min(...list.map((p) => p.display_order ?? 999));
    positions.push({ ...pick, display_order: order });
    displayName.set(k, pick.name);
  }
  positions.sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999) || String(a.name).localeCompare(String(b.name)));
  const orderByKey = new Map(positions.map((p) => [seatKey(p.name), p.display_order ?? 999]));

  const filled = leaders.map((l) => {
    const k = seatKey(l.position);
    return {
      ...l,
      position: displayName.get(k) || l.position,
      full_name: (l.full_name || '').trim() || 'No name recorded',
      term_label: l.term_label || term,
      display_order: orderByKey.get(k) ?? l.display_order ?? 999,
    };
  });

  const vacant = positions.filter((p) => !heldKeys.has(seatKey(p.name)));
  return { term, positions, vacant, filled };
}

/* ------------------------------------------------------------------ */
/* filled positions                                                    */
/* ------------------------------------------------------------------ */

export async function downloadFilledPositionsPdf(report) {
  if (!report.filled.length) throw new Error('There are no current leaders to export yet.');
  await downloadLeadershipPdf(report.filled, {
    title: `Filled Leadership Positions - ${report.term}`,
    subtitle: `Nkobazambogo Students' Association | ${report.term}`,
    filename: `nsa-filled-positions-${slug(report.term)}.pdf`,
  });
}

/* ------------------------------------------------------------------ */
/* vacant positions                                                    */
/* ------------------------------------------------------------------ */

export async function downloadVacantPositionsPdf(report) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const bottom = pageH - FOOTER_RESERVE;
  const contentW = pageW - MARGIN * 2;

  const { term, positions, vacant } = report;
  drawTitleBlock(
    doc,
    `Vacant Leadership Positions - ${term}`,
    `${vacant.length} vacant of ${positions.length} position${positions.length === 1 ? '' : 's'}`
  );

  let y = 62;

  if (!vacant.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text('Every position is currently filled.', MARGIN, y);
    decoratePages(doc, `Nkobazambogo Students' Association | ${term}`, 'Vacant positions report');
    doc.save(`nsa-vacant-positions-${slug(term)}.pdf`);
    return;
  }

  // Group by category, keeping seat order (lowest display_order first).
  const groups = new Map();
  for (const p of vacant) {
    const cat = (p.category || 'Other').trim() || 'Other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(p);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => Math.min(...a[1].map((p) => p.display_order ?? 999)) - Math.min(...b[1].map((p) => p.display_order ?? 999))
  );

  const colNo = MARGIN + 2;
  const colPos = MARGIN + 14;
  const posW = 100;
  const colLg = colPos + posW + 4;
  const lgW = pageW - MARGIN - colLg - 2;

  function groupHeading(label, count, cont) {
    doc.setFillColor(240, 236, 224);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, contentW, 7, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...GREEN);
    doc.text(pdfSafe(`${label}${cont ? ' (continued)' : ''}`), MARGIN + 3, y + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(110, 110, 110);
    doc.text(`${count} vacant`, pageW - MARGIN - 3, y + 4.8, { align: 'right' });
    y += 9;
  }

  let n = 0;
  for (const [cat, list] of ordered) {
    if (y + 9 + 20 > bottom) { doc.addPage(); y = BODY_TOP; }
    groupHeading(cat, list.length, false);

    for (const p of list) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const nameLines = doc.splitTextToSize(pdfSafe(p.name), posW);
      const rowH = Math.max(8, nameLines.length * 4.6 + 3.4);

      if (y + rowH > bottom) {
        doc.addPage();
        y = BODY_TOP;
        groupHeading(cat, list.length, true);
      }

      n += 1;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(String(n), colNo, y + 5.4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      doc.text(nameLines, colPos, y + 5.4);

      if (p.name_luganda) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(doc.splitTextToSize(pdfSafe(p.name_luganda), lgW), colLg, y + 5.4);
      }

      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + rowH, pageW - MARGIN, y + rowH);
      y += rowH;
    }
    y += 5;
  }

  decoratePages(doc, `Nkobazambogo Students' Association | ${term}`, 'Vacant positions report');
  doc.save(`nsa-vacant-positions-${slug(term)}.pdf`);
}

/* ------------------------------------------------------------------ */
/* news                                                                */
/* ------------------------------------------------------------------ */

export async function fetchAllNews(supabase) {
  const { data, error } = await supabase
    .from('news')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return data || [];
}

/** Loads an image and returns a downscaled JPEG data-URL with its size, or null (videos, CORS failures, etc.). */
function loadNewsImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        if (!img.naturalWidth) return resolve(null);
        const maxW = 900;
        const scale = Math.min(1, maxW / img.naturalWidth);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.82), w, h });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    const sep = url.includes('?') ? '&' : '?';
    img.src = `${url}${sep}nsa_pdf=1`;
    setTimeout(() => resolve(null), 12000);
  });
}

async function mapWithLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

/**
 * @param {object[]} posts  rows from public.news
 * @param {{ heading?: string|null, filename?: string }} opts  heading: title block on page 1 (omit for a single post)
 */
export async function downloadNewsPdf(posts, opts = {}) {
  const list = (posts || []).filter(Boolean);
  if (!list.length) throw new Error('There is no news to export yet.');

  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const bottom = pageH - FOOTER_RESERVE;
  const contentW = pageW - MARGIN * 2;

  // Cover images make big digests heavy, so only embed them for up to 40 posts.
  const withImages = list.length <= 40;
  const images = withImages
    ? await mapWithLimit(list, 5, (n) => loadNewsImage(n.image_url))
    : list.map(() => null);

  let y = BODY_TOP;
  if (opts.heading) {
    drawTitleBlock(
      doc,
      opts.heading,
      `${list.length} post${list.length === 1 ? '' : 's'} | newest first`
    );
    y = 62;
  }

  const ensure = (h) => {
    if (y + h > bottom) { doc.addPage(); y = BODY_TOP; }
  };

  list.forEach((n, idx) => {
    ensure(45);

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    const titleLines = doc.splitTextToSize(pdfSafe(n.title || 'Untitled'), contentW);
    for (const line of titleLines) {
      ensure(7);
      doc.text(line, MARGIN, y + 5);
      y += 6.6;
    }
    y += 1;

    // Meta
    const meta = [fmtDate(n.published_at)];
    if (n.is_featured) meta.push('Featured');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150, 120, 30);
    doc.text(meta.filter(Boolean).join('  |  '), MARGIN, y + 3.5);
    y += 6;

    if (n.starts_at || n.ends_at) {
      const from = fmtDate(n.starts_at, true);
      const to = fmtDate(n.ends_at, true);
      const line = from && to ? `Event: ${from} to ${to}` : from ? `Starts: ${from}` : `Deadline / ends: ${to}`;
      doc.setTextColor(90, 90, 90);
      doc.text(pdfSafe(line), MARGIN, y + 3.5);
      y += 6;
    }
    y += 1;

    // Cover image
    const im = images[idx];
    if (im) {
      const maxH = 75;
      let w = contentW;
      let h = (im.h / im.w) * w;
      if (h > maxH) { h = maxH; w = (im.w / im.h) * h; }
      ensure(h + 4);
      try {
        doc.addImage(im.dataUrl, 'JPEG', MARGIN, y, w, h, undefined, 'FAST');
        y += h + 4;
      } catch { /* skip a bad image */ }
    }

    // Body text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(40, 40, 40);
    const paragraphs = pdfSafe(n.content || '').split('\n');
    for (const para of paragraphs) {
      if (!para.trim()) { y += 2.6; continue; }
      const lines = doc.splitTextToSize(para, contentW);
      for (const line of lines) {
        ensure(5.4);
        doc.text(line, MARGIN, y + 4);
        y += 5.2;
      }
    }

    // Links
    const links = [
      ['Document', n.document_url],
      ['Link', n.external_url],
    ].filter(([, url]) => url);
    if (links.length) {
      y += 2;
      doc.setFontSize(9);
      for (const [label, url] of links) {
        ensure(6);
        let shown = pdfSafe(url);
        const prefix = `${label}: `;
        const maxW = contentW - doc.getTextWidth(prefix);
        while (shown.length > 8 && doc.getTextWidth(shown) > maxW) shown = shown.slice(0, -2);
        if (shown.length < url.length) shown += '...';
        doc.setTextColor(90, 90, 90);
        doc.text(prefix, MARGIN, y + 4);
        doc.setTextColor(0, 90, 160);
        doc.textWithLink(shown, MARGIN + doc.getTextWidth(prefix), y + 4, { url });
        y += 5;
      }
    }

    // Divider between posts
    if (idx < list.length - 1) {
      y += 5;
      ensure(10);
      doc.setDrawColor(...RULE);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, y, pageW - MARGIN, y);
      y += 8;
    }
  });

  decoratePages(doc, "Nkobazambogo Students' Association | News", 'News');
  const filename = opts.filename || (list.length === 1 ? `nsa-news-${slug(list[0].title, 'post')}.pdf` : 'nsa-news.pdf');
  doc.save(filename);
}
