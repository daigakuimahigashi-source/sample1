(() => {
  'use strict';

  const STORAGE_SHIFTS = 'okk_shift_v2_shifts';
  const STORAGE_STAFF = 'okk_shift_v2_staff';
  const STORAGE_AUDIT = 'okk_shift_v2_audit_v1';
  const CLOUD_KEY = 'shiftV2Audit';
  const MAX_EVENTS = 2000;
  const SHIFT_FIELDS = ['staffId', 'startStoreId', 'start', 'end', 'memo'];

  const ATTENDANCE_LABELS = {
    '': '予定どおり',
    absence: '確定後欠勤',
    no_show: '連絡なし欠勤',
    paid_leave: '年休',
    company_leave: '会社都合休業',
  };

  const refs = {};
  let audit = loadAudit();
  let observer = null;
  let refreshQueued = false;
  let lastShiftState = clone(loadJson(STORAGE_SHIFTS, {}));
  let detectionEnabledAt = Date.now() + 3500;
  let cloudListenerAttached = false;
  let cloudSaveTimer = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    refs.planner = document.getElementById('view-planner');
    refs.workDate = document.getElementById('work-date');
    refs.staffMonth = document.getElementById('staff-month');
    refs.gantt = document.getElementById('gantt-canvas');
    refs.inspector = document.getElementById('inspector');
    refs.csvView = document.getElementById('view-csv');
    refs.csvStart = document.getElementById('csv-start');
    refs.csvEnd = document.getElementById('csv-end');
    refs.workspace = document.querySelector('.workspace');

    ensureAuditBar();
    ensureHistoryModal();
    bindEvents();
    startObserver();
    scheduleRefresh();
    // Same-tab localStorage changes are delivered by the runtime guard. Keep a
    // slow fallback for old cached guard builds instead of polling every 700ms.
    setInterval(detectShiftChanges, 10000);
    setTimeout(() => hydrateCloudAudit(), 700);
  }

  function bindEvents() {
    refs.workDate?.addEventListener('change', () => setTimeout(scheduleRefresh, 0));
    refs.staffMonth?.addEventListener('change', () => setTimeout(scheduleRefresh, 0));
    refs.csvStart?.addEventListener('change', scheduleRefresh);
    refs.csvEnd?.addEventListener('change', scheduleRefresh);
    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => setTimeout(scheduleRefresh, 0)));
    document.addEventListener('pointerup', () => setTimeout(scheduleRefresh, 25));
    document.addEventListener('drop', () => setTimeout(scheduleRefresh, 25));
    document.addEventListener('shiftv2-auth', () => setTimeout(hydrateCloudAudit, 250));
    document.addEventListener('shiftv2-storage', event => {
      const keys = event.detail?.keys || [];
      if (keys.includes(STORAGE_SHIFTS) || keys.includes('*')) detectShiftChanges();
    });
    window.addEventListener('storage', event => {
      if (event.key === STORAGE_AUDIT) {
        audit = loadAudit();
        scheduleRefresh();
      }
      if (event.key === STORAGE_SHIFTS || event.key === null) detectShiftChanges();
    });

    document.addEventListener('click', event => {
      const deleteButton = event.target.closest?.('#delete-shift');
      if (!deleteButton) return;
      const date = currentDate();
      const shiftId = selectedShiftId();
      if (!date || !shiftId || !isOriginalConfirmed(date, shiftId)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.alert('確定済みシフトは証跡保全のため削除できません。右側の「実績ステータス」で欠勤・年休などを記録してください。');
    }, true);
  }

  function startObserver() {
    if (!refs.workspace || observer) return;
    observer = new MutationObserver(scheduleRefresh);
    observer.observe(refs.workspace, { childList: true, subtree: true });
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      observer?.disconnect();
      try {
        ensureAuditBar();
        renderAuditBar();
        decorateGantt();
        decorateInspector();
        decorateCsv();
      } finally {
        if (observer && refs.workspace) observer.observe(refs.workspace, { childList: true, subtree: true });
      }
    });
  }

  function ensureAuditBar() {
    if (!refs.planner) return;
    let bar = document.getElementById('shift-audit-bar');
    if (!bar) {
      bar = document.createElement('section');
      bar.id = 'shift-audit-bar';
      bar.className = 'card audit-bar';
      const labor = document.getElementById('labor-alert-banner');
      const toolbar = refs.planner.querySelector('.toolbar');
      if (labor) labor.insertAdjacentElement('afterend', bar);
      else toolbar?.insertAdjacentElement('afterend', bar);
    }
    refs.auditBar = bar;
  }

  function renderAuditBar() {
    if (!refs.auditBar) return;
    const date = currentDate();
    if (!date) return;
    const status = audit.dayStatus[date];
    const dateFlags = audit.flags[date] || {};
    const values = Object.values(dateFlags);
    const additions = values.filter(item => item.postAddition).length;
    const changes = values.filter(item => item.changedAfterConfirm).length;
    const absences = values.filter(item => ['absence', 'no_show', 'paid_leave', 'company_leave'].includes(item.attendanceStatus)).length;
    const confirmedText = status?.confirmed
      ? `確定済 v${status.version} ・ ${formatDateTime(status.confirmedAt)}`
      : '未確定';
    const month = date.slice(0, 7);

    refs.auditBar.innerHTML = `
      <div class="audit-bar-main">
        <div>
          <div class="audit-title"><i class="fa-solid fa-shield-halved"></i> シフト確定・証跡</div>
          <div class="audit-status-line">
            <span class="audit-status ${status?.confirmed ? 'confirmed' : 'draft'}">${esc(confirmedText)}</span>
            ${status?.confirmed ? `<span class="audit-counter add">臨時追加 ${additions}</span><span class="audit-counter change">確定後変更 ${changes}</span><span class="audit-counter absence">欠勤等 ${absences}</span>` : ''}
          </div>
          <div class="audit-note">確定後の追加・変更・欠勤は、確定時点のシフトを消さず履歴として保存します。</div>
        </div>
        <div class="audit-actions">
          <button id="audit-confirm-day" class="btn ${status?.confirmed ? 'btn-light' : 'btn-green'}"><i class="fa-solid fa-lock"></i>${status?.confirmed ? 'この日を再確定' : 'この日を確定'}</button>
          <button id="audit-confirm-month" class="btn btn-light"><i class="fa-solid fa-calendar-check"></i>${esc(month.replace('-', '年'))}月を確定</button>
          <button id="audit-history" class="btn btn-dark"><i class="fa-solid fa-clock-rotate-left"></i>変更履歴</button>
        </div>
      </div>
    `;

    document.getElementById('audit-confirm-day')?.addEventListener('click', () => confirmDay(date));
    document.getElementById('audit-confirm-month')?.addEventListener('click', () => confirmMonth(month));
    document.getElementById('audit-history')?.addEventListener('click', openHistory);
  }

  function confirmDay(date) {
    const shifts = shiftsForDate(date);
    if (!shifts.length) {
      notify('この日はシフトがありません');
      return;
    }
    const prior = audit.dayStatus[date];
    const label = prior?.confirmed ? '再確定' : '確定';
    if (!window.confirm(`${date} の ${shifts.length}件を${label}します。確定時点の内容は証跡として保存されます。`)) return;
    confirmDayInternal(date, true);
    saveAudit();
    scheduleRefresh();
    notify(`${date} を${label}しました`);
  }

  function confirmMonth(month) {
    const shifts = loadJson(STORAGE_SHIFTS, {});
    const dates = Object.keys(shifts)
      .filter(date => date.startsWith(month) && Array.isArray(shifts[date]) && shifts[date].length)
      .sort();
    if (!dates.length) {
      notify('この月には入力済みシフトがありません');
      return;
    }
    const total = dates.reduce((sum, date) => sum + shifts[date].length, 0);
    if (!window.confirm(`${month} の入力済みシフト ${total}件（${dates.length}日分）を確定します。`)) return;
    dates.forEach(date => confirmDayInternal(date, false));
    addEvent({ type: 'month_confirmed', date: `${month}-01`, note: `${dates.length}日・${total}件を月次確定` });
    saveAudit();
    scheduleRefresh();
    notify(`${month} の入力済みシフトを確定しました`);
  }

  function confirmDayInternal(date, addDayEvent) {
    const shifts = shiftsForDate(date);
    if (!shifts.length) return;
    const current = audit.dayStatus[date] || {};
    const version = Number(current.version || 0) + 1;
    const now = new Date().toISOString();
    const actor = actorName();
    const snapshots = audit.snapshots[date] || [];
    snapshots.push({ version, confirmedAt: now, confirmedBy: actor, shifts: clone(shifts) });
    audit.snapshots[date] = snapshots.slice(-20);
    audit.dayStatus[date] = { confirmed: true, version, confirmedAt: now, confirmedBy: actor };
    if (!audit.flags[date]) audit.flags[date] = {};
    shifts.forEach(shift => {
      const flag = getFlag(date, shift.id);
      flag.postAddition = false;
      flag.changedAfterConfirm = false;
      flag.confirmedVersion = version;
      setFlag(date, shift.id, flag);
    });
    if (addDayEvent) addEvent({ type: 'day_confirmed', date, note: `v${version}・${shifts.length}件` });
  }

  function decorateGantt() {
    if (!refs.gantt) return;
    const date = currentDate();
    if (!date) return;
    const status = audit.dayStatus[date];
    const flags = audit.flags[date] || {};

    refs.gantt.querySelectorAll('.shift-bar').forEach(bar => {
      const id = bar.dataset.shiftId;
      const flag = flags[id] || {};
      bar.classList.remove('audit-confirmed', 'audit-post-addition', 'audit-changed', 'audit-absence');
      bar.querySelector('.audit-shift-badge')?.remove();
      if (!status?.confirmed) return;

      let label = '';
      if (flag.attendanceStatus) {
        bar.classList.add('audit-absence');
        label = ATTENDANCE_LABELS[flag.attendanceStatus] || '実績変更';
      } else if (flag.postAddition) {
        bar.classList.add('audit-post-addition');
        label = '臨時追加';
      } else if (flag.changedAfterConfirm || isChangedFromLatestSnapshot(date, id)) {
        bar.classList.add('audit-changed');
        label = '確定後変更';
      } else if (isOriginalConfirmed(date, id)) {
        bar.classList.add('audit-confirmed');
        label = '確定';
      }

      if (label) {
        const badge = document.createElement('span');
        badge.className = 'audit-shift-badge';
        badge.textContent = label;
        bar.appendChild(badge);
      }
    });
  }

  function decorateInspector() {
    if (!refs.inspector) return;
    refs.inspector.querySelector('#audit-inspector-panel')?.remove();
    const date = currentDate();
    const id = selectedShiftId();
    if (!date || !id || !audit.dayStatus[date]?.confirmed) return;

    const currentShift = shiftById(date, id);
    if (!currentShift) return;
    const flag = getFlag(date, id);
    const snapshotShift = latestSnapshotShift(date, id);
    const panel = document.createElement('div');
    panel.id = 'audit-inspector-panel';
    panel.className = 'audit-inspector-panel';

    const origin = snapshotShift ? `${storeName(snapshotShift.startStoreId)} ${fmtTime(snapshotShift.start)}-${fmtTime(snapshotShift.end)}` : '確定後に追加された勤務';
    const current = `${storeName(currentShift.startStoreId)} ${fmtTime(currentShift.start)}-${fmtTime(currentShift.end)}`;

    panel.innerHTML = `
      <div class="audit-inspector-head"><i class="fa-solid fa-shield-halved"></i><strong>確定後の証跡</strong></div>
      <div class="audit-origin"><span>確定時点</span><strong>${esc(origin)}</strong></div>
      ${origin !== current && snapshotShift ? `<div class="audit-origin current"><span>現在</span><strong>${esc(current)}</strong></div>` : ''}
      <div class="audit-field"><label for="audit-attendance-status">実績ステータス</label><select id="audit-attendance-status" class="control">${Object.entries(ATTENDANCE_LABELS).map(([value, label]) => `<option value="${esc(value)}" ${flag.attendanceStatus === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div>
      <div class="audit-field"><label for="audit-reason">理由・メモ</label><input id="audit-reason" class="control" value="${esc(flag.attendanceReason || '')}" placeholder="体調不良、私用、本人連絡など"></div>
      <button id="audit-save-attendance" class="btn btn-light audit-full"><i class="fa-solid fa-floppy-disk"></i>実績ステータスを記録</button>
      <div class="audit-small">確定済みの元シフトは削除せず、この記録を追加します。</div>
    `;

    const deleteButton = refs.inspector.querySelector('#delete-shift');
    if (deleteButton) deleteButton.insertAdjacentElement('beforebegin', panel);
    else refs.inspector.appendChild(panel);

    document.getElementById('audit-save-attendance')?.addEventListener('click', () => {
      const nextStatus = document.getElementById('audit-attendance-status')?.value || '';
      const nextReason = document.getElementById('audit-reason')?.value.trim() || '';
      const before = { attendanceStatus: flag.attendanceStatus || '', attendanceReason: flag.attendanceReason || '' };
      flag.attendanceStatus = nextStatus;
      flag.attendanceReason = nextReason;
      flag.attendanceRecordedAt = new Date().toISOString();
      flag.attendanceRecordedBy = actorName();
      setFlag(date, id, flag);
      addEvent({ type: 'attendance_status', date, shiftId: id, staffId: currentShift.staffId, before, after: { attendanceStatus: nextStatus, attendanceReason: nextReason }, note: `${ATTENDANCE_LABELS[nextStatus] || '予定どおり'}${nextReason ? `・${nextReason}` : ''}` });
      saveAudit();
      scheduleRefresh();
      notify('実績ステータスを記録しました');
    });
  }

  function decorateCsv() {
    if (!refs.csvView) return;
    let notice = document.getElementById('audit-csv-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'audit-csv-notice';
      notice.className = 'audit-csv-notice';
      refs.csvView.querySelector('.csv-panel')?.prepend(notice);
    }
    if (!notice) return;

    const start = refs.csvStart?.value || '';
    const end = refs.csvEnd?.value || '';
    const flags = [];
    Object.entries(audit.flags).forEach(([date, dayFlags]) => {
      if ((start && date < start) || (end && date > end)) return;
      Object.values(dayFlags || {}).forEach(flag => flags.push(flag));
    });
    const additions = flags.filter(flag => flag.postAddition).length;
    const changes = flags.filter(flag => flag.changedAfterConfirm).length;
    const attendance = flags.filter(flag => flag.attendanceStatus).length;
    const hasEvidence = additions || changes || attendance;

    notice.className = `audit-csv-notice ${hasEvidence ? 'warn' : 'clear'}`;
    notice.innerHTML = hasEvidence
      ? `<strong><i class="fa-solid fa-shield-halved"></i> 確定後の変更あり</strong>　臨時追加 ${additions}件／確定後変更 ${changes}件／欠勤等 ${attendance}件<br><small>CSVは現在のシフト内容を出力します。確定時点の内容と変更履歴はV2側に別保存されています。</small>`
      : '<strong><i class="fa-solid fa-circle-check"></i> この出力期間に確定後変更の記録はありません。</strong>';
  }

  function detectShiftChanges() {
    const current = loadJson(STORAGE_SHIFTS, {});
    if (Date.now() < detectionEnabledAt) {
      lastShiftState = clone(current);
      return;
    }

    let dirty = false;
    Object.entries(audit.dayStatus).forEach(([date, status]) => {
      if (!status?.confirmed) return;
      const previousRows = Array.isArray(lastShiftState[date]) ? lastShiftState[date] : [];
      const currentRows = Array.isArray(current[date]) ? current[date] : [];
      const previousMap = new Map(previousRows.map(shift => [shift.id, shift]));
      const currentMap = new Map(currentRows.map(shift => [shift.id, shift]));

      currentRows.forEach(shift => {
        if (!previousMap.has(shift.id) && !isInAnySnapshot(date, shift.id)) {
          const flag = getFlag(date, shift.id);
          if (!flag.postAddition) {
            flag.postAddition = true;
            flag.postAdditionAt = new Date().toISOString();
            flag.postAdditionBy = actorName();
            setFlag(date, shift.id, flag);
            addEvent({ type: 'post_addition', date, shiftId: shift.id, staffId: shift.staffId, after: pickShift(shift), note: '確定後の臨時追加勤務' });
            dirty = true;
          }
        }
      });

      previousRows.forEach(shift => {
        if (currentMap.has(shift.id)) return;
        addEvent({ type: isOriginalConfirmed(date, shift.id) ? 'confirmed_shift_deleted' : 'post_addition_deleted', date, shiftId: shift.id, staffId: shift.staffId, before: pickShift(shift), note: isOriginalConfirmed(date, shift.id) ? '確定済みシフトが削除されました' : '臨時追加シフトが削除されました' });
        dirty = true;
      });

      currentRows.forEach(shift => {
        const before = previousMap.get(shift.id);
        if (!before || !operationallyDifferent(before, shift)) return;
        const flag = getFlag(date, shift.id);
        flag.changedAfterConfirm = true;
        flag.lastChangedAt = new Date().toISOString();
        flag.lastChangedBy = actorName();
        setFlag(date, shift.id, flag);
        addEvent({ type: 'shift_changed', date, shiftId: shift.id, staffId: shift.staffId, before: pickShift(before), after: pickShift(shift), note: '確定後にシフト内容を変更' });
        dirty = true;
      });
    });

    lastShiftState = clone(current);
    if (dirty) {
      saveAudit();
      scheduleRefresh();
    }
  }

  function ensureHistoryModal() {
    if (document.getElementById('audit-history-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'audit-history-modal';
    modal.className = 'audit-modal-bg';
    modal.innerHTML = `
      <div class="audit-modal" role="dialog" aria-modal="true" aria-label="シフト変更履歴">
        <div class="audit-modal-head"><div><strong>シフト変更履歴</strong><div>確定・追加勤務・変更・欠勤等の証跡</div></div><button id="audit-history-close" class="btn btn-light btn-small"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="audit-modal-filter"><select id="audit-history-scope" class="control"><option value="date">表示中の日付</option><option value="month">表示中の月</option><option value="all">すべて</option></select></div>
        <div id="audit-history-body" class="audit-history-body"></div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('audit-history-close')?.addEventListener('click', closeHistory);
    document.getElementById('audit-history-scope')?.addEventListener('change', renderHistory);
    modal.addEventListener('click', event => { if (event.target === modal) closeHistory(); });
  }

  function openHistory() {
    const modal = document.getElementById('audit-history-modal');
    if (!modal) return;
    modal.classList.add('open');
    renderHistory();
  }

  function closeHistory() { document.getElementById('audit-history-modal')?.classList.remove('open'); }

  function renderHistory() {
    const body = document.getElementById('audit-history-body');
    const scope = document.getElementById('audit-history-scope')?.value || 'date';
    if (!body) return;
    const date = currentDate();
    const month = date?.slice(0, 7) || '';
    const staffMap = new Map((loadJson(STORAGE_STAFF, []) || []).map(person => [String(person.id || '').toUpperCase(), person.name || person.id]));
    const events = audit.events.filter(event => scope === 'all' || (scope === 'month' ? event.date?.startsWith(month) : event.date === date)).slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 300);

    body.innerHTML = events.map(event => `
      <div class="audit-event ${esc(event.type)}">
        <div class="audit-event-time">${esc(formatDateTime(event.ts))}</div>
        <div class="audit-event-main"><strong>${esc(eventTitle(event.type))}</strong><span>${esc(event.date || '')}${event.staffId ? ` ・ ${esc(staffMap.get(String(event.staffId).toUpperCase()) || event.staffId)}` : ''}</span>${event.note ? `<div>${esc(event.note)}</div>` : ''}${changeSummary(event) ? `<small>${esc(changeSummary(event))}</small>` : ''}</div>
        <div class="audit-event-actor">${esc(event.actor || '')}</div>
      </div>
    `).join('') || '<div class="audit-empty">該当する変更履歴はありません。</div>';
  }

  function changeSummary(event) {
    if (!event.before && !event.after) return '';
    if (event.type === 'shift_changed') return `${shiftSummary(event.before)} → ${shiftSummary(event.after)}`;
    if (event.type === 'post_addition') return shiftSummary(event.after);
    if (event.type === 'confirmed_shift_deleted' || event.type === 'post_addition_deleted') return shiftSummary(event.before);
    return '';
  }

  function eventTitle(type) {
    return ({ day_confirmed: '日次シフト確定', month_confirmed: '月次シフト確定', post_addition: '臨時追加勤務', shift_changed: '確定後変更', attendance_status: '実績ステータス変更', confirmed_shift_deleted: '確定済みシフト削除検知', post_addition_deleted: '臨時追加シフト削除' })[type] || type;
  }

  function shiftSummary(shift) { return shift ? `${storeName(shift.startStoreId)} ${fmtTime(shift.start)}-${fmtTime(shift.end)}` : ''; }

  function addEvent(event) {
    audit.events.push({ id: `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, ts: new Date().toISOString(), actor: actorName(), ...event });
    if (audit.events.length > MAX_EVENTS) audit.events = audit.events.slice(-MAX_EVENTS);
  }

  function saveAudit() {
    localStorage.setItem(STORAGE_AUDIT, JSON.stringify(audit));
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(async () => {
      if (!window.shiftV2Cloud || !window.shiftV2User) return;
      try { await window.shiftV2Cloud.set(CLOUD_KEY, audit); }
      catch (error) { console.warn('Audit cloud save failed', error); }
    }, 250);
  }

  async function hydrateCloudAudit() {
    if (!window.shiftV2Cloud || !window.shiftV2User || hydrateCloudAudit.running) return;
    hydrateCloudAudit.running = true;
    try {
      const cloudAudit = await window.shiftV2Cloud.get(CLOUD_KEY);
      if (cloudAudit && typeof cloudAudit === 'object') {
        audit = normalizeAudit(cloudAudit);
        localStorage.setItem(STORAGE_AUDIT, JSON.stringify(audit));
      } else {
        await window.shiftV2Cloud.set(CLOUD_KEY, audit);
      }
      if (!cloudListenerAttached) {
        cloudListenerAttached = true;
        window.shiftV2Cloud.listen(CLOUD_KEY, value => {
          if (!value || typeof value !== 'object') return;
          audit = normalizeAudit(value);
          localStorage.setItem(STORAGE_AUDIT, JSON.stringify(audit));
          scheduleRefresh();
        });
      }
      lastShiftState = clone(loadJson(STORAGE_SHIFTS, {}));
      detectionEnabledAt = Date.now() + 1200;
      scheduleRefresh();
    } catch (error) {
      console.warn('Audit cloud load failed', error);
    } finally {
      hydrateCloudAudit.running = false;
    }
  }

  function currentDate() { return refs.workDate?.value || ''; }
  function selectedShiftId() { return document.querySelector('.shift-bar.selected')?.dataset.shiftId || ''; }
  function shiftsForDate(date) { const shifts = loadJson(STORAGE_SHIFTS, {}); return Array.isArray(shifts[date]) ? shifts[date] : []; }
  function shiftById(date, id) { return shiftsForDate(date).find(shift => shift.id === id); }
  function latestSnapshot(date) { const rows = audit.snapshots[date] || []; return rows.length ? rows[rows.length - 1] : null; }
  function latestSnapshotShift(date, id) { return latestSnapshot(date)?.shifts?.find(shift => shift.id === id) || null; }
  function isOriginalConfirmed(date, id) { return Boolean(latestSnapshotShift(date, id)); }
  function isInAnySnapshot(date, id) { return (audit.snapshots[date] || []).some(snapshot => snapshot.shifts?.some(shift => shift.id === id)); }
  function isChangedFromLatestSnapshot(date, id) { const before = latestSnapshotShift(date, id); const after = shiftById(date, id); return Boolean(before && after && operationallyDifferent(before, after)); }
  function getFlag(date, id) { return clone(audit.flags[date]?.[id] || {}); }
  function setFlag(date, id, value) { if (!audit.flags[date]) audit.flags[date] = {}; audit.flags[date][id] = value; }
  function operationallyDifferent(a, b) { return SHIFT_FIELDS.some(field => String(a?.[field] ?? '') !== String(b?.[field] ?? '')); }
  function pickShift(shift) { if (!shift) return null; const out = { id: shift.id }; SHIFT_FIELDS.forEach(field => { out[field] = shift[field] ?? ''; }); return out; }
  function storeName(id) { return ({ matsuyama: '松山店', kumoji: '久茂地店', miebashi: '美栄橋店', misato: '美里店' })[id] || id || ''; }
  function fmtTime(totalMinutes) { const value = Number(totalMinutes); if (!Number.isFinite(value)) return ''; const hour = Math.floor(value / 60) % 24; const minute = value % 60; return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`; }
  function actorName() { const user = window.shiftV2User; return user?.displayName || user?.email || 'ローカル利用者'; }
  function formatDateTime(value) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
  function loadAudit() { return normalizeAudit(loadJson(STORAGE_AUDIT, {})); }
  function normalizeAudit(value) { return { version: 1, dayStatus: value?.dayStatus && typeof value.dayStatus === 'object' ? value.dayStatus : {}, snapshots: value?.snapshots && typeof value.snapshots === 'object' ? value.snapshots : {}, flags: value?.flags && typeof value.flags === 'object' ? value.flags : {}, events: Array.isArray(value?.events) ? value.events : [] }; }
  function loadJson(key, fallback) { try { const parsed = JSON.parse(localStorage.getItem(key)); return parsed ?? clone(fallback); } catch { return clone(fallback); } }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char])); }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }
})();