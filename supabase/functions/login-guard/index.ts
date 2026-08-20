// =========================================================================
// login-guard Edge Function
// Deploy with: supabase functions deploy login-guard
// Enforces: 4 failed attempts -> 20 minute lockout, per email.
// Requires a server-issued math CAPTCHA on every password attempt.
// =========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CAPTCHA_SECRET = Deno.env.get('CAPTCHA_SECRET') || SERVICE_ROLE_KEY;

const MAX_ATTEMPTS = 4;
const LOCKOUT_MINUTES = 20;

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// Best-effort location lookup for the login_attempts audit log, alongside
// the raw IP address already captured below. Uses GeoJS (no API key,
// server-side call so it never depends on the client's browser). Never
// throws — a failed/slow lookup just means location stays null; it must
// never block or slow down the login itself by more than ~2.5s.
async function resolveLoginLocation(ip: string): Promise<string | null> {
  if (!ip || ip === 'unknown') return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const parts = [data.city, data.country].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  } catch {
    return null;
  }
}

function b64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let s = btoa(String.fromCharCode(...raw));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return atob(b64);
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return b64url(new Uint8Array(sig));
}

async function verifyCaptcha(
  secret: string,
  token: unknown,
  answer: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = String(token || '').trim();
  const ans = String(answer ?? '').trim();
  if (!t || !ans) return { ok: false, error: 'CAPTCHA is required.' };
  if (!/^\d+$/.test(ans)) return { ok: false, error: 'CAPTCHA answer must be a number.' };

  const parts = t.split('.');
  if (parts.length !== 2) return { ok: false, error: 'Invalid CAPTCHA. Refresh and try again.' };

  let payload: string;
  try {
    payload = fromB64url(parts[0]);
  } catch {
    return { ok: false, error: 'Invalid CAPTCHA. Refresh and try again.' };
  }

  const expectedSig = await hmacSign(secret, payload);
  if (expectedSig !== parts[1]) {
    return { ok: false, error: 'Invalid CAPTCHA. Refresh and try again.' };
  }

  const segs = payload.split('|');
  if (segs.length !== 3) return { ok: false, error: 'Invalid CAPTCHA. Refresh and try again.' };
  const expectedAnswer = segs[1];
  const exp = Number(segs[2]);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return { ok: false, error: 'CAPTCHA expired. Refresh and try again.' };
  }
  if (String(Number(ans)) !== expectedAnswer) {
    return { ok: false, error: 'Incorrect CAPTCHA answer.' };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { email, password, captcha_token, captcha_answer } = body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      return json({ error: 'Email and password are required.' }, 400, corsHeaders);
    }

    const captchaCheck = await verifyCaptcha(CAPTCHA_SECRET, captcha_token, captcha_answer);
    if (!captchaCheck.ok) {
      return json({ error: captchaCheck.error }, 400, corsHeaders);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile } = await admin
      .from('profiles')
      .select('id, locked_until, failed_login_count, membership_status')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (profile?.locked_until && new Date(profile.locked_until) > new Date()) {
      const minsLeft = Math.ceil((new Date(profile.locked_until).getTime() - Date.now()) / 60000);
      return json({ error: `Account locked. Try again in ${minsLeft} minute(s).` }, 423, corsHeaders);
    }

    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });
    const tokenData = await tokenRes.json();
    const success = tokenRes.ok && tokenData.access_token;

    await admin.from('login_attempts').insert({
      email: cleanEmail,
      success,
      ip_address: req.headers.get('x-forwarded-for') ?? 'unknown',
      location: await resolveLoginLocation((req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()),
    });

    if (!success) {
      if (profile) {
        const newCount = (profile.failed_login_count ?? 0) + 1;
        const update: Record<string, unknown> = { failed_login_count: newCount };
        if (newCount >= MAX_ATTEMPTS) {
          update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        }
        await admin.from('profiles').update(update).eq('id', profile.id);
      }
      return json({ error: 'Incorrect email or password.' }, 401, corsHeaders);
    }

    if (profile) {
      await admin.from('profiles').update({ failed_login_count: 0, locked_until: null }).eq('id', profile.id);
    }

    if (profile?.membership_status !== 'active') {
      return json({ error: 'Your account is pending approval. You will be notified once an admin approves you.' }, 403, corsHeaders);
    }

    return json({ success: true }, 200, corsHeaders);
  } catch (e) {
    console.error(e);
    return json({ error: 'Unexpected error. Please try again.' }, 500, corsHeaders);
  }
});
