/**
 * Uganda tribes & clans — loaded from Supabase tables `tribes` and `clans`.
 * Falls back to empty lists if offline; forms still allow "Other".
 */
import { supabase } from './supabase-client.js';

let _cache = null; // { tribes: [{id,name,ethnic_group}], clansByTribeId: Map<id, string[]> }

export async function loadTribesAndClans() {
  if (_cache) return _cache;
  const [{ data: tribes, error: tErr }, { data: clans, error: cErr }] = await Promise.all([
    supabase.from('tribes').select('id, name, ethnic_group, display_order').order('display_order'),
    supabase.from('clans').select('id, tribe_id, name, display_order').order('display_order'),
  ]);
  if (tErr) console.warn('tribes load', tErr);
  if (cErr) console.warn('clans load', cErr);

  const clansByTribeId = new Map();
  for (const c of (clans || [])) {
    if (!clansByTribeId.has(c.tribe_id)) clansByTribeId.set(c.tribe_id, []);
    clansByTribeId.get(c.tribe_id).push(c.name);
  }
  _cache = {
    tribes: tribes || [],
    clansByTribeId,
  };
  return _cache;
}

export function tribeNames(cache) {
  return (cache?.tribes || []).map(t => t.name);
}

export function clansForTribeName(cache, tribeName) {
  if (!cache || !tribeName || tribeName === 'Other') return [];
  const row = cache.tribes.find(t => t.name === tribeName);
  if (!row) return [];
  return cache.clansByTribeId.get(row.id) || [];
}

/**
 * Wire #tribe and #clan selects (+ optional #tribe_other / #clan_other).
 * @param {Document|HTMLElement} root
 * @param {{ tribe?: string, clan?: string }} initial
 */
export async function wireTribeClanSelects(root = document, initial = {}) {
  const tribeEl = root.querySelector('#tribe');
  const clanEl = root.querySelector('#clan');
  if (!tribeEl || !clanEl) return null;

  const cache = await loadTribesAndClans();
  const tribes = tribeNames(cache);
  const tribeOtherWrap = root.querySelector('#tribe-other-wrap');
  const clanOtherWrap = root.querySelector('#clan-other-wrap');
  const tribeOther = root.querySelector('#tribe_other');
  const clanOther = root.querySelector('#clan_other');

  const curTribe = initial.tribe || tribeEl.value || '';
  const isKnownTribe = tribes.includes(curTribe);

  tribeEl.innerHTML =
    `<option value="">Select tribe</option>` +
    tribes.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('') +
    `<option value="Other">Other (specify)</option>`;

  if (curTribe && isKnownTribe) tribeEl.value = curTribe;
  else if (curTribe) {
    tribeEl.value = 'Other';
    if (tribeOtherWrap) tribeOtherWrap.style.display = 'block';
    if (tribeOther) tribeOther.value = curTribe;
  }

  function syncClans() {
    const t = tribeEl.value;
    if (tribeOtherWrap) {
      tribeOtherWrap.style.display = t === 'Other' ? 'block' : 'none';
      if (tribeOther) tribeOther.required = t === 'Other';
    }
    const clans = clansForTribeName(cache, t);
    const curClan = initial.clan || clanEl.value || '';
    const known = clans.includes(curClan);

    if (!t || t === 'Other') {
      clanEl.innerHTML = `<option value="">${t === 'Other' ? 'Select or specify clan' : 'Select tribe first'}</option><option value="Other">Other (specify)</option>`;
      if (curClan && !known) {
        clanEl.value = 'Other';
        if (clanOtherWrap) clanOtherWrap.style.display = 'block';
        if (clanOther) clanOther.value = curClan;
      }
    } else {
      clanEl.innerHTML =
        `<option value="">Select clan</option>` +
        clans.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('') +
        `<option value="Other">Other (specify)</option>`;
      if (curClan && known) clanEl.value = curClan;
      else if (curClan) {
        clanEl.value = 'Other';
        if (clanOtherWrap) clanOtherWrap.style.display = 'block';
        if (clanOther) clanOther.value = curClan;
      }
    }
    if (clanOtherWrap && clanEl.value !== 'Other') {
      clanOtherWrap.style.display = 'none';
      if (clanOther) clanOther.required = false;
    }
  }

  // Avoid stacking listeners on re-wire
  tribeEl.onchange = () => {
    initial.clan = '';
    syncClans();
  };
  clanEl.onchange = () => {
    const isOther = clanEl.value === 'Other';
    if (clanOtherWrap) clanOtherWrap.style.display = isOther ? 'block' : 'none';
    if (clanOther) clanOther.required = isOther;
  };
  syncClans();
  return cache;
}

export function readTribeClan(root = document) {
  let tribe = root.querySelector('#tribe')?.value?.trim() || '';
  let clan = root.querySelector('#clan')?.value?.trim() || '';
  if (tribe === 'Other') {
    tribe = root.querySelector('#tribe_other')?.value?.trim() || 'Other';
  }
  if (clan === 'Other') {
    clan = root.querySelector('#clan_other')?.value?.trim() || 'Other';
  }
  return {
    tribe: tribe || null,
    clan: clan || null,
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
