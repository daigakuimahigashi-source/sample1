(() => {
  'use strict';

  const STORAGE_SKILLS = 'okk_shift_v2_skill_definitions';
  const STORAGE_REQUIREMENTS = 'okk_shift_v2_staffing_requirements';
  const STORAGE_STAFF = 'okk_shift_v2_staff';
  const STORAGE_SHIFTS = 'okk_shift_v2_shifts';
  const STORAGE_STORES = 'okk_shift_v2_config';
  const STORAGE_AUDIT = 'okk_shift_v2_audit_v1';
  const CLOUD_SHIFTS = 'shiftV2Shifts';
  const SLOT = 30;
  const DAILY_LIMIT = 8 * 60;
  const WEEKLY_LIMIT = 40 * 60;
  const PART_TIME_TARGET = 6 * 60;
  const DAY_START = 15 * 60;
  const DAY_END = 30 * 60;

  const state = {
    preview: null,
    mode: 'two-stage',
    includeSoft: false,
    observer: null,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    injectStyles();
    injectControls();
    injectModal();
    bindEvents();
    startObserver();
    restoreDateAfterApply();
    decorateAutoBars();
  }

  function injectControls() {
    const plannerToolbar = document.querySelector('#view-planner .toolbar');
    if (!plannerToolbar || document.getElementById('auto-placement-open')) return;
    const left = plannerToolbar.querySelector('.toolbar-left');
    const group = document.createElement('div');
    group.className = 'auto-placement-toolbar';
    group.innerHTML = `
      <button id="auto-placement-open" class="btn btn-green"><i class="fa-solid fa-wand-magic-sparkles"></i> 自動配置</button>
      <span class="auto-placement-caption">社員 → 不足をアルバイトで補完</span>
    `;
    left?.appendChild(group);
  }

  function injectModal() {
    if (document.getElementById('auto-placement-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'auto-placement-modal';
    modal.className = 'auto-modal-bg';
    modal.innerHTML = `
      <div class="auto-modal" role="dialog" aria-modal="true" aria-label="自動配置">
        <div class="auto-modal-head">
          <div><span class="auto-kicker">AUTO PLACEMENT</span><h2>自動配置</h2><div id="auto-modal-date"></div></div>
          <button id="auto-placement-close" class="btn btn-light btn-small"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="auto-modal-body">
          <div class="auto-mode-grid">
            <button class="auto-mode-card active" data-auto-mode="two-stage"><i class="fa-solid fa-bolt"></i><strong>一括2段階</strong><span>社員を先に配置し、残った不足をアルバイトで補完</span></button>
            <button class="auto-mode-card" data-auto-mode="employee"><i class="fa-solid fa-user-tie"></i><strong>社員だけ</strong><span>正社員・契約社員だけで配置案を作る</span></button>
            <button class="auto-mode-card" data-auto-mode="parttime"><i class="fa-solid fa-users"></i><strong>バイト補完だけ</strong><span>今ある配置を残してアルバイトで不足を補う</span></button>
          </div>

          <div class="auto-options">
            <label><input id="auto-include-soft" type="checkbox"> 「推奨」条件も自動で埋める</label>
            <span>既存の手入力シフトは固定扱いで変更しません。</span>
          </div>

          <div id="auto-plan-summary" class="auto-plan-summary"></div>
          <div id="auto-plan-body" class="auto-plan-body"></div>
        </div>
        <div class="auto-modal-foot">
          <div class="auto-foot-left">
            <button id="auto-clear-generated" class="btn auto-danger"><i class="fa-solid fa-rotate-left"></i> この日の自動配置を取消</button>
            <small>手入力のシフトは消しません。</small>
          </div>
          <div class="auto-foot-right">
            <button id="auto-recalculate" class="btn btn-light"><i class="fa-solid fa-rotate"></i> 再計算</button>
            <button id="auto-apply" class="btn btn-green"><i class="fa-solid fa-check"></i> この案を反映</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function bindEvents() {
    document.getElementById('auto-placement-open')?.addEventListener('click', openModal);
    document.getElementById('auto-placement-close')?.addEventListener('click', closeModal);
    document.getElementById('auto-placement-modal')?.addEventListener('click', event => {
      if (event.target.id === 'auto-placement-modal') closeModal();
    });
    document.querySelectorAll('[data-auto-mode]').forEach(button => button.addEventListener('click', () => {
      state.mode = button.dataset.autoMode;
      document.querySelectorAll('[data-auto-mode]').forEach(item => item.classList.toggle('active', item === button));
      calculateAndRender();
    }));
    document.getElementById('auto-include-soft')?.addEventListener('change', event => {
      state.includeSoft = event.target.checked;
      calculateAndRender();
    });
    document.getElementById('auto-recalculate')?.addEventListener('click', calculateAndRender);
    document.getElementById('auto-apply')?.addEventListener('click', applyPreview);
    document.getElementById('auto-clear-generated')?.addEventListener('click', clearGenerated);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
  }

  function startObserver() {
    const canvas = document.getElementById('gantt-canvas');
    if (!canvas || state.observer) return;
    state.observer = new MutationObserver(() => requestAnimationFrame(decorateAutoBars));
    state.observer.observe(canvas, { childList: true, subtree: true });
  }

  function restoreDateAfterApply() {
    const date = sessionStorage.getItem('okk_shift_v2_auto_restore_date');
    if (!date) return;
    sessionStorage.removeItem('okk_shift_v2_auto_restore_date');
    setTimeout(() => {
      const input = document.getElementById('work-date');
      if (!input) return;
      input.value = date;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, 180);
  }

  function openModal() {
    const date = selectedDate();
    if (!date) return;
    const modal = document.getElementById('auto-placement-modal');
    const dateNode = document.getElementById('auto-modal-date');
    if (dateNode) dateNode.textContent = `${formatDateJa(date)} の配置案`;
    modal?.classList.add('open');
    calculateAndRender();
  }

  function closeModal() {
    document.getElementById('auto-placement-modal')?.classList.remove('open');
  }

  function calculateAndRender() {
    const date = selectedDate();
    if (!date) return;
    if (isConfirmed(date)) {
      state.preview = { date, proposals: [], shortages: [], blocked: true, warning: 'この日はシフト確定済みです。証跡保全のため、自動配置は確定前の日だけ実行できます。' };
      renderPreview();
      return;
    }
    state.preview = buildPlan(date, state.mode, state.includeSoft);
    renderPreview();
  }

  function buildPlan(date, mode, includeSoft) {
    const skills = loadSkills();
    const rules = applicableRules(date, skills).filter(rule => includeSoft || rule.mode !== 'soft');
    const staff = loadStaff(skills);
    const stores = loadStores();
    const allShifts = loadJson(STORAGE_SHIFTS, {});
    const working = clone(allShifts);
    if (!Array.isArray(working[date])) working[date] = [];
    const baseIds = new Set(working[date].map(shift => String(shift.staffId || '').toUpperCase()));
    const proposals = [];
    const notes = [];

    const context = { date, skills, rules, staff, stores, working, baseIds, proposals, notes };
    if (!staff.length) {
      return { date, mode, proposals, shortages: rules.map(rule => shortageResult(context, rule)), notes: ['従業員マスタがありません。先にMF従業員CSVを取り込んでください。'], blocked: false };
    }

    if (mode === 'employee' || mode === 'two-stage') fillStage(context, 'employee');
    if (mode === 'parttime' || mode === 'two-stage') fillStage(context, 'parttime');

    const shortages = rules.map(rule => shortageResult(context, rule)).filter(result => result.shortage > 0);
    return { date, mode, proposals, shortages, notes, blocked: false, ruleCount: rules.length };
  }

  function fillStage(context, stage) {
    const ordered = context.rules.slice().sort((a, b) => {
      const modeA = a.mode === 'soft' ? 1 : 0;
      const modeB = b.mode === 'soft' ? 1 : 0;
      if (modeA !== modeB) return modeA - modeB;
      if (Number(b.minLevel) !== Number(a.minLevel)) return Number(b.minLevel) - Number(a.minLevel);
      if (Number(b.count) !== Number(a.count)) return Number(b.count) - Number(a.count);
      return Number(a.start) - Number(b.start);
    });

    ordered.forEach(rule => {
      for (let slotStart = Number(rule.start); slotStart < Number(rule.end); slotStart += SLOT) {
        const slotEnd = Math.min(Number(rule.end), slotStart + SLOT);
        let qualified = qualifiedIds(context, rule, slotStart, slotEnd).size;
        let guard = 0;
        while (qualified < Number(rule.count) && guard < 30) {
          guard += 1;
          const candidate = chooseCandidate(context, stage, rule, slotStart, slotEnd);
          if (!candidate) break;
          addOrExtendProposal(context, candidate, rule, slotStart, slotEnd, stage);
          qualified = qualifiedIds(context, rule, slotStart, slotEnd).size;
        }
      }
    });
  }

  function chooseCandidate(context, stage, rule, slotStart, slotEnd) {
    const candidates = context.staff.filter(person => {
      if (!person.id || person.active === false || person.autoAssign === false) return false;
      if (!matchesStage(person, stage)) return false;
      if (skillLevel(person, rule.skillId) < Number(rule.minLevel)) return false;
      if (!storeAllowed(person, rule.storeId)) return false;
      if (qualifiedIds(context, rule, slotStart, slotEnd).has(person.id)) return false;
      if (hasLockedShift(context, person.id)) return false;
      const ownProposal = context.proposals.find(item => item.staffId === person.id);
      if (ownProposal && ownProposal.startStoreId !== rule.storeId) return false;
      return canCoverWindow(context, person, rule, ownProposal, slotStart, slotEnd, stage);
    });

    candidates.sort((a, b) => candidateScore(context, b, rule, stage) - candidateScore(context, a, rule, stage) || String(a.name).localeCompare(String(b.name), 'ja'));
    return candidates[0] || null;
  }

  function canCoverWindow(context, person, rule, proposal, slotStart, slotEnd, stage) {
    const window = proposal
      ? expandedWindow(proposal, slotStart, slotEnd, stage)
      : initialWindow(context, person, rule, slotStart, slotEnd, stage);
    const duration = window.end - window.start;
    if (duration <= 0 || duration > DAILY_LIMIT) return false;
    const existingDayMinutes = dayMinutesExcludingGenerated(context, person.id);
    if (existingDayMinutes + duration > DAILY_LIMIT) return false;
    const weekMinutes = weekMinutesExcludingDateProposals(context, person.id);
    if (weekMinutes + duration > WEEKLY_LIMIT) return false;
    return true;
  }

  function addOrExtendProposal(context, person, rule, slotStart, slotEnd, stage) {
    let proposal = context.proposals.find(item => item.staffId === person.id);
    if (!proposal) {
      const window = initialWindow(context, person, rule, slotStart, slotEnd, stage);
      proposal = {
        id: autoUid(),
        staffId: person.id,
        startStoreId: rule.storeId,
        start: window.start,
        end: window.end,
        memo: '',
        autoGenerated: true,
        autoSource: 'v2-two-stage',
        autoStage: stage,
        autoCreatedAt: new Date().toISOString(),
        autoReasons: [],
      };
      context.proposals.push(proposal);
      context.working[context.date].push(proposal);
    } else if (!(proposal.start <= slotStart && proposal.end >= slotEnd)) {
      const expanded = expandedWindow(proposal, slotStart, slotEnd, stage);
      proposal.start = expanded.start;
      proposal.end = expanded.end;
    }
    const skill = context.skills.find(item => item.id === rule.skillId);
    const reason = `${skill?.name || rule.skillId} Lv${rule.minLevel} ${fmtTime(rule.start)}-${fmtTime(rule.end)}`;
    if (!proposal.autoReasons.includes(reason)) proposal.autoReasons.push(reason);
    proposal.memo = `自動配置: ${proposal.autoReasons.slice(0, 4).join(' / ')}`;
  }

  function initialWindow(context, person, rule, slotStart, slotEnd, stage) {
    const store = context.stores.find(item => item.id === rule.storeId);
    const duration = Number(rule.end) - Number(rule.start);
    if (stage === 'employee') {
      let start;
      let end;
      if (rule.skillId === 'closing') {
        end = Math.min(DAY_END, Math.max(Number(rule.end), Number(store?.close || rule.end)));
        start = Math.max(DAY_START, end - DAILY_LIMIT);
      } else if (rule.skillId === 'opening') {
        start = Math.max(DAY_START, Number(rule.start));
        end = Math.min(DAY_END, start + DAILY_LIMIT);
      } else {
        start = Math.max(DAY_START, Number(rule.start));
        end = Math.min(DAY_END, Math.max(Number(rule.end), start + Math.min(DAILY_LIMIT, Math.max(duration, 6 * 60))));
        if (end - start < Math.min(DAILY_LIMIT, duration)) start = Math.max(DAY_START, end - Math.min(DAILY_LIMIT, duration));
      }
      return { start: snap(start), end: snap(end) };
    }

    const target = Math.min(PART_TIME_TARGET, Math.max(duration, 4 * 60));
    let start = Math.max(DAY_START, Number(rule.start));
    let end = Math.min(DAY_END, Math.max(Number(rule.end), start + target));
    if (end - start < target && end === DAY_END) start = Math.max(DAY_START, end - target);
    return { start: snap(start), end: snap(end) };
  }

  function expandedWindow(proposal, slotStart, slotEnd, stage) {
    const maxDuration = stage === 'parttime' ? DAILY_LIMIT : DAILY_LIMIT;
    let start = Math.min(Number(proposal.start), Number(slotStart));
    let end = Math.max(Number(proposal.end), Number(slotEnd));
    if (end - start > maxDuration) {
      if (slotEnd > proposal.end) start = end - maxDuration;
      else end = start + maxDuration;
    }
    return { start: snap(Math.max(DAY_START, start)), end: snap(Math.min(DAY_END, end)) };
  }

  function candidateScore(context, person, rule, stage) {
    let score = skillLevel(person, rule.skillId) * 120;
    if (person.mainStoreId === rule.storeId) score += 55;
    else if ((person.affiliationStoreIds || []).includes(rule.storeId)) score += 35;
    if (stage === 'employee' && person.employmentType === '正社員') score += 35;
    if (stage === 'employee' && person.employmentType === '契約社員') score += 15;
    const currentWeek = weekMinutesExcludingDateProposals(context, person.id);
    score += Math.max(0, WEEKLY_LIMIT - currentWeek) / 20;
    const currentAssignments = context.proposals.filter(item => item.staffId === person.id).length;
    score -= currentAssignments * 25;
    const level = skillLevel(person, rule.skillId);
    if (Number(rule.minLevel) >= 2 && level >= 3) score += 25;
    return score;
  }

  function matchesStage(person, stage) {
    if (stage === 'employee') return person.employmentType === '正社員' || person.employmentType === '契約社員';
    return person.employmentType === 'アルバイト';
  }

  function hasLockedShift(context, staffId) {
    return context.working[context.date].some(shift => String(shift.staffId || '').toUpperCase() === staffId && !shift.autoGenerated);
  }

  function storeAllowed(person, storeId) {
    const stores = Array.isArray(person.placementStoreIds) && person.placementStoreIds.length
      ? person.placementStoreIds
      : Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : [];
    return !stores.length || stores.includes(storeId);
  }

  function qualifiedIds(context, rule, slotStart, slotEnd) {
    const ids = new Set();
    context.working[context.date].forEach(shift => {
      const person = context.staff.find(item => item.id === String(shift.staffId || '').toUpperCase());
      if (!person || skillLevel(person, rule.skillId) < Number(rule.minLevel)) return;
      const segments = deriveSegments(shift, context.stores);
      if (segments.some(segment => segment.storeId === rule.storeId && segment.start <= slotStart && segment.end >= slotEnd)) ids.add(person.id);
    });
    return ids;
  }

  function shortageResult(context, rule) {
    let minimum = Infinity;
    for (let slotStart = Number(rule.start); slotStart < Number(rule.end); slotStart += SLOT) {
      const slotEnd = Math.min(Number(rule.end), slotStart + SLOT);
      minimum = Math.min(minimum, qualifiedIds(context, rule, slotStart, slotEnd).size);
    }
    if (!Number.isFinite(minimum)) minimum = 0;
    return { rule, minimum, shortage: Math.max(0, Number(rule.count) - minimum) };
  }

  function dayMinutesExcludingGenerated(context, staffId) {
    return context.working[context.date].reduce((sum, shift) => {
      if (String(shift.staffId || '').toUpperCase() !== staffId || shift.autoGenerated) return sum;
      return sum + Math.max(0, Number(shift.end) - Number(shift.start));
    }, 0);
  }

  function weekMinutesExcludingDateProposals(context, staffId) {
    const range = weekRange(context.date);
    let total = 0;
    Object.entries(context.working).forEach(([date, rows]) => {
      if (date < range.start || date > range.end || !Array.isArray(rows)) return;
      rows.forEach(shift => {
        if (String(shift.staffId || '').toUpperCase() !== staffId) return;
        if (date === context.date && shift.autoGenerated) return;
        total += Math.max(0, Number(shift.end) - Number(shift.start));
      });
    });
    return total;
  }

  function renderPreview() {
    const summary = document.getElementById('auto-plan-summary');
    const body = document.getElementById('auto-plan-body');
    const apply = document.getElementById('auto-apply');
    if (!summary || !body || !state.preview) return;
    const plan = state.preview;

    if (plan.blocked) {
      summary.innerHTML = '<div class="auto-summary danger"><strong>自動配置できません</strong><span>確定済み</span></div>';
      body.innerHTML = `<div class="auto-blocked"><i class="fa-solid fa-lock"></i><strong>${esc(plan.warning)}</strong></div>`;
      if (apply) apply.disabled = true;
      return;
    }

    const employeeCount = plan.proposals.filter(item => item.autoStage === 'employee').length;
    const parttimeCount = plan.proposals.filter(item => item.autoStage === 'parttime').length;
    const hardShortage = plan.shortages.filter(item => item.rule.mode !== 'soft').length;
    summary.innerHTML = `
      <div class="auto-summary-metric"><small>新規配置</small><strong>${plan.proposals.length}名</strong></div>
      <div class="auto-summary-metric"><small>社員</small><strong>${employeeCount}名</strong></div>
      <div class="auto-summary-metric"><small>アルバイト</small><strong>${parttimeCount}名</strong></div>
      <div class="auto-summary-metric ${hardShortage ? 'danger' : 'ok'}"><small>必須条件の残不足</small><strong>${hardShortage}件</strong></div>
    `;

    const staff = loadStaff(loadSkills());
    const stores = loadStores();
    const skills = loadSkills();
    const proposalHtml = plan.proposals.map(item => {
      const person = staff.find(p => p.id === item.staffId);
      const store = stores.find(s => s.id === item.startStoreId);
      return `<div class="auto-proposal ${item.autoStage}">
        <div class="auto-person"><strong>${esc(person?.name || item.staffId)}</strong><span>${esc(person?.employmentType || '')} ・ ${esc(store?.name || item.startStoreId)}</span></div>
        <div class="auto-time">${fmtTime(item.start)}〜${fmtTime(item.end)}</div>
        <div class="auto-reasons">${item.autoReasons.map(reason => `<span>${esc(reason)}</span>`).join('')}</div>
      </div>`;
    }).join('');

    const shortageHtml = plan.shortages.map(result => {
      const rule = result.rule;
      const store = stores.find(item => item.id === rule.storeId);
      const skill = skills.find(item => item.id === rule.skillId);
      return `<div class="auto-shortage ${rule.mode === 'soft' ? 'soft' : 'hard'}"><strong>${esc(store?.name || rule.storeId)} ${fmtTime(rule.start)}-${fmtTime(rule.end)}</strong><span>${esc(skill?.name || rule.skillId)} Lv${rule.minLevel}以上：${result.minimum}/${rule.count}名</span></div>`;
    }).join('');

    body.innerHTML = `
      ${plan.notes?.length ? `<div class="auto-note">${plan.notes.map(note => `<div>${esc(note)}</div>`).join('')}</div>` : ''}
      <div class="auto-preview-section"><h3>配置案</h3>${proposalHtml || '<div class="auto-empty">追加配置は必要ありません。</div>'}</div>
      <div class="auto-preview-section"><h3>配置後も残る不足</h3>${shortageHtml || '<div class="auto-all-clear"><i class="fa-solid fa-circle-check"></i> 対象条件を満たせる配置案です。</div>'}</div>
      <div class="auto-assumption"><i class="fa-solid fa-circle-info"></i> 現段階では、在籍・雇用区分・配置可能店舗・スキル習熟度・1日8h/週40h・既存シフトを使って計算しています。個別の曜日/時間希望はカルテに追加後、制約へ組み込みます。</div>
    `;
    if (apply) apply.disabled = plan.proposals.length === 0;
  }

  async function applyPreview() {
    const plan = state.preview;
    if (!plan || plan.blocked || !plan.proposals.length) return;
    if (isConfirmed(plan.date)) {
      window.alert('この日は確定済みになったため反映できません。');
      return;
    }
    const shifts = loadJson(STORAGE_SHIFTS, {});
    if (!Array.isArray(shifts[plan.date])) shifts[plan.date] = [];
    const existingStaff = new Set(shifts[plan.date].map(shift => String(shift.staffId || '').toUpperCase()));
    const additions = plan.proposals.filter(item => !existingStaff.has(item.staffId)).map(item => clone(item));
    shifts[plan.date].push(...additions);
    localStorage.setItem(STORAGE_SHIFTS, JSON.stringify(shifts));
    try {
      if (window.shiftV2Cloud && window.shiftV2User) await window.shiftV2Cloud.set(CLOUD_SHIFTS, shifts);
    } catch (error) {
      console.warn('Auto placement cloud save failed', error);
    }
    sessionStorage.setItem('okk_shift_v2_auto_restore_date', plan.date);
    closeModal();
    notify(`自動配置 ${additions.length}名を反映しました`);
    setTimeout(() => window.location.reload(), 350);
  }

  async function clearGenerated() {
    const date = selectedDate();
    if (!date || isConfirmed(date)) {
      window.alert('確定済みの日は自動配置を取り消せません。');
      return;
    }
    const shifts = loadJson(STORAGE_SHIFTS, {});
    const rows = Array.isArray(shifts[date]) ? shifts[date] : [];
    const generated = rows.filter(shift => shift.autoGenerated && shift.autoSource === 'v2-two-stage');
    if (!generated.length) {
      notify('この日に自動配置されたシフトはありません');
      return;
    }
    if (!window.confirm(`この日の自動配置 ${generated.length}件だけを取り消します。手入力のシフトは残ります。`)) return;
    shifts[date] = rows.filter(shift => !(shift.autoGenerated && shift.autoSource === 'v2-two-stage'));
    localStorage.setItem(STORAGE_SHIFTS, JSON.stringify(shifts));
    try {
      if (window.shiftV2Cloud && window.shiftV2User) await window.shiftV2Cloud.set(CLOUD_SHIFTS, shifts);
    } catch (error) {
      console.warn('Clear auto placement cloud save failed', error);
    }
    sessionStorage.setItem('okk_shift_v2_auto_restore_date', date);
    closeModal();
    notify(`自動配置 ${generated.length}件を取り消しました`);
    setTimeout(() => window.location.reload(), 350);
  }

  function decorateAutoBars() {
    const date = selectedDate();
    if (!date) return;
    const shifts = loadJson(STORAGE_SHIFTS, {});
    const map = new Map((Array.isArray(shifts[date]) ? shifts[date] : []).map(shift => [shift.id, shift]));
    document.querySelectorAll('#gantt-canvas .shift-bar').forEach(bar => {
      bar.querySelector('.auto-generated-badge')?.remove();
      const shift = map.get(bar.dataset.shiftId);
      if (!shift?.autoGenerated) return;
      bar.classList.add('auto-generated-shift');
      const badge = document.createElement('span');
      badge.className = `auto-generated-badge ${shift.autoStage || ''}`;
      badge.textContent = shift.autoStage === 'employee' ? '社員AUTO' : 'バイトAUTO';
      bar.appendChild(badge);
    });
  }

  function loadSkills() {
    const stored = loadJson(STORAGE_SKILLS, []);
    return Array.isArray(stored) ? stored.filter(skill => skill.active !== false) : [];
  }

  function loadStaff(skills) {
    const list = loadJson(STORAGE_STAFF, []);
    if (!Array.isArray(list)) return [];
    return list.map(person => ({
      ...person,
      id: String(person.id || person.employeeNumber || '').toUpperCase(),
      name: person.name || `${person.lastName || ''} ${person.firstName || ''}`.trim(),
      employmentType: person.employmentType || (person.salaryType === 'monthly' ? '正社員' : 'アルバイト'),
      skillLevels: normalizeLevels(person, skills),
      active: typeof person.active === 'boolean' ? person.active : true,
    })).filter(person => person.id);
  }

  function normalizeLevels(person, skills) {
    const levels = { ...(person.skillLevels || {}) };
    const legacyMap = { 'オープン準備':'opening','締め作業':'closing','肉場':'meat','サラダ場':'salad','ホール':'hall','ホール（肉焼ける）':'hall','ホール（肉焼けない）':'hall','ドリンク':'drink','ドリンカー':'drink','洗い場':'dish','レジ':'register' };
    (Array.isArray(person.skills) ? person.skills : []).forEach(name => {
      const id = legacyMap[name];
      if (id && !levels[id]) levels[id] = 1;
    });
    skills.forEach(skill => { levels[skill.id] = clampLevel(levels[skill.id]); });
    return levels;
  }

  function loadStores() {
    const stores = loadJson(STORAGE_STORES, []);
    return Array.isArray(stores) ? stores : [];
  }

  function applicableRules(date, skills) {
    const activeSkillIds = new Set(skills.map(skill => skill.id));
    const rules = loadJson(STORAGE_REQUIREMENTS, []);
    if (!Array.isArray(rules)) return [];
    const active = rules.filter(rule => rule.active !== false && activeSkillIds.has(rule.skillId) && dayMatches(rule, date));
    const overrides = new Set(active.filter(rule => rule.dayType === 'specific' && rule.specificDate === date).map(rule => ruleKey(rule)));
    return active.filter(rule => rule.dayType === 'specific' || !overrides.has(ruleKey(rule)));
  }

  function ruleKey(rule) {
    return `${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`;
  }

  function dayMatches(rule, dateString) {
    if (rule.dayType === 'specific') return rule.specificDate === dateString;
    const day = new Date(`${dateString}T00:00:00`).getDay();
    if (rule.dayType === 'weekday') return day >= 1 && day <= 4;
    if (rule.dayType === 'fri_sat') return day === 5 || day === 6;
    if (rule.dayType === 'sun') return day === 0;
    return true;
  }

  function deriveSegments(shift, stores) {
    const store = stores.find(item => item.id === shift.startStoreId);
    const start = Number(shift.start);
    const end = Number(shift.end);
    if (!store) return [{ storeId: shift.startStoreId, start, end }];
    if (store.autoJoin && store.joinTarget && end > Number(store.close)) {
      if (start >= Number(store.close)) return [{ storeId: store.joinTarget, start, end }];
      return [{ storeId: store.id, start, end: Number(store.close) }, { storeId: store.joinTarget, start: Number(store.close), end }];
    }
    return [{ storeId: store.id, start, end }];
  }

  function isConfirmed(date) {
    const audit = loadJson(STORAGE_AUDIT, {});
    return Boolean(audit?.dayStatus?.[date]?.confirmed);
  }

  function selectedDate() {
    return document.getElementById('work-date')?.value || '';
  }

  function skillLevel(person, skillId) {
    return clampLevel(person.skillLevels?.[skillId]);
  }

  function clampLevel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0;
  }

  function weekRange(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    const day = date.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + offset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: dateKey(monday), end: dateKey(sunday) };
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function formatDateJa(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${['日','月','火','水','木','金','土'][date.getDay()]}）`;
  }

  function fmtTime(totalMinutes) {
    const value = Number(totalMinutes);
    const next = value >= 24 * 60;
    const hour = Math.floor(value / 60) % 24;
    const minute = value % 60;
    return `${next ? '翌' : ''}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function snap(value) { return Math.round(Number(value) / SLOT) * SLOT; }
  function autoUid() { return `auto_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? clone(fallback); } catch { return clone(fallback); } }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;' }[char])); }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2100);
  }

  function injectStyles() {
    if (document.getElementById('shift-v2-auto-placement-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-auto-placement-style';
    style.textContent = `
      .auto-placement-toolbar{display:flex;align-items:center;gap:7px;margin-left:8px;padding-left:10px;border-left:1px solid #e4e7ec}.auto-placement-caption{font-size:8px;color:#667085;font-weight:800}.auto-modal-bg{display:none;position:fixed;inset:0;z-index:1600;background:rgba(16,24,40,.62);align-items:center;justify-content:center;padding:24px}.auto-modal-bg.open{display:flex}.auto-modal{width:min(980px,97vw);max-height:94vh;background:#fff;border-radius:15px;box-shadow:0 26px 70px rgba(16,24,40,.30);overflow:hidden;display:flex;flex-direction:column}.auto-modal-head{display:flex;align-items:flex-start;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #e4e7ec}.auto-kicker{font-size:8px;letter-spacing:.12em;font-weight:900;color:#667085}.auto-modal-head h2{margin:1px 0 2px;font-size:20px}.auto-modal-head>div>div{font-size:9px;color:#667085}.auto-modal-body{padding:14px 18px;overflow:auto}.auto-mode-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.auto-mode-card{border:1px solid #e4e7ec;border-radius:10px;background:#fff;padding:11px;text-align:left;cursor:pointer;color:#344054;display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:center}.auto-mode-card>i{grid-row:1/3;display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#f2f4f7}.auto-mode-card strong{font-size:10px}.auto-mode-card span{font-size:8px;color:#667085;line-height:1.45}.auto-mode-card.active{border-color:#12b76a;background:#f6fef9;box-shadow:0 0 0 2px rgba(18,183,106,.09)}.auto-mode-card.active>i{background:#d1fadf;color:#027a48}.auto-options{display:flex;align-items:center;gap:16px;padding:10px 12px;margin:10px 0;background:#f8fafc;border-radius:8px;font-size:9px;color:#475467}.auto-options label{font-weight:900}.auto-options input{width:auto}.auto-plan-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0}.auto-summary-metric{border:1px solid #eaecf0;border-radius:9px;padding:9px 10px}.auto-summary-metric small{display:block;font-size:8px;color:#667085}.auto-summary-metric strong{font-size:17px}.auto-summary-metric.ok{background:#ecfdf3;border-color:#abefc6}.auto-summary-metric.danger{background:#fef3f2;border-color:#fecdca;color:#b42318}.auto-summary.danger{padding:10px;border-radius:9px;background:#fef3f2;border:1px solid #fecdca;color:#b42318;display:flex;justify-content:space-between}.auto-preview-section{margin-top:12px}.auto-preview-section h3{font-size:10px;color:#344054;margin:0 0 6px}.auto-proposal{display:grid;grid-template-columns:180px 100px 1fr;gap:9px;align-items:center;padding:7px 9px;border:1px solid #eaecf0;border-radius:8px;margin-bottom:5px;border-left:3px solid #12b76a}.auto-proposal.parttime{border-left-color:#2e90fa}.auto-person strong{display:block;font-size:10px}.auto-person span{display:block;font-size:8px;color:#667085}.auto-time{font-size:10px;font-weight:900}.auto-reasons{display:flex;gap:4px;flex-wrap:wrap}.auto-reasons span{font-size:7px;padding:3px 5px;border-radius:999px;background:#f2f4f7;color:#475467}.auto-shortage{display:inline-flex;flex-direction:column;gap:1px;border-radius:8px;padding:6px 8px;margin:0 5px 5px 0;background:#fff5f4;border:1px solid #fecdca;border-left:3px solid #f04438}.auto-shortage.soft{background:#fffaeb;border-color:#fedf89;border-left-color:#f79009}.auto-shortage strong{font-size:8px}.auto-shortage span{font-size:8px;font-weight:900}.auto-all-clear{padding:9px;border-radius:8px;background:#ecfdf3;color:#05603a;font-size:9px;font-weight:900}.auto-empty{padding:10px;border-radius:8px;background:#f8fafc;color:#667085;font-size:9px}.auto-note{padding:8px;border-radius:8px;background:#fffaeb;color:#93370d;font-size:8px;margin:8px 0}.auto-assumption{margin-top:12px;padding:8px 10px;border-radius:8px;background:#f8fafc;color:#667085;font-size:8px;line-height:1.6}.auto-blocked{display:flex;align-items:center;gap:9px;padding:18px;border-radius:10px;background:#fef3f2;color:#b42318;margin-top:10px}.auto-blocked i{font-size:20px}.auto-modal-foot{padding:11px 18px;border-top:1px solid #e4e7ec;display:flex;justify-content:space-between;align-items:center;gap:10px}.auto-foot-left,.auto-foot-right{display:flex;align-items:center;gap:7px}.auto-foot-left small{font-size:7px;color:#98a2b3}.auto-danger{background:#fff;color:#b42318;border-color:#fecdca}.auto-generated-shift{outline:2px solid rgba(18,183,106,.28);outline-offset:1px}.auto-generated-badge{position:absolute;top:-15px;right:3px;background:#027a48;color:#fff;border-radius:999px;padding:2px 5px;font-size:6px;font-weight:900;line-height:1;z-index:8;white-space:nowrap}.auto-generated-badge.parttime{background:#175cd3}@media(max-width:900px){.auto-mode-grid{grid-template-columns:1fr}.auto-plan-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.auto-proposal{grid-template-columns:1fr 90px}.auto-reasons{grid-column:1/3}.auto-modal-foot{align-items:flex-start;flex-direction:column}.auto-placement-caption{display:none}}
    `;
    document.head.appendChild(style);
  }
})();