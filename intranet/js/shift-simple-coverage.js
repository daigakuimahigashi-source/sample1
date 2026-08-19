(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const SHIFTS_KEY = 'okk_shift_simple_shifts';
  const STORES_KEY = 'okk_shift_simple_stores';
  const SLOT = 30;
  const DAY_START = 15 * 60;
  const SLOT_PX = 46;

  const FALLBACK_SKILLS = [
    { id:'opening', name:'オープン準備', active:true },
    { id:'closing', name:'締め作業', active:true },
    { id:'meat', name:'肉場', active:true },
    { id:'salad', name:'サラダ場', active:true },
    { id:'hall', name:'ホール', active:true },
    { id:'drink', name:'ドリンク', active:true },
    { id:'dish', name:'洗い場', active:true },
    { id:'register', name:'レジ', active:true },
  ];

  const FALLBACK_REQUIREMENTS = [
    req('matsuyama','all',17,23,'hall',1,3), req('matsuyama','all',17,23,'meat',2,1), req('matsuyama','all',17,23,'salad',1,1), req('matsuyama','all',17,23,'drink',1,1), req('matsuyama','all',23,30,'hall',1,2), req('matsuyama','all',23,30,'meat',2,1), req('matsuyama','all',25,30,'closing',2,1),
    req('kumoji','all',17,22,'hall',1,3), req('kumoji','all',17,22,'meat',2,1), req('kumoji','all',17,22,'salad',1,1), req('kumoji','all',17,22,'drink',1,1), req('kumoji','all',22,25,'hall',1,2), req('kumoji','all',24,25,'closing',2,1),
    req('miebashi','all',17,22,'hall',1,2), req('miebashi','all',17,22,'meat',2,1), req('miebashi','all',17,22,'drink',1,1), req('miebashi','all',22,25,'hall',1,2), req('miebashi','all',24,25,'closing',2,1),
    req('misato','all',17,22,'hall',1,2), req('misato','all',17,22,'meat',2,1), req('misato','all',17,22,'salad',1,1), req('misato','all',17,22,'drink',1,1), req('misato','all',22,26,'hall',1,2), req('misato','all',25,26,'closing',2,1),
  ];

  let observer;
  let timer;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    ensurePanel();
    bind();
    renderSoon();
    observer = new MutationObserver(renderSoon);
    const workspace = document.querySelector('.workspace') || document.body;
    observer.observe(workspace, { childList:true, subtree:true });
  }

  function bind() {
    document.getElementById('work-date')?.addEventListener('change', renderSoon);
    document.addEventListener('pointerup', () => setTimeout(renderSoon, 20));
    document.addEventListener('drop', () => setTimeout(renderSoon, 20));
    document.addEventListener('change', event => {
      if (event.target.closest('#inspector')) setTimeout(renderSoon, 20);
    });
    document.addEventListener('click', event => {
      if (event.target.closest('#new-store-buttons [data-store]')) setTimeout(renderSoon, 20);
      const edit = event.target.closest('[data-open-rules]');
      if (edit) window.open('shift-v2.html', '_blank');
    });
    window.addEventListener('storage', event => {
      if ([STAFF_KEY, SKILLS_KEY, REQUIREMENTS_KEY, SHIFTS_KEY, STORES_KEY].includes(event.key)) renderSoon();
    });
  }

  function renderSoon() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      observer?.disconnect();
      try { render(); }
      finally {
        const workspace = document.querySelector('.workspace') || document.body;
        observer?.observe(workspace, { childList:true, subtree:true });
      }
    }, 70);
  }

  function render() {
    const date = document.getElementById('work-date')?.value;
    if (!date) return;
    ensurePanel();

    const data = runtimeData();
    const applicable = data.requirements.filter(rule => rule.active !== false && skillById(data, rule.skillId)?.active !== false && dayMatches(rule, date));
    const results = applicable.map(rule => evaluateRule(date, rule, data));
    const shortages = results.filter(result => result.shortage > 0);
    renderPanel(date, results, shortages, data);
    renderGanttBands(date, shortages, data);
  }

  function ensurePanel() {
    const planner = document.getElementById('view-planner');
    if (!planner || document.getElementById('simple-coverage-panel')) return;
    const panel = document.createElement('section');
    panel.id = 'simple-coverage-panel';
    panel.className = 'card simple-coverage-panel';
    const toolbar = planner.querySelector('.toolbar');
    toolbar?.insertAdjacentElement('afterend', panel);
  }

  function renderPanel(date, results, shortages, data) {
    const panel = document.getElementById('simple-coverage-panel');
    if (!panel) return;
    const hard = shortages.filter(result => result.rule.mode !== 'soft');
    const satisfied = Math.max(0, results.length - shortages.length);
    const byStore = data.stores.map(store => {
      const storeResults = results.filter(result => result.rule.storeId === store.id);
      const storeShort = storeResults.filter(result => result.shortage > 0);
      return { store, total:storeResults.length, shortage:storeShort.length, hard:storeShort.filter(result => result.rule.mode !== 'soft').length };
    });

    panel.className = `card simple-coverage-panel ${hard.length ? 'danger' : shortages.length ? 'warn' : 'clear'}`;
    panel.innerHTML = `
      <div class="coverage-summary-row">
        <div>
          <strong><i class="fa-solid ${shortages.length ? 'fa-people-group' : 'fa-circle-check'}"></i> 必要スキル充足</strong>
          <span>${results.length ? `${satisfied}/${results.length} 条件を充足` : 'この日の配置条件はありません'}</span>
        </div>
        <div class="coverage-actions">
          ${byStore.filter(item => item.total).map(item => `<span class="coverage-store-pill ${item.hard ? 'danger' : item.shortage ? 'warn' : 'ok'}"><b>${esc(item.store.name)}</b>${item.shortage ? `不足${item.shortage}` : 'OK'}</span>`).join('')}
          <button type="button" class="btn btn-light btn-small" data-open-rules><i class="fa-solid fa-sliders"></i>配置ルール</button>
        </div>
      </div>
      ${shortages.length ? `<div class="coverage-shortage-list">${shortages.slice(0,8).map(result => shortageCard(result, data)).join('')}${shortages.length > 8 ? `<span class="coverage-more">ほか ${shortages.length - 8}件</span>` : ''}</div>` : '<div class="coverage-ok-text">現在のシフトで、設定済みの必要人数・スキル条件を満たしています。</div>'}
    `;
  }

  function shortageCard(result, data) {
    const rule = result.rule;
    const store = storeById(data, rule.storeId);
    const skill = skillById(data, rule.skillId);
    return `<div class="coverage-shortage-card ${rule.mode === 'soft' ? 'soft' : 'hard'}"><strong>${esc(store?.name || rule.storeId)} ${fmt(rule.start)}-${fmt(rule.end)}</strong><span>${esc(skill?.name || rule.skillId)} Lv${Number(rule.minLevel || 1)}以上</span><b>${result.minimum}/${Number(rule.count || 0)}名</b></div>`;
  }

  function renderGanttBands(date, shortages, data) {
    document.querySelectorAll('.coverage-band-layer').forEach(node => node.remove());
    const selectedStoreId = document.querySelector('#new-store-buttons [data-store].active')?.dataset.store || '';
    if (!selectedStoreId) return;

    const storeShortages = shortages.filter(result => result.rule.storeId === selectedStoreId);
    const slices = mergeShortageSlices(storeShortages);
    if (!slices.length) return;

    const targets = [...document.querySelectorAll('.time-head, .track')];
    targets.forEach(target => {
      const layer = document.createElement('div');
      layer.className = 'coverage-band-layer';
      slices.forEach(slice => {
        const band = document.createElement('div');
        band.className = `coverage-band ${slice.hard ? 'hard' : 'soft'}`;
        const left = ((slice.start - DAY_START) / SLOT) * SLOT_PX;
        const width = ((slice.end - slice.start) / SLOT) * SLOT_PX;
        band.style.left = `${left}px`;
        band.style.width = `${Math.max(1,width)}px`;
        band.title = `${storeById(data, selectedStoreId)?.name || ''} ${fmt(slice.start)}-${fmt(slice.end)}：${slice.labels.join(' / ')}`;
        if (target.classList.contains('time-head')) {
          const label = document.createElement('span');
          label.textContent = '不足';
          band.appendChild(label);
        }
        layer.appendChild(band);
      });
      target.appendChild(layer);
    });
  }

  function mergeShortageSlices(results) {
    const raw = [];
    results.forEach(result => {
      const skill = loadSkills().find(item => item.id === result.rule.skillId);
      for (let minute = result.rule.start; minute < result.rule.end; minute += SLOT) {
        if ((result.sliceCounts.get(minute) ?? 0) >= Number(result.rule.count || 0)) continue;
        raw.push({ start:minute, end:Math.min(result.rule.end, minute + SLOT), hard:result.rule.mode !== 'soft', label:`${skill?.name || result.rule.skillId} -${Math.max(1, Number(result.rule.count || 0) - (result.sliceCounts.get(minute) ?? 0))}` });
      }
    });
    raw.sort((a,b) => a.start - b.start || Number(b.hard) - Number(a.hard));
    const grouped = new Map();
    raw.forEach(item => {
      const key = `${item.start}|${item.end}`;
      const value = grouped.get(key) || { start:item.start, end:item.end, hard:false, labels:[] };
      value.hard = value.hard || item.hard;
      if (!value.labels.includes(item.label)) value.labels.push(item.label);
      grouped.set(key, value);
    });
    const slices = [...grouped.values()].sort((a,b) => a.start - b.start);
    const out = [];
    slices.forEach(slice => {
      const prev = out[out.length - 1];
      if (prev && prev.end === slice.start && prev.hard === slice.hard && sameLabels(prev.labels, slice.labels)) prev.end = slice.end;
      else out.push({ ...slice, labels:[...slice.labels] });
    });
    return out;
  }

  function evaluateRule(date, rule, data) {
    let minimum = Infinity;
    const sliceCounts = new Map();
    for (let minute = Number(rule.start); minute < Number(rule.end); minute += SLOT) {
      const count = qualifiedCount(date, rule, minute, Math.min(Number(rule.end), minute + SLOT), data);
      sliceCounts.set(minute, count);
      minimum = Math.min(minimum, count);
    }
    if (!Number.isFinite(minimum)) minimum = 0;
    return { rule, minimum, shortage:Math.max(0, Number(rule.count || 0) - minimum), sliceCounts };
  }

  function qualifiedCount(date, rule, start, end, data) {
    const ids = new Set();
    const day = Array.isArray(data.shifts[date]) ? data.shifts[date] : [];
    const skill = skillById(data, rule.skillId);
    day.forEach(shift => {
      const person = data.staff.find(item => sameId(item.id || item.employeeNumber, shift.staffId));
      if (!person || person.active === false) return;
      if (skillLevel(person, skill) < Number(rule.minLevel || 1)) return;
      const segments = deriveSegments(shift, data.stores);
      if (segments.some(segment => segment.storeId === rule.storeId && Number(segment.start) <= start && Number(segment.end) >= end)) ids.add(String(person.id || person.employeeNumber || '').toUpperCase());
    });
    return ids.size;
  }

  function deriveSegments(shift, stores) {
    const base = stores.find(store => store.id === shift.startStoreId);
    if (!base) return [{ storeId:shift.startStoreId, start:Number(shift.start), end:Number(shift.end) }];
    const start = Number(shift.start), end = Number(shift.end), close = Number(base.close || end);
    if (base.area !== 'naha' || end <= close) return [{ storeId:base.id, start, end }];
    const nahaStores = stores.filter(store => store.area === 'naha');
    const hub = nahaStores.slice().sort((a,b) => Number(b.close || 0) - Number(a.close || 0))[0];
    if (!hub || hub.id === base.id) return [{ storeId:base.id, start, end }];
    if (start >= close) return [{ storeId:hub.id, start, end }];
    return [
      { storeId:base.id, start, end:Math.min(end, close) },
      { storeId:hub.id, start:Math.max(start, close), end },
    ];
  }

  function dayMatches(rule, date) {
    if (rule.dayType === 'specific') return rule.specificDate === date;
    const day = new Date(`${date}T00:00:00`).getDay();
    if (rule.dayType === 'weekday') return day >= 1 && day <= 4;
    if (rule.dayType === 'fri_sat') return day === 5 || day === 6;
    if (rule.dayType === 'sun') return day === 0;
    return true;
  }

  function skillLevel(person, skill) {
    if (!skill) return 0;
    const direct = Number(person?.skillLevels?.[skill.id]);
    if (Number.isFinite(direct)) return Math.max(0, Math.min(3, direct));
    const legacy = Array.isArray(person?.skills) ? person.skills : [];
    return legacy.some(name => normalize(name) === normalize(skill.name)) ? 1 : 0;
  }

  function runtimeData() {
    return {
      staff:loadArray(STAFF_KEY, []),
      skills:loadSkills(),
      requirements:loadRequirements(),
      shifts:loadObject(SHIFTS_KEY, {}),
      stores:loadArray(STORES_KEY, [
        {id:'matsuyama',name:'松山店',area:'naha',close:30*60},
        {id:'kumoji',name:'久茂地店',area:'naha',close:25*60},
        {id:'miebashi',name:'美栄橋店',area:'naha',close:25*60},
        {id:'misato',name:'美里店',area:'okinawa',close:26*60},
      ]),
    };
  }

  function loadSkills() { const value = loadArray(SKILLS_KEY, FALLBACK_SKILLS); return value.length ? value : FALLBACK_SKILLS; }
  function loadRequirements() { const value = loadArray(REQUIREMENTS_KEY, FALLBACK_REQUIREMENTS); return value.length ? value : FALLBACK_REQUIREMENTS; }
  function skillById(data, id) { return data.skills.find(skill => skill.id === id); }
  function storeById(data, id) { return data.stores.find(store => store.id === id); }

  function req(storeId, dayType, startHour, endHour, skillId, minLevel, count, mode='hard') {
    return { id:`simple_${storeId}_${startHour}_${endHour}_${skillId}`, storeId, dayType, specificDate:'', start:startHour*60, end:endHour*60, skillId, minLevel, count, mode, active:true };
  }

  function loadArray(key, fallback) { const value = loadJson(key, fallback); return Array.isArray(value) ? value : fallback; }
  function loadObject(key, fallback) { const value = loadJson(key, fallback); return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback; }
  function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function sameId(a,b) { return String(a || '').toUpperCase() === String(b || '').toUpperCase(); }
  function normalize(value) { return String(value || '').replace(/[\s　（）()]/g,'').toLowerCase(); }
  function sameLabels(a,b) { return a.length === b.length && a.every((value,index) => value === b[index]); }
  function fmt(total) { const n=Number(total||0), next=n>=1440, h=Math.floor(n/60)%24, m=n%60; return `${next?'翌 ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char])); }

  function injectStyles() {
    if (document.getElementById('shift-simple-coverage-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-simple-coverage-style';
    style.textContent = `
      .simple-coverage-panel{margin:-1px 0 10px;padding:10px 12px;border-left:4px solid #12b76a}.simple-coverage-panel.warn{border-left-color:#f79009}.simple-coverage-panel.danger{border-left-color:#f04438}.coverage-summary-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.coverage-summary-row>div:first-child{display:flex;align-items:center;gap:9px}.coverage-summary-row strong{font-size:11px}.coverage-summary-row span{font-size:9px;color:#667085}.coverage-actions{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.coverage-store-pill{display:inline-flex;gap:5px;align-items:center;padding:4px 7px;border-radius:999px;font-size:8px!important;font-weight:900;border:1px solid #d0d5dd}.coverage-store-pill.ok{background:#ecfdf3;color:#027a48;border-color:#abefc6}.coverage-store-pill.warn{background:#fffaeb;color:#b54708;border-color:#fedf89}.coverage-store-pill.danger{background:#fef3f2;color:#b42318;border-color:#fecdca}.coverage-shortage-list{display:flex;gap:6px;align-items:stretch;overflow:auto;margin-top:8px;padding-bottom:1px}.coverage-shortage-card{min-width:160px;border:1px solid #fedf89;background:#fffaeb;border-radius:8px;padding:6px 8px;display:grid;grid-template-columns:1fr auto;gap:2px 7px}.coverage-shortage-card.hard{background:#fef3f2;border-color:#fecdca}.coverage-shortage-card strong{font-size:8px;grid-column:1/-1}.coverage-shortage-card span{font-size:8px;color:#667085}.coverage-shortage-card b{font-size:9px;color:#b42318}.coverage-shortage-card.soft b{color:#b54708}.coverage-more,.coverage-ok-text{font-size:9px;color:#667085;display:flex;align-items:center;padding:5px}.coverage-band-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}.time-head .coverage-band-layer{z-index:2}.coverage-band{position:absolute;top:0;bottom:0;background:rgba(247,144,9,.12);border-left:1px solid rgba(247,144,9,.55);border-right:1px solid rgba(247,144,9,.35)}.coverage-band.hard{background:rgba(240,68,56,.12);border-left-color:rgba(240,68,56,.6);border-right-color:rgba(240,68,56,.35)}.time-head .coverage-band span{position:absolute;left:3px;bottom:2px;font-size:7px;font-weight:900;color:#b42318;background:rgba(255,255,255,.8);border-radius:3px;padding:1px 3px}.track>.coverage-band-layer{z-index:1}.shift-bar{z-index:5}
    `;
    document.head.appendChild(style);
  }
})();
