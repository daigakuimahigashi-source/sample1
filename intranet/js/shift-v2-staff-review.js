(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const REVIEW_KEY = 'okk_shift_v2_staff_review_v1';
  const FILTER_KEY = 'okk_shift_v2_unreviewed_only';
  const STORE_KEY = 'okk_shift_v2_field_hearing_store';
  const STYLE_ID = 'shift-v2-staff-review-style';
  const FILTER_ID = 'stable-unreviewed-only';

  if (window.__shiftV2StaffReviewInstalled) return;
  window.__shiftV2StaffReviewInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    bindEvents();
    scheduleRefresh(120);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const openRules = event.target.closest?.('[data-view="rules"]');
      if (openRules) {
        scheduleRefresh(120);
        return;
      }

      const tab = event.target.closest?.('#stable-rules-tabs [data-stable-tab]');
      if (tab) {
        scheduleRefresh(40);
        return;
      }

      const review = event.target.closest?.('[data-staff-review]');
      if (review) {
        event.preventDefault();
        event.stopPropagation();
        const storeId = currentStore();
        const personId = normalizeId(review.dataset.staffReview);
        if (!storeId) {
          toast('スタッフ確認は店舗を選んで行ってください。');
          return;
        }
        toggleReviewed(storeId, personId);
        refresh();
        return;
      }

      const skill = event.target.closest?.('#rs-staff-body .rs-lv');
      if (skill) {
        const personId = normalizeId(skill.closest('tr[data-person]')?.dataset.person);
        // Lv変更は確認完了ではない。既存の確認済み状態があれば全店舗で再確認に戻す。
        if (personId) clearPersonFromAllStores(personId);
        scheduleRefresh(90);
        return;
      }

      if (event.target.closest?.('#rs-add-skill,#rs-skill-list button,.rs-delete')) {
        scheduleRefresh(140);
      }
    }, false);

    // stable-uiの旧「人員・スキル全体確認」ボタンは、個人別進捗表示として使う。
    document.addEventListener('click', event => {
      const oldStaffConfirm = event.target.closest?.('[data-stable-confirm="staff"]');
      if (!oldStaffConfirm) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    document.addEventListener('change', event => {
      if (event.target?.id === 'stable-store') {
        scheduleRefresh(30);
        return;
      }
      if (event.target?.id === FILTER_ID) {
        sessionStorage.setItem(FILTER_KEY, event.target.checked ? '1' : '0');
        refresh();
      }
    }, false);

    document.addEventListener('input', event => {
      if (event.target?.id === 'rs-staff-search') scheduleRefresh(70);
    }, false);
  }

  function scheduleRefresh(delay = 0) {
    setTimeout(refresh, delay);
  }

  function refresh() {
    const staffSection = document.getElementById('rs-staff');
    const body = document.getElementById('rs-staff-body');
    const head = document.getElementById('rs-staff-head');
    if (!staffSection || !body || !head) return;

    installFilter();
    decorateHeader(head);
    decorateRows(body);
    updateProgress();
    applyFilters();
    convertGlobalStaffConfirmToProgress();
  }

  function installFilter() {
    const toolbar = document.getElementById('stable-field-toolbar');
    if (!toolbar || document.getElementById(FILTER_ID)) return;

    const left = toolbar.querySelector('.stable-field-left');
    if (!left) return;

    const label = document.createElement('label');
    label.className = 'staff-review-filter';
    label.innerHTML = `<input id="${FILTER_ID}" type="checkbox"> <span>未確認の人だけ表示</span>`;
    left.appendChild(label);

    // 初期値は必ずOFF。ユーザーがこのタブ内でONにした時だけsessionStorageで維持。
    const saved = sessionStorage.getItem(FILTER_KEY);
    label.querySelector('input').checked = saved === '1';
  }

  function decorateHeader(head) {
    const row = head.querySelector('tr');
    if (!row) return;
    row.querySelector('.staff-review-head')?.remove();
    const th = document.createElement('th');
    th.className = 'staff-review-head';
    th.textContent = '確認';
    row.appendChild(th);
  }

  function decorateRows(body) {
    const storeId = currentStore();
    const reviews = loadReviews();

    body.querySelectorAll('tr[data-person]').forEach(row => {
      row.querySelector('.staff-review-cell')?.remove();
      const personId = normalizeId(row.dataset.person);
      const reviewed = Boolean(storeId && reviews?.[storeId]?.[personId]);

      const td = document.createElement('td');
      td.className = 'staff-review-cell';
      td.innerHTML = storeId
        ? `<button type="button" class="staff-review-btn ${reviewed ? 'reviewed' : ''}" data-staff-review="${esc(personId)}"><i class="fa-solid ${reviewed ? 'fa-circle-check' : 'fa-check'}"></i><span>${reviewed ? '確認済み' : 'この内容で確認'}</span></button>`
        : '<span class="staff-review-store-hint">店舗を選択</span>';
      row.appendChild(td);
      row.dataset.staffReviewed = reviewed ? '1' : '0';
    });
  }

  function applyFilters() {
    const storeId = currentStore();
    const unreviewedOnly = document.getElementById(FILTER_ID)?.checked === true;
    const staff = loadStaff();

    document.querySelectorAll('#rs-staff-body tr[data-person]').forEach(row => {
      const personId = normalizeId(row.dataset.person);
      const person = staff.find(item => normalizeId(item.id || item.employeeNumber) === personId);
      const storeMatch = !storeId || matchesStore(person, storeId);
      const reviewMatch = !unreviewedOnly || row.dataset.staffReviewed !== '1';
      row.classList.toggle('staff-review-hidden', !(storeMatch && reviewMatch));
    });
  }

  function updateProgress() {
    const count = document.getElementById('stable-staff-count');
    if (!count) return;

    const storeId = currentStore();
    const staff = loadStaff().filter(person => !storeId || matchesStore(person, storeId));
    const reviews = loadReviews();
    const reviewed = storeId
      ? staff.filter(person => Boolean(reviews?.[storeId]?.[normalizeId(person.id || person.employeeNumber)])).length
      : 0;

    if (!storeId) {
      count.innerHTML = '<strong>全店舗</strong> 店舗を選ぶとスタッフ確認を進められます';
      return;
    }

    const remaining = Math.max(0, staff.length - reviewed);
    count.innerHTML = `<strong>${esc(storeName(storeId))}</strong> <b>${reviewed}/${staff.length}名 確認済み</b>${remaining ? ` / <span>${remaining}名 未確認</span>` : ' / <em>全員確認済み</em>'}`;
  }

  function convertGlobalStaffConfirmToProgress() {
    const button = document.querySelector('[data-stable-confirm="staff"]');
    if (!button) return;

    const storeId = currentStore();
    const staff = loadStaff().filter(person => !storeId || matchesStore(person, storeId));
    const reviews = loadReviews();
    const reviewed = storeId
      ? staff.filter(person => Boolean(reviews?.[storeId]?.[normalizeId(person.id || person.employeeNumber)])).length
      : 0;
    const complete = Boolean(storeId && staff.length && reviewed === staff.length);

    button.disabled = true;
    button.classList.toggle('confirmed', complete);
    button.classList.add('staff-review-progress-button');
    const label = button.querySelector('span');
    const state = button.querySelector('b');
    if (label) label.textContent = 'スタッフ確認';
    if (state) state.textContent = storeId ? `${reviewed}/${staff.length}名` : '店舗を選択';
  }

  function toggleReviewed(storeId, personId) {
    const reviews = loadReviews();
    reviews[storeId] = reviews[storeId] || {};
    if (reviews[storeId][personId]) delete reviews[storeId][personId];
    else reviews[storeId][personId] = new Date().toISOString();
    saveReviews(reviews);
  }

  function clearPersonFromAllStores(personId) {
    const reviews = loadReviews();
    let changed = false;
    Object.keys(reviews).forEach(storeId => {
      if (reviews[storeId]?.[personId]) {
        delete reviews[storeId][personId];
        changed = true;
      }
    });
    if (changed) saveReviews(reviews);
  }

  function loadReviews() {
    try {
      const value = JSON.parse(localStorage.getItem(REVIEW_KEY));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function saveReviews(value) {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(value));
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

  function matchesStore(person, storeId) {
    if (!person) return false;
    const ids = [
      person.mainStoreId,
      ...(Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : []),
      ...(Array.isArray(person.placementStoreIds) ? person.placementStoreIds : []),
    ].filter(Boolean).map(String);
    return ids.includes(String(storeId));
  }

  function storeName(id) {
    try {
      const stores = JSON.parse(localStorage.getItem('okk_shift_v2_config'));
      const found = Array.isArray(stores) ? stores.find(store => String(store.id) === String(id)) : null;
      if (found?.name) return found.name;
    } catch {}
    return ({ matsuyama:'松山店', kumoji:'久茂地店', miebashi:'美栄橋店', misato:'美里店' })[id] || id;
  }

  function normalizeId(value) {
    return String(value || '').trim().toUpperCase();
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 2200);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #stable-field-toolbar .staff-review-filter{display:flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid #d0d5dd;border-radius:7px;background:#fff;color:#344054;font-size:9px;font-weight:800;cursor:pointer;white-space:nowrap}
      #stable-field-toolbar .staff-review-filter input{margin:0}
      #stable-staff-count b{color:#344054;font-weight:900}#stable-staff-count em{color:#067647;font-style:normal;font-weight:900}
      #rs-staff .staff-review-head{width:120px;min-width:120px;text-align:center;position:sticky;right:0;background:#f9fafb;z-index:3}
      #rs-staff .staff-review-cell{width:120px;min-width:120px;text-align:center;position:sticky;right:0;background:#fff;z-index:2;border-left:1px solid #eaecf0}
      #rs-staff .staff-review-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;width:106px;padding:6px 7px;border:1px solid #d0d5dd;border-radius:7px;background:#fff;color:#344054;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}
      #rs-staff .staff-review-btn:hover{background:#f8fafc;border-color:#98a2b3}
      #rs-staff .staff-review-btn.reviewed{background:#ecfdf3;border-color:#abefc6;color:#067647}
      #rs-staff .staff-review-store-hint{font-size:8px;color:#98a2b3;font-weight:800}
      #rs-staff-body tr.staff-review-hidden{display:none!important}
      .staff-review-progress-button:disabled{opacity:1!important;cursor:default!important}
      @media(max-width:900px){#stable-field-toolbar .staff-review-filter{width:max-content}#rs-staff .staff-review-head,#rs-staff .staff-review-cell{position:static}}
    `;
    document.head.appendChild(style);
  }
})();
