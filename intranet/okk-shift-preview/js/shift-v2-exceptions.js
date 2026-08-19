(() => {
  'use strict';

  const STORAGE_EXCEPTIONS = 'okk_shift_v2_exceptions';
  const STORAGE_SHIFTS = 'okk_shift_v2_shifts';
  const STORAGE_STAFF = 'okk_shift_v2_staff';
  const STORAGE_STORES = 'okk_shift_v2_config';
  const SLOT = 30;
  const DAY_START = 15 * 60;
  const DAY_END = 30 * 60;
  const SLOT_PX = 46;

  const state = {
    type: 'emergency_call',
    exceptions: load(STORAGE_EXCEPTIONS, {}),
    date: '',
    cloudListening: false,
    decorating: false,
  };

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shiftv2-cloud-ready', hydrateCloud);
  document.addEventListener('shiftv2-auth', e => { if (e.detail.user) hydrateCloud(); });

  function init() {
    const dateInput = document.getElementById('exception-date');
    const workDate = document.getElementById('work-date');
    if (!dateInput) return;
    state.date = workDate?.value || today();
    dateInput.value = state.date;

    dateInput.addEventListener('change', () => {
      state.date = dateInput.value;
      render();
      decorateGantt();
    });
    workDate?.addEventListener('change', () => {
      state.date = workDate.value;
      dateInput.value = state.date;
      render();
      queueDecorate();
    });

    document.querySelectorAll('[data-exception-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.type = btn.dataset.exceptionType === 'absence' ? 'absence' : 'emergency_call';
        document.querySelectorAll('[data-exception-type]').forEach(x => x.classList.toggle('active', x === btn));
        renderForm();
      });
    });

    const canvas = document.getElementById('gantt-canvas');
    if (canvas) new MutationObserver(() => queueDecorate()).observe(canvas, { childList: true, subtree: false });

    render();
    queueDecorate();
    setTimeout(hydrateCloud, 400);
  }

  function render() {
    renderForm();
    renderList();
  }

  function renderForm() {
    const root = document.getElementById('exception-form');
    if (!root) return;
    const shifts = dayShifts(state.date);
    const staff = allStaff();
    const stores = allStores();

    if (state.type === 'absence') {
      root.innerHTML = `
        <div class="field"><label>欠勤する予定シフト</label><select id="ex-shift" class="control">${shiftOptions(shifts)}</select></div>
        <div class="field"><label>理由・メモ</label><input id="ex-note" class="control" placeholder="例：体調不良（任意）"></div>
        <button id="ex-submit" class="btn btn-dark exception-submit">欠勤として記録</button>`;
    } else {
      root.innerHTML = `
        <div style="background:#fff1f2;border:1px solid #fecdd3;color:#9f1239;border-radius:9px;padding:8px 9px;font-size:9px;font-weight:800;margin-bottom:10px"><i class="fa-solid fa-bolt"></i> 臨時招集は通常シフトとは別勤務として記録し、ガント上でも専用表示します。</div>
        <div class="field"><label>招集する従業員</label><select id="ex-staff" class="control">${staffOptions(staff)}</select></div>
        <div class="field"><label>出勤店舗</label><select id="ex-store" class="control">${storeOptions(stores)}</select></div>
        <div class="field"><label>開始時刻</label><select id="ex-start" class="control">${timeOptions(20*60)}</select></div>
        <div class="field"><label>終了時刻</label><select id="ex-end" class="control">${timeOptions(25*60)}</select></div>
        <div class="field"><label>招集理由・メモ</label><input id="ex-note" class="control" placeholder="例：欠員補充（任意）"></div>
        <button id="ex-submit" class="btn exception-submit" style="background:#e11d48;color:#fff"><i class="fa-solid fa-bolt"></i> 臨時招集を登録</button>`;
    }

    document.getElementById('ex-submit')?.addEventListener('click', submitException);
  }

  function submitException() {
    const now = new Date().toISOString();
    const by = window.shiftV2User?.email || window.shiftV2User?.displayName || 'local-user';
    let record;

    if (state.type === 'absence') {
      const shiftId = value('ex-shift');
      const shift = dayShifts(state.date).find(s => s.id === shiftId);
      if (!shift) return notify('対象シフトを選んでください');
      record = { id: uid(), type:'absence', date:state.date, shiftId, staffId:shift.staffId, startStoreId:shift.startStoreId, note:value('ex-note'), createdAt:now, createdBy:by };
    } else {
      const start = Number(value('ex-start'));
      const end = Number(value('ex-end'));
      if (!value('ex-staff')) return notify('従業員を選んでください');
      if (end <= start) return notify('終了時刻は開始時刻より後にしてください');
      record = { id:uid(), type:'emergency_call', date:state.date, staffId:value('ex-staff'), startStoreId:value('ex-store'), start, end, note:value('ex-note'), createdAt:now, createdBy:by };
    }

    if (!Array.isArray(state.exceptions[state.date])) state.exceptions[state.date] = [];
    state.exceptions[state.date].push(record);
    saveExceptions();
    render();
    queueDecorate();
    notify(labelFor(record.type) + 'を記録しました');
  }

  function renderList() {
    const root = document.getElementById('exception-list');
    const summary = document.getElementById('exception-summary');
    if (!root) return;
    const rows = dayExceptions(state.date).filter(record => record?.type === 'absence' || record?.type === 'emergency_call').slice().sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    if (summary) summary.textContent = `${rows.length}件`;
    root.innerHTML = rows.map(record => {
      const badgeClass = record.type === 'emergency_call' ? 'emergency-call' : 'absence';
      const cardClass = record.type === 'emergency_call' ? ' emergency-call' : '';
      const timing = record.type === 'emergency_call' ? `${storeName(record.startStoreId)} ${fmt(record.start)}-${fmt(record.end)}` : `${storeName(record.startStoreId)} / 予定シフト欠勤`;
      return `<div class="exception-card${cardClass}" data-exception-id="${esc(record.id)}">
        <div class="exception-card-head"><div><span class="exception-type-badge ${badgeClass}">${record.type==='emergency_call'?'<i class="fa-solid fa-bolt"></i> ':''}${labelFor(record.type)}</span><div class="exception-title" style="margin-top:6px">${esc(staffName(record.staffId))}</div><div class="exception-meta">${esc(timing)}<br>登録：${esc(record.createdBy || '-')}</div></div><div class="exception-actions"><button class="exception-delete" data-delete-exception="${esc(record.id)}">削除</button></div></div>
        ${record.note ? `<div class="exception-note">${esc(record.note)}</div>` : ''}
      </div>`;
    }).join('') || '<div class="empty" style="padding:20px">この日の当日対応はまだありません。</div>';

    root.querySelectorAll('[data-delete-exception]').forEach(btn => btn.addEventListener('click', () => {
      state.exceptions[state.date] = dayExceptions(state.date).filter(x => x.id !== btn.dataset.deleteException);
      saveExceptions(); render(); queueDecorate(); notify('当日対応を削除しました');
    }));
  }

  function queueDecorate() { setTimeout(decorateGantt, 0); }

  function decorateGantt() {
    if (state.decorating) return;
    const canvas = document.getElementById('gantt-canvas');
    const workDate = document.getElementById('work-date')?.value;
    if (!canvas || !workDate) return;
    state.decorating = true;
    try {
      canvas.querySelectorAll('.shift-bar').forEach(bar => {
        bar.classList.remove('absence-mark','emergency-call');
        bar.querySelectorAll('.emergency-call-badge').forEach(x => x.remove());
      });
      canvas.querySelectorAll('[data-emergency-row="true"]').forEach(x => x.remove());

      const exceptions = dayExceptions(workDate);
      exceptions.filter(x => x.type === 'absence' && x.shiftId).forEach(x => {
        canvas.querySelector(`.shift-bar[data-shift-id="${cssEsc(x.shiftId)}"]`)?.classList.add('absence-mark');
      });
      exceptions.filter(x => x.type === 'emergency_call').forEach(x => appendEmergencyRow(canvas, x));
    } finally {
      state.decorating = false;
    }
  }

  function appendEmergencyRow(canvas, record) {
    const staff = staffName(record.staffId);
    const store = allStores().find(s => s.id === record.startStoreId);
    const row = document.createElement('div');
    row.className = 'gantt-row';
    row.dataset.emergencyRow = 'true';
    const left = ((record.start - DAY_START) / SLOT) * SLOT_PX;
    const width = Math.max(SLOT_PX, ((record.end - record.start) / SLOT) * SLOT_PX);
    row.innerHTML = `<div class="staff-cell"><div><strong>${esc(staff)}</strong><span>臨時招集</span></div></div><div class="track"><div class="shift-bar emergency-call" style="left:${left}px;width:${width}px"><span class="emergency-call-badge"><i class="fa-solid fa-bolt"></i> 臨時招集</span><div class="seg" style="width:100%;background:${esc(store?.color || '#64748b')}">${esc(store?.name || '')} ${fmt(record.start)}-${fmt(record.end)}</div></div></div>`;
    const emptyRow = canvas.querySelector('#empty-drop-track')?.closest('.gantt-row');
    if (emptyRow) canvas.insertBefore(row, emptyRow); else canvas.appendChild(row);
  }

  async function hydrateCloud() {
    if (!window.shiftV2Cloud) return;
    try {
      const value = await window.shiftV2Cloud.get('shiftV2Exceptions');
      if (value && typeof value === 'object') {
        state.exceptions = value;
        localStorage.setItem(STORAGE_EXCEPTIONS, JSON.stringify(value));
        render(); queueDecorate();
      }
      if (!state.cloudListening) {
        state.cloudListening = true;
        window.shiftV2Cloud.listen('shiftV2Exceptions', value => {
          if (!value || typeof value !== 'object') return;
          state.exceptions = value;
          localStorage.setItem(STORAGE_EXCEPTIONS, JSON.stringify(value));
          render(); queueDecorate();
        });
      }
    } catch (e) { console.warn('Exception cloud load failed', e); }
  }

  async function saveExceptions() {
    localStorage.setItem(STORAGE_EXCEPTIONS, JSON.stringify(state.exceptions));
    if (window.shiftV2Cloud && window.shiftV2User) {
      try { await window.shiftV2Cloud.set('shiftV2Exceptions', state.exceptions); }
      catch (e) { console.warn('Exception cloud save failed', e); }
    }
  }

  function dayExceptions(date) { return Array.isArray(state.exceptions[date]) ? state.exceptions[date] : []; }
  function dayShifts(date) { const all=load(STORAGE_SHIFTS,{}); return Array.isArray(all[date]) ? all[date] : []; }
  function allStaff() { return load(STORAGE_STAFF, []); }
  function allStores() { return load(STORAGE_STORES, []); }
  function staffName(id) { const s=allStaff().find(x => String(x.id || x.employeeNumber).toUpperCase() === String(id).toUpperCase()); return s?.name || id; }
  function storeName(id) { return allStores().find(x => x.id === id)?.name || id || '-'; }
  function shiftOptions(shifts) { return shifts.map(s => `<option value="${esc(s.id)}">${esc(staffName(s.staffId))}｜${esc(storeName(s.startStoreId))} ${fmt(s.start)}-${fmt(s.end)}</option>`).join('') || '<option value="">予定シフトなし</option>'; }
  function staffOptions(staff) { return staff.map(s => `<option value="${esc(String(s.id || s.employeeNumber || '').toUpperCase())}">${esc(s.name || s.id)}</option>`).join(''); }
  function storeOptions(stores) { return stores.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join(''); }
  function timeOptions(selected) { let html=''; for(let m=DAY_START;m<=DAY_END;m+=SLOT) html += `<option value="${m}" ${m===selected?'selected':''}>${fmtVerbose(m)}</option>`; return html; }
  function labelFor(type) { return type === 'absence' ? '欠勤' : '臨時招集'; }
  function value(id) { return document.getElementById(id)?.value || ''; }
  function fmt(total) { const h=Math.floor(total/60)%24,m=total%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function fmtVerbose(total) { return total>=1440 ? `翌 ${fmt(total)}` : fmt(total); }
  function uid() { return `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`; }
  function load(key, fallback) { try { const v=JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
  function today() { const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
  function notify(message) { const el=document.getElementById('toast'); if(!el)return; el.textContent=message; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1800); }
  function esc(v) { return String(v ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function cssEsc(v) { return window.CSS?.escape ? CSS.escape(String(v)) : String(v).replace(/[^a-zA-Z0-9_-]/g,'\\$&'); }
})();
