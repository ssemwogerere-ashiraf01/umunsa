/**
 * International phone input: country code picker + national number.
 * Usage: mountPhoneInput(el, { value, onChange, required, defaultIso: "UG" })
 * Stores E.164-ish string in hidden input (e.g. +256700000000).
 */
import { getIpGeolocation } from './geo.js';

// Kicked off once at module load so every phone field on the page shares
// the same lookup instead of firing one request per field.
const detectedCountryPromise = typeof window !== 'undefined'
  ? getIpGeolocation().then((geo) => geo?.countryCode || null).catch(() => null)
  : Promise.resolve(null);

const COUNTRIES = [
  { iso: "UG", name: 'Uganda', dial: "256", flag: "🇺🇬" },
  { iso: "AF", name: 'Afghanistan', dial: "93", flag: "🇦🇫" },
  { iso: "AL", name: 'Albania', dial: "355", flag: "🇦🇱" },
  { iso: "DZ", name: 'Algeria', dial: "213", flag: "🇩🇿" },
  { iso: "AS", name: 'American Samoa', dial: "1684", flag: "🇦🇸" },
  { iso: "AD", name: 'Andorra', dial: "376", flag: "🇦🇩" },
  { iso: "AO", name: 'Angola', dial: "244", flag: "🇦🇴" },
  { iso: "AI", name: 'Anguilla', dial: "1264", flag: "🇦🇮" },
  { iso: "AG", name: 'Antigua and Barbuda', dial: "1268", flag: "🇦🇬" },
  { iso: "AR", name: 'Argentina', dial: "54", flag: "🇦🇷" },
  { iso: "AM", name: 'Armenia', dial: "374", flag: "🇦🇲" },
  { iso: "AW", name: 'Aruba', dial: "297", flag: "🇦🇼" },
  { iso: "AU", name: 'Australia', dial: "61", flag: "🇦🇺" },
  { iso: "AT", name: 'Austria', dial: "43", flag: "🇦🇹" },
  { iso: "AZ", name: 'Azerbaijan', dial: "994", flag: "🇦🇿" },
  { iso: "BS", name: 'Bahamas', dial: "1242", flag: "🇧🇸" },
  { iso: "BH", name: 'Bahrain', dial: "973", flag: "🇧🇭" },
  { iso: "BD", name: 'Bangladesh', dial: "880", flag: "🇧🇩" },
  { iso: "BB", name: 'Barbados', dial: "1246", flag: "🇧🇧" },
  { iso: "BY", name: 'Belarus', dial: "375", flag: "🇧🇾" },
  { iso: "BE", name: 'Belgium', dial: "32", flag: "🇧🇪" },
  { iso: "BZ", name: 'Belize', dial: "501", flag: "🇧🇿" },
  { iso: "BJ", name: 'Benin', dial: "229", flag: "🇧🇯" },
  { iso: "BM", name: 'Bermuda', dial: "1441", flag: "🇧🇲" },
  { iso: "BT", name: 'Bhutan', dial: "975", flag: "🇧🇹" },
  { iso: "BO", name: 'Bolivia', dial: "591", flag: "🇧🇴" },
  { iso: "BA", name: 'Bosnia and Herzegovina', dial: "387", flag: "🇧🇦" },
  { iso: "BW", name: 'Botswana', dial: "267", flag: "🇧🇼" },
  { iso: "BR", name: 'Brazil', dial: "55", flag: "🇧🇷" },
  { iso: "BN", name: 'Brunei', dial: "673", flag: "🇧🇳" },
  { iso: "BG", name: 'Bulgaria', dial: "359", flag: "🇧🇬" },
  { iso: "BF", name: 'Burkina Faso', dial: "226", flag: "🇧🇫" },
  { iso: "BI", name: 'Burundi', dial: "257", flag: "🇧🇮" },
  { iso: "KH", name: 'Cambodia', dial: "855", flag: "🇰🇭" },
  { iso: "CM", name: 'Cameroon', dial: "237", flag: "🇨🇲" },
  { iso: "CA", name: 'Canada', dial: "1", flag: "🇨🇦" },
  { iso: "CV", name: 'Cape Verde', dial: "238", flag: "🇨🇻" },
  { iso: "KY", name: 'Cayman Islands', dial: "1345", flag: "🇰🇾" },
  { iso: "CF", name: 'Central African Republic', dial: "236", flag: "🇨🇫" },
  { iso: "TD", name: 'Chad', dial: "235", flag: "🇹🇩" },
  { iso: "CL", name: 'Chile', dial: "56", flag: "🇨🇱" },
  { iso: "CN", name: 'China', dial: "86", flag: "🇨🇳" },
  { iso: "CO", name: 'Colombia', dial: "57", flag: "🇨🇴" },
  { iso: "KM", name: 'Comoros', dial: "269", flag: "🇰🇲" },
  { iso: "CG", name: 'Congo', dial: "242", flag: "🇨🇬" },
  { iso: "CR", name: 'Costa Rica', dial: "506", flag: "🇨🇷" },
  { iso: "HR", name: 'Croatia', dial: "385", flag: "🇭🇷" },
  { iso: "CU", name: 'Cuba', dial: "53", flag: "🇨🇺" },
  { iso: "CY", name: 'Cyprus', dial: "357", flag: "🇨🇾" },
  { iso: "CZ", name: 'Czech Republic', dial: "420", flag: "🇨🇿" },
  { iso: "CI", name: "Côte d'Ivoire", dial: "225", flag: "🇨🇮" },
  { iso: "CD", name: 'DR Congo', dial: "243", flag: "🇨🇩" },
  { iso: "DK", name: 'Denmark', dial: "45", flag: "🇩🇰" },
  { iso: "DJ", name: 'Djibouti', dial: "253", flag: "🇩🇯" },
  { iso: "DM", name: 'Dominica', dial: "1767", flag: "🇩🇲" },
  { iso: "DO", name: 'Dominican Republic', dial: "1809", flag: "🇩🇴" },
  { iso: "EC", name: 'Ecuador', dial: "593", flag: "🇪🇨" },
  { iso: "EG", name: 'Egypt', dial: "20", flag: "🇪🇬" },
  { iso: "SV", name: 'El Salvador', dial: "503", flag: "🇸🇻" },
  { iso: "GQ", name: 'Equatorial Guinea', dial: "240", flag: "🇬🇶" },
  { iso: "ER", name: 'Eritrea', dial: "291", flag: "🇪🇷" },
  { iso: "EE", name: 'Estonia', dial: "372", flag: "🇪🇪" },
  { iso: "SZ", name: 'Eswatini', dial: "268", flag: "🇸🇿" },
  { iso: "ET", name: 'Ethiopia', dial: "251", flag: "🇪🇹" },
  { iso: "FJ", name: 'Fiji', dial: "679", flag: "🇫🇯" },
  { iso: "FI", name: 'Finland', dial: "358", flag: "🇫🇮" },
  { iso: "FR", name: 'France', dial: "33", flag: "🇫🇷" },
  { iso: "GA", name: 'Gabon', dial: "241", flag: "🇬🇦" },
  { iso: "GM", name: 'Gambia', dial: "220", flag: "🇬🇲" },
  { iso: "GE", name: 'Georgia', dial: "995", flag: "🇬🇪" },
  { iso: "DE", name: 'Germany', dial: "49", flag: "🇩🇪" },
  { iso: "GH", name: 'Ghana', dial: "233", flag: "🇬🇭" },
  { iso: "GI", name: 'Gibraltar', dial: "350", flag: "🇬🇮" },
  { iso: "GR", name: 'Greece', dial: "30", flag: "🇬🇷" },
  { iso: "GL", name: 'Greenland', dial: "299", flag: "🇬🇱" },
  { iso: "GD", name: 'Grenada', dial: "1473", flag: "🇬🇩" },
  { iso: "GT", name: 'Guatemala', dial: "502", flag: "🇬🇹" },
  { iso: "GN", name: 'Guinea', dial: "224", flag: "🇬🇳" },
  { iso: "GW", name: 'Guinea-Bissau', dial: "245", flag: "🇬🇼" },
  { iso: "GY", name: 'Guyana', dial: "592", flag: "🇬🇾" },
  { iso: "HT", name: 'Haiti', dial: "509", flag: "🇭🇹" },
  { iso: "HN", name: 'Honduras', dial: "504", flag: "🇭🇳" },
  { iso: "HK", name: 'Hong Kong', dial: "852", flag: "🇭🇰" },
  { iso: "HU", name: 'Hungary', dial: "36", flag: "🇭🇺" },
  { iso: "IS", name: 'Iceland', dial: "354", flag: "🇮🇸" },
  { iso: "IN", name: 'India', dial: "91", flag: "🇮🇳" },
  { iso: "ID", name: 'Indonesia', dial: "62", flag: "🇮🇩" },
  { iso: "IR", name: 'Iran', dial: "98", flag: "🇮🇷" },
  { iso: "IQ", name: 'Iraq', dial: "964", flag: "🇮🇶" },
  { iso: "IE", name: 'Ireland', dial: "353", flag: "🇮🇪" },
  { iso: "IL", name: 'Israel', dial: "972", flag: "🇮🇱" },
  { iso: "IT", name: 'Italy', dial: "39", flag: "🇮🇹" },
  { iso: "JM", name: 'Jamaica', dial: "1876", flag: "🇯🇲" },
  { iso: "JP", name: 'Japan', dial: "81", flag: "🇯🇵" },
  { iso: "JO", name: 'Jordan', dial: "962", flag: "🇯🇴" },
  { iso: "KZ", name: 'Kazakhstan', dial: "7", flag: "🇰🇿" },
  { iso: "KE", name: 'Kenya', dial: "254", flag: "🇰🇪" },
  { iso: "KI", name: 'Kiribati', dial: "686", flag: "🇰🇮" },
  { iso: "KW", name: 'Kuwait', dial: "965", flag: "🇰🇼" },
  { iso: "KG", name: 'Kyrgyzstan', dial: "996", flag: "🇰🇬" },
  { iso: "LA", name: 'Laos', dial: "856", flag: "🇱🇦" },
  { iso: "LV", name: 'Latvia', dial: "371", flag: "🇱🇻" },
  { iso: "LB", name: 'Lebanon', dial: "961", flag: "🇱🇧" },
  { iso: "LS", name: 'Lesotho', dial: "266", flag: "🇱🇸" },
  { iso: "LR", name: 'Liberia', dial: "231", flag: "🇱🇷" },
  { iso: "LY", name: 'Libya', dial: "218", flag: "🇱🇾" },
  { iso: "LI", name: 'Liechtenstein', dial: "423", flag: "🇱🇮" },
  { iso: "LT", name: 'Lithuania', dial: "370", flag: "🇱🇹" },
  { iso: "LU", name: 'Luxembourg', dial: "352", flag: "🇱🇺" },
  { iso: "MO", name: 'Macau', dial: "853", flag: "🇲🇴" },
  { iso: "MG", name: 'Madagascar', dial: "261", flag: "🇲🇬" },
  { iso: "MW", name: 'Malawi', dial: "265", flag: "🇲🇼" },
  { iso: "MY", name: 'Malaysia', dial: "60", flag: "🇲🇾" },
  { iso: "MV", name: 'Maldives', dial: "960", flag: "🇲🇻" },
  { iso: "ML", name: 'Mali', dial: "223", flag: "🇲🇱" },
  { iso: "MT", name: 'Malta', dial: "356", flag: "🇲🇹" },
  { iso: "MH", name: 'Marshall Islands', dial: "692", flag: "🇲🇭" },
  { iso: "MR", name: 'Mauritania', dial: "222", flag: "🇲🇷" },
  { iso: "MU", name: 'Mauritius', dial: "230", flag: "🇲🇺" },
  { iso: "MX", name: 'Mexico', dial: "52", flag: "🇲🇽" },
  { iso: "FM", name: 'Micronesia', dial: "691", flag: "🇫🇲" },
  { iso: "MD", name: 'Moldova', dial: "373", flag: "🇲🇩" },
  { iso: "MC", name: 'Monaco', dial: "377", flag: "🇲🇨" },
  { iso: "MN", name: 'Mongolia', dial: "976", flag: "🇲🇳" },
  { iso: "ME", name: 'Montenegro', dial: "382", flag: "🇲🇪" },
  { iso: "MA", name: 'Morocco', dial: "212", flag: "🇲🇦" },
  { iso: "MZ", name: 'Mozambique', dial: "258", flag: "🇲🇿" },
  { iso: "MM", name: 'Myanmar', dial: "95", flag: "🇲🇲" },
  { iso: "NA", name: 'Namibia', dial: "264", flag: "🇳🇦" },
  { iso: "NP", name: 'Nepal', dial: "977", flag: "🇳🇵" },
  { iso: "NL", name: 'Netherlands', dial: "31", flag: "🇳🇱" },
  { iso: "NZ", name: 'New Zealand', dial: "64", flag: "🇳🇿" },
  { iso: "NI", name: 'Nicaragua', dial: "505", flag: "🇳🇮" },
  { iso: "NE", name: 'Niger', dial: "227", flag: "🇳🇪" },
  { iso: "NG", name: 'Nigeria', dial: "234", flag: "🇳🇬" },
  { iso: "KP", name: 'North Korea', dial: "850", flag: "🇰🇵" },
  { iso: "MK", name: 'North Macedonia', dial: "389", flag: "🇲🇰" },
  { iso: "NO", name: 'Norway', dial: "47", flag: "🇳🇴" },
  { iso: "OM", name: 'Oman', dial: "968", flag: "🇴🇲" },
  { iso: "PK", name: 'Pakistan', dial: "92", flag: "🇵🇰" },
  { iso: "PW", name: 'Palau', dial: "680", flag: "🇵🇼" },
  { iso: "PS", name: 'Palestine', dial: "970", flag: "🇵🇸" },
  { iso: "PA", name: 'Panama', dial: "507", flag: "🇵🇦" },
  { iso: "PG", name: 'Papua New Guinea', dial: "675", flag: "🇵🇬" },
  { iso: "PY", name: 'Paraguay', dial: "595", flag: "🇵🇾" },
  { iso: "PE", name: 'Peru', dial: "51", flag: "🇵🇪" },
  { iso: "PH", name: 'Philippines', dial: "63", flag: "🇵🇭" },
  { iso: "PL", name: 'Poland', dial: "48", flag: "🇵🇱" },
  { iso: "PT", name: 'Portugal', dial: "351", flag: "🇵🇹" },
  { iso: "PR", name: 'Puerto Rico', dial: "1787", flag: "🇵🇷" },
  { iso: "QA", name: 'Qatar', dial: "974", flag: "🇶🇦" },
  { iso: "RO", name: 'Romania', dial: "40", flag: "🇷🇴" },
  { iso: "RU", name: 'Russia', dial: "7", flag: "🇷🇺" },
  { iso: "RW", name: 'Rwanda', dial: "250", flag: "🇷🇼" },
  { iso: "KN", name: 'Saint Kitts and Nevis', dial: "1869", flag: "🇰🇳" },
  { iso: "LC", name: 'Saint Lucia', dial: "1758", flag: "🇱🇨" },
  { iso: "VC", name: 'Saint Vincent and the Grenadines', dial: "1784", flag: "🇻🇨" },
  { iso: "WS", name: 'Samoa', dial: "685", flag: "🇼🇸" },
  { iso: "SM", name: 'San Marino', dial: "378", flag: "🇸🇲" },
  { iso: "SA", name: 'Saudi Arabia', dial: "966", flag: "🇸🇦" },
  { iso: "SN", name: 'Senegal', dial: "221", flag: "🇸🇳" },
  { iso: "RS", name: 'Serbia', dial: "381", flag: "🇷🇸" },
  { iso: "SC", name: 'Seychelles', dial: "248", flag: "🇸🇨" },
  { iso: "SL", name: 'Sierra Leone', dial: "232", flag: "🇸🇱" },
  { iso: "SG", name: 'Singapore', dial: "65", flag: "🇸🇬" },
  { iso: "SK", name: 'Slovakia', dial: "421", flag: "🇸🇰" },
  { iso: "SI", name: 'Slovenia', dial: "386", flag: "🇸🇮" },
  { iso: "SB", name: 'Solomon Islands', dial: "677", flag: "🇸🇧" },
  { iso: "SO", name: 'Somalia', dial: "252", flag: "🇸🇴" },
  { iso: "ZA", name: 'South Africa', dial: "27", flag: "🇿🇦" },
  { iso: "KR", name: 'South Korea', dial: "82", flag: "🇰🇷" },
  { iso: "SS", name: 'South Sudan', dial: "211", flag: "🇸🇸" },
  { iso: "ES", name: 'Spain', dial: "34", flag: "🇪🇸" },
  { iso: "LK", name: 'Sri Lanka', dial: "94", flag: "🇱🇰" },
  { iso: "SD", name: 'Sudan', dial: "249", flag: "🇸🇩" },
  { iso: "SR", name: 'Suriname', dial: "597", flag: "🇸🇷" },
  { iso: "SE", name: 'Sweden', dial: "46", flag: "🇸🇪" },
  { iso: "CH", name: 'Switzerland', dial: "41", flag: "🇨🇭" },
  { iso: "SY", name: 'Syria', dial: "963", flag: "🇸🇾" },
  { iso: "ST", name: 'São Tomé and Príncipe', dial: "239", flag: "🇸🇹" },
  { iso: "TW", name: 'Taiwan', dial: "886", flag: "🇹🇼" },
  { iso: "TJ", name: 'Tajikistan', dial: "992", flag: "🇹🇯" },
  { iso: "TZ", name: 'Tanzania', dial: "255", flag: "🇹🇿" },
  { iso: "TH", name: 'Thailand', dial: "66", flag: "🇹🇭" },
  { iso: "TL", name: 'Timor-Leste', dial: "670", flag: "🇹🇱" },
  { iso: "TG", name: 'Togo', dial: "228", flag: "🇹🇬" },
  { iso: "TO", name: 'Tonga', dial: "676", flag: "🇹🇴" },
  { iso: "TT", name: 'Trinidad and Tobago', dial: "1868", flag: "🇹🇹" },
  { iso: "TN", name: 'Tunisia', dial: "216", flag: "🇹🇳" },
  { iso: "TR", name: 'Turkey', dial: "90", flag: "🇹🇷" },
  { iso: "TM", name: 'Turkmenistan', dial: "993", flag: "🇹🇲" },
  { iso: "UA", name: 'Ukraine', dial: "380", flag: "🇺🇦" },
  { iso: "AE", name: 'United Arab Emirates', dial: "971", flag: "🇦🇪" },
  { iso: "GB", name: 'United Kingdom', dial: "44", flag: "🇬🇧" },
  { iso: "US", name: 'United States', dial: "1", flag: "🇺🇸" },
  { iso: "UY", name: 'Uruguay', dial: "598", flag: "🇺🇾" },
  { iso: "UZ", name: 'Uzbekistan', dial: "998", flag: "🇺🇿" },
  { iso: "VU", name: 'Vanuatu', dial: "678", flag: "🇻🇺" },
  { iso: "VA", name: 'Vatican City', dial: "39", flag: "🇻🇦" },
  { iso: "VE", name: 'Venezuela', dial: "58", flag: "🇻🇪" },
  { iso: "VN", name: 'Vietnam', dial: "84", flag: "🇻🇳" },
  { iso: "YE", name: 'Yemen', dial: "967", flag: "🇾🇪" },
  { iso: "ZM", name: 'Zambia', dial: "260", flag: "🇿🇲" },
  { iso: "ZW", name: 'Zimbabwe', dial: "263", flag: "🇿🇼" }
];

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function digitsOnly(s) {
  return String(s || "").replace(/\D/g, "");
}

function parseExisting(value) {
  const raw = String(value || "").trim();
  if (!raw) return { iso: "UG", dial: "256", national: "" };
  const d = digitsOnly(raw.startsWith("+") ? raw.slice(1) : raw);
  // Longest dial match
  let best = null;
  for (const c of COUNTRIES) {
    if (d.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c;
  }
  if (best) {
    return { iso: best.iso, dial: best.dial, national: d.slice(best.dial.length) };
  }
  return { iso: "UG", dial: "256", national: d };
}

export function mountPhoneInput(mount, {
  value = "",
  name = "phone",
  required = false,
  defaultIso = "UG",
  onChange,
  id = "phone",
} = {}) {
  if (!mount) return null;

  const parsed = value ? parseExisting(value) : (() => {
    const c = COUNTRIES.find(x => x.iso === defaultIso) || COUNTRIES[0];
    return { iso: c.iso, dial: c.dial, national: "" };
  })();

  let currentIso = parsed.iso;
  let currentDial = parsed.dial;
  let userPickedCountry = false; // set true once the visitor touches the picker or types a number

  mount.innerHTML = `
    <div class="phone-intl" data-phone-intl>
      <button type="button" class="phone-intl-cc" aria-label="Country code" aria-haspopup="listbox">
        <span class="phone-intl-flag"></span>
        <span class="phone-intl-dial"></span>
        <svg class="phone-intl-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <input type="tel" class="phone-intl-number" inputmode="tel" autocomplete="tel-national"
        placeholder="Phone number" ${required ? "required" : ""} id="${escapeHtml(id)}-national" />
      <input type="hidden" class="phone-intl-full" name="${escapeHtml(name)}" id="${escapeHtml(id)}" />
      <div class="phone-intl-panel" hidden>
        <div class="phone-intl-search">
          <input type="search" placeholder="Search country…" autocomplete="off" />
        </div>
        <div class="phone-intl-list" role="listbox"></div>
      </div>
    </div>
  `;

  const root = mount.querySelector("[data-phone-intl]");
  const ccBtn = root.querySelector(".phone-intl-cc");
  const flagEl = root.querySelector(".phone-intl-flag");
  const dialEl = root.querySelector(".phone-intl-dial");
  const numberEl = root.querySelector(".phone-intl-number");
  const fullEl = root.querySelector(".phone-intl-full");
  const panel = root.querySelector(".phone-intl-panel");
  const list = root.querySelector(".phone-intl-list");
  const search = root.querySelector(".phone-intl-search input");

  numberEl.value = parsed.national;

  function currentCountry() {
    return COUNTRIES.find(c => c.iso === currentIso) || COUNTRIES[0];
  }

  function syncFull() {
    const national = digitsOnly(numberEl.value);
    const full = national ? `+${currentDial}${national}` : "";
    fullEl.value = full;
    if (typeof onChange === "function") onChange(full);
  }

  function renderCc() {
    const c = currentCountry();
    flagEl.textContent = c.flag;
    dialEl.textContent = `+${c.dial}`;
  }

  function renderList(q = "") {
    const qq = q.trim().toLowerCase();
    const filtered = !qq
      ? COUNTRIES
      : COUNTRIES.filter(c =>
          c.name.toLowerCase().includes(qq) ||
          c.dial.includes(qq) ||
          c.iso.toLowerCase().includes(qq)
        );
    list.innerHTML = filtered.map(c => `
      <button type="button" class="phone-intl-option${c.iso === currentIso ? " selected" : ""}"
        data-iso="${c.iso}" role="option">
        <span class="phone-intl-option-flag">${c.flag}</span>
        <span class="phone-intl-option-name">${escapeHtml(c.name)}</span>
        <span class="phone-intl-option-dial">+${c.dial}</span>
      </button>
    `).join("") || `<div class="phone-intl-empty">No countries found</div>`;

    list.querySelectorAll(".phone-intl-option").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const c = COUNTRIES.find(x => x.iso === btn.dataset.iso);
        if (!c) return;
        userPickedCountry = true;
        currentIso = c.iso;
        currentDial = c.dial;
        renderCc();
        renderList(search.value);
        close();
        syncFull();
        numberEl.focus();
      });
    });
  }

  function open() {
    panel.hidden = false;
    root.classList.add("open");
    renderList(search.value);
    setTimeout(() => search.focus(), 20);
  }
  function close() {
    panel.hidden = true;
    root.classList.remove("open");
    search.value = "";
  }

  ccBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    panel.hidden ? open() : close();
  });
  search.addEventListener("input", () => renderList(search.value));
  search.addEventListener("click", (e) => e.stopPropagation());
  numberEl.addEventListener("input", () => { userPickedCountry = true; syncFull(); });
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) close();
  });

  renderCc();
  syncFull();

  // If this field started blank, adopt the visitor's IP-detected country
  // once we know it — unless they've already picked one or started typing.
  if (!value) {
    detectedCountryPromise.then((iso) => {
      if (!iso || userPickedCountry) return;
      const match = COUNTRIES.find(c => c.iso === iso);
      if (!match || match.iso === currentIso) return;
      currentIso = match.iso;
      currentDial = match.dial;
      renderCc();
      syncFull();
    });
  }

  return {
    get value() { return fullEl.value; },
    set value(v) {
      const p = parseExisting(v);
      currentIso = p.iso;
      currentDial = p.dial;
      numberEl.value = p.national;
      renderCc();
      syncFull();
    },
    el: root,
    fullInput: fullEl,
    nationalInput: numberEl,
  };
}

/** Auto-upgrade inputs marked data-phone-intl or id/name phone */
export function enhancePhoneFields(root = document) {
  root.querySelectorAll("input[data-phone-intl], input#phone, input#am-phone, input[name='phone']").forEach((input) => {
    if (input.dataset.phoneEnhanced === "1") return;
    if (input.closest(".phone-intl")) return;
    input.dataset.phoneEnhanced = "1";

    const wrap = document.createElement("div");
    wrap.className = "phone-intl-mount";
    input.parentNode.insertBefore(wrap, input);

    const required = input.hasAttribute("required");
    const id = input.id || "phone";
    const name = input.name || "phone";
    const val = input.value || "";

    // Hide original; keep it as the canonical form value holder
    input.type = "hidden";
    input.removeAttribute("required");

    const inst = mountPhoneInput(wrap, {
      value: val,
      name: name + "_display",
      id: id + "_ui",
      required,
      defaultIso: "UG",
      onChange: (full) => {
        input.value = full;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      },
    });

    // If UI marks required, mirror validity on original
    if (required && inst?.nationalInput) {
      inst.nationalInput.addEventListener("invalid", () => {
        input.setCustomValidity(inst.nationalInput.value.trim() ? "" : "Phone number required");
      });
      inst.nationalInput.addEventListener("input", () => input.setCustomValidity(""));
    }
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => enhancePhoneFields());
  } else {
    setTimeout(() => enhancePhoneFields(), 0);
  }
}