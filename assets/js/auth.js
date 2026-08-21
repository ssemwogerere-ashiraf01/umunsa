import { supabase, SUPABASE_PUBLISHABLE_KEY } from './supabase-client.js';
import { BASE_URL, isUmuEmail, REQUIRED_EMAIL_DOMAIN } from './site-config.js';

// Replace with your deployed function URL, e.g.
// https://YOUR-PROJECT-REF.supabase.co/functions/v1/login-guard
const LOGIN_GUARD_URL = 'https://xqxtmfijxjdoiclsbcbj.supabase.co/functions/v1/login-guard';

// Expose the functions base so other client code can call Edge Functions
export const FUNCTIONS_BASE = new URL(LOGIN_GUARD_URL).origin;

const functionHeaders = () => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
});

function normalizeEmail(email) {
  let e = (email || '').trim().toLowerCase();
  // Collapse spaces
  e = e.replace(/\s+/g, '');
  const at = e.lastIndexOf('@');
  if (at < 1) return e;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  // Strip trailing/leading dots in local part and collapse ".." 
  local = local.replace(/^\.+|\.+$/g, '').replace(/\.{2,}/g, '.');
  return `${local}@${domain}`;
}

// Self-registration is restricted to @umu.ac.ug addresses. The super admin
// can still add any member on any domain from the Super Admin dashboard
// (that path uses the admin-create-user Edge Function, not this one).
export async function registerWithEmail({ email, password, fullName, phone, registrationNumber, hostel, faculty }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !password) {
    return { error: 'Email and password are required.' };
  }
  const cleanPhone = normalizePhoneForRegister(phone);
  if (!isUmuEmail(cleanEmail)) {
    return { error: `Registration is only open to university emails on ${REQUIRED_EMAIL_DOMAIN} (e.g. name@${REQUIRED_EMAIL_DOMAIN}). If you don't have one, ask a Super Admin to add you directly.` };
  }
  if (!cleanPhone) {
    return { error: 'A valid phone number is required for password reset and account verification.' };
  }

  // Prefer security-definer RPC (works while logged out; RLS blocks direct profiles read)
  try {
    const { data: taken, error: takenErr } = await supabase.rpc('email_already_registered', { p_email: cleanEmail });
    if (!takenErr && taken === true) {
      return { error: 'An account already exists for that email. Use Sign In or reset your password instead of registering again.' };
    }
  } catch (_) { /* fall through */ }

  // Fallback direct check (may be blocked by RLS for anonymous users)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', cleanEmail)
    .maybeSingle();
  if (existingProfile) {
    return { error: 'An account already exists for that email. Use Sign In or reset your password instead of registering again.' };
  }

  const cleanRegistrationNumber = String(registrationNumber || '').trim() || null;
  const cleanHostel = String(hostel || '').trim() || null;
  const cleanFaculty = String(faculty || '').trim() || null;

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: cleanPhone,
        registration_number: cleanRegistrationNumber,
        hostel: cleanHostel,
        faculty: cleanFaculty,
      },
    },
  });
  if (error) {
    const msg = error.message || '';
    if (/already|registered|exists/i.test(msg)) {
      return { error: 'An account already exists for that email. Use Sign In or reset your password instead of registering again.' };
    }
    return { error: msg };
  }

  // If auto-approve is enabled in club_settings, activate pending -> active
  if (data?.user?.id) {
    try {
      await supabase.rpc('maybe_auto_approve_member', { p_user_id: data.user.id });
    } catch (_) { /* ignore if RPC not deployed yet */ }
  }

  if (data?.session) {
    await routeAfterLogin();
    return { data, message: 'Signed in successfully.' };
  }

  // Re-check status for messaging
  let autoOn = false;
  try {
    const { data: enabled } = await supabase.rpc('is_auto_approve_enabled');
    autoOn = !!enabled;
  } catch (_) {}

  return {
    data,
    message: autoOn
      ? 'Account created and approved. You can sign in now.'
      : 'Account created. An admin will review and approve your account before you can sign in.',
  };
}

function normalizePhoneForRegister(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('256')) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('0')) return `+256${digits.slice(1)}`;
  if (digits.length === 9) return `+256${digits}`;
  if (raw.startsWith('+')) return raw.replace(/\s+/g, '');
  return '';
}

export async function loginWithEmail({ email, password, captcha_token, captcha_answer }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !password) {
    return { error: 'Email and password are required.' };
  }
  if (!captcha_token || !captcha_answer) {
    return { error: 'Please complete the CAPTCHA.' };
  }
  const res = await fetch(LOGIN_GUARD_URL, {
    method: 'POST',
    headers: functionHeaders(),
    body: JSON.stringify({ email: cleanEmail, password, captcha_token, captcha_answer }),
  });
  const result = await res.json();
  if (!res.ok) return { error: result.error || 'Login failed.' };

  // Password is correct and the account isn't locked/pending: but no
  // session exists yet. Send a one-time code and require it before this
  // person is actually considered logged in.
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: false },
  });
  if (otpErr) return { error: otpErr.message };

  return { requireOtp: true, email: cleanEmail };
}

export async function loginWithGoogle(options = {}) {
  // Prefer the real browser origin so local/dev and production both work.
  // Supabase Dashboard → Authentication → URL Configuration must list each
  // redirect URL used (login.html and apply.html).
  const path = options.redirectPath || '/login.html';
  const redirectTo = `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        // Hint for Google; domain restriction is also enforced after callback.
        hd: REQUIRED_EMAIL_DOMAIN,
      },
    },
  });

  if (error) return { error: error.message };
  return { started: true };
}

/**
 * Finish Google sign-in after OAuth redirect.
 * Handles both PKCE (?code=) and implicit (#access_token=) return styles.
 * detectSessionInUrl on the client already parses the hash when present.
 */
export async function completeGoogleLoginFromUrl() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const hash = window.location.hash || '';
  const hasHashSession =
    hash.includes('access_token=') || hash.includes('error=') || hash.includes('refresh_token=');

  // Nothing to do if this is a normal page load.
  if (!code && !hasHashSession) return { skipped: true };

  // PKCE: exchange the auth code for a session.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      window.history.replaceState({}, document.title, window.location.pathname);
      return { error: error.message };
    }
  } else if (hasHashSession) {
    // Implicit / detectSessionInUrl path: give the client a moment to parse the hash.
    // If Supabase already stored a session, getUser will succeed.
    await new Promise((r) => setTimeout(r, 50));
  }

  // Clear sensitive tokens from the address bar either way.
  window.history.replaceState({}, document.title, window.location.pathname);

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    // Hash may have contained an OAuth error from Google/Supabase.
    const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    const oauthErr = hashParams.get('error_description') || hashParams.get('error');
    return { error: oauthErr || 'Google sign-in did not complete. Try again.' };
  }

  if (!isUmuEmail(user.email)) {
    await supabase.auth.signOut();
    return {
      error: `Google sign-in is only allowed for ${REQUIRED_EMAIL_DOMAIN} email addresses. If you don't have a ${REQUIRED_EMAIL_DOMAIN} email, ask a Super Admin to add you or register with a university email.`,
    };
  }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('membership_status, full_name, phone, registration_number, hostel, faculty, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    await supabase.auth.signOut();
    return { error: 'There was an error checking your membership status. Please try again or contact an admin.' };
  }

  const path = window.location.pathname || '';
  const onApplyPage = /apply\.html?$/i.test(path) || path.endsWith('/apply');

  // Apply flow: keep session so they can finish the membership form
  if (onApplyPage) {
    if (profile?.membership_status === 'active') {
      await routeAfterLogin();
      return { completed: true, alreadyMember: true };
    }
    if (profile?.membership_status === 'rejected' || profile?.membership_status === 'suspended') {
      await supabase.auth.signOut();
      return { error: 'Your account is not active. Contact an admin for details.' };
    }
    return { needsApplication: true, user, profile: profile || null };
  }

  // Login flow
  if (!profile) {
    return {
      error: `Your Google account uses a ${REQUIRED_EMAIL_DOMAIN} email but you are not a registered member yet. Please apply for membership first.`,
      needsApply: true,
    };
  }

  if (profile.membership_status === 'pending') {
    window.location.href = `${BASE_URL}/pending-approval.html`;
    return { pending: true };
  }

  if (profile.membership_status === 'rejected' || profile.membership_status === 'suspended') {
    await supabase.auth.signOut();
    return { error: 'Your account is not active. Contact an admin for details.' };
  }

  await routeAfterLogin();
  return { completed: true };
}

/** Save membership application details after Google sign-in */
export async function submitMembershipApplication({ fullName, phone, registrationNumber, hostel, faculty, avatarUrl }) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return { error: 'Please sign in with your university Google account first.' };
  if (!isUmuEmail(user.email)) {
    await supabase.auth.signOut();
    return { error: `Only ${REQUIRED_EMAIL_DOMAIN} emails are accepted.` };
  }

  const cleanPhone = normalizePhoneForRegister(phone);
  if (!cleanPhone) {
    return { error: 'A valid phone number is required.' };
  }
  const name = String(fullName || '').trim();
  if (!name) return { error: 'Full name is required.' };
  const reg = String(registrationNumber || '').trim();
  if (!reg) return { error: 'Registration number is required.' };
  const cleanHostel = String(hostel || '').trim();
  if (!cleanHostel) return { error: 'Hall / hostel is required.' };
  const cleanFaculty = String(faculty || '').trim();
  if (!cleanFaculty) return { error: 'Faculty / school is required.' };
  if (!avatarUrl) return { error: 'Profile photo is required.' };

  const payload = {
    full_name: name,
    phone: cleanPhone,
    registration_number: reg,
    hostel: cleanHostel,
    faculty: cleanFaculty,
    avatar_url: avatarUrl,
    onboarding_completed: false,
    updated_at: new Date().toISOString(),
  };

  // Profile should already exist from handle_new_user after first Google sign-in
  const { data: existing } = await supabase.from('profiles').select('id, membership_status').eq('id', user.id).maybeSingle();
  if (!existing) {
    const { error: insErr } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      ...payload,
      membership_status: 'pending',
      onboarding_completed: false,
    });
    if (insErr) return { error: insErr.message };
  } else {
    const { error: upErr } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (upErr) return { error: upErr.message };
  }

  // Auto-approve if enabled
  try {
    await supabase.rpc('maybe_auto_approve_member', { p_user_id: user.id });
  } catch (_) {}

  const { data: refreshed } = await supabase
    .from('profiles')
    .select('membership_status')
    .eq('id', user.id)
    .maybeSingle();

  // Always complete profile (onboarding) before dashboard or pending screen
  window.location.href = `${BASE_URL}/onboarding.html`;
  return { ok: true };
}

// Second step of login: the code from email is the only thing that
// actually establishes a session: a correct password alone never does.
export async function verifyLoginOtp({ email, token }) {
  const { error } = await supabase.auth.verifyOtp({ email: normalizeEmail(email), token, type: 'email' });
  if (error) return { error: error.message };
  return await routeAfterLogin();
}

// Lets the person request a fresh code if the first one expired or didn't arrive.
export async function resendLoginOtp({ email }) {
  const { error } = await supabase.auth.signInWithOtp({ email: normalizeEmail(email), options: { shouldCreateUser: false } });
  if (error) return { error: error.message };
  return { sent: true };
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = `${BASE_URL}/index.html`;
}

/** Required fields before dashboard access */
export function isProfileComplete(profile) {
  if (!profile) return false;
  if (!profile.onboarding_completed) return false;
  const need = [profile.full_name, profile.phone, profile.programme, profile.hostel, profile.faculty];
  return need.every((v) => typeof v === 'string' && v.trim().length > 0);
}

// After any successful login, send the person to the right place based on
// their membership status rather than assuming dashboard.
export async function routeAfterLogin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Session not found.' };

  // Apply auto-approve if the admin has enabled it (covers Google OAuth too)
  try {
    await supabase.rpc('maybe_auto_approve_member', { p_user_id: user.id });
  } catch (_) {}

  const { data: profile } = await supabase
    .from('profiles')
    .select('membership_status, onboarding_completed, full_name, phone, programme, hostel, faculty')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    // New Google user — collect personal details first
    window.location.href = `${BASE_URL}/onboarding.html`;
  } else if (profile.membership_status === 'rejected' || profile.membership_status === 'suspended') {
    await supabase.auth.signOut();
    window.location.href = `${BASE_URL}/login.html?denied=1`;
  } else if (!isProfileComplete(profile)) {
    window.location.href = `${BASE_URL}/onboarding.html`;
  } else if (profile.membership_status === 'pending') {
    window.location.href = `${BASE_URL}/pending-approval.html`;
  } else {
    window.location.href = `${BASE_URL}/dashboard.html`;
  }
  return {};
}

// Run this on login.html/register.html to route users already mid-session
// without showing the form again.
export async function redirectIfAlreadyLoggedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await routeAfterLogin();
}
