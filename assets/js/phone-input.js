/**
 * International phone input: country code picker + national number.
 * Usage: mountPhoneInput(el, { value, onChange, required, defaultIso: "UG" })
 * Stores E.164-ish string in hidden input (e.g. +256700000000).
 */
const COUNTRIES = [
  { iso: "UG", name: 'Uganda', dial: "256", flag: "🇺🇬" },
  { iso: "KE", name: 'Kenya', dial: "254", flag: "🇰🇪" },
  { iso: "TZ", name: 'Tanzania', dial: "255", flag: "🇹🇿" },
  { iso: "RW", name: 'Rwanda', dial: "250", flag: "🇷🇼" },
  { iso: "BI", name: 'Burundi', dial: "257", flag: "🇧🇮" },
  { iso: "SS", name: 'South Sudan', dial: "211", flag: "🇸🇸" },
  { iso: "CD", name: 'DR Congo', dial: "243", flag: "🇨🇩" },
  { iso: "US", name: 'United States', dial: "1", flag: "🇺🇸" },
  { iso: "GB", name: 'United Kingdom', dial: "44", flag: "🇬🇧" },
  { iso: "CA", name: 'Canada', dial: "1", flag: "🇨🇦" },
  { iso: "IN", name: 'India', dial: "91", flag: "🇮🇳" },
  { iso: "CN", name: 'China', dial: "86", flag: "🇨🇳" },
  { iso: "NG", name: 'Nigeria', dial: "234", flag: "🇳🇬" },
  { iso: "GH", name: 'Ghana', dial: "233", flag: "🇬🇭" },
  { iso: "ZA", name: 'South Africa', dial: "27", flag: "🇿🇦" },
  { iso: "AE", name: 'United Arab Emirates', dial: "971", flag: "🇦🇪" },
  { iso: "SA", name: 'Saudi Arabia', dial: "966", flag: "🇸🇦" },
  { iso: "DE", name: 'Germany', dial: "49", flag: "🇩🇪" },
  { iso: "FR", name: 'France', dial: "33", flag: "🇫🇷" },
  { iso: "IT", name: 'Italy', dial: "39", flag: "🇮🇹" },
  { iso: "ES", name: 'Spain', dial: "34", flag: "🇪🇸" },
  { iso: "NL", name: 'Netherlands', dial: "31", flag: "🇳🇱" },
  { iso: "BE", name: 'Belgium', dial: "32", flag: "🇧🇪" },
  { iso: "SE", name: 'Sweden', dial: "46", flag: "🇸🇪" },
  { iso: "NO", name: 'Norway', dial: "47", flag: "🇳🇴" },
  { iso: "DK", name: 'Denmark', dial: "45", flag: "🇩🇰" },
  { iso: "FI", name: 'Finland', dial: "358", flag: "🇫🇮" },
  { iso: "IE", name: 'Ireland', dial: "353", flag: "🇮🇪" },
  { iso: "AU", name: 'Australia', dial: "61", flag: "🇦🇺" },
  { iso: "NZ", name: 'New Zealand', dial: "64", flag: "🇳🇿" },
  { iso: "BR", name: 'Brazil', dial: "55", flag: "🇧🇷" },
  { iso: "MX", name: 'Mexico', dial: "52", flag: "🇲🇽" },
  { iso: "JP", name: 'Japan', dial: "81", flag: "🇯🇵" },
  { iso: "KR", name: 'South Korea', dial: "82", flag: "🇰🇷" },
  { iso: "TR", name: 'Turkey', dial: "90", flag: "🇹🇷" },
  { iso: "EG", name: 'Egypt', dial: "20", flag: "🇪🇬" },
  { iso: "ET", name: 'Ethiopia', dial: "251", flag: "🇪🇹" },
  { iso: "SO", name: 'Somalia', dial: "252", flag: "🇸🇴" },
  { iso: "SD", name: 'Sudan', dial: "249", flag: "🇸🇩" },
  { iso: "ZM", name: 'Zambia', dial: "260", flag: "🇿🇲" },
  { iso: "ZW", name: 'Zimbabwe', dial: "263", flag: "🇿🇼" },
  { iso: "MW", name: 'Malawi', dial: "265", flag: "🇲🇼" },
  { iso: "MZ", name: 'Mozambique', dial: "258", flag: "🇲🇿" },
  { iso: "AO", name: 'Angola', dial: "244", flag: "🇦🇴" },
  { iso: "CM", name: 'Cameroon', dial: "237", flag: "🇨🇲" },
  { iso: "CI", name: "Côte d'Ivoire", dial: "225", flag: "🇨🇮" },
  { iso: "SN", name: 'Senegal', dial: "221", flag: "🇸🇳" },
  { iso: "PK", name: 'Pakistan', dial: "92", flag: "🇵🇰" },
  { iso: "BD", name: 'Bangladesh', dial: "880", flag: "🇧🇩" },
  { iso: "PH", name: 'Philippines', dial: "63", flag: "🇵🇭" },
  { iso: "MY", name: 'Malaysia', dial: "60", flag: "🇲🇾" },
  { iso: "SG", name: 'Singapore', dial: "65", flag: "🇸🇬" },
  { iso: "ID", name: 'Indonesia', dial: "62", flag: "🇮🇩" },
  { iso: "TH", name: 'Thailand', dial: "66", flag: "🇹🇭" },
  { iso: "VN", name: 'Vietnam', dial: "84", flag: "🇻🇳" },
  { iso: "PL", name: 'Poland', dial: "48", flag: "🇵🇱" },
  { iso: "PT", name: 'Portugal', dial: "351", flag: "🇵🇹" },
  { iso: "CH", name: 'Switzerland', dial: "41", flag: "🇨🇭" },
  { iso: "AT", name: 'Austria', dial: "43", flag: "🇦🇹" },
  { iso: "RU", name: 'Russia', dial: "7", flag: "🇷🇺" },
  { iso: "UA", name: 'Ukraine', dial: "380", flag: "🇺🇦" },
  { iso: "AF", name: 'Afghanistan', dial: "93", flag: "🇦🇫" },
  { iso: "AL", name: 'Albania', dial: "355", flag: "🇦🇱" },
  { iso: "DZ", name: 'Algeria', dial: "213", flag: "🇩🇿" }
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
  numberEl.addEventListener("input", syncFull);
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) close();
  });

  renderCc();
  syncFull();

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
