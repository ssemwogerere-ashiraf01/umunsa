// admin-create-user — Super Admin only.
// Creates an auth user with ANY email domain, active membership, optional role
// and member_category (student | graduate | lecturer | patron | staff).
//
// Deploy: supabase functions deploy admin-create-user
// Requires sql/012_member_categories_and_create_user_harden.sql

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

const ALLOWED_ROLES = new Set(['member', 'admin', 'super_admin']);
const ALLOWED_CATEGORIES = new Set(['student', 'graduate', 'lecturer', 'patron', 'staff']);

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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, {
        error: 'Not authenticated — your session expired. Sign out and sign in again.',
      });
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
      return json(403, {
        error: 'Only a Super Admin can add members with any email domain.',
      });
    }

    const body = await req.json().catch(() => ({}));
    const fullName = String(body.fullName || body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const roleRaw = String(body.role || 'member').trim().toLowerCase();
    const categoryRaw = String(body.member_category || body.memberCategory || 'student')
      .trim()
      .toLowerCase();
    const phone = String(body.phone || '').trim() || null;
    const hostel = String(body.hostel || '').trim() || null;
    const faculty = String(body.faculty || '').trim() || null;
    const programme = String(body.programme || '').trim() || null;
    const designation = String(body.designation || '').trim() || null;
    const department = String(body.department || '').trim() || null;
    const organization = String(body.organization || '').trim() || null;
    const graduationYearRaw = body.graduation_year ?? body.graduationYear;
    const graduation_year =
      graduationYearRaw !== undefined && graduationYearRaw !== null && String(graduationYearRaw).trim() !== ''
        ? parseInt(String(graduationYearRaw), 10)
        : null;

    if (!fullName) return json(400, { error: 'Full name is required.' });
    if (!email || !email.includes('@')) return json(400, { error: 'A valid email is required.' });
    if (!password || password.length < 8) {
      return json(400, { error: 'Password must be at least 8 characters.' });
    }

    const role = ALLOWED_ROLES.has(roleRaw) ? roleRaw : 'member';
    const member_category = ALLOWED_CATEGORIES.has(categoryRaw) ? categoryRaw : 'student';

    const metaFlags = {
      added_by_super_admin: true,
      intended_role: role,
      member_category,
      created_by: callerId,
    };

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
        designation: designation || '',
        department: department || '',
        organization: organization || '',
        graduation_year:
          graduation_year != null && !Number.isNaN(graduation_year) ? String(graduation_year) : '',
        member_category,
        intended_role: role,
        added_by_super_admin: true,
        must_change_password: true,
      },
      app_metadata: metaFlags,
    });

    if (createErr) {
      const msg = createErr.message || String(createErr);
      if (/already.*(registered|exists|been)/i.test(msg) || (createErr as { status?: number }).status === 422) {
        return json(409, {
          error: `An account with ${email} already exists. Open Supabase → Authentication → Users, delete or reuse that account, or pick a different email.`,
        });
      }
      if (/database error creating new user/i.test(msg)) {
        return json(500, {
          error:
            'Database error creating new user. Run sql/012_member_categories_and_create_user_harden.sql in the Supabase SQL Editor, then redeploy this function. Also check Authentication → Users for a partial account with this email. Underlying: ' +
            msg,
        });
      }
      return json(400, { error: msg });
    }

    const newUser = created?.user;
    if (!newUser?.id) {
      return json(500, { error: 'User was not returned by Auth Admin API.' });
    }

    const profilePayload: Record<string, unknown> = {
      id: newUser.id,
      email,
      full_name: fullName,
      phone,
      hostel,
      faculty,
      programme,
      designation,
      department,
      organization,
      member_category,
      is_alum: member_category === 'graduate',
      role,
      membership_status: 'active',
      onboarding_completed: true,
      added_by_super_admin: true,
      approved_by: callerId,
      approved_at: new Date().toISOString(),
      assigned_admin_by: role === 'admin' || role === 'super_admin' ? callerId : null,
      assigned_admin_at: role === 'admin' || role === 'super_admin' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    if (graduation_year != null && !Number.isNaN(graduation_year)) {
      profilePayload.graduation_year = graduation_year;
    }

    const { error: upsertErr } = await adminClient.from('profiles').upsert(profilePayload, {
      onConflict: 'id',
    });

    if (upsertErr) {
      return json(500, {
        error: `Auth user created but profile update failed: ${upsertErr.message}. Login exists under Authentication → Users; complete the profile for ${email}.`,
        user_id: newUser.id,
      });
    }

    return json(200, {
      ok: true,
      user_id: newUser.id,
      email,
      role,
      member_category,
      message: `Account created for ${email} as ${role} (${member_category}).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { error: message });
  }
});
