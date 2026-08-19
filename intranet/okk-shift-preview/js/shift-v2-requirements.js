import { SKILL_DEFINITIONS, SKILL_LEVELS } from '../data/shift-platform-config.js';

const STORAGE_REQUIREMENTS = 'okk_shift_v2_staffing_requirements';
const STORAGE_STAFF = 'okk_shift_v2_staff';
const STORAGE_SHIFTS = 'okk_shift_v2_shifts';
const STORAGE_STORES = 'okk_shift_v2_config';
const STORAGE_EXCEPTIONS = 'okk_shift_v2_exceptions';
const SLOT = 30;
const DAY_START = 15 * 60;
const DAY_END = 30 * 60;

const DAY_TYPES = {
  all: '毎日',
  mon_thu: '月〜木',
  fri_sat: '金・土',
  sun: '日',
  specific: '特定日',
};

const DEFAULT_REQUIREMENTS = [
  rule('matsuyama','all',17,23,'hall_grill',2,1,'hard'),
  rule('matsuyama','all',17,23,'hall_basic',1,2,'hard'),
  rule('matsuyama','all',17,23,'meat',2,1,'hard'),
  rule('matsuyama','all',17,23,'salad',1,1,'hard'),
  rule('matsuyama','all',17,23,'drink',1,1,'hard'),
  rule('matsuyama','all',23,30,'hall_basic',1,1,'hard'),
  rule('matsuyama','all',23,30,'meat',2,1,'hard'),
  rule('matsuyama','all',25,30,'closing',2,1,'hard'),

  rule('kumoji','all',17,22,'hall_grill',2,1,'hard'),
  rule('kumoji','all',17,22,'hall_basic',1,2,'hard'),
  rule('kumoji','all',17,22,'meat',2,1,'hard'),
  rule('kumoji','all',17,22,'salad',1,1,'recommended'),
  rule('kumoji','all',17,22,'drink',1,1,'hard'),
  rule('kumoji','all',22,25,'hall_basic',1,2,'hard'),
  rule('kumoji','all',24,25,'closing',2,1,'hard'),

  rule('miebashi','all',17,22,'hall_grill',2,1,'hard'),
  rule('miebashi','all',17,22,'hall_basic',1,1,'hard'),
  rule('miebashi','all',17,22,'meat',2,1,'hard'),
  rule('miebashi','all',17,22,'drink',1,1,'hard'),
  rule('miebashi','all',22,25,'hall_basic',1,2,'hard'),
  rule('miebashi','all',24,25,'closing',2,1,'hard'),

  rule('misato','all',17,22,'hall_grill',2,1,'hard'),
  rule('misato','all',17,22,'hall_basic',1,1,'hard'),
  rule('misato','all',17,22,'meat',2,1,'hard'),
  rule('misato','all',17,22,'salad',1,1,'recommended'),
  rule('misato','all',17,22,'drink',1,1,'hard'),
  rule('misato','all',22,26,'hall_basic',1,2,'hard'),
  rule('misato','all',25,26,'closing',2,1,'hard'),
];

let requirements = normalizeRequirements(load(STORAGE_REQUIREMENTS, DEFAULT_REQUIREMENTS));
let selectedDate = today();
let selectedStore = '';
let renderQueued = false;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();

document.addEventListener('shiftv2-access', () => queueRender());

function init() {
  selectedDate = document.getElementById('work-date')?.value || today();
  injectView();
  bindPlanner();
  render();
}

function rule(storeId, dayType, startHour, endHour, skillId, minLevel, count, mode) {
  return {
    id:`req_${storeId}_${dayType}_${startHour}_${endHour}_${skillId}_${minLevel}_${count}_${mode}`,
    storeId,
    dayType,
    specificDate:'',
    start:startHour * 60,
    end:endHour * 60,
    skillId,
    minLevel,
    count,
    mode,
    active:true,
    sample:true,
  };
}

function injectView() {
  if (document.getElementById('view-requirements')) return;

  const tabs = document.querySelector('.tabs');
  const staffTab = tabs?.querySelector('[data-view="staff"]');
  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.dataset.view = 'requirements';
  tab.innerHTML = '<i class="fa-solid fa-people-group"></i> 人員・スキル条件';
  if (staffTab) tabs.insertBefore(tab, staffTab); else tabs?.appendChild(tab);

  const view = document.createElement('section');
  view.id = 'view-requirements';
  view.className = 'view';
  view.innerHTML = `
    <div class="card req-hero">
      <div>
        <h2>人員・スキル条件</h2>
        <p>この条件と同じスキルマトリクスを、配置不足判定と次のAIシフト生成が共通で使用します。</p>
      </div>
      <div class="req-hero-actions">
        <span class="req-sample-note"><i class="fa-solid fa-flask"></i> 現在の人数はプレビュー用サンプル</span>
        <button id="req-add" class="btn btn-green"><i class="fa-solid fa-plus"></i> 条件追加</button>
      </div>
    </div>

    <div id="req-summary" class="summary req-summary"></div>

    <section class="card req-coverage-card">
      <div class="data-head req-head">
        <div><h2>配置充足プレビュー</h2><small>同じ人を複数ポジションへ二重カウントせず、30分単位で判定</small></div>
        <div class="req-filters">
          <input id="req-date" class="control" type="date">
          <select id="req-store-filter" class="control"></select>
        </div>
      </div>
      <div id="req-coverage" class="req-coverage"></div>
    </section>

    <section class="card req-master-card">
      <div class="data-head req-head">
        <div><h2>条件マスタ</h2><small>店舗 × 曜日 × 時間帯 × 必要スキル × 最低Lv × 人数</small></div>
        <div class="req-master-note">赤＝必須 / 黄＝推奨</div>
      </div>
      <div class="table-wrap req-table-wrap">
        <table class="req-table">
          <thead><tr><th>有効</th><th>店舗</th><th>曜日</th><th>時間帯</th><th>必要スキル</th><th>最低Lv</th><th>人数</th><th>区分</th><th>充足</th><th></th></tr></thead>
          <tbody id="req-body"></tbody>
        </table>
      </div>
    </section>
  `;
  document.querySelector('.workspace')?.appendChild(view);
  injectStyles();

  tab.addEventListener('click', event => {
    event.preventDefault();
    reloadSources();
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.view').forEach(item => item.classList.toggle('active', item === view));
    render();
  });

  document.getElementById('req-add')?.addEventListener('click', addRequirement);
  document.getElementById('req-date')?.addEventListener('change', event => {
    selectedDate = event.target.value || today();
    render();
  });
  document.getElementById('req-store-filter')?.addEventListener('change', event => {
    selectedStore = event.target.value;
    render();
  });
}

function bindPlanner() {
  document.getElementById('work-date')?.addEventListener('change', event => {
    selectedDate = event.target.value || today();
    queueRender();
  });

  const planner = document.getElementById('view-planner');
  if (planner && !document.getElementById('requirements-planner-banner')) {
    const banner = document.createElement('div');
    banner.id = 'requirements-planner-banner';
    banner.className = 'req-planner-banner';
    planner.insertBefore(banner, planner.firstChild);
  }

  const canvas = document.getElementById('gantt-canvas');
  if (canvas) new MutationObserver(queueRender).observe(canvas, { childList:true, subtree:false });
}

function reloadSources() {
  requirements = normalizeRequirements(load(STORAGE_REQUIREMENTS, requirements));
}

function render() {
  reloadSources();
  const dateInput = document.getElementById('req-date');
  if (dateInput) dateInput.value = selectedDate;
  renderStoreFilter();
  renderSummary();
  renderCoverage();
  renderTable();
  renderPlannerBanner();
  applyAccess();
}

function renderStoreFilter() {
  const select = document.getElementById('req-store-filter');
  if (!select) return;
  const stores = allStores();
  if (selectedStore && !stores.some(store => store.id === selectedStore)) selectedStore = '';
  select.innerHTML = `<option value="">全店舗</option>${stores.map(store => `<option value="${esc(store.id)}" ${store.id===selectedStore?'selected':''}>${esc(store.name)}</option>`).join('')}`;
}

function renderSummary() {
  const root = document.getElementById('req-summary');
  if (!root) return;
  const coverage = computeCoverage(selectedDate, selectedStore);
  const active = activeRulesForDate(selectedDate).filter(rule => !selectedStore || rule.storeId === selectedStore);
  const hardRules = active.filter(rule => rule.mode === 'hard');
  const recommendedRules = active.filter(rule => rule.mode !== 'hard');
  root.innerHTML = metric('有効条件', `${active.length}件`, '選択日の適用条件')
    + metric('必須条件', `${hardRules.length}件`, 'AIが優先して満たす')
    + metric('必須不足', `${coverage.hardShortage}枠`, coverage.hardShortage ? '30分枠で不足あり' : '不足なし')
    + metric('推奨不足', `${coverage.recommendedShortage}枠`, recommendedRules.length ? '余力があれば満たす' : '推奨条件なし');
}

function metric(label, value, sub) {
  return `<div class="card metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><div style="font-size:8px;color:#8a94a5;margin-top:2px">${esc(sub)}</div></div>`;
}

function renderCoverage() {
  const root = document.getElementById('req-coverage');
  if (!root) return;
  const coverage = computeCoverage(selectedDate, selectedStore);
  const stores = allStores().filter(store => !selectedStore || store.id === selectedStore);

  root.innerHTML = stores.map(store => {
    const rows = coverage.slots.filter(slot => slot.storeId === store.id);
    if (!rows.length) return `<div class="req-store-coverage"><div class="req-store-title"><strong>${esc(store.name)}</strong><span>条件なし</span></div><div class="empty" style="padding:12px">この日に適用される条件はありません。</div></div>`;
    return `<div class="req-store-coverage">
      <div class="req-store-title"><strong>${esc(store.name)}</strong><span>${rows.some(row=>row.hardShortage>0)?'<b class="req-bad">必須不足あり</b>':'<b class="req-good">必須OK</b>'}</span></div>
      <div class="req-slot-list">${rows.map(slot => slotHtml(slot)).join('')}</div>
    </div>`;
  }).join('');
}

function slotHtml(slot) {
  const badges = slot.ruleResults.map(result => {
    const skill = skillName(result.skillId);
    const cls = result.filled >= result.count ? 'ok' : result.mode === 'hard' ? 'bad' : 'warn';
    return `<span class="req-coverage-chip ${cls}">${esc(skill)} Lv${result.minLevel} ${result.filled}/${result.count}</span>`;
  }).join('');
  const status = slot.hardShortage > 0 ? `<span class="req-slot-status bad">不足 ${slot.hardShortage}</span>` : '<span class="req-slot-status ok">OK</span>';
  return `<div class="req-slot-row"><div class="req-slot-time">${fmt(slot.start)}-${fmt(slot.end)}</div><div class="req-slot-badges">${badges}</div>${status}</div>`;
}

function renderTable() {
  const body = document.getElementById('req-body');
  if (!body) return;
  const canEdit = canEditRequirements();
  const coverage = computeCoverage(selectedDate, '');
  const statusMap = coverage.ruleWorst;
  const rows = requirements.filter(rule => !selectedStore || rule.storeId === selectedStore);
  body.innerHTML = rows.map(rule => {
    const status = statusMap.get(rule.id);
    return `<tr data-rule-id="${esc(rule.id)}" class="${rule.active===false?'req-disabled':''}">
      <td><input data-field="active" type="checkbox" ${rule.active!==false?'checked':''} ${canEdit?'':'disabled'}></td>
      <td><select data-field="storeId" ${canEdit?'':'disabled'}>${storeOptions(rule.storeId)}</select></td>
      <td><div class="req-day-cell"><select data-field="dayType" ${canEdit?'':'disabled'}>${Object.entries(DAY_TYPES).map(([value,label])=>`<option value="${value}" ${rule.dayType===value?'selected':''}>${label}</option>`).join('')}</select>${rule.dayType==='specific'?`<input data-field="specificDate" type="date" value="${esc(rule.specificDate||selectedDate)}" ${canEdit?'':'disabled'}>`:''}</div></td>
      <td><div class="req-time-cell"><select data-field="start" ${canEdit?'':'disabled'}>${timeOptions(rule.start)}</select><span>〜</span><select data-field="end" ${canEdit?'':'disabled'}>${timeOptions(rule.end)}</select></div></td>
      <td><select data-field="skillId" ${canEdit?'':'disabled'}>${SKILL_DEFINITIONS.map(skill=>`<option value="${skill.id}" ${skill.id===rule.skillId?'selected':''}>${esc(skill.name)}</option>`).join('')}</select></td>
      <td><select data-field="minLevel" ${canEdit?'':'disabled'}>${SKILL_LEVELS.filter(level=>level.value>0).map(level=>`<option value="${level.value}" ${level.value===rule.minLevel?'selected':''}>Lv${level.value} ${esc(level.label)}</option>`).join('')}</select></td>
      <td><input data-field="count" type="number" min="1" max="10" value="${rule.count}" ${canEdit?'':'disabled'}></td>
      <td><select data-field="mode" class="req-mode ${rule.mode}" ${canEdit?'':'disabled'}><option value="hard" ${rule.mode==='hard'?'selected':''}>必須</option><option value="recommended" ${rule.mode==='recommended'?'selected':''}>推奨</option></select>${rule.sample?'<span class="req-sample-chip">サンプル</span>':''}</td>
      <td>${status ? `<span class="req-row-status ${status.filled>=status.count?'ok':rule.mode==='hard'?'bad':'warn'}">${status.filled}/${status.count}</span>` : '<span class="req-row-status muted">対象外</span>'}</td>
      <td>${canEdit?`<button class="req-delete" data-delete-rule="${esc(rule.id)}" title="削除"><i class="fa-solid fa-trash"></i></button>`:''}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="10" class="empty" style="padding:24px;text-align:center">条件がありません。</td></tr>';

  if (!canEdit) return;
  body.querySelectorAll('[data-rule-id]').forEach(row => {
    row.querySelectorAll('[data-field]').forEach(control => control.addEventListener('change', () => updateRule(row.dataset.ruleId, control)));
  });
  body.querySelectorAll('[data-delete-rule]').forEach(button => button.addEventListener('click', () => deleteRule(button.dataset.deleteRule)));
}

function updateRule(id, control) {
  if (!canEditRequirements()) return;
  const target = requirements.find(rule => rule.id === id);
  if (!target) return;
  const field = control.dataset.field;
  if (field === 'active') target.active = control.checked;
  else if (['start','end','minLevel','count'].includes(field)) target[field] = Number(control.value);
  else target[field] = control.value;
  target.sample = false;
  if (target.end <= target.start) target.end = Math.min(DAY_END, target.start + SLOT);
  saveRequirements();
  render();
}

function addRequirement() {
  if (!canEditRequirements()) return notify('必要人員条件の編集は本部のみです');
  const stores = allStores();
  requirements.push({
    id:`req_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    storeId:selectedStore || stores[0]?.id || 'matsuyama',
    dayType:'all',
    specificDate:'',
    start:17*60,
    end:22*60,
    skillId:SKILL_DEFINITIONS[0]?.id || 'meat',
    minLevel:1,
    count:1,
    mode:'hard',
    active:true,
    sample:false,
  });
  saveRequirements();
  render();
  notify('条件を追加しました');
}

function deleteRule(id) {
  if (!canEditRequirements()) return;
  requirements = requirements.filter(rule => rule.id !== id);
  saveRequirements();
  render();
}

function saveRequirements() {
  localStorage.setItem(STORAGE_REQUIREMENTS, JSON.stringify(requirements));
  document.dispatchEvent(new CustomEvent('shiftv2-requirements-changed', { detail:{ requirements } }));
}

function activeRulesForDate(date) {
  return requirements.filter(rule => rule.active !== false && matchesDate(rule, date));
}

function matchesDate(rule, date) {
  if (rule.dayType === 'specific') return rule.specificDate === date;
  if (rule.dayType === 'all') return true;
  const day = new Date(`${date}T00:00:00`).getDay();
  if (rule.dayType === 'mon_thu') return day >= 1 && day <= 4;
  if (rule.dayType === 'fri_sat') return day === 5 || day === 6;
  if (rule.dayType === 'sun') return day === 0;
  return true;
}

function computeCoverage(date, storeFilter) {
  const stores = allStores().filter(store => !storeFilter || store.id === storeFilter);
  const rules = activeRulesForDate(date).filter(rule => !storeFilter || rule.storeId === storeFilter);
  const staff = normalizeStaff(allStaff());
  const working = workingIntervals(date);
  const slots = [];
  const ruleWorst = new Map();
  let hardShortage = 0;
  let recommendedShortage = 0;

  stores.forEach(store => {
    for (let start = DAY_START; start < DAY_END; start += SLOT) {
      const end = start + SLOT;
      const slotRules = rules.filter(rule => rule.storeId === store.id && rule.start < end && rule.end > start);
      if (!slotRules.length) continue;
      const people = working
        .filter(item => item.startStoreId === store.id && item.start < end && item.end > start)
        .map(item => staff.find(person => person.id === item.staffId))
        .filter(Boolean)
        .filter((person, index, array) => array.findIndex(row => row.id === person.id) === index);

      const hardRules = slotRules.filter(rule => rule.mode === 'hard');
      const recommendedRules = slotRules.filter(rule => rule.mode !== 'hard');
      const hardAssignment = assignSeats(hardRules, people, new Set());
      const recommendedAssignment = assignSeats(recommendedRules, people, hardAssignment.usedStaff);
      const results = slotRules.map(rule => {
        const filled = (hardAssignment.byRule.get(rule.id) || 0) + (recommendedAssignment.byRule.get(rule.id) || 0);
        const result = { ruleId:rule.id, skillId:rule.skillId, minLevel:rule.minLevel, count:rule.count, mode:rule.mode, filled };
        const current = ruleWorst.get(rule.id);
        if (!current || filled / Math.max(1, rule.count) < current.filled / Math.max(1, current.count)) ruleWorst.set(rule.id, result);
        return result;
      });
      const hardGap = results.filter(row=>row.mode==='hard').reduce((sum,row)=>sum+Math.max(0,row.count-row.filled),0);
      const recGap = results.filter(row=>row.mode!=='hard').reduce((sum,row)=>sum+Math.max(0,row.count-row.filled),0);
      hardShortage += hardGap;
      recommendedShortage += recGap;
      slots.push({ storeId:store.id, start, end, ruleResults:results, hardShortage:hardGap, recommendedShortage:recGap });
    }
  });

  return { slots, ruleWorst, hardShortage, recommendedShortage };
}

function assignSeats(rules, people, reservedStaff) {
  const seats = [];
  rules.forEach(rule => {
    for (let i = 0; i < rule.count; i += 1) seats.push({ ruleId:rule.id, skillId:rule.skillId, minLevel:rule.minLevel, seat:i });
  });
  const available = people.filter(person => !reservedStaff.has(person.id));
  const eligible = seat => available
    .filter(person => levelOf(person, seat.skillId) >= seat.minLevel)
    .sort((a,b) => levelOf(b, seat.skillId) - levelOf(a, seat.skillId));
  const order = seats.map((seat,index)=>({index,count:eligible(seat).length,minLevel:seat.minLevel})).sort((a,b)=>a.count-b.count || b.minLevel-a.minLevel).map(row=>row.index);
  const staffToSeat = new Map();
  const seatToStaff = new Map();

  function trySeat(seatIndex, seen) {
    const seat = seats[seatIndex];
    for (const person of eligible(seat)) {
      if (seen.has(person.id)) continue;
      seen.add(person.id);
      const occupied = staffToSeat.get(person.id);
      if (occupied === undefined || trySeat(occupied, seen)) {
        staffToSeat.set(person.id, seatIndex);
        seatToStaff.set(seatIndex, person.id);
        return true;
      }
    }
    return false;
  }

  order.forEach(index => trySeat(index, new Set()));
  const byRule = new Map();
  seatToStaff.forEach((staffId, seatIndex) => {
    const ruleId = seats[seatIndex]?.ruleId;
    if (ruleId) byRule.set(ruleId, (byRule.get(ruleId) || 0) + 1);
  });
  return { byRule, usedStaff:new Set(staffToSeat.keys()) };
}

function workingIntervals(date) {
  const shifts = load(STORAGE_SHIFTS, {});
  const exceptions = load(STORAGE_EXCEPTIONS, {});
  const dayShifts = Array.isArray(shifts[date]) ? shifts[date] : [];
  const dayExceptions = Array.isArray(exceptions[date]) ? exceptions[date] : [];
  const absent = new Set(dayExceptions.filter(row=>row.type==='absence').map(row=>row.shiftId));
  const normal = dayShifts.filter(shift=>!absent.has(shift.id)).map(shift=>({ ...shift, staffId:canon(shift.staffId) }));
  const emergency = dayExceptions.filter(row=>row.type==='emergency_call').map(row=>({
    id:`emergency_${row.id}`,
    staffId:canon(row.staffId),
    startStoreId:row.startStoreId,
    start:Number(row.start),
    end:Number(row.end),
    emergency:true,
  }));
  return [...normal, ...emergency];
}

function renderPlannerBanner() {
  const banner = document.getElementById('requirements-planner-banner');
  if (!banner) return;
  const date = document.getElementById('work-date')?.value || selectedDate;
  const coverage = computeCoverage(date, '');
  if (!activeRulesForDate(date).length) {
    banner.className = 'req-planner-banner neutral';
    banner.innerHTML = '<i class="fa-solid fa-circle-info"></i> 人員・スキル条件が未設定です。';
    return;
  }
  if (coverage.hardShortage > 0) {
    banner.className = 'req-planner-banner shortage';
    banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 配置条件：必須不足 <strong>${coverage.hardShortage}枠</strong> <span>（30分単位・同一スタッフの二重配置なし）</span>`;
  } else {
    banner.className = 'req-planner-banner good';
    banner.innerHTML = '<i class="fa-solid fa-circle-check"></i> 配置条件：必須スキル人数を満たしています。';
  }
}

function applyAccess() {
  const access = window.shiftV2Access;
  const tab = document.querySelector('[data-view="requirements"]');
  if (tab) tab.style.display = access?.roleId === 'employee' ? 'none' : '';
  const add = document.getElementById('req-add');
  if (add) add.style.display = canEditRequirements() ? '' : 'none';
  document.querySelectorAll('#view-requirements [data-field]').forEach(control => control.disabled = !canEditRequirements());
}

function canEditRequirements() {
  return Boolean(window.shiftV2Access?.can?.('requirements.master.edit'));
}

function normalizeRequirements(rows) {
  return (Array.isArray(rows) ? rows : []).map((row,index) => ({
    id:String(row.id || `req_${index}`),
    storeId:String(row.storeId || 'matsuyama'),
    dayType:DAY_TYPES[row.dayType] ? row.dayType : 'all',
    specificDate:String(row.specificDate || ''),
    start:clampTime(row.start, 17*60),
    end:clampTime(row.end, 22*60),
    skillId:SKILL_DEFINITIONS.some(skill=>skill.id===row.skillId) ? row.skillId : SKILL_DEFINITIONS[0]?.id,
    minLevel:Math.max(1,Math.min(3,Number(row.minLevel)||1)),
    count:Math.max(1,Math.min(10,Number(row.count)||1)),
    mode:row.mode === 'recommended' ? 'recommended' : 'hard',
    active:row.active !== false,
    sample:row.sample === true,
  })).map(row => ({...row, end:row.end <= row.start ? Math.min(DAY_END,row.start+SLOT) : row.end}));
}

function normalizeStaff(rows) {
  return (Array.isArray(rows) ? rows : []).map(person => ({...person,id:canon(person.id || person.employeeNumber)})).filter(person=>person.id && person.active!==false);
}

function levelOf(person, skillId) {
  const direct = Number(person?.skillLevels?.[skillId]);
  if (Number.isFinite(direct)) return Math.max(0,Math.min(3,direct));
  const skill = SKILL_DEFINITIONS.find(row=>row.id===skillId);
  const legacy = Array.isArray(person?.skills) ? person.skills : [];
  return skill?.legacyNames?.some(name=>legacy.includes(name)) ? 1 : 0;
}

function allStaff() { return load(STORAGE_STAFF, []); }
function allStores() { return load(STORAGE_STORES, []); }
function skillName(id) { return SKILL_DEFINITIONS.find(skill=>skill.id===id)?.name || id; }
function storeOptions(selected) { return allStores().map(store=>`<option value="${esc(store.id)}" ${store.id===selected?'selected':''}>${esc(store.name)}</option>`).join(''); }
function timeOptions(selected) { let html=''; for(let minute=DAY_START;minute<=DAY_END;minute+=SLOT) html += `<option value="${minute}" ${minute===selected?'selected':''}>${fmtVerbose(minute)}</option>`; return html; }
function clampTime(value,fallback) { const n=Number(value); return Number.isFinite(n) ? Math.max(DAY_START,Math.min(DAY_END,n)) : fallback; }
function fmt(total) { const h=Math.floor(total/60)%24,m=total%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
function fmtVerbose(total) { return total>=1440 ? `翌 ${fmt(total)}` : fmt(total); }
function canon(value) { return String(value || '').toUpperCase(); }
function today() { const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function load(key,fallback) { try { const value=JSON.parse(localStorage.getItem(key)); return value ?? JSON.parse(JSON.stringify(fallback)); } catch { return JSON.parse(JSON.stringify(fallback)); } }
function esc(value) { return String(value ?? '').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char])); }
function notify(message) { const toast=document.getElementById('toast'); if(!toast)return; toast.textContent=message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),1800); }
function queueRender() { if(renderQueued)return; renderQueued=true; setTimeout(()=>{renderQueued=false; if(document.getElementById('view-requirements')) render();},60); }

function injectStyles() {
  if (document.getElementById('requirements-style')) return;
  const style = document.createElement('style');
  style.id = 'requirements-style';
  style.textContent = `
    .req-hero{padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px}.req-hero h2{font-size:16px;margin:0}.req-hero p{font-size:10px;color:#667085;margin:4px 0 0}.req-hero-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.req-sample-note{font-size:8px;font-weight:900;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;padding:5px 7px;border-radius:999px}.req-summary{grid-template-columns:repeat(4,minmax(0,1fr))}.req-coverage-card,.req-master-card{margin-bottom:10px}.req-head>div:first-child small{display:block;font-size:8px;color:#8a94a5;margin-top:2px}.req-filters{display:flex;gap:6px;align-items:center}.req-coverage{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:10px}.req-store-coverage{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}.req-store-title{padding:8px 10px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;font-size:10px}.req-good{color:#047857}.req-bad{color:#b42318}.req-slot-list{max-height:290px;overflow:auto}.req-slot-row{display:grid;grid-template-columns:76px 1fr 58px;gap:7px;align-items:center;padding:6px 8px;border-top:1px solid #eef2f6}.req-slot-time{font-size:8px;font-weight:900;color:#475467}.req-slot-badges{display:flex;gap:4px;flex-wrap:wrap}.req-coverage-chip{font-size:7px;font-weight:900;padding:2px 5px;border-radius:999px}.req-coverage-chip.ok{background:#ecfdf3;color:#027a48}.req-coverage-chip.bad{background:#fef3f2;color:#b42318}.req-coverage-chip.warn{background:#fffaeb;color:#b54708}.req-slot-status{font-size:8px;font-weight:900;text-align:center;padding:3px 5px;border-radius:999px}.req-slot-status.ok{background:#ecfdf3;color:#027a48}.req-slot-status.bad{background:#fef3f2;color:#b42318}.req-master-note{font-size:8px;color:#667085}.req-table{min-width:1160px}.req-table td{vertical-align:middle}.req-table select,.req-table input[type="date"],.req-table input[type="number"]{border:1px solid #d0d5dd;border-radius:6px;padding:5px;font-size:8px;background:#fff;max-width:150px}.req-table input[type="number"]{width:50px}.req-day-cell,.req-time-cell{display:flex;gap:4px;align-items:center}.req-time-cell select{width:68px}.req-day-cell{flex-direction:column;align-items:stretch}.req-mode.hard{color:#b42318;font-weight:900}.req-mode.recommended{color:#b54708;font-weight:900}.req-sample-chip{display:block;margin-top:3px;width:max-content;font-size:6px;padding:1px 4px;border-radius:999px;background:#fff7ed;color:#9a3412}.req-row-status{display:inline-block;min-width:40px;text-align:center;padding:3px 5px;border-radius:999px;font-size:8px;font-weight:900}.req-row-status.ok{background:#ecfdf3;color:#027a48}.req-row-status.bad{background:#fef3f2;color:#b42318}.req-row-status.warn{background:#fffaeb;color:#b54708}.req-row-status.muted{background:#f2f4f7;color:#667085}.req-delete{border:0;background:#fff;color:#b42318;padding:5px}.req-disabled{opacity:.5}.req-planner-banner{margin-bottom:8px;border-radius:9px;padding:8px 11px;font-size:9px;font-weight:800}.req-planner-banner span{font-weight:500}.req-planner-banner.shortage{background:#fef3f2;border:1px solid #fecdca;color:#b42318}.req-planner-banner.good{background:#ecfdf3;border:1px solid #abefc6;color:#027a48}.req-planner-banner.neutral{background:#f2f4f7;border:1px solid #e4e7ec;color:#475467}@media(max-width:900px){.req-coverage{grid-template-columns:1fr}.req-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.req-hero{align-items:flex-start;flex-direction:column}.req-summary{grid-template-columns:1fr}.req-filters{width:100%;flex-wrap:wrap}.req-slot-row{grid-template-columns:68px 1fr}.req-slot-status{grid-column:2}}
  `;
  document.head.appendChild(style);
}
