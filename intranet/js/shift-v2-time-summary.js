(() => {
  'use strict';

  const STORAGE_SHIFTS = 'okk_shift_v2_shifts';
  const STORAGE_STAFF = 'okk_shift_v2_staff';
  const BREAK_45_BINDING = 6 * 60 + 45;
  const BREAK_60_BINDING = 9 * 60;

  let observer = null;
  let queued = false;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    injectStyles();
    bindEvents();
    const workspace = document.querySelector('.workspace');
    if (workspace) {
      observer = new MutationObserver(schedule);
      observer.observe(workspace, { childList: true, subtree: true });
    }
    schedule();
  }

  function bindEvents() {
    document.addEventListener('pointerup', () => setTimeout(schedule, 20));
    document.addEventListener('drop', () => setTimeout(schedule, 20));
    document.getElementById('work-date')?.addEventListener('change', schedule);
    document.getElementById('staff-month')?.addEventListener('change', schedule);
    window.addEventListener('storage', schedule);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      observer?.disconnect();
      try {
        decorateInspector();
        decorateStaffTable();
        decorateGanttLabels();
      } finally {
        const workspace = document.querySelector('.workspace');
        if (observer && workspace) observer.observe(workspace, { childList: true, subtree: true });
      }
    });
  }

  function decorateInspector() {
    const inspector = document.getElementById('inspector');
    inspector?.querySelector('#shift-time-summary')?.remove();
    if (!inspector) return;
    const selected = document.querySelector('.shift-bar.selected');
    const date = document.getElementById('work-date')?.value;
    if (!selected || !date) return;
    const shift = findShift(date, selected.dataset.shiftId);
    if (!shift) return;
    const binding = bindingMinutes(shift);
    const breakMinutes = standardBreakMinutes(binding);
    const work = Math.max(0, binding - breakMinutes);
    const node = document.createElement('div');
    node.id = 'shift-time-summary';
    node.className = 'shift-time-summary';
    node.innerHTML = `
      <div class="shift-time-summary-title"><i class="fa-solid fa-hourglass-half"></i><strong>予定時間</strong></div>
      <div class="shift-time-summary-grid">
        <div><span>拘束</span><strong>${formatMinutes(binding)}</strong></div>
        <div><span>標準休憩</span><strong>${breakMinutes ? formatMinutes(breakMinutes) : 'なし'}</strong></div>
        <div><span>予定実働</span><strong>${formatMinutes(work)}</strong></div>
      </div>
      <small>${breakRuleText(binding)}。実際の休憩実績はMF勤怠側で管理します。</small>
    `;
    const form = inspector.querySelector('.form-grid');
    if (form) form.insertAdjacentElement('afterend', node);
    else inspector.prepend(node);
  }

  function decorateStaffTable() {
    const body = document.getElementById('staff-view-body');
    const month = document.getElementById('staff-month')?.value;
    if (!body || !month) return;
    const rows = allRows().filter(row => row.date.startsWith(month)).sort((a, b) => staffName(a.staffId).localeCompare(staffName(b.staffId), 'ja') || a.date.localeCompare(b.date));
    const trs = Array.from(body.querySelectorAll('tr')).filter(tr => tr.cells.length >= 6);
    trs.forEach((tr, index) => {
      tr.querySelector('.time-summary-mini')?.remove();
      const row = rows[index];
      if (!row) return;
      const binding = bindingMinutes(row.shift);
      const breakMinutes = standardBreakMinutes(binding);
      const work = Math.max(0, binding - breakMinutes);
      const mini = document.createElement('div');
      mini.className = 'time-summary-mini';
      mini.textContent = `拘束 ${formatShort(binding)} / 休憩 ${formatShort(breakMinutes)} / 実働 ${formatShort(work)}`;
      tr.cells[4].appendChild(mini);
    });
  }

  function decorateGanttLabels() {
    const date = document.getElementById('work-date')?.value;
    if (!date) return;
    document.querySelectorAll('#gantt-canvas .shift-bar').forEach(bar => {
      bar.querySelector('.time-summary-tooltip')?.remove();
      const shift = findShift(date, bar.dataset.shiftId);
      if (!shift) return;
      const binding = bindingMinutes(shift);
      const breakMinutes = standardBreakMinutes(binding);
      const work = Math.max(0, binding - breakMinutes);
      const badge = document.createElement('span');
      badge.className = 'time-summary-tooltip';
      badge.title = `拘束 ${formatMinutes(binding)} / 標準休憩 ${breakMinutes ? formatMinutes(breakMinutes) : 'なし'} / 予定実働 ${formatMinutes(work)}`;
      badge.innerHTML = '<i class="fa-solid fa-clock"></i>';
      bar.appendChild(badge);
    });
  }

  function findShift(date, id) {
    const shifts = loadJson(STORAGE_SHIFTS, {});
    const rows = Array.isArray(shifts[date]) ? shifts[date] : [];
    return rows.find(shift => shift.id === id);
  }

  function allRows() {
    const shifts = loadJson(STORAGE_SHIFTS, {});
    const rows = [];
    Object.entries(shifts).forEach(([date, list]) => {
      if (!Array.isArray(list)) return;
      list.forEach(shift => rows.push({ date, shift, staffId: String(shift.staffId || '').toUpperCase() }));
    });
    return rows;
  }

  function staffName(id) {
    const staff = loadJson(STORAGE_STAFF, []);
    return (Array.isArray(staff) ? staff : []).find(person => String(person.id || person.employeeNumber || '').toUpperCase() === id)?.name || id;
  }

  function bindingMinutes(shift) {
    const start = Number(shift.start);
    const end = Number(shift.end);
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
  }

  function standardBreakMinutes(binding) {
    if (binding >= BREAK_60_BINDING) return 60;
    if (binding >= BREAK_45_BINDING) return 45;
    return 0;
  }

  function breakRuleText(binding) {
    if (binding >= BREAK_60_BINDING) return '拘束9時間以上のため標準休憩60分';
    if (binding >= BREAK_45_BINDING) return '拘束6時間45分以上のため標準休憩45分';
    return '標準休憩の自動控除なし';
  }

  function formatMinutes(minutes) {
    const value = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    return rest ? `${hours}時間${rest}分` : `${hours}時間`;
  }

  function formatShort(minutes) {
    const value = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    return `${hours}:${String(rest).padStart(2, '0')}`;
  }

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function injectStyles() {
    if (document.getElementById('shift-time-summary-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-time-summary-style';
    style.textContent = `
      .shift-time-summary{margin-top:10px;padding:10px;border:1px solid #d0d5dd;border-radius:9px;background:#f8fafc}.shift-time-summary-title{display:flex;align-items:center;gap:5px;font-size:10px;color:#344054;margin-bottom:7px}.shift-time-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.shift-time-summary-grid>div{background:#fff;border:1px solid #eaecf0;border-radius:7px;padding:7px}.shift-time-summary-grid span{display:block;font-size:7px;color:#98a2b3}.shift-time-summary-grid strong{display:block;font-size:12px;margin-top:1px}.shift-time-summary-grid>div:last-child{background:#ecfdf3;border-color:#abefc6;color:#05603a}.shift-time-summary small{display:block;font-size:7px;line-height:1.5;color:#667085;margin-top:6px}.time-summary-mini{font-size:7px;color:#667085;margin-top:2px;white-space:nowrap}.time-summary-tooltip{position:absolute;bottom:2px;right:3px;width:15px;height:15px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.92);color:#475467;font-size:7px;z-index:7;cursor:help}
    `;
    document.head.appendChild(style);
  }
})();