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

  let originalPreview = null;
  let currentPreview = null;
  let currentMonth = '';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    originalPreview = window.shiftV2MonthBuilder?.preview;
    if (typeof originalPreview !== 'function') return;
    takeoverControl('month-builder-open', openEnhanced);
    takeoverControl('month-builder-calc', calculateEnhanced);
    takeoverControl('month-builder-month', calculateEnhanced, 'change');
    takeoverControl('month-builder-auto-off', calculateEnhanced, 'change');
    takeoverControl('month-builder-soft', calculateEnhanced, 'change');
    takeoverControl('month-builder-apply', applyEnhanced);
    takeoverControl('month-builder-clear', clearEnhanced);
    window.shiftV2MonthBuilderEnhanced = { preview: buildEnhanced, baseSource: BASE_SOURCE };
  }

  function takeoverControl(id, handler, eventName = 'click') {
    const node = document.getElementById(id);
    if (!node) return;
    const clone = node.cloneNode(true);
    node.replaceWith(clone);
    clone.addEventListener(eventName, handler);
  }

  function openEnhanced() {
    const selected = document.getElementById('work-date')?.value;
    currentMonth = selected?.slice(0,7) || monthKey(new Date());
    const monthInput = document.getElementById('month-builder-month');
    if (monthInput) monthInput.value = currentMonth;
    document.getElementById('month-builder-modal')?.classList.add('open');
    calculateEnhanced();
  }

  function calculateEnhanced() {
    const month = document.getElementById('month-builder-month')?.value || currentMonth || monthKey(new Date());
    currentMonth = month;
    const options = {
      autoOff: document.getElementById('month-builder-auto-off')?.checked !== false,
      includeSoft: Boolean(document.getElementById('month-builder-soft')?.checked),
    };
    currentPreview = buildEnhanced(month, options);
    renderEnhanced(currentPreview);
  }

  function buildEnhanced(month, options = {}) {
    const originalShiftsRaw = localStorage.getItem(SHIFTS_KEY);
    const originalHolidayRaw = localStorage.getItem(HOLIDAY_KEY);
    const working = cleanMonthAuto(readJson(SHIFTS_KEY, {}), month);
    const holiday = normalizeHoliday(readJson(HOLIDAY_KEY, {}));
    const staff = loadStaff();
    const requirements = readArray(REQUIREMENTS_KEY);
    const skills = readArray(SKILLS_KEY);
    const stores = loadStores();
    const audit = readJson(AUDIT_KEY, {});
    const plans = readJson(PLAN_KEY, {});
    const agreement = readJson(AGREEMENT_KEY, {});
    const approvals = readArray(APPROVAL_KEY);
    const baseProposals = [];
    const baseNotes = [];

    const context = { month, working, holiday, staff, requirements, skills, stores, audit, plans, agreement, approvals, baseProposals, baseNotes };
    staff.filter(person => person.active !== false && person.employmentType === '正社員').forEach(person => fillPrescribedDays(context, person, options));

    let result;
    try {
      localStorage.setItem(SHIFTS_KEY, JSON.stringify(working));
      localStorage.setItem(HOLIDAY_KEY, JSON.stringify(holiday));
      result = originalPreview(month, options);
    } finally {
      restoreRaw(SHIFTS_KEY, originalShiftsRaw);
      restoreRaw(HOLIDAY_KEY, originalHolidayRaw);
    }

    result.proposals = [...baseProposals, ...(result.proposals || [])];
    result.employeeProposals = [...baseProposals, ...(result.employeeProposals || [])];
    result.notes = [...baseNotes, ...(result.notes || [])];
    result.baseProposals = baseProposals;
    result.people = (result.people || []).map(person => ({
      ...person,
      targetShiftDays: Math.max(0, Number(person.prescribedDays || 0) - Number(person.paid || 0)),
    }));
    return result;
  }

  function fillPrescribedDays(context, person, options) {
    const monthDays = daysInMonth(context.month);
    const closures = new Set(context.holiday.companyClosures.filter(item => item.date.startsWith(context.month)).map(item => item.date));
    const manualOff = holidayRecords(context.holiday, person.id, context.month, 'off').length;
    const paidLeave = holidayRecords(context.holiday, person.id, context.month, 'paid_leave').length;
    const offTarget = options.autoOff === false ? manualOff : Math.max(8, manualOff);
    const targetShiftDays = Math.max(0, monthDays.length - closures.size - offTarget - paidLeave);
    let currentDays = workDaysInMonth(context.working, person.id, context.month);
    let guard = 0;

    while (currentDays < targetShiftDays && guard++ < 40) {
      const candidates = monthDays.filter(date => canUseBaseDate(context, person, date));
      const assignments = candidates.map(date => {
        const assignment = chooseBaseAssignment(context, person, date);
        return assignment ? { date, assignment, score: baseDayScore(context, person, date, assignment) } : null;
      }).filter(Boolean).sort((a,b) => b.score - a.score || a.date.localeCompare(b.date));

      const selected = assignments.find(item => withinOvertimeCap(context, person, item.date, item.assignment));
      if (!selected) break;
      addBaseShift(context, person, selected.date, selected.assignment);
      currentDays += 1;
    }

    if (currentDays < targetShiftDays) {
      context.baseNotes.push(`${person.name || person.id}：所定勤務目標${targetShiftDays}日に対して${currentDays}日。勤務条件または残業上限で基礎配置できない日があります。`);
    }
  }

  function canUseBaseDate(context, person, date) {
    if (isConfirmed(context.audit, date)) return false;
    if (context.holiday.companyClosures.some(item => item.date === date)) return false;
    if (holidayType(context.holiday, person.id, date)) return false;
    if (hasShift(context.working, person.id, date)) return false;
    if (!dayConstraintAllows(person, date)) return false;
    if (weekWorkDays(context.working, person.id, date) >= maxDaysPerWeek(person)) return false;
    return true;
  }

  function chooseBaseAssignment(context, person, date) {
    const availableStart = numberOr(person.workConstraints?.availableStart, 16*60);
    const availableEnd = numberOr(person.workConstraints?.availableEnd, 30*60);
    if (availableEnd - availableStart < BINDING_FULL_TIME) return null;

    const storeIds = allowedStores(person, context.stores);
    const rules = applicableRules(context.requirements, context.skills, date);
    const candidates = [];

    storeIds.forEach(storeId => {
      const store = context.stores.find(item => item.id === storeId);
      if (!store) return;
      const storeRules = rules.filter(rule => rule.storeId === storeId);
      const earliest = storeRules.length ? Math.min(...storeRules.map(rule => Number(rule.start))) : 17*60;
      let latest = storeRules.length ? Math.max(...storeRules.map(rule => Number(rule.end))) : Number(store.close || 26*60);
      if (store.autoJoin && store.joinTarget) {
        const joinRules = rules.filter(rule => rule.storeId === store.joinTarget);
        if (joinRules.length) latest = Math.max(latest, ...joinRules.map(rule => Number(rule.end)));
      }

      const starts = new Set();
      starts.add(snap(Math.max(availableStart, Math.min(earliest, availableEnd - BINDING_FULL_TIME))));
      starts.add(snap(Math.max(availableStart, Math.min(latest - BINDING_FULL_TIME, availableEnd - BINDING_FULL_TIME))));
      if (store.autoJoin) starts.add(snap(Math.max(availableStart, Math.min(21*60, availableEnd - BINDING_FULL_TIME))));

      starts.forEach(start => {
        const end = start + BINDING_FULL_TIME;
        if (start < availableStart || end > availableEnd) return;
        const shift = { staffId: person.id, startStoreId: storeId, start, end };
        const score = assignmentCoverageScore(context, person, date, shift, rules);
        candidates.push({ startStoreId: storeId, start, end, score });
      });
    });

    candidates.sort((a,b) => b.score - a.score || a.start - b.start);
    return candidates[0] || null;
  }

  function assignmentCoverageScore(context, person, date, shift, rules) {
    const segments = deriveSegments(shift, context.stores);
    let score = 0;
    rules.forEach(rule => {
      if (skillLevel(person, rule.skillId) < Number(rule.minLevel)) return;
      const shortage = Math.max(0, Number(rule.count) - qualifiedMinimum(context, date, rule));
      if (!shortage) return;
      segments.filter(segment => segment.storeId === rule.storeId).forEach(segment => {
        const overlap = Math.max(0, Math.min(segment.end, Number(rule.end)) - Math.max(segment.start, Number(rule.start)));
        if (overlap > 0) score += (overlap / SLOT) * shortage * (10 + skillLevel(person, rule.skillId) * 2);
      });
    });
    if (person.mainStoreId === shift.startStoreId) score += 120;
    else if ((person.affiliationStoreIds || []).includes(shift.startStoreId)) score += 70;
    return score;
  }

  function baseDayScore(context, person, date, assignment) {
    const weekDays = weekWorkDays(context.working, person.id, date);
    const preferred = preferredDaysPerWeek(person);
    let score = assignment.score;
    score += weekDays < preferred ? (preferred - weekDays) * 45 : -(weekDays - preferred + 1) * 70;
    const weekday = new Date(`${date}T00:00:00`).getDay();
    if (weekday === 5 || weekday === 6) score += 20;
    score -= workDaysInMonth(context.working, person.id, context.month) * 2;
    return score;
  }

  function addBaseShift(context, person, date, assignment) {
    const store = context.stores.find(item => item.id === assignment.startStoreId);
    const shift = {
      id: uid('base'), staffId: person.id, startStoreId: assignment.startStoreId,
      start: assignment.start, end: assignment.end,
      memo: `月間AUTO：所定勤務 / ${store?.name || assignment.startStoreId}`,
      autoGenerated: true, autoSource: BASE_SOURCE, autoStage: 'employee', autoMonth: context.month,
      basePrescribed: true, emergencyCall: false,
      autoCreatedAt: new Date().toISOString(), autoReasons: ['所定労働日数の基礎配置'],
    };
    if (!Array.isArray(context.working[date])) context.working[date] = [];
    context.working[date].push(shift);
    context.baseProposals.push({ ...shift, date });
  }

  function withinOvertimeCap(context, person, date, assignment) {
    const test = clone(context.working);
    if (!Array.isArray(test[date])) test[date] = [];
    test[date].push({ staffId: person.id, start: assignment.start, end: assignment.end, startStoreId: assignment.startStoreId });
    return plannedOvertimeForMonth(test, person.id, context.month) <= allowedOvertimeHours(context, person, context.month) * 60 + 0.001;
  }

  function allowedOvertimeHours(context, person, month) {
    const internal = Number(context.plans?.common?.operationalOvertimeCapHours ?? DEFAULT_INTERNAL_CAP);
    const approved = context.approvals.filter(item => String(item.staffId || '').toUpperCase() === person.id && item.month === month && item.status === 'approved')
      .sort((a,b) => String(b.decidedAt || b.requestedAt || '').localeCompare(String(a.decidedAt || a.requestedAt || '')))[0];
    const ordinary = Number(context.agreement?.ordinaryMonthlyLimitHours ?? 45);
    const hard = context.agreement?.specialClauseEnabled ? Number(context.agreement?.specialMonthlyLimitHours ?? ordinary) : ordinary;
    return Math.max(0, Math.min(approved ? Number(approved.requestedLimitHours || internal) : internal, hard));
  }

  function qualifiedMinimum(context, date, rule) {
    let minimum = Infinity;
    for (let start = Number(rule.start); start < Number(rule.end); start += SLOT) {
      const end = Math.min(Number(rule.end), start + SLOT);
      let count = 0;
      (context.working[date] || []).forEach(shift => {
        const person = context.staff.find(item => item.id === String(shift.staffId || '').toUpperCase());
        if (!person || skillLevel(person, rule.skillId) < Number(rule.minLevel)) return;
        if (deriveSegments(shift, context.stores).some(segment => segment.storeId === rule.storeId && segment.start <= start && segment.end >= end)) count += 1;
      });
      minimum = Math.min(minimum, count);
    }
    return Number.isFinite(minimum) ? minimum : 0;
  }

  function renderEnhanced(p) {
    const summary = document.getElementById('month-builder-summary');
    const body = document.getElementById('month-builder-body');
    const apply = document.getElementById('month-builder-apply');
    if (!summary || !body || !p) return;

    const supplementalEmployees = Math.max(0, (p.employeeProposals?.length || 0) - (p.baseProposals?.length || 0));
    summary.innerHTML = [
      metric('会社休業', `${p.closures?.length || 0}日`, '自動配置しない'),
      metric('公休自動補完', `${p.generatedOffCount || 0}日`, '正社員・月8休まで'),
      metric('正社員 基礎配置', `${p.baseProposals?.length || 0}件`, '所定勤務日数を先に配置'),
      metric('社員 追加補完', `${supplementalEmployees}件`, `臨時招集 ${p.emergency?.length || 0}件`),
      metric('バイトAUTO', `${p.parttimeProposals?.length || 0}件`, '不足スキルを補完'),
      metric('残る不足', `${p.shortages?.length || 0}件`, '要確認'),
    ].join('');

    const personRows = (p.people || []).map(item => {
      const target = Number(item.targetShiftDays ?? Math.max(0, Number(item.prescribedDays || 0) - Number(item.paid || 0)));
      const short = Number(item.shifts || 0) < target;
      const over = Number(item.overtimeMinutes || 0) > Number(item.allowedOvertimeHours || 0) * 60;
      return `<tr class="${over || short ? 'danger' : Number(item.overtimeMinutes || 0) > 25*60 ? 'warn' : ''}"><td><strong>${esc(item.name)}</strong><small>${esc(item.staffId)} ${item.plan ? '・'+esc(item.plan)+'プラン' : ''}</small></td><td>${item.off}/8</td><td>${item.paid}</td><td>${item.prescribedDays}日</td><td><b>${item.shifts}/${target}日</b></td><td>${formatHours(item.overtimeMinutes)}h / ${item.allowedOvertimeHours}h</td><td>${item.emergency}</td></tr>`;
    }).join('');

    const stores = loadStores();
    const skills = readArray(SKILLS_KEY);
    const shortages = (p.shortages || []).slice(0,80).map(item => {
      const store = stores.find(s => s.id === item.rule.storeId);
      const skill = skills.find(s => s.id === item.rule.skillId);
      return `<div class="month-shortage ${item.rule.mode === 'soft' ? 'soft' : 'hard'}"><b>${esc(item.date)} ${esc(store?.name || item.rule.storeId)}</b><span>${fmtTime(item.rule.start)}-${fmtTime(item.rule.end)} ${esc(skill?.name || item.rule.skillId)} Lv${item.rule.minLevel}：${item.minimum}/${item.rule.count}</span></div>`;
    }).join('');

    const conflicts = (p.conflicts || []).length ? `<div class="month-warning-box danger"><strong>既存データとの重複 ${p.conflicts.length}件</strong>${p.conflicts.slice(0,20).map(item => `<div>${esc(item.message)}</div>`).join('')}</div>` : '';
    const notes = (p.notes || []).length ? `<div class="month-warning-box"><strong>自動調整メモ</strong>${p.notes.slice(0,30).map(note => `<div>${esc(note)}</div>`).join('')}</div>` : '';
    body.innerHTML = `${conflicts}${notes}<section class="month-builder-section"><h3>正社員 月間サマリー</h3><div class="month-table-wrap"><table class="month-table"><thead><tr><th>従業員</th><th>公休</th><th>有休</th><th>所定日</th><th>配置 / 勤務目標</th><th>予定時間外 / 許容</th><th>臨時招集</th></tr></thead><tbody>${personRows || '<tr><td colspan="7">正社員がいません。</td></tr>'}</tbody></table></div></section><section class="month-builder-section"><h3>配置後も残る不足</h3><div class="month-shortages">${shortages || '<div class="month-all-clear"><i class="fa-solid fa-circle-check"></i> 対象ルールは充足しています。</div>'}</div></section><div class="month-builder-assumption">正社員は会社休業・公休8日・有休を除いた勤務目標日を先に基礎配置。その後、必要スキルを社員→アルバイトで補完します。固定残業A25h/B45hは配置上限には使いません。</div>`;

    if (apply) apply.disabled = (p.conflicts || []).some(item => ['company_closure','paid_leave','off'].includes(item.type));
  }

  async function applyEnhanced() {
    const p = currentPreview;
    if (!p) return;
    if ((p.conflicts || []).some(item => ['company_closure','paid_leave','off'].includes(item.type))) return window.alert('会社休業・公休・有休と既存シフトの重複があります。先に重複を解消してください。');
    if (!window.confirm(`${p.month} の月間AUTOを反映します。\n正社員基礎 ${p.baseProposals?.length || 0}件 / 社員補完 ${Math.max(0,(p.employeeProposals?.length||0)-(p.baseProposals?.length||0))}件 / バイト ${p.parttimeProposals?.length || 0}件\n既存の手入力シフトは変更しません。`)) return;
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(p.shifts));
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(p.holiday));
    if (localStorage.getItem(DEMO_KEY) !== '1' && window.shiftV2Cloud && window.shiftV2User) {
      try { await Promise.all([window.shiftV2Cloud.set(CLOUD_SHIFTS,p.shifts), window.shiftV2Cloud.set(CLOUD_HOLIDAYS,p.holiday)]); }
      catch (error) { console.warn('Enhanced month builder cloud save failed', error); }
    }
    sessionStorage.setItem('okk_shift_v2_month_restore_date', `${p.month}-01`);
    notify(`月間AUTOを反映：正社員基礎${p.baseProposals?.length || 0} / バイト${p.parttimeProposals?.length || 0}`);
    document.getElementById('month-builder-modal')?.classList.remove('open');
    setTimeout(() => window.location.reload(),350);
  }

  async function clearEnhanced() {
    const month = document.getElementById('month-builder-month')?.value || currentMonth;
    const shifts = readJson(SHIFTS_KEY, {});
    const holiday = normalizeHoliday(readJson(HOLIDAY_KEY, {}));
    let count = 0;
    Object.keys(shifts).filter(date => date.startsWith(month)).forEach(date => {
      if (!Array.isArray(shifts[date])) return;
      const before = shifts[date].length;
      shifts[date] = shifts[date].filter(item => !(item.autoGenerated && [MONTH_SOURCE,BASE_SOURCE].includes(item.autoSource)));
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
      catch (error) { console.warn('Enhanced month builder clear failed', error); }
    }
    notify('この月の月間AUTOを取り消しました');
    document.getElementById('month-builder-modal')?.classList.remove('open');
    setTimeout(() => window.location.reload(),350);
  }

  function cleanMonthAuto(source, month) {
    const shifts = clone(source || {});
    Object.keys(shifts).filter(date => date.startsWith(month)).forEach(date => {
      if (!Array.isArray(shifts[date])) shifts[date] = [];
      shifts[date] = shifts[date].filter(item => !(item.autoGenerated && [MONTH_SOURCE,BASE_SOURCE].includes(item.autoSource)));
    });
    return shifts;
  }

  function applicableRules(requirements, skills, date) {
    const activeSkills = new Set(skills.filter(skill => skill.active !== false).map(skill => skill.id));
    const active = requirements.filter(rule => rule.active !== false && activeSkills.has(rule.skillId) && dayMatches(rule,date));
    const specific = new Set(active.filter(rule => rule.dayType === 'specific' && rule.specificDate === date).map(ruleKey));
    return active.filter(rule => rule.dayType === 'specific' || !specific.has(ruleKey(rule)));
  }

  function dayMatches(rule,date) { const day=new Date(`${date}T00:00:00`).getDay(); if(rule.dayType==='specific')return rule.specificDate===date; if(rule.dayType==='weekday')return day>=1&&day<=4; if(rule.dayType==='fri_sat')return day===5||day===6; if(rule.dayType==='sun')return day===0; return true; }
  function ruleKey(rule) { return `${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`; }
  function loadStaff() { return readArray(STAFF_KEY).map(person => ({ ...person, id:String(person.id||person.employeeNumber||'').toUpperCase(), employmentType:person.employmentType||(person.salaryType==='monthly'?'正社員':'アルバイト'), active:typeof person.active==='boolean'?person.active:true, skillLevels:{...(person.skillLevels||{})} })).filter(person=>person.id); }
  function loadStores() { const value=readJson(STORES_KEY,DEFAULT_STORES); return Array.isArray(value)&&value.length?value:DEFAULT_STORES; }
  function allowedStores(person,stores) { const list=Array.isArray(person.placementStoreIds)&&person.placementStoreIds.length?person.placementStoreIds:Array.isArray(person.affiliationStoreIds)&&person.affiliationStoreIds.length?person.affiliationStoreIds:person.mainStoreId?[person.mainStoreId]:stores.map(s=>s.id); return list.filter(id=>stores.some(s=>s.id===id)); }
  function skillLevel(person,id) { const n=Number(person.skillLevels?.[id]||0); return Number.isFinite(n)?Math.max(0,Math.min(3,Math.round(n))):0; }
  function dayConstraintAllows(person,date) { const c=person.workConstraints||{}, day=String(new Date(`${date}T00:00:00`).getDay()); if(Array.isArray(c.fixedOffDays)&&c.fixedOffDays.includes(day))return false; if(Array.isArray(c.availableDays)&&c.availableDays.length&&!c.availableDays.includes(day))return false; return true; }
  function preferredDaysPerWeek(person) { const n=Number(person.workConstraints?.preferredDaysPerWeek); return Number.isFinite(n)&&n>0?Math.min(7,n):5; }
  function maxDaysPerWeek(person) { const n=Number(person.workConstraints?.maxDaysPerWeek); return Number.isFinite(n)&&n>0?Math.min(7,n):6; }
  function deriveSegments(shift,stores) { const store=stores.find(item=>item.id===shift.startStoreId), start=Number(shift.start), end=Number(shift.end); if(!store)return[{storeId:shift.startStoreId,start,end}]; if(store.autoJoin&&store.joinTarget&&end>Number(store.close))return start>=Number(store.close)?[{storeId:store.joinTarget,start,end}]:[{storeId:store.id,start,end:Number(store.close)},{storeId:store.joinTarget,start:Number(store.close),end}]; return[{storeId:store.id,start,end}]; }
  function plannedWorkMinutes(shift) { const binding=Math.max(0,Number(shift.end)-Number(shift.start)); return Math.max(0,binding-(binding>=9*60?60:binding>=6*60+45?45:0)); }
  function plannedOvertimeForMonth(shifts,staffId,month) { const start=`${month}-01`, end=lastDateOfMonth(month), days=dailyWorkMap(shifts,staffId), first=weekRange(start).start, last=weekRange(end).end; let cursor=new Date(`${first}T00:00:00`), lastDate=new Date(`${last}T00:00:00`), total=0, weekRegular=0; while(cursor<=lastDate){const date=dateKey(cursor); if(cursor.getDay()===1)weekRegular=0; const work=Number(days[date]||0), dailyRegular=Math.min(work,DAILY_REGULAR), dailyOver=Math.max(0,work-DAILY_REGULAR), weeklyRoom=Math.max(0,WEEKLY_REGULAR-weekRegular), weeklyOver=Math.max(0,dailyRegular-weeklyRoom); weekRegular+=dailyRegular-weeklyOver; if(date>=start&&date<=end)total+=dailyOver+weeklyOver; cursor.setDate(cursor.getDate()+1);} return total; }
  function dailyWorkMap(shifts,staffId) { const id=String(staffId||'').toUpperCase(), map={}; Object.entries(shifts||{}).forEach(([date,rows])=>{if(!Array.isArray(rows))return; rows.forEach(shift=>{if(String(shift.staffId||'').toUpperCase()===id)map[date]=(map[date]||0)+plannedWorkMinutes(shift);});}); return map; }
  function workDaysInMonth(shifts,staffId,month) { return daysInMonth(month).filter(date=>hasShift(shifts,staffId,date)).length; }
  function weekWorkDays(shifts,staffId,date) { const range=weekRange(date); return daysBetween(range.start,range.end).filter(day=>hasShift(shifts,staffId,day)).length; }
  function hasShift(shifts,staffId,date) { const id=String(staffId||'').toUpperCase(); return (Array.isArray(shifts?.[date])?shifts[date]:[]).some(shift=>String(shift.staffId||'').toUpperCase()===id); }
  function holidayType(holiday,staffId,date) { const id=String(staffId||'').toUpperCase(); return holiday.staffDays.find(item=>String(item.staffId||'').toUpperCase()===id&&item.date===date)?.type||''; }
  function holidayRecords(holiday,staffId,month,type) { const id=String(staffId||'').toUpperCase(); return holiday.staffDays.filter(item=>String(item.staffId||'').toUpperCase()===id&&item.date.startsWith(month)&&(!type||item.type===type)); }
  function isConfirmed(audit,date) { return Boolean(audit?.dayStatus?.[date]?.confirmed); }
  function normalizeHoliday(value) { const s=value&&typeof value==='object'?value:{}; return {companyClosures:Array.isArray(s.companyClosures)?s.companyClosures.map(item=>typeof item==='string'?{date:item,label:'会社休業日'}:item).filter(item=>item?.date):[],staffDays:Array.isArray(s.staffDays)?s.staffDays.filter(item=>item?.staffId&&item?.date&&['off','paid_leave'].includes(item.type)):[],updatedAt:s.updatedAt||'',updatedBy:s.updatedBy||''}; }
  function daysInMonth(month) { const [year,no]=month.split('-').map(Number), last=new Date(year,no,0).getDate(); return Array.from({length:last},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`); }
  function lastDateOfMonth(month) { const [year,no]=month.split('-').map(Number); return dateKey(new Date(year,no,0)); }
  function weekRange(date) { const d=new Date(`${date}T00:00:00`), day=d.getDay(), monday=new Date(d); monday.setDate(d.getDate()+(day===0?-6:1-day)); const sunday=new Date(monday); sunday.setDate(monday.getDate()+6); return{start:dateKey(monday),end:dateKey(sunday)}; }
  function daysBetween(start,end) { const out=[],cursor=new Date(`${start}T00:00:00`),last=new Date(`${end}T00:00:00`); while(cursor<=last){out.push(dateKey(cursor));cursor.setDate(cursor.getDate()+1);} return out; }
  function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function fmtTime(total) { const v=Number(total),next=v>=1440,h=Math.floor(v/60)%24,m=v%60; return `${next?'翌':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function metric(label,value,sub) { return `<div class="month-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`; }
  function formatHours(minutes) { const h=Math.max(0,Number(minutes)||0)/60; return Number.isInteger(h)?String(h):h.toFixed(1); }
  function snap(value) { return Math.round(Number(value)/SLOT)*SLOT; }
  function numberOr(value,fallback) { const n=Number(value); return Number.isFinite(n)?n:fallback; }
  function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function readArray(key) { const value=readJson(key,[]); return Array.isArray(value)?value:[]; }
  function readJson(key,fallback) { try{const value=JSON.parse(localStorage.getItem(key)); return value??clone(fallback);}catch{return clone(fallback);} }
  function restoreRaw(key,raw) { if(typeof raw==='string')localStorage.setItem(key,raw); else localStorage.removeItem(key); }
  function esc(value) { return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char])); }
  function notify(message) { const toast=document.getElementById('toast'); if(!toast)return window.alert(message); toast.textContent=message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2200); }
})();
