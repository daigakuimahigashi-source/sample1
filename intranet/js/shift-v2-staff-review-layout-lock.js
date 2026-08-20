(() => {
  'use strict';

  const REVIEW_KEY = 'okk_shift_v2_staff_review_v1';
  const STORE_KEY = 'okk_shift_v2_field_hearing_store';
  let observer = null;
  let headNode = null;
  let bodyNode = null;

  if (window.__shiftV2StaffReviewLayoutLockInstalled) return;
  window.__shiftV2StaffReviewLayoutLockInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    connect();
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-view="rules"],#stable-rules-tabs [data-stable-tab]')) {
        queueMicrotask(connect);
      }
    }, false);
  }

  function connect() {
    const head = document.getElementById('rs-staff-head');
    const body = document.getElementById('rs-staff-body');
    if (!head || !body) {
      setTimeout(connect, 80);
      return;
    }

    if (observer && headNode === head && bodyNode === body) {
      ensureSlots(head, body);
      return;
    }

    observer?.disconnect();
    headNode = head;
    bodyNode = body;
    ensureSlots(head, body);

    // renderStaff() は thead/tbody の直下を丸ごと差し替える。
    // MutationObserver は描画前の microtask で動くので、列が消えたフレームを作らない。
    observer = new MutationObserver(() => ensureSlots(head, body));
    observer.observe(head, { childList:true, subtree:false });
    observer.observe(body, { childList:true, subtree:false });
  }

  function ensureSlots(head, body) {
    const headerRow = head.querySelector('tr');
    if (headerRow && !headerRow.querySelector('.staff-review-head')) {
      const th = document.createElement('th');
      th.className = 'staff-review-head';
      th.textContent = '確認';
      headerRow.appendChild(th);
    }

    const storeId = currentStore();
    const reviews = loadReviews();
    body.querySelectorAll('tr[data-person]').forEach(row => {
      if (row.querySelector('.staff-review-cell')) return;
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

  function currentStore() {
    return String(document.getElementById('stable-store')?.value || sessionStorage.getItem(STORE_KEY) || '');
  }

  function loadReviews() {
    try {
      const value = JSON.parse(localStorage.getItem(REVIEW_KEY));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function normalizeId(value) {
    return String(value || '').trim().toUpperCase();
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
})();
