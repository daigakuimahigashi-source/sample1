(() => {
  'use strict';

  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  const state = { mode:'store-day', storeId:'matsuyama', date:'', month:'', staffId:'' };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 120), { once:true });
  else setTimeout(init, 120);

  function init() {
    const workDate = document.getElementById('work-date')?.value || dateKey(new Date());
    state.date = workDate;
    state.month = workDate.slice(0,7);
    injectTabAndView();
    injectStyles();
    bindEvents();
    renderControls();
    render();
    window.shiftV2BrowseViews = { render, open:(mode) => openView(mode || state.mode) };
  }

  function injectTabAndView() {
    const tabs = document.querySelector('.tabs');
    const workspace = document.querySelector('.workspace');
    if (!tabs || !workspace) return;

    if (!document.getElementById('browse-tab')) {
      const button = document.createElement('button');
      button.id = 'browse-tab';
      button.className = 'tab';
      button.dataset.view = 'browse';
      button.innerHTML = '<i class="fa-solid fa-calendar-days"></i> シフトを見る';
      const csv = tabs.querySelector('[data-view="csv"]');
      if (csv) tabs.insertBefore(button, csv); else tabs.appendChild(button);
    }

    if (!document.getElementById('view-browse')) {
      const section = document.createElement('section');
      section.id = 'view-browse';
      section.className = 'view';
      section.innerHTML = `
        <div class="card browse-hero">
          <div><h2>シフトを見る</h2><p>店舗の日別・店舗の月間・スタッフの月間を、同じ画面から切り替えて確認できます。</p></div>
          <div class="browse-mode-switch" id="browse-mode-switch">
            <button type="button" data-mode="store-day">店舗・日別</button>
            <button type="button" data-mode="store-month">店舗・月間</button>
            <button type="button" data-mode="staff-month">スタッフ・月間</button>
          </div>
        </div>
        <div class="card browse-controls" id="browse-controls"></div>
        <div id="browse-content"></div>
      `;
      workspace.appendChild(section);
    }
  }

  function bindEvents() {
    document.getElementById('browse-tab')?.addEventListener('click', event => {
      event.preventDefault();
      openView(state.mode);
    }, true);
    document.getElementById('browse-mode-switch')?.addEventListener('click', event => {
      const button = event.target.closest('[data-mode]');
      if (!button) return;
      state.mode = button.dataset.mode;
      renderControls();
      render();
    });
  }

  function openView(mode) {
    state.mode = mode;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === 'browse'));
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === 'view-browse'));
    renderControls();
    render();
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function renderControls() {
    const node = document.getElementById('browse-controls');
    if (!node) return;
    const stores = loadStores();
    const staff = loadStaff();
    if (!stores.some(row => row.id === state.storeId)) state.storeId = stores[0]?.id || '';
    if (!staff.some(row => row.id === state.staffId)) state.staffId = staff[0]?.id || '';

    document.querySelectorAll('#browse-mode-switch [data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === state.mode));

    if (state.mode === 'store-day') {
      node.innerHTML = `<label>店舗 <select id="browse-store" class="control">${stores.map(row => option(row.id,row.name,state.storeId)).join('')}</select></label><label>日付 <input id="browse-date" class="control" type="date" value="${esc(state.date)}"></label>`;
    } else if (state.mode === 'store-month') {
      node.innerHTML = `<label>店舗 <select id="browse-store" class="control">${stores.map(row => option(row.id,row.name,state.storeId)).join('')}</select></label><label>対象月 <input id="browse-month" class="control" type="month" value="${esc(state.month)}"></label>`;
    } else {
      node.innerHTML = `<label>スタッフ <select id="browse-staff" class="control browse-staff-select">${staff.map(row => option(row.id,`${row.name || row.id} (${row.id})`,state.staffId)).join('')}</select></label><label>対象月 <input id="browse-month" class="control" type="month" value="${esc(state.month)}"></label>`;
    }

    document.getElementById('browse-store')?.addEventListener('change', event => { state.storeId = event.target.value; render(); });
    document.getElementById('browse-date')?.addEventListener('change', event => { state.date = event.target.value; state.month = state.date.slice(0,7); render(); });
    document.getElementById('browse-month')?.addEventListener('change', event => { state.month = event.target.value; render(); });
    document.getElementById('browse-staff')?.addEventListener('change', event => { state.staffId = event.target.value; render(); });
  }

  function render() {
    const node = document.getElementById('browse-content');
    if (!node) return;
    if (state.mode === 'store-day') renderStoreDay(node);
    else if (state.mode === 'store-month') renderStoreMonth(node);
    else renderStaffMonth(node);
  }

  function renderStoreDay(node) {
    const store = loadStores().find(row => row.id === state.storeId);
    const staff = loadStaff();
    const shifts = shiftsForDate(state.date).filter(shift => shift.startStoreId === state.storeId).sort((a,b) => Number(a.start)-Number(b.start));
    node.innerHTML = `
      <div class="card browse-title"><div><small>店舗・日別</small><h3>${esc(store?.name || state.storeId)}　${formatDateJa(state.date)}</h3></div><strong>${shifts.length}名</strong></div>
      <div class="browse-day-list">${shifts.map(shift => {
        const person = staff.find(row => row.id === String(shift.staffId || '').toUpperCase());
        return `<div class="card browse-shift-card"><div><strong>${esc(person?.name || shift.staffId)}</strong><small>${esc(person?.id || shift.staffId)}</small></div><div class="browse-time">${fmtTime(shift.start)}〜${fmtTime(shift.end)}</div></div>`;
      }).join('') || '<div class="card browse-empty">この日のシフトはありません。</div>'}</div>`;
  }

  function renderStoreMonth(node) {
    const store = loadStores().find(row => row.id === state.storeId);
    const staff = loadStaff();
    const days = daysInMonth(state.month);
    const cards = days.map(date => {
      const shifts = shiftsForDate(date).filter(shift => shift.startStoreId === state.storeId).sort((a,b)=>Number(a.start)-Number(b.start));
      if (!shifts.length) return `<div class="browse-month-day empty-day"><div class="browse-date-head"><b>${dayNumber(date)}</b><span>${weekdayJa(date)}</span></div><small>—</small></div>`;
      return `<div class="browse-month-day"><div class="browse-date-head"><b>${dayNumber(date)}</b><span>${weekdayJa(date)}</span></div>${shifts.map(shift => {
        const person = staff.find(row => row.id === String(shift.staffId || '').toUpperCase());
        return `<div class="browse-mini-shift"><b>${esc(person?.name || shift.staffId)}</b><span>${fmtTime(shift.start)}-${fmtTime(shift.end)}</span></div>`;
      }).join('')}</div>`;
    }).join('');
    node.innerHTML = `<div class="card browse-title"><div><small>店舗・月間</small><h3>${esc(store?.name || state.storeId)}　${formatMonthJa(state.month)}</h3></div></div><div class="card browse-month-grid">${cards}</div>`;
  }

  function renderStaffMonth(node) {
    const person = loadStaff().find(row => row.id === state.staffId);
    const stores = loadStores();
    const holiday = readJson(HOLIDAY_KEY,{staffDays:[]});
    const days = daysInMonth(state.month);
    let workDays = 0;
    let minutes = 0;
    const rows = days.map(date => {
      const shifts = shiftsForDate(date).filter(shift => String(shift.staffId || '').toUpperCase() === state.staffId);
      const off = (holiday.staffDays || []).find(item => String(item.staffId || '').toUpperCase() === state.staffId && item.date === date);
      if (shifts.length) {
        workDays += 1;
        minutes += shifts.reduce((sum,shift) => sum + Math.max(0,Number(shift.end)-Number(shift.start)),0);
      }
      const detail = shifts.map(shift => {
        const store = stores.find(row => row.id === shift.startStoreId);
        return `<div class="browse-person-shift"><b>${esc(store?.name || shift.startStoreId)}</b><span>${fmtTime(shift.start)}〜${fmtTime(shift.end)}</span></div>`;
      }).join('');
      const leave = off ? `<span class="browse-leave ${off.type === 'paid_leave' ? 'paid' : ''}">${off.type === 'paid_leave' ? '有休' : '公休'}</span>` : '';
      return `<div class="browse-person-day ${shifts.length ? 'work' : ''}"><div class="browse-date-head"><b>${dayNumber(date)}</b><span>${weekdayJa(date)}</span></div><div>${detail || leave || '<span class="browse-muted">—</span>'}</div></div>`;
    }).join('');
    node.innerHTML = `
      <div class="card browse-title"><div><small>スタッフ・月間</small><h3>${esc(person?.name || state.staffId)}　${formatMonthJa(state.month)}</h3><p>${esc(person?.id || state.staffId)}</p></div><div class="browse-person-summary"><b>${workDays}日</b><span>勤務予定</span><b>${formatHours(minutes)}h</b><span>拘束時間</span></div></div>
      <div class="card browse-person-grid">${rows}</div>`;
  }

  function shiftsForDate(date) {
    const shifts = readJson(SHIFTS_KEY,{});
    return Array.isArray(shifts?.[date]) ? shifts[date] : [];
  }
  function loadStaff() { return readArray(STAFF_KEY).map(row => ({...row,id:String(row.id || row.employeeNumber || '').toUpperCase()})).filter(row=>row.id); }
  function loadStores() { const rows=readJson(STORES_KEY,DEFAULT_STORES); return Array.isArray(rows)&&rows.length?rows:DEFAULT_STORES; }
  function daysInMonth(month) { const [y,m]=String(month).split('-').map(Number); const last=new Date(y,m,0).getDate(); return Array.from({length:last},(_,i)=>`${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`); }
  function weekdayJa(date) { return ['日','月','火','水','木','金','土'][new Date(`${date}T00:00:00`).getDay()]; }
  function dayNumber(date) { return Number(String(date).slice(-2)); }
  function formatDateJa(date) { const d=new Date(`${date}T00:00:00`); return `${d.getMonth()+1}月${d.getDate()}日（${weekdayJa(date)}）`; }
  function formatMonthJa(month) { const [y,m]=String(month).split('-').map(Number); return `${y}年${m}月`; }
  function fmtTime(total) { const v=Number(total)||0,next=v>=1440,h=Math.floor(v/60)%24,m=v%60; return `${next?'翌':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function formatHours(minutes) { const h=(Number(minutes)||0)/60; return Number.isInteger(h)?String(h):h.toFixed(1); }
  function option(value,label,current) { return `<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`; }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function readArray(key) { const value=readJson(key,[]); return Array.isArray(value)?value:[]; }
  function readJson(key,fallback) { try { const value=JSON.parse(localStorage.getItem(key)); return value ?? JSON.parse(JSON.stringify(fallback)); } catch { return JSON.parse(JSON.stringify(fallback)); } }
  function esc(value) { return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char])); }

  function injectStyles() {
    if (document.getElementById('browse-view-style')) return;
    const style=document.createElement('style');
    style.id='browse-view-style';
    style.textContent=`
      .browse-hero,.browse-title,.browse-controls{display:flex;align-items:center;justify-content:space-between;gap:14px}.browse-hero h2,.browse-title h3{margin:0}.browse-hero p,.browse-title p{margin:4px 0 0;color:#667085;font-size:11px}.browse-mode-switch{display:flex;gap:6px;flex-wrap:wrap}.browse-mode-switch button{border:1px solid #d0d5dd;background:#fff;border-radius:9px;padding:8px 11px;font-size:11px;font-weight:900;color:#475467;cursor:pointer}.browse-mode-switch button.active{background:#101828;color:#fff;border-color:#101828}.browse-controls{justify-content:flex-start;margin-top:10px}.browse-controls label{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:900}.browse-staff-select{min-width:270px}.browse-title{margin-top:10px}.browse-title small{font-size:9px;color:#98a2b3;font-weight:900}.browse-title>strong{font-size:24px}.browse-day-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:10px}.browse-shift-card{display:flex;justify-content:space-between;align-items:center}.browse-shift-card small{display:block;color:#98a2b3;font-size:9px;margin-top:2px}.browse-time{font-size:15px;font-weight:900}.browse-empty{color:#98a2b3;text-align:center}.browse-month-grid{display:grid;grid-template-columns:repeat(7,minmax(125px,1fr));gap:1px;padding:1px;margin-top:10px;background:#eaecf0;overflow:auto}.browse-month-day{min-height:120px;background:#fff;padding:8px}.browse-month-day.empty-day{background:#fcfcfd;color:#98a2b3}.browse-date-head{display:flex;align-items:center;gap:6px;margin-bottom:7px}.browse-date-head b{font-size:14px}.browse-date-head span{font-size:9px;color:#667085}.browse-mini-shift{padding:5px 6px;border-radius:7px;background:#f2f4f7;margin-bottom:4px}.browse-mini-shift b,.browse-mini-shift span{display:block;font-size:9px}.browse-mini-shift span{color:#667085;margin-top:2px}.browse-person-summary{display:grid;grid-template-columns:auto auto;gap:2px 7px;align-items:baseline}.browse-person-summary b{font-size:18px}.browse-person-summary span{font-size:9px;color:#667085}.browse-person-grid{display:grid;grid-template-columns:repeat(7,minmax(125px,1fr));gap:1px;padding:1px;margin-top:10px;background:#eaecf0;overflow:auto}.browse-person-day{min-height:88px;background:#fff;padding:8px}.browse-person-day.work{background:#f9fafb}.browse-person-shift{border-left:3px solid #344054;padding-left:6px;margin-top:4px}.browse-person-shift b,.browse-person-shift span{display:block;font-size:10px}.browse-person-shift span{color:#667085}.browse-leave{display:inline-block;padding:4px 7px;border-radius:999px;background:#f2f4f7;font-size:9px;font-weight:900}.browse-leave.paid{background:#fffaeb;color:#b54708}.browse-muted{color:#d0d5dd}@media(max-width:900px){.browse-month-grid,.browse-person-grid{grid-template-columns:repeat(7,120px)}.browse-hero,.browse-title{align-items:flex-start;flex-direction:column}.browse-controls{flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }
})();