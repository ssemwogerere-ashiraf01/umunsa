// Single source of truth for site root and public links.
export const BASE_URL = window.location.origin;

export const SOCIAL_LINKS = {
  facebook: 'https://facebook.com/',
  instagram: 'https://www.instagram.com/bugandankobazambogoumu?utm_source=qr&igsh=MTRwMzEyaG94dWJ0dw==',
  tiktok: 'https://www.tiktok.com/@bankosa.umu7?_r=1&_t=ZS-98nIAB9e3hY',
  x: 'https://x.com/',
  whatsapp: 'https://chat.whatsapp.com/FK4ccQlPHS8ApwEBj8F0cq?s=cl&p=a&ilr=4',
  telegram: 'https://t.me/',
  email: 'mailto:nkobazambogo.umu@gmail.com',
};

/** Theme: 'light' | 'dark' | 'system' : stored in localStorage as nsa-theme */
export const THEME_STORAGE_KEY = 'nsa-theme';

export const SITE_NAME = 'Nkobazambogo Students\' Association';
export const SITE_FULL_NAME = 'Uganda Martyrs University Nkobazambogo Students\' Association';
export const SITE_SHORT_SEAL = 'NSA';
export const SITE_DESCRIPTION = 'The official home of the Nkobazambogo Students\' Association at Uganda Martyrs University, Nkozi: news, activities, projects, and discussions for our members.';
export const DEFAULT_OG_IMAGE_PATH = '/assets/img/og-default.jpg';
export const CANONICAL_ORIGIN = 'https://umunsa.vercel.app';

/**
 * University email domain (no leading @).
 * Self-registration requires a real address on this domain, e.g.
 *   name@umu.ac.ug
 *   name@students.umu.ac.ug
 * Super Admin may add members on any domain from the Super Admin dashboard.
 */
export const REQUIRED_EMAIL_DOMAIN = 'umu.ac.ug';

/** True if the address is on umu.ac.ug or a subdomain (*.umu.ac.ug). */
export function isUmuEmail(email) {
  if (typeof email !== 'string') return false;
  const cleaned = email.trim().toLowerCase();
  const at = cleaned.lastIndexOf('@');
  if (at < 1 || at === cleaned.length - 1) return false;
  const domain = cleaned.slice(at + 1);
  // Reject empty labels / spaces
  if (!domain || domain.includes(' ') || domain.startsWith('.') || domain.endsWith('.')) return false;
  return domain === REQUIRED_EMAIL_DOMAIN || domain.endsWith('.' + REQUIRED_EMAIL_DOMAIN);
}

/** Local cultural / campus images under assets/img */
export const CULTURAL_IMAGES = {
  umuCampus: '/assets/img/campus-bg.jpg',
  bugandaKasubiTombs: '/assets/img/kasubi.jpg',
  bugandaDancers: '/assets/img/dancers.jpg',
  heroBg: '/assets/img/hero-bg.jpg',
  cultureBg: '/assets/img/culture-bg.jpg',
  seal: '/assets/img/nsa-seal.png',
};

/** Canonical hall / hostel list for registration and profile forms */
export const HOSTEL_OPTIONS = [
  'Katonga hostel',
  'Bbosa hostel',
  'Kavuma hostel',
  'Lwanga hostel',
  'Byaben hostel',
  'Kololo hostel',
  'Ivis hostel',
  'Canan hostel',
  'Fountain hostel',
  'Angels hostel',
  'Wamala hostel',
  'Mugagga hostel',
  'Micheal hall',
  'Onyango hall',
  'Campbell hall',
  'Mukasa hall',
  'Martyrs hall',
  'Haflet hall',
  'Carabine hall'
];
