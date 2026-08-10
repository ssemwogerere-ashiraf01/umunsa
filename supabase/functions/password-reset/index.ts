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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM") || "Nkobazambogo Students' Association <onboarding@resend.dev>";

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const action = body.action || "request";

    if (action === "request") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        return json({ error: "Valid email required." }, 400);
      }

      // Always return generic success to avoid email enumeration
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
          subject: "Nkobazambogo Students' Association — password reset code",
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
    if (action === 'get_question') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return json({ error: 'Valid email required.' }, 400);

      const { data: profile } = await admin
        .from('profiles')
        .select('id, security_question')
        .ilike('email', email)
        .maybeSingle();

      if (!profile || !profile.security_question) {
        // Don't reveal whether the email exists — return generic ok without question
        return json({ ok: true });
      }

      return json({ ok: true, question: profile.security_question });
    }

    // Confirm a security-question-based reset: verify answer then update password
    if (action === 'confirm_question') {
      const email = String(body.email || '').trim().toLowerCase();
      const answer = String(body.answer || '');
      const password = String(body.password || '');
      if (!email || !answer || password.length < 8) return json({ error: 'Email, answer, and password (min 8 chars) required.' }, 400);

      const { data: profile } = await admin
        .from('profiles')
        .select('id, security_answer_hash')
        .ilike('email', email)
        .maybeSingle();

      if (!profile || !profile.security_answer_hash) return json({ error: 'Invalid email or no security question set.' }, 400);

      // Normalize answer in the same way clients do: trim + lower
      const normalized = answer.trim().toLowerCase();
      const enc = new TextEncoder();
      const digest = await crypto.subtle.digest('SHA-256', enc.encode(normalized));
      const hashHex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashHex !== profile.security_answer_hash) {
        return json({ error: 'Incorrect answer.' }, 400);
      }

      const { error: pwErr } = await admin.auth.admin.updateUserById(profile.id, { password });
      if (pwErr) return json({ error: pwErr.message }, 400);

      return json({ ok: true, message: 'Password updated. You can sign in now.' });
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
