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
  return (email || '').trim().toLowerCase();
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

  const { data: existingProfile, error: existingErr } = await supabase
    .from('profiles')
    .select('id, membership_status')
    .ilike('email', cleanEmail)
    .maybeSingle();

  if (existingErr) return { error: existingErr.message };
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
  if (error) return { error: error.message };

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

export async function loginWithGoogle() {
  // Prefer the real browser origin so local/dev and production both work.
  // Supabase Dashboard → Authentication → URL Configuration must list this
  // exact redirect URL (and Site URL must not be a bogus IP like 0.0.11.184).
  const redirectTo = `${window.location.origin}/login.html`;

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
    .select('membership_status')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    await supabase.auth.signOut();
    return { error: 'There was an error checking your membership status. Please try again or contact an admin.' };
  }

  if (!profile) {
    await supabase.auth.signOut();
    return {
      error: `Your Google account uses a ${REQUIRED_EMAIL_DOMAIN} email but you are not registered as a member. Apply for membership or contact an admin to be added.`,
    };
  }

  if (profile.membership_status === 'pending') {
    await supabase.auth.signOut();
    return { error: 'Your membership application is still pending approval. An admin will review your request.' };
  }

  if (profile.membership_status === 'rejected' || profile.membership_status === 'suspended') {
    await supabase.auth.signOut();
    return { error: 'Your account is not active. Contact an admin for details.' };
  }

  await routeAfterLogin();
  return { completed: true };
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
    .select('membership_status, onboarding_completed')
    .eq('id', user.id)
    .single();

  if (!profile) {
    window.location.href = `${BASE_URL}/pending-approval.html`;
  } else if (!profile.onboarding_completed) {
    window.location.href = `${BASE_URL}/onboarding.html`;
  } else if (profile.membership_status === 'pending') {
    window.location.href = `${BASE_URL}/pending-approval.html`;
  } else if (profile.membership_status === 'rejected' || profile.membership_status === 'suspended') {
    await supabase.auth.signOut();
    window.location.href = `${BASE_URL}/login.html?denied=1`;
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
