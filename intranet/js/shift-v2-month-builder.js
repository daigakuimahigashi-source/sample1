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
  const CLOUD_SHIFTS = 'shiftV2Shifts';
  const CLOUD_HOLIDAYS = 'shiftV2Holidays';
  const SOURCE = 'v2-month-builder';
  const SLOT = 30;
  const DAILY_PLANNED_LIMIT = 8 * 60;
  const WEEKLY_REGULAR_LIMIT = 40 * 60;
  const DEFAULT_INTERNAL_CAP = 30;
  const MONTHLY_OFF_TARGET = 8;
  const PLAN_MIN = 10 * 60;
  const PLAN_MAX = 32 * 60;

  const DEFAULT_STORES = [
    { id: 'matsuyama', name: '松山店', close: 30 * 60, autoJoin: false, joinTarget: '' },
    { id: 'kumoji', name: '久茂地店', close: 25 * 60, autoJoin: true, joinTarget: 'matsuyama' },
    { id: 'miebashi', name: '美栄橋店', close: 25 * 60, autoJoin: true, joinTarget: 'matsuyama' },
    { id: 'misato', name: '美里店', close: 26 * 60, autoJoin: false, joinTarget: '' },
  ];

  const state = { month: currentMonth(), includeSoft: false, autoOff: true, preview: null };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    injectButton();
    injectModal();
    bindEvents();
    restoreAfterApply();
    window.shiftV2MonthBuilder = { preview: (month, options) => buildMonth(month || currentMonth(), options || { autoOff: true, includeSoft: false }), source: SOURCE };
  }

  function injectButton() {
    const left = document.querySelector('#view-planner .toolbar .toolbar-left');
    if (!left || document.getElementById('month-builder-open')) return;
    const group = document.createElement('div');
    group.className = 'month-builder-toolbar';
    group.innerHTML = '<button id="month-builder-open" class="btn btn-dark"><i class="fa-solid fa-calendar-plus"></i> 月間一括作成</button><span>公休8日 → 社員 → バイト補完</span>';
    left.appendChild(group);
  }

  function injectModal() {
    if (document.getElementById('month-builder-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'month-builder-modal';
    modal.className = 'month-builder-bg';
    modal.innerHTML = `
      <div class="month-builder-modal" role="dialog" aria-modal="true" aria-label="月間シフト一括作成">
        <div class="month-builder-head"><div><span class="month-builder-kicker">MONTHLY AUTO BUILD</span><h2>月間シフト一括作成</h2><p>会社休業・公休・有休・勤務可能条件・必要スキル・残業上限をまとめて見ながら作ります。</p></div><button id="month-builder-close" class="btn btn-light btn-small"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="month-builder-controls"><label>対象月 <input id="month-builder-month" class="control" type="month"></label><label><input id="month-builder-auto-off" type="checkbox" checked> 公休が8日未満なら自動補完</label><label><input id="month-builder-soft" type="checkbox"> 推奨条件も埋める</label><button id="month-builder-calc" class="btn btn-light"><i class="fa-solid fa-rotate"></i> 再計算</button></div>
        <div class="month-builder-notice">既存の手入力シフト・日別AUTO・確定済み日は固定扱いです。この機能が以前作った「月間AUTO」だけを作り直します。</div>
        <div id="month-builder-summary" class="month-builder-summary"></div><div id="month-builder-body" class="month-builder-body"></div>
        <div class="month-builder-foot"><button id="month-builder-clear" class="btn month-builder-danger"><i class="fa-solid fa-rotate-left"></i> この月の月間AUTOを取消</button><div><button id="month-builder-apply" class="btn btn-green"><i class="fa-solid fa-check"></i> この案を反映</button></div></div>
      </div>`;
    document.body.appendChild(modal);
  }

  function bindEvents() {
    document.getElementById('month-builder-open')?.addEventListener('click', openModal);
    document.getElementById('month-builder-close')?.addEventListener('click', closeModal);
    document.getElementById('month-builder-modal')?.addEventListener('click', event => { if (event.target.id === 'month-builder-modal') closeModal(); });
    document.getElementById('month-builder-month')?.addEventListener('change', event => { state.month = event.target.value || currentMonth(); calculateAndRender(); });
    document.getElementById('month-builder-auto-off')?.addEventListener('change', event => { state.autoOff = event.target.checked; calculateAndRender(); });
    document.getElementById('month-builder-soft')?.addEventListener('change', event => { state.includeSoft = event.target.checked; calculateAndRender(); });
    document.getElementById('month-builder-calc')?.addEventListener('click', calculateAndRender);
    document.getElementById('month-builder-apply')?.addEventListener('click', applyPreview);
    document.getElementById('month-builder-clear')?.addEventListener('click', clearMonthGenerated);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
  }

  function openModal() {
    const selected = document.getElementById('work-date')?.value;
    state.month = selected?.slice(0, 7) || state.month || currentMonth();
    const input = document.getElementById('month-builder-month');
    if (input) input.value = state.month;
    document.getElementById('month-builder-modal')?.classList.add('open');
    calculateAndRender();
  }

  function closeModal() { document.getElementById('month-builder-modal')?.classList.remove('open'); }
  function calculateAndRender() { state.preview = buildMonth(state.month, { autoOff: state.autoOff, includeSoft: state.includeSoft }); renderPreview(); }

  function buildMonth(month, options = {}) {
    const staff = loadStaff();
    const skills = loadArray(SKILLS_KEY);
    const requirements = loadArray(REQUIREMENTS_KEY);
    const stores = loadStores();
    const plans = loadJson(PLAN_KEY, {});
    const agreement = loadJson(AGREEMENT_KEY, {});
    const approvals = loadArray(APPROVAL_KEY);
    const audit = loadJson(AUDIT_KEY, {});
    const working = clone(loadJson(SHIFTS_KEY, {}));
    const holiday = normalizeHoliday(loadJson(HOLIDAY_KEY, {}));
    const notes = [];
    const conflicts = [];

    daysInMonth(month).forEach(date => {
      if (!Array.isArray(working[date])) working[date] = [];
      working[date] = working[date].filter(shift => !(shift.autoGenerated && shift.autoSource === SOURCE));
    });
    holiday.staffDays = holiday.staffDays.filter(item => !(item.autoSource === SOURCE && item.date.startsWith(month)));

    const closures = new Set(holiday.companyClosures.filter(item => item.date.startsWith(month)).map(item => item.date));
    const fullTime = staff.filter(person => person.active !== false && person.employmentType === '正社員');

    fullTime.forEach(person => {
      const currentOff = holidayRecords(holiday, person.id, month, 'off');
      if (currentOff.length > MONTHLY_OFF_TARGET) notes.push(`${person.name || person.id}：公休が${currentOff.length}日あります（基本8日）。`);
      if (options.autoOff !== false && currentOff.length < MONTHLY_OFF_TARGET) {
        const added = fillOffDays(holiday, working, person, month, MONTHLY_OFF_TARGET - currentOff.length, closures);
        if (added.length) notes.push(`${person.name || person.id}：公休を${added.length}日自動補完。`);
      }
    });

    staff.forEach(person => daysInMonth(month).forEach(date => {
      const type = holidayType(holiday, person.id, date);
      if (type && hasShift(working, person.id, date)) conflicts.push({ date, type, message: `${date} ${person.name || person.id}：${typeLabel(type)}と既存シフトが重複` });
    }));
    closures.forEach(date => { const rows = working[date] || []; if (rows.length) conflicts.push({ date, type: 'company_closure', message: `${date}：会社休業日に既存シフト ${rows.length}件` }); });

    const proposals = [];
    const context = { month, staff, skills, requirements, stores, plans, agreement, approvals, audit, working, holiday, proposals, notes };

    daysInMonth(month).forEach(date => {
      if (closures.has(date) || isConfirmed(audit, date)) return;
      const rules = applicableRules(requirements, skills, date).filter(rule => options.includeSoft || rule.mode !== 'soft');
      fillStage(context, date, rules, 'employee');
      fillStage(context, date, rules, 'parttime');
    });

    const shortages = [];
    daysInMonth(month).forEach(date => {
      if (closures.has(date) || isConfirmed(audit, date)) return;
      applicableRules(requirements, skills, date).filter(rule => options.includeSoft || rule.mode !== 'soft').forEach(rule => {
        const result = shortageResult(context, date, rule);
        if (result.shortage > 0) shortages.push({ date, ...result });
      });
    });

    const people = fullTime.map(person => personSummary(context, person, month));
    return {
      month, shifts: working, holiday, proposals, shortages, conflicts, notes, people,
      closures: Array.from(closures),
      employeeProposals: proposals.filter(item => item.autoStage === 'employee'),
      parttimeProposals: proposals.filter(item => item.autoStage === 'parttime'),
      emergency: proposals.filter(item => item.emergencyCall),
      paidLeaveCount: holiday.staffDays.filter(item => item.type === 'paid_leave' && item.date.startsWith(month)).length,
      generatedOffCount: holiday.staffDays.filter(item => item.type === 'off' && item.autoSource === SOURCE && item.date.startsWith(month)).length,
    };
  }

  function fillOffDays(holiday, shifts, person, month, need, closures) {
    const selected = holidayRecords(holiday, person.id, month, 'off').map(item => item.date);
    const candidates = daysInMonth(month).filter(date => !closures.has(date) && !holidayType(holiday, person.id, date) && !hasShift(shifts, person.id, date));
    const added = [];
    while (added.length < need && candidates.length) {
      candidates.sort((a, b) => offDayScore(person, b, [...selected, ...added]) - offDayScore(person, a, [...selected, ...added]) || a.localeCompare(b));
      added.push(candidates.shift());
    }
    added.filter(Boolean).forEach(date => holiday.staffDays.push({ id: uid('off'), staffId: person.id, date, type: 'off', autoSource: SOURCE, createdAt: new Date().toISOString(), createdBy: actorName() }));
    return added.filter(Boolean);
  }

  function offDayScore(person, date, selected) {
    const dayKey = String(new Date(`${date}T00:00:00`).getDay());
    const c = person.workConstraints || {};
    let score = 0;
    if (Array.isArray(c.fixedOffDays) && c.fixedOffDays.includes(dayKey)) score += 1000;
    if (Array.isArray(c.availableDays) && c.availableDays.length && !c.availableDays.includes(dayKey)) score += 800;
    const distance = selected.length ? Math.min(...selected.map(other => Math.abs(dayDistance(date, other)))) : 7;
    score += Math.min(7, distance) * 25;
    if (selected.some(other => Math.abs(dayDistance(date, other)) <= 1)) score -= 180;
    return score;
  }

  function fillStage(context, date, rules, stage) {
    const ordered = rules.slice().sort((a, b) => Number(a.mode === 'soft') - Number(b.mode === 'soft') || Number(b.minLevel) - Number(a.minLevel) || Number(b.count) - Number(a.count) || Number(a.start) - Number(b.start));
    ordered.forEach(rule => {
      for (let slotStart = Number(rule.start); slotStart < Number(rule.end); slotStart += SLOT) {
        const slotEnd = Math.min(Number(rule.end), slotStart + SLOT);
        let qualified = qualifiedIds(context, date, rule, slotStart, slotEnd).size;
        let guard = 0;
        while (qualified < Number(rule.count) && guard++ < 40) {
          const candidate = chooseCandidate(context, date, stage, rule, slotStart, slotEnd);
          if (!candidate) break;
          addProposal(context, date, candidate, rule, slotStart, slotEnd, stage);
          qualified = qualifiedIds(context, date, rule, slotStart, slotEnd).size;
        }
      }
    });
  }

  function chooseCandidate(context, date, stage, rule, slotStart, slotEnd) {
    const qualified = qualifiedIds(context, date, rule, slotStart, slotEnd);
    const candidates = context.staff.filter(person => {
      if (!person.id || person.active === false || person.autoAssign === false || !matchesStage(person, stage)) return false;
      if (qualified.has(person.id) || skillLevel(person, rule.skillId) < Number(rule.minLevel) || !storeAllowed(person, rule.storeId)) return false;
      if (isUnavailable(context.holiday, person.id, date) || !dayConstraintAllows(person, date) || hasShift(context.working, person.id, date)) return false;
      if (!slotWithinAvailability(person, slotStart, slotEnd) || weekWorkDays(context.working, person.id, date) >= maxDaysPerWeek(person)) return false;
      const window = initialWindow(context, person, rule, slotStart, slotEnd, stage);
      return Boolean(window && plannedWorkMinutes(window) <= DAILY_PLANNED_LIMIT && withinOvertimeCap(context, person, date, window));
    });
    candidates.sort((a, b) => candidateScore(context, b, date, rule, stage) - candidateScore(context, a, date, rule, stage) || String(a.name || '').localeCompare(String(b.name || ''), 'ja'));
    return candidates[0] || null;
  }

  function addProposal(context, date, person, rule, slotStart, slotEnd, stage) {
    if (context.proposals.some(item => item.date === date && item.staffId === person.id)) return;
    const window = initialWindow(context, person, rule, slotStart, slotEnd, stage);
    if (!window) return;
    const weekDays = weekWorkDays(context.working, person.id, date);
    const target = emergencyTarget(context.plans, person);
    const priorEmergency = context.proposals.filter(item => item.staffId === person.id && item.emergencyCall).length;
    const emergencyCall = person.workPlanId === 'B' && weekDays >= preferredDaysPerWeek(person) && priorEmergency < target;
    const skill = context.skills.find(item => item.id === rule.skillId);
    const proposal = {
      id: uid('mauto'), staffId: person.id, startStoreId: rule.storeId, start: window.start, end: window.end,
      memo: `${emergencyCall ? '臨時招集 / ' : ''}月間AUTO: ${skill?.name || rule.skillId} Lv${rule.minLevel}`,
      autoGenerated: true, autoSource: SOURCE, autoStage: stage, autoMonth: context.month,
      emergencyCall, emergencyCallReason: emergencyCall ? 'Bプラン・週の通常勤務日数を超える補完配置' : '',
      autoCreatedAt: new Date().toISOString(), autoReasons: [`${skill?.name || rule.skillId} Lv${rule.minLevel} ${fmtTime(rule.start)}-${fmtTime(rule.end)}`],
    };
    context.proposals.push({ ...proposal, date });
    context.working[date].push(proposal);
  }

  function initialWindow(context, person, rule, slotStart, slotEnd, stage) {
    const c = person.workConstraints || {};
    const availableStart = Number.isFinite(Number(c.availableStart)) ? Number(c.availableStart) : PLAN_MIN;
    const availableEnd = Number.isFinite(Number(c.availableEnd)) ? Number(c.availableEnd) : PLAN_MAX;
    if (availableEnd <= availableStart || slotStart < availableStart || slotEnd > availableEnd) return null;
    const desired = stage === 'employee' ? DAILY_PLANNED_LIMIT : Math.max(4 * 60, Math.min(6 * 60, Number(rule.end) - Number(rule.start)));
    const binding = desired >= 8 * 60 ? desired + 60 : desired >= 6 * 60 ? desired + 45 : desired;
    const store = context.stores.find(item => item.id === rule.storeId);
    let start = Math.max(availableStart, Number(rule.start));
    let end = Math.min(availableEnd, start + binding);
    if (rule.skillId === 'closing') { end = Math.min(availableEnd, Math.max(Number(rule.end), Number(store?.close || rule.end))); start = Math.max(availableStart, end - binding); }
    else { end = Math.min(availableEnd, Math.max(Number(rule.end), start + binding)); if (end - start < binding) start = Math.max(availableStart, end - binding); }
    start = snap(Math.max(PLAN_MIN, start)); end = snap(Math.min(PLAN_MAX, end));
    if (start > slotStart || end < slotEnd || end <= start) return null;
    return { start, end };
  }

  function withinOvertimeCap(context, person, date, window) {
    const month = date.slice(0, 7);
    const cap = allowedOvertimeHours(context, person, month);
    const test = clone(context.working);
    test[date] = Array.isArray(test[date]) ? test[date] : [];
    test[date].push({ staffId: person.id, start: window.start, end: window.end, startStoreId: '' });
    return plannedOvertimeForMonth(test, person.id, month) <= cap * 60 + 0.001;
  }

  function allowedOvertimeHours(context, person, month) {
    const internal = Number(context.plans?.common?.operationalOvertimeCapHours ?? DEFAULT_INTERNAL_CAP);
    const approved = latestApproved(context.approvals, person.id, month);
    const ordinary = Number(context.agreement?.ordinaryMonthlyLimitHours ?? 45);
    const hard = context.agreement?.specialClauseEnabled ? Number(context.agreement?.specialMonthlyLimitHours ?? ordinary) : ordinary;
    return Math.max(0, Math.min(approved ? Number(approved.requestedLimitHours || internal) : internal, hard));
  }

  function candidateScore(context, person, date, rule, stage) {
    let score = skillLevel(person, rule.skillId) * 140;
    if (person.mainStoreId === rule.storeId) score += 60; else if ((person.affiliationStoreIds || []).includes(rule.storeId)) score += 35;
    if (stage === 'employee' && person.employmentType === '正社員') score += 40;
    const weekDays = weekWorkDays(context.working, person.id, date);
    const preferred = preferredDaysPerWeek(person);
    score += weekDays < preferred ? (preferred - weekDays) * 28 : -(weekDays - preferred + 1) * 35;
    if (person.workPlanId === 'B' && weekDays >= preferred && context.proposals.filter(item => item.staffId === person.id && item.emergencyCall).length < emergencyTarget(context.plans, person)) score += 55;
    score -= workDaysInMonth(context.working, person.id, context.month) * 2;
    score -= plannedOvertimeForMonth(context.working, person.id, context.month) / 45;
    return score;
  }

  function emergencyTarget(plans, person) { return Math.max(0, Number(plans?.[person.workPlanId]?.emergencyCallTarget || 0)); }

  function qualifiedIds(context, date, rule, slotStart, slotEnd) {
    const ids = new Set();
    (context.working[date] || []).forEach(shift => {
      const person = context.staff.find(item => item.id === String(shift.staffId || '').toUpperCase());
      if (!person || skillLevel(person, rule.skillId) < Number(rule.minLevel)) return;
      if (deriveSegments(shift, context.stores).some(segment => segment.storeId === rule.storeId && segment.start <= slotStart && segment.end >= slotEnd)) ids.add(person.id);
    });
    return ids;
  }

  function shortageResult(context, date, rule) {
    let minimum = Infinity;
    for (let start = Number(rule.start); start < Number(rule.end); start += SLOT) minimum = Math.min(minimum, qualifiedIds(context, date, rule, start, Math.min(Number(rule.end), start + SLOT)).size);
    if (!Number.isFinite(minimum)) minimum = 0;
    return { rule, minimum, shortage: Math.max(0, Number(rule.count) - minimum) };
  }

  function applicableRules(requirements, skills, date) {
    const activeSkills = new Set(skills.filter(skill => skill.active !== false).map(skill => skill.id));
    const active = requirements.filter(rule => rule.active !== false && activeSkills.has(rule.skillId) && dayMatches(rule, date));
    const specific = new Set(active.filter(rule => rule.dayType === 'specific' && rule.specificDate === date).map(ruleKey));
    return active.filter(rule => rule.dayType === 'specific' || !specific.has(ruleKey(rule)));
  }

  function dayMatches(rule, date) { const day = new Date(`${date}T00:00:00`).getDay(); if (rule.dayType === 'specific') return rule.specificDate === date; if (rule.dayType === 'weekday') return day >= 1 && day <= 4; if (rule.dayType === 'fri_sat') return day === 5 || day === 6; if (rule.dayType === 'sun') return day === 0; return true; }
  function ruleKey(rule) { return `${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`; }

  function personSummary(context, person, month) {
    const off = holidayRecords(context.holiday, person.id, month, 'off').length;
    const paid = holidayRecords(context.holiday, person.id, month, 'paid_leave').length;
    const companyClosures = context.holiday.companyClosures.filter(item => item.date.startsWith(month)).length;
    return { staffId: person.id, name: person.name || person.id, plan: person.workPlanId || '', off, paid, prescribedDays: Math.max(0, daysInMonth(month).length - companyClosures - off), shifts: workDaysInMonth(context.working, person.id, month), overtimeMinutes: plannedOvertimeForMonth(context.working, person.id, month), allowedOvertimeHours: allowedOvertimeHours(context, person, month), emergency: context.proposals.filter(item => item.staffId === person.id && item.emergencyCall).length };
  }

  function renderPreview() {
    const summary = document.getElementById('month-builder-summary'); const body = document.getElementById('month-builder-body'); const apply = document.getElementById('month-builder-apply');
    if (!summary || !body || !state.preview) return; const p = state.preview;
    summary.innerHTML = `${metric('会社休業', `${p.closures.length}日`, '自動配置しない')}${metric('公休自動補完', `${p.generatedOffCount}日`, '正社員・月8休まで')}${metric('社員AUTO', `${p.employeeProposals.length}件`, `臨時招集 ${p.emergency.length}件`)}${metric('バイトAUTO', `${p.parttimeProposals.length}件`, '不足スキルを補完')}${metric('残る不足', `${p.shortages.length}件`, '要確認')}${metric('有休', `${p.paidLeaveCount}件`, '公休8日とは別枠')}`;
    const personRows = p.people.map(item => `<tr class="${item.overtimeMinutes > item.allowedOvertimeHours * 60 ? 'danger' : item.overtimeMinutes > 25 * 60 ? 'warn' : ''}"><td><strong>${esc(item.name)}</strong><small>${esc(item.staffId)} ${item.plan ? '・' + esc(item.plan) + 'プラン' : ''}</small></td><td>${item.off}/8</td><td>${item.paid}</td><td>${item.prescribedDays}日</td><td>${item.shifts}日</td><td>${formatHours(item.overtimeMinutes)}h / ${item.allowedOvertimeHours}h</td><td>${item.emergency}</td></tr>`).join('');
    const shortages = p.shortages.slice(0, 80).map(item => { const store = loadStores().find(s => s.id === item.rule.storeId); const skill = loadArray(SKILLS_KEY).find(s => s.id === item.rule.skillId); return `<div class="month-shortage ${item.rule.mode === 'soft' ? 'soft' : 'hard'}"><b>${esc(item.date)} ${esc(store?.name || item.rule.storeId)}</b><span>${fmtTime(item.rule.start)}-${fmtTime(item.rule.end)} ${esc(skill?.name || item.rule.skillId)} Lv${item.rule.minLevel}：${item.minimum}/${item.rule.count}</span></div>`; }).join('');
    const conflictHtml = p.conflicts.length ? `<div class="month-warning-box danger"><strong>既存データとの重複 ${p.conflicts.length}件</strong>${p.conflicts.slice(0, 20).map(item => `<div>${esc(item.message)}</div>`).join('')}</div>` : '';
    const noteHtml = p.notes.length ? `<div class="month-warning-box"><strong>自動調整メモ</strong>${p.notes.slice(0, 30).map(note => `<div>${esc(note)}</div>`).join('')}</div>` : '';
    body.innerHTML = `${conflictHtml}${noteHtml}<section class="month-builder-section"><h3>正社員 月間サマリー</h3><div class="month-table-wrap"><table class="month-table"><thead><tr><th>従業員</th><th>公休</th><th>有休</th><th>所定日</th><th>配置日</th><th>予定時間外 / 許容</th><th>臨時招集</th></tr></thead><tbody>${personRows || '<tr><td colspan="7">正社員がいません。</td></tr>'}</tbody></table></div></section><section class="month-builder-section"><h3>配置後も残る不足</h3><div class="month-shortages">${shortages || '<div class="month-all-clear"><i class="fa-solid fa-circle-check"></i> 対象ルールは充足しています。</div>'}</div></section><div class="month-builder-assumption">会社休業・公休・有休・勤務可能曜日/時間・週最大勤務日数・配置可能店舗・スキル・既存シフト・標準休憩・30h運用ライン/承認済み例外上限を使います。固定残業A25h/B45hは配置上限に使いません。</div>`;
    if (apply) apply.disabled = p.conflicts.some(item => ['company_closure', 'paid_leave', 'off'].includes(item.type));
  }

  function metric(label, value, sub) { return `<div class="month-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`; }

  async function applyPreview() {
    const p = state.preview; if (!p) return;
    if (p.conflicts.some(item => ['company_closure', 'paid_leave', 'off'].includes(item.type))) return window.alert('会社休業・公休・有休と既存シフトの重複があります。先に重複を解消してください。既存シフトは自動削除しません。');
    if (!window.confirm(`${p.month} の月間AUTOを反映します。\n社員 ${p.employeeProposals.length}件 / バイト ${p.parttimeProposals.length}件 / 公休自動補完 ${p.generatedOffCount}日\n既存の手入力シフトは変更しません。`)) return;
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(p.shifts)); localStorage.setItem(HOLIDAY_KEY, JSON.stringify(p.holiday));
    try { if (window.shiftV2Cloud && window.shiftV2User) await Promise.all([window.shiftV2Cloud.set(CLOUD_SHIFTS, p.shifts), window.shiftV2Cloud.set(CLOUD_HOLIDAYS, p.holiday)]); } catch (error) { console.warn('Month builder cloud save failed', error); }
    sessionStorage.setItem('okk_shift_v2_month_restore_date', `${p.month}-01`); notify(`月間AUTOを反映：社員${p.employeeProposals.length} / バイト${p.parttimeProposals.length}`); closeModal(); setTimeout(() => window.location.reload(), 350);
  }

  async function clearMonthGenerated() {
    const month = document.getElementById('month-builder-month')?.value || state.month; if (!month) return;
    const shifts = loadJson(SHIFTS_KEY, {}); const holiday = normalizeHoliday(loadJson(HOLIDAY_KEY, {})); let shiftCount = 0;
    Object.keys(shifts).filter(date => date.startsWith(month)).forEach(date => { if (!Array.isArray(shifts[date])) return; const before = shifts[date].length; shifts[date] = shifts[date].filter(item => !(item.autoGenerated && item.autoSource === SOURCE)); shiftCount += before - shifts[date].length; });
    const beforeOff = holiday.staffDays.length; holiday.staffDays = holiday.staffDays.filter(item => !(item.autoSource === SOURCE && item.date.startsWith(month))); const offCount = beforeOff - holiday.staffDays.length;
    if (!shiftCount && !offCount) return notify('この月に月間AUTOデータはありません');
    if (!window.confirm(`${month} の月間AUTOだけを取り消します。\nシフト ${shiftCount}件 / 自動公休 ${offCount}日\n手入力・有休・会社休業は残します。`)) return;
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts)); localStorage.setItem(HOLIDAY_KEY, JSON.stringify(holiday));
    try { if (window.shiftV2Cloud && window.shiftV2User) await Promise.all([window.shiftV2Cloud.set(CLOUD_SHIFTS, shifts), window.shiftV2Cloud.set(CLOUD_HOLIDAYS, holiday)]); } catch (error) { console.warn('Clear month builder cloud save failed', error); }
    sessionStorage.setItem('okk_shift_v2_month_restore_date', `${month}-01`); notify('この月の月間AUTOを取り消しました'); closeModal(); setTimeout(() => window.location.reload(), 350);
  }

  function restoreAfterApply() { const date = sessionStorage.getItem('okk_shift_v2_month_restore_date'); if (!date) return; sessionStorage.removeItem('okk_shift_v2_month_restore_date'); setTimeout(() => { const input = document.getElementById('work-date'); if (input) { input.value = date; input.dispatchEvent(new Event('change', { bubbles: true })); } }, 180); }

  function plannedOvertimeForMonth(shifts, staffId, month) {
    const start = `${month}-01`, end = lastDateOfMonth(month), days = dailyWorkMap(shifts, staffId), first = weekRange(start).start, last = weekRange(end).end;
    let cursor = new Date(`${first}T00:00:00`), lastDate = new Date(`${last}T00:00:00`), total = 0, weekRegular = 0;
    while (cursor <= lastDate) { const date = dateKey(cursor); if (cursor.getDay() === 1) weekRegular = 0; const work = Number(days[date] || 0); const dailyRegular = Math.min(work, DAILY_PLANNED_LIMIT); const dailyOver = Math.max(0, work - DAILY_PLANNED_LIMIT); const weeklyRoom = Math.max(0, WEEKLY_REGULAR_LIMIT - weekRegular); const weeklyOver = Math.max(0, dailyRegular - weeklyRoom); weekRegular += dailyRegular - weeklyOver; if (date >= start && date <= end) total += dailyOver + weeklyOver; cursor.setDate(cursor.getDate() + 1); }
    return total;
  }

  function dailyWorkMap(shifts, staffId) { const id = String(staffId || '').toUpperCase(), map = {}; Object.entries(shifts || {}).forEach(([date, rows]) => { if (!Array.isArray(rows)) return; rows.forEach(shift => { if (String(shift.staffId || '').toUpperCase() === id) map[date] = (map[date] || 0) + plannedWorkMinutes(shift); }); }); return map; }
  function plannedWorkMinutes(shift) { const binding = Math.max(0, Number(shift.end) - Number(shift.start)); return Math.max(0, binding - (binding >= 9 * 60 ? 60 : binding >= 6 * 60 + 45 ? 45 : 0)); }
  function weekWorkDays(shifts, staffId, date) { const range = weekRange(date); return daysBetween(range.start, range.end).filter(day => hasShift(shifts, staffId, day)).length; }
  function workDaysInMonth(shifts, staffId, month) { return daysInMonth(month).filter(date => hasShift(shifts, staffId, date)).length; }
  function dayConstraintAllows(person, date) { const c = person.workConstraints || {}, day = String(new Date(`${date}T00:00:00`).getDay()); if (Array.isArray(c.fixedOffDays) && c.fixedOffDays.includes(day)) return false; if (Array.isArray(c.availableDays) && c.availableDays.length && !c.availableDays.includes(day)) return false; return true; }
  function slotWithinAvailability(person, start, end) { const c = person.workConstraints || {}, min = Number.isFinite(Number(c.availableStart)) ? Number(c.availableStart) : PLAN_MIN, max = Number.isFinite(Number(c.availableEnd)) ? Number(c.availableEnd) : PLAN_MAX; return start >= min && end <= max; }
  function preferredDaysPerWeek(person) { const n = Number(person.workConstraints?.preferredDaysPerWeek); return Number.isFinite(n) && n > 0 ? Math.min(7, n) : (person.employmentType === '正社員' || person.employmentType === '契約社員' ? 5 : 4); }
  function maxDaysPerWeek(person) { const n = Number(person.workConstraints?.maxDaysPerWeek); return Number.isFinite(n) && n > 0 ? Math.min(7, n) : (person.employmentType === '正社員' || person.employmentType === '契約社員' ? 6 : 5); }
  function matchesStage(person, stage) { return stage === 'employee' ? person.employmentType === '正社員' || person.employmentType === '契約社員' : person.employmentType === 'アルバイト'; }
  function storeAllowed(person, storeId) { const list = Array.isArray(person.placementStoreIds) && person.placementStoreIds.length ? person.placementStoreIds : Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : []; return !list.length || list.includes(storeId); }
  function skillLevel(person, skillId) { const n = Number(person.skillLevels?.[skillId] || 0); return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0; }
  function deriveSegments(shift, stores) { const store = stores.find(item => item.id === shift.startStoreId), start = Number(shift.start), end = Number(shift.end); if (!store) return [{ storeId: shift.startStoreId, start, end }]; if (store.autoJoin && store.joinTarget && end > Number(store.close)) return start >= Number(store.close) ? [{ storeId: store.joinTarget, start, end }] : [{ storeId: store.id, start, end: Number(store.close) }, { storeId: store.joinTarget, start: Number(store.close), end }]; return [{ storeId: store.id, start, end }]; }
  function isUnavailable(holiday, staffId, date) { return holiday.companyClosures.some(item => item.date === date) || Boolean(holidayType(holiday, staffId, date)); }
  function holidayType(holiday, staffId, date) { const id = String(staffId || '').toUpperCase(); return holiday.staffDays.find(item => String(item.staffId || '').toUpperCase() === id && item.date === date)?.type || ''; }
  function holidayRecords(holiday, staffId, month, type) { const id = String(staffId || '').toUpperCase(); return holiday.staffDays.filter(item => String(item.staffId || '').toUpperCase() === id && item.date.startsWith(month) && (!type || item.type === type)); }
  function hasShift(shifts, staffId, date) { const id = String(staffId || '').toUpperCase(); return (Array.isArray(shifts?.[date]) ? shifts[date] : []).some(shift => String(shift.staffId || '').toUpperCase() === id); }
  function isConfirmed(audit, date) { return Boolean(audit?.dayStatus?.[date]?.confirmed); }
  function latestApproved(approvals, staffId, month) { const id = String(staffId || '').toUpperCase(); return approvals.filter(item => String(item.staffId || '').toUpperCase() === id && item.month === month && item.status === 'approved').sort((a, b) => String(b.decidedAt || b.requestedAt || '').localeCompare(String(a.decidedAt || a.requestedAt || '')))[0] || null; }

  function loadStaff() { return loadArray(STAFF_KEY).map(person => ({ ...person, id: String(person.id || person.employeeNumber || '').toUpperCase(), name: person.name || `${person.lastName || ''} ${person.firstName || ''}`.trim(), employmentType: person.employmentType || (person.salaryType === 'monthly' ? '正社員' : 'アルバイト'), active: typeof person.active === 'boolean' ? person.active : true, skillLevels: { ...(person.skillLevels || {}) } })).filter(person => person.id); }
  function loadStores() { const list = loadJson(STORES_KEY, DEFAULT_STORES); return Array.isArray(list) && list.length ? list : DEFAULT_STORES; }
  function normalizeHoliday(value) { const s = value && typeof value === 'object' ? value : {}; return { companyClosures: Array.isArray(s.companyClosures) ? s.companyClosures.map(item => typeof item === 'string' ? { date: item, label: '会社休業日' } : item).filter(item => item?.date) : [], staffDays: Array.isArray(s.staffDays) ? s.staffDays.filter(item => item?.staffId && item?.date && ['off','paid_leave'].includes(item.type)) : [], updatedAt: s.updatedAt || '', updatedBy: s.updatedBy || '' }; }
  function loadArray(key) { const v = loadJson(key, []); return Array.isArray(v) ? v : []; }
  function typeLabel(type) { return { off:'公休', paid_leave:'有休', company_closure:'会社休業' }[type] || type; }
  function formatHours(minutes) { const h = Math.max(0, Number(minutes) || 0) / 60; return Number.isInteger(h) ? String(h) : h.toFixed(1); }
  function fmtTime(total) { const v = Number(total), next = v >= 1440, h = Math.floor(v / 60) % 24, m = v % 60; return `${next ? '翌' : ''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function snap(value) { return Math.round(Number(value) / SLOT) * SLOT; }
  function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`; }
  function actorName() { return window.shiftV2User?.displayName || window.shiftV2User?.email || 'ローカル利用者'; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? clone(fallback); } catch { return clone(fallback); } }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[char])); }
  function currentMonth() { const value = document.getElementById('work-date')?.value; if (value) return value.slice(0,7); const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; }
  function daysInMonth(month) { const [year, monthNo] = month.split('-').map(Number), last = new Date(year, monthNo, 0).getDate(); return Array.from({ length:last }, (_,i) => `${month}-${String(i+1).padStart(2,'0')}`); }
  function lastDateOfMonth(month) { const [year, monthNo] = month.split('-').map(Number); return dateKey(new Date(year, monthNo, 0)); }
  function weekRange(date) { const d = new Date(`${date}T00:00:00`), day = d.getDay(), monday = new Date(d); monday.setDate(d.getDate() + (day === 0 ? -6 : 1-day)); const sunday = new Date(monday); sunday.setDate(monday.getDate()+6); return { start:dateKey(monday), end:dateKey(sunday) }; }
  function daysBetween(start,end) { const result=[], cursor=new Date(`${start}T00:00:00`), last=new Date(`${end}T00:00:00`); while (cursor<=last) { result.push(dateKey(cursor)); cursor.setDate(cursor.getDate()+1); } return result; }
  function dayDistance(a,b) { return (new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000; }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function notify(message) { const toast=document.getElementById('toast'); if (!toast) return window.alert(message); toast.textContent=message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2200); }

  function injectStyles() {
    if (document.getElementById('month-builder-style')) return;
    const style = document.createElement('style'); style.id = 'month-builder-style';
    style.textContent = `.month-builder-toolbar{display:flex;align-items:center;gap:6px;margin-left:8px;padding-left:9px;border-left:1px solid #e4e7ec}.month-builder-toolbar>span{font-size:7px;color:#667085;font-weight:800}.month-builder-bg{display:none;position:fixed;inset:0;z-index:2100;background:rgba(16,24,40,.68);align-items:center;justify-content:center;padding:18px}.month-builder-bg.open{display:flex}.month-builder-modal{width:min(1120px,98vw);max-height:95vh;background:#fff;border-radius:15px;box-shadow:0 28px 80px rgba(16,24,40,.34);display:flex;flex-direction:column;overflow:hidden}.month-builder-head{display:flex;justify-content:space-between;gap:12px;padding:15px 18px;border-bottom:1px solid #e4e7ec}.month-builder-kicker{font-size:7px;font-weight:900;letter-spacing:.13em;color:#667085}.month-builder-head h2{font-size:19px;margin:1px 0}.month-builder-head p{font-size:8px;color:#667085;margin:0}.month-builder-controls{display:flex;align-items:center;gap:13px;padding:10px 18px;background:#fcfcfd;border-bottom:1px solid #eaecf0;font-size:8px;font-weight:900;color:#475467}.month-builder-controls label{display:flex;align-items:center;gap:5px}.month-builder-controls input[type=checkbox]{width:auto}.month-builder-notice{padding:7px 18px;background:#f8fafc;color:#667085;font-size:8px}.month-builder-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;padding:10px 18px}.month-metric{border:1px solid #e4e7ec;border-radius:9px;padding:8px 9px}.month-metric small,.month-metric span{display:block;font-size:7px;color:#667085}.month-metric strong{display:block;font-size:16px;margin:1px 0}.month-builder-body{padding:0 18px 14px;overflow:auto}.month-warning-box{padding:8px 10px;border-radius:8px;background:#fffaeb;color:#93370d;font-size:8px;margin-bottom:7px}.month-warning-box.danger{background:#fef3f2;color:#b42318}.month-warning-box strong{display:block;margin-bottom:3px}.month-builder-section{margin-top:10px}.month-builder-section h3{font-size:10px;color:#344054;margin:0 0 6px}.month-table-wrap{overflow:auto;border:1px solid #eaecf0;border-radius:9px}.month-table{width:100%;border-collapse:collapse;font-size:8px}.month-table th{background:#f8fafc;padding:7px;color:#475467;white-space:nowrap}.month-table td{padding:7px;border-top:1px solid #f2f4f7;text-align:center}.month-table td:first-child{text-align:left}.month-table td:first-child strong{display:block;font-size:9px}.month-table td:first-child small{display:block;font-size:7px;color:#98a2b3}.month-table tr.warn{background:#fffcf5}.month-table tr.danger{background:#fffbfa;color:#b42318}.month-shortages{display:flex;gap:5px;flex-wrap:wrap}.month-shortage{display:flex;flex-direction:column;padding:6px 7px;border:1px solid #fecdca;border-left:3px solid #f04438;border-radius:8px;background:#fff5f4}.month-shortage.soft{border-color:#fedf89;border-left-color:#f79009;background:#fffaeb}.month-shortage b,.month-shortage span{font-size:7px}.month-all-clear{padding:9px 10px;border-radius:8px;background:#ecfdf3;color:#05603a;font-size:9px;font-weight:900}.month-builder-assumption{margin-top:12px;padding:8px 10px;border-radius:8px;background:#f8fafc;color:#667085;font-size:8px;line-height:1.6}.month-builder-foot{display:flex;justify-content:space-between;gap:8px;padding:10px 18px;border-top:1px solid #e4e7ec}.month-builder-danger{background:#fff;color:#b42318;border-color:#fecdca}@media(max-width:1000px){.month-builder-summary{grid-template-columns:repeat(3,1fr)}.month-builder-controls{align-items:flex-start;flex-wrap:wrap}.month-builder-toolbar>span{display:none}}`;
    document.head.appendChild(style);
  }
})();