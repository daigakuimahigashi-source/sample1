(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const SHIFTS_KEY = 'okk_shift_simple_shifts';
  const STORES_KEY = 'okk_shift_simple_stores';
  const UNDO_KEY = 'okk_shift_simple_period_undo';
  const RETURN_DATE_KEY = 'okk_shift_simple_return_date';
  const MESSAGE_KEY = 'okk_shift_simple_period_message';
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

  let mode = 'week';
  let plan = null;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    injectButton();
    injectModal();
    bind();
    restoreReturnDate();
    showPendingMessage();
  }

  function injectButton() {
    if (document.getElementById('simple-period-open')) return;
    const toolbar = document.querySelector('#view-planner .toolbar-left') || document.querySelector('#view-planner .toolbar');
    if (!toolbar) return;
    const button = document.createElement('button');
    button.id = 'simple-period-open';
    button.type = 'button';
    button.className = 'btn btn-dark';
    button.innerHTML = '<i class="fa-solid fa-calendar-days"></i> 週・月候補生成';
    toolbar.appendChild(button);
  }

  function injectModal() {
    if (document.getElementById('simple-period-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'simple-period-modal';
    modal.className = 'period-modal-bg';
    modal.innerHTML = `
      <div class="period-modal" role="dialog" aria-modal="true">
        <div class="period-modal-head">
          <div>
            <strong>週・月のシフト候補生成</strong>
            <span id="period-range-label"></span>
          </div>
          <button type="button" class="btn btn-light btn-small" data-period-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="period-modal-body">
          <div class="period-controls">
            <div class="period-mode">
              <button type="button" data-period-mode="week" class="active">1週間</button>
              <button type="button" data-period-mode="month">1か月</button>
            </div>
            <div class="period-anchor">基準日 <input id="period-anchor-date" type="date" class="control"></div>
            <button type="button" id="period-generate" class="btn btn-green"><i class="fa-solid fa-wand-magic-sparkles"></i>候補を生成</button>
          </div>

          <div class="period-policy">
            <i class="fa-solid fa-layer-group"></i>
            <div>
              <strong>既存シフトは保持して、不足分だけ補完</strong>
              <span>配置可能店舗・スキルLv・勤務可能曜日/時間・18歳未満22時・週最大勤務日数・月間時間上限を期間全体で累積判定します。</span>
            </div>
          </div>

          <div id="period-result"><div class="period-empty">「候補を生成」を押すと、期間全体をシミュレーションします。</div></div>
        </div>
        <div class="period-modal-foot">
          <button type="button" id="period-undo" class="btn btn-light" style="display:none"><i class="fa-solid fa-rotate-left"></i>直前の期間反映を元に戻す</button>
          <div class="period-foot-right">
            <button type="button" id="period-regenerate" class="btn btn-light" disabled><i class="fa-solid fa-rotate"></i>作り直す</button>
            <button type="button" id="period-apply" class="btn btn-green" disabled><i class="fa-solid fa-check"></i>この候補を一括反映</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function bind() {
    document.getElementById('simple-period-open')?.addEventListener('click', openModal);
    document.addEventListener('click', event => {
      const modeButton = event.target.closest('[data-period-mode]');
      if (modeButton) {
        mode = modeButton.dataset.periodMode;
        document.querySelectorAll('[data-period-mode]').forEach(button => button.classList.toggle('active', button.dataset.periodMode === mode));
        updateRangeLabel();
        plan = null;
        renderInitialState();
        return;
      }
      if (event.target.closest('[data-period-close]') || event.target.id === 'simple-period-modal') closeModal();
    });
    document.getElementById('period-anchor-date')?.addEventListener('change', () => {
      plan = null;
      updateRangeLabel();
      renderInitialState();
    });
    document.getElementById('period-generate')?.addEventListener('click', generatePlan);
    document.getElementById('period-regenerate')?.addEventListener('click', generatePlan);
    document.getElementById('period-apply')?.addEventListener('click', applyPlan);
    document.getElementById('period-undo')?.addEventListener('click', undoPlan);
  }

  function openModal() {
    const anchor = document.getElementById('period-anchor-date');
    if (anchor) anchor.value = currentDate();
    updateRangeLabel();
    renderInitialState();
    document.getElementById('simple-period-modal')?.classList.add('open');
  }

  function closeModal() {
    document.getElementById('simple-period-modal')?.classList.remove('open');
  }

  function renderInitialState() {
    const result = document.getElementById('period-result');
    const apply = document.getElementById('period-apply');
    const regenerate = document.getElementById('period-regenerate');
    const undo = document.getElementById('period-undo');
    if (result) result.innerHTML = '<div class="period-empty">「候補を生成」を押すと、期間全体をシミュレーションします。</div>';
    if (apply) apply.disabled = true;
    if (regenerate) regenerate.disabled = true;
    if (undo) undo.style.display = sessionStorage.getItem(UNDO_KEY) ? '' : 'none';
  }

  function updateRangeLabel() {
    const anchor = document.getElementById('period-anchor-date')?.value || currentDate();
    const dates = rangeDates(mode, anchor);
    const label = document.getElementById('period-range-label');
    if (label && dates.length) label.textContent = `${dates[0].replaceAll('-','/')} 〜 ${dates[dates.length-1].replaceAll('-','/')}`;
  }

  function generatePlan() {
    const anchor = document.getElementById('period-anchor-date')?.value || currentDate();
    const result = document.getElementById('period-result');
    const apply = document.getElementById('period-apply');
    const regenerate = document.getElementById('period-regenerate');
    if (!result || !apply || !regenerate) return;

    result.innerHTML = '<div class="period-loading"><i class="fa-solid fa-spinner fa-spin"></i>期間全体の不足・勤務上限・候補を計算しています...</div>';
    apply.disabled = true;
    regenerate.disabled = true;

    setTimeout(() => {
      plan = buildPeriodPlan(mode, anchor);
      renderPlan(plan);
      regenerate.disabled = false;
      apply.disabled = !plan || plan.changes.length === 0;
    }, 30);
  }

  function buildPeriodPlan(periodMode, anchor) {
    const data = runtimeData();
    const dates = rangeDates(periodMode, anchor);
    const original = clone(data.shifts);
    const simulated = clone(data.shifts);
    const baseSnapshot = pickDates(original, dates);
    const daily = [];
    let shortageBefore = 0;
    let shortageAfter = 0;
    let safety = 0;

    for (const date of dates) {
      if (!Array.isArray(simulated[date])) simulated[date] = [];
      const beforeDay = clone(simulated[date]);
      const simData = { ...data, shifts: simulated };
      const rules = applicableRequirements(simData, date)
        .filter(rule => rule.mode !== 'soft')
        .sort((a,b) => Number(a.start)-Number(b.start) || Number(b.minLevel||1)-Number(a.minLevel||1) || Number(a.end)-Number(b.end));
      const beforeResults = rules.map(rule => evaluateRule(simData, date, rule));
      shortageBefore += beforeResults.filter(item => item.shortage > 0).length;

      for (const rule of rules) {
        while (safety++ < 6000) {
          const before = evaluateRule(simData, date, rule);
          if (before.shortage <= 0) break;
          const candidates = buildCandidates(simData, date, rule);
          let improved = false;

          for (const candidate of candidates) {
            const snapshot = clone(simulated[date]);
            applyCandidate(simulated[date], candidate);
            const after = evaluateRule(simData, date, rule);
            if (after.shortage < before.shortage) {
              improved = true;
              break;
            }
            simulated[date].splice(0, simulated[date].length, ...snapshot);
          }

          if (!improved) break;
        }
      }

      const afterResults = rules.map(rule => evaluateRule(simData, date, rule));
      const unresolved = afterResults.filter(item => item.shortage > 0);
      shortageAfter += unresolved.length;
      const changes = diffDay(beforeDay, simulated[date], data.staff);
      daily.push({ date, changes, unresolved });
    }

    const changes = daily.flatMap(day => day.changes.map(change => ({ ...change, date: day.date })));
    const changedDates = daily.filter(day => day.changes.length > 0).length;
    const changedStaff = new Set(changes.map(change => change.staffId)).size;
    const finalSnapshot = pickDates(simulated, dates);

    return {
      mode: periodMode,
      anchor,
      dates,
      original,
      simulated,
      baseSnapshot,
      baseFingerprint: stableString(baseSnapshot),
      finalSnapshot,
      afterFingerprint: stableString(finalSnapshot),
      daily,
      changes,
      changedDates,
      changedStaff,
      shortageBefore,
      shortageAfter,
      data,
    };
  }

  function buildCandidates(data, date, rule) {
    const skill = skillById(data, rule.skillId);
    const day = Array.isArray(data.shifts[date]) ? data.shifts[date] : [];
    const month = date.slice(0,7);
    const candidates = [];

    data.staff.forEach(person => {
      if (!person || person.active === false || person.autoAssign === false) return;
      const staffId = String(person.id || person.employeeNumber || '').toUpperCase();
      if (!staffId) return;
      const level = skillLevel(person, skill);
      if (level < Number(rule.minLevel || 1)) return;
      if (!storeAllowed(person, rule.storeId)) return;
      if (isMinorOnDate(person, date) && Number(rule.end) > MINOR_END) return;

      const existing = day.find(shift => sameId(shift.staffId, staffId));
      const monthlyMinutes = scheduledMinutesForMonth(data.shifts, staffId, month);
      const weekDays = scheduledDaysForWeek(data.shifts, staffId, date);
      const periodMinutes = scheduledMinutes(data.shifts, staffId);
      let score = scorePerson(person, rule, level, monthlyMinutes, weekDays, periodMinutes, data);

      if (!existing) {
        if (!availabilityCovers(person, date, Number(rule.start), Number(rule.end))) return;
        if (!weeklyDayLimitAllows(person, data.shifts, date, staffId)) return;
        if (!monthlyHourLimitAllows(person, monthlyMinutes, Number(rule.end)-Number(rule.start))) return;
        candidates.push({ type:'new', staffId, person, score, startStoreId:rule.storeId, start:Number(rule.start), end:Number(rule.end) });
        return;
      }

      const after = extendShiftToCover(existing, rule, data.stores);
      if (!after) return;
      if (!availabilityCovers(person, date, after.start, after.end)) return;
      if (isMinorOnDate(person, date) && Number(after.end) > MINOR_END) return;
      const added = Math.max(0, (after.end-after.start) - (Number(existing.end)-Number(existing.start)));
      if (!monthlyHourLimitAllows(person, monthlyMinutes, added)) return;
      score += 18;
      candidates.push({ type:'extend', staffId, person, score, shiftId:existing.id, after });
    });

    return candidates.sort((a,b) => b.score-a.score || String(a.person.name||'').localeCompare(String(b.person.name||''),'ja'));
  }

  function scorePerson(person, rule, level, monthlyMinutes, weekDays, totalMinutes, data) {
    let score = 55 + level * 12;
    const placement = Array.isArray(person.placementStoreIds) ? person.placementStoreIds : [];
    const affiliations = Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : [];
    if (placement.includes(rule.storeId)) score += 10;
    if (affiliations.includes(rule.storeId)) score += 10;
    const target = storeById(data, rule.storeId);
    if (target?.area && affiliations.some(id => storeById(data, id)?.area === target.area)) score += 5;

    const preferred = Number(person?.workConstraints?.preferredDaysPerWeek);
    if (Number.isFinite(preferred) && preferred > 0 && weekDays >= preferred) score -= (weekDays - preferred + 1) * 7;

    score -= Math.min(24, Math.round(monthlyMinutes / 720));
    score -= Math.min(14, Math.round(totalMinutes / 1800));
    return Math.max(1, Math.min(99, score));
  }

  function applyCandidate(day, candidate) {
    if (candidate.type === 'new') {
      day.push({
        id:`sh_period_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`,
        staffId:candidate.staffId,
        startStoreId:candidate.startStoreId,
        start:candidate.start,
        end:candidate.end,
        memo:'週・月候補生成で補完',
      });
      return;
    }
    const target = day.find(shift => shift.id === candidate.shiftId && sameId(shift.staffId, candidate.staffId));
    if (!target) return;
    target.start = candidate.after.start;
    target.end = candidate.after.end;
    target.memo = appendMemo(target.memo, '週・月候補生成で時間拡張');
  }

  function renderPlan(value) {
    const result = document.getElementById('period-result');
    if (!result || !value) return;
    const resolved = Math.max(0, value.shortageBefore - value.shortageAfter);
    const dayCards = value.daily.filter(day => day.changes.length || day.unresolved.length).map(day => renderDayCard(day, value.data)).join('');

    result.innerHTML = `
      <div class="period-metrics">
        ${metric('補完前の不足', `${value.shortageBefore}条件`)}
        ${metric('解消見込み', `${resolved}条件`, resolved ? 'ok' : '')}
        ${metric('変更日', `${value.changedDates}日`)}
        ${metric('変更する人', `${value.changedStaff}名`)}
        ${metric('反映変更', `${value.changes.length}件`)}
        ${metric('残る不足', `${value.shortageAfter}条件`, value.shortageAfter ? 'warning' : 'ok')}
      </div>
      <div class="period-review-head"><strong>日別の提案差分</strong><span>既存シフトは削除せず、追加・延長だけを提案しています。</span></div>
      <div class="period-day-list">${dayCards || '<div class="period-empty">変更提案はありません。現在のシフトで充足しているか、条件を満たす候補がありません。</div>'}</div>
    `;
  }

  function renderDayCard(day, data) {
    const weekday = ['日','月','火','水','木','金','土'][new Date(`${day.date}T00:00:00`).getDay()];
    return `<section class="period-day-card ${day.unresolved.length ? 'has-unresolved' : ''}">
      <div class="period-day-head">
        <strong>${day.date.replaceAll('-','/')}（${weekday}）</strong>
        <div><span class="period-count ok">変更 ${day.changes.length}</span>${day.unresolved.length ? `<span class="period-count warn">不足 ${day.unresolved.length}</span>` : '<span class="period-count ok">不足なし</span>'}</div>
      </div>
      ${day.changes.length ? `<div class="period-change-grid">${day.changes.map(change => changeRow(change, data)).join('')}</div>` : ''}
      ${day.unresolved.length ? `<div class="period-unresolved-row">${day.unresolved.slice(0,6).map(item => unresolvedChip(item, data)).join('')}${day.unresolved.length>6?`<span class="period-more">ほか${day.unresolved.length-6}件</span>`:''}</div>` : ''}
    </section>`;
  }

  function changeRow(change, data) {
    const store = storeById(data, change.after.startStoreId);
    const before = change.before ? `${fmt(change.before.start)}-${fmt(change.before.end)}` : '未配置';
    const after = `${fmt(change.after.start)}-${fmt(change.after.end)}`;
    return `<div class="period-change-row">
      <div><strong>${esc(change.name)}</strong><span>${esc(change.staffId)}</span></div>
      <span class="period-store">${esc(store?.name || change.after.startStoreId)}</span>
      <div class="period-time"><small>${before}</small><i class="fa-solid fa-arrow-right"></i><b>${after}</b></div>
      <span class="period-change-kind ${change.type}">${change.type === 'new' ? '追加' : '延長'}</span>
    </div>`;
  }

  function unresolvedChip(item, data) {
    const rule = item.rule;
    return `<span class="period-unresolved-chip"><b>${esc(storeById(data,rule.storeId)?.name || rule.storeId)}</b> ${fmt(rule.start)}-${fmt(rule.end)} / ${esc(skillById(data,rule.skillId)?.name || rule.skillId)} あと${item.shortage}</span>`;
  }

  function metric(label, value, kind='') {
    return `<div class="period-metric ${kind}"><span>${label}</span><strong>${value}</strong></div>`;
  }

  function applyPlan() {
    if (!plan || !plan.changes.length) return;
    const all = loadObject(SHIFTS_KEY, {});
    const currentSnapshot = pickDates(all, plan.dates);
    if (stableString(currentSnapshot) !== plan.baseFingerprint) {
      notify('期間内のシフトが更新されています。候補を作り直してください。');
      generatePlan();
      return;
    }

    const undoPayload = {
      dates:plan.dates,
      before:plan.baseSnapshot,
      after:plan.finalSnapshot,
      afterFingerprint:plan.afterFingerprint,
      anchor:plan.anchor,
      mode:plan.mode,
      savedAt:new Date().toISOString(),
    };
    sessionStorage.setItem(UNDO_KEY, JSON.stringify(undoPayload));

    plan.dates.forEach(date => {
      all[date] = clone(plan.simulated[date] || []);
    });
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));
    sessionStorage.setItem(RETURN_DATE_KEY, plan.anchor);
    sessionStorage.setItem(MESSAGE_KEY, `${plan.mode === 'month' ? '1か月' : '1週間'}の候補を ${plan.changes.length}件反映しました`);
    location.reload();
  }

  function undoPlan() {
    const raw = sessionStorage.getItem(UNDO_KEY);
    if (!raw) return notify('元に戻せる期間反映はありません。');
    let undo;
    try { undo = JSON.parse(raw); }
    catch { return notify('元に戻すデータを読み取れませんでした。'); }

    const all = loadObject(SHIFTS_KEY, {});
    const currentSnapshot = pickDates(all, undo.dates || []);
    if (stableString(currentSnapshot) !== undo.afterFingerprint) {
      notify('反映後に手動変更があります。上書きを避けるため元に戻しませんでした。');
      return;
    }

    (undo.dates || []).forEach(date => {
      all[date] = clone(undo.before?.[date] || []);
    });
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(all));
    sessionStorage.removeItem(UNDO_KEY);
    sessionStorage.setItem(RETURN_DATE_KEY, undo.anchor || currentDate());
    sessionStorage.setItem(MESSAGE_KEY, '直前の週・月候補反映を元に戻しました');
    location.reload();
  }

  function diffDay(before, after, staff) {
    const rows = [];
    const beforeMap = new Map((before || []).map(shift => [String(shift.staffId||'').toUpperCase(), shift]));
    const afterMap = new Map((after || []).map(shift => [String(shift.staffId||'').toUpperCase(), shift]));
    afterMap.forEach((next, staffId) => {
      const prev = beforeMap.get(staffId);
      const person = staff.find(item => sameId(item.id || item.employeeNumber, staffId));
      if (!prev) rows.push({ type:'new', staffId, name:person?.name || staffId, before:null, after:clone(next) });
      else if (Number(prev.start)!==Number(next.start) || Number(prev.end)!==Number(next.end) || prev.startStoreId!==next.startStoreId) rows.push({ type:'extend', staffId, name:person?.name || staffId, before:clone(prev), after:clone(next) });
    });
    return rows.sort((a,b) => Number(a.after.start)-Number(b.after.start) || a.name.localeCompare(b.name,'ja'));
  }

  function evaluateRule(data, date, rule) {
    let minimum = Infinity;
    for (let minute=Number(rule.start); minute<Number(rule.end); minute+=SLOT) {
      minimum = Math.min(minimum, qualifiedCount(data,date,rule,minute,Math.min(Number(rule.end),minute+SLOT)));
    }
    if (!Number.isFinite(minimum)) minimum = 0;
    return { rule, minimum, shortage:Math.max(0,Number(rule.count||0)-minimum) };
  }

  function qualifiedCount(data, date, rule, start, end) {
    const ids = new Set();
    const skill = skillById(data, rule.skillId);
    const day = Array.isArray(data.shifts[date]) ? data.shifts[date] : [];
    day.forEach(shift => {
      const person = data.staff.find(item => sameId(item.id || item.employeeNumber, shift.staffId));
      if (!person || person.active === false) return;
      if (skillLevel(person, skill) < Number(rule.minLevel || 1)) return;
      if (deriveSegments(shift, data.stores).some(segment => segment.storeId===rule.storeId && segment.start<=start && segment.end>=end)) ids.add(String(person.id || person.employeeNumber || '').toUpperCase());
    });
    return ids.size;
  }

  function applicableRequirements(data, date) {
    const active = data.requirements.filter(rule => rule.active !== false && skillById(data, rule.skillId)?.active !== false);
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
    const current={...existing,start:Number(existing.start),end:Number(existing.end)};
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

  function weeklyDayLimitAllows(person,shifts,date,staffId) {
    const max=Number(person?.workConstraints?.maxDaysPerWeek);
    if (!Number.isFinite(max)||max<=0) return true;
    const days=scheduledDaysForWeek(shifts,staffId,date);
    const already=(Array.isArray(shifts[date])?shifts[date]:[]).some(shift=>sameId(shift.staffId,staffId));
    return already || days<max;
  }

  function scheduledDaysForWeek(shifts,staffId,date) {
    const work=new Date(`${date}T00:00:00`);
    const monday=new Date(work); monday.setDate(work.getDate()-((work.getDay()+6)%7));
    const sunday=new Date(monday); sunday.setDate(monday.getDate()+6);
    let count=0;
    Object.entries(shifts).forEach(([key,rows])=>{
      const d=new Date(`${key}T00:00:00`);
      if (d<monday||d>sunday) return;
      if ((Array.isArray(rows)?rows:[]).some(shift=>sameId(shift.staffId,staffId))) count+=1;
    });
    return count;
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
      (Array.isArray(rows)?rows:[]).forEach(shift=>{if(sameId(shift.staffId,staffId)) total+=Math.max(0,Number(shift.end||0)-Number(shift.start||0));});
    });
    return total;
  }

  function scheduledMinutes(shifts,staffId) {
    let total=0;
    Object.values(shifts).forEach(rows=>(Array.isArray(rows)?rows:[]).forEach(shift=>{if(sameId(shift.staffId,staffId)) total+=Math.max(0,Number(shift.end||0)-Number(shift.start||0));}));
    return total;
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

  function rangeDates(periodMode,anchor) {
    const base=new Date(`${anchor}T00:00:00`);
    if (periodMode==='month') {
      const first=new Date(base.getFullYear(),base.getMonth(),1);
      const last=new Date(base.getFullYear(),base.getMonth()+1,0);
      return datesBetween(first,last);
    }
    const monday=new Date(base); monday.setDate(base.getDate()-((base.getDay()+6)%7));
    const sunday=new Date(monday); sunday.setDate(monday.getDate()+6);
    return datesBetween(monday,sunday);
  }

  function datesBetween(start,end) {
    const out=[];
    const cursor=new Date(start);
    while(cursor<=end){out.push(dateKey(cursor));cursor.setDate(cursor.getDate()+1);}
    return out;
  }

  function pickDates(shifts,dates) {
    const out={};
    dates.forEach(date=>{out[date]=clone(Array.isArray(shifts[date])?shifts[date]:[]);});
    return out;
  }

  function runtimeData() {
    const skills=loadArray(SKILLS_KEY,FALLBACK_SKILLS);
    const requirements=loadArray(REQUIREMENTS_KEY,FALLBACK_REQUIREMENTS);
    return {
      staff:loadArray(STAFF_KEY,[]),
      skills,
      requirements,
      shifts:loadObject(SHIFTS_KEY,{}),
      stores:loadArray(STORES_KEY,[
        {id:'matsuyama',name:'松山店',area:'naha',close:30*60},
        {id:'kumoji',name:'久茂地店',area:'naha',close:25*60},
        {id:'miebashi',name:'美栄橋店',area:'naha',close:25*60},
        {id:'misato',name:'美里店',area:'okinawa',close:26*60},
      ]),
    };
  }

  function restoreReturnDate() {
    const date=sessionStorage.getItem(RETURN_DATE_KEY);
    if (!date) return;
    sessionStorage.removeItem(RETURN_DATE_KEY);
    setTimeout(()=>{
      const input=document.getElementById('work-date');
      if (!input) return;
      input.value=date;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    },80);
  }

  function showPendingMessage() {
    const message=sessionStorage.getItem(MESSAGE_KEY);
    if (!message) return;
    sessionStorage.removeItem(MESSAGE_KEY);
    setTimeout(()=>notify(message),220);
  }

  function currentDate(){return document.getElementById('work-date')?.value||dateKey(new Date());}
  function skillById(data,id){return data.skills.find(skill=>skill.id===id);}
  function storeById(data,id){return data.stores.find(store=>store.id===id);}
  function req(storeId,dayType,startHour,endHour,skillId,minLevel,count,mode='hard'){return{id:`period_${storeId}_${startHour}_${endHour}_${skillId}`,storeId,dayType,specificDate:'',start:startHour*60,end:endHour*60,skillId,minLevel,count,mode,active:true};}
  function loadArray(key,fallback){const value=loadJson(key,null);return Array.isArray(value)?value:fallback;}
  function loadObject(key,fallback){const value=loadJson(key,null);return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback;}
  function loadJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function stableString(value){return JSON.stringify(value);}
  function sameId(a,b){return String(a||'').toUpperCase()===String(b||'').toUpperCase();}
  function normalize(value){return String(value||'').replace(/[\s　（）()]/g,'').toLowerCase();}
  function appendMemo(a,b){return[...new Set([a,b].filter(Boolean))].join(' / ');}
  function fmt(total){const n=Number(total||0),next=n>=1440,h=Math.floor(n/60)%24,m=n%60;return`${next?'翌 ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
  function dateKey(date){const d=new Date(date);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function esc(value){return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]));}

  function notify(message){const toast=document.getElementById('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000);}

  function injectStyles() {
    if(document.getElementById('shift-simple-period-style'))return;
    const style=document.createElement('style');
    style.id='shift-simple-period-style';
    style.textContent=`
      .period-modal-bg{position:fixed;inset:0;z-index:340;background:rgba(15,23,42,.68);display:none;align-items:center;justify-content:center;padding:16px}.period-modal-bg.open{display:flex}.period-modal{width:min(1080px,100%);max-height:94vh;background:#fff;border-radius:16px;box-shadow:0 30px 90px rgba(15,23,42,.42);overflow:hidden;display:flex;flex-direction:column}.period-modal-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e4e7ec}.period-modal-head>div{display:flex;align-items:baseline;gap:10px}.period-modal-head strong{font-size:15px}.period-modal-head span{font-size:9px;color:#667085}.period-modal-body{padding:13px 16px;overflow:auto}.period-modal-foot{display:flex;align-items:center;gap:8px;padding:11px 16px;border-top:1px solid #e4e7ec;background:#fcfcfd}.period-foot-right{margin-left:auto;display:flex;gap:7px}.period-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.period-mode{display:flex;padding:2px;background:#f2f4f7;border-radius:9px}.period-mode button{border:0;background:transparent;color:#667085;padding:6px 12px;border-radius:7px;font-size:9px;font-weight:900;cursor:pointer}.period-mode button.active{background:#fff;color:#101828;box-shadow:0 1px 3px rgba(16,24,40,.12)}.period-anchor{display:flex;align-items:center;gap:5px;font-size:8px;font-weight:900;color:#475467}.period-policy{display:flex;gap:9px;align-items:flex-start;margin-top:10px;padding:9px 10px;border:1px solid #e9d7fe;background:#f9f5ff;border-radius:9px;color:#6941c6}.period-policy i{margin-top:2px}.period-policy strong{display:block;font-size:9px}.period-policy span{display:block;font-size:8px;line-height:1.6;color:#667085;margin-top:2px}.period-loading,.period-empty{padding:28px;text-align:center;color:#667085;font-size:9px}.period-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:10px}.period-metric{border:1px solid #e4e7ec;border-radius:8px;padding:8px;background:#fff}.period-metric span{display:block;font-size:7px;color:#667085}.period-metric strong{display:block;font-size:15px;margin-top:2px}.period-metric.ok{background:#ecfdf3;border-color:#abefc6}.period-metric.ok strong{color:#027a48}.period-metric.warning{background:#fffaeb;border-color:#fedf89}.period-metric.warning strong{color:#b54708}.period-review-head{display:flex;align-items:baseline;gap:8px;margin:12px 1px 6px}.period-review-head strong{font-size:10px}.period-review-head span{font-size:8px;color:#667085}.period-day-list{display:grid;gap:7px}.period-day-card{border:1px solid #e4e7ec;border-radius:9px;overflow:hidden}.period-day-card.has-unresolved{border-color:#fedf89}.period-day-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;background:#f9fafb;border-bottom:1px solid #e4e7ec}.period-day-head strong{font-size:9px}.period-day-head>div{display:flex;gap:5px}.period-count{display:inline-flex;border-radius:999px;padding:2px 6px;font-size:7px;font-weight:900}.period-count.ok{background:#ecfdf3;color:#027a48}.period-count.warn{background:#fffaeb;color:#b54708}.period-change-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:7px}.period-change-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 7px;align-items:center;border:1px solid #eaecf0;border-radius:7px;padding:6px 7px}.period-change-row>div:first-child strong{display:block;font-size:9px}.period-change-row>div:first-child span{display:block;font-size:7px;color:#98a2b3}.period-store{font-size:7px;font-weight:900;color:#175cd3}.period-time{display:flex;align-items:center;gap:4px;font-size:7px}.period-time small{color:#98a2b3}.period-time b{font-size:8px}.period-change-kind{justify-self:end;border-radius:999px;padding:2px 5px;font-size:7px;font-weight:900;background:#ecfdf3;color:#027a48}.period-change-kind.extend{background:#f4ebff;color:#6941c6}.period-unresolved-row{display:flex;gap:5px;flex-wrap:wrap;padding:7px;border-top:1px solid #f2f4f7;background:#fffcf5}.period-unresolved-chip{border:1px solid #fedf89;background:#fffaeb;color:#7a2e0e;border-radius:999px;padding:3px 6px;font-size:7px}.period-more{font-size:7px;color:#667085;padding:3px}.period-modal .btn:disabled{opacity:.45;cursor:not-allowed}@media(max-width:900px){.period-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.period-change-grid{grid-template-columns:1fr}.period-modal-foot{flex-direction:column;align-items:stretch}.period-foot-right{margin-left:0}.period-foot-right .btn{flex:1}}@media(max-width:600px){.period-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }
})();
