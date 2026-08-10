import { supabase } from './supabase-client.js';
import { BASE_URL } from './site-config.js';

// Regular Admin dashboard: role 'admin' or 'super_admin' may enter.
export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = `${BASE_URL}/login.html`; return null; }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!profile || (profile.role !== 'admin' && profile.role !== 'super_admin')) {
    window.location.href = `${BASE_URL}/dashboard.html`;
    return null;
  }
  return profile;
}

// Stricter guard for the super-admin-only dashboard: assigning/removing
// admins, editing club-wide settings, adding members on any email domain,
// and permanent account deletion all live behind this, not requireAdmin().
export async function requireSuperAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = `${BASE_URL}/login.html`; return null; }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!profile || profile.role !== 'super_admin') {
    window.location.href = `${BASE_URL}/admin/index.html`;
    return null;
  }
  return profile;
}
