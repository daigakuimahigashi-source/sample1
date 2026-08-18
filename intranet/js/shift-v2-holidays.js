(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const CLOUD_KEY = 'shiftV2Holidays';
  const MONTHLY_OFF_TARGET = 8;

  const DEFAULT_2026_CLOSURES = [
    '2026-01-01', '2026-01-02', '2026-01-03',
    '2026-02-12', '2026-04-14', '2026-06-18',
    '2026-08-19', '2026-10-15', '2026-12-16',
  ];

  const state = {
    data: normalizeData(loadJson(HOLIDAY_KEY, null)),
    month: currentMonth(),
    selectedStaffId: '',
    cloudBusy: false,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    ensureDefaultsForYear(2026);
    injectStyles();
    injectTabAndView();
    injectPlannerBanner();
    bindEvents();
    renderAll();
    exposeApi();
    document.addEventListener('shiftv2-auth', () => setTimeout(hydrateCloud, 250));
    setTimeout(hydrateCloud, 1100);
  }

  function normalizeData(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      companyClosures: Array.isArray(source.companyClosures) ? source.companyClosures.map(item => typeof item === 'string' ? { date: item, label: '会社休業日' } : item).filter(item => item?.date) : [],
      staffDays: Array.isArray(source.staffDays) ? source.staffDays.filter(item => item?.staffId && item?.date && ['off', 'paid_leave'].includes(item.type)) : [],
      updatedAt: source.updatedAt || '',
      updatedBy: source.updatedBy || '',
    };
  }

  function ensureDefaultsForYear(year) {
    const existing = new Set(state.data.companyClosures.map(item => item.date));
    const defaults = year === 2026 ? DEFAULT_2026_CLOSURES : generatedClosures(year);
    defaults.forEach(date => {
      if (!existing.has(date)) state.data.companyClosures.push({ date, label: date.endsWith('-01-01') || date.endsWith('-01-02') || date.endsWith('-01-03') ? '年始休業' : '会社休業日' });
    });
    persist(false);
  }

  function generatedClosures(year) {
    const dates = [`${year}-01-01`, `${year}-01-02`, `${year}-01-03`];
    [2, 4, 6, 8, 10, 12].forEach(month => {
      const day = 10 + ((year * 7 + month * 11) % 11);
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    });
    return dates;
  }

  function injectTabAndView() {
    if (document.getElementById('view-holidays')) return;
    const tabs = document.querySelector('.tabs');
    const csvTab = tabs?.querySelector('[data-view="csv"]');
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.dataset.view = 'holidays';
    tab.innerHTML = '<i class="fa-solid fa-calendar-days"></i> 休日・有休';
    if (csvTab) tabs.insertBefore(tab, csvTab); else tabs?.appendChild(tab);

    const view = document.createElement('section');
    view.id = 'view-holidays';
    view.className = 'view';
    view.innerHTML = `
      <div class="holiday-hero card">
        <div><h2>休日・有給休暇</h2><p>会社休業日、正社員の月8公休、有給休暇を別々に管理します。有休は月8公休には含めません。</p></div>
        <div class="holiday-controls"><input id="holiday-month" class="control" type="month"><button id="holiday-add-closure" class="btn btn-light"><i class="fa-solid fa-building-circle-xmark"></i> 会社休業日を追加</button></div>
      </div>
      <div id="holiday-company-summary" class="holiday-summary"></div>
      <div class="holiday-grid">
        <div class="card holiday-panel"><div class="holiday-panel-head"><strong>会社休業日</strong><span>年始3日＋偶数月6日＝年9日</span></div><div id="holiday-closure-list"></div></div>
        <div class="card holiday-panel"><div class="holiday-panel-head"><strong>従業員別 月間休日</strong><span>公休8日と有休を分けて表示</span></div><div id="holiday-staff-list"></div></div>
      </div>
    `;
    document.querySelector('.workspace')?.appendChild(view);

    tab.addEventListener('click', event => {
      event.preventDefault();
      document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
      document.querySelectorAll('.view').forEach(item => item.classList.toggle('active', item === view));
      renderAll();
    });
  }

  function injectPlannerBanner() {
    const planner = document.getElementById('view-planner');
    if (!planner || document.getElementById('holiday-planner-banner')) return;
    const banner = document.createElement('section');
    banner.id = 'holiday-planner-banner';
    banner.className = 'card holiday-planner-banner';
    const toolbar = planner.querySelector('.toolbar');
    toolbar?.insertAdjacentElement('afterend', banner);
  }

  function bindEvents() {
    document.getElementById('holiday-month')?.addEventListener('change', event => { state.month = event.target.value || currentMonth(); renderAll(); });
    document.getElementById('holiday-add-closure')?.addEventListener('click', addClosure);
    document.getElementById('work-date')?.addEventListener('change', renderPlannerBanner);
    window.addEventListener('storage', event => {
      if ([HOLIDAY_KEY, STAFF_KEY, SHIFTS_KEY].includes(event.key)) {
        state.data = normalizeData(loadJson(HOLIDAY_KEY, state.data));
        renderAll();
      }
    });

    document.addEventListener('dragover', event => {
      const track = event.target.closest?.('#empty-drop-track');
      if (!track) return;
      const date = document.getElementById('work-date')?.value;
      if (isCompanyClosure(date)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'none';
      }
    }, true);

    document.addEventListener('drop', event => {
      const track = event.target.closest?.('#empty-drop-track');
      if (!track) return;
      const date = document.getElementById('work-date')?.value;
      const staffId = event.dataTransfer?.getData('text/staff-id');
      const reason = unavailableReason(staffId, date);
      if (!reason) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.alert(reason);
    }, true);
  }

  function renderAll() {
    if (!state.month) state.month = currentMonth();
    const monthInput = document.getElementById('holiday-month');
    if (monthInput) monthInput.value = state.month;
    renderPlannerBanner();
    renderSummary();
    renderClosures();
    renderStaff();
  }

  function renderPlannerBanner() {
    const banner = document.getElementById('holiday-planner-banner');
    if (!banner) return;
    const date = document.getElementById('work-date')?.value || '';
    if (!date) { banner.style.display = 'none'; return; }
    const closure = state.data.companyClosures.find(item => item.date === date);
    if (!closure) { banner.style.display = 'none'; return; }
    banner.style.display = 'block';
    banner.innerHTML = `<strong><i class="fa-solid fa-store-slash"></i> ${esc(closure.label || '会社休業日')}</strong><span>${formatDateJa(date)} は会社休業日です。通常の自動配置対象から外します。</span>`;
  }

  function renderSummary() {
    const node = document.getElementById('holiday-company-summary');
    if (!node) return;
    const year = Number(state.month.slice(0, 4));
    ensureDefaultsForYear(year);
    const annualClosures = state.data.companyClosures.filter(item => item.date.startsWith(`${year}-`)).length;
    const monthClosures = state.data.companyClosures.filter(item => item.date.startsWith(state.month)).length;
    const staff = fullTimeStaff();
    const paidCount = state.data.staffDays.filter(item => item.type === 'paid_leave' && item.date.startsWith(state.month)).length;
    node.innerHTML = metric('会社休業', `${annualClosures}日/年`, `今月 ${monthClosures}日`) + metric('個人公休', `${MONTHLY_OFF_TARGET}日/月`, '有休とは別枠') + metric('正社員', `${staff.length}名`, '月8休の対象') + metric('今月の有休', `${paidCount}件`, '勤務予定日の休暇');
  }

  function renderClosures() {
    const node = document.getElementById('holiday-closure-list');
    if (!node) return;
    const year = state.month.slice(0, 4);
    const rows = state.data.companyClosures.filter(item => item.date.startsWith(`${year}-`)).sort((a, b) => a.date.localeCompare(b.date));
    node.innerHTML = `<div class="holiday-closure-table">${rows.map(item => `<div class="holiday-closure-row"><input class="control" type="date" data-closure-date="${esc(item.date)}" value="${esc(item.date)}"><input class="control" data-closure-label="${esc(item.date)}" value="${esc(item.label || '会社休業日')}"><button class="btn btn-light btn-small" data-delete-closure="${esc(item.date)}"><i class="fa-solid fa-trash"></i></button></div>`).join('')}</div>`;
    node.querySelectorAll('[data-closure-date]').forEach(input => input.addEventListener('change', () => updateClosureDate(input.dataset.closureDate, input.value)));
    node.querySelectorAll('[data-closure-label]').forEach(input => input.addEventListener('change', () => updateClosureLabel(input.dataset.closureLabel, input.value)));
    node.querySelectorAll('[data-delete-closure]').forEach(button => button.addEventListener('click', () => deleteClosure(button.dataset.deleteClosure)));
  }

  function renderStaff() {
    const node = document.getElementById('holiday-staff-list');
    if (!node) return;
    const people = fullTimeStaff();
    node.innerHTML = people.map(person => {
      const off = recordsFor(person.id, state.month, 'off');
      const paid = recordsFor(person.id, state.month, 'paid_leave');
      return `<div class="holiday-staff-row"><div><strong>${esc(person.name || person.id)}</strong><small>${esc(person.id)} ${person.workPlanId ? '・' + esc(person.workPlanId) + 'プラン' : ''}</small></div><div class="holiday-count ${off.length === MONTHLY_OFF_TARGET ? 'ok' : off.length > MONTHLY_OFF_TARGET ? 'warn' : 'short'}">公休 ${off.length}/${MONTHLY_OFF_TARGET}</div><div class="holiday-count paid">有休 ${paid.length}</div><button class="btn btn-light btn-small" data-edit-staff-holiday="${esc(person.id)}">日付設定</button></div>`;
    }).join('') || '<div class="holiday-empty">正社員データがありません。</div>';
    node.querySelectorAll('[data-edit-staff-holiday]').forEach(button => button.addEventListener('click', () => openStaffEditor(button.dataset.editStaffHoliday)));
  }

  function openStaffEditor(staffId) {
    const person = fullTimeStaff().find(item => String(item.id).toUpperCase() === String(staffId).toUpperCase());
    if (!person) return;
    state.selectedStaffId = String(person.id).toUpperCase();
    let modal = document.getElementById('holiday-staff-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'holiday-staff-modal';
      modal.className = 'holiday-modal-bg';
      modal.innerHTML = '<div class="holiday-modal"><div id="holiday-staff-modal-content"></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', event => { if (event.target === modal) modal.classList.remove('open'); });
    }
    const days = daysInMonth(state.month);
    const content = document.getElementById('holiday-staff-modal-content');
    content.innerHTML = `
      <div class="holiday-modal-head"><div><h2>${esc(person.name || person.id)} 休日設定</h2><p>${esc(state.month)} ・ 公休は月8日、有休は別枠</p></div><button id="holiday-modal-close" class="btn btn-light btn-small"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="holiday-modal-legend"><span class="off">公休</span><span class="paid">有休</span><span class="closure">会社休業</span><small>クリック：なし → 公休 → 有休 → なし</small></div>
      <div class="holiday-calendar">${days.map(date => dayCell(person.id, date)).join('')}</div>
      <div class="holiday-modal-foot"><div id="holiday-modal-counts"></div><button id="holiday-auto-eight" class="btn btn-light">空いている日へ公休8日を仮配置</button><button id="holiday-modal-save" class="btn btn-green">保存</button></div>`;
    modal.classList.add('open');
    updateModalCounts();
    content.querySelector('#holiday-modal-close')?.addEventListener('click', () => modal.classList.remove('open'));
    content.querySelectorAll('[data-holiday-day]').forEach(button => button.addEventListener('click', () => cycleDay(button.dataset.holidayDay)));
    content.querySelector('#holiday-auto-eight')?.addEventListener('click', autoFillEight);
    content.querySelector('#holiday-modal-save')?.addEventListener('click', () => { persist(true); modal.classList.remove('open'); renderAll(); });
  }

  function dayCell(staffId, date) {
    const type = recordType(staffId, date);
    const closure = isCompanyClosure(date);
    const day = Number(date.slice(-2));
    const weekday = ['日','月','火','水','木','金','土'][new Date(`${date}T00:00:00`).getDay()];
    return `<button type="button" class="holiday-day ${type || ''} ${closure ? 'closure' : ''}" data-holiday-day="${date}" ${closure ? 'disabled' : ''}><small>${weekday}</small><strong>${day}</strong><span>${closure ? '会社休業' : type === 'off' ? '公休' : type === 'paid_leave' ? '有休' : ''}</span></button>`;
  }

  function cycleDay(date) {
    const current = recordType(state.selectedStaffId, date);
    const next = current === '' ? 'off' : current === 'off' ? 'paid_leave' : '';
    state.data.staffDays = state.data.staffDays.filter(item => !(sameStaff(item.staffId, state.selectedStaffId) && item.date === date));
    if (next) state.data.staffDays.push({ id: uid('day'), staffId: state.selectedStaffId, date, type: next, createdAt: new Date().toISOString(), createdBy: actorName() });
    openStaffEditor(state.selectedStaffId);
  }

  function autoFillEight() {
    const currentOff = recordsFor(state.selectedStaffId, state.month, 'off');
    if (currentOff.length >= MONTHLY_OFF_TARGET) return;
    const shifts = loadJson(SHIFTS_KEY, {});
    const candidates = daysInMonth(state.month).filter(date => !isCompanyClosure(date) && !recordType(state.selectedStaffId, date) && !hasShift(shifts, state.selectedStaffId, date));
    const need = MONTHLY_OFF_TARGET - currentOff.length;
    spreadDates(candidates, need).forEach(date => state.data.staffDays.push({ id: uid('day'), staffId: state.selectedStaffId, date, type: 'off', testGenerated: true, createdAt: new Date().toISOString(), createdBy: actorName() }));
    openStaffEditor(state.selectedStaffId);
  }

  function spreadDates(candidates, count) {
    if (!candidates.length || count <= 0) return [];
    const selected = [];
    for (let i = 0; i < count && candidates.length; i += 1) {
      const index = Math.min(candidates.length - 1, Math.floor(((i + 0.5) / count) * candidates.length));
      selected.push(candidates.splice(index, 1)[0]);
    }
    return selected;
  }

  function updateModalCounts() {
    const node = document.getElementById('holiday-modal-counts');
    if (!node) return;
    const off = recordsFor(state.selectedStaffId, state.month, 'off').length;
    const paid = recordsFor(state.selectedStaffId, state.month, 'paid_leave').length;
    node.innerHTML = `<strong>公休 ${off}/${MONTHLY_OFF_TARGET}</strong><span>有休 ${paid}</span>`;
  }

  function addClosure() {
    const suggested = `${state.month}-15`;
    const date = window.prompt('会社休業日の日付（YYYY-MM-DD）', suggested);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    if (state.data.companyClosures.some(item => item.date === date)) return;
    state.data.companyClosures.push({ date, label: '会社休業日' });
    persist(true); renderAll();
  }

  function updateClosureDate(oldDate, newDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return;
    const item = state.data.companyClosures.find(row => row.date === oldDate);
    if (!item) return;
    item.date = newDate; persist(true); renderAll();
  }

  function updateClosureLabel(date, label) {
    const item = state.data.companyClosures.find(row => row.date === date);
    if (!item) return;
    item.label = label.trim() || '会社休業日'; persist(true);
  }

  function deleteClosure(date) {
    if (!window.confirm(`${date} の会社休業日を削除しますか？`)) return;
    state.data.companyClosures = state.data.companyClosures.filter(item => item.date !== date);
    persist(true); renderAll();
  }

  function persist(cloud) {
    state.data.updatedAt = new Date().toISOString();
    state.data.updatedBy = actorName();
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(state.data));
    if (cloud && window.shiftV2Cloud && window.shiftV2User) window.shiftV2Cloud.set(CLOUD_KEY, state.data).catch(error => console.warn('Holiday cloud save failed', error));
  }

  async function hydrateCloud() {
    if (!window.shiftV2Cloud || !window.shiftV2User || state.cloudBusy) return;
    state.cloudBusy = true;
    try {
      const cloud = await window.shiftV2Cloud.get(CLOUD_KEY);
      if (cloud && typeof cloud === 'object') {
        state.data = normalizeData(cloud);
        ensureDefaultsForYear(2026);
        localStorage.setItem(HOLIDAY_KEY, JSON.stringify(state.data));
      } else await window.shiftV2Cloud.set(CLOUD_KEY, state.data);
      renderAll();
    } catch (error) { console.warn('Holiday cloud hydrate failed', error); }
    finally { state.cloudBusy = false; }
  }

  function unavailableReason(staffId, date) {
    if (!date) return '';
    const closure = state.data.companyClosures.find(item => item.date === date);
    if (closure) return `${formatDateJa(date)} は${closure.label || '会社休業日'}です。`;
    if (!staffId) return '';
    const type = recordType(staffId, date);
    if (type === 'off') return `${formatDateJa(date)} は公休設定です。`;
    if (type === 'paid_leave') return `${formatDateJa(date)} は有給休暇設定です。`;
    return '';
  }

  function recordsFor(staffId, month, type) {
    return state.data.staffDays.filter(item => sameStaff(item.staffId, staffId) && item.date.startsWith(month) && (!type || item.type === type));
  }

  function recordType(staffId, date) {
    return state.data.staffDays.find(item => sameStaff(item.staffId, staffId) && item.date === date)?.type || '';
  }

  function sameStaff(a, b) { return String(a || '').toUpperCase() === String(b || '').toUpperCase(); }
  function isCompanyClosure(date) { return Boolean(date && state.data.companyClosures.some(item => item.date === date)); }
  function isUnavailable(staffId, date) { return Boolean(unavailableReason(staffId, date)); }

  function fullTimeStaff() {
    const staff = loadJson(STAFF_KEY, []);
    return (Array.isArray(staff) ? staff : []).filter(person => person.active !== false && person.employmentType === '正社員');
  }

  function hasShift(shifts, staffId, date) {
    return (Array.isArray(shifts?.[date]) ? shifts[date] : []).some(shift => sameStaff(shift.staffId, staffId));
  }

  function daysInMonth(month) {
    const [year, monthNo] = month.split('-').map(Number);
    const last = new Date(year, monthNo, 0).getDate();
    return Array.from({ length: last }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
  }

  function currentMonth() {
    const date = document.getElementById('work-date')?.value;
    if (date) return date.slice(0, 7);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function metric(label, value, sub) { return `<div class="card holiday-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`; }
  function formatDateJa(date) { const d = new Date(`${date}T00:00:00`); return `${d.getMonth()+1}/${d.getDate()}(${['日','月','火','水','木','金','土'][d.getDay()]})`; }
  function actorName() { const user = window.shiftV2User; return user?.displayName || user?.email || 'ローカル利用者'; }
  function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`; }
  function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[char])); }

  function exposeApi() {
    window.shiftV2Holiday = {
      isCompanyClosure,
      isUnavailable,
      unavailableReason,
      getDayType: (staffId, date) => isCompanyClosure(date) ? 'company_closure' : recordType(staffId, date),
      getMonthlyCounts: (staffId, month) => ({ off: recordsFor(staffId, month, 'off').length, paidLeave: recordsFor(staffId, month, 'paid_leave').length, targetOff: MONTHLY_OFF_TARGET }),
      getCompanyClosures: () => state.data.companyClosures.map(item => ({ ...item })),
    };
  }

  function injectStyles() {
    if (document.getElementById('holiday-style')) return;
    const style = document.createElement('style');
    style.id = 'holiday-style';
    style.textContent = `
      .holiday-planner-banner{display:none;margin:8px 0;padding:9px 11px;background:#fff6ed;border:1px solid #ffead5;border-left:4px solid #f79009}.holiday-planner-banner strong{font-size:10px;color:#b54708}.holiday-planner-banner span{font-size:8px;color:#93370d;margin-left:8px}.holiday-hero{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 14px;margin-bottom:10px}.holiday-hero h2{font-size:14px;margin:0}.holiday-hero p{font-size:8px;color:#667085;margin:3px 0 0}.holiday-controls{display:flex;gap:6px}.holiday-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.holiday-metric{padding:10px}.holiday-metric small,.holiday-metric span{display:block;font-size:8px;color:#667085}.holiday-metric strong{display:block;font-size:17px;margin:2px 0}.holiday-grid{display:grid;grid-template-columns:.85fr 1.6fr;gap:10px}.holiday-panel{overflow:hidden}.holiday-panel-head{display:flex;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eaecf0}.holiday-panel-head strong{font-size:10px}.holiday-panel-head span{font-size:7px;color:#667085}.holiday-closure-table{padding:7px}.holiday-closure-row{display:grid;grid-template-columns:135px 1fr 34px;gap:5px;margin-bottom:5px}.holiday-staff-row{display:grid;grid-template-columns:1.5fr 90px 75px 80px;gap:7px;align-items:center;padding:7px 10px;border-bottom:1px solid #f2f4f7}.holiday-staff-row strong{display:block;font-size:9px}.holiday-staff-row small{display:block;font-size:7px;color:#98a2b3}.holiday-count{font-size:8px;font-weight:900;padding:4px 6px;border-radius:999px;text-align:center;background:#f2f4f7}.holiday-count.ok{background:#ecfdf3;color:#067647}.holiday-count.short,.holiday-count.warn{background:#fffaeb;color:#b54708}.holiday-count.paid{background:#eef4ff;color:#3538cd}.holiday-empty{padding:24px;text-align:center;color:#98a2b3;font-size:9px}.holiday-modal-bg{display:none;position:fixed;inset:0;z-index:1850;background:rgba(16,24,40,.65);align-items:center;justify-content:center;padding:20px}.holiday-modal-bg.open{display:flex}.holiday-modal{width:min(760px,96vw);max-height:92vh;background:#fff;border-radius:14px;overflow:auto}.holiday-modal-head{display:flex;justify-content:space-between;padding:13px 15px;border-bottom:1px solid #eaecf0}.holiday-modal-head h2{font-size:14px;margin:0}.holiday-modal-head p{font-size:8px;color:#667085;margin:2px 0 0}.holiday-modal-legend{display:flex;gap:6px;align-items:center;padding:8px 15px;font-size:8px}.holiday-modal-legend span{padding:3px 6px;border-radius:999px;font-weight:900}.holiday-modal-legend .off{background:#fef0c7;color:#b54708}.holiday-modal-legend .paid{background:#e0e7ff;color:#3730a3}.holiday-modal-legend .closure{background:#fee4e2;color:#b42318}.holiday-modal-legend small{margin-left:auto;color:#667085}.holiday-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;padding:8px 15px 14px}.holiday-day{min-height:62px;border:1px solid #e4e7ec;border-radius:8px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer}.holiday-day small{font-size:7px;color:#98a2b3}.holiday-day strong{font-size:13px}.holiday-day span{font-size:7px;font-weight:900;min-height:10px}.holiday-day.off{background:#fffaeb;border-color:#fedf89;color:#b54708}.holiday-day.paid_leave{background:#eef4ff;border-color:#c7d7fe;color:#3538cd}.holiday-day.closure{background:#fef3f2;border-color:#fecdca;color:#b42318;cursor:not-allowed}.holiday-modal-foot{display:flex;align-items:center;gap:7px;padding:10px 15px;border-top:1px solid #eaecf0}.holiday-modal-foot>div{margin-right:auto;display:flex;gap:8px;font-size:8px}.holiday-modal-foot>div span{color:#667085}@media(max-width:900px){.holiday-grid{grid-template-columns:1fr}.holiday-summary{grid-template-columns:1fr 1fr}.holiday-staff-row{grid-template-columns:1fr 75px 65px}.holiday-staff-row button{grid-column:1/4}.holiday-hero{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }
})();