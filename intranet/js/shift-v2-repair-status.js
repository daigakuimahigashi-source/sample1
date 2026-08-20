(() => {
  'use strict';

  const CONTEXT_KEY = 'okk_shift_v2_guided_target_context';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const STORES_KEY = 'okk_shift_v2_config';
  const PANEL_ID = 'guided-repair-focus';
  const GUIDE_ID = 'shift-v2-guided-help';
  const STATUS_ID = 'guided-repair-live-status';
  const STYLE_ID = 'shift-v2-repair-status-style';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店', close:30*60, autoJoin:false, joinTarget:'' },
    { id:'kumoji', name:'久茂地店', close:25*60, autoJoin:true, joinTarget:'matsuyama' },
    { id:'miebashi', name:'美栄橋店', close:25*60, autoJoin:true, joinTarget:'matsuyama' },
    { id:'misato', name:'美里店', close:26*60, autoJoin:false, joinTarget:'' },
  ];

  let timer = null;
  let canvasObserver = null;
  let observedCanvas = null;

  if (window.__shiftV2RepairStatusInstalled) return;
  window.__shiftV2RepairStatusInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    bindEvents();
    setTimeout(() => {
      connectCanvasObserver();
      refresh();
    }, 1100);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-repair-recheck]')) {
        event.preventDefault();
        refresh(true);
        return;
      }
      if (event.target.closest?.('#stable-visible-delete,#delete-shift,#save-btn')) schedule(100);
      if (event.target.closest?.('[data-select],.shift-bar')) schedule(260);
    }, false);

    document.addEventListener('change', event => {
      if (event.target?.id === 'work-date') {
        schedule(80);
        return;
      }
      if (event.target?.closest?.('#inspector')) schedule(120);
    }, false);

    document.addEventListener('input', event => {
      if (event.target?.closest?.('#inspector')) schedule(180);
    }, false);

    document.addEventListener('pointerup', event => {
      if (event.target?.closest?.('#gantt-canvas')) schedule(180);
    }, false);

    document.addEventListener('drop', event => {
      if (event.target?.closest?.('#gantt-canvas')) schedule(220);
    }, false);

    window.addEventListener('storage', event => {
      if ([SHIFTS_KEY,STAFF_KEY,REQUIREMENTS_KEY].includes(event.key)) schedule(60);
    });
  }

  function connectCanvasObserver() {
    const canvas = document.getElementById('gantt-canvas');
    if (!canvas) {
      setTimeout(connectCanvasObserver, 300);
      return;
    }
    if (canvasObserver && observedCanvas === canvas) return;
    canvasObserver?.disconnect();
    observedCanvas = canvas;
    canvasObserver = new MutationObserver(() => schedule(100));
    canvasObserver.observe(canvas, { childList:true, subtree:false });
  }

  function schedule(delay = 100) {
    clearTimeout(timer);
    timer = setTimeout(() => refresh(false), delay);
  }

  function refresh(manual = false) {
    connectCanvasObserver();
    const context = readContext();
    if (!context?.date || !context?.storeId) return;

    const selectedDate = document.getElementById('work-date')?.value || '';
    if (selectedDate && selectedDate !== context.date) return;

    const result = evaluate(context.date, context.storeId);
    const panel = ensurePanel(context);
    if (!panel) return;
    renderStatus(panel, context, result);

    if (manual) toast(result.shortages.length ? '現在の配置で不足を再判定しました' : '不足は解消しています');
  }

  function ensurePanel(context) {
    let panel = document.getElementById(PANEL_ID);
    if (panel) {
      ensureRecheckButton(panel);
      return panel;
    }

    const guide = document.getElementById(GUIDE_ID);
    if (!guide) return null;
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="repair-main">
        <strong><i class="fa-solid fa-triangle-exclamation"></i> 今回の修正ポイント</strong>
        <b>${esc(formatDate(context.date))}${context.storeName ? `・${esc(context.storeName)}` : ''}</b>
        ${context.windows ? `<span>元の不足時間帯：${esc(context.windows)}</span>` : ''}
        ${context.maxShortage ? `<span>元の最大不足：${esc(context.maxShortage)}人</span>` : ''}
        ${context.skills ? `<span>元の不足条件：${esc(context.skills)}</span>` : ''}
      </div>
      <div class="repair-actions"><button type="button" class="btn btn-light btn-small" data-repair-recheck><i class="fa-solid fa-rotate"></i> 再判定</button><button type="button" class="btn btn-light btn-small" data-repair-scroll><i class="fa-solid fa-arrow-down"></i> ガントを見る</button><button type="button" class="btn btn-light btn-small" data-repair-dismiss>閉じる</button></div>`;
    guide.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function ensureRecheckButton(panel) {
    const actions = panel.querySelector('.repair-actions');
    if (!actions || actions.querySelector('[data-repair-recheck]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-light btn-small';
    button.dataset.repairRecheck = '1';
    button.innerHTML = '<i class="fa-solid fa-rotate"></i> 再判定';
    actions.prepend(button);
  }

  function renderStatus(panel, context, result) {
    let status = document.getElementById(STATUS_ID);
    if (!status) {
      status = document.createElement('div');
      status.id = STATUS_ID;
      panel.appendChild(status);
    }

    const resolved = result.shortages.length === 0;
    panel.classList.toggle('repair-resolved', resolved);
    panel.classList.toggle('repair-open', !resolved);

    if (resolved) {
      status.className = 'repair-live-status resolved';
      status.innerHTML = '<strong><i class="fa-solid fa-circle-check"></i> 不足解消</strong><span>現在の配置で、この店舗日の必要人数・スキル条件を満たしています。</span>';
      return;
    }

    const windows = mergeIntervals(result.shortages.map(item => ({ start:Number(item.rule.start), end:Number(item.rule.end) })))
      .map(item => `${fmtTime(item.start)}-${fmtTime(item.end)}`).join(' / ');
    const skillNames = Array.from(new Set(result.shortages.map(item => result.skillMap.get(String(item.rule.skillId)) || String(item.rule.skillId))));
    const max = Math.max(...result.shortages.map(item => Number(item.shortage || 0)), 0);

    status.className = 'repair-live-status open';
    status.innerHTML = `
      <strong><i class="fa-solid fa-triangle-exclamation"></i> まだ不足</strong>
      <span>${esc(windows || '時間帯要確認')}</span>
      <span>最大 ${esc(formatNeed(max))}人不足</span>
      <span>${esc(skillNames.slice(0,5).join(' / '))}${skillNames.length > 5 ? ` ほか${skillNames.length - 5}` : ''}</span>`;
  }

  function evaluate(date, storeId) {
    const shifts = readObject(SHIFTS_KEY);
    const staff = readArray(STAFF_KEY).map(person => ({ ...person, id:normalizeId(person.id || person.employeeNumber) }));
    const stores = loadStores();
    const skills = readArray(SKILLS_KEY).filter(skill => skill && skill.active !== false);
    const skillMap = new Map(skills.map(skill => [String(skill.id), skill.name || skill.id]));
    const activeSkills = new Set(skills.map(skill => String(skill.id)));
    const rules = applicableRules(readArray(REQUIREMENTS_KEY), date)
      .filter(rule => rule && rule.active !== false && String(rule.storeId) === String(storeId) && activeSkills.has(String(rule.skillId)));

    const shortages = [];
    rules.forEach(rule => {
      const minimum = weightedMinimum(shifts, staff, stores, date, rule);
      const need = normalizeNeed(rule.count);
      const shortage = roundHalf(Math.max(0, need - minimum));
      if (shortage > 0) shortages.push({ rule, minimum:roundHalf(minimum), shortage });
    });
    return { shortages, skillMap };
  }

  function applicableRules(rows, date) {
    const active = (Array.isArray(rows) ? rows : []).filter(rule => rule && rule.active !== false && dayMatches(rule, date));
    const specific = new Set(active.filter(rule => rule.dayType === 'specific' && rule.specificDate === date).map(ruleKey));
    return active.filter(rule => rule.dayType === 'specific' || !specific.has(ruleKey(rule)));
  }

  function dayMatches(rule, date) {
    const day = new Date(`${date}T00:00:00`).getDay();
    if (rule.dayType === 'specific') return rule.specificDate === date;
    if (rule.dayType === 'weekday') return day >= 1 && day <= 4;
    if (rule.dayType === 'fri_sat') return day === 5 || day === 6;
    if (rule.dayType === 'sun') return day === 0;
    return true;
  }

  function ruleKey(rule) {
    return `${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`;
  }

  function weightedMinimum(shifts, staff, stores, date, rule) {
    let minimum = Infinity;
    for (let slotStart = Number(rule.start); slotStart < Number(rule.end); slotStart += 30) {
      const slotEnd = Math.min(Number(rule.end), slotStart + 30);
      let total = 0;
      (Array.isArray(shifts?.[date]) ? shifts[date] : []).forEach(shift => {
        const person = staff.find(row => row.id === normalizeId(shift.staffId));
        if (!person) return;
        const contribution = skillContribution(person.skillLevels?.[rule.skillId]);
        if (contribution <= 0) return;
        const covered = deriveSegments(shift, stores).some(segment => String(segment.storeId) === String(rule.storeId) && Number(segment.start) <= slotStart && Number(segment.end) >= slotEnd);
        if (covered) total += contribution;
      });
      minimum = Math.min(minimum, total);
    }
    return Number.isFinite(minimum) ? minimum : 0;
  }

  function deriveSegments(shift, stores) {
    const store = stores.find(item => String(item.id) === String(shift.startStoreId));
    const start = Number(shift.start);
    const end = Number(shift.end);
    if (!store) return [{ storeId:shift.startStoreId, start, end }];
    if (store.autoJoin && store.joinTarget && end > Number(store.close)) {
      if (start >= Number(store.close)) return [{ storeId:store.joinTarget, start, end }];
      return [{ storeId:store.id, start, end:Number(store.close) }, { storeId:store.joinTarget, start:Number(store.close), end }];
    }
    return [{ storeId:store.id, start, end }];
  }

  function skillContribution(level) {
    const lv = Math.max(0, Math.min(3, Math.round(Number(level) || 0)));
    if (lv === 1) return 0.5;
    if (lv >= 2) return 1;
    return 0;
  }

  function mergeIntervals(intervals) {
    const rows = intervals.filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start)
      .sort((a,b) => a.start - b.start || a.end - b.end);
    const merged = [];
    rows.forEach(row => {
      const last = merged[merged.length - 1];
      if (!last || row.start > last.end) merged.push({ ...row });
      else last.end = Math.max(last.end, row.end);
    });
    return merged;
  }

  function readContext() {
    try {
      const value = JSON.parse(sessionStorage.getItem(CONTEXT_KEY));
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function loadStores() {
    const value = readJson(STORES_KEY, DEFAULT_STORES);
    if (Array.isArray(value) && value.length) return value;
    if (Array.isArray(value?.stores) && value.stores.length) return value.stores;
    return DEFAULT_STORES;
  }

  function readArray(key) {
    const value = readJson(key, []);
    return Array.isArray(value) ? value : [];
  }

  function readObject(key) {
    const value = readJson(key, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeNeed(value) {
    const n = Number(value);
    return roundHalf(Number.isFinite(n) ? Math.max(0, n) : 0);
  }

  function roundHalf(value) {
    return Math.round((Number(value) || 0) * 2) / 2;
  }

  function formatNeed(value) {
    const n = roundHalf(value);
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function normalizeId(value) {
    return String(value || '').trim().toUpperCase();
  }

  function fmtTime(total) {
    const v = Number(total);
    const next = v >= 1440;
    const h = Math.floor(v / 60) % 24;
    const m = v % 60;
    return `${next ? '翌' : ''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  function formatDate(date) {
    const [year, month, day] = String(date || '').split('-');
    return year && month && day ? `${Number(month)}月${Number(day)}日` : date;
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 2200);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}.repair-open{border-color:#fedf89!important;border-left-color:#f79009!important;background:#fffcf5!important}
      #${PANEL_ID}.repair-resolved{border-color:#abefc6!important;border-left-color:#17b26a!important;background:#f6fef9!important}
      #${STATUS_ID}{flex:1 1 100%;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 9px;border-radius:8px;font-family:'Noto Sans JP',sans-serif}
      #${STATUS_ID} strong{font-size:10px;white-space:nowrap}#${STATUS_ID} span{font-size:8px;font-weight:800}
      #${STATUS_ID}.open{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}#${STATUS_ID}.open strong{color:#c2410c}
      #${STATUS_ID}.resolved{background:#ecfdf3;border:1px solid #abefc6;color:#067647}#${STATUS_ID}.resolved strong{color:#067647}
    `;
    document.head.appendChild(style);
  }
})();
