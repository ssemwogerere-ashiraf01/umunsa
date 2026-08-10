import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ---------------------------------------------------------------------------
// Math CAPTCHA: HMAC-signed token, no database required.
// Token format: base64url(payload).base64url(hmac)
// payload: "a+b|answer|expiryMs"
// ---------------------------------------------------------------------------
function b64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let s = btoa(String.fromCharCode(...raw));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(b64);
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(new Uint8Array(sig));
}

async function createCaptcha(secret: string) {
  const a = 2 + Math.floor(Math.random() * 8); // 2-9
  const b = 1 + Math.floor(Math.random() * 9); // 1-9
  const answer = a + b;
  const exp = Date.now() + 5 * 60 * 1000; // 5 minutes
  const payload = `${a}+${b}|${answer}|${exp}`;
  const sig = await hmacSign(secret, payload);
  return {
    question: `What is ${a} + ${b}?`,
    token: `${b64url(payload)}.${sig}`,
  };
}

async function verifyCaptcha(
  secret: string,
  token: unknown,
  answer: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = String(token || "").trim();
  const ans = String(answer ?? "").trim();
  if (!t || !ans) return { ok: false, error: "CAPTCHA is required." };
  if (!/^\d+$/.test(ans)) return { ok: false, error: "CAPTCHA answer must be a number." };

  const parts = t.split(".");
  if (parts.length !== 2) return { ok: false, error: "Invalid CAPTCHA. Refresh and try again." };

  let payload: string;
  try {
    payload = fromB64url(parts[0]);
  } catch {
    return { ok: false, error: "Invalid CAPTCHA. Refresh and try again." };
  }

  const expectedSig = await hmacSign(secret, payload);
  if (expectedSig !== parts[1]) {
    return { ok: false, error: "Invalid CAPTCHA. Refresh and try again." };
  }

  const segs = payload.split("|");
  if (segs.length !== 3) return { ok: false, error: "Invalid CAPTCHA. Refresh and try again." };
  const expectedAnswer = segs[1];
  const exp = Number(segs[2]);
  if (!Number.isFinite(exp) || Date.now() > exp) {
    return { ok: false, error: "CAPTCHA expired. Refresh and try again." };
  }
  if (String(Number(ans)) !== expectedAnswer) {
    return { ok: false, error: "Incorrect CAPTCHA answer." };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM") || "Nkobazambogo Students' Association <onboarding@resend.dev>";
    const captchaSecret = Deno.env.get("CAPTCHA_SECRET") || serviceKey;

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body.action || "request";

    // Issue a fresh math CAPTCHA challenge (public)
    if (action === "get_captcha") {
      const captcha = await createCaptcha(captchaSecret);
      return json({ ok: true, ...captcha });
    }

    if (action === "request") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return json({ error: "Valid email required." }, 400);
      }

      const generic = {
        ok: true,
        message: "If that email is registered, a reset code is on its way.",
      };

      const { data: profile } = await admin
        .from("profiles")
        .select("id, email, full_name")
        .ilike("email", email)
        .maybeSingle();

      if (!profile?.id) {
        return json(generic);
      }

      if (!resendKey) {
        console.error("RESEND_API_KEY missing");
        return json({ error: "Email service not configured (RESEND_API_KEY)." }, 500);
      }

      const code = randomCode();
      const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await admin.from("password_reset_codes").insert({
        email,
        user_id: profile.id,
        code,
        expires_at: expires,
      });

      const html = `
        <p>Hello${profile.full_name ? " " + profile.full_name : ""},</p>
        <p>Your Nkobazambogo Students' Association password reset code is:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${code}</p>
        <p>This code expires in 15 minutes. If you did not request it, ignore this email.</p>
      `;

      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "Nkobazambogo Students' Association - password reset code",
          html,
        }),
      });

      if (!mailRes.ok) {
        const errText = await mailRes.text();
        console.error("Resend error", errText);
        return json({ error: "Could not send email. Check RESEND_API_KEY / RESEND_FROM." }, 500);
      }

      return json(generic);
    }

    // Return the stored security question for a given email (if present).
    if (action === "get_question") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return json({ error: "Valid email required." }, 400);

      const captchaCheck = await verifyCaptcha(captchaSecret, body.captcha_token, body.captcha_answer);
      if (!captchaCheck.ok) return json({ error: captchaCheck.error }, 400);

      const { data: profile } = await admin
        .from("profiles")
        .select("id, security_question")
        .ilike("email", email)
        .maybeSingle();

      if (!profile || !profile.security_question) {
        return json({
          ok: false,
          error: "No security question is set for this account. You cannot reset your password this way. Sign in (if you can) and set one under Profile, or contact an administrator for help.",
        }, 400);
      }

      return json({ ok: true, question: profile.security_question });
    }

    // Confirm a security-question-based reset: verify answer then update password
    if (action === "confirm_question") {
      const email = String(body.email || "").trim().toLowerCase();
      const answer = String(body.answer || "");
      const password = String(body.password || "");
      if (!email || !answer || password.length < 8) {
        return json({ error: "Email, answer, and password (min 8 chars) required." }, 400);
      }

      const captchaCheck = await verifyCaptcha(captchaSecret, body.captcha_token, body.captcha_answer);
      if (!captchaCheck.ok) return json({ error: captchaCheck.error }, 400);

      const { data: profile } = await admin
        .from("profiles")
        .select("id, security_answer_hash")
        .ilike("email", email)
        .maybeSingle();

      if (!profile || !profile.security_answer_hash) {
        return json({ error: "Invalid email or no security question set." }, 400);
      }

      const normalized = answer.trim().toLowerCase();
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest("SHA-256", enc.encode(normalized));
      const hashHex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");

      if (hashHex !== profile.security_answer_hash) {
        return json({ error: "Incorrect answer." }, 400);
      }

      const { error: pwErr } = await admin.auth.admin.updateUserById(profile.id, { password });
      if (pwErr) return json({ error: pwErr.message }, 400);

      return json({ ok: true, message: "Password updated. You can sign in now." });
    }

    if (action === "confirm") {
      const email = String(body.email || "").trim().toLowerCase();
      const code = String(body.code || "").trim();
      const password = String(body.password || "");
      if (!email || !code || password.length < 8) {
        return json({ error: "Email, code, and password (min 8 chars) required." }, 400);
      }

      const { data: row } = await admin
        .from("password_reset_codes")
        .select("*")
        .eq("email", email)
        .eq("code", code)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!row) {
        return json({ error: "Invalid or expired code." }, 400);
      }

      const { error: pwErr } = await admin.auth.admin.updateUserById(row.user_id, {
        password,
      });
      if (pwErr) {
        return json({ error: pwErr.message }, 400);
      }

      await admin
        .from("password_reset_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("id", row.id);

      return json({ ok: true, message: "Password updated. You can sign in now." });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "Server error" }, 500);
  }
});
