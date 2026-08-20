(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const STYLE_ID = 'shift-v2-quick-add-guard-style';
  const CHECK_ID = 'quick-add-check';
  const DAILY_LIMIT = 8 * 60;
  const WEEKLY_LIMIT = 40 * 60;
  const BREAK_45_BINDING = 6 * 60 + 45;
  const BREAK_60_BINDING = 9 * 60;
  const DEFAULT_MAX_CONSECUTIVE = 5;

  let currentStaffId = '';
  let latestCheck = { hard: [], warnings: [] };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    document.addEventListener('click', onClickCapture, true);
    document.addEventListener('change', onChangeCapture, true);
    const observer = new MutationObserver(() => {
      ensureCheckBox();
      if (document.getElementById('quick-add-modal')?.classList.contains('open')) scheduleCheck();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ensureCheckBox();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CHECK_ID}{grid-column:1/-1;border:1px solid #d0d5dd;border-radius:10px;padding:10px 12px;font-size:10px;font-weight:700;line-height:1.65;background:#f8fafc;color:#475467}
      #${CHECK_ID}.ok{background:#ecfdf3;border-color:#abefc6;color:#067647}
      #${CHECK_ID}.warn{background:#fffaeb;border-color:#fedf89;color:#b54708}
      #${CHECK_ID}.block{background:#fef3f2;border-color:#fecdca;color:#b42318}
      #${CHECK_ID} strong{display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px}
      #${CHECK_ID} ul{margin:4px 0 0 17px;padding:0}
      #${CHECK_ID} li{margin:1px 0}
      #quick-add-confirm:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.2)}
      .quick-add-foot .quick-add-guard-hint{margin-right:auto;align-self:center;font-size:9px;font-weight:800;color:#98a2b3}
    `;
    document.head.appendChild(style);
  }

  function ensureCheckBox() {
    const body = document.querySelector('#quick-add-modal .quick-add-body');
    const summary = document.getElementById('quick-add-summary');
    if (!body || !summary || document.getElementById(CHECK_ID)) return;
    const box = document.createElement('div');
    box.id = CHECK_ID;
    box.innerHTML = '<strong><i class="fa-solid fa-spinner fa-spin"></i> 配置条件を確認中</strong>';
    summary.insertAdjacentElement('afterend', box);

    const foot = document.querySelector('#quick-add-modal .quick-add-foot');
    if (foot && !foot.querySelector('.quick-add-guard-hint')) {
      const hint = document.createElement('span');
      hint.className = 'quick-add-guard-hint';
      hint.textContent = '赤は追加不可・黄は注意あり';
      foot.prepend(hint);
    }
  }

  function onClickCapture(event) {
    const staffButton = event.target.closest?.('[data-quick-add-staff]');
    if (staffButton && !staffButton.disabled) {
      currentStaffId = String(staffButton.dataset.quickAddStaff || '').toUpperCase();
      setTimeout(() => {
        ensureCheckBox();
        runCheck();
      }, 0);
      return;
    }

    if (event.target.closest?.('[data-quick-add-close]') || event.target.id === 'quick-add-modal') {
      currentStaffId = '';
      latestCheck = { hard: [], warnings: [] };
      return;
    }

    const confirm = event.target.closest?.('#quick-add-confirm');
    if (!confirm) return;

    runCheck();
    if (latestCheck.hard.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast('赤い条件があるため追加できません。日付・店舗・勤務時間を見直してください。');
      return;
    }

    if (latestCheck.warnings.length) {
      const proceed = window.confirm(`注意が ${latestCheck.warnings.length}件あります。\n\n${latestCheck.warnings.map(item => `・${item}`).join('\n')}\n\nこのまま追加しますか？`);
      if (!proceed) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }

  function onChangeCapture(event) {
    if (!['quick-add-store', 'quick-add-start', 'quick-add-end'].includes(event.target?.id)) return;
    scheduleCheck();
  }

  function scheduleCheck() {
    setTimeout(runCheck, 20);
  }

  function runCheck() {
    ensureCheckBox();
    const box = document.getElementById(CHECK_ID);
    const confirm = document.getElementById('quick-add-confirm');
    if (!box || !confirm) return;

    const date = document.getElementById('work-date')?.value || '';
    const storeId = document.getElementById('quick-add-store')?.value || '';
    const start = Number(document.getElementById('quick-add-start')?.value || 0);
    const end = Number(document.getElementById('quick-add-end')?.value || 0);
    const staffId = currentStaffId || inferStaffId();
    latestCheck = evaluate({ staffId, date, storeId, start, end });

    confirm.disabled = latestCheck.hard.length > 0;
    if (latestCheck.hard.length) {
      box.className = 'block';
      box.innerHTML = `<strong><i class="fa-solid fa-circle-xmark"></i> 追加できません</strong>${listHtml(latestCheck.hard)}`;
    } else if (latestCheck.warnings.length) {
      box.className = 'warn';
      box.innerHTML = `<strong><i class="fa-solid fa-triangle-exclamation"></i> 注意あり（追加は可能）</strong>${listHtml(latestCheck.warnings)}`;
    } else {
      box.className = 'ok';
      box.innerHTML = '<strong><i class="fa-solid fa-circle-check"></i> この条件で追加できます</strong><div>公休・有休・勤務条件・同日重複・勤務時間の基本チェックで問題は見つかっていません。</div>';
    }
  }

  function evaluate({ staffId, date, storeId, start, end }) {
    const hard = [];
    const warnings = [];
    if (!staffId || !date) return { hard: ['対象スタッフまたは日付を確認できません。'], warnings };

    const staff = loadArray(STAFF_KEY);
    const person = staff.find(item => String(item.id || '').toUpperCase() === staffId);
    if (!person) return { hard: ['従業員マスタに該当スタッフが見つかりません。'], warnings };
    if (person.active === false) hard.push('退職・非在籍スタッフです。');
    if (person.shiftTarget === false || person.shiftEnabled === false || person.shiftEligible === false) hard.push('シフト対象外に設定されています。');

    const shifts = loadObject(SHIFTS_KEY);
    const dayRows = Array.isArray(shifts[date]) ? shifts[date] : [];
    if (dayRows.some(shift => String(shift.staffId || '').toUpperCase() === staffId)) hard.push('この日はすでにシフトが入っています。');

    const holiday = loadObject(HOLIDAY_KEY);
    const closures = Array.isArray(holiday.companyClosures) ? holiday.companyClosures : [];
    if (closures.some(item => (typeof item === 'string' ? item : item?.date) === date)) hard.push('会社休業日です。');
    const staffDays = Array.isArray(holiday.staffDays) ? holiday.staffDays : [];
    const dayOff = staffDays.find(item => String(item.staffId || '').toUpperCase() === staffId && item.date === date);
    if (dayOff?.type === 'off') hard.push('公休として登録されています。');
    if (dayOff?.type === 'paid_leave') hard.push('有休として登録されています。');

    const c = person.workConstraints || {};
    const weekday = String(new Date(`${date}T00:00:00`).getDay());
    if (Array.isArray(c.fixedOffDays) && c.fixedOffDays.includes(weekday)) hard.push('固定休の曜日です。');
    if (Array.isArray(c.availableDays) && c.availableDays.length && !c.availableDays.includes(weekday)) hard.push('勤務可能曜日に含まれていません。');
    const availableStart = numberOrNull(c.availableStart);
    const availableEnd = numberOrNull(c.availableEnd);
    if (availableStart !== null && start < availableStart) hard.push(`勤務可能開始 ${fmtTime(availableStart)} より前です。`);
    if (availableEnd !== null && end > availableEnd) hard.push(`勤務可能終了 ${fmtTime(availableEnd)} より後です。`);

    if (Array.isArray(person.placementStoreIds) && person.placementStoreIds.length && storeId && !person.placementStoreIds.includes(storeId)) {
      hard.push('この店舗は配置可能店舗に設定されていません。');
    }

    const requestedOff = Array.isArray(c.requestedOffDates) && c.requestedOffDates.includes(date);
    if (requestedOff) warnings.push('希望休として登録されています。');

    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const candidate = { staffId, start, end };
      const candidateWork = plannedWorkMinutes(candidate);
      if (candidateWork > DAILY_LIMIT) warnings.push(`予定実働が1日8時間を超えます（${formatMinutes(candidateWork)}）。`);

      const range = weekRange(date);
      const weeklyMinutes = plannedMinutesForRange(shifts, staffId, range.start, range.end) + candidateWork;
      if (weeklyMinutes > WEEKLY_LIMIT) warnings.push(`週予定実働が40時間を超えます（${formatMinutes(weeklyMinutes)}）。`);

      const maxDays = Number(c.maxDaysPerWeek || 0);
      if (maxDays > 0) {
        const days = workDaysForRange(shifts, staffId, range.start, range.end);
        days.add(date);
        if (days.size > maxDays) warnings.push(`週の勤務日数が設定上限 ${maxDays}日を超えます（${days.size}日）。`);
      }

      const maxConsecutive = Number(c.maxConsecutiveDays || DEFAULT_MAX_CONSECUTIVE);
      const consecutive = consecutiveDaysWithCandidate(shifts, staffId, date);
      if (consecutive > maxConsecutive) warnings.push(`${consecutive}連勤になります（目安上限 ${maxConsecutive}日）。`);
    }

    return { hard: unique(hard), warnings: unique(warnings) };
  }

  function inferStaffId() {
    const title = document.getElementById('quick-add-title')?.textContent || '';
    const name = title.replace(/\s*を追加\s*$/, '').trim();
    if (!name) return '';
    const staff = loadArray(STAFF_KEY);
    return String(staff.find(item => String(item.name || '').trim() === name)?.id || '').toUpperCase();
  }

  function plannedMinutesForRange(shifts, staffId, startDate, endDate) {
    let total = 0;
    Object.entries(shifts || {}).forEach(([date, rows]) => {
      if (date < startDate || date > endDate || !Array.isArray(rows)) return;
      rows.forEach(shift => {
        if (String(shift.staffId || '').toUpperCase() === staffId) total += plannedWorkMinutes(shift);
      });
    });
    return total;
  }

  function workDaysForRange(shifts, staffId, startDate, endDate) {
    const days = new Set();
    Object.entries(shifts || {}).forEach(([date, rows]) => {
      if (date < startDate || date > endDate || !Array.isArray(rows)) return;
      if (rows.some(shift => String(shift.staffId || '').toUpperCase() === staffId)) days.add(date);
    });
    return days;
  }

  function consecutiveDaysWithCandidate(shifts, staffId, date) {
    const dates = new Set([date]);
    Object.entries(shifts || {}).forEach(([shiftDate, rows]) => {
      if (!Array.isArray(rows)) return;
      if (rows.some(shift => String(shift.staffId || '').toUpperCase() === staffId)) dates.add(shiftDate);
    });
    let count = 1;
    let cursor = addDays(date, -1);
    while (dates.has(cursor)) { count += 1; cursor = addDays(cursor, -1); }
    cursor = addDays(date, 1);
    while (dates.has(cursor)) { count += 1; cursor = addDays(cursor, 1); }
    return count;
  }

  function plannedWorkMinutes(shift) {
    const binding = Math.max(0, Number(shift.end || 0) - Number(shift.start || 0));
    const breakMinutes = binding >= BREAK_60_BINDING ? 60 : binding >= BREAK_45_BINDING ? 45 : 0;
    return Math.max(0, binding - breakMinutes);
  }

  function weekRange(date) {
    const value = new Date(`${date}T00:00:00`);
    const day = value.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(value);
    start.setDate(start.getDate() + diffToMonday);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: dateKey(start), end: dateKey(end) };
  }

  function addDays(date, delta) {
    const value = new Date(`${date}T00:00:00`);
    value.setDate(value.getDate() + delta);
    return dateKey(value);
  }

  function dateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function fmtTime(minute) {
    const total = Number(minute || 0);
    const hour = Math.floor(total / 60);
    const mins = total % 60;
    return `${hour}:${String(mins).padStart(2, '0')}`;
  }

  function formatMinutes(minutes) {
    const total = Math.max(0, Math.round(Number(minutes || 0)));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return mins ? `${hours}時間${mins}分` : `${hours}時間`;
  }

  function numberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function listHtml(items) {
    return `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }

  function unique(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function loadArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function loadObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function showToast(message) {
    document.getElementById('quick-add-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'quick-add-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4300);
  }
})();
