(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const SHIFTS_KEY = 'okk_shift_simple_shifts';
  const STORES_KEY = 'okk_shift_simple_stores';
  const SLOT = 30;
  const MINOR_END = 22 * 60;

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

  let observer;
  let timer;
  let selectedRuleId = '';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    ensurePanel();
    bind();
    renderSoon();
    observer = new MutationObserver(renderSoon);
    observer.observe(document.querySelector('.workspace') || document.body, { childList:true, subtree:true });
  }

  function bind() {
    document.getElementById('work-date')?.addEventListener('change', () => { selectedRuleId = ''; renderSoon(); });
    document.addEventListener('pointerup', () => setTimeout(renderSoon, 30));
    document.addEventListener('drop', () => setTimeout(renderSoon, 30));
    document.addEventListener('change', event => {
      if (event.target.closest('#inspector')) setTimeout(renderSoon, 30);
      if (event.target.id === 'candidate-rule-select') {
        selectedRuleId = event.target.value;
        renderSoon();
      }
    });
    document.addEventListener('click', event => {
      const place = event.target.closest('[data-candidate-place]');
      if (place) applyCandidate(place.dataset.candidatePlace);
      const refresh = event.target.closest('[data-candidates-refresh]');
      if (refresh) renderSoon();
    });
    window.addEventListener('storage', event => {
      if ([STAFF_KEY, SKILLS_KEY, REQUIREMENTS_KEY, SHIFTS_KEY, STORES_KEY].includes(event.key)) renderSoon();
    });
  }

  function ensurePanel() {
    const planner = document.getElementById('view-planner');
    if (!planner || document.getElementById('simple-candidate-panel')) return;
    const panel = document.createElement('section');
    panel.id = 'simple-candidate-panel';
    panel.className = 'card simple-candidate-panel';
    const coverage = document.getElementById('simple-coverage-panel');
    if (coverage) coverage.insertAdjacentElement('afterend', panel);
    else planner.querySelector('.toolbar')?.insertAdjacentElement('afterend', panel);
  }

  function renderSoon() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      observer?.disconnect();
      try { render(); }
      finally { observer?.observe(document.querySelector('.workspace') || document.body, { childList:true, subtree:true }); }
    }, 90);
  }

  function render() {
    ensurePanel();
    const panel = document.getElementById('simple-candidate-panel');
    const date = document.getElementById('work-date')?.value;
    if (!panel || !date) return;

    const data = runtimeData();
    const results = applicableRequirements(data, date).map(rule => evaluateRule(data, date, rule));
    const shortages = results.filter(result => result.shortage > 0 && result.rule.mode !== 'soft');

    if (!shortages.length) {
      selectedRuleId = '';
      panel.className = 'card simple-candidate-panel clear';
      panel.innerHTML = '<div class="candidate-empty"><i class="fa-solid fa-circle-check"></i><div><strong>補完候補は不要です</strong><span>必須の必要スキル人数は現在の配置で足りています。</span></div></div>';
      return;
    }

    if (!shortages.some(item => item.rule.id === selectedRuleId)) selectedRuleId = shortages[0].rule.id;
    const current = shortages.find(item => item.rule.id === selectedRuleId) || shortages[0];
    const candidates = buildCandidates(data, date, current).slice(0, 8);
    const rule = current.rule;
    const store = storeById(data, rule.storeId);
    const skill = skillById(data, rule.skillId);

    panel.className = 'card simple-candidate-panel active';
    panel.innerHTML = `
      <div class="candidate-head">
        <div>
          <strong><i class="fa-solid fa-user-plus"></i> 不足の補完候補</strong>
          <span>候補を選ぶだけ。配置後にガントで時間を微調整できます。</span>
        </div>
        <div class="candidate-head-actions">
          <select id="candidate-rule-select" class="control">${shortages.map(item => ruleOption(data, item, item.rule.id === selectedRuleId)).join('')}</select>
          <button type="button" class="btn btn-light btn-small" data-candidates-refresh><i class="fa-solid fa-rotate"></i></button>
        </div>
      </div>
      <div class="candidate-target">
        <span>${esc(store?.name || rule.storeId)}</span>
        <b>${fmt(rule.start)}-${fmt(rule.end)}</b>
        <span>${esc(skill?.name || rule.skillId)} Lv${Number(rule.minLevel || 1)}以上</span>
        <strong>不足 ${current.shortage}名</strong>
      </div>
      <div class="candidate-list">
        ${candidates.length ? candidates.map(candidate => candidateCard(candidate, data, date, current)).join('') : '<div class="candidate-none">条件を満たす候補がいません。勤務可能条件か配置ルールを確認してください。</div>'}
      </div>
    `;
  }

  function ruleOption(data, result, selected) {
    const rule = result.rule;
    const store = storeById(data, rule.storeId);
    const skill = skillById(data, rule.skillId);
    return `<option value="${esc(rule.id)}" ${selected ? 'selected' : ''}>${esc(store?.name || rule.storeId)} ${fmt(rule.start)}-${fmt(rule.end)} / ${esc(skill?.name || rule.skillId)} / -${result.shortage}名</option>`;
  }

  function candidateCard(candidate, data, date, result) {
    const person = candidate.person;
    const rule = result.rule;
    const skill = skillById(data, rule.skillId);
    const affiliations = Array.isArray(person.affiliations) ? person.affiliations.map(item => item.name).filter(Boolean).slice(0,2) : [];
    const action = candidate.type === 'new' ? '配置する' : '時間を延長';
    const detail = candidate.type === 'new'
      ? `${fmt(rule.start)}-${fmt(rule.end)} で追加`
      : `${fmt(candidate.before.start)}-${fmt(candidate.before.end)} → ${fmt(candidate.after.start)}-${fmt(candidate.after.end)}`;
    return `<article class="candidate-card">
      <div class="candidate-person">
        <strong>${esc(person.name || person.id)}</strong>
        <span>${esc(person.id || '')}</span>
        <div>${employmentChip(person)}<span class="candidate-skill">${esc(skill?.name || rule.skillId)} Lv${candidate.level}</span>${affiliations.map(name => `<span class="candidate-aff">${esc(name)}</span>`).join('')}</div>
      </div>
      <div class="candidate-score"><b>${candidate.score}</b><span>適合度</span></div>
      <div class="candidate-action-detail">${esc(detail)}</div>
      <button type="button" class="btn btn-green btn-small" data-candidate-place="${esc(candidate.token)}"><i class="fa-solid fa-plus"></i>${action}</button>
    </article>`;
  }

  function buildCandidates(data, date, result) {
    const rule = result.rule;
    const skill = skillById(data, rule.skillId);
    const day = Array.isArray(data.shifts[date]) ? data.shifts[date] : [];
    const month = date.slice(0,7);
    const candidates = [];

    data.staff.forEach(person => {
      if (!person || person.active === false || person.autoAssign === false) return;
      const id = String(person.id || person.employeeNumber || '').toUpperCase();
      if (!id) return;
      const level = skillLevel(person, skill);
      if (level < Number(rule.minLevel || 1)) return;
      if (!storeAllowed(person, rule.storeId)) return;
      if (!availabilityCovers(person, date, rule.start, rule.end)) return;
      if (isMinorOnDate(person, date) && Number(rule.end) > MINOR_END) return;

      const existing = day.find(shift => sameId(shift.staffId, id));
      const monthlyMinutes = scheduledMinutesForMonth(data.shifts, id, month);
      const baseScore = scorePerson(person, rule, level, monthlyMinutes, data);

      if (!existing) {
        const token = encodeToken({ type:'new', staffId:id, ruleId:rule.id, date });
        candidates.push({ type:'new', person, level, score:baseScore, token });
        return;
      }

      const after = extendShiftToCover(existing, rule, data.stores);
      if (!after) return;
      if (!availabilityCovers(person, date, after.start, after.end)) return;
      if (isMinorOnDate(person, date) && Number(after.end) > MINOR_END) return;
      const token = encodeToken({ type:'extend', staffId:id, shiftId:existing.id, ruleId:rule.id, date });
      candidates.push({ type:'extend', person, level, score:baseScore + 8, token, before:{...existing}, after });
    });

    return candidates.sort((a,b) => b.score - a.score || String(a.person.name || '').localeCompare(String(b.person.name || ''), 'ja'));
  }

  function scorePerson(person, rule, level, monthlyMinutes, data) {
    let score = 50 + level * 12;
    const placement = Array.isArray(person.placementStoreIds) ? person.placementStoreIds : [];
    if (placement.includes(rule.storeId)) score += 10;
    const affiliationIds = Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : [];
    if (affiliationIds.includes(rule.storeId)) score += 10;
    const store = storeById(data, rule.storeId);
    if (store?.area && affiliationIds.some(id => storeById(data, id)?.area === store.area)) score += 5;
    score -= Math.min(25, Math.round(monthlyMinutes / 600));
    return Math.max(1, Math.min(99, score));
  }

  function applyCandidate(token) {
    const payload = decodeToken(token);
    if (!payload) return notify('候補情報を読み取れませんでした');
    const date = payload.date;
    const data = runtimeData();
    const rule = data.requirements.find(item => item.id === payload.ruleId);
    if (!rule) return notify('配置ルールが更新されています。候補を再読み込みしてください。');
    const person = data.staff.find(item => sameId(item.id || item.employeeNumber, payload.staffId));
    if (!person) return notify('従業員情報が見つかりません。');

    const all = loadObject(SHIFTS_KEY, {});
    const day = Array.isArray(all[date]) ? all[date] : [];

    if (payload.type === 'new') {
      if (day.some(shift => sameId(shift.staffId, payload.staffId))) return notify('この従業員はすでに当日のシフトがあります。');
      day.push({
        id:`sh_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,
        staffId:String(payload.staffId).toUpperCase(),
        startStoreId:rule.storeId,
        start:Number(rule.start),
        end:Number(rule.end),
        memo:'不足補完候補から配置',
      });
    } else {
      const shift = day.find(item => item.id === payload.shiftId && sameId(item.staffId, payload.staffId));
      if (!shift) return notify('元のシフトが変更されています。候補を再読み込みしてください。');
      const extended = extendShiftToCover(shift, rule, data.stores);
      if (!extended) return notify('このシフトでは不足時間帯をカバーできません。');
      shift.start = extended.start;
      shift.end = extended.end;
      shift.memo = [shift.memo, '不足補完候補で時間拡張'].filter(Boolean).join(' / ');
    }

    all[date] = day;
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));
    sessionStorage.setItem('okk_shift_simple_candidate_message', `${person.name || person.id} を補完配置しました`);
    location.reload();
  }

  function extendShiftToCover(existing, rule, stores) {
    const current = { ...existing, start:Number(existing.start), end:Number(existing.end) };
    if (current.startStoreId === rule.storeId) {
      const next = { ...current, start:Math.min(current.start, Number(rule.start)), end:Math.max(current.end, Number(rule.end)) };
      return segmentsCover(next, rule, stores) ? next : null;
    }

    const source = stores.find(store => store.id === current.startStoreId);
    const target = stores.find(store => store.id === rule.storeId);
    if (!source || !target || source.area !== 'naha' || target.area !== 'naha') return null;
    const hub = stores.filter(store => store.area === 'naha').slice().sort((a,b) => Number(b.close || 0) - Number(a.close || 0))[0];
    if (!hub || hub.id !== rule.storeId) return null;
    const next = { ...current, end:Math.max(current.end, Number(rule.end)) };
    return segmentsCover(next, rule, stores) ? next : null;
  }

  function segmentsCover(shift, rule, stores) {
    return deriveSegments(shift, stores).some(segment => segment.storeId === rule.storeId && Number(segment.start) <= Number(rule.start) && Number(segment.end) >= Number(rule.end));
  }

  function deriveSegments(shift, stores) {
    const base = stores.find(store => store.id === shift.startStoreId);
    const start = Number(shift.start), end = Number(shift.end);
    if (!base) return [{ storeId:shift.startStoreId, start, end }];
    const close = Number(base.close || end);
    if (base.area !== 'naha' || end <= close) return [{ storeId:base.id, start, end }];
    const hub = stores.filter(store => store.area === 'naha').slice().sort((a,b) => Number(b.close || 0) - Number(a.close || 0))[0];
    if (!hub || hub.id === base.id) return [{ storeId:base.id, start, end }];
    if (start >= close) return [{ storeId:hub.id, start, end }];
    return [
      { storeId:base.id, start, end:Math.min(end, close) },
      { storeId:hub.id, start:Math.max(start, close), end },
    ];
  }

  function evaluateRule(data, date, rule) {
    let minimum = Infinity;
    for (let minute = Number(rule.start); minute < Number(rule.end); minute += SLOT) {
      minimum = Math.min(minimum, qualifiedCount(data, date, rule, minute, Math.min(Number(rule.end), minute + SLOT)));
    }
    if (!Number.isFinite(minimum)) minimum = 0;
    return { rule, minimum, shortage:Math.max(0, Number(rule.count || 0) - minimum) };
  }

  function qualifiedCount(data, date, rule, start, end) {
    const ids = new Set();
    const day = Array.isArray(data.shifts[date]) ? data.shifts[date] : [];
    const skill = skillById(data, rule.skillId);
    day.forEach(shift => {
      const person = data.staff.find(item => sameId(item.id || item.employeeNumber, shift.staffId));
      if (!person || person.active === false) return;
      if (skillLevel(person, skill) < Number(rule.minLevel || 1)) return;
      if (deriveSegments(shift, data.stores).some(segment => segment.storeId === rule.storeId && segment.start <= start && segment.end >= end)) ids.add(String(person.id || person.employeeNumber || '').toUpperCase());
    });
    return ids.size;
  }

  function applicableRequirements(data, date) {
    const active = data.requirements.filter(rule => rule.active !== false && skillById(data, rule.skillId)?.active !== false);
    const specific = new Set(active.filter(rule => rule.dayType === 'specific' && rule.specificDate === date).map(rule => `${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`));
    return active.filter(rule => {
      if (!dayMatches(rule, date)) return false;
      if (rule.dayType !== 'specific' && specific.has(`${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`)) return false;
      return true;
    });
  }

  function dayMatches(rule, date) {
    if (rule.dayType === 'specific') return rule.specificDate === date;
    const day = new Date(`${date}T00:00:00`).getDay();
    if (rule.dayType === 'weekday') return day >= 1 && day <= 4;
    if (rule.dayType === 'fri_sat') return day === 5 || day === 6;
    if (rule.dayType === 'sun') return day === 0;
    return true;
  }

  function storeAllowed(person, storeId) {
    const allowed = Array.isArray(person.placementStoreIds) ? person.placementStoreIds.filter(Boolean) : [];
    return !allowed.length || allowed.includes(storeId);
  }

  function availabilityCovers(person, date, start, end) {
    const c = person.workConstraints;
    if (!c) return true;
    const weekday = String(new Date(`${date}T00:00:00`).getDay());
    if (Array.isArray(c.availableDays) && c.availableDays.length && !c.availableDays.includes(weekday)) return false;
    if (Number.isFinite(Number(c.availableStart)) && Number(start) < Number(c.availableStart)) return false;
    if (Number.isFinite(Number(c.availableEnd)) && Number(end) > Number(c.availableEnd)) return false;
    return true;
  }

  function isMinorOnDate(person, date) {
    const birth = parseDate(person?.dob || person?.birthdate || person?.birthday || '');
    const work = parseDate(date);
    if (!birth || !work) return false;
    let age = work.getFullYear() - birth.getFullYear();
    if (work.getMonth() < birth.getMonth() || (work.getMonth() === birth.getMonth() && work.getDate() < birth.getDate())) age -= 1;
    return age < 18;
  }

  function parseDate(value) {
    const match = String(value || '').trim().replace(/[./]/g,'-').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2])-1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function scheduledMinutesForMonth(shifts, staffId, month) {
    let total = 0;
    Object.entries(shifts).forEach(([date, day]) => {
      if (!date.startsWith(month)) return;
      (Array.isArray(day) ? day : []).forEach(shift => {
        if (sameId(shift.staffId, staffId)) total += Math.max(0, Number(shift.end || 0) - Number(shift.start || 0));
      });
    });
    return total;
  }

  function skillLevel(person, skill) {
    if (!skill) return 0;
    const direct = Number(person?.skillLevels?.[skill.id]);
    if (Number.isFinite(direct)) return Math.max(0, Math.min(3, direct));
    const legacy = Array.isArray(person?.skills) ? person.skills : [];
    return legacy.some(name => normalize(name) === normalize(skill.name)) ? 1 : 0;
  }

  function runtimeData() {
    const stores = loadArray(STORES_KEY, [
      {id:'matsuyama',name:'松山店',area:'naha',close:30*60},
      {id:'kumoji',name:'久茂地店',area:'naha',close:25*60},
      {id:'miebashi',name:'美栄橋店',area:'naha',close:25*60},
      {id:'misato',name:'美里店',area:'okinawa',close:26*60},
    ]);
    return {
      staff:loadArray(STAFF_KEY, []),
      skills:loadArray(SKILLS_KEY, FALLBACK_SKILLS),
      requirements:loadArray(REQUIREMENTS_KEY, []),
      shifts:loadObject(SHIFTS_KEY, {}),
      stores,
    };
  }

  function skillById(data, id) { return data.skills.find(skill => skill.id === id); }
  function storeById(data, id) { return data.stores.find(store => store.id === id); }
  function employmentChip(person) {
    const text = person.employmentType || (person.salaryType === 'monthly' ? '正社員' : 'アルバイト');
    return `<span class="candidate-emp">${esc(text)}</span>`;
  }
  function loadArray(key, fallback) { const value = loadJson(key, fallback); return Array.isArray(value) ? value : fallback; }
  function loadObject(key, fallback) { const value = loadJson(key, fallback); return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback; }
  function loadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function sameId(a,b) { return String(a || '').toUpperCase() === String(b || '').toUpperCase(); }
  function normalize(value) { return String(value || '').replace(/[\s　（）()]/g,'').toLowerCase(); }
  function fmt(total) { const n=Number(total||0), next=n>=1440, h=Math.floor(n/60)%24, m=n%60; return `${next?'翌 ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char])); }
  function encodeToken(payload) { return btoa(unescape(encodeURIComponent(JSON.stringify(payload)))); }
  function decodeToken(token) { try { return JSON.parse(decodeURIComponent(escape(atob(token)))); } catch { return null; } }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function injectStyles() {
    if (document.getElementById('shift-simple-candidate-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-simple-candidate-style';
    style.textContent = `
      .simple-candidate-panel{margin:-1px 0 10px;padding:10px 12px;border-left:4px solid #7c3aed}.simple-candidate-panel.clear{border-left-color:#12b76a}.candidate-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.candidate-head>div:first-child{display:flex;align-items:center;gap:9px}.candidate-head strong{font-size:11px}.candidate-head span{font-size:9px;color:#667085}.candidate-head-actions{display:flex;gap:5px;align-items:center}.candidate-head-actions select{min-width:320px;max-width:520px}.candidate-target{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px;padding:7px 9px;border-radius:8px;background:#f9f5ff;border:1px solid #e9d7fe;font-size:9px}.candidate-target span{color:#6941c6;font-weight:800}.candidate-target b{color:#344054}.candidate-target strong{margin-left:auto;color:#b42318}.candidate-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}.candidate-card{display:grid;grid-template-columns:minmax(0,1fr) 48px auto;grid-template-rows:auto auto;gap:5px 8px;align-items:center;border:1px solid #e4e7ec;border-radius:9px;padding:8px 9px;background:#fff}.candidate-person{min-width:0}.candidate-person>strong{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.candidate-person>span{display:block;font-size:8px;color:#98a2b3;margin-top:1px}.candidate-person>div{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.candidate-emp,.candidate-skill,.candidate-aff{display:inline-flex;border-radius:999px;padding:2px 5px;font-size:7px;font-weight:800;background:#f2f4f7;color:#475467}.candidate-skill{background:#f4ebff;color:#6941c6}.candidate-aff{background:#eff8ff;color:#175cd3}.candidate-score{text-align:center;grid-row:1/3;grid-column:2}.candidate-score b{display:block;font-size:15px;color:#6941c6}.candidate-score span{font-size:7px;color:#98a2b3}.candidate-action-detail{font-size:8px;color:#667085;grid-column:1}.candidate-card button{grid-column:3;grid-row:1/3;align-self:center}.candidate-none{grid-column:1/-1;padding:14px;text-align:center;color:#667085;font-size:9px;border:1px dashed #d0d5dd;border-radius:8px}.candidate-empty{display:flex;align-items:center;gap:10px;color:#027a48}.candidate-empty>i{font-size:18px}.candidate-empty strong{display:block;font-size:10px}.candidate-empty span{display:block;font-size:8px;color:#667085;margin-top:2px}@media(max-width:900px){.candidate-list{grid-template-columns:1fr}.candidate-head-actions select{min-width:180px;max-width:70vw}}
    `;
    document.head.appendChild(style);
  }

  const pending = sessionStorage.getItem('okk_shift_simple_candidate_message');
  if (pending) {
    sessionStorage.removeItem('okk_shift_simple_candidate_message');
    setTimeout(() => notify(pending), 200);
  }
})();
