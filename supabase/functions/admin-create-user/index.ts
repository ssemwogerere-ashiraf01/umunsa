// Super-admin edge function: create a user on any email domain, active immediately.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Not authenticated — missing Authorization bearer token' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    // Pass JWT explicitly so verification does not depend on ambient session state
    const { data: { user: caller }, error: callerErr } = await userClient.auth.getUser(token)
    if (callerErr || !caller) {
      return new Response(JSON.stringify({
        error: 'Not authenticated — invalid or expired session. Sign in again as super admin.',
        detail: callerErr?.message || null,
      }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .maybeSingle()

    if (!profile || profile.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only the super admin can add members this way' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const fullName = String(body.fullName || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const role = body.role === 'admin' ? 'admin' : 'member'
    const phone = String(body.phone || '').trim() || null
    const hostel = body.hostel ? String(body.hostel).trim() : null
    const faculty = body.faculty ? String(body.faculty).trim() : null
    const programme = body.programme ? String(body.programme).trim() : null

    if (!fullName || !email || password.length < 8) {
      return new Response(JSON.stringify({ error: 'Name, email and password (min 8) are required' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
        hostel,
        faculty,
        programme,
      },
      app_metadata: {
        added_by_super_admin: true,
        role,
      },
    })

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message || 'Create failed' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const uid = created.user.id

    // Ensure profile row is active/approved (trigger may already have set this)
    const { error: upErr } = await admin.from('profiles').update({
      full_name: fullName,
      phone,
      hostel,
      faculty,
      programme,
      role,
      membership_status: 'active',
      onboarding_completed: true,
      added_by_super_admin: true,
      approved_by: caller.id,
      approved_at: new Date().toISOString(),
      assigned_admin_by: role === 'admin' ? caller.id : null,
      assigned_admin_at: role === 'admin' ? new Date().toISOString() : null,
    }).eq('id', uid)

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, id: uid, email }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})