import { SKILL_DEFINITIONS } from '../data/shift-platform-config.js';
import { expandRulesToSlots, evaluateSlot, skillLevel as levelOf } from './shift-v2-coverage-core.js';

const STAFF_KEY = 'okk_shift_v2_staff';
const SHIFTS_KEY = 'okk_shift_v2_shifts';
const STORES_KEY = 'okk_shift_v2_config';
const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
const HOLIDAY_KEY = 'okk_shift_v2_holidays';
const EXCEPTIONS_KEY = 'okk_shift_v2_exceptions';
const SLOT = 30;
const DAY_START = 15 * 60;
const DAY_END = 30 * 60;
const FULLTIME_TARGET = 8 * 60;
const PARTTIME_TARGET = 5 * 60;

let currentDaily = null;
let currentMonth = null;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();
document.addEventListener('shiftv2-access', applyAccess);

function init() {
  injectUi();
  bind();
  applyAccess();
}

function injectUi() {
  const toolbar = document.querySelector('#view-planner .toolbar-left');
  if (toolbar && !document.getElementById('ai-v2-open')) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-v2-toolbar';
    wrap.innerHTML = '<button id="ai-v2-open" class="btn btn-green"><i class="fa-solid fa-wand-magic-sparkles"></i> AIシフト候補</button><span>スキル・人員条件から候補作成</span>';
    toolbar.appendChild(wrap);
  }

  if (!document.getElementById('ai-v2-modal')) {
    const modal = document.createElement('div');
    modal.id = 'ai-v2-modal';
    modal.className = 'ai-v2-bg';
    modal.innerHTML = `
      <div class="ai-v2-modal" role="dialog" aria-modal="true">
        <div class="ai-v2-head">
          <div><small>AI SHIFT CANDIDATE V2</small><h2>AIシフト候補</h2><span id="ai-v2-date-label"></span></div>
          <button id="ai-v2-close" class="btn btn-light btn-small"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="ai-v2-body">
          <div class="ai-v2-note"><i class="fa-solid fa-circle-info"></i><div><strong>既存シフトは変更しません。</strong><span>同じスタッフを同時刻の複数スキルへ二重カウントせず、不足枠だけ候補を作ります。</span></div></div>

          <section class="ai-v2-section">
            <div class="ai-v2-section-head"><div><strong>日次候補</strong><small id="ai-v2-daily-caption"></small></div><button id="ai-v2-daily-calc" class="btn btn-light"><i class="fa-solid fa-rotate"></i> 再計算</button></div>
            <label class="ai-v2-option"><input id="ai-v2-daily-soft" type="checkbox"> 推奨条件も対象にする</label>
            <div id="ai-v2-daily-summary" class="ai-v2-summary"></div>
            <div id="ai-v2-daily-body" class="ai-v2-list"></div>
            <div class="ai-v2-actions"><button id="ai-v2-daily-apply" class="btn btn-green"><i class="fa-solid fa-check"></i> 日次候補を反映</button></div>
          </section>

          <section class="ai-v2-section">
            <div class="ai-v2-section-head"><div><strong>月間候補</strong><small>休日・勤務可能条件・明示された上限を見ながら月全体を計算</small></div><div class="ai-v2-month-controls"><input id="ai-v2-month" class="control" type="month"><button id="ai-v2-month-calc" class="btn btn-light"><i class="fa-solid fa-calendar-check"></i> 月間候補を計算</button></div></div>
            <label class="ai-v2-option"><input id="ai-v2-month-soft" type="checkbox"> 推奨条件も対象にする</label>
            <div id="ai-v2-month-summary" class="ai-v2-summary"></div>
            <div id="ai-v2-month-body" class="ai-v2-list"></div>
            <div class="ai-v2-actions"><button id="ai-v2-month-apply" class="btn btn-green" disabled><i class="fa-solid fa-check-double"></i> 月間候補を一括反映</button></div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  injectStyles();
}

function bind() {
  document.getElementById('ai-v2-open')?.addEventListener('click', openModal);
  document.getElementById('ai-v2-close')?.addEventListener('click', closeModal);
  document.getElementById('ai-v2-modal')?.addEventListener('click', event => { if (event.target.id === 'ai-v2-modal') closeModal(); });
  document.getElementById('ai-v2-daily-calc')?.addEventListener('click', calculateDaily);
  document.getElementById('ai-v2-daily-soft')?.addEventListener('change', calculateDaily);
  document.getElementById('ai-v2-daily-apply')?.addEventListener('click', applyDaily);
  document.getElementById('ai-v2-month-calc')?.addEventListener('click', calculateMonth);
  document.getElementById('ai-v2-month-soft')?.addEventListener('change', calculateMonth);
  document.getElementById('ai-v2-month-apply')?.addEventListener('click', applyMonth);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
}

function openModal() {
  if (!canEdit()) return notify('AIシフト候補の作成・反映は本部のみです');
  const date = selectedDate();
  document.getElementById('ai-v2-date-label').textContent = formatDateJa(date);
  document.getElementById('ai-v2-daily-caption').textContent = formatDateJa(date);
  const monthInput = document.getElementById('ai-v2-month');
  if (monthInput && !monthInput.value) monthInput.value = date.slice(0,7);
  document.getElementById('ai-v2-modal')?.classList.add('open');
  calculateDaily();
}

function closeModal() {
  document.getElementById('ai-v2-modal')?.classList.remove('open');
}

function calculateDaily() {
  if (!canEdit()) return;
  currentDaily = buildDaily(selectedDate(), Boolean(document.getElementById('ai-v2-daily-soft')?.checked));
  renderDaily();
}

function buildDaily(date, includeSoft) {
  const staff = normalizeStaff(load(STAFF_KEY, []));
  const stores = normalizeStores(load(STORES_KEY, []));
  const rules = applicableRules(load(REQUIREMENTS_KEY, []), date).filter(rule => includeSoft || rule.mode === 'hard');
  const shiftMap = clone(load(SHIFTS_KEY, {}));
  const existing = Array.isArray(shiftMap[date]) ? shiftMap[date].map(normalizeShift) : [];
  const working = applyDayExceptions(date, existing);
  const proposals = [];
  const slotGroups = expandRulesToSlots(rules, SLOT);

  for (const group of slotGroups) {
    let guard = 0;
    while (guard++ < 30) {
      const evaluation = evaluateGroup(group, working, staff);
      const shortage = evaluation.results.filter(row => includeSoft || row.mode === 'hard').reduce((sum,row)=>sum+row.shortage,0);
      if (!shortage) break;
      const seat = chooseShortageSeat(group, evaluation);
      if (!seat) break;
      const candidate = chooseDailyCandidate({ date, seat, staff, working, proposals });
      if (!candidate) break;
      addOrExtendDailyProposal({ seat, candidate, working, proposals });
    }
  }

  const shortages = summarizeShortages(slotGroups, working, staff, includeSoft);
  return { date, staff, stores, rules, proposals, shortages };
}

function chooseDailyCandidate({ date, seat, staff, working, proposals }) {
  const fixedIds = new Set(working.filter(row => !row.aiCandidateV2).map(row => row.staffId));
  const candidates = staff.filter(person => {
    if (!person.id || person.active === false || person.autoAssign === false) return false;
    if (fixedIds.has(person.id)) return false;
    const own = proposals.find(row => row.staffId === person.id);
    if (own && own.startStoreId !== seat.storeId) return false;
    if (levelOf(person, seat.skillId) < seat.minLevel) return false;
    if (!storeAllowed(person, seat.storeId)) return false;
    if (!availableOn(person, date, seat.start, seat.end)) return false;
    if (!withinExplicitLimits(person, date, seat.start, seat.end, working, proposals, date.slice(0,7))) return false;
    return true;
  });
  candidates.sort((a,b) => scoreCandidate(b, seat, date, working, proposals) - scoreCandidate(a, seat, date, working, proposals) || String(a.name).localeCompare(String(b.name),'ja'));
  return candidates[0] || null;
}

function addOrExtendDailyProposal({ seat, candidate, working, proposals }) {
  let row = proposals.find(item => item.staffId === candidate.id && item.startStoreId === seat.storeId);
  if (!row) {
    const window = initialWindow(candidate, seat);
    row = {
      id:`aiv2_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,
      staffId:candidate.id,
      startStoreId:seat.storeId,
      start:window.start,
      end:window.end,
      memo:'AI候補',
      aiCandidateV2:true,
      aiReasons:[],
    };
    proposals.push(row);
    working.push(row);
  } else {
    const nextStart = Math.min(row.start, seat.start);
    const nextEnd = Math.max(row.end, seat.end);
    if (withinExplicitLimits(candidate, selectedDate(), nextStart, nextEnd, working.filter(x=>x.id!==row.id), proposals.filter(x=>x.id!==row.id), selectedDate().slice(0,7))) {
      row.start = Math.max(DAY_START, nextStart);
      row.end = Math.min(DAY_END, nextEnd);
    }
  }
  addReason(row, seat);
}

function calculateMonth() {
  if (!canEdit()) return;
  const month = document.getElementById('ai-v2-month')?.value || selectedDate().slice(0,7);
  currentMonth = buildMonth(month, Boolean(document.getElementById('ai-v2-month-soft')?.checked));
  renderMonth();
}

function buildMonth(month, includeSoft) {
  const staff = normalizeStaff(load(STAFF_KEY, []));
  const stores = normalizeStores(load(STORES_KEY, []));
  const requirements = load(REQUIREMENTS_KEY, []);
  const holidays = normalizeHoliday(load(HOLIDAY_KEY, {}));
  const shiftMap = clone(load(SHIFTS_KEY, {}));
  const workingMap = {};
  Object.entries(shiftMap).forEach(([date, rows]) => { workingMap[date] = Array.isArray(rows) ? rows.map(normalizeShift) : []; });
  const proposals = [];
  const days = daysInMonth(month);

  for (const date of days) {
    if (isCompanyClosure(holidays, date)) continue;
    if (!workingMap[date]) workingMap[date] = [];
    const fixed = applyDayExceptions(date, workingMap[date]);
    workingMap[date] = fixed;
    const rules = applicableRules(requirements, date).filter(rule => includeSoft || rule.mode === 'hard');
    const groups = expandRulesToSlots(rules, SLOT);

    for (const group of groups) {
      let guard = 0;
      while (guard++ < 30) {
        const evaluation = evaluateGroup(group, workingMap[date], staff);
        const shortage = evaluation.results.filter(row => includeSoft || row.mode === 'hard').reduce((sum,row)=>sum+row.shortage,0);
        if (!shortage) break;
        const seat = chooseShortageSeat(group, evaluation);
        if (!seat) break;
        const candidate = chooseMonthCandidate({ date, month, seat, staff, workingMap, proposals, holidays });
        if (!candidate) break;
        addOrExtendMonthProposal({ date, month, seat, candidate, workingMap, proposals });
      }
    }
  }

  const shortages = [];
  for (const date of days) {
    if (isCompanyClosure(holidays, date)) continue;
    const rules = applicableRules(requirements, date).filter(rule => includeSoft || rule.mode === 'hard');
    const rows = workingMap[date] || [];
    summarizeShortages(expandRulesToSlots(rules, SLOT), rows, staff, includeSoft).forEach(item => shortages.push({ date, ...item }));
  }

  const people = staff.map(person => {
    const rows = [];
    for (const date of days) (workingMap[date] || []).forEach(shift => { if (shift.staffId === person.id) rows.push({ date, ...shift }); });
    return {
      id:person.id,
      name:person.name,
      days:new Set(rows.map(row=>row.date)).size,
      minutes:rows.reduce((sum,row)=>sum+Math.max(0,row.end-row.start),0),
      generated:rows.filter(row=>row.aiMonthCandidateV2).length,
    };
  }).filter(row=>row.minutes || row.generated);

  return { month, staff, stores, proposals, shortages, people };
}

function chooseMonthCandidate({ date, month, seat, staff, workingMap, proposals, holidays }) {
  const rows = workingMap[date] || [];
  const fixedIds = new Set(rows.filter(row => !row.aiMonthCandidateV2).map(row => row.staffId));
  const candidates = staff.filter(person => {
    if (!person.id || person.active === false || person.autoAssign === false) return false;
    if (fixedIds.has(person.id)) return false;
    const own = rows.find(row => row.staffId === person.id && row.aiMonthCandidateV2);
    if (own && own.startStoreId !== seat.storeId) return false;
    if (levelOf(person, seat.skillId) < seat.minLevel) return false;
    if (!storeAllowed(person, seat.storeId)) return false;
    if (isUnavailable(holidays, person.id, date)) return false;
    if (!availableOn(person, date, seat.start, seat.end)) return false;
    if (!withinExplicitLimitsMonth(person, date, month, seat.start, seat.end, workingMap)) return false;
    return true;
  });
  candidates.sort((a,b)=>scoreMonth(b,date,seat,workingMap,month)-scoreMonth(a,date,seat,workingMap,month)||String(a.name).localeCompare(String(b.name),'ja'));
  return candidates[0] || null;
}

function addOrExtendMonthProposal({ date, month, seat, candidate, workingMap, proposals }) {
  let row = (workingMap[date] || []).find(item => item.staffId === candidate.id && item.aiMonthCandidateV2 && item.startStoreId === seat.storeId);
  if (!row) {
    const window = initialWindow(candidate, seat);
    row = {
      id:`aimv2_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,
      staffId:candidate.id,
      startStoreId:seat.storeId,
      start:window.start,
      end:window.end,
      memo:'月間AI候補',
      aiMonthCandidateV2:true,
      aiCandidateV2:true,
      aiReasons:[],
    };
    workingMap[date].push(row);
    proposals.push({ date, ...row });
  } else {
    const nextStart = Math.min(row.start, seat.start);
    const nextEnd = Math.max(row.end, seat.end);
    const copy = (workingMap[date] || []).filter(item => item.id !== row.id);
    const tempMap = { ...workingMap, [date]: copy };
    if (withinExplicitLimitsMonth(candidate, date, month, nextStart, nextEnd, tempMap)) {
      row.start = Math.max(DAY_START, nextStart);
      row.end = Math.min(DAY_END, nextEnd);
      const proposal = proposals.find(item => item.id === row.id);
      if (proposal) { proposal.start = row.start; proposal.end = row.end; }
    }
  }
  addReason(row, seat);
  const proposal = proposals.find(item => item.id === row.id);
  if (proposal) { proposal.aiReasons = [...row.aiReasons]; proposal.memo = row.memo; }
}

function evaluateGroup(group, working, staff) {
  const people = activePeople(group, working, staff);
  return evaluateSlot({ rules:group.rules, people, levelOf });
}

function activePeople(group, working, staff) {
  const ids = new Set((working || [])
    .filter(row => row.startStoreId === group.storeId && row.start < group.end && row.end > group.start)
    .map(row => row.staffId));
  return [...ids].map(id => staff.find(person => person.id === id)).filter(Boolean);
}

function chooseShortageSeat(group, evaluation) {
  const shortageRows = evaluation.results.filter(row => row.shortage > 0).sort((a,b) => {
    if (a.mode !== b.mode) return a.mode === 'hard' ? -1 : 1;
    if (a.minLevel !== b.minLevel) return b.minLevel - a.minLevel;
    return String(a.skillId).localeCompare(String(b.skillId));
  });
  const result = shortageRows[0];
  if (!result) return null;
  return { storeId:group.storeId, start:group.start, end:group.end, skillId:result.skillId, minLevel:result.minLevel, mode:result.mode };
}

function summarizeShortages(groups, working, staff, includeSoft) {
  const out = [];
  for (const group of groups) {
    const evaluation = evaluateGroup(group, working, staff);
    evaluation.results.filter(row => row.shortage > 0 && (includeSoft || row.mode === 'hard')).forEach(row => {
      out.push({ storeId:group.storeId, start:group.start, end:group.end, ...row });
    });
  }
  return out;
}

function withinExplicitLimits(person, date, start, end, working, proposals, month) {
  const c = person.workConstraints || {};
  const dailyMax = finite(person.maxDailyMinutes ?? c.maxDailyMinutes);
  const weeklyMax = finite(person.maxWeeklyMinutes ?? c.maxWeeklyMinutes);
  const monthlyMax = finite(person.maxMonthlyMinutes ?? person.monthlyHourCapMinutes ?? c.maxMonthlyMinutes);
  const maxDays = finite(c.maxDaysPerWeek);
  const prospective = Math.max(0, end - start);
  if (dailyMax !== null && prospective > dailyMax) return false;

  const all = combineCurrentRows(date, working, proposals);
  if (weeklyMax !== null) {
    const range = weekRange(date);
    const week = minutesForPerson(person.id, all, d => d >= range.start && d <= range.end && d !== date);
    if (week + prospective > weeklyMax) return false;
  }
  if (monthlyMax !== null) {
    const mon = minutesForPerson(person.id, all, d => d.startsWith(month) && d !== date);
    if (mon + prospective > monthlyMax) return false;
  }
  if (maxDays !== null && workedDays(person.id, all, weekRange(date)) >= maxDays) return false;
  return true;
}

function withinExplicitLimitsMonth(person, date, month, start, end, workingMap) {
  const c = person.workConstraints || {};
  const dailyMax = finite(person.maxDailyMinutes ?? c.maxDailyMinutes);
  const weeklyMax = finite(person.maxWeeklyMinutes ?? c.maxWeeklyMinutes);
  const monthlyMax = finite(person.maxMonthlyMinutes ?? person.monthlyHourCapMinutes ?? c.maxMonthlyMinutes);
  const maxDays = finite(c.maxDaysPerWeek);
  const own = (workingMap[date] || []).find(row => row.staffId === person.id && row.aiMonthCandidateV2);
  const prospective = own ? Math.max(own.end, end) - Math.min(own.start, start) : end - start;
  if (dailyMax !== null && prospective > dailyMax) return false;

  const range = weekRange(date);
  let weekly = 0;
  let monthly = 0;
  const days = new Set();
  Object.entries(workingMap).forEach(([d, rows]) => {
    if (!Array.isArray(rows)) return;
    const ownRows = rows.filter(row => row.staffId === person.id);
    if (!ownRows.length) return;
    if (d >= range.start && d <= range.end && d !== date) weekly += ownRows.reduce((s,row)=>s+Math.max(0,row.end-row.start),0);
    if (d.startsWith(month) && d !== date) monthly += ownRows.reduce((s,row)=>s+Math.max(0,row.end-row.start),0);
    if (d >= range.start && d <= range.end && d !== date) days.add(d);
  });
  if (weeklyMax !== null && weekly + prospective > weeklyMax) return false;
  if (monthlyMax !== null && monthly + prospective > monthlyMax) return false;
  if (maxDays !== null && !own && days.size >= maxDays) return false;
  return true;
}

function combineCurrentRows(date, working, proposals) {
  const base = clone(load(SHIFTS_KEY, {}));
  base[date] = [...(working || []), ...(proposals || []).filter(p => !(working || []).some(w=>w.id===p.id))];
  return base;
}

function minutesForPerson(staffId, map, dateFilter) {
  let total = 0;
  Object.entries(map).forEach(([date, rows]) => {
    if (!dateFilter(date) || !Array.isArray(rows)) return;
    rows.forEach(row => { if (canon(row.staffId) === staffId) total += Math.max(0, Number(row.end)-Number(row.start)); });
  });
  return total;
}

function workedDays(staffId, map, range) {
  const dates = new Set();
  Object.entries(map).forEach(([date, rows]) => {
    if (date < range.start || date > range.end || !Array.isArray(rows)) return;
    if (rows.some(row=>canon(row.staffId)===staffId)) dates.add(date);
  });
  return dates.size;
}

function initialWindow(person, seat) {
  const fulltime = (person.employmentType || '') === '正社員' || person.salaryType === 'monthly';
  const target = fulltime ? FULLTIME_TARGET : PARTTIME_TARGET;
  let start = seat.start;
  let end = Math.min(DAY_END, Math.max(seat.end, start + target));
  const c = person.workConstraints || {};
  const availableStart = finite(c.availableStart);
  const availableEnd = finite(c.availableEnd);
  if (availableStart !== null) start = Math.max(start, availableStart);
  if (availableEnd !== null) end = Math.min(end, availableEnd);
  if (end <= start) end = Math.min(DAY_END, start + SLOT);
  return { start:snap(start), end:snap(end) };
}

function addReason(row, seat) {
  row.aiReasons = Array.isArray(row.aiReasons) ? row.aiReasons : [];
  const reason = `${skillName(seat.skillId)} Lv${seat.minLevel} ${fmt(seat.start)}-${fmt(seat.end)}`;
  if (!row.aiReasons.includes(reason)) row.aiReasons.push(reason);
  row.memo = `${row.aiMonthCandidateV2 ? '月間AI候補' : 'AI候補'}: ${row.aiReasons.slice(0,4).join(' / ')}`;
}

function applyDaily() {
  if (!canEdit() || !currentDaily?.proposals?.length) return;
  const map = load(SHIFTS_KEY, {});
  const rows = Array.isArray(map[currentDaily.date]) ? map[currentDaily.date] : [];
  const occupied = new Set(rows.map(row=>canon(row.staffId)));
  const add = currentDaily.proposals.filter(row=>!occupied.has(row.staffId)).map(row=>({
    id:row.id, staffId:row.staffId, startStoreId:row.startStoreId, start:row.start, end:row.end,
    memo:row.memo, aiGenerated:true, aiSource:'candidate-v2', aiGeneratedAt:new Date().toISOString(), source:'ai_candidate_v2', aiReasons:row.aiReasons,
  }));
  map[currentDaily.date] = [...rows, ...add];
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(map));
  notify(`${add.length}件のAI候補を予定シフトへ反映しました`);
  closeModal();
  location.reload();
}

function applyMonth() {
  if (!canEdit() || !currentMonth?.proposals?.length) return;
  const map = load(SHIFTS_KEY, {});
  let count = 0;
  currentMonth.proposals.forEach(proposal => {
    const rows = Array.isArray(map[proposal.date]) ? map[proposal.date] : [];
    if (rows.some(row=>canon(row.staffId)===proposal.staffId)) return;
    rows.push({
      id:proposal.id, staffId:proposal.staffId, startStoreId:proposal.startStoreId, start:proposal.start, end:proposal.end,
      memo:proposal.memo, aiGenerated:true, aiSource:'monthly-v2', aiGeneratedAt:new Date().toISOString(), source:'ai_month_v2', aiReasons:proposal.aiReasons,
    });
    map[proposal.date] = rows;
    count += 1;
  });
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(map));
  notify(`${count}件の月間AI候補を予定シフトへ反映しました`);
  closeModal();
  location.reload();
}

function renderDaily() {
  const summary = document.getElementById('ai-v2-daily-summary');
  const body = document.getElementById('ai-v2-daily-body');
  const apply = document.getElementById('ai-v2-daily-apply');
  if (!summary || !body || !currentDaily) return;
  const hard = currentDaily.shortages.filter(row=>row.mode==='hard').reduce((s,row)=>s+row.shortage,0);
  const soft = currentDaily.shortages.filter(row=>row.mode!=='hard').reduce((s,row)=>s+row.shortage,0);
  summary.innerHTML = metric('候補', `${currentDaily.proposals.length}名`) + metric('必須不足', `${hard}枠`) + metric('推奨不足', `${soft}枠`);
  body.innerHTML = currentDaily.proposals.length ? currentDaily.proposals.map(row => {
    const person = currentDaily.staff.find(p=>p.id===row.staffId);
    return `<div class="ai-v2-row"><div><strong>${esc(person?.name || row.staffId)}</strong><span>${esc(storeName(row.startStoreId,currentDaily.stores))} ${fmt(row.start)}-${fmt(row.end)}</span></div><small>${esc((row.aiReasons||[]).join(' / '))}</small></div>`;
  }).join('') : '<div class="ai-v2-empty">追加候補はありません。</div>';
  if (hard || soft) body.insertAdjacentHTML('beforeend', `<div class="ai-v2-warning">未解消の不足があります。必須 ${hard}枠 / 推奨 ${soft}枠</div>`);
  apply.disabled = !currentDaily.proposals.length;
}

function renderMonth() {
  const summary = document.getElementById('ai-v2-month-summary');
  const body = document.getElementById('ai-v2-month-body');
  const apply = document.getElementById('ai-v2-month-apply');
  if (!summary || !body || !currentMonth) return;
  const hard = currentMonth.shortages.filter(row=>row.mode==='hard').reduce((s,row)=>s+row.shortage,0);
  const dates = new Set(currentMonth.proposals.map(row=>row.date));
  summary.innerHTML = metric('候補', `${currentMonth.proposals.length}件`) + metric('対象日', `${dates.size}日`) + metric('必須不足', `${hard}枠`) + metric('対象スタッフ', `${currentMonth.people.length}名`);

  const grouped = new Map();
  currentMonth.proposals.forEach(row => { if (!grouped.has(row.date)) grouped.set(row.date, []); grouped.get(row.date).push(row); });
  body.innerHTML = grouped.size ? [...grouped.entries()].sort().map(([date, rows]) => `<div class="ai-v2-day"><strong>${esc(formatDateShort(date))}</strong><div>${rows.map(row=>{const p=currentMonth.staff.find(x=>x.id===row.staffId);return `<span class="ai-v2-chip">${esc(p?.name||row.staffId)} ${fmt(row.start)}-${fmt(row.end)}</span>`;}).join('')}</div></div>`).join('') : '<div class="ai-v2-empty">追加候補はありません。</div>';
  if (hard) body.insertAdjacentHTML('beforeend', `<div class="ai-v2-warning">月間候補でも必須不足が ${hard}枠 残っています。</div>`);
  apply.disabled = !currentMonth.proposals.length;
}

function metric(label, value) { return `<div class="ai-v2-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`; }

function scoreCandidate(person, seat, date, working, proposals) {
  let score = levelOf(person, seat.skillId) * 120;
  if (person.mainStoreId === seat.storeId) score += 35;
  if ((person.affiliationStoreIds || []).includes(seat.storeId)) score += 20;
  if (proposals.some(row=>row.staffId===person.id&&row.startStoreId===seat.storeId)) score += 70;
  const preferred = finite(person.workConstraints?.preferredDaysPerWeek);
  if (preferred !== null) {
    const map = combineCurrentRows(date, working, proposals);
    const days = workedDays(person.id, map, weekRange(date));
    if (days < preferred) score += 15;
  }
  return score;
}

function scoreMonth(person, date, seat, workingMap, month) {
  let score = levelOf(person, seat.skillId) * 120;
  if (person.mainStoreId === seat.storeId) score += 40;
  if ((person.affiliationStoreIds || []).includes(seat.storeId)) score += 20;
  if ((workingMap[date] || []).some(row=>row.staffId===person.id&&row.aiMonthCandidateV2)) score += 90;
  const monthDays = new Set(Object.entries(workingMap).filter(([d,rows])=>d.startsWith(month)&&Array.isArray(rows)&&rows.some(row=>row.staffId===person.id)).map(([d])=>d)).size;
  score -= monthDays * 4;
  return score;
}

function applicableRules(rules, date) { return (Array.isArray(rules)?rules:[]).filter(rule=>rule.active!==false && matchesDate(rule,date)); }
function matchesDate(rule, date) { if (rule.dayType==='specific') return rule.specificDate===date; if (rule.dayType==='all') return true; const d=new Date(`${date}T00:00:00`).getDay(); if(rule.dayType==='mon_thu')return d>=1&&d<=4; if(rule.dayType==='fri_sat')return d===5||d===6; if(rule.dayType==='sun')return d===0; return true; }

function applyDayExceptions(date, rows) {
  const exceptions = load(EXCEPTIONS_KEY, {});
  const day = Array.isArray(exceptions[date]) ? exceptions[date] : [];
  const absentShiftIds = new Set(day.filter(row=>row.type==='absence').map(row=>row.shiftId).filter(Boolean));
  const absentStaffIds = new Set(day.filter(row=>row.type==='absence').map(row=>canon(row.staffId)).filter(Boolean));
  const normal = (rows || []).filter(row=>!absentShiftIds.has(row.id) && !absentStaffIds.has(row.staffId));
  const emergency = day.filter(row=>row.type==='emergency_call').map(row=>normalizeShift({ id:`emergency_${row.id}`, staffId:row.staffId, startStoreId:row.startStoreId, start:row.start, end:row.end }));
  return [...normal, ...emergency];
}

function availableOn(person, date, start, end) {
  const c = person.workConstraints || {};
  const day = String(new Date(`${date}T00:00:00`).getDay());
  if (Array.isArray(c.availableDays) && c.availableDays.length && !c.availableDays.map(String).includes(day)) return false;
  if (Array.isArray(c.fixedOffDays) && c.fixedOffDays.map(String).includes(day)) return false;
  const a = finite(c.availableStart), b = finite(c.availableEnd);
  if (a !== null && start < a) return false;
  if (b !== null && end > b) return false;
  return true;
}

function storeAllowed(person, storeId) { const allowed = Array.isArray(person.placementStoreIds)&&person.placementStoreIds.length?person.placementStoreIds:Array.isArray(person.affiliationStoreIds)?person.affiliationStoreIds:[]; return !allowed.length || allowed.includes(storeId); }
function normalizeStaff(rows) { return (Array.isArray(rows)?rows:[]).map(row=>({ ...row, id:canon(row.id||row.staffId), name:row.name||row.staffName||row.id||row.staffId, skillLevels:row.skillLevels||{}, workConstraints:row.workConstraints||{} })); }
function normalizeStores(value) { const rows = Array.isArray(value)?value:Array.isArray(value?.stores)?value.stores:[]; return rows.map(row=>({id:row.id,name:row.name||row.id})); }
function normalizeShift(row) { return { ...row, staffId:canon(row.staffId), startStoreId:row.startStoreId||row.storeId||'', start:Number(row.start), end:Number(row.end) }; }
function normalizeHoliday(value) { const x=value&&typeof value==='object'?value:{}; return { companyClosures:Array.isArray(x.companyClosures)?x.companyClosures:[], staffDays:Array.isArray(x.staffDays)?x.staffDays:[] }; }
function isCompanyClosure(holiday,date){return holiday.companyClosures.some(row=>row.date===date);}
function isUnavailable(holiday,staffId,date){return holiday.staffDays.some(row=>canon(row.staffId)===staffId&&row.date===date&&(row.type==='off'||row.type==='paid_leave'));}
function daysInMonth(month){const [y,m]=month.split('-').map(Number);const last=new Date(y,m,0).getDate();return Array.from({length:last},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);}
function weekRange(date){const d=new Date(`${date}T00:00:00`);const day=d.getDay();const diff=day===0?-6:1-day;const start=new Date(d);start.setDate(d.getDate()+diff);const end=new Date(start);end.setDate(start.getDate()+6);return {start:iso(start),end:iso(end)};}
function selectedDate(){return document.getElementById('work-date')?.value || iso(new Date());}
function skillName(id){return SKILL_DEFINITIONS.find(row=>row.id===id)?.name || id;}
function storeName(id,stores){return stores.find(row=>row.id===id)?.name||id;}
function finite(value){const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?null:n;}
function snap(n){return Math.round(Number(n)/SLOT)*SLOT;}
function fmt(minutes){const m=Number(minutes);const h=Math.floor(m/60)%24;return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
function iso(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function formatDateJa(date){const d=new Date(`${date}T00:00:00`);return `${d.getMonth()+1}月${d.getDate()}日`;}
function formatDateShort(date){return `${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;}
function canon(value){return String(value||'').trim().toLowerCase();}
function clone(value){return JSON.parse(JSON.stringify(value||{}));}
function load(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value??clone(fallback);}catch{return clone(fallback);}}
function esc(value){return String(value??'').replace(/[&<>\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[ch]));}
function canEdit(){return window.shiftV2Access?.can?.('shift.plan.edit') ?? true;}
function notify(message){const toast=document.getElementById('toast');if(!toast)return window.alert(message);toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200);}

function applyAccess(){const button=document.getElementById('ai-v2-open');if(button)button.style.display=canEdit()?'':'none';if(!canEdit())closeModal();}

function injectStyles(){
  if(document.getElementById('ai-v2-style'))return;
  const style=document.createElement('style');style.id='ai-v2-style';style.textContent=`
    .ai-v2-toolbar{display:flex;align-items:center;gap:6px}.ai-v2-toolbar span{font-size:8px;color:#667085}.ai-v2-bg{display:none;position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.46);padding:28px;overflow:auto}.ai-v2-bg.open{display:block}.ai-v2-modal{max-width:940px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 24px 70px rgba(15,23,42,.25);overflow:hidden}.ai-v2-head{display:flex;justify-content:space-between;align-items:flex-start;padding:16px 18px;border-bottom:1px solid #eaecf0}.ai-v2-head small{font-size:7px;color:#667085;font-weight:900}.ai-v2-head h2{font-size:16px;margin:2px 0}.ai-v2-head span{font-size:9px;color:#667085}.ai-v2-body{padding:14px 16px}.ai-v2-note{display:flex;gap:8px;padding:10px 12px;border:1px solid #dbeafe;background:#eff6ff;border-radius:9px;color:#1d4ed8}.ai-v2-note strong,.ai-v2-note span{display:block}.ai-v2-note strong{font-size:10px}.ai-v2-note span{font-size:8px;margin-top:2px}.ai-v2-section{margin-top:14px;padding-top:14px;border-top:1px solid #eaecf0}.ai-v2-section-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.ai-v2-section-head strong{font-size:12px}.ai-v2-section-head small{display:block;font-size:8px;color:#667085;margin-top:2px}.ai-v2-month-controls{display:flex;gap:6px;align-items:center}.ai-v2-option{display:block;margin:8px 0;font-size:9px;color:#475467}.ai-v2-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:8px 0}.ai-v2-metric{border:1px solid #eaecf0;border-radius:8px;padding:8px;background:#fcfcfd}.ai-v2-metric small{display:block;font-size:7px;color:#667085}.ai-v2-metric strong{font-size:15px}.ai-v2-list{border:1px solid #eaecf0;border-radius:9px;overflow:hidden}.ai-v2-row,.ai-v2-day{padding:8px 10px;border-bottom:1px solid #f2f4f7}.ai-v2-row:last-child,.ai-v2-day:last-child{border-bottom:0}.ai-v2-row>div{display:flex;gap:10px;align-items:center}.ai-v2-row strong{font-size:10px}.ai-v2-row span,.ai-v2-row small{font-size:8px;color:#667085}.ai-v2-row small{display:block;margin-top:3px}.ai-v2-day{display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:start}.ai-v2-day>strong{font-size:9px}.ai-v2-chip{display:inline-block;margin:1px 3px 2px 0;padding:3px 6px;border-radius:999px;background:#eef4ff;color:#3538cd;font-size:8px;font-weight:800}.ai-v2-empty{padding:18px;text-align:center;color:#98a2b3;font-size:9px}.ai-v2-warning{padding:8px 10px;background:#fffaeb;color:#b54708;font-size:8px}.ai-v2-actions{display:flex;justify-content:flex-end;margin-top:8px}@media(max-width:760px){.ai-v2-bg{padding:10px}.ai-v2-section-head{align-items:flex-start;flex-direction:column}.ai-v2-summary{grid-template-columns:1fr 1fr}.ai-v2-month-controls{width:100%}}
  `;document.head.appendChild(style);
}
