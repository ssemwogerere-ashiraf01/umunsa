import { supabase } from './supabase-client.js';
import { BASE_URL } from './site-config.js';
import { isProfileComplete } from './auth.js';

const IDLE_LIMIT_MS = 10 * 60 * 1000;   // 10 minutes idle -> logout
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes -> refresh session/data

let idleTimer;

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    await supabase.auth.signOut();
    alert('You have been signed out due to inactivity. Please log in again.');
    window.location.href = `${BASE_URL}/login.html?timeout=1`;
  }, IDLE_LIMIT_MS);
}

['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach((evt) =>
  window.addEventListener(evt, resetIdleTimer, { passive: true })
);
resetIdleTimer();

setInterval(async () => {
  const { error } = await supabase.auth.refreshSession();
  if (error) {
    window.location.href = `${BASE_URL}/login.html?expired=1`;
    return;
  }
  window.dispatchEvent(new CustomEvent('app:refresh'));
}, REFRESH_INTERVAL_MS);

/**
 * Load the signed-in profile or redirect to login.
 * Always redirects incomplete profiles to onboarding.html.
 */
async function loadProfileOrRedirect() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = `${BASE_URL}/login.html`;
    return null;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (!profile) {
    window.location.href = `${BASE_URL}/onboarding.html`;
    return null;
  }
  // Incomplete onboarding → always back to onboarding (even if status is active)
  if (!isProfileComplete(profile)) {
    window.location.href = `${BASE_URL}/onboarding.html`;
    return null;
  }
  return profile;
}

// Guard for member-only pages (dashboard, messages, forum, elections, …)
export async function requireApprovedMember() {
  const profile = await loadProfileOrRedirect();
  if (!profile) return null;
  if (profile.membership_status !== 'active') {
    window.location.href = `${BASE_URL}/pending-approval.html`;
    return null;
  }
  return profile;
}

// Logged in + completed onboarding (pending members may use limited pages)
export async function requireLoggedIn() {
  const profile = await loadProfileOrRedirect();
  return profile; // null if redirected
}

// Session only — does NOT check onboarding (use sparingly; prefer requireLoggedIn)
export async function requireSessionOnly() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = `${BASE_URL}/login.html`;
    return null;
  }
  return session;
}
