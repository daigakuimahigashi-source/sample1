(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SHIFT_KEY = 'okk_shift_simple_shifts';
  const STORE_KEY = 'okk_shift_simple_stores';
  const PENDING_MESSAGE = 'okk_shift_simple_constraint_message';
  const SLOT = 30;
  const DAY_START = 15 * 60;
  const MINOR_END = 22 * 60;

  let pointerSnapshot = null;
  let inspectorSnapshot = null;
  let observer = null;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    bindGuards();
    decorateAll();
    showPendingMessage();
    observer = new MutationObserver(debounce(decorateAll, 60));
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function bindGuards() {
    document.addEventListener('pointerdown', event => {
      const bar = event.target.closest('.shift-bar[data-shift-id]');
      if (bar) {
        const current = findShift(bar.dataset.shiftId);
        pointerSnapshot = current ? clone(current) : null;
      }
    }, true);

    document.addEventListener('focusin', event => {
      if (!event.target.closest('#inspector')) return;
      const shift = selectedShiftFromInspector();
      inspectorSnapshot = shift ? clone(shift) : null;
    }, true);

    document.addEventListener('drop', event => {
      if (!event.target.closest('#empty-drop-track')) return;
      setTimeout(() => enforceAfterChange({ source: 'drop', staffId: event.dataTransfer?.getData('text/staff-id') || '' }), 0);
    });

    document.addEventListener('pointerup', () => {
      if (!pointerSnapshot) return;
      const before = pointerSnapshot;
      pointerSnapshot = null;
      setTimeout(() => enforceAfterChange({ source: 'pointer', before }), 0);
    });

    document.addEventListener('change', event => {
      if (!event.target.closest('#inspector')) return;
      const before = inspectorSnapshot;
      inspectorSnapshot = null;
      setTimeout(() => enforceAfterChange({ source: 'inspector', before }), 0);
    });

    document.addEventListener('click', event => {
      const storeButton = event.target.closest('#new-store-buttons [data-store]');
      if (storeButton) setTimeout(decorateStaffCards, 0);
    });
  }

  function enforceAfterChange(context) {
    const date = currentDate();
    const shifts = loadJson(SHIFT_KEY, {});
    const day = Array.isArray(shifts[date]) ? shifts[date] : [];
    if (!day.length) { decorateAll(); return; }

    let target = null;
    if (context.before?.id) target = day.find(shift => shift.id === context.before.id) || null;
    if (!target && context.staffId) target = day.find(shift => sameId(shift.staffId, context.staffId)) || null;
    if (!target) target = day.find(shift => shift.id === selectedShiftId()) || null;
    if (!target) { decorateAll(); return; }

    const person = getStaff(target.staffId);
    const hard = hardViolations(target, person, date);
    let changed = false;
    let message = '';

    const storeError = hard.find(item => item.code === 'store');
    if (storeError) {
      if (context.before) {
        Object.assign(target, context.before);
        message = `${displayName(person)}：${storeError.message}。変更前に戻しました。`;
      } else {
        const index = day.findIndex(shift => shift.id === target.id);
        if (index >= 0) day.splice(index, 1);
        message = `${displayName(person)}：${storeError.message}。配置は登録していません。`;
      }
      changed = true;
    }

    if (!changed && person && isMinorOnDate(person, date)) {
      if (Number(target.start) >= MINOR_END) {
        if (context.before) {
          Object.assign(target, context.before);
          message = `${displayName(person)}：18歳未満のため22:00以降には配置できません。変更前に戻しました。`;
        } else {
          const index = day.findIndex(shift => shift.id === target.id);
          if (index >= 0) day.splice(index, 1);
          message = `${displayName(person)}：18歳未満のため22:00以降には配置できません。`;
        }
        changed = true;
      } else if (Number(target.end) > MINOR_END) {
        target.end = MINOR_END;
        if (target.end <= target.start) target.end = target.start + SLOT;
        message = `${displayName(person)}：18歳未満のため終了時刻を22:00に自動調整しました。`;
        changed = true;
      }
    }

    if (changed) {
      shifts[date] = day;
      localStorage.setItem(SHIFT_KEY, JSON.stringify(shifts));
      sessionStorage.setItem(PENDING_MESSAGE, message);
      location.reload();
      return;
    }

    decorateAll();
  }

  function decorateAll() {
    decorateToolbar();
    decorateStaffCards();
    decorateShifts();
    decorateInspector();
  }

  function decorateToolbar() {
    let chip = document.getElementById('constraint-status-chip');
    const toolbar = document.querySelector('#view-planner .toolbar-right');
    if (!toolbar) return;
    if (!chip) {
      chip = document.createElement('span');
      chip.id = 'constraint-status-chip';
      chip.className = 'constraint-chip';
      toolbar.prepend(chip);
    }
    const date = currentDate();
    const shifts = dayShifts(date);
    let errors = 0, warnings = 0;
    shifts.forEach(shift => {
      const person = getStaff(shift.staffId);
      errors += hardViolations(shift, person, date).length;
      warnings += softWarnings(shift, person, date).length;
    });
    chip.className = `constraint-chip ${errors ? 'error' : warnings ? 'warn' : 'ok'}`;
    chip.innerHTML = errors ? `<i class="fa-solid fa-circle-exclamation"></i> 要修正 ${errors}` : warnings ? `<i class="fa-solid fa-triangle-exclamation"></i> 注意 ${warnings}` : '<i class="fa-solid fa-shield-check"></i> 制約OK';
  }

  function decorateStaffCards() {
    const selectedStore = selectedNewStore();
    const date = currentDate();
    document.querySelectorAll('#staff-list .staff-card[data-staff-id]').forEach(card => {
      const person = getStaff(card.dataset.staffId);
      if (!person) return;
      if (person.active === false) { card.style.display = 'none'; return; }
      card.style.display = '';
      card.classList.remove('rule-store-blocked');
      card.querySelectorAll('[data-rule-badge]').forEach(node => node.remove());

      const meta = card.querySelector('.staff-meta') || card;
      if (isMinorOnDate(person, date)) meta.appendChild(badge('18歳未満・22時まで', 'minor'));
      if (Array.isArray(person.placementStoreIds) && person.placementStoreIds.length) {
        const allowed = person.placementStoreIds.includes(selectedStore);
        if (!allowed) {
          card.classList.add('rule-store-blocked');
          meta.appendChild(badge('この店舗は配置対象外', 'blocked'));
          card.title = `配置可能店舗: ${person.placementStoreIds.map(storeName).join('・')}`;
        }
      }
      if (person.workConstraints) meta.appendChild(badge('勤務条件あり', 'constraint'));
    });
  }

  function decorateShifts() {
    const date = currentDate();
    const shifts = dayShifts(date);
    document.querySelectorAll('.shift-bar[data-shift-id]').forEach(bar => {
      const shift = shifts.find(item => item.id === bar.dataset.shiftId);
      if (!shift) return;
      const person = getStaff(shift.staffId);
      const hard = hardViolations(shift, person, date);
      const soft = softWarnings(shift, person, date);
      bar.classList.toggle('rule-error', hard.length > 0);
      bar.classList.toggle('rule-warning', !hard.length && soft.length > 0);
      bar.title = [...hard, ...soft].map(item => item.message).join('\n') || bar.title;
      bar.querySelectorAll('.rule-flag').forEach(node => node.remove());
      if (hard.length || soft.length) {
        const flag = document.createElement('span');
        flag.className = `rule-flag ${hard.length ? 'error' : 'warn'}`;
        flag.innerHTML = `<i class="fa-solid ${hard.length ? 'fa-circle-exclamation' : 'fa-triangle-exclamation'}"></i>`;
        bar.appendChild(flag);
      }
    });
  }

  function decorateInspector() {
    const host = document.getElementById('inspector');
    if (!host) return;
    host.querySelectorAll('.constraint-inspector').forEach(node => node.remove());
    const shift = selectedShiftFromInspector();
    if (!shift) return;
    const person = getStaff(shift.staffId);
    const hard = hardViolations(shift, person, currentDate());
    const soft = softWarnings(shift, person, currentDate());
    if (!hard.length && !soft.length) return;
    const box = document.createElement('div');
    box.className = 'constraint-inspector';
    box.innerHTML = `${hard.map(item => `<div class="constraint-line error"><i class="fa-solid fa-circle-exclamation"></i>${esc(item.message)}</div>`).join('')}${soft.map(item => `<div class="constraint-line warn"><i class="fa-solid fa-triangle-exclamation"></i>${esc(item.message)}</div>`).join('')}`;
    host.appendChild(box);
  }

  function hardViolations(shift, person, date) {
    const out = [];
    if (!person) return out;
    if (person.active === false) out.push({ code: 'inactive', message: '退職・無効の従業員です' });
    const stores = Array.isArray(person.placementStoreIds) ? person.placementStoreIds.filter(Boolean) : [];
    if (stores.length && !stores.includes(shift.startStoreId)) out.push({ code: 'store', message: `${storeName(shift.startStoreId)}は配置可能店舗に含まれていません` });
    if (isMinorOnDate(person, date) && (Number(shift.start) >= MINOR_END || Number(shift.end) > MINOR_END)) out.push({ code: 'minor', message: '18歳未満の勤務は22:00までです' });
    return out;
  }

  function softWarnings(shift, person, date) {
    const out = [];
    if (!person?.workConstraints) return out;
    const c = person.workConstraints;
    const weekday = String(new Date(`${date}T00:00:00`).getDay());
    if (Array.isArray(c.availableDays) && c.availableDays.length && !c.availableDays.includes(weekday)) out.push({ code: 'day', message: '本人の勤務可能曜日から外れています' });
    if (Number.isFinite(Number(c.availableStart)) && Number(shift.start) < Number(c.availableStart)) out.push({ code: 'start', message: `勤務可能開始 ${fmtTime(c.availableStart)} より早い予定です` });
    if (Number.isFinite(Number(c.availableEnd)) && Number(shift.end) > Number(c.availableEnd)) out.push({ code: 'end', message: `勤務可能終了 ${fmtTime(c.availableEnd)} を超えています` });
    return out;
  }

  function selectedShiftFromInspector() {
    const id = selectedShiftId();
    if (!id) return null;
    return dayShifts(currentDate()).find(shift => shift.id === id) || null;
  }

  function selectedShiftId() {
    return document.querySelector('.shift-bar.selected[data-shift-id]')?.dataset.shiftId || '';
  }

  function selectedNewStore() {
    return document.querySelector('#new-store-buttons [data-store].active')?.dataset.store || document.querySelector('#new-store-buttons [data-store]')?.dataset.store || '';
  }

  function currentDate() {
    return document.getElementById('work-date')?.value || dateKey(new Date());
  }

  function dayShifts(date) {
    const all = loadJson(SHIFT_KEY, {});
    return Array.isArray(all[date]) ? all[date] : [];
  }

  function findShift(id) {
    return dayShifts(currentDate()).find(shift => shift.id === id) || null;
  }

  function getStaff(id) {
    const normalized = String(id || '').toUpperCase();
    return staffList().find(person => String(person.id || person.employeeNumber || '').toUpperCase() === normalized) || null;
  }

  function staffList() {
    const list = loadJson(STAFF_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function isMinorOnDate(person, date) {
    const raw = person?.dob || person?.birthdate || person?.birthday || '';
    if (!raw) return false;
    const birth = parseDate(raw);
    const work = parseDate(date);
    if (!birth || !work) return false;
    let age = work.getFullYear() - birth.getFullYear();
    const beforeBirthday = work.getMonth() < birth.getMonth() || (work.getMonth() === birth.getMonth() && work.getDate() < birth.getDate());
    if (beforeBirthday) age -= 1;
    return age < 18;
  }

  function parseDate(value) {
    const text = String(value || '').trim().replace(/[./]/g, '-');
    const match = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function badge(text, kind) {
    const node = document.createElement('span');
    node.dataset.ruleBadge = kind;
    node.className = `badge rule-badge ${kind}`;
    node.textContent = text;
    return node;
  }

  function storeName(id) {
    const stores = loadJson(STORE_KEY, []);
    return (Array.isArray(stores) ? stores : []).find(store => store.id === id)?.name || ({ matsuyama:'松山店', kumoji:'久茂地店', miebashi:'美栄橋店', misato:'美里店' }[id] || id || '未設定');
  }

  function displayName(person) { return person?.name || person?.id || '従業員'; }
  function fmtTime(total) { const n = Number(total || 0), next = n >= 1440, h = Math.floor(n / 60) % 24, m = n % 60; return `${next ? '翌 ' : ''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function sameId(a, b) { return String(a || '').toUpperCase() === String(b || '').toUpperCase(); }
  function dateKey(date) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[char])); }
  function debounce(fn, wait) { let timer; return () => { clearTimeout(timer); timer = setTimeout(fn, wait); }; }

  function showPendingMessage() {
    const message = sessionStorage.getItem(PENDING_MESSAGE);
    if (!message) return;
    sessionStorage.removeItem(PENDING_MESSAGE);
    setTimeout(() => notify(message), 120);
  }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function injectStyles() {
    if (document.getElementById('shift-simple-constraint-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-simple-constraint-style';
    style.textContent = `
      .constraint-chip{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900;border:1px solid #d0d5dd;background:#fff;color:#475467;white-space:nowrap}.constraint-chip.ok{color:#027a48;background:#ecfdf3;border-color:#abefc6}.constraint-chip.warn{color:#b54708;background:#fffaeb;border-color:#fedf89}.constraint-chip.error{color:#b42318;background:#fef3f2;border-color:#fecdca}.staff-card.rule-store-blocked{opacity:.58;border-style:dashed;background:#f9fafb}.rule-badge.minor{background:#fef3f2;color:#b42318}.rule-badge.blocked{background:#f2f4f7;color:#667085}.rule-badge.constraint{background:#fffaeb;color:#b54708}.shift-bar.rule-error{outline:3px solid #f04438!important;outline-offset:2px}.shift-bar.rule-warning{outline:3px solid #f79009!important;outline-offset:2px}.rule-flag{position:absolute;right:-9px;top:-9px;width:19px;height:19px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:9px;z-index:20;box-shadow:0 2px 5px rgba(16,24,40,.18)}.rule-flag.error{background:#d92d20}.rule-flag.warn{background:#dc6803}.constraint-inspector{margin-top:10px;border-top:1px solid #eaecf0;padding-top:8px}.constraint-line{display:flex;align-items:flex-start;gap:6px;padding:7px 8px;border-radius:7px;font-size:9px;font-weight:800;line-height:1.45;margin-top:5px}.constraint-line.error{background:#fef3f2;color:#b42318;border:1px solid #fecdca}.constraint-line.warn{background:#fffaeb;color:#b54708;border:1px solid #fedf89}
    `;
    document.head.appendChild(style);
  }
})();
