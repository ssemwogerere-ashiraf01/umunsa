// supabase/functions/admin-create-user/index.ts
//
// Lets the SUPER ADMIN add a member directly — on ANY email domain,
// bypassing the @umu.ac.ug self-registration restriction (see
// sql/004_email_domain_and_roles.sql). Only a super_admin may call this.
//
// Deploy with:
//   supabase functions deploy admin-create-user
//
// No extra secrets to set — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// already injected automatically into every Edge Function's environment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizePhone(phone: unknown) {
  const raw = String(phone || "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("256")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+256${digits.slice(1)}`;
  if (digits.length === 9) return `+256${digits}`;
  if (raw.startsWith("+")) return raw.replace(/\s+/g, "");
  return null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client scoped to the CALLER's JWT — used only to figure out who is calling.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing Authorization header." }, 401);

    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      return jsonResponse({ error: "Could not verify caller identity." }, 401);
    }

    // Only the super admin may add a member directly (this is the path
    // that bypasses the umu.ac.ug email-domain restriction).
    const { data: callerProfile, error: profileLookupErr } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (profileLookupErr || callerProfile?.role !== "super_admin") {
      return jsonResponse({ error: "Only the super admin can add a member directly." }, 403);
    }

    const body = await req.json();
    const { email, password, fullName, phone, programme, yearOfStudy, role } = body;

    if (!email || !password || !fullName) {
      return jsonResponse({ error: "email, password, and fullName are required." }, 400);
    }

    // A super admin may set the new account straight to 'admin' if desired;
    // promoting to 'super_admin' itself still has to happen as a separate,
    // deliberate step from the Super Admin dashboard, not at creation time.
    const finalRole = role === "admin" ? "admin" : "member";

    // From here on, use a full service-role client (bypasses RLS) to do the
    // privileged work: create the auth user, then insert the profile row.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Create the auth user directly, flagged as added by a super admin —
    //    this is what the enforce_email_domain trigger checks to allow any
    //    email domain through.
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // the super admin is vouching for them
      phone: normalizePhone(phone) || undefined,
      user_metadata: { full_name: fullName },
      app_metadata: { added_by_super_admin: true },
    });

    if (createErr) {
      return jsonResponse({ error: createErr.message ?? "Failed to create auth user." }, 400);
    }

    const newUserId = created.user?.id;
    if (!newUserId) {
      return jsonResponse({ error: "Auth user created but no ID was returned." }, 500);
    }

    // 2. The on_auth_user_created trigger already inserted a profile row
    //    (active, onboarding_completed) — update it with the extra details
    //    and requested role.
    const nowIso = new Date().toISOString();
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        phone: phone || null,
        programme: programme || null,
        year_of_study: yearOfStudy || null,
        role: finalRole,
        assigned_admin_by: finalRole === "admin" ? callerUser.id : null,
        assigned_admin_at: finalRole === "admin" ? nowIso : null,
        approved_by: callerUser.id,
        approved_at: nowIso,
      })
      .eq("id", newUserId);

    if (profileErr) {
      // Roll back the auth user so we don't end up with an orphaned account.
      await adminClient.auth.admin.deleteUser(newUserId);
      return jsonResponse({ error: profileErr.message ?? "Failed to finish the profile row." }, 400);
    }

    return jsonResponse({ success: true, userId: newUserId });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected server error." }, 500);
  }
});
