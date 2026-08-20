(() => {
  'use strict';

  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const STYLE_ID = 'shift-v2-requested-off-month-ui-style';
  const PANEL_ID = 'requested-off-month-panel';
  const METRIC_ID = 'requested-off-month-metric';
  let queued = false;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    bindEvents();
    const modal = document.getElementById('month-builder-modal');
    if (modal) new MutationObserver(scheduleRender).observe(modal, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    scheduleRender();
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      if (event.target.closest('#month-builder-open') || event.target.closest('#month-builder-calc')) setTimeout(scheduleRender, 40);
    });
    document.addEventListener('change', event => {
      if (['month-builder-month', 'month-builder-auto-off', 'month-builder-soft'].includes(event.target?.id)) setTimeout(scheduleRender, 40);
    });
    document.addEventListener('shiftv2-requested-off-changed', scheduleRender);
  }

  function scheduleRender() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }

  function render() {
    const modal = document.getElementById('month-builder-modal');
    if (!modal) return;
    const month = document.getElementById('month-builder-month')?.value || document.getElementById('work-date')?.value?.slice(0, 7) || currentMonth();
    const summary = document.getElementById('month-builder-summary');
    const body = document.getElementById('month-builder-body');
    if (!summary || !body || !month) return;

    const staff = loadArray(STAFF_KEY);
    const staffMap = new Map(staff.map(person => [String(person.id || person.employeeNumber || '').toUpperCase(), person]));
    const holiday = loadObject(HOLIDAY_KEY);
    const records = (Array.isArray(holiday.staffDays) ? holiday.staffDays : [])
      .filter(item => item?.date?.startsWith(month) && item.requestedOff === true)
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.staffId).localeCompare(String(b.staffId)));

    const employeeRecords = records.filter(item => isFullTime(staffMap.get(String(item.staffId || '').toUpperCase())));
    const partTimeRecords = records.filter(item => !isFullTime(staffMap.get(String(item.staffId || '').toUpperCase())));
    upsertMetric(summary, records.length, employeeRecords.length, partTimeRecords.length);
    upsertPanel(body, records, staffMap, month);
  }

  function upsertMetric(summary, total, employees, partTimers) {
    let metric = document.getElementById(METRIC_ID);
    if (!metric) {
      metric = document.createElement('div');
      metric.id = METRIC_ID;
      metric.className = 'month-metric requested-off-month-metric';
      summary.appendChild(metric);
    }
    metric.innerHTML = `<small>希望休反映</small><strong>${total}件</strong><span>社員 ${employees} / バイト ${partTimers}</span>`;
  }

  function upsertPanel(body, records, staffMap, month) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'month-builder-section requested-off-month-panel';
      body.prepend(panel);
    }

    if (!records.length) {
      panel.innerHTML = `<h3><i class="fa-regular fa-calendar-xmark"></i> 希望休の反映</h3><div class="requested-off-empty">${esc(month)} は希望休登録がありません。月間AUTOは通常条件で作成します。</div>`;
      return;
    }

    const grouped = new Map();
    records.forEach(record => {
      const id = String(record.staffId || '').toUpperCase();
      if (!grouped.has(id)) grouped.set(id, []);
      grouped.get(id).push(record.date);
    });

    const rows = Array.from(grouped.entries()).map(([id, dates]) => {
      const person = staffMap.get(id);
      const fullTime = isFullTime(person);
      const mode = fullTime ? '正社員：公休8日の候補として優先' : 'アルバイト：その日はAUTO配置から除外';
      return `<div class="requested-off-month-row">
        <div class="requested-off-person"><strong>${esc(person?.name || id)}</strong><small>${esc(person?.employmentType || '')} ${esc(id)}</small></div>
        <div class="requested-off-dates">${dates.map(date => `<span>${Number(date.slice(-2))}日</span>`).join('')}</div>
        <div class="requested-off-mode ${fullTime ? 'employee' : 'parttime'}">${esc(mode)}</div>
      </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="requested-off-month-head">
        <div><h3><i class="fa-regular fa-calendar-xmark"></i> 希望休の反映</h3><p>希望休を先に固定してから、正社員 → 不足分をアルバイトの順で月間AUTOを組みます。</p></div>
        <span class="requested-off-count">${records.length}件</span>
      </div>
      <div class="requested-off-month-list">${rows}</div>
      <div class="requested-off-month-note"><i class="fa-solid fa-circle-info"></i> 正社員の希望休は公休8日の内数として扱い、不足する公休だけを自動補完します。アルバイトの希望休はその日の候補から外します。</div>`;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .requested-off-month-metric{border-color:#fed7aa;background:#fff7ed}
      .requested-off-month-metric strong{color:#c2410c}
      .requested-off-month-panel{border:1px solid #fed7aa;border-radius:10px;background:#fffbf5;padding:10px;margin-top:10px}
      .requested-off-month-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
      .requested-off-month-head h3{margin:0!important;color:#9a3412!important;font-size:10px!important}
      .requested-off-month-head p{margin:3px 0 0;color:#9a3412;font-size:8px;font-weight:700;line-height:1.6}
      .requested-off-count{background:#f97316;color:#fff;border-radius:999px;padding:3px 7px;font-size:8px;font-weight:900;white-space:nowrap}
      .requested-off-month-list{display:flex;flex-direction:column;gap:5px}
      .requested-off-month-row{display:grid;grid-template-columns:minmax(130px,1fr) minmax(160px,1.5fr) minmax(190px,1.2fr);gap:8px;align-items:center;background:#fff;border:1px solid #ffedd5;border-radius:8px;padding:7px 8px}
      .requested-off-person strong{display:block;color:#101828;font-size:9px}.requested-off-person small{display:block;color:#98a2b3;font-size:7px;margin-top:1px}
      .requested-off-dates{display:flex;gap:4px;flex-wrap:wrap}.requested-off-dates span{border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;padding:2px 6px;font-size:8px;font-weight:900}
      .requested-off-mode{font-size:8px;font-weight:900;border-radius:7px;padding:5px 7px}.requested-off-mode.employee{background:#ecfdf3;color:#067647}.requested-off-mode.parttime{background:#eff8ff;color:#175cd3}
      .requested-off-month-note,.requested-off-empty{margin-top:7px;border-radius:7px;padding:7px 8px;background:#fff;color:#9a3412;font-size:8px;font-weight:700;line-height:1.6;border:1px dashed #fdba74}
      @media(max-width:760px){.requested-off-month-row{grid-template-columns:1fr}.requested-off-mode{justify-self:start}}
    `;
    document.head.appendChild(style);
  }

  function isFullTime(person) {
    return person?.employmentType === '正社員' || person?.employmentType === '契約社員';
  }

  function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
})();
