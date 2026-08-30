(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const PLAN_KEY = 'okk_shift_v2_work_plans';
  const AGREEMENT_KEY = 'okk_shift_v2_36_agreement';
  const APPROVAL_KEY = 'okk_shift_v2_overtime_exceptions';
  const CLOUD_AGREEMENT = 'shiftV236Agreement';
  const CLOUD_APPROVALS = 'shiftV2OvertimeExceptions';
  const DAILY_LIMIT = 8 * 60;
  const WEEKLY_LIMIT = 40 * 60;
  const INTERNAL_WARN = 25 * 60;

  const DEFAULT_AGREEMENT = {
    workingTimeSystem: 'standard',
    agreementStartMonth: 1,
    ordinaryMonthlyLimitHours: 45,
    ordinaryAnnualLimitHours: 360,
    specialClauseEnabled: false,
    specialMonthlyLimitHours: 60,
    specialAnnualLimitHours: 720,
    overOrdinaryMonthsMax: 6,
    singleMonthWithHolidayLimitHours: 100,
    multiMonthAverageLimitHours: 80,
    updatedAt: '',
    note: '',
  };

  const state = {
    agreement: normalizeAgreement(loadJson(AGREEMENT_KEY, DEFAULT_AGREEMENT)),
    approvals: normalizeApprovals(loadJson(APPROVAL_KEY, [])),
    month: '',
    selectedStaffId: '',
    timer: null,
    cloudBusy: false,
    lastSignature: '',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    injectPlannerBar();
    injectMasterPanel();
    injectModal();
    bindGlobalEvents();
    state.month = currentMonth();
    renderAll(true);
    // Local changes are event-driven; this is only a compatibility backstop.
    state.timer = setInterval(() => renderAll(false), 10000);
    document.addEventListener('shiftv2-auth', () => setTimeout(hydrateCloud, 250));
    setTimeout(hydrateCloud, 1100);
    exposeApi();
  }

  function injectPlannerBar() {
    const planner = document.getElementById('view-planner');
    if (!planner || document.getElementById('overtime-governance-bar')) return;
    const bar = document.createElement('section');
    bar.id = 'overtime-governance-bar';
    bar.className = 'card overtime-governance-bar';
    const audit = document.getElementById('shift-audit-bar');
    const labor = document.getElementById('labor-alert-banner');
    const toolbar = planner.querySelector('.toolbar');
    if (audit) audit.insertAdjacentElement('afterend', bar);
    else if (labor) labor.insertAdjacentElement('afterend', bar);
    else toolbar?.insertAdjacentElement('afterend', bar);
  }

  function injectMasterPanel() {
    const master = document.getElementById('view-master');
    if (!master || document.getElementById('overtime-master-panel')) return;
    const panel = document.createElement('section');
    panel.id = 'overtime-master-panel';
    panel.className = 'card overtime-master-panel';
    const workPlan = document.getElementById('work-plan-panel');
    if (workPlan) workPlan.insertAdjacentElement('afterend', panel);
    else master.prepend(panel);
  }

  function injectModal() {
    if (document.getElementById('overtime-exception-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'overtime-exception-modal';
    modal.className = 'overtime-modal-bg';
    modal.innerHTML = `
      <div class="overtime-modal" role="dialog" aria-modal="true" aria-label="30時間超例外承認">
        <div class="overtime-modal-head">
          <div><span>OVERTIME EXCEPTION</span><h2>30時間超 例外申請・役員会承認</h2><p id="overtime-modal-person"></p></div>
          <button id="overtime-modal-close" class="btn btn-light btn-small"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="overtime-modal-body">
          <div class="overtime-form-grid">
            <label>対象月<input id="overtime-request-month" class="control" type="month"></label>
            <label>例外上限<input id="overtime-request-limit" class="control" type="number" min="31" max="99" step="1"><span>時間</span></label>
            <label>翌月の抑制目標<input id="overtime-next-target" class="control" type="number" min="0" max="30" step="1" value="10"><span>時間以下</span></label>
            <label class="wide">理由<textarea id="overtime-request-reason" class="control" rows="3" placeholder="繁忙期、欠員対応、大型予約対応など。具体的に記録"></textarea></label>
            <label class="wide">役員会メモ / 議事録参照<textarea id="overtime-board-note" class="control" rows="2" placeholder="承認会議、議事録番号、条件など"></textarea></label>
          </div>
          <div id="overtime-modal-assessment" class="overtime-modal-assessment"></div>
          <div id="overtime-history-list" class="overtime-history-list"></div>
        </div>
        <div class="overtime-modal-foot">
          <button id="overtime-request-submit" class="btn btn-light"><i class="fa-solid fa-paper-plane"></i> 例外申請を保存</button>
          <div>
            <button id="overtime-reject" class="btn overtime-danger"><i class="fa-solid fa-xmark"></i> 却下</button>
            <button id="overtime-approve" class="btn btn-green"><i class="fa-solid fa-gavel"></i> 役員会承認</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function bindGlobalEvents() {
    document.addEventListener('click', event => {
      const confirmButton = event.target.closest?.('#audit-confirm-day, #audit-confirm-month');
      if (!confirmButton) return;
      const months = [document.getElementById('work-date')?.value?.slice(0, 7)].filter(Boolean);
      const blocked = months.flatMap(month => confirmationBlocks(month));
      if (!blocked.length) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const message = blocked.slice(0, 5).map(item => `${item.name}：${formatMinutes(item.minutes)} / ${item.reason}`).join('\n');
      window.alert(`このままではシフト確定できません。\n\n${message}\n\n30時間超は例外承認を記録し、36協定設定内に収めてください。`);
      openForStaff(blocked[0].staffId, months[0]);
    }, true);

    document.getElementById('overtime-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('overtime-exception-modal')?.addEventListener('click', event => {
      if (event.target.id === 'overtime-exception-modal') closeModal();
    });
    document.getElementById('overtime-request-submit')?.addEventListener('click', saveRequest);
    document.getElementById('overtime-approve')?.addEventListener('click', approveLatest);
    document.getElementById('overtime-reject')?.addEventListener('click', rejectLatest);
    document.getElementById('overtime-request-limit')?.addEventListener('input', renderModalAssessment);
    document.getElementById('overtime-request-month')?.addEventListener('change', renderModalAssessment);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
    window.addEventListener('storage', event => {
      if ([STAFF_KEY, SHIFTS_KEY, PLAN_KEY, AGREEMENT_KEY, APPROVAL_KEY].includes(event.key)) renderAll(true);
    });
    document.addEventListener('shiftv2-storage', event => {
      const keys = event.detail?.keys || [];
      if (keys.includes('*') || keys.some(key => [STAFF_KEY, SHIFTS_KEY, PLAN_KEY, AGREEMENT_KEY, APPROVAL_KEY].includes(key))) {
        renderAll(true);
      }
    });
    document.getElementById('work-date')?.addEventListener('change', () => setTimeout(() => renderAll(true), 0));
  }

  function renderAll(force) {
    injectPlannerBar();
    injectMasterPanel();
    const signature = dataSignature();
    if (!force && signature === state.lastSignature) return;
    state.lastSignature = signature;
    state.agreement = normalizeAgreement(loadJson(AGREEMENT_KEY, state.agreement));
    state.approvals = normalizeApprovals(loadJson(APPROVAL_KEY, state.approvals));
    if (!state.month) state.month = currentMonth();
    renderPlannerBar();
    renderMasterPanel();
    if (document.getElementById('overtime-exception-modal')?.classList.contains('open')) renderModalAssessment();
  }

  function renderPlannerBar() {
    const bar = document.getElementById('overtime-governance-bar');
    if (!bar) return;
    const date = document.getElementById('work-date')?.value;
    const month = date?.slice(0, 7) || currentMonth();
    const staff = fullTimeStaff();
    const rows = staff.map(person => ({ person, assessment: assessMonth(person.id, month) }));
    const red = rows.filter(row => ['unapproved', 'hard'].includes(row.assessment.status));
    const approved = rows.filter(row => row.assessment.status === 'approved');
    const watch = rows.filter(row => row.assessment.status === 'watch');
    const className = red.length ? 'danger' : approved.length ? 'approved' : watch.length ? 'watch' : 'clear';
    const lead = red.length
      ? `${red.length}名が30時間超の未承認または36協定設定超過です`
      : approved.length
        ? `${approved.length}名が30時間超の例外承認内です`
        : watch.length
          ? `${watch.length}名が25時間を超えています`
          : '予定時間外は社内30時間ライン内です';
    const chips = rows
      .filter(row => row.assessment.minutes >= INTERNAL_WARN || row.assessment.status === 'approved')
      .sort((a, b) => b.assessment.minutes - a.assessment.minutes)
      .slice(0, 6)
      .map(row => `<button class="overtime-chip ${row.assessment.status}" data-overtime-open="${esc(row.person.id)}" data-overtime-month="${month}">${esc(row.person.name || row.person.id)} ${formatHours(row.assessment.minutes)}h</button>`)
      .join('');

    bar.className = `card overtime-governance-bar ${className}`;
    bar.innerHTML = `
      <div class="overtime-bar-main">
        <div><strong><i class="fa-solid fa-shield-heart"></i> 残業ガバナンス</strong><span>${esc(month)} ・ ${esc(lead)}</span></div>
        <div class="overtime-bar-actions">${chips}<button id="overtime-open-master" class="btn btn-light btn-small"><i class="fa-solid fa-sliders"></i> 残業管理</button></div>
      </div>
      <div class="overtime-bar-note">社内通常ライン ${internalCapHours()}h/月。固定残業A25h・B45hは上限ではなく給与属性。30h超は役員会承認、36協定設定は別のハード判定です。</div>
    `;
    bar.querySelectorAll('[data-overtime-open]').forEach(button => button.addEventListener('click', () => openForStaff(button.dataset.overtimeOpen, button.dataset.overtimeMonth)));
    document.getElementById('overtime-open-master')?.addEventListener('click', () => {
      document.querySelector('.tab[data-view="master"]')?.click();
      setTimeout(() => document.getElementById('overtime-master-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    });
  }

  function renderMasterPanel() {
    const panel = document.getElementById('overtime-master-panel');
    if (!panel) return;
    const month = state.month || currentMonth();
    const staff = fullTimeStaff();
    const rows = staff.map(person => ({ person, assessment: assessMonth(person.id, month) }));
    const annualPeriod = agreementPeriodForMonth(month);
    const annualStatus = companyAnnualSummary(annualPeriod);

    panel.innerHTML = `
      <div class="overtime-master-head">
        <div><h2>残業・36協定・例外承認</h2><p>30時間はOKKの通常運用ライン。超える月は役員会承認を記録し、36協定の届出値を超える確定は止めます。</p></div>
        <div class="overtime-master-month"><label>確認月 <input id="overtime-master-month" class="control" type="month" value="${month}"></label></div>
      </div>

      <div class="agreement-settings">
        <label>労働時間制<select id="agreement-system" class="control"><option value="standard" ${state.agreement.workingTimeSystem === 'standard' ? 'selected' : ''}>通常 1日8h・週40h</option><option value="annual_variable" ${state.agreement.workingTimeSystem === 'annual_variable' ? 'selected' : ''}>1年単位の変形労働時間制</option></select></label>
        <label>36協定 起算月<select id="agreement-start-month" class="control">${monthOptions(state.agreement.agreementStartMonth)}</select></label>
        <label>通常 月上限<input id="agreement-monthly" class="control" type="number" min="1" max="45" value="${state.agreement.ordinaryMonthlyLimitHours}"><span>h</span></label>
        <label>通常 年上限<input id="agreement-annual" class="control" type="number" min="1" max="360" value="${state.agreement.ordinaryAnnualLimitHours}"><span>h</span></label>
        <label class="agreement-check"><input id="agreement-special-enabled" type="checkbox" ${state.agreement.specialClauseEnabled ? 'checked' : ''}> 特別条項あり</label>
        <label>特別条項 月上限<input id="agreement-special-monthly" class="control" type="number" min="1" max="99" value="${state.agreement.specialMonthlyLimitHours}"><span>h</span></label>
        <label>特別条項 年上限<input id="agreement-special-annual" class="control" type="number" min="1" max="720" value="${state.agreement.specialAnnualLimitHours}"><span>h</span></label>
        <label>通常上限超の月数<input id="agreement-over-months" class="control" type="number" min="0" max="6" value="${state.agreement.overOrdinaryMonthsMax}"><span>回/年</span></label>
        <button id="agreement-save" class="btn btn-dark"><i class="fa-solid fa-floppy-disk"></i> 36協定設定を保存</button>
      </div>
      <div class="agreement-note">初期値は一般的な上限値を入れていますが、必ずOKKが実際に届け出た36協定の数値へ合わせてください。1年単位の変形労働時間制を選ぶと通常上限の初期目安は月42h・年320hです。</div>

      <div class="overtime-summary-strip">
        <span>対象期間 ${annualPeriod.start.slice(0, 7)}〜${annualPeriod.end.slice(0, 7)}</span>
        <span>30h超予定 ${rows.filter(row => row.assessment.minutes > internalCapMinutes()).length}名</span>
        <span>承認済 ${rows.filter(row => row.assessment.status === 'approved').length}名</span>
        <span class="${annualStatus.hard ? 'danger' : ''}">36協定ハード警告 ${annualStatus.hardCount}件</span>
      </div>

      <div class="overtime-table-wrap"><table class="overtime-table">
        <thead><tr><th>正社員</th><th>プラン</th><th>予定時間外</th><th>社内30h</th><th>36協定</th><th>例外承認</th><th></th></tr></thead>
        <tbody>${rows.map(row => overtimeRow(row.person, row.assessment, month)).join('') || '<tr><td colspan="7" class="overtime-empty">正社員データがありません。</td></tr>'}</tbody>
      </table></div>
      <div class="overtime-legal-note"><i class="fa-solid fa-triangle-exclamation"></i> 現在の予定時間外は、V2上の標準休憩を控除した上で「1日8h・週40h」を基準に算定しています。法定休日労働を含む単月100h未満・2〜6か月平均80h以内の完全判定は、休日カレンダー接続後に精密化します。ただし予定時間外だけで上限に達する場合は現在でもハード警告します。</div>
    `;

    panel.querySelector('#overtime-master-month')?.addEventListener('change', event => { state.month = event.target.value || currentMonth(); renderAll(true); });
    panel.querySelector('#agreement-system')?.addEventListener('change', onAgreementSystemChange);
    panel.querySelector('#agreement-save')?.addEventListener('click', saveAgreementFromPanel);
    panel.querySelectorAll('[data-overtime-open]').forEach(button => button.addEventListener('click', () => openForStaff(button.dataset.overtimeOpen, button.dataset.overtimeMonth)));
  }

  function overtimeRow(person, assessment, month) {
    const approval = assessment.approval;
    const statusLabel = {
      ok: '通常', watch: '注意', unapproved: '要承認', approved: '承認済', hard: '36協定警告', pending: '申請中',
    }[assessment.status] || assessment.status;
    const agreementText = assessment.hardReason ? assessment.hardReason : `通常 ${state.agreement.ordinaryMonthlyLimitHours}h`;
    const approvalText = approval
      ? `${approval.status === 'approved' ? '承認' : approval.status === 'pending' ? '申請中' : approval.status} ${approval.requestedLimitHours}h / 翌月${approval.nextMonthTargetHours}h`
      : '—';
    return `<tr class="status-${assessment.status}">
      <td><strong>${esc(person.name || person.id)}</strong><small>${esc(person.id || '')}</small></td>
      <td>${esc(person.workPlanId ? person.workPlanId + 'プラン' : '未設定')}</td>
      <td><b>${formatHours(assessment.minutes)}h</b></td>
      <td><span class="overtime-status ${assessment.status}">${statusLabel}</span></td>
      <td>${esc(agreementText)}</td>
      <td>${esc(approvalText)}</td>
      <td><button class="btn btn-light btn-small" data-overtime-open="${esc(person.id)}" data-overtime-month="${month}">${assessment.minutes > internalCapMinutes() ? '申請/確認' : '詳細'}</button></td>
    </tr>`;
  }

  function onAgreementSystemChange(event) {
    const next = event.target.value;
    const monthly = document.getElementById('agreement-monthly');
    const annual = document.getElementById('agreement-annual');
    if (next === 'annual_variable') {
      if (monthly) monthly.value = '42';
      if (annual) annual.value = '320';
    } else {
      if (monthly) monthly.value = '45';
      if (annual) annual.value = '360';
    }
  }

  function saveAgreementFromPanel() {
    const system = document.getElementById('agreement-system')?.value || 'standard';
    const agreement = {
      workingTimeSystem: system,
      agreementStartMonth: clamp(document.getElementById('agreement-start-month')?.value, 1, 12, 1),
      ordinaryMonthlyLimitHours: clamp(document.getElementById('agreement-monthly')?.value, 1, system === 'annual_variable' ? 42 : 45, system === 'annual_variable' ? 42 : 45),
      ordinaryAnnualLimitHours: clamp(document.getElementById('agreement-annual')?.value, 1, system === 'annual_variable' ? 320 : 360, system === 'annual_variable' ? 320 : 360),
      specialClauseEnabled: Boolean(document.getElementById('agreement-special-enabled')?.checked),
      specialMonthlyLimitHours: clamp(document.getElementById('agreement-special-monthly')?.value, 1, 99, 60),
      specialAnnualLimitHours: clamp(document.getElementById('agreement-special-annual')?.value, 1, 720, 720),
      overOrdinaryMonthsMax: clamp(document.getElementById('agreement-over-months')?.value, 0, 6, 6),
      singleMonthWithHolidayLimitHours: 100,
      multiMonthAverageLimitHours: 80,
      updatedAt: new Date().toISOString(),
      updatedBy: actorName(),
      note: state.agreement.note || '',
    };
    if (agreement.specialMonthlyLimitHours <= agreement.ordinaryMonthlyLimitHours && agreement.specialClauseEnabled) {
      window.alert('特別条項の月上限は通常の月上限より大きく設定してください。');
      return;
    }
    state.agreement = normalizeAgreement(agreement);
    localStorage.setItem(AGREEMENT_KEY, JSON.stringify(state.agreement));
    saveCloud(CLOUD_AGREEMENT, state.agreement);
    notify('36協定設定を保存しました');
    renderAll(true);
  }

  function openForStaff(staffId, month) {
    state.selectedStaffId = String(staffId || '').toUpperCase();
    const person = fullTimeStaff().find(item => String(item.id || '').toUpperCase() === state.selectedStaffId);
    if (!person) return;
    const targetMonth = month || state.month || currentMonth();
    const modal = document.getElementById('overtime-exception-modal');
    document.getElementById('overtime-modal-person').textContent = `${person.name || person.id} ・ ${person.workPlanId ? person.workPlanId + 'プラン' : 'プラン未設定'}`;
    document.getElementById('overtime-request-month').value = targetMonth;
    const assessment = assessMonth(person.id, targetMonth);
    const recommended = Math.max(internalCapHours() + 1, Math.ceil(assessment.minutes / 60));
    document.getElementById('overtime-request-limit').value = Math.min(recommended, agreementHardMonthlyHours());
    const existing = latestApproval(person.id, targetMonth);
    document.getElementById('overtime-next-target').value = existing?.nextMonthTargetHours ?? 10;
    document.getElementById('overtime-request-reason').value = existing?.reason || '';
    document.getElementById('overtime-board-note').value = existing?.boardNote || '';
    modal?.classList.add('open');
    renderModalAssessment();
  }

  function closeModal() {
    document.getElementById('overtime-exception-modal')?.classList.remove('open');
  }

  function renderModalAssessment() {
    if (!state.selectedStaffId) return;
    const person = fullTimeStaff().find(item => String(item.id || '').toUpperCase() === state.selectedStaffId);
    const month = document.getElementById('overtime-request-month')?.value || state.month || currentMonth();
    const requested = Number(document.getElementById('overtime-request-limit')?.value || 0);
    const assessment = assessMonth(state.selectedStaffId, month);
    const node = document.getElementById('overtime-modal-assessment');
    const history = document.getElementById('overtime-history-list');
    if (!node || !history || !person) return;
    const specialNeeded = requested > Number(state.agreement.ordinaryMonthlyLimitHours);
    const hardMax = agreementHardMonthlyHours();
    node.innerHTML = `
      <div><small>現在の予定時間外</small><strong>${formatHours(assessment.minutes)}h</strong></div>
      <div><small>OKK通常ライン</small><strong>${internalCapHours()}h</strong></div>
      <div><small>36協定 通常上限</small><strong>${state.agreement.ordinaryMonthlyLimitHours}h</strong></div>
      <div class="${requested > hardMax ? 'danger' : ''}"><small>申請上限</small><strong>${requested || 0}h</strong></div>
      ${specialNeeded ? `<p class="wide ${state.agreement.specialClauseEnabled ? 'warn' : 'danger'}">${state.agreement.specialClauseEnabled ? '通常上限を超えるため、特別条項の対象として扱います。具体的・臨時的な理由を記録してください。' : '通常の36協定上限を超える申請です。特別条項が未設定のため承認できません。'}</p>` : ''}
    `;
    const historyRows = approvalHistory(person.id, month);
    history.innerHTML = historyRows.length ? `<h3>承認履歴</h3>${historyRows.map(item => approvalCard(item)).join('')}` : '<div class="overtime-no-history">この月の申請履歴はありません。</div>';
    const approve = document.getElementById('overtime-approve');
    const reject = document.getElementById('overtime-reject');
    const pending = historyRows.find(item => item.status === 'pending');
    const canAdmin = Boolean(window.shiftV2IsAdmin);
    if (approve) {
      approve.disabled = !pending || !canAdmin || Number(pending.requestedLimitHours) > hardMax || (Number(pending.requestedLimitHours) > Number(state.agreement.ordinaryMonthlyLimitHours) && !state.agreement.specialClauseEnabled);
      approve.title = canAdmin ? '' : '管理者ログインが必要です';
    }
    if (reject) reject.disabled = !pending || !canAdmin;
  }

  function approvalCard(item) {
    const className = item.status || 'pending';
    const decision = item.status === 'approved'
      ? `承認 ${formatDateTime(item.decidedAt)} / ${esc(item.decidedBy || '')}`
      : item.status === 'rejected'
        ? `却下 ${formatDateTime(item.decidedAt)} / ${esc(item.decidedBy || '')}`
        : `申請 ${formatDateTime(item.requestedAt)} / ${esc(item.requestedBy || '')}`;
    return `<div class="overtime-history-card ${className}"><div><strong>${esc(statusJa(item.status))} 上限${item.requestedLimitHours}h</strong><span>翌月目標 ${item.nextMonthTargetHours}h以下</span></div><p>${esc(item.reason || '理由未入力')}</p>${item.boardNote ? `<small>役員会メモ：${esc(item.boardNote)}</small>` : ''}<small>${decision}</small></div>`;
  }

  function saveRequest() {
    const person = fullTimeStaff().find(item => String(item.id || '').toUpperCase() === state.selectedStaffId);
    if (!person) return;
    const month = document.getElementById('overtime-request-month')?.value;
    const requestedLimitHours = Number(document.getElementById('overtime-request-limit')?.value || 0);
    const nextMonthTargetHours = Number(document.getElementById('overtime-next-target')?.value || 10);
    const reason = document.getElementById('overtime-request-reason')?.value?.trim() || '';
    const boardNote = document.getElementById('overtime-board-note')?.value?.trim() || '';
    if (!month || requestedLimitHours <= internalCapHours()) {
      window.alert(`${internalCapHours()}時間を超える例外上限を入力してください。`);
      return;
    }
    if (!reason) {
      window.alert('例外理由を入力してください。');
      return;
    }
    if (requestedLimitHours > agreementHardMonthlyHours()) {
      window.alert(`現在の36協定設定では ${agreementHardMonthlyHours()}時間を超える申請は保存できません。`);
      return;
    }
    if (requestedLimitHours > Number(state.agreement.ordinaryMonthlyLimitHours) && !state.agreement.specialClauseEnabled) {
      window.alert('通常の36協定上限を超えています。特別条項が設定されていないため申請できません。');
      return;
    }
    state.approvals = state.approvals.map(item => item.staffId === person.id && item.month === month && item.status === 'pending' ? { ...item, status: 'superseded' } : item);
    state.approvals.push({
      id: uid('ot'),
      staffId: person.id,
      month,
      requestedLimitHours,
      nextMonthTargetHours: clamp(nextMonthTargetHours, 0, 30, 10),
      reason,
      boardNote,
      status: 'pending',
      specialClause: requestedLimitHours > Number(state.agreement.ordinaryMonthlyLimitHours),
      requestedAt: new Date().toISOString(),
      requestedBy: actorName(),
      decidedAt: '',
      decidedBy: '',
    });
    persistApprovals();
    notify('30時間超の例外申請を保存しました');
    renderAll(true);
    renderModalAssessment();
  }

  function approveLatest() {
    if (!window.shiftV2IsAdmin) {
      window.alert('役員会承認の記録は管理者ログインが必要です。');
      return;
    }
    const month = document.getElementById('overtime-request-month')?.value;
    const pending = state.approvals.find(item => item.staffId === state.selectedStaffId && item.month === month && item.status === 'pending');
    if (!pending) return;
    const check = validateApproval(pending);
    if (!check.ok) {
      window.alert(check.message);
      return;
    }
    pending.status = 'approved';
    pending.decidedAt = new Date().toISOString();
    pending.decidedBy = actorName();
    pending.boardNote = document.getElementById('overtime-board-note')?.value?.trim() || pending.boardNote || '';
    persistApprovals();
    notify('役員会承認として記録しました');
    renderAll(true);
    renderModalAssessment();
  }

  function rejectLatest() {
    if (!window.shiftV2IsAdmin) {
      window.alert('却下の記録は管理者ログインが必要です。');
      return;
    }
    const month = document.getElementById('overtime-request-month')?.value;
    const pending = state.approvals.find(item => item.staffId === state.selectedStaffId && item.month === month && item.status === 'pending');
    if (!pending) return;
    pending.status = 'rejected';
    pending.decidedAt = new Date().toISOString();
    pending.decidedBy = actorName();
    pending.boardNote = document.getElementById('overtime-board-note')?.value?.trim() || pending.boardNote || '';
    persistApprovals();
    notify('例外申請を却下として記録しました');
    renderAll(true);
    renderModalAssessment();
  }

  function validateApproval(approval) {
    const requested = Number(approval.requestedLimitHours || 0);
    if (requested > agreementHardMonthlyHours()) return { ok: false, message: '36協定設定の月上限を超えています。' };
    if (requested > Number(state.agreement.ordinaryMonthlyLimitHours) && !state.agreement.specialClauseEnabled) return { ok: false, message: '特別条項が未設定です。' };
    if (approval.specialClause) {
      const period = agreementPeriodForMonth(approval.month);
      const specialMonths = monthsInPeriod(period).filter(month => month !== approval.month && monthHasApprovedSpecial(month)).length;
      if (specialMonths + 1 > Number(state.agreement.overOrdinaryMonthsMax)) return { ok: false, message: `通常上限を超えられる月数 ${state.agreement.overOrdinaryMonthsMax}回/年 を超えます。` };
    }
    return { ok: true };
  }

  function assessMonth(staffId, month) {
    const minutes = plannedOvertimeForMonth(staffId, month);
    const approval = activeApproval(staffId, month) || pendingApproval(staffId, month);
    const internal = internalCapMinutes();
    const ordinary = Number(state.agreement.ordinaryMonthlyLimitHours) * 60;
    const hard = agreementHardMonthlyHours() * 60;
    const annual = plannedOvertimeForAgreementPeriod(staffId, month);
    const annualOrdinary = Number(state.agreement.ordinaryAnnualLimitHours) * 60;
    const annualHard = Number(state.agreement.specialClauseEnabled ? state.agreement.specialAnnualLimitHours : state.agreement.ordinaryAnnualLimitHours) * 60;
    const multiAverage = maxRollingAverage(staffId, month, 6);
    let hardReason = '';

    if (minutes >= Number(state.agreement.singleMonthWithHolidayLimitHours) * 60) hardReason = '単月100h未満規制に抵触';
    else if (multiAverage >= Number(state.agreement.multiMonthAverageLimitHours) * 60) hardReason = '2〜6か月平均80h上限に抵触';
    else if (minutes > hard) hardReason = `36協定 月上限${agreementHardMonthlyHours()}h超`;
    else if (annual > annualHard) hardReason = `36協定 年上限${Math.round(annualHard / 60)}h超`;
    else if (!state.agreement.specialClauseEnabled && annual > annualOrdinary) hardReason = `36協定 年通常上限${state.agreement.ordinaryAnnualLimitHours}h超`;
    else if (minutes > ordinary && !state.agreement.specialClauseEnabled) hardReason = `36協定 通常月上限${state.agreement.ordinaryMonthlyLimitHours}h超`;
    else if (minutes > ordinary && state.agreement.specialClauseEnabled && approvedSpecialMonthCount(staffId, month) >= Number(state.agreement.overOrdinaryMonthsMax) && !activeApproval(staffId, month)?.specialClause) hardReason = `通常上限超の月数上限${state.agreement.overOrdinaryMonthsMax}回/年`;

    if (hardReason) return { status: 'hard', minutes, approval, hardReason, annualMinutes: annual };
    if (minutes <= INTERNAL_WARN) return { status: 'ok', minutes, approval, hardReason: '', annualMinutes: annual };
    if (minutes <= internal) return { status: 'watch', minutes, approval, hardReason: '', annualMinutes: annual };
    const approved = activeApproval(staffId, month);
    if (approved && minutes <= Number(approved.requestedLimitHours) * 60) return { status: 'approved', minutes, approval: approved, hardReason: '', annualMinutes: annual };
    if (approval?.status === 'pending') return { status: 'pending', minutes, approval, hardReason: '', annualMinutes: annual };
    return { status: 'unapproved', minutes, approval, hardReason: '', annualMinutes: annual };
  }

  function confirmationBlocks(month) {
    return fullTimeStaff().map(person => {
      const assessment = assessMonth(person.id, month);
      if (!['unapproved', 'pending', 'hard'].includes(assessment.status)) return null;
      return {
        staffId: person.id,
        name: person.name || person.id,
        minutes: assessment.minutes,
        reason: assessment.status === 'hard' ? assessment.hardReason : assessment.status === 'pending' ? '30h超の申請が未承認' : '30h超の役員会承認なし',
      };
    }).filter(Boolean);
  }

  function plannedOvertimeForMonth(staffId, month) {
    const start = `${month}-01`;
    const end = lastDateOfMonth(month);
    return plannedOvertimeForRange(staffId, start, end);
  }

  function plannedOvertimeForAgreementPeriod(staffId, month) {
    const period = agreementPeriodForMonth(month);
    return plannedOvertimeForRange(staffId, period.start, period.end);
  }

  function plannedOvertimeForRange(staffId, start, end) {
    const shifts = loadJson(SHIFTS_KEY, {});
    const days = dailyWorkMap(shifts, staffId);
    const first = mondayOf(start);
    const last = sundayOf(end);
    let cursor = new Date(`${first}T00:00:00`);
    const lastDate = new Date(`${last}T00:00:00`);
    let total = 0;
    let weekRegular = 0;

    while (cursor <= lastDate) {
      const date = dateKey(cursor);
      if (cursor.getDay() === 1) weekRegular = 0;
      const work = Number(days[date] || 0);
      const dailyRegular = Math.min(work, DAILY_LIMIT);
      const dailyOver = Math.max(0, work - DAILY_LIMIT);
      const weeklyRoom = Math.max(0, WEEKLY_LIMIT - weekRegular);
      const weeklyOverFromRegular = Math.max(0, dailyRegular - weeklyRoom);
      const regularCounted = dailyRegular - weeklyOverFromRegular;
      weekRegular += regularCounted;
      const dayOvertime = dailyOver + weeklyOverFromRegular;
      if (date >= start && date <= end) total += dayOvertime;
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  }

  function dailyWorkMap(shifts, staffId) {
    const id = String(staffId || '').toUpperCase();
    const map = {};
    Object.entries(shifts || {}).forEach(([date, rows]) => {
      if (!Array.isArray(rows)) return;
      rows.forEach(shift => {
        if (String(shift.staffId || '').toUpperCase() !== id) return;
        map[date] = (map[date] || 0) + plannedWorkMinutes(shift);
      });
    });
    return map;
  }

  function plannedWorkMinutes(shift) {
    const binding = Math.max(0, Number(shift.end) - Number(shift.start));
    const breakMinutes = binding >= 9 * 60 ? 60 : binding >= 6 * 60 + 45 ? 45 : 0;
    return Math.max(0, binding - breakMinutes);
  }

  function maxRollingAverage(staffId, month, maxWindow) {
    const target = parseMonth(month);
    let max = 0;
    for (let windowSize = 2; windowSize <= maxWindow; windowSize += 1) {
      for (let back = 0; back < windowSize; back += 1) {
        const start = addMonths(target, -back);
        const months = Array.from({ length: windowSize }, (_, index) => monthKey(addMonths(start, index)));
        if (!months.includes(month)) continue;
        const sum = months.reduce((acc, key) => acc + plannedOvertimeForMonth(staffId, key), 0);
        max = Math.max(max, sum / windowSize);
      }
    }
    return max;
  }

  function approvedSpecialMonthCount(staffId, month) {
    const period = agreementPeriodForMonth(month);
    return monthsInPeriod(period).filter(key => {
      const approval = activeApproval(staffId, key);
      return approval?.specialClause;
    }).length;
  }

  function monthHasApprovedSpecial(month) {
    return state.approvals.some(item => item.month === month && item.status === 'approved' && item.specialClause);
  }

  function companyAnnualSummary(period) {
    const staff = fullTimeStaff();
    let hardCount = 0;
    staff.forEach(person => {
      monthsInPeriod(period).forEach(month => {
        if (assessMonth(person.id, month).status === 'hard') hardCount += 1;
      });
    });
    return { hard: hardCount > 0, hardCount };
  }

  function agreementPeriodForMonth(month) {
    const [year, monthNo] = month.split('-').map(Number);
    const startMonth = Number(state.agreement.agreementStartMonth || 1);
    const startYear = monthNo >= startMonth ? year : year - 1;
    const start = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
    const endMonthDate = new Date(startYear + 1, startMonth - 1, 0);
    const end = dateKey(endMonthDate);
    return { start, end };
  }

  function monthsInPeriod(period) {
    const result = [];
    let cursor = parseMonth(period.start.slice(0, 7));
    const end = parseMonth(period.end.slice(0, 7));
    while (cursor <= end) {
      result.push(monthKey(cursor));
      cursor = addMonths(cursor, 1);
    }
    return result;
  }

  function activeApproval(staffId, month) {
    return approvalHistory(staffId, month).find(item => item.status === 'approved') || null;
  }

  function pendingApproval(staffId, month) {
    return approvalHistory(staffId, month).find(item => item.status === 'pending') || null;
  }

  function latestApproval(staffId, month) {
    return approvalHistory(staffId, month)[0] || null;
  }

  function approvalHistory(staffId, month) {
    const id = String(staffId || '').toUpperCase();
    return state.approvals
      .filter(item => String(item.staffId || '').toUpperCase() === id && item.month === month)
      .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));
  }

  function persistApprovals() {
    localStorage.setItem(APPROVAL_KEY, JSON.stringify(state.approvals));
    saveCloud(CLOUD_APPROVALS, state.approvals);
  }

  async function hydrateCloud() {
    if (!window.shiftV2Cloud || !window.shiftV2User || state.cloudBusy) return;
    state.cloudBusy = true;
    try {
      const [agreement, approvals] = await Promise.all([
        window.shiftV2Cloud.get(CLOUD_AGREEMENT),
        window.shiftV2Cloud.get(CLOUD_APPROVALS),
      ]);
      if (agreement && typeof agreement === 'object') {
        state.agreement = normalizeAgreement(agreement);
        localStorage.setItem(AGREEMENT_KEY, JSON.stringify(state.agreement));
      } else {
        await window.shiftV2Cloud.set(CLOUD_AGREEMENT, state.agreement);
      }
      if (Array.isArray(approvals)) {
        state.approvals = normalizeApprovals(approvals);
        localStorage.setItem(APPROVAL_KEY, JSON.stringify(state.approvals));
      } else {
        await window.shiftV2Cloud.set(CLOUD_APPROVALS, state.approvals);
      }
      renderAll(true);
    } catch (error) {
      console.warn('Overtime governance cloud hydration failed', error);
    } finally {
      state.cloudBusy = false;
    }
  }

  function saveCloud(key, value) {
    if (!window.shiftV2Cloud || !window.shiftV2User) return;
    window.shiftV2Cloud.set(key, value).catch(error => console.warn('Overtime governance cloud save failed', error));
  }

  function normalizeAgreement(value) {
    const source = value && typeof value === 'object' ? value : DEFAULT_AGREEMENT;
    const system = source.workingTimeSystem === 'annual_variable' ? 'annual_variable' : 'standard';
    const monthlyMax = system === 'annual_variable' ? 42 : 45;
    const annualMax = system === 'annual_variable' ? 320 : 360;
    return {
      workingTimeSystem: system,
      agreementStartMonth: clamp(source.agreementStartMonth, 1, 12, 1),
      ordinaryMonthlyLimitHours: clamp(source.ordinaryMonthlyLimitHours, 1, monthlyMax, monthlyMax),
      ordinaryAnnualLimitHours: clamp(source.ordinaryAnnualLimitHours, 1, annualMax, annualMax),
      specialClauseEnabled: Boolean(source.specialClauseEnabled),
      specialMonthlyLimitHours: clamp(source.specialMonthlyLimitHours, 1, 99, 60),
      specialAnnualLimitHours: clamp(source.specialAnnualLimitHours, 1, 720, 720),
      overOrdinaryMonthsMax: clamp(source.overOrdinaryMonthsMax, 0, 6, 6),
      singleMonthWithHolidayLimitHours: 100,
      multiMonthAverageLimitHours: 80,
      updatedAt: source.updatedAt || '',
      updatedBy: source.updatedBy || '',
      note: source.note || '',
    };
  }

  function normalizeApprovals(value) {
    if (!Array.isArray(value)) return [];
    return value.map(item => ({
      ...item,
      id: item.id || uid('ot'),
      staffId: String(item.staffId || '').toUpperCase(),
      month: item.month || '',
      requestedLimitHours: Number(item.requestedLimitHours || 0),
      nextMonthTargetHours: Number(item.nextMonthTargetHours ?? 10),
      status: ['pending', 'approved', 'rejected', 'superseded', 'revoked'].includes(item.status) ? item.status : 'pending',
      specialClause: Boolean(item.specialClause),
    })).filter(item => item.staffId && /^\d{4}-\d{2}$/.test(item.month));
  }

  function fullTimeStaff() {
    const staff = loadJson(STAFF_KEY, []);
    return (Array.isArray(staff) ? staff : []).filter(person => person.active !== false && person.employmentType === '正社員');
  }

  function internalCapHours() {
    const plans = loadJson(PLAN_KEY, {});
    const value = Number(plans?.common?.operationalOvertimeCapHours ?? 30);
    return Number.isFinite(value) ? Math.max(1, value) : 30;
  }

  function internalCapMinutes() { return internalCapHours() * 60; }
  function agreementHardMonthlyHours() { return Number(state.agreement.specialClauseEnabled ? state.agreement.specialMonthlyLimitHours : state.agreement.ordinaryMonthlyLimitHours); }

  function dataSignature() {
    return [
      localStorage.getItem(STAFF_KEY) || '',
      localStorage.getItem(SHIFTS_KEY) || '',
      localStorage.getItem(PLAN_KEY) || '',
      localStorage.getItem(AGREEMENT_KEY) || '',
      localStorage.getItem(APPROVAL_KEY) || '',
      document.getElementById('work-date')?.value || '',
      Boolean(window.shiftV2IsAdmin),
    ].join('|');
  }

  function exposeApi() {
    window.shiftV2Overtime = {
      assessMonth: (staffId, month) => assessMonth(String(staffId || '').toUpperCase(), month),
      plannedOvertimeMinutes: (staffId, month) => plannedOvertimeForMonth(String(staffId || '').toUpperCase(), month),
      getInternalCapHours: internalCapHours,
      getAgreement: () => ({ ...state.agreement }),
      canConfirmMonth: month => ({ ok: confirmationBlocks(month).length === 0, blocks: confirmationBlocks(month) }),
    };
  }

  function monthOptions(selected) {
    return Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${Number(selected) === index + 1 ? 'selected' : ''}>${index + 1}月</option>`).join('');
  }

  function currentMonth() {
    const date = document.getElementById('work-date')?.value;
    if (date) return date.slice(0, 7);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function lastDateOfMonth(month) {
    const [year, monthNo] = month.split('-').map(Number);
    return dateKey(new Date(year, monthNo, 0));
  }

  function mondayOf(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return dateKey(date);
  }

  function sundayOf(dateString) {
    const date = new Date(`${mondayOf(dateString)}T00:00:00`);
    date.setDate(date.getDate() + 6);
    return dateKey(date);
  }

  function parseMonth(month) {
    const [year, monthNo] = month.split('-').map(Number);
    return new Date(year, monthNo - 1, 1);
  }

  function addMonths(date, count) {
    return new Date(date.getFullYear(), date.getMonth() + count, 1);
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function clamp(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function formatHours(minutes) {
    const value = Math.max(0, Number(minutes) || 0) / 60;
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function formatMinutes(minutes) {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(value / 60);
    const remain = value % 60;
    return remain ? `${hours}時間${remain}分` : `${hours}時間`;
  }

  function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function statusJa(status) {
    return { pending: '申請中', approved: '承認済', rejected: '却下', superseded: '差替', revoked: '取消' }[status] || status;
  }

  function actorName() {
    const user = window.shiftV2User;
    return user?.displayName || user?.email || 'ローカル利用者';
  }

  function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
  function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? clone(fallback); } catch { return clone(fallback); } }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[char])); }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function injectStyles() {
    if (document.getElementById('shift-v2-overtime-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-overtime-style';
    style.textContent = `
      .overtime-governance-bar{margin:8px 0;padding:9px 11px;border-left:4px solid #12b76a}.overtime-governance-bar.watch{border-left-color:#f79009;background:#fffcf5}.overtime-governance-bar.danger{border-left-color:#f04438;background:#fffbfa}.overtime-governance-bar.approved{border-left-color:#7f56d9;background:#fbfaff}.overtime-bar-main{display:flex;align-items:center;justify-content:space-between;gap:8px}.overtime-bar-main>div:first-child strong{font-size:10px;color:#344054}.overtime-bar-main>div:first-child span{font-size:8px;color:#667085;margin-left:8px}.overtime-bar-actions{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}.overtime-chip{border:0;border-radius:999px;padding:4px 7px;font-size:7px;font-weight:900;cursor:pointer;background:#f2f4f7;color:#344054}.overtime-chip.watch{background:#fef0c7;color:#b54708}.overtime-chip.unapproved,.overtime-chip.hard{background:#fee4e2;color:#b42318}.overtime-chip.approved{background:#f4ebff;color:#6941c6}.overtime-chip.pending{background:#fffaeb;color:#b54708}.overtime-bar-note{font-size:7px;color:#667085;margin-top:5px;line-height:1.5}
      .overtime-master-panel{margin:0 0 10px;padding:0;overflow:hidden}.overtime-master-head{display:flex;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #eaecf0}.overtime-master-head h2{font-size:12px;margin:0;color:#344054}.overtime-master-head p{font-size:8px;color:#667085;margin:3px 0 0}.overtime-master-month label{font-size:8px;font-weight:900;color:#475467}.agreement-settings{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:10px 12px;background:#fcfcfd}.agreement-settings label{font-size:8px;font-weight:800;color:#475467;display:flex;align-items:center;gap:4px}.agreement-settings .control{min-width:0;width:100%}.agreement-settings input[type=number]{max-width:68px}.agreement-check{padding:0 5px}.agreement-check input{width:auto!important}.agreement-note,.overtime-legal-note{font-size:7px;color:#667085;line-height:1.6;padding:7px 12px;background:#f8fafc;border-top:1px solid #eaecf0}.overtime-summary-strip{display:flex;gap:10px;flex-wrap:wrap;padding:8px 12px;border-top:1px solid #eaecf0;border-bottom:1px solid #eaecf0;font-size:8px;font-weight:900;color:#475467}.overtime-summary-strip .danger{color:#b42318}.overtime-table-wrap{overflow:auto;max-height:340px}.overtime-table{width:100%;border-collapse:collapse;font-size:8px}.overtime-table th{position:sticky;top:0;background:#f8fafc;padding:7px;border-bottom:1px solid #e4e7ec;color:#475467}.overtime-table td{padding:7px;border-bottom:1px solid #f2f4f7;text-align:center}.overtime-table td:first-child{text-align:left}.overtime-table td:first-child strong{display:block;font-size:9px}.overtime-table td:first-child small{display:block;color:#98a2b3}.overtime-table tr.status-hard,.overtime-table tr.status-unapproved{background:#fffafa}.overtime-table tr.status-approved{background:#fcfaff}.overtime-status{font-weight:900;padding:3px 5px;border-radius:999px;background:#f2f4f7}.overtime-status.watch,.overtime-status.pending{background:#fef0c7;color:#b54708}.overtime-status.unapproved,.overtime-status.hard{background:#fee4e2;color:#b42318}.overtime-status.approved{background:#f4ebff;color:#6941c6}.overtime-empty{padding:20px!important;color:#98a2b3}
      .overtime-modal-bg{display:none;position:fixed;inset:0;z-index:1900;background:rgba(16,24,40,.65);align-items:center;justify-content:center;padding:20px}.overtime-modal-bg.open{display:flex}.overtime-modal{width:min(760px,96vw);max-height:92vh;background:#fff;border-radius:14px;box-shadow:0 24px 70px rgba(16,24,40,.3);display:flex;flex-direction:column;overflow:hidden}.overtime-modal-head{display:flex;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e4e7ec}.overtime-modal-head span{font-size:7px;font-weight:900;letter-spacing:.12em;color:#667085}.overtime-modal-head h2{font-size:16px;margin:1px 0}.overtime-modal-head p{font-size:8px;color:#667085;margin:0}.overtime-modal-body{padding:12px 16px;overflow:auto}.overtime-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.overtime-form-grid label{font-size:8px;font-weight:900;color:#475467;display:flex;align-items:center;gap:5px;flex-wrap:wrap}.overtime-form-grid label.wide{grid-column:1/4;display:block}.overtime-form-grid textarea{width:100%;margin-top:4px;resize:vertical}.overtime-form-grid input{min-width:90px}.overtime-modal-assessment{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.overtime-modal-assessment>div{border:1px solid #e4e7ec;border-radius:8px;padding:8px}.overtime-modal-assessment small{display:block;font-size:7px;color:#667085}.overtime-modal-assessment strong{font-size:15px}.overtime-modal-assessment .danger{background:#fef3f2;border-color:#fecdca;color:#b42318}.overtime-modal-assessment p.wide{grid-column:1/5;margin:0;padding:7px;border-radius:7px;font-size:8px}.overtime-modal-assessment p.warn{background:#fffaeb;color:#b54708}.overtime-modal-assessment p.danger{background:#fef3f2;color:#b42318}.overtime-history-list h3{font-size:9px;margin:10px 0 5px}.overtime-history-card{border:1px solid #e4e7ec;border-left:3px solid #f79009;border-radius:8px;padding:7px 8px;margin-bottom:5px}.overtime-history-card.approved{border-left-color:#12b76a}.overtime-history-card.rejected{border-left-color:#f04438}.overtime-history-card>div{display:flex;justify-content:space-between;gap:8px}.overtime-history-card strong{font-size:8px}.overtime-history-card span,.overtime-history-card small{display:block;font-size:7px;color:#667085}.overtime-history-card p{font-size:8px;margin:4px 0;color:#344054}.overtime-no-history{padding:10px;background:#f8fafc;border-radius:8px;font-size:8px;color:#667085}.overtime-modal-foot{display:flex;justify-content:space-between;gap:8px;padding:10px 16px;border-top:1px solid #e4e7ec}.overtime-modal-foot>div{display:flex;gap:6px}.overtime-danger{background:#fff;color:#b42318;border-color:#fecdca}@media(max-width:900px){.agreement-settings{grid-template-columns:1fr 1fr}.overtime-bar-main{align-items:flex-start;flex-direction:column}.overtime-form-grid{grid-template-columns:1fr}.overtime-form-grid label.wide{grid-column:1}.overtime-modal-assessment{grid-template-columns:1fr 1fr}.overtime-modal-assessment p.wide{grid-column:1/3}}
    `;
    document.head.appendChild(style);
  }
})();