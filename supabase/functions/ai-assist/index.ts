// ai-assist — UMUNSA AI with HTTP + WebSocket streaming
//
// Secrets:
//   GROQ_API_KEY (recommended)
//   GROQ_MODEL=openai/gpt-oss-20b  (optional)
//   GEMINI_API_KEY / GEMINI_MODEL  (optional fallback)
//
// Deploy:
//   supabase functions deploy ai-assist --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const SYSTEM_CONTEXT = `You are the helpful assistant for UMUNSA — Uganda Martyrs University Nkobazambogo Students' Association (Nkozi, Uganda).
Motto: Togetherness is power (Obumu Geemaanyi).
Facts:
- Self-registration needs @umu.ac.ug email; Super Admin can add other domains.
- Members need approval unless auto-approve is on.
- Features: activities, projects, forum, messages, elections, membership cards.
- Member types: student, graduate/alumni, lecturer, patron, staff.
- Contact: nkobazambogo.umu@gmail.com
Be clear and brief. If unsure, say to contact the association. Never invent election results or private data.`;

const TASK_INSTRUCTIONS: Record<string, string> = {
  faq: 'Answer this member FAQ in 2–5 short sentences with practical steps.',
  draft: 'Write a clear website draft (news/activity/announcement). Warm student-association tone. Return only the draft.',
  summarize: 'Summarize this forum thread in under 180 words with bullets and open questions.',
  improve: 'Improve clarity and grammar. Keep meaning. Return only the improved text.',
  general: 'Help briefly and accurately with this UMUNSA request.',
};

const hits = new Map<string, { n: number; t: number }>();
function rateLimit(key: string, max = 50, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || now - cur.t > windowMs) {
    hits.set(key, { n: 1, t: now });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}

function buildUserPrompt(task: string, prompt: string, context: string) {
  const instruction = TASK_INSTRUCTIONS[task] || TASK_INSTRUCTIONS.general;
  return [
    SYSTEM_CONTEXT,
    '',
    `Task: ${instruction}`,
    context ? `\nExtra context:\n${context}` : '',
    `\nUser input:\n${prompt}`,
  ].join('\n');
}

function parseBodyFields(body: Record<string, unknown>) {
  const task = String(body.task || 'general').toLowerCase();
  const prompt = String(body.prompt || body.question || body.text || '').trim();
  const context = String(body.context || '').trim().slice(0, 12000);
  const historyRaw = Array.isArray(body.history) ? body.history : [];
  const history = historyRaw
    .filter((m: { role?: string; content?: string }) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-24)
    .map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content).slice(0, 2000),
    }));
  return { task, prompt, context, history };
}

async function resolveAuth(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') || '';
  let userId = 'anon';
  let role = 'anon';
  if (authHeader.startsWith('Bearer ')) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user) {
      userId = userData.user.id;
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
      role = profile?.role || 'member';
    }
  }
  return { userId, role, authHeader };
}

function groqModelList(preferred: string, discovered: string[]) {
  const knownFree = [
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'qwen/qwen3-32b',
  ];
  return [preferred, ...knownFree, ...discovered].filter(Boolean);
}

async function discoverGroqModels(apiKey: string): Promise<string[]> {
  try {
    const listRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const listJson = await listRes.json().catch(() => ({}));
    const ids = (listJson?.data || [])
      .map((m: { id?: string }) => m.id)
      .filter((id: string) => typeof id === 'string' && id.length > 0);
    return ids.filter((id: string) => !/whisper|guard|tts|orpheus|prompt-guard/i.test(id));
  } catch {
    return [];
  }
}

function buildGroqMessages(
  fullPrompt: string,
  history: Array<{ role: string; content: string }>,
) {
  const messages: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content:
        'You are UMUNSA AI assistant. Stay on association topics. Be brief and helpful. Use prior messages as conversation context.',
    },
  ];
  for (const h of history) messages.push({ role: h.role, content: h.content });
  messages.push({ role: 'user', content: fullPrompt });
  return messages;
}

/** Non-stream Groq completion */
async function callGroq(
  apiKey: string,
  model: string,
  fullPrompt: string,
  temperature: number,
  history: Array<{ role: string; content: string }> = [],
) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: 1024,
      messages: buildGroqMessages(fullPrompt, history),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, error: data?.error?.message || `Groq error (${res.status})` };
  }
  const text = data?.choices?.[0]?.message?.content?.trim() || '';
  if (!text) return { ok: false as const, error: 'Groq returned an empty response.' };
  return { ok: true as const, text, provider: 'groq', model };
}

/**
 * Stream Groq tokens; calls onToken for each piece.
 * Returns full text or error.
 */
async function streamGroq(
  apiKey: string,
  model: string,
  fullPrompt: string,
  temperature: number,
  history: Array<{ role: string; content: string }>,
  onToken: (t: string) => void,
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: 1024,
      stream: true,
      messages: buildGroqMessages(fullPrompt, history),
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data?.error?.message || `Groq stream error (${res.status})` };
  }
  if (!res.body) return { ok: false, error: 'No stream body from Groq.' };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload);
        const piece = json?.choices?.[0]?.delta?.content || '';
        if (piece) {
          full += piece;
          onToken(piece);
        }
      } catch {
        /* skip partial */
      }
    }
  }
  if (!full) return { ok: false, error: 'Empty stream from Groq.' };
  return { ok: true, text: full, model };
}

function geminiModels(): string[] {
  const preferred = (Deno.env.get('GEMINI_MODEL') || '').trim();
  const defaults = ['gemini-3.0-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
  if (preferred) return [preferred, ...defaults.filter((m) => m !== preferred)];
  return defaults;
}

async function callGemini(apiKey: string, model: string, fullPrompt: string, temperature: number) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: { temperature, maxOutputTokens: 1024 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, error: data?.error?.message || `Gemini error (${res.status})` };
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p: { text?: string }) => p.text || '').join('').trim();
  if (!text) return { ok: false as const, error: 'Gemini returned an empty response.' };
  return { ok: true as const, text, provider: 'gemini', model };
}

async function generateOnce(
  task: string,
  prompt: string,
  context: string,
  history: Array<{ role: string; content: string }>,
  temperature: number,
) {
  const groqKey = (Deno.env.get('GROQ_API_KEY') || '').trim();
  const geminiKey = (Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || '').trim();
  const historyBlock = history.length
    ? '\nPrior conversation:\n' + history.map((h) => `${h.role}: ${h.content}`).join('\n')
    : '';
  const fullPrompt = buildUserPrompt(task, prompt, context + historyBlock);
  const errors: string[] = [];

  if (groqKey) {
    const preferred = (Deno.env.get('GROQ_MODEL') || '').trim();
    const discovered = await discoverGroqModels(groqKey);
    const tried = new Set<string>();
    for (const model of groqModelList(preferred, discovered)) {
      if (tried.has(model)) continue;
      tried.add(model);
      const result = await callGroq(groqKey, model, fullPrompt, temperature, history);
      if (result.ok) return result;
      errors.push(`Groq/${model}: ${result.error}`);
      if (tried.size >= 8) break;
    }
  }
  if (geminiKey) {
    for (const model of geminiModels()) {
      const result = await callGemini(geminiKey, model, fullPrompt, temperature);
      if (result.ok) return result;
      errors.push(`Gemini/${model}: ${result.error}`);
    }
  }
  return {
    ok: false as const,
    error:
      'All AI providers failed. Set GROQ_API_KEY and GROQ_MODEL (e.g. openai/gpt-oss-20b). ' +
      errors.slice(0, 3).join(' | '),
  };
}

/** Stream via Groq only (WebSocket path). */
async function generateStream(
  task: string,
  prompt: string,
  context: string,
  history: Array<{ role: string; content: string }>,
  temperature: number,
  onToken: (t: string) => void,
) {
  const groqKey = (Deno.env.get('GROQ_API_KEY') || '').trim();
  if (!groqKey) {
    // Fall back to non-stream full reply as one "token"
    const once = await generateOnce(task, prompt, context, history, temperature);
    if (!once.ok) return once;
    onToken(once.text);
    return { ok: true as const, text: once.text, provider: once.provider, model: once.model };
  }
  const preferred = (Deno.env.get('GROQ_MODEL') || '').trim();
  const discovered = await discoverGroqModels(groqKey);
  const historyBlock = history.length
    ? '\nPrior conversation:\n' + history.map((h) => `${h.role}: ${h.content}`).join('\n')
    : '';
  const fullPrompt = buildUserPrompt(task, prompt, context + historyBlock);
  const errors: string[] = [];
  const tried = new Set<string>();
  for (const model of groqModelList(preferred, discovered)) {
    if (tried.has(model)) continue;
    tried.add(model);
    const result = await streamGroq(groqKey, model, fullPrompt, temperature, history, onToken);
    if (result.ok) return { ok: true as const, text: result.text, provider: 'groq', model: result.model };
    errors.push(`Groq/${model}: ${result.error}`);
    if (tried.size >= 6) break;
  }
  // Last resort non-stream
  const once = await generateOnce(task, prompt, context, history, temperature);
  if (once.ok) {
    onToken(once.text);
    return once;
  }
  return {
    ok: false as const,
    error: errors.slice(0, 3).join(' | ') || once.error,
  };
}

function handleWebSocket(req: Request): Response {
  const upgrade = Deno.upgradeWebSocket(req);
  const { socket, response } = upgrade;

  socket.onopen = () => {
    socket.send(JSON.stringify({ type: 'ready', message: 'UMUNSA AI WebSocket connected' }));
  };

  socket.onmessage = async (event) => {
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(String(event.data || '{}'));
    } catch {
      socket.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' }));
      return;
    }

    const type = String(body.type || 'chat');
    if (type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    const { task, prompt, context, history } = parseBodyFields(body);
    if (!prompt || prompt.length < 2) {
      socket.send(JSON.stringify({ type: 'error', error: 'Please provide a message.' }));
      return;
    }
    if (prompt.length > 8000) {
      socket.send(JSON.stringify({ type: 'error', error: 'Text is too long.' }));
      return;
    }

    // Auth from message token if provided (browser WS cannot always set Authorization)
    const fakeReq = new Request(req.url, {
      headers: {
        Authorization: String(body.authorization || body.token || req.headers.get('Authorization') || ''),
      },
    });
    const { userId, role } = await resolveAuth(fakeReq);
    if (['draft', 'improve'].includes(task) && role !== 'admin' && role !== 'super_admin') {
      socket.send(JSON.stringify({ type: 'error', error: 'Only admins can use the AI draft helper.' }));
      return;
    }
    if (['draft', 'improve', 'summarize'].includes(task) && userId === 'anon' && role === 'anon') {
      // allow if token invalid but still try; soft check
    }
    if (!rateLimit(`${userId}:ws`)) {
      socket.send(JSON.stringify({ type: 'error', error: 'AI rate limit reached. Try again later.' }));
      return;
    }

    const temperature = task === 'draft' ? 0.7 : 0.4;
    socket.send(JSON.stringify({ type: 'start' }));

    try {
      const result = await generateStream(task, prompt, context, history, temperature, (token) => {
        try {
          socket.send(JSON.stringify({ type: 'token', text: token }));
        } catch {
          /* closed */
        }
      });
      if (!result.ok) {
        socket.send(JSON.stringify({ type: 'error', error: result.error }));
        return;
      }
      socket.send(
        JSON.stringify({
          type: 'done',
          text: result.text,
          model: 'model' in result ? result.model : undefined,
          provider: 'provider' in result ? result.provider : undefined,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      socket.send(JSON.stringify({ type: 'error', error: message }));
    }
  };

  socket.onerror = () => {
    try {
      socket.close();
    } catch {
      /* */
    }
  };

  return response;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // WebSocket upgrade
  if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
    try {
      return handleWebSocket(req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return json(500, { error: 'WebSocket upgrade failed: ' + message });
    }
  }

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const groqKey = (Deno.env.get('GROQ_API_KEY') || '').trim();
    const geminiKey = (Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GOOGLE_AI_API_KEY') || '').trim();
    if (!groqKey && !geminiKey) {
      return json(503, {
        error:
          'No AI key configured. supabase secrets set GROQ_API_KEY=gsk_... && supabase functions deploy ai-assist --no-verify-jwt',
      });
    }

    const body = await req.json().catch(() => ({}));
    const { task, prompt, context, history } = parseBodyFields(body);
    if (!prompt || prompt.length < 2) return json(400, { error: 'Please provide a question or some text.' });
    if (prompt.length > 8000) return json(400, { error: 'Text is too long.' });

    const { userId, role } = await resolveAuth(req);
    if (['draft', 'improve'].includes(task) && role !== 'admin' && role !== 'super_admin') {
      return json(403, { error: 'Only admins can use the AI draft helper.' });
    }
    if (['draft', 'improve', 'summarize'].includes(task) && userId === 'anon') {
      // still require bearer for those tasks
      const authHeader = req.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ') || authHeader.includes(Deno.env.get('SUPABASE_ANON_KEY') || '___')) {
        // anon key only - reject protected tasks
        const { data } = await createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
        ).auth.getUser();
        if (!data?.user) return json(401, { error: 'Sign in required for this AI feature.' });
      }
    }

    if (!rateLimit(`${userId}:${task}`)) {
      return json(429, { error: 'AI rate limit reached. Try again later.' });
    }

    const temperature = task === 'draft' ? 0.7 : 0.4;
    const wantStream = body.stream === true || req.headers.get('Accept') === 'text/event-stream';

    // HTTP SSE streaming
    if (wantStream && groqKey) {
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send = (obj: Record<string, unknown>) => {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
          };
          try {
            send({ type: 'start' });
            const result = await generateStream(task, prompt, context, history, temperature, (token) => {
              send({ type: 'token', text: token });
            });
            if (!result.ok) {
              send({ type: 'error', error: result.error });
            } else {
              send({
                type: 'done',
                text: result.text,
                model: 'model' in result ? result.model : undefined,
                provider: 'provider' in result ? result.provider : undefined,
              });
            }
          } catch (err) {
            send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
          }
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    const result = await generateOnce(task, prompt, context, history, temperature);
    if (!result.ok) return json(502, { error: result.error });
    return json(200, {
      text: result.text,
      task,
      model: 'model' in result ? result.model : undefined,
      provider: 'provider' in result ? result.provider : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { error: message });
  }
});
