(() => {
  'use strict';

  const SHIFT_KEY = 'okk_shift_simple_shifts';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORE_KEY = 'okk_shift_simple_stores';
  const PUBLISH_KEY = 'okk_shift_simple_publish';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    injectView();
    bind();
  }

  function injectView() {
    if (document.getElementById('view-week')) return;
    const tabs = document.querySelector('.tabs');
    const csvTab = tabs?.querySelector('[data-view="csv"]');
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.dataset.view = 'week';
    tab.innerHTML = '<i class="fa-solid fa-calendar-week"></i> 週間';
    if (csvTab) tabs.insertBefore(tab, csvTab);
    else tabs?.appendChild(tab);

    const view = document.createElement('section');
    view.id = 'view-week';
    view.className = 'view';
    view.innerHTML = `
      <div class="card week-toolbar">
        <div class="week-toolbar-left">
          <button id="week-prev" class="btn btn-light btn-small"><i class="fa-solid fa-chevron-left"></i></button>
          <strong id="week-range-label"></strong>
          <button id="week-next" class="btn btn-light btn-small"><i class="fa-solid fa-chevron-right"></i></button>
          <button id="week-current" class="btn btn-light btn-small">選択日の週</button>
        </div>
        <div id="week-summary" class="week-summary"></div>
      </div>
      <div class="card week-table-card"><div class="week-table-wrap"><table class="week-table"><thead id="week-head"></thead><tbody id="week-body"></tbody></table></div></div>
      <div class="week-legend"><span><i class="week-dot published"></i>公開済み</span><span><i class="week-dot draft"></i>下書き</span><span>セルを押すとその日のガントへ移動</span></div>
    `;
    document.querySelector('.workspace')?.appendChild(view);
  }

  function bind() {
    document.querySelector('[data-view="week"]')?.addEventListener('click', event => {
      event.preventDefault();
      activate();
    });
    document.getElementById('week-prev')?.addEventListener('click', () => moveWeek(-7));
    document.getElementById('week-next')?.addEventListener('click', () => moveWeek(7));
    document.getElementById('week-current')?.addEventListener('click', () => render());
    document.getElementById('week-body')?.addEventListener('click', event => {
      const cell = event.target.closest('[data-week-date]');
      if (!cell) return;
      const input = document.getElementById('work-date');
      if (input) {
        input.value = cell.dataset.weekDate;
        input.dispatchEvent(new Event('change', { bubbles:true }));
      }
      document.querySelector('[data-view="planner"]')?.click();
    });
    document.getElementById('work-date')?.addEventListener('change', () => {
      if (document.getElementById('view-week')?.classList.contains('active')) render();
    });
    window.addEventListener('storage', event => {
      if ([SHIFT_KEY, STAFF_KEY, STORE_KEY, PUBLISH_KEY].includes(event.key) && document.getElementById('view-week')?.classList.contains('active')) render();
    });
  }

  function activate() {
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item.dataset.view === 'week'));
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === 'view-week'));
    render();
  }

  function moveWeek(days) {
    const input = document.getElementById('work-date');
    const base = new Date(`${input?.value || dateKey(new Date())}T00:00:00`);
    base.setDate(base.getDate() + days);
    if (input) input.value = dateKey(base);
    render();
  }

  function render() {
    const base = document.getElementById('work-date')?.value || dateKey(new Date());
    const dates = weekDates(base);
    const shifts = loadObject(SHIFT_KEY, {});
    const staff = normalizeStaff(loadArray(STAFF_KEY, []));
    const stores = loadArray(STORE_KEY, defaultStores());
    const publish = loadObject(PUBLISH_KEY, {});
    const storeMap = new Map(stores.map(store => [store.id, store]));
    const weekIds = new Set();
    dates.forEach(date => (Array.isArray(shifts[date]) ? shifts[date] : []).forEach(shift => weekIds.add(String(shift.staffId || '').toUpperCase())));
    const people = staff.filter(person => weekIds.has(person.id)).sort((a,b) => employmentOrder(a)-employmentOrder(b) || a.name.localeCompare(b.name,'ja'));

    document.getElementById('week-range-label').textContent = `${formatDate(dates[0])} 〜 ${formatDate(dates[6])}`;
    document.getElementById('week-head').innerHTML = `<tr><th class="week-person-head">従業員</th>${dates.map(date => `<th class="${isWeekend(date)}"><strong>${Number(date.slice(8))}</strong><span>${weekday(date)}</span></th>`).join('')}</tr>`;

    const body = document.getElementById('week-body');
    body.innerHTML = people.map(person => {
      return `<tr><td class="week-person"><strong>${esc(person.name)}</strong><span>${esc(person.id)}</span><small>${esc(employmentLabel(person))}</small></td>${dates.map(date => weekCell(person, date, shifts, storeMap, publish)).join('')}</tr>`;
    }).join('') || `<tr><td colspan="8" class="week-empty">この週のシフトはまだありません。</td></tr>`;

    let shiftCount = 0;
    let totalMinutes = 0;
    let published = 0;
    dates.forEach(date => (Array.isArray(shifts[date]) ? shifts[date] : []).forEach(shift => {
      shiftCount += 1;
      totalMinutes += Math.max(0, Number(shift.end || 0) - Number(shift.start || 0));
      const person = staff.find(item => item.id === String(shift.staffId || '').toUpperCase());
      if (person && isPublished(person, date, publish)) published += 1;
    }));
    document.getElementById('week-summary').innerHTML = `<span><b>${people.length}</b>名</span><span><b>${shiftCount}</b>件</span><span><b>${(totalMinutes/60).toFixed(1)}</b>h</span><span><b>${published}/${shiftCount}</b>公開</span>`;
  }

  function weekCell(person, date, shifts, storeMap, publish) {
    const shift = (Array.isArray(shifts[date]) ? shifts[date] : []).find(item => String(item.staffId || '').toUpperCase() === person.id);
    if (!shift) return `<td class="week-cell empty" data-week-date="${date}"><span>—</span></td>`;
    const store = storeMap.get(shift.startStoreId);
    const published = isPublished(person, date, publish);
    return `<td class="week-cell ${published ? 'is-published' : 'is-draft'}" data-week-date="${date}"><div class="week-shift"><span class="week-store" style="--store-color:${store?.color || '#64748b'}">${esc(store?.name || shift.startStoreId || '')}</span><strong>${fmt(shift.start)}-${fmt(shift.end)}</strong><small>${published ? '公開済み' : '下書き'}</small></div></td>`;
  }

  function isPublished(person, date, publish) {
    const through = isMonthly(person) ? publish.monthlyThrough : publish.hourlyThrough;
    const start = publish.startDate || '';
    return !!through && (!start || date >= start) && date <= through;
  }

  function normalizeStaff(list) {
    return list.map(raw => {
      const id = String(raw.id || raw.employeeNumber || '').toUpperCase();
      return { ...raw, id, name:String(raw.name || `${raw.lastName || ''} ${raw.firstName || ''}`).trim() || id };
    }).filter(person => person.id && person.active !== false);
  }

  function isMonthly(person) {
    if (person.salaryType) return person.salaryType === 'monthly';
    return ['正社員','契約社員','役員'].includes(person.employmentType);
  }
  function employmentLabel(person) { return person.employmentType || (isMonthly(person) ? '正社員' : 'アルバイト'); }
  function employmentOrder(person) { return isMonthly(person) ? 0 : 1; }
  function weekDates(date) { const base=new Date(`${date}T00:00:00`); const mon=new Date(base); mon.setDate(base.getDate()-((base.getDay()+6)%7)); return Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return dateKey(d);}); }
  function weekday(date) { return ['日','月','火','水','木','金','土'][new Date(`${date}T00:00:00`).getDay()]; }
  function isWeekend(date) { const d=new Date(`${date}T00:00:00`).getDay(); return d===0?'sun':d===6?'sat':''; }
  function formatDate(date) { const d=new Date(`${date}T00:00:00`); return `${d.getMonth()+1}/${d.getDate()}（${weekday(date)}）`; }
  function fmt(total) { const n=Number(total || 0), next=n>=1440, h=Math.floor(n/60)%24, m=n%60; return `${next?'翌':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function dateKey(date) { const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function defaultStores(){return[{id:'matsuyama',name:'松山店',color:'#7c3aed'},{id:'kumoji',name:'久茂地店',color:'#059669'},{id:'miebashi',name:'美栄橋店',color:'#2563eb'},{id:'misato',name:'美里店',color:'#ea580c'}];}
  function loadArray(key,fallback){const value=loadJson(key,null);return Array.isArray(value)?value:fallback;}
  function loadObject(key,fallback){const value=loadJson(key,null);return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback;}
  function loadJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
  function esc(value){return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]));}

  function injectStyles() {
    if (document.getElementById('shift-simple-week-style')) return;
    const style=document.createElement('style');
    style.id='shift-simple-week-style';
    style.textContent=`
      .week-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding:9px 11px}.week-toolbar-left{display:flex;align-items:center;gap:7px}.week-toolbar-left>strong{font-size:11px;min-width:180px;text-align:center}.week-summary{display:flex;gap:5px;flex-wrap:wrap}.week-summary span{border:1px solid #e4e7ec;background:#f9fafb;border-radius:999px;padding:4px 7px;font-size:8px;color:#667085}.week-summary b{font-size:9px;color:#101828}.week-table-card{overflow:hidden}.week-table-wrap{overflow:auto;max-height:calc(100vh - 205px)}.week-table{width:100%;border-collapse:separate;border-spacing:0;min-width:980px}.week-table th,.week-table td{border-right:1px solid #eaecf0;border-bottom:1px solid #eaecf0}.week-table thead th{position:sticky;top:0;z-index:5;background:#f9fafb;padding:7px;text-align:center;font-size:8px}.week-table thead th strong{display:block;font-size:11px}.week-table thead th span{color:#667085}.week-table thead th.sat{color:#175cd3;background:#eff8ff}.week-table thead th.sun{color:#b42318;background:#fef3f2}.week-person-head{left:0;z-index:8!important;min-width:150px}.week-person{position:sticky;left:0;z-index:4;background:#fff;padding:7px 9px;min-width:150px}.week-person strong{display:block;font-size:9px}.week-person span{display:block;font-size:7px;color:#98a2b3}.week-person small{display:inline-block;margin-top:3px;border-radius:999px;background:#f2f4f7;padding:2px 5px;font-size:7px;color:#475467}.week-cell{min-width:116px;height:58px;padding:4px;cursor:pointer;background:#fff;vertical-align:top}.week-cell:hover{background:#f9fafb}.week-cell.empty{color:#d0d5dd;text-align:center;vertical-align:middle}.week-shift{height:100%;border:1px solid #e4e7ec;border-radius:7px;padding:5px 6px;background:#fff;display:flex;flex-direction:column;gap:2px}.week-cell.is-draft .week-shift{border-style:dashed;background:#fcfcfd}.week-store{font-size:7px;font-weight:900;color:#475467;display:flex;align-items:center;gap:4px}.week-store:before{content:'';width:6px;height:6px;border-radius:50%;background:var(--store-color)}.week-shift strong{font-size:9px}.week-shift small{font-size:7px;color:#667085}.week-cell.is-published .week-shift small{color:#027a48}.week-cell.is-draft .week-shift small{color:#b54708}.week-empty{text-align:center;padding:28px;color:#98a2b3;font-size:10px}.week-legend{display:flex;gap:12px;align-items:center;margin-top:8px;font-size:8px;color:#667085}.week-legend span{display:flex;align-items:center;gap:4px}.week-dot{width:7px;height:7px;border-radius:50%}.week-dot.published{background:#12b76a}.week-dot.draft{background:#f79009}
    `;
    document.head.appendChild(style);
  }
})();
