/**
 * Load campuses, faculties, programmes from Supabase and wire cascading selects.
 * Uses native <select> so enhanceAllSelects / ns-select can style them.
 */
import { supabase } from './supabase-client.js';
import { refreshSelects, syncSelectDisplay, setSelectValue } from './ns-select.js';

let cache = null;

export async function loadAcademicCatalog() {
  if (cache) return cache;
  const [c, f, p] = await Promise.all([
    supabase.from('campuses').select('id, name, display_order').order('display_order'),
    supabase.from('faculties').select('id, name, display_order').order('display_order'),
    supabase.from('programmes').select('id, faculty_id, name, level').order('name'),
  ]);
  if (c.error) console.warn('campuses', c.error);
  if (f.error) console.warn('faculties', f.error);
  if (p.error) console.warn('programmes', p.error);
  cache = {
    campuses: c.data || [],
    faculties: f.data || [],
    programmes: p.data || [],
  };
  return cache;
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * Fill a native <select>, always preserving the current/profile value even if
 * it is not in the catalog (adds a custom option). Then sync custom ns-select UI.
 */
function fillSelect(sel, options, placeholder, current) {
  if (!sel) return;
  const cur = String(current ?? sel.value ?? '').trim();
  const opts = Array.isArray(options) ? options.slice() : [];
  if (cur && !opts.some((o) => String(o.value) === cur)) {
    opts.unshift({ value: cur, label: cur });
  }
  sel.innerHTML =
    `<option value="">${placeholder}</option>` +
    opts.map((o) => `<option value="${escapeAttr(o.value)}">${escapeAttr(o.label)}</option>`).join('');
  if (cur) {
    sel.value = cur;
    // Force selected attribute for stubborn browsers / custom UIs
    [...sel.options].forEach((o) => {
      if (o.value === cur) o.selected = true;
    });
  } else {
    sel.value = '';
  }
  // Notify ns-select mutation observer + change listeners
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  try {
    if (typeof syncSelectDisplay === 'function') syncSelectDisplay(sel);
    else if (sel.__nsSelect) {
      const next = Array.from(sel.options).map((opt) => ({
        value: opt.value,
        label: (opt.textContent || '').trim() || opt.value || '—',
      }));
      sel.__nsSelect.setOptions(next.filter((o, i) => !(i === 0 && o.value === '')));
      sel.__nsSelect.value = sel.value;
    }
  } catch (_) { /* */ }
}

export function defaultAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 7 ? y : y - 1;
  return `${start}/${start + 1}`;
}

export function academicYearOptions(count = 6) {
  const base = parseInt(defaultAcademicYear().split('/')[0], 10);
  const years = [];
  for (let i = -1; i < count - 1; i++) {
    const s = base + i;
    years.push(`${s}/${s + 1}`);
  }
  return years;
}

/**
 * Wire cascading campus / faculty / programme (+ year, semester, year_of_study).
 */
export async function mountAcademicFields(root = document, initial = {}) {
  const campusEl = root.querySelector('#campus') || root.querySelector('[name="campus"]');
  const facultyEl = root.querySelector('#faculty') || root.querySelector('[name="faculty"]');
  const programmeEl = root.querySelector('#programme') || root.querySelector('[name="programme"]');
  const yearEl = root.querySelector('#academic_year') || root.querySelector('[name="academic_year"]');
  const semesterEl = root.querySelector('#semester') || root.querySelector('[name="semester"]');
  const yosEl = root.querySelector('#year_of_study') || root.querySelector('[name="year_of_study"]');

  const catalog = await loadAcademicCatalog();

  // Enhance selects first so hosts exist, then fill values
  try { refreshSelects(root); } catch (_) {}

  if (campusEl && campusEl.tagName === 'SELECT') {
    fillSelect(
      campusEl,
      catalog.campuses.map((c) => ({ value: c.name, label: c.name })),
      'Select campus',
      initial.campus || ''
    );
  }

  if (facultyEl && facultyEl.tagName === 'SELECT') {
    fillSelect(
      facultyEl,
      catalog.faculties.map((f) => ({ value: f.name, label: f.name })),
      'Select faculty',
      initial.faculty || ''
    );
  }

  function syncProgrammes(preserveProgramme) {
    if (!programmeEl || programmeEl.tagName !== 'SELECT') return;
    const fname = facultyEl?.value || initial.faculty || '';
    const fac = catalog.faculties.find((f) => f.name === fname);
    const list = fac ? catalog.programmes.filter((p) => p.faculty_id === fac.id) : [];
    fillSelect(
      programmeEl,
      list.map((p) => ({ value: p.name, label: p.name })),
      fac ? 'Select programme' : 'Select faculty first',
      preserveProgramme != null ? preserveProgramme : (initial.programme || programmeEl.value || '')
    );
  }

  if (facultyEl) {
    facultyEl.addEventListener('change', () => {
      initial.programme = '';
      syncProgrammes('');
    });
  }
  syncProgrammes(initial.programme || '');

  if (yearEl && yearEl.tagName === 'SELECT') {
    fillSelect(
      yearEl,
      academicYearOptions().map((y) => ({ value: y, label: y })),
      'Academic year',
      initial.academic_year || defaultAcademicYear()
    );
  }

  if (semesterEl && semesterEl.tagName === 'SELECT') {
    fillSelect(
      semesterEl,
      [
        { value: '1', label: 'Semester 1' },
        { value: '2', label: 'Semester 2' },
      ],
      'Semester',
      initial.semester != null && initial.semester !== '' ? String(initial.semester) : ''
    );
  }

  if (yosEl && yosEl.tagName === 'SELECT') {
    fillSelect(
      yosEl,
      [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `Year ${n}` })),
      'Year of study',
      initial.year_of_study != null && initial.year_of_study !== '' ? String(initial.year_of_study) : ''
    );
  }

  // Final pass: rebuild custom UIs with filled options + values
  try { refreshSelects(root); } catch (_) {}
  // And force values again after any rebuild
  requestAnimationFrame(() => {
    const pairs = [
      [campusEl, initial.campus],
      [facultyEl, initial.faculty],
      [programmeEl, initial.programme],
      [yearEl, initial.academic_year || (yearEl && yearEl.value)],
      [semesterEl, initial.semester != null ? String(initial.semester) : ''],
      [yosEl, initial.year_of_study != null ? String(initial.year_of_study) : ''],
    ];
    pairs.forEach(([el, val]) => {
      if (!el || val == null || val === '') return;
      try { setSelectValue(el, val); } catch (_) {
        if ([...el.options].some((o) => o.value === String(val))) {
          el.value = String(val);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    try { refreshSelects(root); } catch (_) {}
  });

  return catalog;
}

export function readAcademicFields(root = document) {
  const g = (id) => root.querySelector(`#${id}`)?.value?.trim() || null;
  const yos = g('year_of_study');
  const sem = g('semester');
  return {
    campus: g('campus'),
    faculty: g('faculty'),
    programme: g('programme'),
    academic_year: g('academic_year'),
    semester: sem ? Number(sem) : null,
    year_of_study: yos ? Number(yos) : null,
  };
}
