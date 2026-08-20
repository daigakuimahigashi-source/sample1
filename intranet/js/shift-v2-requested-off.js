(() => {
  'use strict';

  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const CLOUD_KEY = 'shiftV2Holidays';
  const STYLE_ID = 'shift-v2-requested-off-style';
  const MODAL_ID = 'requested-off-modal';
  let selectedStaffId = '';
  let selectedMonth = currentMonth();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    injectModal();
    injectButtons();
    bindEvents();
    new MutationObserver(() => injectButtons()).observe(document.body, { childList: true, subtree: true });
  }

  function injectButtons() {
    const holidayHero = document.querySelector('#view-holidays .holiday-controls');
    if (holidayHero && !document.getElementById('requested-off-open')) {
      const button = document.createElement('button');
      button.id = 'requested-off-open';
      button.className = 'btn btn-light';
      button.innerHTML = '<i class="fa-solid fa-calendar-xmark"></i> 希望休を登録';
      holidayHero.appendChild(button);
    }

    const guide = document.getElementById('shift-v2-guided-help');
    if (guide && !guide.querySelector('[data-requested-off-open]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-light btn-small';
      button.dataset.requestedOffOpen = '1';
      button.innerHTML = '<i class="fa-regular fa-calendar-xmark"></i> 希望休';
      guide.appendChild(button);
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .requested-off-bg{display:none;position:fixed;inset:0;z-index:10100;background:rgba(16,24,40,.52);align-items:center;justify-content:center;padding:18px;font-family:'Noto Sans JP',sans-serif}
      .requested-off-bg.open{display:flex}
      .requested-off-dialog{width:min(780px,96vw);max-height:92vh;background:#fff;border-radius:16px;border:1px solid #e4e7ec;box-shadow:0 24px 70px rgba(16,24,40,.28);display:flex;flex-direction:column;overflow:hidden}
      .requested-off-head{padding:16px 18px;border-bottom:1px solid #e4e7ec;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .requested-off-head h3{margin:0;font-size:17px;color:#101828}.requested-off-head p{margin:4px 0 0;font-size:10px;color:#667085;font-weight:700;line-height:1.6}
      .requested-off-controls{display:grid;grid-template-columns:1.4fr .8fr;gap:10px;padding:12px 18px;background:#f8fafc;border-bottom:1px solid #eaecf0}
      .requested-off-field{display:flex;flex-direction:column;gap:5px}.requested-off-field label{font-size:9px;font-weight:900;color:#344054}.requested-off-field select,.requested-off-field input{height:38px;border:1px solid #d0d5dd;border-radius:9px;padding:0 10px;background:#fff;font:700 11px 'Noto Sans JP',sans-serif}
      .requested-off-body{padding:14px 18px;overflow:auto}.requested-off-summary{display:flex;gap:8px;align-items:center;margin-bottom:10px;font-size:10px;color:#475467;font-weight:700}.requested-off-summary strong{font-size:14px;color:#101828}.requested-off-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.requested-off-week{font-size:9px;text-align:center;color:#667085;font-weight:900;padding:4px}.requested-off-day{min-height:68px;border:1px solid #e4e7ec;border-radius:9px;background:#fff;padding:7px;cursor:pointer;text-align:left;position:relative;font-family:'Noto Sans JP',sans-serif}.requested-off-day:hover{border-color:#98a2b3;background:#fcfcfd}.requested-off-day .daynum{font-size:12px;font-weight:900;color:#344054}.requested-off-day .weekday{font-size:8px;color:#98a2b3;margin-left:3px}.requested-off-day.requested{background:#fff7ed;border-color:#fdba74;box-shadow:inset 0 0 0 1px #fdba74}.requested-off-day.requested::after{content:'希望休';position:absolute;right:6px;bottom:6px;border-radius:999px;padding:2px 5px;background:#f97316;color:#fff;font-size:8px;font-weight:900}.requested-off-day.official{background:#f2f4f7;border-color:#d0d5dd;cursor:not-allowed}.requested-off-day.official::after{content:'公休/有休';position:absolute;right:6px;bottom:6px;border-radius:999px;padding:2px 5px;background:#667085;color:#fff;font-size:8px;font-weight:900}.requested-off-day.closure{background:#fef3f2;border-color:#fecdca;cursor:not-allowed}.requested-off-day.closure::after{content:'会社休業';position:absolute;right:6px;bottom:6px;border-radius:999px;padding:2px 5px;background:#d92d20;color:#fff;font-size:8px;font-weight:900}
      .requested-off-note{margin-top:10px;padding:9px 11px;border-radius:9px;background:#fffaeb;border:1px solid #fedf89;color:#93370d;font-size:9px;font-weight:700;line-height:1.6}
      .requested-off-foot{padding:12px 18px 15px;border-top:1px solid #e4e7ec;display:flex;justify-content:space-between;gap:10px;align-items:center}.requested-off-foot small{color:#667085;font-size:9px;font-weight:700}.requested-off-foot-actions{display:flex;gap:8px}
      @media(max-width:640px){.requested-off-controls{grid-template-columns:1fr}.requested-off-calendar{gap:3px}.requested-off-day{min-height:58px;padding:5px}.requested-off-day::after{font-size:7px!important;right:3px!important;bottom:3px!important}}
    `;
    document.head.appendChild(style);
  }

  function injectModal() {
    if (document.getElementById(MODAL_ID)) return;
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'requested-off-bg';
    modal.innerHTML = `
      <div class="requested-off-dialog" role="dialog" aria-modal="true" aria-label="希望休登録">
        <div class="requested-off-head">
          <div><h3>希望休を登録</h3><p>月間一括作成ではこの日を自動配置から外します。必要な場合だけ管理者が手動で上書きできます。</p></div>
          <button type="button" class="btn btn-light btn-small" data-requested-off-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="requested-off-controls">
          <div class="requested-off-field"><label>スタッフ</label><select id="requested-off-staff"></select></div>
          <div class="requested-off-field"><label>対象月</label><input id="requested-off-month" type="month"></div>
        </div>
        <div class="requested-off-body">
          <div id="requested-off-summary" class="requested-off-summary"></div>
          <div id="requested-off-calendar" class="requested-off-calendar"></div>
          <div class="requested-off-note">正社員の希望休は月8公休の候補として扱います。すでに確定した公休・有休・会社休業日はここでは変更しません。</div>
        </div>
        <div class="requested-off-foot"><small>日付をクリックすると希望休ON/OFF</small><div class="requested-off-foot-actions"><button type="button" class="btn btn-light" data-requested-off-close>閉じる</button></div></div>
      </div>`;
    document.body.appendChild(modal);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      if (event.target.closest('#requested-off-open') || event.target.closest('[data-requested-off-open]')) {
        openModal();
        return;
      }
      if (event.target.closest('[data-requested-off-close]') || event.target.id === MODAL_ID) {
        closeModal();
        return;
      }
      const day = event.target.closest('[data-requested-off-date]');
      if (day && !day.disabled) toggleDate(day.dataset.requestedOffDate);
    });
    document.getElementById('requested-off-staff')?.addEventListener('change', event => { selectedStaffId = event.target.value; renderCalendar(); });
    document.getElementById('requested-off-month')?.addEventListener('change', event => { selectedMonth = event.target.value || currentMonth(); renderCalendar(); });
  }

  function openModal() {
    const staff = activeStaff();
    if (!staff.length) return notify('従業員マスタに対象スタッフがいません');
    const currentDate = document.getElementById('work-date')?.value || '';
    selectedMonth = currentDate.slice(0, 7) || selectedMonth || currentMonth();
    if (!selectedStaffId || !staff.some(person => person.id === selectedStaffId)) selectedStaffId = staff[0].id;
    const staffSelect = document.getElementById('requested-off-staff');
    staffSelect.innerHTML = staff.map(person => `<option value="${esc(person.id)}" ${person.id === selectedStaffId ? 'selected' : ''}>${esc(person.name || person.id)}（${esc(person.employmentType || '')}）</option>`).join('');
    document.getElementById('requested-off-month').value = selectedMonth;
    renderCalendar();
    document.getElementById(MODAL_ID)?.classList.add('open');
  }

  function closeModal() { document.getElementById(MODAL_ID)?.classList.remove('open'); }

  function renderCalendar() {
    const node = document.getElementById('requested-off-calendar');
    if (!node || !selectedMonth || !selectedStaffId) return;
    const data = holidayData();
    const weekdays = ['日','月','火','水','木','金','土'];
    const firstDay = new Date(`${selectedMonth}-01T00:00:00`).getDay();
    const headers = ['日','月','火','水','木','金','土'].map(label => `<div class="requested-off-week">${label}</div>`).join('');
    const blanks = Array.from({ length: firstDay }, () => '<div></div>').join('');
    const requested = requestedDates(data, selectedStaffId, selectedMonth);
    const cells = daysInMonth(selectedMonth).map(date => {
      const closure = data.companyClosures.some(item => (typeof item === 'string' ? item : item?.date) === date);
      const record = data.staffDays.find(item => sameId(item.staffId, selectedStaffId) && item.date === date);
      const isRequested = Boolean(record?.requestedOff === true);
      const official = Boolean(record && !isRequested && ['off','paid_leave'].includes(record.type));
      const disabled = closure || official;
      const d = new Date(`${date}T00:00:00`);
      const cls = closure ? 'closure' : official ? 'official' : isRequested ? 'requested' : '';
      return `<button type="button" class="requested-off-day ${cls}" data-requested-off-date="${date}" ${disabled ? 'disabled' : ''}><span class="daynum">${Number(date.slice(-2))}</span><span class="weekday">${weekdays[d.getDay()]}</span></button>`;
    }).join('');
    node.innerHTML = headers + blanks + cells;
    const person = activeStaff().find(item => item.id === selectedStaffId);
    const summary = document.getElementById('requested-off-summary');
    if (summary) summary.innerHTML = `<strong>${esc(person?.name || selectedStaffId)}</strong><span>${esc(selectedMonth)} 希望休：${requested.length}日</span>`;
  }

  async function toggleDate(date) {
    const data = holidayData();
    const index = data.staffDays.findIndex(item => sameId(item.staffId, selectedStaffId) && item.date === date);
    const existing = index >= 0 ? data.staffDays[index] : null;
    if (existing && existing.requestedOff === true) data.staffDays.splice(index, 1);
    else if (!existing) data.staffDays.push({ id: uid('request'), staffId: selectedStaffId, date, type: 'off', requestedOff: true, requestedAt: new Date().toISOString(), requestedBy: actorName() });
    else return;
    data.updatedAt = new Date().toISOString(); data.updatedBy = actorName();
    await persist(data);
    renderCalendar();
    document.dispatchEvent(new CustomEvent('shiftv2-requested-off-changed', { detail: { staffId: selectedStaffId, date } }));
  }

  function requestedDates(data, staffId, month) {
    return data.staffDays.filter(item => sameId(item.staffId, staffId) && item.date.startsWith(month) && item.requestedOff === true).map(item => item.date).sort();
  }

  function activeStaff() {
    const list = loadJson(STAFF_KEY, []);
    return (Array.isArray(list) ? list : []).map(person => ({ ...person, id: String(person.id || person.employeeNumber || '').toUpperCase(), name: person.name || `${person.lastName || ''} ${person.firstName || ''}`.trim() })).filter(person => person.id && person.active !== false && person.shiftTarget !== false && person.shiftEnabled !== false && person.shiftEligible !== false).sort((a,b) => employmentOrder(a.employmentType) - employmentOrder(b.employmentType) || String(a.name || '').localeCompare(String(b.name || ''), 'ja'));
  }

  function holidayData() {
    const source = loadJson(HOLIDAY_KEY, {});
    return { ...source, companyClosures: Array.isArray(source.companyClosures) ? source.companyClosures : [], staffDays: Array.isArray(source.staffDays) ? source.staffDays : [] };
  }

  async function persist(data) {
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(data));
    if (window.shiftV2Cloud && window.shiftV2User) {
      try { await window.shiftV2Cloud.set(CLOUD_KEY, data); } catch (error) { console.warn('Requested off cloud save failed', error); }
    }
  }

  function employmentOrder(type) { return type === '正社員' ? 0 : type === '契約社員' ? 1 : type === '役員' ? 2 : type === 'アルバイト' ? 3 : 4; }
  function daysInMonth(month) { const [y,m] = month.split('-').map(Number); const last = new Date(y,m,0).getDate(); return Array.from({ length:last }, (_,i) => `${month}-${String(i+1).padStart(2,'0')}`); }
  function currentMonth() { const date = document.getElementById('work-date')?.value; if (date) return date.slice(0,7); const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  function sameId(a,b) { return String(a || '').toUpperCase() === String(b || '').toUpperCase(); }
  function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function actorName() { return window.shiftV2User?.displayName || window.shiftV2User?.email || 'ローカル利用者'; }
  function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
  function notify(message) { const toast = document.getElementById('toast'); if (!toast) return window.alert(message); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'),2200); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
})();
