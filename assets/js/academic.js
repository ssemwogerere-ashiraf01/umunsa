/**
 * Load campuses, faculties, programmes from Supabase and wire cascading selects.
 * Uses native <select> so enhanceAllSelects / ns-select can style them.
 */
import { supabase } from './supabase-client.js';
import { refreshSelects } from './ns-select.js';

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

function fillSelect(sel, options, placeholder, current) {
  if (!sel) return;
  const cur = current ?? sel.value;
  sel.innerHTML =
    `<option value="">${placeholder}</option>` +
    options.map(o => `<option value="${escapeAttr(o.value)}">${escapeAttr(o.label)}</option>`).join('');
  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/** Current academic year label e.g. 2025/2026 based on August boundary */
export function defaultAcademicYear() {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 7 ? y : y - 1; // Aug–Jul cycle
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
 * Elements: #campus, #faculty, #programme, optional #academic_year, #semester, #year_of_study
 * @param {{ campus?: string, faculty?: string, programme?: string, academic_year?: string, semester?: number|string, year_of_study?: number|string }} initial
 */
export async function mountAcademicFields(root = document, initial = {}) {
  const campusEl = root.querySelector('#campus') || root.querySelector('[name="campus"]');
  const facultyEl = root.querySelector('#faculty') || root.querySelector('[name="faculty"]');
  const programmeEl = root.querySelector('#programme') || root.querySelector('[name="programme"]');
  const yearEl = root.querySelector('#academic_year') || root.querySelector('[name="academic_year"]');
  const semesterEl = root.querySelector('#semester') || root.querySelector('[name="semester"]');
  const yosEl = root.querySelector('#year_of_study') || root.querySelector('[name="year_of_study"]');

  const catalog = await loadAcademicCatalog();

  if (campusEl && campusEl.tagName === 'SELECT') {
    fillSelect(
      campusEl,
      catalog.campuses.map(c => ({ value: c.name, label: c.name })),
      'Select campus',
      initial.campus || ''
    );
  }

  if (facultyEl && facultyEl.tagName === 'SELECT') {
    fillSelect(
      facultyEl,
      catalog.faculties.map(f => ({ value: f.name, label: f.name })),
      'Select faculty',
      initial.faculty || ''
    );
  }

  function syncProgrammes() {
    if (!programmeEl || programmeEl.tagName !== 'SELECT') return;
    const fname = facultyEl?.value || initial.faculty || '';
    const fac = catalog.faculties.find(f => f.name === fname);
    const list = fac
      ? catalog.programmes.filter(p => p.faculty_id === fac.id)
      : [];
    fillSelect(
      programmeEl,
      list.map(p => ({ value: p.name, label: p.name })),
      fac ? 'Select programme' : 'Select faculty first',
      initial.programme || programmeEl.value || ''
    );
    try { refreshSelects(root); } catch (_) {}
  }

  if (facultyEl) {
    facultyEl.addEventListener('change', () => {
      initial.programme = '';
      syncProgrammes();
    });
  }
  syncProgrammes();

  if (yearEl && yearEl.tagName === 'SELECT') {
    fillSelect(
      yearEl,
      academicYearOptions().map(y => ({ value: y, label: y })),
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
      initial.semester != null ? String(initial.semester) : ''
    );
  }

  if (yosEl && yosEl.tagName === 'SELECT') {
    fillSelect(
      yosEl,
      [1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: `Year ${n}` })),
      'Year of study',
      initial.year_of_study != null ? String(initial.year_of_study) : ''
    );
  }

  try { refreshSelects(root); } catch (_) {}
  return catalog;
}

/** Read academic fields from a form root into a plain object for profile update */
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
