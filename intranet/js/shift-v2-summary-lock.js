(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const STORES_KEY = 'okk_shift_v2_config';
  const STORE_KEY = 'okk_shift_v2_field_hearing_store';

  let observer = null;
  let observedNode = null;
  let patching = false;

  if (window.__shiftV2SummaryLockInstalled) return;
  window.__shiftV2SummaryLockInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    connect();

    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-view="rules"],#stable-rules-tabs [data-stable-tab],#rs-staff-body .rs-lv')) {
        queueMicrotask(() => {
          connect();
          patchSummary();
        });
      }
    }, false);

    document.addEventListener('change', event => {
      if (event.target?.id === 'stable-store') queueMicrotask(patchSummary);
    }, false);
  }

  function connect() {
    const node = document.getElementById('rs-summary');
    if (!node) {
      setTimeout(connect, 80);
      return;
    }

    if (observer && observedNode === node) {
      patchSummary();
      return;
    }

    observer?.disconnect();
    observedNode = node;
    observer = new MutationObserver(() => {
      if (patching) return;
      patchSummary();
    });
    observer.observe(node, { childList:true, subtree:false });
    patchSummary();
  }

  function patchSummary() {
    const node = document.getElementById('rs-summary');
    if (!node) return;

    const storeId = currentStore();
    const people = loadStaff().filter(person => !storeId || matchesStore(person, storeId));
    const skilled = people.filter(person => Object.values(person?.skillLevels || {}).some(value => Number(value) > 0)).length;
    const unset = Math.max(0, people.length - skilled);
    const requirements = loadRequirements().filter(rule => rule?.active !== false && (!storeId || String(rule.storeId || '') === storeId));

    const next = [
      metric('対象店舗', storeName(storeId) || '全店舗'),
      metric('対象スタッフ', `${people.length}名`),
      metric('Lv入力済', `${skilled}名`),
      metric('Lv未設定', `${unset}名`, unset ? '現場確認が必要' : '入力済み'),
      metric('必要人数設定', `${requirements.length}件`),
    ].join('');

    if (node.innerHTML === next) return;

    patching = true;
    observer?.disconnect();
    node.innerHTML = next;
    if (observer && observedNode === node) observer.observe(node, { childList:true, subtree:false });
    patching = false;
  }

  function currentStore() {
    return String(document.getElementById('stable-store')?.value || sessionStorage.getItem(STORE_KEY) || '');
  }

  function loadStaff() {
    try {
      const value = JSON.parse(localStorage.getItem(STAFF_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function loadRequirements() {
    try {
      const value = JSON.parse(localStorage.getItem(REQUIREMENTS_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function loadStores() {
    try {
      const value = JSON.parse(localStorage.getItem(STORES_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function matchesStore(person, storeId) {
    if (!person) return false;
    const ids = [
      person.mainStoreId,
      ...(Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : []),
      ...(Array.isArray(person.placementStoreIds) ? person.placementStoreIds : []),
    ].filter(Boolean).map(String);
    return ids.includes(storeId);
  }

  function storeName(id) {
    return loadStores().find(store => String(store.id) === String(id))?.name || ({ matsuyama:'松山店', kumoji:'久茂地店', miebashi:'美栄橋店', misato:'美里店' })[id] || id;
  }

  function metric(label, value, note = '') {
    return `<div><small>${esc(label)}</small><strong>${esc(value)}</strong>${note ? `<span>${esc(note)}</span>` : ''}</div>`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
})();
