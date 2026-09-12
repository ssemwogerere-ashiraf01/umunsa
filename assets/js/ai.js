// UMUNSA AI client — multi-turn chat with WebSocket streaming (+ HTTP/SSE fallback).
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-client.js';

const AI_URL = `${SUPABASE_URL}/functions/v1/ai-assist`;
const HISTORY_KEY = 'umunsa_ai_chat_v1';
const MAX_TURNS = 20;

function wsUrl() {
  const u = new URL(AI_URL);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

export async function askAI({ task = 'general', prompt, context = '', history = [], onToken } = {}) {
  const clean = String(prompt || '').trim();
  if (!clean) return { error: 'Enter a question or some text first.' };

  // Prefer WebSocket streaming when onToken provided
  if (typeof onToken === 'function') {
    const streamed = await askAIWebSocket({ task, prompt: clean, context, history, onToken });
    if (!streamed.error || !/WebSocket|failed to connect|not allowed/i.test(streamed.error || '')) {
      return streamed;
    }
    // Fall through to SSE / HTTP
  }

  const sse = await askAISSE({ task, prompt: clean, context, history, onToken });
  if (!sse.error) return sse;

  return askAIHttp({ task, prompt: clean, context, history });
}

async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || SUPABASE_PUBLISHABLE_KEY;
}

/** WebSocket real-time token stream */
export function askAIWebSocket({ task = 'faq', prompt, context = '', history = [], onToken } = {}) {
  return new Promise(async (resolve) => {
    let settled = false;
    let full = '';
    let socket;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      try { socket?.close(); } catch { /* */ }
      resolve({ error });
    };
    const ok = (payload) => {
      if (settled) return;
      settled = true;
      try { socket?.close(); } catch { /* */ }
      resolve(payload);
    };

    try {
      const token = await getAuthToken();
      socket = new WebSocket(wsUrl());
      const timer = setTimeout(() => fail('WebSocket timed out'), 90000);

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: 'chat',
          task,
          prompt: String(prompt).slice(0, 8000),
          context: String(context || '').slice(0, 12000),
          history: (history || []).slice(-MAX_TURNS * 2),
          authorization: `Bearer ${token}`,
        }));
      };

      socket.onmessage = (ev) => {
        let msg = {};
        try { msg = JSON.parse(String(ev.data || '{}')); } catch { return; }
        if (msg.type === 'token' && msg.text) {
          full += msg.text;
          onToken?.(msg.text, full);
        } else if (msg.type === 'done') {
          clearTimeout(timer);
          ok({ text: msg.text || full, model: msg.model, provider: msg.provider, streamed: true });
        } else if (msg.type === 'error') {
          clearTimeout(timer);
          fail(msg.error || 'AI stream error');
        }
      };

      socket.onerror = () => {
        clearTimeout(timer);
        fail('WebSocket connection failed');
      };
      socket.onclose = () => {
        if (!settled) {
          clearTimeout(timer);
          if (full) ok({ text: full, streamed: true });
          else fail('WebSocket closed early');
        }
      };
    } catch (err) {
      fail(err?.message || 'WebSocket unavailable');
    }
  });
}

/** SSE streaming over HTTP POST */
async function askAISSE({ task, prompt, context, history, onToken }) {
  try {
    const token = await getAuthToken();
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        task,
        prompt: String(prompt).slice(0, 8000),
        context: String(context || '').slice(0, 12000),
        history: (history || []).slice(-MAX_TURNS * 2),
        stream: true,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.error || `AI request failed (${res.status})` };
    }

    const ctype = res.headers.get('content-type') || '';
    if (!ctype.includes('text/event-stream') || !res.body) {
      // Non-stream JSON
      const data = await res.json().catch(() => ({}));
      if (data.text) {
        onToken?.(data.text, data.text);
        return { text: data.text, model: data.model, provider: data.provider };
      }
      return { error: data.error || 'Unexpected response' };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const block of parts) {
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue;
          try {
            const msg = JSON.parse(line.slice(5).trim());
            if (msg.type === 'token' && msg.text) {
              full += msg.text;
              onToken?.(msg.text, full);
            } else if (msg.type === 'done') {
              return { text: msg.text || full, model: msg.model, provider: msg.provider, streamed: true };
            } else if (msg.type === 'error') {
              return { error: msg.error || 'Stream error' };
            }
          } catch { /* */ }
        }
      }
    }
    if (full) return { text: full, streamed: true };
    return { error: 'Empty stream' };
  } catch (err) {
    return { error: err?.message || 'SSE failed' };
  }
}

async function askAIHttp({ task, prompt, context, history }) {
  const token = await getAuthToken();
  try {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        task,
        prompt: String(prompt).slice(0, 8000),
        context: String(context || '').slice(0, 12000),
        history: (history || []).slice(-MAX_TURNS * 2),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `AI request failed (${res.status})` };
    return { text: data.text || '', model: data.model, provider: data.provider };
  } catch (err) {
    return { error: err?.message || 'Network error talking to AI.' };
  }
}

const SESSIONS_KEY = 'umunsa_ai_sessions_v1';

function welcomeMessage() {
  return { role: 'assistant', content: 'Hi! 👋 New chat ready. Ask about membership, elections, activities, and more.' };
}

export function loadChatHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(messages) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify((messages || []).slice(-MAX_TURNS * 2)));
  } catch { /* */ }
}

export function clearChatHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* */ }
}

/** Local multi-session chat history */
export function loadChatSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    // Drop empty drafts that never received a user message
    return list.filter((s) =>
      (s.messages || []).some((m) => m.role === 'user' && String(m.content || '').trim())
    );
  } catch {
    return [];
  }
}

export function saveChatSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify((sessions || []).slice(0, 30)));
  } catch { /* */ }
}

async function currentUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

/** Merge remote Supabase sessions with local (prefer newer updatedAt). */
export async function loadChatSessionsAsync() {
  const local = loadChatSessions();
  const uid = await currentUserId();
  if (!uid) return local;
  try {
    const { data, error } = await supabase
      .from('ai_chat_sessions')
      .select('id, client_id, title, messages, updated_at')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false })
      .limit(30);
    if (error) {
      console.warn('chat sessions remote', error.message);
      return local;
    }
    const remote = (data || []).map((row) => ({
      id: row.client_id || row.id,
      dbId: row.id,
      title: row.title || 'Chat',
      updatedAt: row.updated_at,
      messages: Array.isArray(row.messages) ? row.messages : [],
    }));
    const byId = new Map();
    [...local, ...remote].forEach((s) => {
      const prev = byId.get(s.id);
      if (!prev || new Date(s.updatedAt || 0) >= new Date(prev.updatedAt || 0)) {
        byId.set(s.id, { ...prev, ...s });
      }
    });
    const merged = [...byId.values()].sort(
      (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
    );
    saveChatSessions(merged);
    return merged;
  } catch (e) {
    console.warn('chat sessions', e);
    return local;
  }
}

async function pushSessionRemote(session) {
  const uid = await currentUserId();
  if (!uid || !session?.id) return session;
  const payload = {
    user_id: uid,
    client_id: session.id,
    title: (session.title || 'Chat').slice(0, 120),
    messages: (session.messages || []).slice(-MAX_TURNS * 2),
    updated_at: new Date().toISOString(),
  };
  try {
    const { data, error } = await supabase
      .from('ai_chat_sessions')
      .upsert(payload, { onConflict: 'user_id,client_id' })
      .select('id')
      .maybeSingle();
    // unique index is partial - upsert onConflict may need constraint name
    if (error) {
      // fallback: update-or-insert
      const { data: existing } = await supabase
        .from('ai_chat_sessions')
        .select('id')
        .eq('user_id', uid)
        .eq('client_id', session.id)
        .maybeSingle();
      if (existing?.id) {
        await supabase.from('ai_chat_sessions').update(payload).eq('id', existing.id);
        return { ...session, dbId: existing.id };
      }
      const { data: ins } = await supabase.from('ai_chat_sessions').insert(payload).select('id').maybeSingle();
      if (ins?.id) return { ...session, dbId: ins.id };
      console.warn('chat remote save', error.message);
      return session;
    }
    if (data?.id) return { ...session, dbId: data.id };
  } catch (e) {
    console.warn('chat remote', e);
  }
  return session;
}

export function createNewChatSession() {
  // Draft only — not added to history until the user sends a message
  const id = 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return {
    id,
    title: 'New chat',
    updatedAt: new Date().toISOString(),
    messages: [welcomeMessage()],
    draft: true,
  };
}

export function upsertChatSession(session) {
  if (!session?.id) return session;
  const msgs = session.messages || [];
  const hasUser = msgs.some((m) => m.role === 'user' && String(m.content || '').trim());
  // Only save to history after the user has actually asked something
  if (!hasUser) {
    return { ...session, draft: true };
  }
  const titleFrom =
    msgs.find((m) => m.role === 'user' && m.content)?.content?.slice(0, 40) ||
    session.title ||
    'Chat';
  const next = {
    ...session,
    draft: false,
    title: titleFrom,
    updatedAt: new Date().toISOString(),
    messages: msgs.slice(-MAX_TURNS * 2),
  };
  const all = loadChatSessions().filter((s) => s.id !== next.id);
  all.unshift(next);
  saveChatSessions(all);
  saveChatHistory(next.messages);
  pushSessionRemote(next);
  return next;
}

export function getChatSession(id) {
  return loadChatSessions().find((s) => s.id === id) || null;
}

export function deleteChatSession(id) {
  saveChatSessions(loadChatSessions().filter((s) => s.id !== id));
  currentUserId().then(async (uid) => {
    if (!uid || !id) return;
    try {
      await supabase.from('ai_chat_sessions').delete().eq('user_id', uid).eq('client_id', id);
    } catch (_) { /* */ }
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBubbleText(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

export function mountAiPanel(containerEl, options = {}) {
  if (!containerEl) return null;
  const title = options.title || 'UMUNSA Quick Chat';
  const task = options.task || 'faq';
  const placeholder = options.placeholder || 'Type a message…';
  const persist = options.persist !== false;

  let messages = persist ? loadChatHistory() : [];
  if (!messages.length) {
    messages = [{
      role: 'assistant',
      content: 'Hi! 👋 Have any questions about UMUNSA? Ask away — membership, elections, activities, and more.',
    }];
  }

  containerEl.innerHTML = `
    <div class="ai-chat card" style="display:flex;flex-direction:column;max-height:520px;overflow:hidden;">
      <div class="ai-chat-head" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;padding:0.65rem 0.85rem;border-bottom:1px solid var(--border, #333);">
        <div>
          <strong style="font-size:0.95rem;">${escapeHtml(title)}</strong>
          <div style="font-size:0.75rem;color:var(--text-muted);">Live chat · answers are guidance only</div>
        </div>
        <button type="button" class="mini-btn" data-ai-clear title="Clear chat">Clear</button>
      </div>
      <div class="ai-chat-log" data-ai-log style="flex:1;overflow-y:auto;padding:0.85rem;display:flex;flex-direction:column;gap:0.55rem;min-height:180px;"></div>
      <div class="ai-chat-compose" style="padding:0.65rem 0.75rem;border-top:1px solid var(--border,#333);display:flex;gap:0.45rem;align-items:flex-end;">
        <textarea data-ai-input rows="2" placeholder="${escapeHtml(placeholder)}"
          style="flex:1;resize:none;min-height:44px;max-height:100px;padding:0.55rem 0.7rem;border-radius:12px;border:1px solid var(--border,#444);background:var(--bg-elevated,transparent);color:inherit;font:inherit;"></textarea>
        <button type="button" class="btn btn-gold" data-ai-send style="border-radius:12px;padding:0.55rem 0.9rem;">Send</button>
      </div>
    </div>
  `;

  const logEl = containerEl.querySelector('[data-ai-log]');
  const input = containerEl.querySelector('[data-ai-input]');
  const sendBtn = containerEl.querySelector('[data-ai-send]');
  const clearBtn = containerEl.querySelector('[data-ai-clear]');

  function render() {
    logEl.innerHTML = messages.map((m) => {
      const isUser = m.role === 'user';
      const align = isUser ? 'flex-end' : 'flex-start';
      const bg = isUser ? 'background:#16a34a;color:#fff;' : 'background:#6d28d9;color:#fff;';
      const radius = isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px';
      return `<div style="display:flex;justify-content:${align};">
        <div style="${bg}border-radius:${radius};padding:0.55rem 0.8rem;max-width:92%;font-size:0.9rem;line-height:1.45;white-space:pre-wrap;">${formatBubbleText(m.content)}</div>
      </div>`;
    }).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function send() {
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    messages.push({ role: 'user', content: text });
    const assistantIdx = messages.length;
    messages.push({ role: 'assistant', content: '' });
    render();
    if (persist) {
      saveChatHistory(messages.filter((m) => m.content));
      session = upsertChatSession({ ...session, messages });
    }

    sendBtn.disabled = true;
    const historyForApi = messages
      .slice(0, assistantIdx)
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    const result = await askAI({
      task,
      prompt: text,
      context: options.context || '',
      history: historyForApi.slice(0, -1),
      onToken: (_piece, full) => {
        messages[assistantIdx] = { role: 'assistant', content: full };
        render();
      },
    });

    if (result.error) {
      messages[assistantIdx] = { role: 'assistant', content: result.error };
    } else {
      messages[assistantIdx] = { role: 'assistant', content: result.text || messages[assistantIdx].content || '(No reply)' };
    }
    if (persist) {
      saveChatHistory(messages);
      session = upsertChatSession({ ...session, messages });
    }
    render();
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  const historyBtn = containerEl.querySelector('[data-ai-history]');
  const newBtn = containerEl.querySelector('[data-ai-new]');
  const historyPanel = containerEl.querySelector('[data-ai-history-panel]');

  function renderHistoryList() {
    if (!historyPanel) return;
    const sessions = loadChatSessions();
    historyPanel.innerHTML = sessions.length
      ? sessions.map((s) => {
          const active = s.id === session.id ? 'font-weight:700;color:var(--forest);' : '';
          return `<div style="display:flex;justify-content:space-between;gap:0.5rem;padding:0.35rem 0;border-bottom:1px solid var(--border,#333);">
            <button type="button" data-load-session="${s.id}" style="border:none;background:none;color:inherit;cursor:pointer;text-align:left;flex:1;${active}">${escapeHtml(s.title || 'Chat')} <span style="opacity:0.6;font-size:0.75rem;">${new Date(s.updatedAt).toLocaleString()}</span></button>
            <button type="button" data-del-session="${s.id}" class="mini-btn bad" style="font-size:0.7rem;">×</button>
          </div>`;
        }).join('')
      : '<p style="color:var(--text-muted);margin:0.25rem 0;">No saved chats yet.</p>';
    historyPanel.querySelectorAll('[data-load-session]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const s = getChatSession(btn.getAttribute('data-load-session'));
        if (!s) return;
        session = s;
        messages = s.messages?.length ? s.messages : [welcomeMessage()];
        render();
        historyPanel.hidden = true;
      });
    });
    historyPanel.querySelectorAll('[data-del-session]').forEach((btn) => {
      btn.addEventListener('click', () => {
        deleteChatSession(btn.getAttribute('data-del-session'));
        renderHistoryList();
      });
    });
  }

  historyBtn?.addEventListener('click', () => {
    if (!historyPanel) return;
    historyPanel.hidden = !historyPanel.hidden;
    if (!historyPanel.hidden) renderHistoryList();
  });

  newBtn?.addEventListener('click', () => {
    if (persist) {
      // save current before switching
      if (messages.some((m) => m.role === 'user')) upsertChatSession({ ...session, messages });
      session = createNewChatSession();
    } else {
      session = { id: 'tmp' + Date.now(), title: 'New chat', messages: [welcomeMessage()] };
    }
    messages = session.messages;
    if (historyPanel) historyPanel.hidden = true;
    render();
  });

  render();
  return { askAI, clear: () => newBtn?.click() };
}

export function wireDraftHelper(textarea, options = {}) {
  if (!textarea || textarea.dataset.aiWired) return;
  textarea.dataset.aiWired = '1';
  const wrap = document.createElement('div');
  wrap.className = 'ai-draft-actions';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;margin:0.4rem 0 0.75rem;';
  wrap.innerHTML = `
    <button type="button" class="mini-btn" data-ai-draft>Draft with AI</button>
    <button type="button" class="mini-btn" data-ai-improve>Improve with AI</button>
    <span data-ai-status style="font-size:0.8rem;color:var(--text-muted);align-self:center;"></span>
  `;
  textarea.insertAdjacentElement('afterend', wrap);
  const status = wrap.querySelector('[data-ai-status]');
  const run = async (t) => {
    const prompt =
      t === 'draft'
        ? (textarea.value.trim() || options.hint || 'Write a short association announcement.')
        : textarea.value.trim();
    if (!prompt) {
      status.textContent = 'Add a short outline first.';
      return;
    }
    status.textContent = 'Working…';
    let live = '';
    const result = await askAI({
      task: t,
      prompt,
      context: options.context || '',
      onToken: (_p, full) => {
        live = full;
        textarea.value = full;
      },
    });
    if (result.error) {
      status.textContent = result.error;
      return;
    }
    textarea.value = result.text || live;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    status.textContent = 'Done — review before saving.';
  };
  wrap.querySelector('[data-ai-draft]')?.addEventListener('click', () => run('draft'));
  wrap.querySelector('[data-ai-improve]')?.addEventListener('click', () => run('improve'));
}


/**
 * Admin helper: generate title + body for news/activity/project/forum/feedback.
 * Inserts a small "AI write for me" box above the form fields.
 * @param {{ kind: string, titleEl: HTMLInputElement|null, bodyEl: HTMLTextAreaElement|null, extraEls?: Record<string, HTMLElement|null>, hint?: string }} opts
 */
export function wireAdminPostGenerator(opts) {
  const { kind, titleEl, bodyEl, extraEls = {}, hint } = opts || {};
  if (!bodyEl && !titleEl) return;
  const anchor = titleEl || bodyEl;
  if (!anchor || anchor.dataset.aiPostWired) return;
  if (titleEl) titleEl.dataset.aiPostWired = '1';
  if (bodyEl) bodyEl.dataset.aiPostWired = '1';

  const box = document.createElement('div');
  box.className = 'ai-admin-gen card';
  box.style.cssText = 'margin:0 0 1rem;padding:0.85rem 1rem;border:1px dashed var(--gold,#c9a227);background:var(--bg-elevated,transparent);';
  const kindLabel = {
    news: 'news article',
    activity: 'activity / event',
    project: 'club project',
    forum: 'forum discussion topic',
    feedback: 'feedback form',
    announcement: 'announcement',
  }[kind] || 'post';

  box.innerHTML = `
    <div style="font-weight:700;margin-bottom:0.35rem;">✨ AI write this ${kindLabel}</div>
    <p style="margin:0 0 0.5rem;font-size:0.82rem;color:var(--text-muted);">
      Type a short outline (who, what, when, where). AI fills the title and full text — review before publishing.
    </p>
    <textarea data-ai-outline rows="2" placeholder="${hint || 'e.g. Welcome new first-year members this semester; mention orientation on Friday at Main Hall'}"
      style="width:100%;margin-bottom:0.45rem;border-radius:8px;padding:0.5rem 0.65rem;border:1px solid var(--border,#444);background:transparent;color:inherit;font:inherit;"></textarea>
    <div style="display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;">
      <button type="button" class="mini-btn good" data-ai-gen>Generate</button>
      <button type="button" class="mini-btn" data-ai-improve-body>Improve body only</button>
      <span data-ai-status style="font-size:0.8rem;color:var(--text-muted);"></span>
    </div>
  `;
  const form = anchor.closest('form') || anchor.parentElement;
  form?.insertBefore(box, form.firstChild);

  const outline = box.querySelector('[data-ai-outline]');
  const status = box.querySelector('[data-ai-status]');
  const genBtn = box.querySelector('[data-ai-gen]');
  const improveBtn = box.querySelector('[data-ai-improve-body]');

  const parseStructured = (text) => {
    const out = { title: '', body: '', location: '', questions: '' };
    const tMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/i);
    const bMatch = text.match(/BODY:\s*([\s\S]*?)(?=(?:LOCATION|QUESTIONS):|$)/i);
    const lMatch = text.match(/LOCATION:\s*(.+?)(?:\n|$)/i);
    const qMatch = text.match(/QUESTIONS:\s*([\s\S]*?)$/i);
    if (tMatch) out.title = tMatch[1].trim();
    if (bMatch) out.body = bMatch[1].trim();
    if (lMatch) out.location = lMatch[1].trim();
    if (qMatch) out.questions = qMatch[1].trim();
    if (!out.title && !out.body) {
      // plain text fallback
      const lines = text.trim().split('\n');
      out.title = lines[0].replace(/^#+\s*/, '').slice(0, 120);
      out.body = lines.slice(1).join('\n').trim() || text.trim();
    }
    return out;
  };

  const instructionFor = (mode) => {
    if (mode === 'improve') {
      return 'Improve clarity and grammar of this ' + kindLabel + ' body. Return only the improved body text.';
    }
    if (kind === 'news') {
      return 'Write a UMUNSA news post. Return exactly in this format:\nTITLE: short headline\nBODY: 2-4 short paragraphs for the website, warm student-association tone.';
    }
    if (kind === 'activity') {
      return 'Write a UMUNSA activity/event listing. Return exactly:\nTITLE: event name\nBODY: what members should know (1-3 short paragraphs)\nLOCATION: suggested venue if relevant';
    }
    if (kind === 'project') {
      return 'Write a UMUNSA club project description. Return exactly:\nTITLE: project name\nBODY: goals and how members can join (2-3 short paragraphs).';
    }
    if (kind === 'forum') {
      return 'Write a forum discussion starter for UMUNSA members. Return exactly:\nTITLE: discussion title\nBODY: opening post that invites replies (2 short paragraphs).';
    }
    if (kind === 'feedback') {
      return 'Write a member feedback form for UMUNSA. Return exactly:\nTITLE: form title\nBODY: short description\nQUESTIONS: 4-6 questions, one per line (you may mark some with (rating) or (multiple_choice: A, B, C)).';
    }
    return 'Write content for UMUNSA. Return TITLE: and BODY: lines.';
  };

  genBtn.addEventListener('click', async () => {
    const idea = (outline.value || '').trim() || (bodyEl?.value || '').trim() || (titleEl?.value || '').trim();
    if (!idea) {
      status.textContent = 'Add a short outline first.';
      return;
    }
    genBtn.disabled = true;
    status.textContent = 'Generating…';
    let live = '';
    const result = await askAI({
      task: 'draft',
      prompt: instructionFor('gen') + '\n\nOutline from admin:\n' + idea,
      onToken: (_p, full) => { live = full; },
    });
    genBtn.disabled = false;
    if (result.error) {
      status.textContent = result.error;
      return;
    }
    const parsed = parseStructured(result.text || live);
    if (titleEl && parsed.title) titleEl.value = parsed.title;
    if (bodyEl && parsed.body) bodyEl.value = parsed.body;
    if (extraEls.location && parsed.location) extraEls.location.value = parsed.location;
    if (extraEls.questions && parsed.questions) extraEls.questions.value = parsed.questions;
    titleEl?.dispatchEvent(new Event('input', { bubbles: true }));
    bodyEl?.dispatchEvent(new Event('input', { bubbles: true }));
    status.textContent = 'Filled — review and publish when ready.';
  });

  improveBtn.addEventListener('click', async () => {
    const current = (bodyEl?.value || '').trim();
    if (!current) {
      status.textContent = 'Write or generate a body first.';
      return;
    }
    improveBtn.disabled = true;
    status.textContent = 'Improving…';
    const result = await askAI({
      task: 'improve',
      prompt: current,
      onToken: (_p, full) => { if (bodyEl) bodyEl.value = full; },
    });
    improveBtn.disabled = false;
    if (result.error) {
      status.textContent = result.error;
      return;
    }
    if (bodyEl) bodyEl.value = result.text || bodyEl.value;
    status.textContent = 'Improved — review before saving.';
  });
}
