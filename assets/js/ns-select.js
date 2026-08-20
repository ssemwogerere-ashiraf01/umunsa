/**
 * Custom searchable select — mobile-friendly list UI.
 * options: [{ value, label, sub?, order? }]
 */
export function createNsSelect({
  mount,
  options = [],
  value = '',
  placeholder = 'Select…',
  onChange,
  searchable = true,
}) {
  if (!mount) return null;

  function escape(s) {
    const d = document.createElement('div');
    d.textContent = s ?? '';
    return d.innerHTML;
  }

  const root = document.createElement('div');
  root.className = 'ns-select';
  root.innerHTML = `
    <button type="button" class="ns-select-btn" aria-haspopup="listbox" aria-expanded="false">
      <span class="ns-select-value"><span class="ns-placeholder">${escape(placeholder)}</span></span>
      <svg class="ns-select-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="ns-select-panel" role="listbox">
      ${searchable ? '<div class="ns-select-search"><input type="search" placeholder="Search positions…" autocomplete="off" /></div>' : ''}
      <div class="ns-select-list"></div>
    </div>
  `;

  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.value = value || '';
  root.appendChild(hidden);

  mount.innerHTML = '';
  mount.appendChild(root);

  const btn = root.querySelector('.ns-select-btn');
  const valueEl = root.querySelector('.ns-select-value');
  const panel = root.querySelector('.ns-select-panel');
  const list = root.querySelector('.ns-select-list');
  const search = root.querySelector('.ns-select-search input');

  let current = value || '';
  let items = Array.isArray(options) ? options.slice() : [];

  function selectedItem() {
    return items.find(o => String(o.value) === String(current));
  }

  function renderValue() {
    const item = selectedItem();
    if (!item) {
      valueEl.innerHTML = `<span class="ns-placeholder">${escape(placeholder)}</span>`;
      return;
    }
    valueEl.innerHTML = `
      <span class="ns-main">${escape(item.label)}</span>
      ${item.sub ? `<span class="ns-sub">${escape(item.sub)}</span>` : ''}
    `;
  }

  function renderList(filter = '') {
    const q = filter.trim().toLowerCase();
    const filtered = (!q
      ? items
      : items.filter(o =>
          (o.label || '').toLowerCase().includes(q) ||
          (o.sub || '').toLowerCase().includes(q)
        ));

    if (!filtered.length) {
      list.innerHTML = '<div class="ns-select-empty">No matches</div>';
      return;
    }

    list.innerHTML = filtered.map(o => {
      const selected = String(o.value) === String(current);
      const hasRank = o.order != null && o.order !== '';
      const rank = hasRank
        ? `<span class="ns-rank">${escape(String(o.order))}</span>`
        : '';
      return `
        <button type="button"
          class="ns-select-option${selected ? ' selected' : ''}${hasRank ? '' : ' no-rank'}"
          role="option"
          data-value="${escape(String(o.value))}"
          aria-selected="${selected}">
          ${rank}
          <span class="ns-opt-text">
            <span class="ns-opt-main">${escape(o.label)}</span>
            ${o.sub ? `<span class="ns-opt-sub">${escape(o.sub)}</span>` : ''}
          </span>
          <span class="ns-check" aria-hidden="true">${selected ? '✓' : ''}</span>
        </button>`;
    }).join('');

    list.querySelectorAll('.ns-select-option').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        current = el.dataset.value;
        hidden.value = current;
        renderValue();
        renderList(search?.value || '');
        close();
        if (typeof onChange === 'function') onChange(current, selectedItem());
      });
    });
  }

  function open() {
    root.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    renderList(search?.value || '');
    if (search) setTimeout(() => search.focus(), 20);
  }
  function close() {
    root.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    if (search) search.value = '';
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    root.classList.contains('open') ? close() : open();
  });
  search?.addEventListener('input', () => renderList(search.value));
  search?.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target)) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  renderValue();

  return {
    get value() { return current; },
    set value(v) {
      current = v || '';
      hidden.value = current;
      renderValue();
      if (root.classList.contains('open')) renderList(search?.value || '');
    },
    setOptions(next) {
      items = next || [];
      renderValue();
    },
    el: root,
    hidden,
  };
}


/**
 * Upgrade every native <select> in root to the custom picker.
 * Keeps the original <select> in the DOM (hidden) so forms & change handlers still work.
 * Skip: [data-native], [data-ns-enhanced], multiple, size>1, already inside .ns-select
 */
export function enhanceAllSelects(root = document) {
  const selects = root.querySelectorAll('select:not([data-native]):not([data-ns-enhanced]):not([multiple])');
  selects.forEach((sel) => {
    if (sel.closest('.ns-select')) return;
    if (sel.size && sel.size > 1) return;
    if (sel.offsetParent === null && sel.type === 'hidden') return;

    // Build options from native select
    const options = [];
    const groups = sel.querySelectorAll(':scope > optgroup, :scope > option');
    // Flatten options only (skip empty placeholder for list but keep value)
    Array.from(sel.options).forEach((opt) => {
      options.push({
        value: opt.value,
        label: (opt.textContent || '').trim() || opt.value || '—',
        sub: opt.dataset.sub || '',
        order: opt.dataset.order != null ? Number(opt.dataset.order) : undefined,
        disabled: opt.disabled,
      });
    });

    // Mount wrapper before select
    const wrap = document.createElement('div');
    wrap.className = 'ns-select-host';
    sel.parentNode.insertBefore(wrap, sel);
    sel.setAttribute('data-ns-enhanced', '1');
    sel.classList.add('ns-select-native-hidden');
    // keep select for form submit — visually hide
    sel.style.position = 'absolute';
    sel.style.opacity = '0';
    sel.style.pointerEvents = 'none';
    sel.style.width = '1px';
    sel.style.height = '1px';
    sel.tabIndex = -1;

    const placeholder =
      sel.getAttribute('data-placeholder') ||
      (sel.options[0] && !sel.options[0].value ? (sel.options[0].textContent || '').trim() : 'Select…');

    // Don't list the empty placeholder option twice as a choosable empty if it's the first blank
    const listOpts = options.filter((o, i) => !(i === 0 && o.value === '' && !sel.value));

    const instance = createNsSelect({
      mount: wrap,
      options: listOpts.length ? listOpts : options,
      value: sel.value || '',
      placeholder,
      searchable: options.length > 8,
      onChange: (val) => {
        sel.value = val;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        sel.dispatchEvent(new Event('input', { bubbles: true }));
      },
    });

    // Sync if something else changes the native select
    sel.addEventListener('change', () => {
      if (instance && instance.value !== sel.value) instance.value = sel.value;
    });

    // Observe option list changes (dynamic filters)
    const mo = new MutationObserver(() => {
      const next = Array.from(sel.options).map((opt) => ({
        value: opt.value,
        label: (opt.textContent || '').trim() || opt.value || '—',
        sub: opt.dataset.sub || '',
        order: opt.dataset.order != null ? Number(opt.dataset.order) : undefined,
      }));
      instance.setOptions(next.filter((o, i) => !(i === 0 && o.value === '')));
      instance.value = sel.value;
    });
    mo.observe(sel, { childList: true, subtree: true, characterData: true });
  });
}

/** Call after dynamic HTML injects new selects */
export function refreshSelects(root = document) {
  enhanceAllSelects(root);
}

// Auto-run when loaded as module on pages that import it
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => enhanceAllSelects());
  } else {
    // slight delay so page scripts can finish building selects
    setTimeout(() => enhanceAllSelects(), 0);
  }
}
