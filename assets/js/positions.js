/**
 * Official BANKOSA / Nkobazambogo Students' Association Positions
 * Uganda Martyrs University – Nkozi Campus
 *
 * Place this file at:  assets/js/positions.js
 *
 * Usage in any admin / form page:
 *   import { LEADERSHIP_POSITIONS, populatePositionSelect } from './positions.js';
 *   populatePositionSelect(document.getElementById('position'));
 */

export const LEADERSHIP_POSITIONS = [
  "President (Ssentebe)",
  "Vice President (Amyuka Ssentebe)",
  "Speaker (Omukubiriza w'Olukiiko)",
  "Deputy Speaker (Amyuka Omukubiriza w'Olukiiko)",
  "Secretary (Omuwandiisi)",
  "Deputy Secretary (Amyuka Omuwandiisi)",
  "Treasurer (Omuwanika)",
  "Deputy Treasurer (Amyuka Omuwanika)",
  "Information Minister (Ow'amawulire)",
  "Deputy Information Minister (Amyuka Ow'amawulire)",
  "Ssenga",
  "Amyuka Ssenga (Deputy)",
  "Kkojja",
  "Amyuka Kkojja (Deputy)",
  "Ethics Minister (Ow'ebyempisa)",
  "Deputy Ethics Minister (Amyuka Ow'ebyempisa)",
  "Legal Advisor (Munnamateeka)",
  "Games & Sports Minister (Ow'ebyemizannyo)",
  "Projects Minister (Ow'ebyenkulaakulana)",
  "Chief Coordinator (Ssaabakwanaganya w'emirimu)",
  "Minister of Public Relations (Omutabaganya w'Amawangwa)",
  "Deputy Minister of Public Relations",
  "Chief Mobilizer (Ssaabakunzi)",
  "Minister of Culture (Ow'ebyobuwangwa)",
  "Deputy Minister of Culture (Amyuka Ow'ebyobuwangwa)",
  "Games & Sports Girls",
  "Community Services Minister (Owabulungi Bwa Nsi)",
  "Faculty Representative / Coordinator",
  "Hall / Hostel Representative"
];

/**
 * Structured version (value + label + category)
 */
export const LEADERSHIP_POSITIONS_DETAILED = [
  { value: "President (Ssentebe)",                          label: "President (Ssentebe)",                          category: "Executive" },
  { value: "Vice President (Amyuka Ssentebe)",               label: "Vice President (Amyuka Ssentebe)",               category: "Executive" },
  { value: "Speaker (Omukubiriza w'Olukiiko)",               label: "Speaker (Omukubiriza w'Olukiiko)",               category: "Executive" },
  { value: "Deputy Speaker (Amyuka Omukubiriza w'Olukiiko)", label: "Deputy Speaker (Amyuka Omukubiriza w'Olukiiko)", category: "Executive" },
  { value: "Secretary (Omuwandiisi)",                        label: "Secretary (Omuwandiisi)",                        category: "Executive" },
  { value: "Deputy Secretary (Amyuka Omuwandiisi)",          label: "Deputy Secretary (Amyuka Omuwandiisi)",          category: "Executive" },
  { value: "Treasurer (Omuwanika)",                          label: "Treasurer (Omuwanika)",                          category: "Executive" },
  { value: "Deputy Treasurer (Amyuka Omuwanika)",            label: "Deputy Treasurer (Amyuka Omuwanika)",            category: "Executive" },
  { value: "Information Minister (Ow'amawulire)",            label: "Information Minister (Ow'amawulire)",            category: "Minister" },
  { value: "Deputy Information Minister (Amyuka Ow'amawulire)", label: "Deputy Information Minister (Amyuka Ow'amawulire)", category: "Minister" },
  { value: "Ssenga",                                         label: "Ssenga",                                         category: "Cultural" },
  { value: "Amyuka Ssenga (Deputy)",                         label: "Amyuka Ssenga (Deputy)",                         category: "Cultural" },
  { value: "Kkojja",                                         label: "Kkojja",                                         category: "Cultural" },
  { value: "Amyuka Kkojja (Deputy)",                         label: "Amyuka Kkojja (Deputy)",                         category: "Cultural" },
  { value: "Ethics Minister (Ow'ebyempisa)",                 label: "Ethics Minister (Ow'ebyempisa)",                 category: "Minister" },
  { value: "Deputy Ethics Minister (Amyuka Ow'ebyempisa)",   label: "Deputy Ethics Minister (Amyuka Ow'ebyempisa)",   category: "Minister" },
  { value: "Legal Advisor (Munnamateeka)",                   label: "Legal Advisor (Munnamateeka)",                   category: "Advisor" },
  { value: "Games & Sports Minister (Ow'ebyemizannyo)",      label: "Games & Sports Minister (Ow'ebyemizannyo)",      category: "Minister" },
  { value: "Projects Minister (Ow'ebyenkulaakulana)",        label: "Projects Minister (Ow'ebyenkulaakulana)",        category: "Minister" },
  { value: "Chief Coordinator (Ssaabakwanaganya w'emirimu)", label: "Chief Coordinator (Ssaabakwanaganya w'emirimu)", category: "Coordinator" },
  { value: "Minister of Public Relations (Omutabaganya w'Amawangwa)", label: "Minister of Public Relations (Omutabaganya w'Amawangwa)", category: "Minister" },
  { value: "Deputy Minister of Public Relations",            label: "Deputy Minister of Public Relations",            category: "Minister" },
  { value: "Chief Mobilizer (Ssaabakunzi)",                  label: "Chief Mobilizer (Ssaabakunzi)",                  category: "Coordinator" },
  { value: "Minister of Culture (Ow'ebyobuwangwa)",          label: "Minister of Culture (Ow'ebyobuwangwa)",          category: "Minister" },
  { value: "Deputy Minister of Culture (Amyuka Ow'ebyobuwangwa)", label: "Deputy Minister of Culture (Amyuka Ow'ebyobuwangwa)", category: "Minister" },
  { value: "Games & Sports Girls",                           label: "Games & Sports Girls",                           category: "Sports" },
  { value: "Community Services Minister (Owabulungi Bwa Nsi)", label: "Community Services Minister (Owabulungi Bwa Nsi)", category: "Minister" },
  { value: "Faculty Representative / Coordinator",           label: "Faculty Representative / Coordinator",           category: "Representative" },
  { value: "Hall / Hostel Representative",                   label: "Hall / Hostel Representative",                   category: "Representative" }
];

/**
 * Populate a <select> element with the official positions.
 *
 * @param {HTMLSelectElement} selectElement
 * @param {Object} options
 * @param {string}  [options.placeholder="Select position"]
 * @param {boolean} [options.includeEmpty=true]
 * @param {boolean} [options.detailed=false]  - use detailed objects
 * @param {string}  [options.selectedValue]   - pre-select a value
 */
export function populatePositionSelect(selectElement, options = {}) {
  if (!selectElement) return;

  const {
    placeholder = "Select position",
    includeEmpty = true,
    detailed = false,
    selectedValue = null
  } = options;

  selectElement.innerHTML = "";

  if (includeEmpty) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    empty.disabled = true;
    empty.selected = !selectedValue;
    selectElement.appendChild(empty);
  }

  const list = detailed ? LEADERSHIP_POSITIONS_DETAILED : LEADERSHIP_POSITIONS;

  list.forEach((item) => {
    const opt = document.createElement("option");
    if (detailed) {
      opt.value = item.value;
      opt.textContent = item.label;
      if (item.category) opt.dataset.category = item.category;
    } else {
      opt.value = item;
      opt.textContent = item;
    }
    if (selectedValue && opt.value === selectedValue) {
      opt.selected = true;
    }
    selectElement.appendChild(opt);
  });
}

/**
 * Convenience: returns a plain array of strings (for validation, etc.)
 */
export function getPositionValues() {
  return [...LEADERSHIP_POSITIONS];
}
