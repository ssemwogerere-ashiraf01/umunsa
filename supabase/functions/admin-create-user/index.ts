// admin-create-user — Super Admin only.
// Creates an auth user with ANY email domain, active membership, optional role.
// Deploy: supabase functions deploy admin-create-user --no-verify-jwt
// (JWT is verified inside; service role is used for Auth Admin API.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return json(401, { error: 'Not authenticated — sign in as super admin and retry.' });
    }

    // Caller client (user JWT) — used only to verify super_admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { error: 'Not authenticated — your session expired. Sign out and sign in again.' });
    }

    const callerId = userData.user.id;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: profErr } = await adminClient
      .from('profiles')
      .select('id, role, membership_status')
      .eq('id', callerId)
      .maybeSingle();

    if (profErr || !callerProfile || callerProfile.role !== 'super_admin') {
      return json(403, { error: 'Only a Super Admin can add members with any email domain.' });
    }

    const body = await req.json().catch(() => ({}));
    const fullName = String(body.fullName || body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const roleRaw = String(body.role || 'member').trim().toLowerCase();
    const phone = String(body.phone || '').trim() || null;
    const hostel = String(body.hostel || '').trim() || null;
    const faculty = String(body.faculty || '').trim() || null;
    const programme = String(body.programme || '').trim() || null;

    if (!fullName) return json(400, { error: 'Full name is required.' });
    if (!email || !email.includes('@')) return json(400, { error: 'A valid email is required.' });
    if (!password || password.length < 8) {
      return json(400, { error: 'Password must be at least 8 characters.' });
    }

    const allowedRoles = new Set(['member', 'admin', 'super_admin']);
    const role = allowedRoles.has(roleRaw) ? roleRaw : 'member';
    // Only super_admin may mint another super_admin
    if (role === 'super_admin' && callerProfile.role !== 'super_admin') {
      return json(403, { error: 'Only a Super Admin can create another Super Admin.' });
    }

    // Create auth user — MUST set app_metadata.added_by_super_admin so the
    // enforce_email_domain trigger allows non-@umu.ac.ug addresses.
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || '',
        hostel: hostel || '',
        faculty: faculty || '',
        programme: programme || '',
      },
      app_metadata: {
        added_by_super_admin: true,
        created_by: callerId,
        intended_role: role,
      },
    });

    if (createErr) {
      const msg = createErr.message || String(createErr);
      // Surface the real cause instead of only "Database error creating new user"
      if (/already.*(registered|exists|been)/i.test(msg) || createErr.status === 422) {
        return json(409, {
          error: `An account with ${email} already exists. Use a different email, or reset that user's password from Auth.`,
        });
      }
      if (/database error creating new user/i.test(msg)) {
        return json(500, {
          error:
            'Database error creating new user. Usually the email-domain or profile trigger rejected the insert. ' +
            'Confirm sql/011_admin_create_user_fix.sql has been run, and that app_metadata.added_by_super_admin is accepted. ' +
            `Underlying message: ${msg}`,
        });
      }
      return json(400, { error: msg });
    }

    const newUser = created?.user;
    if (!newUser?.id) {
      return json(500, { error: 'User was not returned by Auth Admin API.' });
    }

    // Ensure profile row has role, contact fields, active status.
    // Uses service role; protect_sensitive_fields is patched in 011 to allow service role.
    const { error: upsertErr } = await adminClient.from('profiles').upsert(
      {
        id: newUser.id,
        email,
        full_name: fullName,
        phone,
        hostel,
        faculty,
        programme,
        role,
        membership_status: 'active',
        onboarding_completed: true,
        added_by_super_admin: true,
        approved_by: callerId,
        approved_at: new Date().toISOString(),
        assigned_admin_by: role === 'admin' || role === 'super_admin' ? callerId : null,
        assigned_admin_at: role === 'admin' || role === 'super_admin' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (upsertErr) {
      // Auth user exists; report profile issue clearly
      return json(500, {
        error: `Auth user created but profile update failed: ${upsertErr.message}. Fix the profile row for ${email} manually or re-run sql/011_admin_create_user_fix.sql.`,
        user_id: newUser.id,
      });
    }

    return json(200, {
      ok: true,
      user_id: newUser.id,
      email,
      role,
      message: `Account created for ${email} as ${role}.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { error: message });
  }
});
