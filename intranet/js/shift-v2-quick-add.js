(() => {
  'use strict';

  const STYLE_ID = 'shift-v2-quick-add-style';
  const MODAL_ID = 'quick-add-modal';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const CLOUD_SHIFTS = 'shiftV2Shifts';
  const DEFAULT_START = 17 * 60;
  const DAY_START = 15 * 60;
  const DAY_END = 30 * 60;
  const SLOT = 30;
  let pendingStaff = null;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    injectModal();
    enhanceStaffCards();
    const observer = new MutationObserver(enhanceStaffCards);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onClick, true);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .staff-card{position:relative;padding-right:58px!important}
      .staff-card .quick-add-btn{position:absolute;right:7px;top:50%;transform:translateY(-50%);border:1px solid #cfd8e6;background:#fff;color:#344054;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer;box-shadow:0 2px 6px rgba(16,24,40,.04)}
      .staff-card .quick-add-btn:hover{background:#f8fafc;border-color:#98a2b3}
      .staff-card.assigned .quick-add-btn{background:#f2f4f7;color:#98a2b3;border-color:#e4e7ec;cursor:default}
      .quick-add-note{font-size:9px;color:#667085;font-weight:700;margin-top:6px;line-height:1.5}
      #quick-add-toast{position:fixed;left:50%;top:88px;transform:translateX(-50%);z-index:10060;background:#101828;color:#fff;padding:10px 14px;border-radius:10px;font:800 11px/1.6 'Noto Sans JP',sans-serif;box-shadow:0 12px 30px rgba(16,24,40,.22);max-width:min(680px,90vw);text-align:center}
      .quick-add-bg{display:none;position:fixed;inset:0;z-index:10070;background:rgba(16,24,40,.48);align-items:center;justify-content:center;padding:20px;font-family:'Noto Sans JP',sans-serif}
      .quick-add-bg.open{display:flex}
      .quick-add-dialog{width:min(520px,94vw);background:#fff;border-radius:16px;box-shadow:0 24px 64px rgba(16,24,40,.24);overflow:hidden;border:1px solid #e4e7ec}
      .quick-add-head{padding:16px 18px;border-bottom:1px solid #e4e7ec;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .quick-add-head h3{margin:0;color:#101828;font-size:17px}
      .quick-add-head p{margin:4px 0 0;color:#667085;font-size:10px;font-weight:700;line-height:1.5}
      .quick-add-body{padding:16px 18px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .quick-add-field{display:flex;flex-direction:column;gap:5px}
      .quick-add-field.full{grid-column:1/-1}
      .quick-add-field label{font-size:10px;font-weight:900;color:#344054}
      .quick-add-field select,.quick-add-field input{height:38px;border:1px solid #d0d5dd;border-radius:9px;padding:0 10px;background:#fff;color:#101828;font:700 12px 'Noto Sans JP',sans-serif}
      .quick-add-summary{grid-column:1/-1;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e4e7ec;color:#475467;font-size:10px;font-weight:700;line-height:1.6}
      .quick-add-foot{padding:12px 18px 16px;display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #f2f4f7}
      @media(max-width:640px){.quick-add-body{grid-template-columns:1fr}.quick-add-field.full,.quick-add-summary{grid-column:1}}
    `;
    document.head.appendChild(style);
  }

  function injectModal() {
    if (document.getElementById(MODAL_ID)) return;
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'quick-add-bg';
    modal.innerHTML = `
      <div class="quick-add-dialog" role="dialog" aria-modal="true" aria-label="スタッフをシフトへ追加">
        <div class="quick-add-head">
          <div><h3 id="quick-add-title">スタッフを追加</h3><p id="quick-add-subtitle"></p></div>
          <button type="button" class="btn btn-light btn-small" data-quick-add-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="quick-add-body">
          <div class="quick-add-field full"><label>出勤店舗</label><select id="quick-add-store"></select></div>
          <div class="quick-add-field"><label>開始時刻</label><select id="quick-add-start"></select></div>
          <div class="quick-add-field"><label>終了時刻</label><select id="quick-add-end"></select></div>
          <div id="quick-add-summary" class="quick-add-summary"></div>
        </div>
        <div class="quick-add-foot">
          <button type="button" class="btn btn-light" data-quick-add-close>キャンセル</button>
          <button type="button" id="quick-add-confirm" class="btn btn-green"><i class="fa-solid fa-plus"></i> この内容で追加</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    document.getElementById('quick-add-start')?.addEventListener('change', syncModalSummary);
    document.getElementById('quick-add-end')?.addEventListener('change', syncModalSummary);
    document.getElementById('quick-add-store')?.addEventListener('change', syncModalSummary);
  }

  function enhanceStaffCards() {
    const list = document.getElementById('staff-list');
    if (!list) return;
    list.querySelectorAll('.staff-card').forEach(card => {
      if (card.querySelector('.quick-add-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-add-btn';
      btn.dataset.quickAddStaff = card.dataset.staffId || '';
      if (card.classList.contains('assigned')) {
        btn.textContent = '配置済';
        btn.disabled = true;
      } else {
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> 追加';
        btn.title = '店舗と勤務時間を選んで追加';
      }
      card.appendChild(btn);
    });

    const empty = document.getElementById('empty-drop-track');
    if (empty && !empty.querySelector('.quick-add-note')) {
      const note = document.createElement('div');
      note.className = 'quick-add-note';
      note.style.cssText = 'position:absolute;left:12px;bottom:7px;z-index:3;background:rgba(255,255,255,.94);padding:3px 6px;border-radius:6px;border:1px solid #e4e7ec;pointer-events:none';
      note.textContent = '左の「追加」なら店舗・時間を選んで配置できます。ドラッグ操作も残しています。';
      empty.appendChild(note);
    }
  }

  function onClick(event) {
    const button = event.target.closest('[data-quick-add-staff]');
    if (button && !button.disabled) {
      event.preventDefault();
      event.stopPropagation();
      openQuickAdd(button);
      return;
    }

    if (event.target.closest('[data-quick-add-close]') || event.target.id === MODAL_ID) {
      closeModal();
      return;
    }

    if (event.target.closest('#quick-add-confirm')) {
      event.preventDefault();
      confirmQuickAdd();
    }
  }

  function openQuickAdd(button) {
    const card = button.closest('.staff-card');
    const staffId = button.dataset.quickAddStaff;
    const name = card?.querySelector('.staff-name')?.textContent?.trim() || staffId;
    const isMonthly = card?.textContent?.includes('正社員');
    const date = document.getElementById('work-date')?.value || '';
    const start = DEFAULT_START;
    const end = Math.min(DAY_END, start + (isMonthly ? 8 : 5) * 60);
    pendingStaff = { staffId, name, date, isMonthly };

    document.getElementById('quick-add-title').textContent = `${name} を追加`;
    document.getElementById('quick-add-subtitle').textContent = `${date || '選択日'} のシフトに追加します。ドラッグ操作は不要です。`;

    const storeSelect = document.getElementById('quick-add-store');
    const activeStore = document.querySelector('#new-store-buttons button.active')?.dataset.store || '';
    const stores = Array.from(document.querySelectorAll('#new-store-buttons button[data-store]')).map(btn => ({ id: btn.dataset.store, name: btn.textContent.trim() }));
    storeSelect.innerHTML = stores.map(store => `<option value="${esc(store.id)}" ${store.id === activeStore ? 'selected' : ''}>${esc(store.name)}</option>`).join('');

    const startSelect = document.getElementById('quick-add-start');
    const endSelect = document.getElementById('quick-add-end');
    startSelect.innerHTML = timeOptions(DAY_START, DAY_END - SLOT, start);
    endSelect.innerHTML = timeOptions(DAY_START + SLOT, DAY_END, end);
    startSelect.value = String(start);
    endSelect.value = String(end);
    syncEndMinimum();
    syncModalSummary();
    document.getElementById(MODAL_ID)?.classList.add('open');
  }

  function closeModal() {
    document.getElementById(MODAL_ID)?.classList.remove('open');
    pendingStaff = null;
  }

  function syncEndMinimum() {
    const startSelect = document.getElementById('quick-add-start');
    const endSelect = document.getElementById('quick-add-end');
    if (!startSelect || !endSelect) return;
    const start = Number(startSelect.value || DEFAULT_START);
    let end = Number(endSelect.value || start + SLOT);
    if (end <= start) end = Math.min(DAY_END, start + SLOT);
    endSelect.innerHTML = timeOptions(start + SLOT, DAY_END, end);
    endSelect.value = String(end);
  }

  function syncModalSummary() {
    syncEndMinimum();
    const start = Number(document.getElementById('quick-add-start')?.value || DEFAULT_START);
    const end = Number(document.getElementById('quick-add-end')?.value || start + SLOT);
    const store = document.getElementById('quick-add-store')?.selectedOptions?.[0]?.textContent || '';
    const duration = Math.max(0, end - start);
    const summary = document.getElementById('quick-add-summary');
    if (summary) summary.textContent = `${store} / ${fmtTime(start)}〜${fmtTime(end)} / ${formatDuration(duration)}`;
  }

  async function confirmQuickAdd() {
    if (!pendingStaff) return;
    const storeId = document.getElementById('quick-add-store')?.value || '';
    const start = Number(document.getElementById('quick-add-start')?.value || DEFAULT_START);
    const end = Number(document.getElementById('quick-add-end')?.value || start + SLOT);
    if (!storeId) return showToast('出勤店舗を選んでください。');
    if (end <= start) return showToast('終了時刻は開始時刻より後にしてください。');

    const staff = { ...pendingStaff };
    const date = staff.date || document.getElementById('work-date')?.value || '';
    if (!date) return showToast('日付を選んでください。');

    const shifts = loadObject(SHIFTS_KEY);
    if (!Array.isArray(shifts[date])) shifts[date] = [];
    if (shifts[date].some(item => sameId(item.staffId, staff.staffId))) return showToast('このスタッフはすでにこの日に配置されています。');

    const requestedOff = isRequestedOff(staff.staffId, date);
    const shift = {
      id: uid(),
      staffId: staff.staffId,
      startStoreId: storeId,
      start,
      end,
      memo: requestedOff ? '希望休を管理者判断で上書き配置' : '',
      manualAdded: true,
      requestedOffOverride: requestedOff,
      createdAt: new Date().toISOString(),
      createdBy: actorName(),
    };
    shifts[date].push(shift);
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));

    try {
      if (window.shiftV2Cloud && window.shiftV2User) await window.shiftV2Cloud.set(CLOUD_SHIFTS, shifts);
    } catch (error) {
      console.warn('Quick add cloud save failed', error);
    }

    sessionStorage.setItem('okk_shift_v2_quick_add_restore', JSON.stringify({ date, shiftId: shift.id }));
    closeModal();
    showToast(`${staff.name} を ${fmtTime(start)}〜${fmtTime(end)} で追加しました。`);
    setTimeout(() => window.location.reload(), 280);
  }

  function restoreAfterReload() {
    const raw = sessionStorage.getItem('okk_shift_v2_quick_add_restore');
    if (!raw) return;
    sessionStorage.removeItem('okk_shift_v2_quick_add_restore');
    let info;
    try { info = JSON.parse(raw); } catch { return; }
    setTimeout(() => {
      const input = document.getElementById('work-date');
      if (input && info.date) {
        input.value = info.date;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setTimeout(() => {
        const edit = document.querySelector(`#gantt-canvas [data-select="${cssEsc(info.shiftId || '')}"]`);
        edit?.click();
        document.getElementById('inspector')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 220);
    }, 450);
  }

  function isRequestedOff(staffId, date) {
    const holiday = loadObject(HOLIDAY_KEY);
    const days = Array.isArray(holiday.staffDays) ? holiday.staffDays : [];
    return days.some(item => sameId(item.staffId, staffId) && item.date === date && item.requestedOff === true);
  }

  function timeOptions(min, max, selected) {
    const rows = [];
    for (let minute = min; minute <= max; minute += SLOT) rows.push(`<option value="${minute}" ${minute === selected ? 'selected' : ''}>${fmtTime(minute)}</option>`);
    return rows.join('');
  }

  function fmtTime(minute) {
    const normalized = Number(minute) || 0;
    const hour = Math.floor(normalized / 60);
    const mins = normalized % 60;
    return `${hour}:${String(mins).padStart(2, '0')}`;
  }

  function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}時間${mins}分` : `${hours}時間`;
  }

  function loadObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
  }

  function sameId(a, b) { return String(a || '').toUpperCase() === String(b || '').toUpperCase(); }
  function uid() { return `shift_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function actorName() { return window.shiftV2User?.displayName || window.shiftV2User?.email || 'ローカル利用者'; }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function cssEsc(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function showToast(message) {
    document.getElementById('quick-add-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'quick-add-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  restoreAfterReload();
})();