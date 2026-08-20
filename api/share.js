// Vercel serverless: Open Graph HTML for WhatsApp / Facebook / X crawlers
// Share URL: /api/share?type=news&id=<uuid>  or  /s/news/<uuid>

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xqxtmfijxjdoiclsbcbj.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_GZCfdfs_n2XndHf-xyPyhw_adNZ_sxe';
const SITE = process.env.SITE_URL || 'https://umunsa.vercel.app';
const DEFAULT_IMAGE = `${SITE}/assets/img/og-default.jpg`;

const TABLES = {
  news: {
    table: 'news',
    title: 'title',
    body: 'content',
    image: 'image_url',
    page: (id) => `${SITE}/news-detail.html?id=${encodeURIComponent(id)}`,
  },
  activity: {
    table: 'activities',
    title: 'title',
    body: 'description',
    image: 'image_url',
    page: (id) => `${SITE}/activity-detail.html?id=${encodeURIComponent(id)}`,
  },
  project: {
    table: 'projects',
    title: 'title',
    body: 'description',
    image: 'image_url',
    page: (id) => `${SITE}/project-detail.html?id=${encodeURIComponent(id)}`,
  },
  topic: {
    table: 'forum_topics',
    title: 'title',
    body: 'content',
    image: null,
    page: (id) => `${SITE}/forum/topic.html?id=${encodeURIComponent(id)}`,
  },
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteUrl(u) {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (s.startsWith('//')) return 'https:' + s;
  if (s.startsWith('/')) return SITE + s;
  if (/^https?:\/\//i.test(s)) return s;
  return SITE + '/' + s.replace(/^\.\//, '');
}

function isLikelyImage(url) {
  if (!url) return false;
  const path = url.split('?')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(path) || /\/storage\/v1\/object\/public\//i.test(url);
}

function pickImage(row, cfg) {
  const candidates = [];
  if (cfg.image && row[cfg.image]) candidates.push(row[cfg.image]);
  if (row.image_url) candidates.push(row.image_url);
  if (row.media_url) candidates.push(row.media_url);
  if (row.cover_url) candidates.push(row.cover_url);
  if (row.document_url && isLikelyImage(row.document_url)) candidates.push(row.document_url);
  if (row.attachment_url && isLikelyImage(row.attachment_url)) candidates.push(row.attachment_url);
  for (const c of candidates) {
    const abs = absoluteUrl(c);
    if (abs && isLikelyImage(abs)) return abs;
    if (abs && /supabase\.co\/storage/i.test(abs)) return abs;
  }
  // Prefer any absolute media over default
  for (const c of candidates) {
    const abs = absoluteUrl(c);
    if (abs) return abs;
  }
  return DEFAULT_IMAGE;
}

async function fetchRow(table, id) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`);
  }
  const rows = await res.json();
  return rows[0] || null;
}

module.exports = async function handler(req, res) {
  try {
    const type = String(req.query.type || 'news').toLowerCase();
    const id = String(req.query.id || '').trim();
    const cfg = TABLES[type];
    if (!cfg || !id) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Missing type or id. Use /api/share?type=news&id=<uuid>');
      return;
    }

    const row = await fetchRow(cfg.table, id);
    if (!row) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not found');
      return;
    }

    const title = row[cfg.title] || "Nkobazambogo Students' Association";
    const rawBody = row[cfg.body] || '';
    const description = String(rawBody).replace(/\s+/g, ' ').trim().slice(0, 180) || title;
    const image = pickImage(row, cfg);
    const pageUrl = cfg.page(id);
    const shareUrl = `${SITE}/api/share?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;

    const ua = String(req.headers['user-agent'] || '');
    const isBot = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|twitterbot|linkedinbot|discord|preview|embed/i.test(ua);

    // Humans: redirect to the real page. Bots: stay on this HTML so OG tags are read.
    if (!isBot && req.query.preview !== '1') {
      res.statusCode = 302;
      res.setHeader('Location', pageUrl);
      res.end();
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:site_name" content="Nkobazambogo Students' Association" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(shareUrl)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:secure_url" content="${escapeHtml(image)}" />
<meta property="og:image:type" content="image/jpeg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<link rel="canonical" href="${escapeHtml(pageUrl)}" />
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a></p>
  <p>${escapeHtml(description)}</p>
  <p><img src="${escapeHtml(image)}" alt="" style="max-width:100%;height:auto;" /></p>
</body>
</html>`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.end(html);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end(String(err.message || err));
  }
};
