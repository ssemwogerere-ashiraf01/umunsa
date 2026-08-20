// Vercel serverless: Open Graph share page for crawlers (WhatsApp, Facebook, X)
// Usage: /api/share?type=news&id=<uuid>

const SUPABASE_URL = 'https://xqxtmfijxjdoiclsbcbj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GZCfdfs_n2XndHf-xyPyhw_adNZ_sxe';
const SITE = 'https://umunsa.vercel.app';
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

async function fetchRow(table, id) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
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
      res.end('Missing type or id');
      return;
    }

    const row = await fetchRow(cfg.table, id);
    if (!row) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not found');
      return;
    }

    const title = row[cfg.title] || 'Nkobazambogo Students\' Association';
    const rawBody = row[cfg.body] || '';
    const description = String(rawBody).replace(/\s+/g, ' ').trim().slice(0, 180);
    let image = (cfg.image && row[cfg.image]) || DEFAULT_IMAGE;
    if (image && image.startsWith('/')) image = SITE + image;
    const pageUrl = cfg.page(id);
    const shareUrl = `${SITE}/api/share?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;

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
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
<link rel="canonical" href="${escapeHtml(pageUrl)}" />
<meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}" />
<script>location.replace(${JSON.stringify(pageUrl)});</script>
</head>
<body>
  <p>Opening <a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.end(html);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end(String(err.message || err));
  }
};
