(() => {
  'use strict';

  const MINUTE = 60 * 1000;
  const DAY_START = 15 * 60;
  const DAY_END = 30 * 60;
  const SLOT = 30;
  const SLOT_PX = 46;
  const STORAGE_CONFIG = 'okk_shift_v2_config';
  const STORAGE_SHIFTS = 'okk_shift_v2_shifts';
  const STORAGE_STAFF = 'okk_shift_v2_staff';

  const DEFAULT_STORES = [
    { id: 'matsuyama', name: '松山店', area: 'naha', close: 30 * 60, autoJoin: false, joinTarget: '', color: '#7c3aed' },
    { id: 'kumoji', name: '久茂地店', area: 'naha', close: 25 * 60, autoJoin: true, joinTarget: 'matsuyama', color: '#059669' },
    { id: 'miebashi', name: '美栄橋店', area: 'naha', close: 25 * 60, autoJoin: true, joinTarget: 'matsuyama', color: '#2563eb' },
    { id: 'misato', name: '美里店', area: 'okinawa', close: 26 * 60, autoJoin: false, joinTarget: '', color: '#ea580c' },
  ];

  const FALLBACK_STAFF = [
    { id: 'OKK10001', name: '又吉 達朗', salaryType: 'monthly', skills: ['肉場', '締め作業', 'レジ'] },
    { id: 'OKK10003', name: '又吉 健太', salaryType: 'monthly', skills: ['肉場', 'ホール（肉焼ける）', '締め作業'] },
    { id: 'OKK10004', name: '新城 優樹', salaryType: 'monthly', skills: ['肉場', 'サラダ場', '締め作業'] },
    { id: 'OKK10005', name: '三澤 北斗', salaryType: 'monthly', skills: ['ドリンカー', 'ホール（肉焼ける）'] },
    { id: 'OKK10008', name: '安里 茜 マーティン', salaryType: 'hourly', skills: ['ホール（肉焼ける）', 'レジ'] },
    { id: 'OKK10009', name: '平田 明久', salaryType: 'hourly', skills: ['肉場', '締め作業'] },
    { id: 'OKK10010', name: '宮城 文弥', salaryType: 'hourly', skills: ['サラダ場', 'ドリンカー'] },
    { id: 'OKK10012', name: '栄野比 あいみ', salaryType: 'hourly', skills: ['ホール（肉焼けない）', 'レジ'] },
    { id: 'OKK10016', name: '又吉 茉紀', salaryType: 'hourly', skills: ['ホール（肉焼けない）', '洗い場'] },
    { id: 'OKK10020', name: '平川 翔', salaryType: 'hourly', skills: ['肉場', '洗い場'] },
  ];

  const state = {
    date: dateKey(new Date()),
    stores: loadLocal(STORAGE_CONFIG, DEFAULT_STORES),
    staff: loadLocal(STORAGE_STAFF, FALLBACK_STAFF),
    shifts: loadLocal(STORAGE_SHIFTS, {}),
    selectedShiftId: null,
    newStoreId: 'matsuyama',
    currentView: 'planner',
    cloudReady: false,
    user: null,
    staffQuery: '',
    interaction: null,
  };

  const el = {};

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('shiftv2-cloud-ready', () => {
    state.cloudReady = true;
    hydrateCloud();
  });
  document.addEventListener('shiftv2-auth', event => {
    state.user = event.detail.user;
    updateLoginButton();
    if (state.user) hydrateCloud();
  });

  function init() {
    cacheElements();
    bindEvents();
    setDateInputs();
    renderAll();
    updateLoginButton();
    setTimeout(() => {
      if (window.shiftV2Cloud) {
        state.cloudReady = true;
        hydrateCloud();
      }
    }, 250);
  }

  function cacheElements() {
    [
      'sync-status','login-btn','save-btn','settings-btn','work-date','prev-day','next-day','today-btn',
      'new-store-buttons','staff-search','staff-list','gantt-scroll','gantt-canvas','inspector',
      'staff-summary','staff-month','staff-view-body','store-date','store-grid',
      'csv-start','csv-end','csv-refresh','csv-download','csv-preview',
      'settings-modal','settings-close','settings-body','settings-reset','settings-save','toast'
    ].forEach(id => { el[toCamel(id)] = document.getElementById(id); });
  }

  function bindEvents() {
    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)));
    el.workDate.addEventListener('change', () => { state.date = el.workDate.value; state.selectedShiftId = null; syncDateInputs(); renderAll(); });
    el.storeDate.addEventListener('change', () => { state.date = el.storeDate.value; syncDateInputs(); renderStoreView(); });
    el.prevDay.addEventListener('click', () => moveDate(-1));
    el.nextDay.addEventListener('click', () => moveDate(1));
    el.todayBtn.addEventListener('click', () => { state.date = dateKey(new Date()); syncDateInputs(); renderAll(); });
    el.staffSearch.addEventListener('input', () => { state.staffQuery = el.staffSearch.value.trim().toLowerCase(); renderStaffPool(); });
    el.saveBtn.addEventListener('click', () => saveAll(true));
    el.settingsBtn.addEventListener('click', openSettings);
    el.settingsClose.addEventListener('click', closeSettings);
    el.settingsModal.addEventListener('click', event => { if (event.target === el.settingsModal) closeSettings(); });
    el.settingsReset.addEventListener('click', () => { state.stores = clone(DEFAULT_STORES); renderSettingsRows(); });
    el.settingsSave.addEventListener('click', saveSettingsFromModal);
    el.staffMonth.addEventListener('change', renderStaffView);
    el.csvRefresh.addEventListener('click', renderCsv);
    el.csvDownload.addEventListener('click', downloadCsv);
    el.loginBtn.addEventListener('click', async () => {
      try {
        if (state.user) await window.shiftV2Logout?.();
        else await window.shiftV2Login?.();
      } catch (error) {
        toast('ログイン処理に失敗しました');
        console.error(error);
      }
    });
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  function setDateInputs() {
    el.workDate.value = state.date;
    el.storeDate.value = state.date;
    const month = state.date.slice(0, 7);
    el.staffMonth.value = month;
    const [year, monthNum] = month.split('-').map(Number);
    el.csvStart.value = `${month}-01`;
    el.csvEnd.value = dateKey(new Date(year, monthNum, 0));
  }

  function syncDateInputs() {
    el.workDate.value = state.date;
    el.storeDate.value = state.date;
  }

  function moveDate(delta) {
    const date = new Date(`${state.date}T00:00:00`);
    date.setDate(date.getDate() + delta);
    state.date = dateKey(date);
    state.selectedShiftId = null;
    syncDateInputs();
    renderAll();
  }

  function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
    document.querySelectorAll('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
    if (view === 'staff') renderStaffView();
    if (view === 'store') renderStoreView();
    if (view === 'csv') renderCsv();
  }

  function renderAll() {
    renderStoreButtons();
    renderStaffPool();
    renderGantt();
    renderInspector();
    renderStaffView();
    renderStoreView();
    renderCsv();
  }

  function renderStoreButtons() {
    if (!getStore(state.newStoreId)) state.newStoreId = state.stores[0]?.id || '';
    el.newStoreButtons.innerHTML = state.stores.map(store => `
      <button type="button" data-store="${esc(store.id)}" class="${store.id === state.newStoreId ? 'active' : ''}" style="${store.id === state.newStoreId ? `background:${store.color}` : ''}">${esc(store.name)}</button>
    `).join('');
    el.newStoreButtons.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      state.newStoreId = button.dataset.store;
      renderStoreButtons();
    }));
  }

  function dayShifts() {
    return Array.isArray(state.shifts[state.date]) ? state.shifts[state.date] : [];
  }

  function renderStaffPool() {
    const assigned = new Set(dayShifts().map(shift => shift.staffId));
    const query = state.staffQuery;
    const list = state.staff.filter(staff => {
      const haystack = `${staff.id} ${staff.name} ${(staff.skills || []).join(' ')}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    el.staffList.innerHTML = list.map(staff => `
      <div class="staff-card ${assigned.has(staff.id) ? 'assigned' : ''}" draggable="${assigned.has(staff.id) ? 'false' : 'true'}" data-staff-id="${esc(staff.id)}">
        <div class="staff-name">${esc(staff.name)}</div>
        <div style="font-size:8px;color:#8a94a5;margin-top:1px">${esc(staff.id)}</div>
        <div class="staff-meta">
          <span class="badge ${staff.salaryType === 'monthly' ? 'badge-monthly' : 'badge-hourly'}">${staff.salaryType === 'monthly' ? '正社員' : 'アルバイト'}</span>
          ${(staff.skills || []).slice(0, 3).map(skill => `<span class="badge">${esc(shortSkill(skill))}</span>`).join('')}
        </div>
      </div>
    `).join('') || '<div class="empty">該当する従業員がいません。</div>';
    el.staffList.querySelectorAll('[draggable="true"]').forEach(card => {
      card.addEventListener('dragstart', event => {
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/staff-id', card.dataset.staffId);
      });
    });
  }

  function renderGantt() {
    const shifts = dayShifts().slice().sort((a, b) => a.start - b.start || staffName(a.staffId).localeCompare(staffName(b.staffId), 'ja'));
    let html = '<div class="gantt-head"><div class="staff-head">配置済みスタッフ</div><div class="time-head">';
    for (let minute = DAY_START; minute <= DAY_END; minute += 60) {
      const left = ((minute - DAY_START) / SLOT) * SLOT_PX;
      html += `<span class="time-label ${minute >= 24 * 60 ? 'next' : ''}" style="left:${left}px">${fmtTime(minute, true)}</span>`;
    }
    html += '</div></div>';

    shifts.forEach(shift => {
      const staff = getStaff(shift.staffId);
      html += `<div class="gantt-row">
        <div class="staff-cell"><div><strong>${esc(staff?.name || shift.staffId)}</strong><span>${esc(staff?.id || shift.staffId)}</span></div><button class="btn btn-light btn-small" data-select="${esc(shift.id)}"><i class="fa-solid fa-pen"></i></button></div>
        <div class="track" data-track-id="${esc(shift.id)}">${trackMarkers()}${shiftBarHtml(shift)}</div>
      </div>`;
    });

    html += `<div class="gantt-row">
      <div class="staff-cell"><div><strong style="color:#8a94a5">新しい配置</strong><span>左の従業員を右へドラッグ</span></div></div>
      <div id="empty-drop-track" class="track" style="background:repeating-linear-gradient(-45deg,#fff,#fff 12px,#fafbfc 12px,#fafbfc 24px)">${trackMarkers()}<div style="position:absolute;inset:0;display:grid;place-items:center;color:#8a94a5;font-size:10px;font-weight:800;pointer-events:none">ここへドロップして開始時刻を決める</div></div>
    </div>`;

    el.ganttCanvas.innerHTML = html;
    bindGanttEvents();
  }

  function trackMarkers() {
    const nahaClose = 25 * 60;
    const misatoClose = 26 * 60;
    return `${markerHtml(nahaClose, 'close-line', '那覇 1:00')}${markerHtml(misatoClose, 'close-line', '美里 2:00')}`;
  }

  function markerHtml(minute, className, label) {
    const left = ((minute - DAY_START) / SLOT) * SLOT_PX;
    return `<div class="${className}" style="left:${left}px"><span>${label}</span></div>`;
  }

  function shiftBarHtml(shift) {
    const left = ((shift.start - DAY_START) / SLOT) * SLOT_PX;
    const width = Math.max(SLOT_PX, ((shift.end - shift.start) / SLOT) * SLOT_PX);
    const segments = deriveSegments(shift);
    const selected = shift.id === state.selectedShiftId ? 'selected' : '';
    const segmentHtml = segments.map((segment, index) => {
      const store = getStore(segment.storeId);
      const segmentWidth = ((segment.end - segment.start) / (shift.end - shift.start)) * 100;
      const label = index === 0 ? `${store?.name || ''} ${fmtTime(shift.start)}-${fmtTime(shift.end)}` : `${store?.name || ''} 合流`;
      return `<div class="seg" style="width:${segmentWidth}%;background:${store?.color || '#64748b'}" title="${esc(label)}">${esc(label)}</div>`;
    }).join('');
    const join = segments.length > 1
      ? `<div class="join-line" style="left:${((segments[0].end - shift.start) / (shift.end - shift.start)) * 100}%"><span>松山合流</span></div>`
      : '';
    return `<div class="shift-bar ${selected}" data-shift-id="${esc(shift.id)}" style="left:${left}px;width:${width}px">
      ${segmentHtml}${join}<span class="handle left" data-handle="start"></span><span class="handle right" data-handle="end"></span>
    </div>`;
  }

  function bindGanttEvents() {
    el.ganttCanvas.querySelectorAll('[data-select]').forEach(button => button.addEventListener('click', () => selectShift(button.dataset.select)));
    el.ganttCanvas.querySelectorAll('.shift-bar').forEach(bar => {
      bar.addEventListener('click', event => { event.stopPropagation(); selectShift(bar.dataset.shiftId); });
      bar.addEventListener('pointerdown', event => {
        const shift = findShift(bar.dataset.shiftId);
        if (!shift) return;
        event.preventDefault();
        const handle = event.target.closest('[data-handle]');
        state.interaction = {
          id: shift.id,
          mode: handle ? handle.dataset.handle : 'move',
          startX: event.clientX,
          originalStart: shift.start,
          originalEnd: shift.end,
          lastDelta: null,
        };
        selectShift(shift.id, false);
      });
    });

    const dropTrack = document.getElementById('empty-drop-track');
    if (dropTrack) {
      dropTrack.addEventListener('dragover', event => { event.preventDefault(); dropTrack.classList.add('drag-target'); });
      dropTrack.addEventListener('dragleave', () => dropTrack.classList.remove('drag-target'));
      dropTrack.addEventListener('drop', event => {
        event.preventDefault();
        dropTrack.classList.remove('drag-target');
        const staffId = event.dataTransfer.getData('text/staff-id');
        if (!staffId || dayShifts().some(shift => shift.staffId === staffId)) return;
        const rect = dropTrack.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const start = snap(clamp(DAY_START + (x / SLOT_PX) * SLOT, DAY_START, DAY_END - SLOT));
        const staff = getStaff(staffId);
        const defaultHours = staff?.salaryType === 'monthly' ? 8 : 5;
        const end = clamp(start + defaultHours * 60, start + SLOT, DAY_END);
        const shift = { id: uid(), staffId, startStoreId: state.newStoreId, start, end, memo: '' };
        ensureDayArray().push(shift);
        state.selectedShiftId = shift.id;
        saveAll(false);
        renderAll();
      });
    }
  }

  function onPointerMove(event) {
    const interaction = state.interaction;
    if (!interaction) return;
    const shift = findShift(interaction.id);
    if (!shift) return;
    const delta = Math.round((event.clientX - interaction.startX) / SLOT_PX) * SLOT;
    if (delta === interaction.lastDelta) return;
    interaction.lastDelta = delta;
    if (interaction.mode === 'move') {
      const duration = interaction.originalEnd - interaction.originalStart;
      const start = clamp(interaction.originalStart + delta, DAY_START, DAY_END - duration);
      shift.start = snap(start);
      shift.end = shift.start + duration;
    } else if (interaction.mode === 'start') {
      shift.start = snap(clamp(interaction.originalStart + delta, DAY_START, shift.end - SLOT));
    } else {
      shift.end = snap(clamp(interaction.originalEnd + delta, shift.start + SLOT, DAY_END));
    }
    renderGantt();
    renderInspector();
  }

  function onPointerUp() {
    if (!state.interaction) return;
    state.interaction = null;
    saveAll(false);
    renderAll();
  }

  function selectShift(id, rerender = true) {
    state.selectedShiftId = id;
    if (rerender) renderGantt();
    renderInspector();
  }

  function renderInspector() {
    const shift = findShift(state.selectedShiftId);
    if (!shift) {
      el.inspector.innerHTML = '<div class="empty"><strong style="color:#536071">操作方法</strong><br>1. 左の従業員を時間軸へドラッグ<br>2. バー中央を動かして時間を移動<br>3. 両端の白い取手で開始・終了を伸縮<br>4. 出勤店舗は右側で変更</div>';
      return;
    }
    const staff = getStaff(shift.staffId);
    const segments = deriveSegments(shift);
    const routeHtml = segments.map(segment => {
      const store = getStore(segment.storeId);
      return `<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><span style="width:8px;height:8px;border-radius:50%;background:${store?.color || '#64748b'}"></span><strong>${esc(store?.name || '')}</strong> ${fmtTime(segment.start)}-${fmtTime(segment.end)}</div>`;
    }).join('');
    const autoNote = segments.length > 1 ? '<div class="warning">終了時刻が出勤店舗の閉店時刻を超えているため、閉店後は松山店勤務として自動表示しています。MF CSVは開始から終了まで1本で出力します。</div>' : '';
    el.inspector.innerHTML = `
      <div class="form-grid">
        <div class="field"><label>従業員</label><input class="control" value="${esc(staff?.name || shift.staffId)}" disabled></div>
        <div class="field"><label>出勤店舗</label><select id="ins-store" class="control">${state.stores.map(store => `<option value="${esc(store.id)}" ${store.id === shift.startStoreId ? 'selected' : ''}>${esc(store.name)}（${areaName(store.area)}）</option>`).join('')}</select></div>
        <div class="field"><label>開始時刻</label><select id="ins-start" class="control">${timeOptions(shift.start, DAY_START, shift.end - SLOT)}</select></div>
        <div class="field"><label>終了時刻</label><select id="ins-end" class="control">${timeOptions(shift.end, shift.start + SLOT, DAY_END)}</select></div>
        <div class="field"><label>メモ</label><input id="ins-memo" class="control" value="${esc(shift.memo || '')}" placeholder="任意"></div>
      </div>
      <div class="route"><strong>自動配置ルート</strong>${routeHtml}${autoNote}</div>
      <button id="delete-shift" class="btn" style="margin-top:10px;width:100%;background:#fff;color:#dc2626;border-color:#fecaca"><i class="fa-solid fa-trash"></i>このシフトを削除</button>
    `;
    document.getElementById('ins-store').addEventListener('change', event => updateSelected({ startStoreId: event.target.value }));
    document.getElementById('ins-start').addEventListener('change', event => updateSelected({ start: Number(event.target.value) }));
    document.getElementById('ins-end').addEventListener('change', event => updateSelected({ end: Number(event.target.value) }));
    document.getElementById('ins-memo').addEventListener('change', event => updateSelected({ memo: event.target.value }));
    document.getElementById('delete-shift').addEventListener('click', () => {
      state.shifts[state.date] = dayShifts().filter(item => item.id !== shift.id);
      state.selectedShiftId = null;
      saveAll(false);
      renderAll();
    });
  }

  function updateSelected(patch) {
    const shift = findShift(state.selectedShiftId);
    if (!shift) return;
    Object.assign(shift, patch);
    if (shift.end <= shift.start) shift.end = Math.min(DAY_END, shift.start + SLOT);
    saveAll(false);
    renderAll();
  }

  function renderStaffView() {
    if (!el.staffViewBody) return;
    const month = el.staffMonth.value || state.date.slice(0, 7);
    const rows = allShiftRows().filter(row => row.date.startsWith(month)).sort((a, b) => a.staffName.localeCompare(b.staffName, 'ja') || a.date.localeCompare(b.date));
    el.staffViewBody.innerHTML = rows.map(row => `<tr>
      <td>${esc(row.staffId)}</td><td><strong>${esc(row.staffName)}</strong></td><td>${esc(formatDateJa(row.date))}</td>
      <td>${esc(getStore(row.shift.startStoreId)?.name || '')}</td><td>${fmtTime(row.shift.start)}-${fmtTime(row.shift.end)}</td>
      <td>${deriveSegments(row.shift).map(segment => `<span class="badge" style="background:${hexToSoft(getStore(segment.storeId)?.color)};color:${getStore(segment.storeId)?.color}">${esc(getStore(segment.storeId)?.name || '')} ${fmtTime(segment.start)}-${fmtTime(segment.end)}</span>`).join(' ')}</td>
    </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#8a94a5;padding:30px">この月のシフトはまだありません。</td></tr>';

    const totalHours = rows.reduce((sum, row) => sum + (row.shift.end - row.shift.start) / 60, 0);
    const uniqueStaff = new Set(rows.map(row => row.staffId)).size;
    const autoJoined = rows.filter(row => deriveSegments(row.shift).length > 1).length;
    el.staffSummary.innerHTML = metric('配置数', `${rows.length}件`, '月内の勤務シフト') + metric('勤務者', `${uniqueStaff}名`, '配置済み従業員') + metric('予定時間', `${totalHours.toFixed(1)}h`, '移動を含む連続勤務') + metric('松山合流', `${autoJoined}件`, '那覇エリア自動判定');
  }

  function metric(label, value, sub) {
    return `<div class="card metric"><small>${label}</small><strong>${value}</strong><div style="font-size:8px;color:#8a94a5;margin-top:2px">${sub}</div></div>`;
  }

  function renderStoreView() {
    if (!el.storeGrid) return;
    const shifts = Array.isArray(state.shifts[el.storeDate.value || state.date]) ? state.shifts[el.storeDate.value || state.date] : [];
    el.storeGrid.innerHTML = state.stores.map(store => {
      const members = [];
      shifts.forEach(shift => deriveSegments(shift).filter(segment => segment.storeId === store.id).forEach(segment => {
        members.push({ staff: getStaff(shift.staffId), segment, shift });
      }));
      members.sort((a, b) => a.segment.start - b.segment.start);
      return `<div class="card">
        <div class="store-card-head" style="background:${store.color}"><h3>${esc(store.name)}</h3><span style="font-size:9px">${areaName(store.area)}・${fmtTime(store.close)}閉店</span></div>
        <div class="store-body">${members.map(member => `<div class="member"><div><strong>${esc(member.staff?.name || member.shift.staffId)}</strong><div style="font-size:8px;color:#8a94a5">${member.segment.start !== member.shift.start ? '閉店後合流' : '出勤'}</div></div><span>${fmtTime(member.segment.start)}-${fmtTime(member.segment.end)}</span></div>`).join('') || '<div class="empty">この日の配置はありません。</div>'}</div>
      </div>`;
    }).join('');
  }

  function renderCsv() {
    if (!el.csvPreview) return;
    el.csvPreview.value = buildCsv(el.csvStart.value, el.csvEnd.value);
  }

  function buildCsv(startDate, endDate) {
    const headers = ['従業員番号','苗字','名前','日付','勤怠区分','勤務パターン','開始時刻','終了時刻','休憩開始時刻1','休憩終了時刻1','休憩開始時刻2','休憩終了時刻2','休憩開始時刻3','休憩終了時刻3'];
    const rows = [headers];
    allShiftRows().filter(row => (!startDate || row.date >= startDate) && (!endDate || row.date <= endDate)).sort((a, b) => a.staffId.localeCompare(b.staffId) || a.date.localeCompare(b.date)).forEach(row => {
      const [lastName, firstName] = splitName(row.staffName);
      rows.push([
        row.staffId.toUpperCase(), lastName, firstName, row.date.replaceAll('-', '/'), '平日', '',
        fmtMfTime(row.shift.start), fmtMfTime(row.shift.end), '', '', '', '', '', ''
      ]);
    });
    return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  function downloadCsv() {
    const csv = buildCsv(el.csvStart.value, el.csvEnd.value);
    const filename = `MFシフト_${el.csvStart.value || state.date}_${el.csvEnd.value || state.date}.csv`;
    let blob;
    if (window.Encoding) {
      const unicode = window.Encoding.stringToCode(csv);
      const sjis = window.Encoding.convert(unicode, { to: 'SJIS', from: 'UNICODE' });
      blob = new Blob([new Uint8Array(sjis)], { type: 'text/csv;charset=shift_jis' });
    } else {
      blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('MF用CSVを保存しました');
  }

  function openSettings() {
    renderSettingsRows();
    el.settingsModal.classList.add('open');
  }
  function closeSettings() { el.settingsModal.classList.remove('open'); }

  function renderSettingsRows() {
    el.settingsBody.innerHTML = state.stores.map(store => `<tr data-store-row="${esc(store.id)}">
      <td><input data-field="name" value="${esc(store.name)}"></td>
      <td><select data-field="area"><option value="naha" ${store.area === 'naha' ? 'selected' : ''}>那覇エリア</option><option value="okinawa" ${store.area === 'okinawa' ? 'selected' : ''}>沖縄エリア</option></select></td>
      <td><select data-field="close">${timeOptions(store.close, 24 * 60, DAY_END)}</select></td>
      <td style="text-align:center"><input data-field="autoJoin" type="checkbox" style="width:auto" ${store.autoJoin ? 'checked' : ''}></td>
      <td><select data-field="joinTarget"><option value="">なし</option>${state.stores.filter(other => other.id !== store.id).map(other => `<option value="${esc(other.id)}" ${store.joinTarget === other.id ? 'selected' : ''}>${esc(other.name)}</option>`).join('')}</select></td>
      <td><input data-field="color" type="color" value="${esc(store.color)}"></td>
    </tr>`).join('');
  }

  function saveSettingsFromModal() {
    state.stores = Array.from(el.settingsBody.querySelectorAll('[data-store-row]')).map(row => {
      const current = getStore(row.dataset.storeRow) || {};
      return {
        ...current,
        id: row.dataset.storeRow,
        name: row.querySelector('[data-field="name"]').value.trim() || current.name,
        area: row.querySelector('[data-field="area"]').value,
        close: Number(row.querySelector('[data-field="close"]').value),
        autoJoin: row.querySelector('[data-field="autoJoin"]').checked,
        joinTarget: row.querySelector('[data-field="joinTarget"]').value,
        color: row.querySelector('[data-field="color"]').value,
      };
    });
    saveAll(true);
    closeSettings();
    renderAll();
  }

  function deriveSegments(shift) {
    const store = getStore(shift.startStoreId);
    if (!store) return [{ storeId: shift.startStoreId, start: shift.start, end: shift.end }];
    if (store.autoJoin && store.joinTarget && shift.end > store.close) {
      if (shift.start >= store.close) return [{ storeId: store.joinTarget, start: shift.start, end: shift.end }];
      return [
        { storeId: store.id, start: shift.start, end: store.close },
        { storeId: store.joinTarget, start: store.close, end: shift.end },
      ];
    }
    return [{ storeId: store.id, start: shift.start, end: shift.end }];
  }

  function allShiftRows() {
    const rows = [];
    Object.entries(state.shifts).forEach(([date, shifts]) => {
      if (!Array.isArray(shifts)) return;
      shifts.forEach(shift => rows.push({ date, shift, staffId: shift.staffId, staffName: staffName(shift.staffId) }));
    });
    return rows;
  }

  function ensureDayArray() {
    if (!Array.isArray(state.shifts[state.date])) state.shifts[state.date] = [];
    return state.shifts[state.date];
  }

  function findShift(id) { return dayShifts().find(shift => shift.id === id); }
  function getStore(id) { return state.stores.find(store => store.id === id); }
  function getStaff(id) { return state.staff.find(staff => staff.id === id); }
  function staffName(id) { return getStaff(id)?.name || id; }

  async function hydrateCloud() {
    if (!window.shiftV2Cloud || hydrateCloud.running) return;
    hydrateCloud.running = true;
    setSyncStatus('クラウド確認中...');
    try {
      const [cloudStaff, cloudConfig, cloudShifts] = await Promise.all([
        window.shiftV2Cloud.get('staff'),
        window.shiftV2Cloud.get('shiftV2Config'),
        window.shiftV2Cloud.get('shiftV2Shifts'),
      ]);
      if (Array.isArray(cloudStaff) && cloudStaff.length) {
        state.staff = cloudStaff.map(normalizeStaff);
        localStorage.setItem(STORAGE_STAFF, JSON.stringify(state.staff));
      }
      if (Array.isArray(cloudConfig) && cloudConfig.length) {
        state.stores = cloudConfig;
        localStorage.setItem(STORAGE_CONFIG, JSON.stringify(state.stores));
      }
      if (cloudShifts && typeof cloudShifts === 'object') {
        state.shifts = cloudShifts;
        localStorage.setItem(STORAGE_SHIFTS, JSON.stringify(state.shifts));
      }
      attachCloudListeners();
      setSyncStatus(state.user ? 'クラウド同期中' : 'クラウド読込済み');
      renderAll();
    } catch (error) {
      console.warn('Cloud load failed', error);
      setSyncStatus('ローカル保存');
    } finally {
      hydrateCloud.running = false;
    }
  }

  let listenersAttached = false;
  function attachCloudListeners() {
    if (listenersAttached || !window.shiftV2Cloud) return;
    listenersAttached = true;
    try {
      window.shiftV2Cloud.listen('shiftV2Config', value => {
        if (!Array.isArray(value)) return;
        state.stores = value;
        localStorage.setItem(STORAGE_CONFIG, JSON.stringify(value));
        renderAll();
      });
      window.shiftV2Cloud.listen('shiftV2Shifts', value => {
        if (!value || typeof value !== 'object') return;
        state.shifts = value;
        localStorage.setItem(STORAGE_SHIFTS, JSON.stringify(value));
        renderAll();
      });
    } catch (error) {
      console.warn(error);
    }
  }

  async function saveAll(showToast) {
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(state.stores));
    localStorage.setItem(STORAGE_SHIFTS, JSON.stringify(state.shifts));
    localStorage.setItem(STORAGE_STAFF, JSON.stringify(state.staff));
    setSyncStatus('保存中...');
    if (window.shiftV2Cloud && state.user) {
      try {
        await Promise.all([
          window.shiftV2Cloud.set('shiftV2Config', state.stores),
          window.shiftV2Cloud.set('shiftV2Shifts', state.shifts),
        ]);
        setSyncStatus('クラウド同期済み');
        if (showToast) toast('クラウドへ保存しました');
        return;
      } catch (error) {
        console.warn('Cloud save failed', error);
      }
    }
    setSyncStatus('ローカル保存済み');
    if (showToast) toast('この端末に保存しました');
  }

  function updateLoginButton() {
    if (!el.loginBtn) return;
    el.loginBtn.innerHTML = state.user
      ? `<i class="fa-solid fa-right-from-bracket"></i>${esc(state.user.displayName || state.user.email || 'ログアウト')}`
      : '<i class="fa-brands fa-google"></i>ログイン';
  }

  function setSyncStatus(text) { if (el.syncStatus) el.syncStatus.textContent = text; }

  function normalizeStaff(staff) {
    return {
      ...staff,
      id: String(staff.id || staff.employeeNumber || '').toUpperCase(),
      name: staff.name || `${staff.lastName || ''} ${staff.firstName || ''}`.trim(),
      salaryType: staff.salaryType === 'monthly' ? 'monthly' : 'hourly',
      skills: Array.isArray(staff.skills) ? staff.skills : [],
    };
  }

  function timeOptions(selected, min, max) {
    let html = '';
    for (let minute = snap(min); minute <= max; minute += SLOT) {
      html += `<option value="${minute}" ${minute === selected ? 'selected' : ''}>${fmtTime(minute, true)}</option>`;
    }
    return html;
  }

  function fmtTime(totalMinutes, verbose = false) {
    const next = totalMinutes >= 24 * 60;
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    const clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return verbose && next ? `翌 ${clock}` : clock;
  }

  function fmtMfTime(totalMinutes) {
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  function splitName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return [parts.shift() || '', parts.join(' ') || ''];
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function areaName(area) { return area === 'okinawa' ? '沖縄エリア' : '那覇エリア'; }
  function shortSkill(skill) { return String(skill).replace('ホール（肉焼ける）', 'ホール◎').replace('ホール（肉焼けない）', 'ホール'); }
  function hexToSoft(hex) { return `${hex || '#64748b'}18`; }
  function snap(value) { return Math.round(value / SLOT) * SLOT; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function uid() { return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function loadLocal(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? clone(fallback); } catch { return clone(fallback); } }
  function dateKey(date) { return new Date(date.getTime() - date.getTimezoneOffset() * MINUTE).toISOString().slice(0, 10); }
  function formatDateJa(dateString) { const date = new Date(`${dateString}T00:00:00`); return `${date.getMonth() + 1}/${date.getDate()}(${['日','月','火','水','木','金','土'][date.getDay()]})`; }
  function toCamel(id) { return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
  function esc(value) { return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
  function toast(message) { el.toast.textContent = message; el.toast.classList.add('show'); setTimeout(() => el.toast.classList.remove('show'), 1800); }
})();
