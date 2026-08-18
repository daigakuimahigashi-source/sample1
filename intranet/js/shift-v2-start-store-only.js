(() => {
  'use strict';

  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';

  injectStyle();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    patchAll();
    const observer = new MutationObserver(() => patchAll());
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('change', event => {
      if (event.target?.id === 'store-date') setTimeout(patchStoreView, 0);
    });
  }

  function injectStyle() {
    if (document.getElementById('shift-v2-start-store-only-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-start-store-only-style';
    style.textContent = `
      .shift-bar > .seg { display:none !important; }
      .shift-bar > .seg:first-of-type { display:flex !important; width:100% !important; }
      .shift-bar > .join-line { display:none !important; }
      #inspector .route { display:none !important; }
      #view-staff table th:nth-child(6),
      #view-staff table td:nth-child(6) { display:none !important; }
      #settings-modal .settings-table th:nth-child(4),
      #settings-modal .settings-table th:nth-child(5),
      #settings-modal .settings-table td:nth-child(4),
      #settings-modal .settings-table td:nth-child(5) { display:none !important; }
    `;
    document.head.appendChild(style);
  }

  function patchAll() {
    patchStaticCopy();
    patchStaffSummary();
    patchStoreView();
  }

  function patchStaticCopy() {
    const storeNote = document.querySelector('#view-store .toolbar > div:last-child');
    if (storeNote && storeNote.textContent.includes('合流')) {
      storeNote.textContent = '勤務開始店舗ごとの配置を表示します。開始店舗・開始時刻・終了時刻を確認できます。';
    }

    const settingsSub = document.querySelector('#settings-modal .modal-head > div > div');
    if (settingsSub && settingsSub.textContent.includes('自動合流')) {
      settingsSub.textContent = '店舗名・エリア・閉店時刻・表示色を調整';
    }

    const settingsNote = document.querySelector('#settings-modal .modal-body > p');
    if (settingsNote && settingsNote.textContent.includes('自動合流')) {
      settingsNote.textContent = 'シフトには勤務開始店舗・開始時刻・終了時刻を保存します。閉店後の店舗移動はシフト表示には反映しません。';
    }
  }

  function patchStaffSummary() {
    document.querySelectorAll('#staff-summary .metric').forEach(card => {
      const label = card.querySelector('small')?.textContent?.trim();
      if (label === '松山合流') card.style.display = 'none';
    });
  }

  function patchStoreView() {
    const grid = document.getElementById('store-grid');
    if (!grid) return;

    const date = document.getElementById('store-date')?.value || document.getElementById('work-date')?.value;
    if (!date) return;

    const shifts = readJson(SHIFTS_KEY, {});
    const staff = readJson(STAFF_KEY, []);
    const stores = readJson(STORES_KEY, []);
    const rows = Array.isArray(shifts?.[date]) ? shifts[date] : [];

    grid.querySelectorAll('.card').forEach(card => {
      const storeName = card.querySelector('.store-card-head h3')?.textContent?.trim();
      const store = (Array.isArray(stores) ? stores : []).find(item => item?.name === storeName);
      if (!store) return;

      card.querySelectorAll('.member').forEach(member => {
        const sub = member.querySelector('div > div')?.textContent?.trim();
        if (sub === '閉店後合流') {
          member.remove();
          return;
        }

        const name = member.querySelector('strong')?.textContent?.trim();
        const person = (Array.isArray(staff) ? staff : []).find(item => item?.name === name);
        if (!person) return;
        const id = String(person.id || person.employeeNumber || '').toUpperCase();
        const shift = rows.find(item => String(item?.staffId || '').toUpperCase() === id && item?.startStoreId === store.id);
        if (!shift) return;

        const time = member.querySelector(':scope > span');
        if (time) time.textContent = `${fmtTime(shift.start)}-${fmtTime(shift.end)}`;
        if (sub === '出勤') {
          const subNode = member.querySelector('div > div');
          if (subNode) subNode.textContent = '勤務開始';
        }
      });

      const body = card.querySelector('.store-body');
      if (body && !body.querySelector('.member') && !body.querySelector('.empty')) {
        body.innerHTML = '<div class="empty">この日の配置はありません。</div>';
      }
    });
  }

  function fmtTime(total) {
    const value = Number(total || 0);
    const next = value >= 24 * 60;
    const hour = Math.floor(value / 60) % 24;
    const minute = value % 60;
    return `${next ? '翌' : ''}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }
})();
