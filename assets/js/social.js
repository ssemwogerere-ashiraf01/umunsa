import { supabase } from './supabase-client.js';
import { askAI } from './ai.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Strip @mentions — tagging is disabled */
function sanitizeComment(text) {
  return String(text || '')
    .replace(/@\w+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const VIOLENCE_HINT =
  /kill|murder|bomb|rape|shoot|stab|attack|genocide|behead|terrorist|lynch|bloodbath|i will hurt|i'll hurt/i;

/**
 * AI + keyword gate. Returns { ok:true, text } or { ok:false, reason }.
 */
export async function moderateComment(raw) {
  const text = sanitizeComment(raw);
  if (!text || text.length < 1) return { ok: false, reason: 'Comment is empty.' };
  if (text.length > 2000) return { ok: false, reason: 'Comment is too long.' };
  if (VIOLENCE_HINT.test(text)) {
    return { ok: false, reason: 'This comment was blocked for violent or harmful language.' };
  }
  try {
    const result = await askAI({
      task: 'general',
      prompt:
        'Classify this user comment for a university student association website. Reply with exactly one word: SAFE or VIOLENT.\nComment:\n' +
        text.slice(0, 800),
    });
    const ans = (result.text || '').toUpperCase();
    if (ans.includes('VIOLENT') && !ans.includes('SAFE')) {
      return { ok: false, reason: 'This comment was blocked for violent or harmful language.' };
    }
  } catch {
    /* network — fall through with keyword check only */
  }
  return { ok: true, text };
}

async function recordModerationWarning(userId, reason, blockedText) {
  if (!userId) return;
  try {
    const { data: prof } = await supabase.from('profiles').select('moderation_warnings').eq('id', userId).maybeSingle();
    const n = (prof?.moderation_warnings || 0) + 1;
    await supabase
      .from('profiles')
      .update({
        moderation_warnings: n,
        last_moderation_warning: reason,
        last_moderation_at: new Date().toISOString(),
      })
      .eq('id', userId);
    await supabase.from('user_notifications').insert({
      user_id: userId,
      title: 'Comment blocked — community standards',
      body: `${reason} Warning #${n}. Repeated violations may lead to suspension.`,
      link: '/dashboard.html',
    });
  } catch (e) {
    console.warn('moderation warning', e);
  }
}

async function fetchProfileMap(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (!ids.length) return {};
  const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids);
  const map = {};
  (data || []).forEach((p) => { map[p.id] = p; });
  return map;
}

export async function mountPostSocial(container, { targetType, targetId, currentUserId }) {
  if (!container || !targetType || !targetId) return;

  container.innerHTML = `
    <div class="post-social">
      <button type="button" data-like>♥ Like <span data-like-count>0</span></button>
      <span data-comment-count style="font-size:0.85rem;color:var(--text-muted);">0 comments</span>
    </div>
    <div class="post-comments">
      <div data-comment-list></div>
      <form data-comment-form style="margin-top:0.75rem;display:flex;flex-direction:column;gap:0.4rem;">
        <textarea data-comment-body rows="2" placeholder="Write a comment… (replies and likes allowed; tagging others is disabled)" style="width:100%;border-radius:10px;padding:0.55rem;"></textarea>
        <button type="submit" class="mini-btn good" style="align-self:flex-start;">Comment</button>
        <span data-comment-status style="font-size:0.8rem;color:var(--text-muted);"></span>
      </form>
    </div>
  `;

  const likeBtn = container.querySelector('[data-like]');
  const likeCount = container.querySelector('[data-like-count]');
  const commentCount = container.querySelector('[data-comment-count]');
  const list = container.querySelector('[data-comment-list]');
  const form = container.querySelector('[data-comment-form]');
  const bodyEl = container.querySelector('[data-comment-body]');
  const statusEl = container.querySelector('[data-comment-status]');

  async function refresh() {
    const [{ count: likes }, { data: myLike }, { data: comments, error: cErr }] = await Promise.all([
      supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('target_type', targetType).eq('target_id', targetId),
      currentUserId
        ? supabase.from('post_likes').select('id').eq('target_type', targetType).eq('target_id', targetId).eq('user_id', currentUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('post_comments')
        .select('id, body, created_at, user_id, parent_id')
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .order('created_at', { ascending: true })
        .limit(100),
    ]);

    if (cErr) {
      list.innerHTML = `<p style="color:#b91c1c;font-size:0.85rem;">Comments unavailable: ${escapeHtml(cErr.message)}. Run sql/015 and sql/016 in Supabase.</p>`;
      return;
    }

    likeCount.textContent = String(likes || 0);
    likeBtn.classList.toggle('liked', !!myLike);

    const rows = comments || [];
    commentCount.textContent = `${rows.length} comment${rows.length === 1 ? '' : 's'}`;
    const profiles = await fetchProfileMap(rows.map((c) => c.user_id));

    const { data: clikes } = await supabase
      .from('comment_likes')
      .select('comment_id, user_id')
      .in('comment_id', rows.map((c) => c.id).concat(['00000000-0000-0000-0000-000000000000']));

    const likeMap = {};
    (clikes || []).forEach((l) => {
      likeMap[l.comment_id] = likeMap[l.comment_id] || { count: 0, mine: false };
      likeMap[l.comment_id].count += 1;
      if (currentUserId && l.user_id === currentUserId) likeMap[l.comment_id].mine = true;
    });

    const roots = rows.filter((c) => !c.parent_id);
    const children = rows.filter((c) => c.parent_id);
    const byParent = {};
    children.forEach((c) => {
      (byParent[c.parent_id] = byParent[c.parent_id] || []).push(c);
    });

    function renderOne(c, isReply) {
      const p = profiles[c.user_id] || {};
      const name = p.full_name || 'Member';
      const av = p.avatar_url;
      const initial = name.trim().charAt(0).toUpperCase() || '?';
      const lk = likeMap[c.id] || { count: 0, mine: false };
      return `<div class="post-comment" data-comment-id="${c.id}" style="${isReply ? 'margin-left:2rem;border-left:2px solid var(--border);padding-left:0.75rem;' : ''}">
        <div class="post-comment-avatar">${av ? `<img src="${escapeHtml(av)}" alt="">` : initial}</div>
        <div class="post-comment-body">
          <div class="post-comment-meta"><strong>${escapeHtml(name)}</strong> · ${new Date(c.created_at).toLocaleString()}</div>
          <div>${escapeHtml(c.body)}</div>
          <div style="display:flex;gap:0.5rem;margin-top:0.35rem;font-size:0.8rem;">
            <button type="button" class="mini-btn" data-c-like="${c.id}" style="${lk.mine ? 'color:#e11d48;border-color:#e11d48;' : ''}">♥ ${lk.count}</button>
            ${!isReply ? `<button type="button" class="mini-btn" data-c-reply="${c.id}">Reply</button>` : ''}
          </div>
          <div data-reply-box="${c.id}" hidden style="margin-top:0.4rem;">
            <textarea rows="2" style="width:100%;border-radius:8px;padding:0.4rem;" placeholder="Write a reply…"></textarea>
            <button type="button" class="mini-btn good" data-c-reply-send="${c.id}" style="margin-top:0.3rem;">Post reply</button>
          </div>
        </div>
      </div>`;
    }

    let html = '';
    roots.forEach((c) => {
      html += renderOne(c, false);
      (byParent[c.id] || []).forEach((r) => { html += renderOne(r, true); });
    });
    list.innerHTML = html || '<p style="color:var(--text-muted);font-size:0.85rem;">No comments yet.</p>';

    list.querySelectorAll('[data-c-like]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!currentUserId) { alert('Sign in to like comments.'); return; }
        const cid = btn.getAttribute('data-c-like');
        const { data: existing } = await supabase.from('comment_likes').select('id').eq('comment_id', cid).eq('user_id', currentUserId).maybeSingle();
        if (existing) await supabase.from('comment_likes').delete().eq('id', existing.id);
        else await supabase.from('comment_likes').insert({ comment_id: cid, user_id: currentUserId });
        await refresh();
      });
    });
    list.querySelectorAll('[data-c-reply]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const box = list.querySelector(`[data-reply-box="${btn.getAttribute('data-c-reply')}"]`);
        if (box) box.hidden = !box.hidden;
      });
    });
    list.querySelectorAll('[data-c-reply-send]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!currentUserId) { alert('Sign in to reply.'); return; }
        const parentId = btn.getAttribute('data-c-reply-send');
        const box = list.querySelector(`[data-reply-box="${parentId}"]`);
        const ta = box?.querySelector('textarea');
        const raw = ta?.value || '';
        statusEl.textContent = 'Checking comment…';
        const mod = await moderateComment(raw);
        if (!mod.ok) {
          await recordModerationWarning(currentUserId, mod.reason, raw);
          statusEl.textContent = mod.reason + ' A warning was added to your dashboard.';
          return;
        }
        const { error } = await supabase.from('post_comments').insert({
          user_id: currentUserId,
          target_type: targetType,
          target_id: targetId,
          body: mod.text,
          parent_id: parentId,
        });
        if (error) {
          statusEl.textContent = error.message;
          return;
        }
        statusEl.textContent = '';
        await refresh();
      });
    });
  }

  likeBtn.addEventListener('click', async () => {
    if (!currentUserId) { alert('Sign in to like posts.'); return; }
    const { data: existing } = await supabase
      .from('post_likes')
      .select('id')
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('user_id', currentUserId)
      .maybeSingle();
    if (existing) await supabase.from('post_likes').delete().eq('id', existing.id);
    else await supabase.from('post_likes').insert({ user_id: currentUserId, target_type: targetType, target_id: targetId });
    await refresh();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) { alert('Sign in to comment.'); return; }
    const raw = bodyEl.value;
    statusEl.textContent = 'Checking comment…';
    form.querySelector('button[type="submit"]').disabled = true;
    const mod = await moderateComment(raw);
    if (!mod.ok) {
      await recordModerationWarning(currentUserId, mod.reason, raw);
      statusEl.textContent = mod.reason + ' A warning was added to your dashboard.';
      form.querySelector('button[type="submit"]').disabled = false;
      return;
    }
    const { error } = await supabase.from('post_comments').insert({
      user_id: currentUserId,
      target_type: targetType,
      target_id: targetId,
      body: mod.text,
    });
    form.querySelector('button[type="submit"]').disabled = false;
    if (error) {
      statusEl.textContent = 'Could not save: ' + error.message + ' (Run sql/015 + sql/016 if tables are missing.)';
      return;
    }
    bodyEl.value = '';
    statusEl.textContent = 'Posted.';
    await refresh();
  });

  await refresh();
}
