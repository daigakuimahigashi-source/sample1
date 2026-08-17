(() => {
  'use strict';

  const STORAGE_SHIFTS = 'okk_shift_v2_shifts';
  const STORAGE_STAFF = 'okk_shift_v2_staff';
  const DAILY_LIMIT = 8 * 60;
  const WEEKLY_LIMIT = 40 * 60;

  const refs = {};
  let observer = null;
  let refreshQueued = false;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    refs.planner = document.getElementById('view-planner');
    refs.workDate = document.getElementById('work-date');
    refs.gantt = document.getElementById('gantt-canvas');
    refs.inspector = document.getElementById('inspector');
    refs.staffMonth = document.getElementById('staff-month');
    refs.staffBody = document.getElementById('staff-view-body');
    refs.workspace = document.querySelector('.workspace');

    ensureBanner();
    bindEvents();
    startObserver();
    scheduleRefresh();
  }

  function bindEvents() {
    [refs.workDate, refs.staffMonth].forEach(node => node?.addEventListener('change', () => setTimeout(scheduleRefresh, 0)));
    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => setTimeout(scheduleRefresh, 0)));
    document.addEventListener('pointerup', () => setTimeout(scheduleRefresh, 20));
    document.addEventListener('drop', () => setTimeout(scheduleRefresh, 20));
    window.addEventListener('storage', scheduleRefresh);
  }

  function startObserver() {
    if (!refs.workspace || observer) return;
    observer = new MutationObserver(scheduleRefresh);
    observer.observe(refs.workspace, { childList: true, subtree: true });
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      observer?.disconnect();
      try {
        applyComplianceUi();
      } finally {
        if (observer && refs.workspace) observer.observe(refs.workspace, { childList: true, subtree: true });
      }
    });
  }

  function applyComplianceUi() {
    ensureBanner();
    const data = readData();
    renderBanner(data);
    decorateGantt(data);
    decorateInspector(data);
    decorateStaffView(data);
  }

  function ensureBanner() {
    if (!refs.planner) return;
    let banner = document.getElementById('labor-alert-banner');
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'labor-alert-banner';
      banner.className = 'labor-banner';
      banner.setAttribute('aria-live', 'polite');
      const toolbar = refs.planner.querySelector('.toolbar');
      toolbar?.insertAdjacentElement('afterend', banner);
    }
    refs.banner = banner;
  }

  function readData() {
    const shifts = loadJson(STORAGE_SHIFTS, {});
    const staff = loadJson(STORAGE_STAFF, []);
    const staffMap = new Map((Array.isArray(staff) ? staff : []).map(person => [String(person.id || '').toUpperCase(), person]));
    const rows = [];

    Object.entries(shifts || {}).forEach(([date, dayRows]) => {
      if (!Array.isArray(dayRows)) return;
      dayRows.forEach(shift => {
        rows.push({
          date,
          shift,
          staffId: String(shift.staffId || '').toUpperCase(),
          minutes: shiftMinutes(shift),
        });
      });
    });

    return { shifts, staffMap, rows };
  }

  function renderBanner(data) {
    if (!refs.banner || !refs.workDate?.value) return;
    const date = refs.workDate.value;
    const range = weekRange(date);
    const daily = violationList(data, date, date, DAILY_LIMIT);
    const weekly = violationList(data, range.start, range.end, WEEKLY_LIMIT);
    const hasWarning = daily.length > 0 || weekly.length > 0;

    refs.banner.className = `labor-banner ${hasWarning ? 'labor-banner-warning' : 'labor-banner-clear'}`;
    refs.banner.innerHTML = `
      <div class="labor-banner-head">
        <div><i class="fa-solid ${hasWarning ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i><strong> 労働時間チェック</strong></div>
        <div class="labor-legend"><span class="legend-daily">赤＝1日8時間超</span><span class="legend-weekly">紫＝月曜始まり週40時間超</span></div>
      </div>
      <div class="labor-banner-body">
        ${hasWarning ? warningPills(daily, weekly, data.staffMap) : '<span class="labor-clear-message">現時点で、1日8時間・週40時間を超える予定はありません。</span>'}
      </div>
      <div class="labor-banner-note">週集計：${formatDateShort(range.start)}（月）〜${formatDateShort(range.end)}（日）／ 現在は開始〜終了の予定時間を休憩控除前で一次判定</div>
    `;
  }

  function warningPills(daily, weekly, staffMap) {
    const parts = [];
    daily.forEach(item => parts.push(`<span class="labor-pill labor-pill-daily"><i class="fa-solid fa-clock"></i>${esc(staffName(item.staffId, staffMap))}：1日 ${formatMinutes(item.minutes)}</span>`));
    weekly.forEach(item => parts.push(`<span class="labor-pill labor-pill-weekly"><i class="fa-solid fa-calendar-week"></i>${esc(staffName(item.staffId, staffMap))}：週 ${formatMinutes(item.minutes)}</span>`));
    return parts.join('');
  }

  function decorateGantt(data) {
    if (!refs.gantt || !refs.workDate?.value) return;
    const date = refs.workDate.value;

    refs.gantt.querySelectorAll('.shift-bar').forEach(bar => {
      const shiftId = bar.dataset.shiftId;
      const row = data.rows.find(item => item.date === date && item.shift.id === shiftId);
      if (!row) return;
      const dailyMinutes = totalFor(data.rows, row.staffId, date, date);
      const range = weekRange(date);
      const weeklyMinutes = totalFor(data.rows, row.staffId, range.start, range.end);
      const dailyOver = dailyMinutes > DAILY_LIMIT;
      const weeklyOver = weeklyMinutes > WEEKLY_LIMIT;

      bar.classList.toggle('labor-daily-over', dailyOver);
      bar.classList.toggle('labor-weekly-over', weeklyOver);

      const ganttRow = bar.closest('.gantt-row');
      const staffCell = ganttRow?.querySelector('.staff-cell');
      ganttRow?.classList.toggle('labor-row-daily', dailyOver);
      ganttRow?.classList.toggle('labor-row-weekly', weeklyOver);
      staffCell?.classList.toggle('labor-cell-daily', dailyOver);
      staffCell?.classList.toggle('labor-cell-weekly', weeklyOver);

      bar.querySelector('.labor-alert-dot')?.remove();
      if (dailyOver || weeklyOver) {
        const dot = document.createElement('span');
        dot.className = `labor-alert-dot ${dailyOver ? 'daily' : 'weekly'}`;
        dot.textContent = dailyOver && weeklyOver ? '!' : dailyOver ? '日' : '週';
        dot.title = [
          dailyOver ? `1日 ${formatMinutes(dailyMinutes)}（8時間超）` : '',
          weeklyOver ? `週 ${formatMinutes(weeklyMinutes)}（40時間超・月曜始まり）` : '',
        ].filter(Boolean).join(' / ');
        bar.appendChild(dot);
      }
    });
  }

  function decorateInspector(data) {
    if (!refs.inspector || !refs.workDate?.value) return;
    refs.inspector.querySelector('#labor-inspector-alert')?.remove();
    const selected = document.querySelector('.shift-bar.selected');
    if (!selected) return;

    const date = refs.workDate.value;
    const row = data.rows.find(item => item.date === date && item.shift.id === selected.dataset.shiftId);
    if (!row) return;
    const range = weekRange(date);
    const dailyMinutes = totalFor(data.rows, row.staffId, date, date);
    const weeklyMinutes = totalFor(data.rows, row.staffId, range.start, range.end);
    const dailyOver = dailyMinutes > DAILY_LIMIT;
    const weeklyOver = weeklyMinutes > WEEKLY_LIMIT;
    if (!dailyOver && !weeklyOver) return;

    const alert = document.createElement('div');
    alert.id = 'labor-inspector-alert';
    alert.className = 'labor-inspector-alert';
    alert.innerHTML = `
      <strong><i class="fa-solid fa-triangle-exclamation"></i> 労働時間アラート</strong>
      ${dailyOver ? `<div>1日：${formatMinutes(dailyMinutes)}（上限目安を ${formatMinutes(dailyMinutes - DAILY_LIMIT)} 超過）</div>` : ''}
      ${weeklyOver ? `<div>週：${formatMinutes(weeklyMinutes)}（月曜始まりで ${formatMinutes(weeklyMinutes - WEEKLY_LIMIT)} 超過）</div>` : ''}
      <small>休憩時間をまだ入力していないため、現在は開始〜終了の予定時間で保守的に判定しています。</small>
    `;
    refs.inspector.prepend(alert);
  }

  function decorateStaffView(data) {
    if (!refs.staffBody || !refs.staffMonth?.value) return;
    const month = refs.staffMonth.value;
    const rows = data.rows
      .filter(row => row.date.startsWith(month))
      .sort((a, b) => staffName(a.staffId, data.staffMap).localeCompare(staffName(b.staffId, data.staffMap), 'ja') || a.date.localeCompare(b.date));
    const tableRows = Array.from(refs.staffBody.querySelectorAll('tr')).filter(row => row.cells.length >= 6);

    tableRows.forEach((tr, index) => {
      tr.classList.remove('labor-table-daily', 'labor-table-weekly');
      tr.querySelector('.labor-table-status')?.remove();
      const row = rows[index];
      if (!row) return;
      const range = weekRange(row.date);
      const dailyMinutes = totalFor(data.rows, row.staffId, row.date, row.date);
      const weeklyMinutes = totalFor(data.rows, row.staffId, range.start, range.end);
      const dailyOver = dailyMinutes > DAILY_LIMIT;
      const weeklyOver = weeklyMinutes > WEEKLY_LIMIT;
      if (!dailyOver && !weeklyOver) return;

      tr.classList.toggle('labor-table-daily', dailyOver);
      tr.classList.toggle('labor-table-weekly', weeklyOver);
      const status = document.createElement('div');
      status.className = 'labor-table-status';
      status.innerHTML = `${dailyOver ? `<span class="labor-mini daily">日 ${formatMinutes(dailyMinutes)}</span>` : ''}${weeklyOver ? `<span class="labor-mini weekly">週 ${formatMinutes(weeklyMinutes)}</span>` : ''}`;
      tr.cells[tr.cells.length - 1].appendChild(status);
    });
  }

  function violationList(data, start, end, limit) {
    const ids = new Set(data.rows.filter(row => row.date >= start && row.date <= end).map(row => row.staffId));
    return Array.from(ids)
      .map(staffId => ({ staffId, minutes: totalFor(data.rows, staffId, start, end) }))
      .filter(item => item.minutes > limit)
      .sort((a, b) => b.minutes - a.minutes);
  }

  function totalFor(rows, staffId, start, end) {
    return rows.reduce((total, row) => total + (row.staffId === staffId && row.date >= start && row.date <= end ? row.minutes : 0), 0);
  }

  function shiftMinutes(shift) {
    const start = Number(shift.start);
    const end = Number(shift.end);
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
  }

  function weekRange(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    const day = date.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + offset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: dateKey(monday), end: dateKey(sunday) };
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateShort(dateString) {
    const [, month, day] = dateString.split('-');
    return `${Number(month)}/${Number(day)}`;
  }

  function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours}時間${remainder}分` : `${hours}時間`;
  }

  function staffName(staffId, staffMap) {
    return staffMap.get(String(staffId).toUpperCase())?.name || staffId;
  }

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }
})();