(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const STORES_KEY = 'okk_shift_v2_config';
  const PLAN_KEY = 'okk_shift_v2_work_plans';
  const AGREEMENT_KEY = 'okk_shift_v2_36_agreement';
  const APPROVAL_KEY = 'okk_shift_v2_overtime_exceptions';
  const AUDIT_KEY = 'okk_shift_v2_audit_v1';
  const DEMO_KEY = 'okk_shift_v2_demo_mode';
  const CLOUD_SHIFTS = 'shiftV2Shifts';
  const CLOUD_HOLIDAYS = 'shiftV2Holidays';
  const MONTH_SOURCE = 'v2-month-builder';
  const BASE_SOURCE = 'v2-prescribed-base';
  const EMERGENCY_SOURCE = 'v2-b-emergency-call';
  const SLOT = 30;
  const BINDING_FULL_TIME = 9 * 60;
  const DAILY_REGULAR = 8 * 60;
  const WEEKLY_REGULAR = 40 * 60;
  const DEFAULT_INTERNAL_CAP = 30;
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店', close:30*60, autoJoin:false, joinTarget:'' },
    { id:'kumoji', name:'久茂地店', close:25*60, autoJoin:true, joinTarget:'matsuyama' },
    { id:'miebashi', name:'美栄橋店', close:25*60, autoJoin:true, joinTarget:'matsuyama' },
    { id:'misato', name:'美里店', close:26*60, autoJoin:false, joinTarget:'' },
  ];

  let basePreview = null;
  let currentPreview = null;
  let currentMonth = '';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    basePreview = window.shiftV2MonthBuilderEnhanced?.preview;
    if (typeof basePreview !== 'function') return;
    takeover('month-builder-open', openModal);
    takeover('month-builder-calc', calculate);
    takeover('month-builder-month', calculate, 'change');
    takeover('month-builder-auto-off', calculate, 'change');
    takeover('month-builder-soft', calculate, 'change');
    takeover('month-builder-apply', applyPreview);
    takeover('month-builder-clear', clearMonthAuto);
    window.shiftV2MonthBuilderFinal = { preview: buildFinal, emergencySource: EMERGENCY_SOURCE };
  }

  function takeover(id, handler, eventName = 'click') {
    const node = document.getElementById(id);
    if (!node) return;
    const clone = node.cloneNode(true);
    node.replaceWith(clone);
    clone.addEventListener(eventName, handler);
  }

  function openModal() {
    const selected = document.getElementById('work-date')?.value;
    currentMonth = selected?.slice(0,7) || monthKey(new Date());
    const input = document.getElementById('month-builder-month');
    if (input) input.value = currentMonth;
    document.getElementById('month-builder-modal')?.classList.add('open');
    calculate();
  }

  function calculate() {
    currentMonth = document.getElementById('month-builder-month')?.value || currentMonth || monthKey(new Date());
    currentPreview = buildFinal(currentMonth, {
      autoOff: document.getElementById('month-builder-auto-off')?.checked !== false,
      includeSoft: Boolean(document.getElementById('month-builder-soft')?.checked),
    });
    render(currentPreview);
  }

  function buildFinal(month, options = {}) {
    const rawShifts = localStorage.getItem(SHIFTS_KEY);
    const sanitized = removeSource(readJson(SHIFTS_KEY, {}), month, EMERGENCY_SOURCE);
    let result;
    try {
      localStorage.setItem(SHIFTS_KEY, JSON.stringify(sanitized));
      result = basePreview(month, options);
    } finally {
      restoreRaw(SHIFTS_KEY, rawShifts);
    }

    const staff = loadStaff();
    const stores = loadStores();
    const requirements = readArray(REQUIREMENTS_KEY);
    const skills = readArray(SKILLS_KEY);
    const plans = readJson(PLAN_KEY, {});
    const agreement = readJson(AGREEMENT_KEY, {});
    const approvals = readArray(APPROVAL_KEY);
    const audit = readJson(AUDIT_KEY, {});
    const context = { month, staff, stores, requirements, skills, plans, agreement, approvals, audit, holiday: result.holiday, shifts: result.shifts, options };
    const calls = [];

    staff.filter(person => person.active !== false && person.employmentType === '正社員' && person.workPlanId === 'B').forEach(person => {
      const target = Math.max(0, Number(plans?.B?.emergencyCallTarget ?? 2));
      const already = countEmergency(context.shifts, person.id, month);
      const usedWeeks = new Set(emergencyDates(context.shifts, person.id, month).map(weekKey));
      for (let i = already; i < target; i += 1) {
        const selected = chooseEmergency(context, person, usedWeeks);
        if (!selected) break;
        const shift = makeEmergencyShift(context, person, selected.date, selected.assignment);
        if (!Array.isArray(context.shifts[selected.date])) context.shifts[selected.date] = [];
        context.shifts[selected.date].push(shift);
        calls.push({ ...shift, date: selected.date });
        usedWeeks.add(weekKey(selected.date));
      }
    });

    result.emergency = [...(result.emergency || []), ...calls];
    result.proposals = [...(result.proposals || []), ...calls];
    result.employeeProposals = [...(result.employeeProposals || []), ...calls];
    result.bEmergencyCalls = calls;
    result.shortages = calculateShortages(context);
    result.people = (result.people || []).map(item => {
      const person = staff.find(row => row.id === String(item.staffId || '').toUpperCase());
      const target = person?.workPlanId === 'B' ? Math.max(0, Number(plans?.B?.emergencyCallTarget ?? 2)) : 0;
      return {
        ...item,
        shifts: workDaysInMonth(context.shifts, item.staffId, month),
        overtimeMinutes: plannedOvertimeForMonth(context.shifts, item.staffId, month),
        emergency: countEmergency(context.shifts, item.staffId, month),
        emergencyTarget: target,
      };
    });

    const bPeople = staff.filter(person => person.active !== false && person.employmentType === '正社員' && person.workPlanId === 'B');
    bPeople.forEach(person => {
      const target = Math.max(0, Number(plans?.B?.emergencyCallTarget ?? 2));
      const actual = countEmergency(context.shifts, person.id, month);
      if (actual < target) {
        result.notes = [...(result.notes || []), `${person.name || person.id}：Bプラン臨時招集 ${actual}/${target}回。公休・勤務可能条件・残業上限・不足状況を優先したため未達です。`];
      }
    });
    return result;
  }

  function chooseEmergency(context, person, usedWeeks) {
    const offDates = holidayRecords(context.holiday, person.id, context.month, 'off').map(item => item.date);
    const baseOt = plannedOvertimeForMonth(context.shifts, person.id, context.month);
    const candidates = [];

    offDates.forEach(date => {
      if (isConfirmed(context.audit, date) || hasShift(context.shifts, person.id, date) || !dayConstraintAllows(person, date)) return;
      if (weekWorkDays(context.shifts, person.id, date) >= maxDaysPerWeek(person)) return;
      const assignment = chooseAssignment(context, person, date);
      if (!assignment || assignment.coverage <= 0) return;
      const test = clone(context.shifts);
      if (!Array.isArray(test[date])) test[date] = [];
      test[date].push({ staffId:person.id, startStoreId:assignment.startStoreId, start:assignment.start, end:assignment.end });
      const nextOt = plannedOvertimeForMonth(test, person.id, context.month);
      const cap = allowedOvertimeHours(context, person);
      if (nextOt > cap * 60 + 0.001) return;
      const weekDays = weekWorkDays(context.shifts, person.id, date);
      const deltaOt = Math.max(0, nextOt - baseOt);
      let score = assignment.coverage * 100;
      score += weekDays >= 5 ? 2500 : weekDays === 4 ? 500 : 0;
      score += deltaOt / 60 * 180;
      if (!usedWeeks.has(weekKey(date))) score += 450;
      if (new Date(`${date}T00:00:00`).getDay() === 5 || new Date(`${date}T00:00:00`).getDay() === 6) score += 40;
      candidates.push({ date, assignment, score, deltaOt });
    });

    candidates.sort((a,b) => Number(b.deltaOt > 0) - Number(a.deltaOt > 0) || b.score - a.score || a.date.localeCompare(b.date));
    return candidates[0] || null;
  }

  function chooseAssignment(context, person, date) {
    const availableStart = numberOr(person.workConstraints?.availableStart, 16*60);
    const availableEnd = numberOr(person.workConstraints?.availableEnd, 30*60);
    if (availableEnd - availableStart < BINDING_FULL_TIME) return null;
    const rules = applicableRules(context.requirements, context.skills, date, context.options.includeSoft);
    const candidates = [];

    allowedStores(person, context.stores).forEach(storeId => {
      const store = context.stores.find(item => item.id === storeId);
      if (!store) return;
      const storeRules = rules.filter(rule => rule.storeId === storeId);
      const earliest = storeRules.length ? Math.min(...storeRules.map(rule => Number(rule.start))) : 17*60;
      let latest = storeRules.length ? Math.max(...storeRules.map(rule => Number(rule.end))) : Number(store.close || 26*60);
      if (store.autoJoin && store.joinTarget) {
        const joinRules = rules.filter(rule => rule.storeId === store.joinTarget);
        if (joinRules.length) latest = Math.max(latest, ...joinRules.map(rule => Number(rule.end)));
      }
      const starts = new Set([
        snap(Math.max(availableStart, Math.min(earliest, availableEnd - BINDING_FULL_TIME))),
        snap(Math.max(availableStart, Math.min(latest - BINDING_FULL_TIME, availableEnd - BINDING_FULL_TIME))),
      ]);
      if (store.autoJoin) starts.add(snap(Math.max(availableStart, Math.min(21*60, availableEnd - BINDING_FULL_TIME))));
      starts.forEach(start => {
        const end = start + BINDING_FULL_TIME;
        if (start < availableStart || end > availableEnd) return;
        const trial = { staffId:person.id, startStoreId:storeId, start, end };
        const coverage = shortageCoverage(context, person, date, trial, rules);
        candidates.push({ startStoreId:storeId, start, end, coverage, score:coverage * 100 + (person.mainStoreId === storeId ? 80 : 0) });
      });
    });
    candidates.sort((a,b) => b.score - a.score || a.start - b.start);
    return candidates[0] || null;
  }

  function shortageCoverage(context, person, date, shift, rules) {
    const segments = deriveSegments(shift, context.stores);
    let score = 0;
    rules.forEach(rule => {
      if (skillLevel(person, rule.skillId) < Number(rule.minLevel)) return;
      const current = qualifiedMinimum(context, date, rule);
      const shortage = Math.max(0, Number(rule.count) - current);
      if (!shortage) return;
      segments.filter(segment => segment.storeId === rule.storeId).forEach(segment => {
        const overlap = Math.max(0, Math.min(segment.end, Number(rule.end)) - Math.max(segment.start, Number(rule.start)));
        if (overlap > 0) score += (overlap / SLOT) * shortage * Math.max(1, skillLevel(person, rule.skillId));
      });
    });
    return score;
  }

  function makeEmergencyShift(context, person, date, assignment) {
    const store = context.stores.find(item => item.id === assignment.startStoreId);
    return {
      id:uid('bcall'), staffId:person.id, startStoreId:assignment.startStoreId, start:assignment.start, end:assignment.end,
      memo:`臨時招集 / 公休勤務 / ${store?.name || assignment.startStoreId}`,
      autoGenerated:true, autoSource:EMERGENCY_SOURCE, autoStage:'employee', autoMonth:context.month,
      emergencyCall:true, scheduledOffWork:true, basePrescribed:false,
      autoCreatedAt:new Date().toISOString(), autoReasons:['Bプラン臨時招集','公休勤務','不足補完'],
    };
  }

  function calculateShortages(context) {
    const output = [];
    daysInMonth(context.month).forEach(date => {
      if (context.holiday.companyClosures.some(item => item.date === date) || isConfirmed(context.audit, date)) return;
      applicableRules(context.requirements, context.skills, date, context.options.includeSoft).forEach(rule => {
        const minimum = qualifiedMinimum(context, date, rule);
        const shortage = Math.max(0, Number(rule.count) - minimum);
        if (shortage > 0) output.push({ date, rule, minimum, shortage });
      });
    });
    return output;
  }

  function qualifiedMinimum(context, date, rule) {
    let minimum = Infinity;
    for (let start = Number(rule.start); start < Number(rule.end); start += SLOT) {
      const end = Math.min(Number(rule.end), start + SLOT);
      let count = 0;
      (context.shifts[date] || []).forEach(shift => {
        const person = context.staff.find(item => item.id === String(shift.staffId || '').toUpperCase());
        if (!person || skillLevel(person, rule.skillId) < Number(rule.minLevel)) return;
        if (deriveSegments(shift, context.stores).some(segment => segment.storeId === rule.storeId && segment.start <= start && segment.end >= end)) count += 1;
      });
      minimum = Math.min(minimum, count);
    }
    return Number.isFinite(minimum) ? minimum : 0;
  }

  function render(p) {
    const summary = document.getElementById('month-builder-summary');
    const body = document.getElementById('month-builder-body');
    const apply = document.getElementById('month-builder-apply');
    if (!summary || !body || !p) return;
    summary.innerHTML = [
      metric('会社休業', `${p.closures?.length || 0}日`, '自動配置しない'),
      metric('公休自動補完', `${p.generatedOffCount || 0}日`, '正社員・月8休'),
      metric('正社員 基礎配置', `${p.baseProposals?.length || 0}件`, '所定勤務日数'),
      metric('B臨時招集', `${p.bEmergencyCalls?.length || 0}件`, '公休勤務・必要時のみ'),
      metric('バイトAUTO', `${p.parttimeProposals?.length || 0}件`, '不足補完'),
      metric('残る不足', `${p.shortages?.length || 0}件`, '要確認'),
    ].join('');

    const rows = (p.people || []).map(item => {
      const target = Number(item.targetShiftDays ?? Math.max(0, Number(item.prescribedDays || 0) - Number(item.paid || 0)));
      const callText = item.plan === 'B' ? `${item.emergency || 0}/${item.emergencyTarget ?? 2}` : '—';
      const warn = Number(item.overtimeMinutes || 0) > Number(item.allowedOvertimeHours || 0) * 60;
      return `<tr class="${warn ? 'danger' : Number(item.overtimeMinutes || 0) > 25*60 ? 'warn' : ''}"><td><strong>${esc(item.name)}</strong><small>${esc(item.staffId)} ${item.plan ? '・'+esc(item.plan)+'プラン' : ''}</small></td><td>${item.off}/8</td><td>${item.paid}</td><td>${item.prescribedDays}日</td><td><b>${item.shifts}/${target}日</b></td><td>${formatHours(item.overtimeMinutes)}h / ${item.allowedOvertimeHours}h</td><td><b>${callText}</b></td></tr>`;
    }).join('');

    const shortages = (p.shortages || []).slice(0,80).map(item => {
      const store = loadStores().find(s => s.id === item.rule.storeId);
      const skill = readArray(SKILLS_KEY).find(s => s.id === item.rule.skillId);
      return `<div class="month-shortage ${item.rule.mode === 'soft' ? 'soft' : 'hard'}"><b>${esc(item.date)} ${esc(store?.name || item.rule.storeId)}</b><span>${fmtTime(item.rule.start)}-${fmtTime(item.rule.end)} ${esc(skill?.name || item.rule.skillId)} Lv${item.rule.minLevel}：${item.minimum}/${item.rule.count}</span></div>`;
    }).join('');
    const conflicts = (p.conflicts || []).length ? `<div class="month-warning-box danger"><strong>既存データとの重複 ${p.conflicts.length}件</strong>${p.conflicts.slice(0,20).map(item => `<div>${esc(item.message)}</div>`).join('')}</div>` : '';
    const notes = (p.notes || []).length ? `<div class="month-warning-box"><strong>自動調整メモ</strong>${p.notes.slice(0,30).map(note => `<div>${esc(note)}</div>`).join('')}</div>` : '';
    body.innerHTML = `${conflicts}${notes}<section class="month-builder-section"><h3>正社員 月間サマリー</h3><div class="month-table-wrap"><table class="month-table"><thead><tr><th>従業員</th><th>公休</th><th>有休</th><th>所定日</th><th>配置 / 勤務目標</th><th>予定時間外 / 許容</th><th>臨時招集</th></tr></thead><tbody>${rows || '<tr><td colspan="7">正社員がいません。</td></tr>'}</tbody></table></div></section><section class="month-builder-section"><h3>配置後も残る不足</h3><div class="month-shortages">${shortages || '<div class="month-all-clear"><i class="fa-solid fa-circle-check"></i> 対象ルールは充足しています。</div>'}</div></section><div class="month-builder-assumption">Bプランは公休8日の記録を維持したまま、不足がある公休日に月2回を目安として臨時招集します。9時間拘束→標準休憩60分→予定実働8時間。30h社内ライン・承認済み例外・36協定設定を超える配置はしません。</div>`;
    if (apply) apply.disabled = (p.conflicts || []).some(item => ['company_closure','paid_leave','off'].includes(item.type));
  }

  async function applyPreview() {
    const p = currentPreview;
    if (!p) return;
    if ((p.conflicts || []).some(item => ['company_closure','paid_leave','off'].includes(item.type))) return window.alert('会社休業・公休・有休と既存シフトの重複があります。先に重複を解消してください。');
    if (!window.confirm(`${p.month} の月間AUTOを反映します。\n正社員基礎 ${p.baseProposals?.length || 0}件 / B臨時招集 ${p.bEmergencyCalls?.length || 0}件 / バイト ${p.parttimeProposals?.length || 0}件\n公休8日の記録は維持します。`)) return;
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(p.shifts));
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(p.holiday));
    if (localStorage.getItem(DEMO_KEY) !== '1' && window.shiftV2Cloud && window.shiftV2User) {
      try { await Promise.all([window.shiftV2Cloud.set(CLOUD_SHIFTS,p.shifts), window.shiftV2Cloud.set(CLOUD_HOLIDAYS,p.holiday)]); }
      catch (error) { console.warn('B emergency month save failed', error); }
    }
    sessionStorage.setItem('okk_shift_v2_month_restore_date', `${p.month}-01`);
    notify(`月間AUTO反映：B臨時招集 ${p.bEmergencyCalls?.length || 0}件`);
    document.getElementById('month-builder-modal')?.classList.remove('open');
    setTimeout(() => window.location.reload(),350);
  }

  async function clearMonthAuto() {
    const month = document.getElementById('month-builder-month')?.value || currentMonth;
    const shifts = readJson(SHIFTS_KEY, {});
    const holiday = normalizeHoliday(readJson(HOLIDAY_KEY, {}));
    let count = 0;
    Object.keys(shifts).filter(date => date.startsWith(month)).forEach(date => {
      if (!Array.isArray(shifts[date])) return;
      const before = shifts[date].length;
      shifts[date] = shifts[date].filter(item => !(item.autoGenerated && [MONTH_SOURCE,BASE_SOURCE,EMERGENCY_SOURCE].includes(item.autoSource)));
      count += before - shifts[date].length;
    });
    const beforeOff = holiday.staffDays.length;
    holiday.staffDays = holiday.staffDays.filter(item => !(item.autoSource === MONTH_SOURCE && item.date.startsWith(month)));
    const offCount = beforeOff - holiday.staffDays.length;
    if (!count && !offCount) return notify('この月に月間AUTOデータはありません');
    if (!window.confirm(`${month} の月間AUTOを取り消します。\nシフト ${count}件 / 自動公休 ${offCount}日`)) return;
    localStorage.setItem(SHIFTS_KEY,JSON.stringify(shifts));
    localStorage.setItem(HOLIDAY_KEY,JSON.stringify(holiday));
    if (localStorage.getItem(DEMO_KEY) !== '1' && window.shiftV2Cloud && window.shiftV2User) {
      try { await Promise.all([window.shiftV2Cloud.set(CLOUD_SHIFTS,shifts), window.shiftV2Cloud.set(CLOUD_HOLIDAYS,holiday)]); }
      catch (error) { console.warn('B emergency clear failed', error); }
    }
    notify('この月の月間AUTOを取り消しました');
    document.getElementById('month-builder-modal')?.classList.remove('open');
    setTimeout(() => window.location.reload(),350);
  }

  function applicableRules(requirements, skills, date, includeSoft) {
    const activeSkills = new Set(skills.filter(skill => skill.active !== false).map(skill => skill.id));
    const active = requirements.filter(rule => rule.active !== false && activeSkills.has(rule.skillId) && (includeSoft || rule.mode !== 'soft') && dayMatches(rule,date));
    const specific = new Set(active.filter(rule => rule.dayType === 'specific' && rule.specificDate === date).map(ruleKey));
    return active.filter(rule => rule.dayType === 'specific' || !specific.has(ruleKey(rule)));
  }
  function dayMatches(rule,date) { const day=new Date(`${date}T00:00:00`).getDay(); if(rule.dayType==='specific')return rule.specificDate===date; if(rule.dayType==='weekday')return day>=1&&day<=4; if(rule.dayType==='fri_sat')return day===5||day===6; if(rule.dayType==='sun')return day===0; return true; }
  function ruleKey(rule) { return `${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`; }
  function loadStaff() { return readArray(STAFF_KEY).map(person => ({...person,id:String(person.id||person.employeeNumber||'').toUpperCase(),employmentType:person.employmentType||(person.salaryType==='monthly'?'正社員':'アルバイト'),active:typeof person.active==='boolean'?person.active:true,skillLevels:{...(person.skillLevels||{})}})).filter(person=>person.id); }
  function loadStores() { const value=readJson(STORES_KEY,DEFAULT_STORES); return Array.isArray(value)&&value.length?value:DEFAULT_STORES; }
  function allowedStores(person,stores) { const list=Array.isArray(person.placementStoreIds)&&person.placementStoreIds.length?person.placementStoreIds:Array.isArray(person.affiliationStoreIds)&&person.affiliationStoreIds.length?person.affiliationStoreIds:person.mainStoreId?[person.mainStoreId]:stores.map(s=>s.id); return list.filter(id=>stores.some(s=>s.id===id)); }
  function skillLevel(person,id) { const n=Number(person.skillLevels?.[id]||0); return Number.isFinite(n)?Math.max(0,Math.min(3,Math.round(n))):0; }
  function dayConstraintAllows(person,date) { const c=person.workConstraints||{},day=String(new Date(`${date}T00:00:00`).getDay()); if(Array.isArray(c.fixedOffDays)&&c.fixedOffDays.includes(day))return false; if(Array.isArray(c.availableDays)&&c.availableDays.length&&!c.availableDays.includes(day))return false; return true; }
  function maxDaysPerWeek(person) { const n=Number(person.workConstraints?.maxDaysPerWeek); return Number.isFinite(n)&&n>0?Math.min(7,n):6; }
  function deriveSegments(shift,stores) { const store=stores.find(item=>item.id===shift.startStoreId),start=Number(shift.start),end=Number(shift.end); if(!store)return[{storeId:shift.startStoreId,start,end}]; if(store.autoJoin&&store.joinTarget&&end>Number(store.close))return start>=Number(store.close)?[{storeId:store.joinTarget,start,end}]:[{storeId:store.id,start,end:Number(store.close)},{storeId:store.joinTarget,start:Number(store.close),end}]; return[{storeId:store.id,start,end}]; }
  function holidayRecords(holiday,staffId,month,type) { const id=String(staffId||'').toUpperCase(); return holiday.staffDays.filter(item=>String(item.staffId||'').toUpperCase()===id&&item.date.startsWith(month)&&(!type||item.type===type)); }
  function normalizeHoliday(value) { const s=value&&typeof value==='object'?value:{}; return{companyClosures:Array.isArray(s.companyClosures)?s.companyClosures.map(item=>typeof item==='string'?{date:item,label:'会社休業日'}:item).filter(item=>item?.date):[],staffDays:Array.isArray(s.staffDays)?s.staffDays.filter(item=>item?.staffId&&item?.date&&['off','paid_leave'].includes(item.type)):[],updatedAt:s.updatedAt||'',updatedBy:s.updatedBy||''}; }
  function isConfirmed(audit,date) { return Boolean(audit?.dayStatus?.[date]?.confirmed); }
  function hasShift(shifts,staffId,date) { const id=String(staffId||'').toUpperCase(); return (Array.isArray(shifts?.[date])?shifts[date]:[]).some(shift=>String(shift.staffId||'').toUpperCase()===id); }
  function emergencyDates(shifts,staffId,month) { const id=String(staffId||'').toUpperCase(),out=[]; Object.entries(shifts||{}).forEach(([date,rows])=>{if(!date.startsWith(month)||!Array.isArray(rows))return; if(rows.some(shift=>String(shift.staffId||'').toUpperCase()===id&&shift.emergencyCall))out.push(date);}); return out; }
  function countEmergency(shifts,staffId,month) { return emergencyDates(shifts,staffId,month).length; }
  function plannedWorkMinutes(shift) { const binding=Math.max(0,Number(shift.end)-Number(shift.start)); return Math.max(0,binding-(binding>=9*60?60:binding>=6*60+45?45:0)); }
  function plannedOvertimeForMonth(shifts,staffId,month) { const start=`${month}-01`,end=lastDateOfMonth(month),days=dailyWorkMap(shifts,staffId),first=weekRange(start).start,last=weekRange(end).end; let cursor=new Date(`${first}T00:00:00`),lastDate=new Date(`${last}T00:00:00`),total=0,weekRegular=0; while(cursor<=lastDate){const date=dateKey(cursor);if(cursor.getDay()===1)weekRegular=0;const work=Number(days[date]||0),dailyRegular=Math.min(work,DAILY_REGULAR),dailyOver=Math.max(0,work-DAILY_REGULAR),weeklyRoom=Math.max(0,WEEKLY_REGULAR-weekRegular),weeklyOver=Math.max(0,dailyRegular-weeklyRoom);weekRegular+=dailyRegular-weeklyOver;if(date>=start&&date<=end)total+=dailyOver+weeklyOver;cursor.setDate(cursor.getDate()+1);}return total; }
  function dailyWorkMap(shifts,staffId) { const id=String(staffId||'').toUpperCase(),map={};Object.entries(shifts||{}).forEach(([date,rows])=>{if(!Array.isArray(rows))return;rows.forEach(shift=>{if(String(shift.staffId||'').toUpperCase()===id)map[date]=(map[date]||0)+plannedWorkMinutes(shift);});});return map; }
  function workDaysInMonth(shifts,staffId,month) { return daysInMonth(month).filter(date=>hasShift(shifts,staffId,date)).length; }
  function weekWorkDays(shifts,staffId,date) { const range=weekRange(date);return daysBetween(range.start,range.end).filter(day=>hasShift(shifts,staffId,day)).length; }
  function allowedOvertimeHours(context,person) { const internal=Number(context.plans?.common?.operationalOvertimeCapHours??DEFAULT_INTERNAL_CAP); const approved=context.approvals.filter(item=>String(item.staffId||'').toUpperCase()===person.id&&item.month===context.month&&item.status==='approved').sort((a,b)=>String(b.decidedAt||b.requestedAt||'').localeCompare(String(a.decidedAt||a.requestedAt||'')))[0]; const ordinary=Number(context.agreement?.ordinaryMonthlyLimitHours??45); const hard=context.agreement?.specialClauseEnabled?Number(context.agreement?.specialMonthlyLimitHours??ordinary):ordinary; return Math.max(0,Math.min(approved?Number(approved.requestedLimitHours||internal):internal,hard)); }
  function removeSource(source,month,autoSource) { const shifts=clone(source||{});Object.keys(shifts).filter(date=>date.startsWith(month)).forEach(date=>{if(Array.isArray(shifts[date]))shifts[date]=shifts[date].filter(item=>item.autoSource!==autoSource);});return shifts; }
  function daysInMonth(month) { const [year,no]=month.split('-').map(Number),last=new Date(year,no,0).getDate();return Array.from({length:last},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`); }
  function lastDateOfMonth(month) { const [year,no]=month.split('-').map(Number);return dateKey(new Date(year,no,0)); }
  function weekRange(date) { const d=new Date(`${date}T00:00:00`),day=d.getDay(),monday=new Date(d);monday.setDate(d.getDate()+(day===0?-6:1-day));const sunday=new Date(monday);sunday.setDate(monday.getDate()+6);return{start:dateKey(monday),end:dateKey(sunday)}; }
  function weekKey(date) { return weekRange(date).start; }
  function daysBetween(start,end) { const out=[],cursor=new Date(`${start}T00:00:00`),last=new Date(`${end}T00:00:00`);while(cursor<=last){out.push(dateKey(cursor));cursor.setDate(cursor.getDate()+1);}return out; }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
  function fmtTime(total) { const v=Number(total),next=v>=1440,h=Math.floor(v/60)%24,m=v%60;return `${next?'翌':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function formatHours(minutes) { const h=Math.max(0,Number(minutes)||0)/60;return Number.isInteger(h)?String(h):h.toFixed(1); }
  function metric(label,value,sub) { return `<div class="month-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`; }
  function snap(value) { return Math.round(Number(value)/SLOT)*SLOT; }
  function numberOr(value,fallback) { const n=Number(value);return Number.isFinite(n)?n:fallback; }
  function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function readArray(key) { const value=readJson(key,[]);return Array.isArray(value)?value:[]; }
  function readJson(key,fallback) { try{const value=JSON.parse(localStorage.getItem(key));return value??clone(fallback);}catch{return clone(fallback);} }
  function restoreRaw(key,raw) { if(typeof raw==='string')localStorage.setItem(key,raw);else localStorage.removeItem(key); }
  function esc(value) { return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char])); }
  function notify(message) { const toast=document.getElementById('toast');if(!toast)return window.alert(message);toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200); }
})();
