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

  const FALLBACK_REQUIREMENTS = [
    req('matsuyama','all',17,23,'hall',1,3), req('matsuyama','all',17,23,'meat',2,1), req('matsuyama','all',17,23,'salad',1,1), req('matsuyama','all',17,23,'drink',1,1), req('matsuyama','all',23,30,'hall',1,2), req('matsuyama','all',23,30,'meat',2,1), req('matsuyama','all',25,30,'closing',2,1),
    req('kumoji','all',17,22,'hall',1,3), req('kumoji','all',17,22,'meat',2,1), req('kumoji','all',17,22,'salad',1,1), req('kumoji','all',17,22,'drink',1,1), req('kumoji','all',22,25,'hall',1,2), req('kumoji','all',24,25,'closing',2,1),
    req('miebashi','all',17,22,'hall',1,2), req('miebashi','all',17,22,'meat',2,1), req('miebashi','all',17,22,'drink',1,1), req('miebashi','all',22,25,'hall',1,2), req('miebashi','all',24,25,'closing',2,1),
    req('misato','all',17,22,'hall',1,2), req('misato','all',17,22,'meat',2,1), req('misato','all',17,22,'salad',1,1), req('misato','all',17,22,'drink',1,1), req('misato','all',22,26,'hall',1,2), req('misato','all',25,26,'closing',2,1),
  ];

  let plan = null;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    injectButton();
    injectModal();
    bind();
  }

  function injectButton() {
    if (document.getElementById('simple-autofill-open')) return;
    const toolbar = document.querySelector('#view-planner .toolbar-left') || document.querySelector('#view-planner .toolbar');
    if (!toolbar) return;
    const button = document.createElement('button');
    button.id = 'simple-autofill-open';
    button.type = 'button';
    button.className = 'btn btn-green';
    button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 1日を自動補完';
    toolbar.appendChild(button);
  }

  function injectModal() {
    if (document.getElementById('simple-autofill-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'simple-autofill-modal';
    modal.className = 'autofill-modal-bg';
    modal.innerHTML = `
      <div class="autofill-modal" role="dialog" aria-modal="true">
        <div class="autofill-modal-head">
          <div><strong>1日を自動補完</strong><span id="autofill-date-label"></span></div>
          <button type="button" class="btn btn-light btn-small" data-autofill-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="autofill-modal-body">
          <div class="autofill-policy">
            <i class="fa-solid fa-shield-halved"></i>
            <div><strong>勝手には確定しません</strong><span>必須不足だけを対象に、既存シフト延長を優先して提案します。配置可能店舗・勤務可能時間・未成年22時・最大勤務日数/時間を守れる候補だけ使います。</span></div>
          </div>
          <div id="autofill-result"></div>
        </div>
        <div class="autofill-modal-foot">
          <button type="button" id="autofill-undo" class="btn btn-light" style="display:none"><i class="fa-solid fa-rotate-left"></i>直前の自動補完を元に戻す</button>
          <div style="margin-left:auto;display:flex;gap:7px">
            <button type="button" id="autofill-regenerate" class="btn btn-light"><i class="fa-solid fa-rotate"></i>提案を作り直す</button>
            <button type="button" id="autofill-apply" class="btn btn-green" disabled><i class="fa-solid fa-check"></i>提案を一括反映</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function bind() {
    document.getElementById('simple-autofill-open')?.addEventListener('click', openModal);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-autofill-close]')) closeModal();
      if (event.target.id === 'simple-autofill-modal') closeModal();
    });
    document.getElementById('autofill-regenerate')?.addEventListener('click', generateAndRender);
    document.getElementById('autofill-apply')?.addEventListener('click', applyPlan);
    document.getElementById('autofill-undo')?.addEventListener('click', undoLastApply);
  }

  function openModal() {
    const modal = document.getElementById('simple-autofill-modal');
    if (!modal) return;
    modal.classList.add('open');
    generateAndRender();
  }

  function closeModal() {
    document.getElementById('simple-autofill-modal')?.classList.remove('open');
  }

  function generateAndRender() {
    const date = currentDate();
    document.getElementById('autofill-date-label').textContent = date.replaceAll('-', '/');
    const result = document.getElementById('autofill-result');
    const apply = document.getElementById('autofill-apply');
    const undo = document.getElementById('autofill-undo');
    if (!result || !apply || !undo) return;

    result.innerHTML = '<div class="autofill-loading"><i class="fa-solid fa-spinner fa-spin"></i>不足と候補を計算しています...</div>';
    apply.disabled = true;
    undo.style.display = sessionStorage.getItem(undoKey(date)) ? '' : 'none';

    setTimeout(() => {
      plan = buildPlan(date);
      renderPlan(plan);
    }, 20);
  }

  function buildPlan(date) {
    const data = runtimeData();
    const allOriginal = clone(data.shifts);
    const originalDay = Array.isArray(allOriginal[date]) ? clone(allOriginal[date]) : [];
    const simulatedDay = clone(originalDay);
    const simData = { ...data, shifts:{ ...clone(data.shifts), [date]:simulatedDay } };
    const rules = applicableRequirements(data, date)
      .filter(rule => rule.mode !== 'soft')
      .sort((a,b) => Number(a.start)-Number(b.start) || Number(a.end)-Number(b.end) || Number(b.minLevel||1)-Number(a.minLevel||1));

    const originalHardShortages = countShortages(simData, date, rules);
    const unresolved = [];
    const touched = new Set();
    let safety = 0;

    for (const rule of rules) {
      while (safety++ < 250) {
        const before = evaluateRule(simData, date, rule);
        if (before.shortage <= 0) break;
        const candidates = buildCandidates(simData, data.shifts, date, rule, touched);
        let improved = false;

        for (const candidate of candidates) {
          const snapshot = clone(simulatedDay);
          applyCandidateToDay(simulatedDay, candidate, rule);
          const after = evaluateRule(simData, date, rule);
          if (after.shortage < before.shortage) {
            touched.add(candidate.staffId);
            improved = true;
            break;
          }
          simulatedDay.splice(0, simulatedDay.length, ...snapshot);
        }

        if (!improved) {
          unresolved.push({ rule, shortage:before.shortage });
          break;
        }
      }
    }

    const finalShortages = rules.map(rule => evaluateRule(simData, date, rule)).filter(item => item.shortage > 0);
    const changes = diffDay(originalDay, simulatedDay, data.staff);

    return {
      date,
      originalDay,
      simulatedDay:clone(simulatedDay),
      originalFingerprint:stableString(originalDay),
      changes,
      originalShortageCount:originalHardShortages.length,
      finalShortages,
      unresolved,
      data,
    };
  }

  function buildCandidates(simData, originalAllShifts, date, rule, touched) {
    const skill = skillById(simData, rule.skillId);
    const day = simData.shifts[date] || [];
    const month = date.slice(0,7);
    const list = [];

    simData.staff.forEach(person => {
      if (!person || person.active === false || person.autoAssign === false) return;
      const staffId = String(person.id || person.employeeNumber || '').toUpperCase();
      if (!staffId) return;
      const level = skillLevel(person, skill);
      if (level < Number(rule.minLevel || 1)) return;
      if (!storeAllowed(person, rule.storeId)) return;
      if (isMinorOnDate(person, date) && Number(rule.end) > MINOR_END) return;

      const existing = day.find(shift => sameId(shift.staffId, staffId));
      const monthlyMinutes = scheduledMinutesForMonth(originalAllShifts, staffId, month);
      let score = scorePerson(person, rule, level, monthlyMinutes, simData);
      if (touched.has(staffId)) score += 4;

      if (!existing) {
        if (!availabilityCovers(person, date, Number(rule.start), Number(rule.end))) return;
        if (!weeklyDayLimitAllows(person, originalAllShifts, date, staffId)) return;
        if (!monthlyHourLimitAllows(person, monthlyMinutes, Number(rule.end)-Number(rule.start))) return;
        list.push({ type:'new', staffId, person, score, start:Number(rule.start), end:Number(rule.end), startStoreId:rule.storeId });
        return;
      }

      const extended = extendShiftToCover(existing, rule, simData.stores);
      if (!extended) return;
      if (!availabilityCovers(person, date, extended.start, extended.end)) return;
      if (isMinorOnDate(person, date) && Number(extended.end) > MINOR_END) return;
      const added = Math.max(0, (extended.end-extended.start) - (Number(existing.end)-Number(existing.start)));
      if (!monthlyHourLimitAllows(person, monthlyMinutes, added)) return;
      list.push({ type:'extend', staffId, person, score:score+14, shiftId:existing.id, after:extended });
    });

    return list.sort((a,b) => b.score-a.score || String(a.person.name||'').localeCompare(String(b.person.name||''),'ja'));
  }

  function applyCandidateToDay(day, candidate, rule) {
    if (candidate.type === 'new') {
      day.push({
        id:`sh_auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,
        staffId:candidate.staffId,
        startStoreId:candidate.startStoreId,
        start:candidate.start,
        end:candidate.end,
        memo:'1日自動補完の提案',
      });
      return;
    }
    const target = day.find(shift => shift.id === candidate.shiftId && sameId(shift.staffId, candidate.staffId));
    if (!target) return;
    target.start = candidate.after.start;
    target.end = candidate.after.end;
    target.memo = appendMemo(target.memo, '1日自動補完で時間拡張');
  }

  function diffDay(before, after, staff) {
    const rows = [];
    const beforeMap = new Map(before.map(shift => [String(shift.staffId).toUpperCase(), shift]));
    const afterMap = new Map(after.map(shift => [String(shift.staffId).toUpperCase(), shift]));

    afterMap.forEach((next, staffId) => {
      const prev = beforeMap.get(staffId);
      const person = staff.find(item => sameId(item.id || item.employeeNumber, staffId));
      if (!prev) {
        rows.push({ type:'new', staffId, name:person?.name || staffId, before:null, after:clone(next) });
        return;
      }
      if (Number(prev.start) !== Number(next.start) || Number(prev.end) !== Number(next.end) || prev.startStoreId !== next.startStoreId) {
        rows.push({ type:'extend', staffId, name:person?.name || staffId, before:clone(prev), after:clone(next) });
      }
    });
    return rows.sort((a,b) => Number(a.after.start)-Number(b.after.start) || a.name.localeCompare(b.name,'ja'));
  }

  function renderPlan(value) {
    const result = document.getElementById('autofill-result');
    const apply = document.getElementById('autofill-apply');
    if (!result || !apply || !value) return;

    const resolved = Math.max(0, value.originalShortageCount - value.finalShortages.length);
    apply.disabled = value.changes.length === 0;

    result.innerHTML = `
      <div class="autofill-metrics">
        ${metric('補完前の不足', `${value.originalShortageCount}条件`)}
        ${metric('解消見込み', `${resolved}条件`)}
        ${metric('変更する人', `${value.changes.length}名`)}
        ${metric('残る不足', `${value.finalShortages.length}条件`, value.finalShortages.length ? 'warning' : 'ok')}
      </div>

      <section class="autofill-section">
        <div class="autofill-section-head"><strong>反映予定</strong><span>この内容を確認してから一括反映します</span></div>
        <div class="autofill-change-list">
          ${value.changes.length ? value.changes.map(change => changeCard(change, value.data)).join('') : '<div class="autofill-empty">追加・変更できる候補はありません。</div>'}
        </div>
      </section>

      ${value.finalShortages.length ? `<section class="autofill-section unresolved"><div class="autofill-section-head"><strong>今回だけでは埋まらない不足</strong><span>条件を満たす候補が不足しています</span></div><div class="autofill-unresolved-list">${value.finalShortages.slice(0,10).map(item => unresolvedCard(item, value.data)).join('')}${value.finalShortages.length>10?`<span>ほか ${value.finalShortages.length-10}件</span>`:''}</div></section>` : ''}
    `;
  }

  function changeCard(change, data) {
    const store = storeById(data, change.after.startStoreId);
    const before = change.before ? `${fmt(change.before.start)}-${fmt(change.before.end)}` : '未配置';
    const after = `${fmt(change.after.start)}-${fmt(change.after.end)}`;
    return `<article class="autofill-change-card"><div><strong>${esc(change.name)}</strong><span>${esc(change.staffId)}</span></div><span class="autofill-change-store">${esc(store?.name || change.after.startStoreId)}</span><div class="autofill-change-time"><small>${before}</small><i class="fa-solid fa-arrow-right"></i><b>${after}</b></div><span class="autofill-change-type ${change.type}">${change.type==='new'?'新規配置':'時間変更'}</span></article>`;
  }

  function unresolvedCard(item, data) {
    const rule = item.rule;
    return `<div class="autofill-unresolved"><strong>${esc(storeById(data, rule.storeId)?.name || rule.storeId)} ${fmt(rule.start)}-${fmt(rule.end)}</strong><span>${esc(skillById(data, rule.skillId)?.name || rule.skillId)} Lv${Number(rule.minLevel||1)}以上</span><b>あと${item.shortage}名</b></div>`;
  }

  function metric(label, value, kind='') {
    return `<div class="autofill-metric ${kind}"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function applyPlan() {
    if (!plan || !plan.changes.length) return;
    const all = loadObject(SHIFTS_KEY, {});
    const currentDay = Array.isArray(all[plan.date]) ? all[plan.date] : [];
    if (stableString(currentDay) !== plan.originalFingerprint) {
      notify('シフトが更新されています。提案を作り直してください。');
      generateAndRender();
      return;
    }

    sessionStorage.setItem(undoKey(plan.date), JSON.stringify(plan.originalDay));
    all[plan.date] = clone(plan.simulatedDay);
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));
    sessionStorage.setItem('okk_shift_simple_autofill_message', `${plan.date.replaceAll('-','/')} の自動補完を ${plan.changes.length}名に反映しました`);
    location.reload();
  }

  function undoLastApply() {
    const date = currentDate();
    const raw = sessionStorage.getItem(undoKey(date));
    if (!raw) return notify('元に戻せる自動補完はありません。');
    try {
      const previous = JSON.parse(raw);
      const all = loadObject(SHIFTS_KEY, {});
      all[date] = Array.isArray(previous) ? previous : [];
      localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));
      sessionStorage.removeItem(undoKey(date));
      sessionStorage.setItem('okk_shift_simple_autofill_message', `${date.replaceAll('-','/')} の自動補完を元に戻しました`);
      location.reload();
    } catch {
      notify('元に戻すデータを読み取れませんでした。');
    }
  }

  function countShortages(data, date, rules) {
    return rules.map(rule => evaluateRule(data,date,rule)).filter(item => item.shortage>0);
  }

  function evaluateRule(data, date, rule) {
    let minimum = Infinity;
    for (let minute=Number(rule.start); minute<Number(rule.end); minute+=SLOT) {
      minimum = Math.min(minimum, qualifiedCount(data,date,rule,minute,Math.min(Number(rule.end),minute+SLOT)));
    }
    if (!Number.isFinite(minimum)) minimum=0;
    return { rule, minimum, shortage:Math.max(0,Number(rule.count||0)-minimum) };
  }

  function qualifiedCount(data,date,rule,start,end) {
    const ids = new Set();
    const skill = skillById(data,rule.skillId);
    const day = Array.isArray(data.shifts[date]) ? data.shifts[date] : [];
    day.forEach(shift => {
      const person = data.staff.find(item => sameId(item.id||item.employeeNumber,shift.staffId));
      if (!person || person.active===false) return;
      if (skillLevel(person,skill)<Number(rule.minLevel||1)) return;
      if (deriveSegments(shift,data.stores).some(segment => segment.storeId===rule.storeId && segment.start<=start && segment.end>=end)) ids.add(String(person.id||person.employeeNumber||'').toUpperCase());
    });
    return ids.size;
  }

  function applicableRequirements(data,date) {
    const active = data.requirements.filter(rule => rule.active!==false && skillById(data,rule.skillId)?.active!==false);
    const specific = new Set(active.filter(rule => rule.dayType==='specific' && rule.specificDate===date).map(rule => `${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`));
    return active.filter(rule => {
      if (!dayMatches(rule,date)) return false;
      if (rule.dayType!=='specific' && specific.has(`${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`)) return false;
      return true;
    });
  }

  function dayMatches(rule,date) {
    if (rule.dayType==='specific') return rule.specificDate===date;
    const day = new Date(`${date}T00:00:00`).getDay();
    if (rule.dayType==='weekday') return day>=1 && day<=4;
    if (rule.dayType==='fri_sat') return day===5 || day===6;
    if (rule.dayType==='sun') return day===0;
    return true;
  }

  function extendShiftToCover(existing,rule,stores) {
    const current = { ...existing,start:Number(existing.start),end:Number(existing.end) };
    if (current.startStoreId===rule.storeId) {
      const next={...current,start:Math.min(current.start,Number(rule.start)),end:Math.max(current.end,Number(rule.end))};
      return segmentsCover(next,rule,stores)?next:null;
    }
    const source=stores.find(store=>store.id===current.startStoreId);
    const target=stores.find(store=>store.id===rule.storeId);
    if (!source||!target||source.area!=='naha'||target.area!=='naha') return null;
    const hub=stores.filter(store=>store.area==='naha').slice().sort((a,b)=>Number(b.close||0)-Number(a.close||0))[0];
    if (!hub||hub.id!==rule.storeId) return null;
    const next={...current,end:Math.max(current.end,Number(rule.end))};
    return segmentsCover(next,rule,stores)?next:null;
  }

  function segmentsCover(shift,rule,stores) {
    return deriveSegments(shift,stores).some(segment=>segment.storeId===rule.storeId && segment.start<=Number(rule.start) && segment.end>=Number(rule.end));
  }

  function deriveSegments(shift,stores) {
    const base=stores.find(store=>store.id===shift.startStoreId);
    const start=Number(shift.start),end=Number(shift.end);
    if (!base) return [{storeId:shift.startStoreId,start,end}];
    const close=Number(base.close||end);
    if (base.area!=='naha'||end<=close) return [{storeId:base.id,start,end}];
    const hub=stores.filter(store=>store.area==='naha').slice().sort((a,b)=>Number(b.close||0)-Number(a.close||0))[0];
    if (!hub||hub.id===base.id) return [{storeId:base.id,start,end}];
    if (start>=close) return [{storeId:hub.id,start,end}];
    return [{storeId:base.id,start,end:Math.min(end,close)},{storeId:hub.id,start:Math.max(start,close),end}];
  }

  function scorePerson(person,rule,level,monthlyMinutes,data) {
    let score=50+level*12;
    const placement=Array.isArray(person.placementStoreIds)?person.placementStoreIds:[];
    const affiliations=Array.isArray(person.affiliationStoreIds)?person.affiliationStoreIds:[];
    if (placement.includes(rule.storeId)) score+=10;
    if (affiliations.includes(rule.storeId)) score+=10;
    const target=storeById(data,rule.storeId);
    if (target?.area && affiliations.some(id=>storeById(data,id)?.area===target.area)) score+=5;
    score-=Math.min(25,Math.round(monthlyMinutes/600));
    return Math.max(1,Math.min(99,score));
  }

  function storeAllowed(person,storeId) {
    const allowed=Array.isArray(person.placementStoreIds)?person.placementStoreIds.filter(Boolean):[];
    return !allowed.length||allowed.includes(storeId);
  }

  function availabilityCovers(person,date,start,end) {
    const c=person.workConstraints;
    if (!c) return true;
    const weekday=String(new Date(`${date}T00:00:00`).getDay());
    if (Array.isArray(c.availableDays)&&c.availableDays.length&&!c.availableDays.includes(weekday)) return false;
    if (Number.isFinite(Number(c.availableStart))&&Number(start)<Number(c.availableStart)) return false;
    if (Number.isFinite(Number(c.availableEnd))&&Number(end)>Number(c.availableEnd)) return false;
    return true;
  }

  function weeklyDayLimitAllows(person,allShifts,date,staffId) {
    const max=Number(person?.workConstraints?.maxDaysPerWeek);
    if (!Number.isFinite(max)||max<=0) return true;
    const work=new Date(`${date}T00:00:00`);
    const day=work.getDay();
    const monday=new Date(work); monday.setDate(work.getDate()-((day+6)%7));
    const sunday=new Date(monday); sunday.setDate(monday.getDate()+6);
    const days=new Set();
    Object.entries(allShifts).forEach(([key,rows])=>{
      const d=new Date(`${key}T00:00:00`);
      if (d<monday||d>sunday) return;
      if ((Array.isArray(rows)?rows:[]).some(shift=>sameId(shift.staffId,staffId))) days.add(key);
    });
    if (days.has(date)) return true;
    return days.size<max;
  }

  function monthlyHourLimitAllows(person,monthlyMinutes,additionalMinutes) {
    const c=person?.workConstraints||{};
    const raw=c.maxMonthlyHours ?? c.monthlyMaxHours ?? c.maxHoursPerMonth ?? person.maxMonthlyHours;
    const max=Number(raw);
    if (!Number.isFinite(max)||max<=0) return true;
    return monthlyMinutes+Math.max(0,additionalMinutes)<=max*60;
  }

  function scheduledMinutesForMonth(shifts,staffId,month) {
    let total=0;
    Object.entries(shifts).forEach(([date,rows])=>{
      if (!date.startsWith(month)) return;
      (Array.isArray(rows)?rows:[]).forEach(shift=>{if (sameId(shift.staffId,staffId)) total+=Math.max(0,Number(shift.end||0)-Number(shift.start||0));});
    });
    return total;
  }

  function skillLevel(person,skill) {
    if (!skill) return 0;
    const direct=Number(person?.skillLevels?.[skill.id]);
    if (Number.isFinite(direct)) return Math.max(0,Math.min(3,direct));
    const legacy=Array.isArray(person?.skills)?person.skills:[];
    return legacy.some(name=>normalize(name)===normalize(skill.name))?1:0;
  }

  function isMinorOnDate(person,date) {
    const birth=parseDate(person?.dob||person?.birthdate||person?.birthday||'');
    const work=parseDate(date);
    if (!birth||!work) return false;
    let age=work.getFullYear()-birth.getFullYear();
    if (work.getMonth()<birth.getMonth()||(work.getMonth()===birth.getMonth()&&work.getDate()<birth.getDate())) age-=1;
    return age<18;
  }

  function parseDate(value) {
    const match=String(value||'').trim().replace(/[./]/g,'-').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return null;
    const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
    return Number.isNaN(date.getTime())?null:date;
  }

  function runtimeData() {
    return {
      staff:loadArray(STAFF_KEY,[]),
      skills:loadArray(SKILLS_KEY,FALLBACK_SKILLS),
      requirements:loadArray(REQUIREMENTS_KEY,FALLBACK_REQUIREMENTS),
      shifts:loadObject(SHIFTS_KEY,{}),
      stores:loadArray(STORES_KEY,[
        {id:'matsuyama',name:'松山店',area:'naha',close:30*60},
        {id:'kumoji',name:'久茂地店',area:'naha',close:25*60},
        {id:'miebashi',name:'美栄橋店',area:'naha',close:25*60},
        {id:'misato',name:'美里店',area:'okinawa',close:26*60},
      ]),
    };
  }

  function currentDate(){return document.getElementById('work-date')?.value||dateKey(new Date());}
  function skillById(data,id){return data.skills.find(skill=>skill.id===id);}
  function storeById(data,id){return data.stores.find(store=>store.id===id);}
  function req(storeId,dayType,startHour,endHour,skillId,minLevel,count,mode='hard'){return{id:`auto_${storeId}_${startHour}_${endHour}_${skillId}`,storeId,dayType,specificDate:'',start:startHour*60,end:endHour*60,skillId,minLevel,count,mode,active:true};}
  function loadArray(key,fallback){const value=loadJson(key,fallback);return Array.isArray(value)&&value.length?value:fallback;}
  function loadObject(key,fallback){const value=loadJson(key,fallback);return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback;}
  function loadJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function stableString(value){return JSON.stringify(value);}
  function sameId(a,b){return String(a||'').toUpperCase()===String(b||'').toUpperCase();}
  function normalize(value){return String(value||'').replace(/[\s　（）()]/g,'').toLowerCase();}
  function appendMemo(a,b){return [...new Set([a,b].filter(Boolean))].join(' / ');}
  function fmt(total){const n=Number(total||0),next=n>=1440,h=Math.floor(n/60)%24,m=n%60;return`${next?'翌 ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
  function dateKey(date){const d=new Date(date);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function esc(value){return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]));}
  function undoKey(date){return`okk_shift_simple_autofill_undo_${date}`;}

  function notify(message){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2800);}

  function injectStyles(){
    if(document.getElementById('shift-simple-autofill-style'))return;
    const style=document.createElement('style');style.id='shift-simple-autofill-style';style.textContent=`
      .autofill-modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.66);z-index:300;display:none;align-items:center;justify-content:center;padding:18px}.autofill-modal-bg.open{display:flex}.autofill-modal{width:min(900px,100%);max-height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:16px;box-shadow:0 30px 90px rgba(15,23,42,.38);overflow:hidden}.autofill-modal-head{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #e4e7ec}.autofill-modal-head>div{display:flex;align-items:baseline;gap:9px}.autofill-modal-head strong{font-size:15px}.autofill-modal-head span{font-size:9px;color:#667085}.autofill-modal-body{padding:14px 16px;overflow:auto}.autofill-modal-foot{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid #e4e7ec;background:#fcfcfd}.autofill-policy{display:flex;gap:9px;align-items:flex-start;padding:10px;border:1px solid #d1e9ff;background:#eff8ff;border-radius:9px;color:#175cd3}.autofill-policy>i{margin-top:2px}.autofill-policy strong{display:block;font-size:10px}.autofill-policy span{display:block;font-size:8px;line-height:1.6;color:#475467;margin-top:2px}.autofill-loading{padding:35px;text-align:center;color:#667085;font-size:10px}.autofill-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}.autofill-metric{border:1px solid #e4e7ec;border-radius:9px;padding:9px;background:#fff}.autofill-metric span{display:block;font-size:8px;color:#667085}.autofill-metric strong{display:block;font-size:16px;margin-top:2px}.autofill-metric.warning{background:#fffaeb;border-color:#fedf89}.autofill-metric.warning strong{color:#b54708}.autofill-metric.ok{background:#ecfdf3;border-color:#abefc6}.autofill-metric.ok strong{color:#027a48}.autofill-section{margin-top:10px;border:1px solid #e4e7ec;border-radius:10px;overflow:hidden}.autofill-section.unresolved{border-color:#fedf89}.autofill-section-head{display:flex;align-items:baseline;gap:8px;padding:9px 11px;background:#f9fafb;border-bottom:1px solid #e4e7ec}.autofill-section-head strong{font-size:10px}.autofill-section-head span{font-size:8px;color:#667085}.autofill-change-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px}.autofill-change-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 8px;padding:8px;border:1px solid #eaecf0;border-radius:8px}.autofill-change-card>div:first-child strong{display:block;font-size:10px}.autofill-change-card>div:first-child span{display:block;font-size:7px;color:#98a2b3}.autofill-change-store{font-size:8px;font-weight:900;color:#175cd3}.autofill-change-time{display:flex;align-items:center;gap:5px;font-size:8px}.autofill-change-time small{color:#98a2b3}.autofill-change-time b{font-size:9px}.autofill-change-type{justify-self:end;align-self:center;border-radius:999px;padding:2px 6px;font-size:7px;font-weight:900;background:#ecfdf3;color:#027a48}.autofill-change-type.extend{background:#f4ebff;color:#6941c6}.autofill-empty{grid-column:1/-1;padding:20px;text-align:center;color:#667085;font-size:9px}.autofill-unresolved-list{display:flex;gap:6px;overflow:auto;padding:8px}.autofill-unresolved{min-width:170px;display:grid;gap:2px;border:1px solid #fedf89;background:#fffaeb;border-radius:8px;padding:7px}.autofill-unresolved strong{font-size:8px}.autofill-unresolved span{font-size:8px;color:#667085}.autofill-unresolved b{font-size:9px;color:#b54708}@media(max-width:800px){.autofill-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.autofill-change-list{grid-template-columns:1fr}.autofill-modal-foot{align-items:stretch;flex-direction:column}.autofill-modal-foot>div{margin-left:0!important}.autofill-modal-foot .btn{flex:1}}
    `;document.head.appendChild(style);
  }

  const pending=sessionStorage.getItem('okk_shift_simple_autofill_message');
  if(pending){sessionStorage.removeItem('okk_shift_simple_autofill_message');setTimeout(()=>notify(pending),220);}
})();
