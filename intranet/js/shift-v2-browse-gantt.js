(() => {
  'use strict';

  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const START = 15 * 60;
  const END = 30 * 60;
  const RANGE = END - START;
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  let displayMode = localStorage.getItem('okk_shift_v2_browse_display') || 'gantt';
  let renderTimer = null;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 260), { once:true });
  else setTimeout(init, 260);

  function init() {
    injectStyles();
    injectToggle();
    bindHooks();
    scheduleRender();
  }

  function injectToggle() {
    const hero = document.querySelector('#view-browse .browse-hero');
    if (!hero || document.getElementById('browse-display-switch')) return;
    const group = document.createElement('div');
    group.id = 'browse-display-switch';
    group.className = 'browse-display-switch';
    group.innerHTML = `
      <button type="button" data-display="gantt"><i class="fa-solid fa-chart-gantt"></i> ガント</button>
      <button type="button" data-display="cards"><i class="fa-solid fa-list"></i> カード</button>
    `;
    const modeSwitch = hero.querySelector('.browse-mode-switch');
    if (modeSwitch) modeSwitch.insertAdjacentElement('afterend', group); else hero.appendChild(group);
    group.addEventListener('click', event => {
      const button = event.target.closest('[data-display]');
      if (!button) return;
      displayMode = button.dataset.display;
      localStorage.setItem('okk_shift_v2_browse_display', displayMode);
      if (displayMode === 'cards') window.shiftV2BrowseViews?.render?.();
      scheduleRender();
    });
    syncToggle();
  }

  function bindHooks() {
    document.addEventListener('click', event => {
      if (event.target.closest?.('#browse-tab,#browse-mode-switch,[data-mode]')) scheduleRender();
    }, true);
    document.addEventListener('change', event => {
      if (event.target.closest?.('#view-browse')) scheduleRender();
    }, true);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      injectToggle();
      syncToggle();
      if (displayMode !== 'gantt') return;
      renderGanttView();
    }, 40);
  }

  function syncToggle() {
    document.querySelectorAll('#browse-display-switch [data-display]').forEach(button => {
      button.classList.toggle('active', button.dataset.display === displayMode);
    });
  }

  function renderGanttView() {
    const view = document.getElementById('view-browse');
    const content = document.getElementById('browse-content');
    if (!view || !content || !view.classList.contains('active')) return;
    const mode = document.querySelector('#browse-mode-switch [data-mode].active')?.dataset.mode || 'store-day';
    if (mode === 'store-day') renderStoreDay(content);
    else if (mode === 'store-month') renderStoreMonth(content);
    else renderStaffMonth(content);
  }

  function renderStoreDay(node) {
    const storeId = document.getElementById('browse-store')?.value || 'matsuyama';
    const date = document.getElementById('browse-date')?.value || dateKey(new Date());
    const store = loadStores().find(row => row.id === storeId);
    const staff = loadStaff();
    const shifts = shiftsForDate(date).filter(shift => shift.startStoreId === storeId).sort((a,b) => Number(a.start)-Number(b.start));
    node.innerHTML = `
      ${title('店舗・日別', `${store?.name || storeId}　${formatDateJa(date)}`, `${shifts.length}名`)}
      <div class="card bg-card">
        ${axis()}
        <div class="bg-day-rows">
          ${shifts.map(shift => {
            const person = staff.find(row => row.id === String(shift.staffId || '').toUpperCase());
            return `<div class="bg-row"><div class="bg-label"><b>${esc(person?.name || shift.staffId)}</b><small>${esc(person?.id || shift.staffId)}</small></div><div class="bg-track">${gridLines()}${bar(shift, person?.name || shift.staffId, store?.name || storeId)}</div></div>`;
          }).join('') || '<div class="bg-empty">この日のシフトはありません。</div>'}
        </div>
      </div>`;
  }

  function renderStoreMonth(node) {
    const storeId = document.getElementById('browse-store')?.value || 'matsuyama';
    const month = document.getElementById('browse-month')?.value || dateKey(new Date()).slice(0,7);
    const store = loadStores().find(row => row.id === storeId);
    const staff = loadStaff();
    const rows = daysInMonth(month).map(date => {
      const shifts = shiftsForDate(date).filter(shift => shift.startStoreId === storeId).sort((a,b)=>Number(a.start)-Number(b.start));
      const rowHeight = Math.max(34, shifts.length * 22 + 8);
      return `<div class="bg-row bg-month-row" style="min-height:${rowHeight}px"><div class="bg-label bg-date-label"><b>${dayNumber(date)}</b><span>${weekdayJa(date)}</span><small>${shifts.length}名</small></div><div class="bg-track bg-stack" style="min-height:${rowHeight}px">${gridLines()}${shifts.map((shift,index) => {
        const person = staff.find(row => row.id === String(shift.staffId || '').toUpperCase());
        return bar(shift, person?.name || shift.staffId, '', index);
      }).join('')}</div></div>`;
    }).join('');
    node.innerHTML = `
      ${title('店舗・月間', `${store?.name || storeId}　${formatMonthJa(month)}`, '')}
      <div class="card bg-card bg-month-card">${axis()}<div class="bg-day-rows">${rows}</div></div>`;
  }

  function renderStaffMonth(node) {
    const staffId = String(document.getElementById('browse-staff')?.value || '').toUpperCase();
    const month = document.getElementById('browse-month')?.value || dateKey(new Date()).slice(0,7);
    const person = loadStaff().find(row => row.id === staffId);
    const stores = loadStores();
    const holiday = readJson(HOLIDAY_KEY,{staffDays:[]});
    let workDays = 0;
    let minutes = 0;
    const rows = daysInMonth(month).map(date => {
      const shifts = shiftsForDate(date).filter(shift => String(shift.staffId || '').toUpperCase() === staffId);
      const off = (holiday.staffDays || []).find(item => String(item.staffId || '').toUpperCase() === staffId && item.date === date);
      if (shifts.length) {
        workDays += 1;
        minutes += shifts.reduce((sum,shift) => sum + Math.max(0,Number(shift.end)-Number(shift.start)),0);
      }
      const tag = off ? `<span class="bg-leave ${off.type === 'paid_leave' ? 'paid' : ''}">${off.type === 'paid_leave' ? '有休' : '公休'}</span>` : '';
      return `<div class="bg-row bg-person-row"><div class="bg-label bg-date-label"><b>${dayNumber(date)}</b><span>${weekdayJa(date)}</span>${tag}</div><div class="bg-track">${gridLines()}${shifts.map((shift,index) => {
        const store = stores.find(row => row.id === shift.startStoreId);
        return bar(shift, store?.name || shift.startStoreId, '', index);
      }).join('')}</div></div>`;
    }).join('');
    node.innerHTML = `
      <div class="card browse-title bg-title"><div><small>スタッフ・月間</small><h3>${esc(person?.name || staffId)}　${formatMonthJa(month)}</h3><p>${esc(person?.id || staffId)}</p></div><div class="bg-summary"><b>${workDays}日</b><span>勤務予定</span><b>${formatHours(minutes)}h</b><span>拘束時間</span></div></div>
      <div class="card bg-card bg-month-card">${axis()}<div class="bg-day-rows">${rows}</div></div>`;
  }

  function title(kicker, heading, side) {
    return `<div class="card browse-title bg-title"><div><small>${esc(kicker)}</small><h3>${esc(heading)}</h3></div>${side ? `<strong>${esc(side)}</strong>` : ''}</div>`;
  }

  function axis() {
    const labels = [];
    for (let hour = 15; hour <= 30; hour += 1) {
      const pct = ((hour * 60 - START) / RANGE) * 100;
      labels.push(`<span style="left:${pct}%">${hour >= 24 ? `翌${hour-24}` : hour}</span>`);
    }
    return `<div class="bg-axis"><div class="bg-axis-label"></div><div class="bg-axis-track">${labels.join('')}</div></div>`;
  }

  function gridLines() {
    const lines = [];
    for (let hour = 15; hour <= 30; hour += 1) {
      const pct = ((hour * 60 - START) / RANGE) * 100;
      lines.push(`<i style="left:${pct}%"></i>`);
    }
    return `<div class="bg-grid">${lines.join('')}</div>`;
  }

  function bar(shift, mainLabel, subLabel, stackIndex = 0) {
    const start = Math.max(START, Number(shift.start) || START);
    const end = Math.min(END, Number(shift.end) || start);
    const left = ((start - START) / RANGE) * 100;
    const width = Math.max(0.6, ((end - start) / RANGE) * 100);
    const top = 5 + stackIndex * 22;
    const store = loadStores().find(row => row.id === shift.startStoreId);
    const color = store?.color || colorForStore(shift.startStoreId);
    const text = `${mainLabel} ${fmtTime(shift.start)}-${fmtTime(shift.end)}`;
    return `<div class="bg-bar" style="left:${left}%;width:${width}%;top:${top}px;background:${color}" title="${esc(text)}"><b>${esc(mainLabel)}</b><span>${fmtTime(shift.start)}-${fmtTime(shift.end)}</span>${subLabel ? `<em>${esc(subLabel)}</em>` : ''}</div>`;
  }

  function colorForStore(id) {
    return ({matsuyama:'#7c3aed',kumoji:'#059669',miebashi:'#2563eb',misato:'#ea580c'})[id] || '#475467';
  }

  function shiftsForDate(date) { const shifts=readJson(SHIFTS_KEY,{}); return Array.isArray(shifts?.[date])?shifts[date]:[]; }
  function loadStaff() { return readArray(STAFF_KEY).map(row=>({...row,id:String(row.id||row.employeeNumber||'').toUpperCase()})).filter(row=>row.id); }
  function loadStores() { const rows=readJson(STORES_KEY,DEFAULT_STORES); return Array.isArray(rows)&&rows.length?rows:DEFAULT_STORES; }
  function daysInMonth(month) { const [y,m]=String(month).split('-').map(Number); const last=new Date(y,m,0).getDate(); return Array.from({length:last},(_,i)=>`${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`); }
  function weekdayJa(date) { return ['日','月','火','水','木','金','土'][new Date(`${date}T00:00:00`).getDay()]; }
  function dayNumber(date) { return Number(String(date).slice(-2)); }
  function formatDateJa(date) { const d=new Date(`${date}T00:00:00`); return `${d.getMonth()+1}月${d.getDate()}日（${weekdayJa(date)}）`; }
  function formatMonthJa(month) { const [y,m]=String(month).split('-').map(Number); return `${y}年${m}月`; }
  function fmtTime(total) { const v=Number(total)||0,next=v>=1440,h=Math.floor(v/60)%24,m=v%60; return `${next?'翌':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function formatHours(minutes) { const h=(Number(minutes)||0)/60; return Number.isInteger(h)?String(h):h.toFixed(1); }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function readArray(key) { const value=readJson(key,[]); return Array.isArray(value)?value:[]; }
  function readJson(key,fallback) { try{const value=JSON.parse(localStorage.getItem(key)); return value??JSON.parse(JSON.stringify(fallback));}catch{return JSON.parse(JSON.stringify(fallback));} }
  function esc(value) { return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char])); }

  function injectStyles() {
    if (document.getElementById('browse-gantt-style')) return;
    const style = document.createElement('style');
    style.id = 'browse-gantt-style';
    style.textContent = `
      #view-browse .browse-hero{flex-wrap:wrap}.browse-display-switch{display:flex;gap:5px;margin-left:auto}.browse-display-switch button{border:1px solid #d0d5dd;background:#fff;border-radius:9px;padding:8px 11px;font-size:11px;font-weight:900;color:#475467;cursor:pointer}.browse-display-switch button.active{background:#12b76a;border-color:#12b76a;color:#fff}.bg-title{margin-top:10px}.bg-card{margin-top:10px;padding:0;overflow:auto}.bg-month-card{max-height:70vh}.bg-axis{position:sticky;top:0;z-index:8;display:grid;grid-template-columns:150px minmax(900px,1fr);height:34px;background:#f9fafb;border-bottom:1px solid #d0d5dd}.bg-axis-label{border-right:1px solid #e4e7ec}.bg-axis-track{position:relative}.bg-axis-track span{position:absolute;top:9px;transform:translateX(-50%);font-size:9px;font-weight:900;color:#667085}.bg-day-rows{min-width:1050px}.bg-row{display:grid;grid-template-columns:150px minmax(900px,1fr);min-height:46px;border-bottom:1px solid #eaecf0;background:#fff}.bg-row:last-child{border-bottom:0}.bg-label{padding:8px 10px;border-right:1px solid #e4e7ec;display:flex;flex-direction:column;justify-content:center}.bg-label b{font-size:11px}.bg-label small{font-size:8px;color:#98a2b3;margin-top:2px}.bg-date-label{flex-direction:row;align-items:center;justify-content:flex-start;gap:6px}.bg-date-label b{font-size:13px}.bg-date-label span{font-size:9px;color:#667085}.bg-date-label small{margin-left:auto}.bg-track{position:relative;min-height:46px;overflow:hidden}.bg-stack{overflow:visible}.bg-grid{position:absolute;inset:0;pointer-events:none}.bg-grid i{position:absolute;top:0;bottom:0;width:1px;background:#f2f4f7}.bg-bar{position:absolute;height:18px;border-radius:5px;min-width:5px;color:#fff;display:flex;align-items:center;gap:5px;padding:0 5px;box-sizing:border-box;overflow:hidden;white-space:nowrap;box-shadow:0 1px 2px rgba(16,24,40,.12)}.bg-bar b{font-size:9px;overflow:hidden;text-overflow:ellipsis}.bg-bar span{font-size:8px;opacity:.9}.bg-bar em{font-style:normal;font-size:8px;opacity:.8}.bg-month-row{min-height:34px}.bg-month-row .bg-label{position:sticky;left:0;z-index:3;background:#fff}.bg-person-row{min-height:34px}.bg-person-row .bg-track{min-height:34px}.bg-person-row .bg-bar{top:7px!important}.bg-leave{margin-left:auto;padding:2px 5px;border-radius:999px;background:#f2f4f7;color:#475467;font-size:8px;font-weight:900}.bg-leave.paid{background:#ecfdf3;color:#027a48}.bg-summary{display:grid;grid-template-columns:auto auto;gap:2px 7px;align-items:baseline}.bg-summary b{font-size:17px}.bg-summary span{font-size:9px;color:#667085}.bg-empty{padding:28px;text-align:center;color:#98a2b3;font-size:11px}@media(max-width:800px){.bg-axis,.bg-row{grid-template-columns:105px minmax(760px,1fr)}.bg-day-rows{min-width:865px}.bg-label{padding:6px}.browse-display-switch{width:100%;margin-left:0}.browse-display-switch button{flex:1}}
    `;
    document.head.appendChild(style);
  }
})();
