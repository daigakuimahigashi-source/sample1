(() => {
  'use strict';

  const SOURCE_PREFIX = 'okk_shift_v2_';
  const PREVIEW_PREFIX = 'okk_shift_preview_v1_';
  const ROLE_KEY = PREVIEW_PREFIX + 'role';
  const originalGetItem = Storage.prototype.getItem;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  function previewKey(key) {
    const text = String(key || '');
    return text.startsWith(SOURCE_PREFIX) ? PREVIEW_PREFIX + text.slice(SOURCE_PREFIX.length) : text;
  }

  Storage.prototype.getItem = function(key) { return originalGetItem.call(this, previewKey(key)); };
  Storage.prototype.setItem = function(key, value) { return originalSetItem.call(this, previewKey(key), value); };
  Storage.prototype.removeItem = function(key) { return originalRemoveItem.call(this, previewKey(key)); };

  const today = dateKey(new Date());
  const staffKey = PREVIEW_PREFIX + 'staff';
  const configKey = PREVIEW_PREFIX + 'config';
  const shiftsKey = PREVIEW_PREFIX + 'shifts';
  const exceptionsKey = PREVIEW_PREFIX + 'exceptions';
  const auditKey = PREVIEW_PREFIX + 'skill_audit';

  const stores = [
    { id:'matsuyama', name:'松山店', area:'naha', close:1800, color:'#7c3aed' },
    { id:'kumoji', name:'久茂地店', area:'naha', close:1500, color:'#059669' },
    { id:'miebashi', name:'美栄橋店', area:'naha', close:1500, color:'#2563eb' },
    { id:'misato', name:'美里店', area:'okinawa', close:1560, color:'#ea580c' },
  ];

  const staff = [
    { id:'OKK10001', name:'又吉 達朗', employmentType:'正社員', salaryType:'monthly', managerQualified:true, active:true, skillLevels:{meat:3,salad:2,drink:1,hall_grill:3,hall_basic:3,dish:2,closing:3,opening:3,register:3} },
    { id:'OKK10003', name:'又吉 健太', employmentType:'正社員', salaryType:'monthly', managerQualified:true, active:true, skillLevels:{meat:3,salad:2,drink:2,hall_grill:3,hall_basic:3,dish:2,closing:3,opening:2,register:2} },
    { id:'OKK10004', name:'新城 優樹', employmentType:'正社員', salaryType:'monthly', active:true, skillLevels:{meat:3,salad:3,drink:1,hall_grill:2,hall_basic:3,dish:2,closing:3,opening:2,register:2} },
    { id:'OKK10005', name:'三澤 北斗', employmentType:'正社員', salaryType:'monthly', active:true, skillLevels:{meat:1,salad:2,drink:3,hall_grill:3,hall_basic:3,dish:2,closing:2,opening:2,register:3} },
    { id:'OKK10008', name:'安里 茜 マーティン', employmentType:'アルバイト', salaryType:'hourly', active:true, skillLevels:{meat:0,salad:1,drink:2,hall_grill:3,hall_basic:3,dish:2,closing:1,opening:1,register:3} },
    { id:'OKK10009', name:'平田 明久', employmentType:'アルバイト', salaryType:'hourly', active:true, skillLevels:{meat:3,salad:1,drink:0,hall_grill:2,hall_basic:2,dish:2,closing:3,opening:1,register:1} },
    { id:'OKK10010', name:'宮城 文弥', employmentType:'アルバイト', salaryType:'hourly', active:true, skillLevels:{meat:1,salad:3,drink:3,hall_grill:1,hall_basic:2,dish:2,closing:1,opening:1,register:1} },
    { id:'OKK10012', name:'栄野比 あいみ', employmentType:'アルバイト', salaryType:'hourly', active:true, skillLevels:{meat:0,salad:1,drink:2,hall_grill:1,hall_basic:3,dish:2,closing:1,opening:1,register:3} },
    { id:'OKK10016', name:'又吉 茉紀', employmentType:'アルバイト', salaryType:'hourly', active:true, skillLevels:{meat:0,salad:1,drink:1,hall_grill:1,hall_basic:3,dish:3,closing:1,opening:2,register:2} },
    { id:'OKK10020', name:'平川 翔', employmentType:'アルバイト', salaryType:'hourly', active:true, skillLevels:{meat:2,salad:1,drink:0,hall_grill:1,hall_basic:2,dish:3,closing:2,opening:1,register:1} },
  ].map(person => ({...person, skills:Object.entries(person.skillLevels).filter(([,lv])=>lv>0).map(([id])=>id)}));

  const shifts = {};
  shifts[today] = [
    { id:'demo_s1', staffId:'OKK10001', startStoreId:'kumoji', start:1050, end:1740, memo:'久茂地 17:30〜翌5:00' },
    { id:'demo_s2', staffId:'OKK10003', startStoreId:'matsuyama', start:1020, end:1800, memo:'' },
    { id:'demo_s3', staffId:'OKK10004', startStoreId:'miebashi', start:1080, end:1560, memo:'' },
    { id:'demo_s4', staffId:'OKK10005', startStoreId:'misato', start:1080, end:1560, memo:'' },
    { id:'demo_s5', staffId:'OKK10008', startStoreId:'kumoji', start:1110, end:1440, memo:'' },
    { id:'demo_s6', staffId:'OKK10009', startStoreId:'matsuyama', start:1200, end:1680, memo:'' },
  ];

  const exceptions = {};
  exceptions[today] = [
    { id:'demo_ex1', type:'absence', date:today, shiftId:'demo_s5', staffId:'OKK10008', startStoreId:'kumoji', note:'体調不良（デモ）', createdAt:new Date().toISOString(), createdBy:'プレビュー' },
    { id:'demo_ex2', type:'emergency_call', date:today, staffId:'OKK10012', startStoreId:'kumoji', start:1200, end:1500, note:'欠員補充（デモ）', createdAt:new Date().toISOString(), createdBy:'プレビュー' },
  ];

  if (!originalGetItem.call(localStorage, staffKey)) originalSetItem.call(localStorage, staffKey, JSON.stringify(staff));
  if (!originalGetItem.call(localStorage, configKey)) originalSetItem.call(localStorage, configKey, JSON.stringify(stores));
  if (!originalGetItem.call(localStorage, shiftsKey)) originalSetItem.call(localStorage, shiftsKey, JSON.stringify(shifts));
  if (!originalGetItem.call(localStorage, exceptionsKey)) originalSetItem.call(localStorage, exceptionsKey, JSON.stringify(exceptions));
  if (!originalGetItem.call(localStorage, auditKey)) originalSetItem.call(localStorage, auditKey, JSON.stringify([]));

  const ROLES = {
    hq: {
      label:'本部', staffId:null, staffName:'プレビュー本部',
      permissions:[
        'shift.plan.create','shift.plan.edit','shift.plan.confirm',
        'shift.exception.absence','shift.exception.emergency_call',
        'staff.skill.edit','staff.master.edit','store.master.edit','requirements.master.edit',
        'mf.export','shift.view.all'
      ]
    },
    managerQualified: {
      label:'店長資格保有者', staffId:'OKK10003', staffName:'又吉 健太',
      permissions:['shift.exception.absence','shift.exception.emergency_call','staff.skill.edit','shift.view.all']
    },
    employee: {
      label:'一般従業員', staffId:'OKK10008', staffName:'安里 茜 マーティン',
      permissions:['shift.view.own']
    }
  };

  let roleId = originalGetItem.call(localStorage, ROLE_KEY) || 'hq';
  if (!ROLES[roleId]) roleId = 'hq';
  const role = ROLES[roleId];
  const permissions = new Set(role.permissions);

  window.shiftV2User = { email:`${roleId}@preview.okk.local`, displayName:role.staffName };
  window.shiftV2IsAdmin = roleId === 'hq';
  window.shiftV2Cloud = null;
  window.shiftV2Login = async () => {};
  window.shiftV2Logout = async () => {};
  window.shiftV2Access = {
    roleId,
    roleLabel:`${role.label}（プレビュー）`,
    staffId:role.staffId,
    staffName:role.staffName,
    linked:true,
    authenticated:true,
    can: permission => permissions.has(permission),
    canAnyException: () => ['shift.exception.absence','shift.exception.emergency_call'].some(permission => permissions.has(permission)),
  };

  document.addEventListener('DOMContentLoaded', () => {
    installPreviewControls();
    installInteractionGuards();
    dispatchAccess();
    setTimeout(applyRoleUi, 50);
    setTimeout(applyRoleUi, 300);
    const app = document.querySelector('.app-shell');
    if (app) new MutationObserver(applyRoleUi).observe(app, { childList:true, subtree:true });
    const staffBody = document.getElementById('staff-view-body');
    if (staffBody) new MutationObserver(filterOwnRows).observe(staffBody, { childList:true, subtree:true });
  });

  function dispatchAccess() {
    document.dispatchEvent(new CustomEvent('shiftv2-auth', { detail:{ user:window.shiftV2User, admin:window.shiftV2IsAdmin, access:window.shiftV2Access } }));
    document.dispatchEvent(new CustomEvent('shiftv2-access', { detail:window.shiftV2Access }));
  }

  function installPreviewControls() {
    if (document.getElementById('preview-controls')) return;
    const banner = document.querySelector('.preview-banner');
    if (!banner) return;
    const controls = document.createElement('div');
    controls.id = 'preview-controls';
    controls.innerHTML = `
      <div class="preview-control-copy"><strong>表示権限を試す</strong><span>本番データには接続しません</span></div>
      <label>権限<select id="preview-role-select"><option value="hq" ${roleId==='hq'?'selected':''}>本部</option><option value="managerQualified" ${roleId==='managerQualified'?'selected':''}>店長資格保有者</option><option value="employee" ${roleId==='employee'?'selected':''}>一般従業員</option></select></label>
      <span id="preview-role-note"></span>
      <button id="preview-reset" type="button"><i class="fa-solid fa-rotate-left"></i> デモを初期状態へ</button>`;
    banner.insertAdjacentElement('afterend', controls);
    const style = document.createElement('style');
    style.textContent = `#preview-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 16px;background:#fff7ed;border-bottom:1px solid #fed7aa;color:#7c2d12;font-size:10px}#preview-controls .preview-control-copy strong{display:block;font-size:10px}#preview-controls .preview-control-copy span{display:block;color:#9a3412;font-size:8px}#preview-controls label{display:flex;align-items:center;gap:5px;font-weight:900}#preview-controls select{border:1px solid #fdba74;background:#fff;border-radius:7px;padding:5px 7px;font-size:10px;font-weight:800;color:#7c2d12}#preview-role-note{font-weight:900;color:#9a3412}#preview-reset{margin-left:auto;border:1px solid #fdba74;background:#fff;color:#9a3412;border-radius:7px;padding:6px 9px;font-size:9px;font-weight:900}body[data-preview-role="employee"] #staff-summary{display:none!important}@media(max-width:760px){#preview-reset{margin-left:0}}`;
    document.head.appendChild(style);
    document.getElementById('preview-role-select')?.addEventListener('change', event => { originalSetItem.call(localStorage, ROLE_KEY, event.target.value); window.location.reload(); });
    document.getElementById('preview-reset')?.addEventListener('click', () => {
      if (!window.confirm('プレビュー内で変更したシフト・当日対応・スキル・人員条件を初期状態へ戻します。よろしいですか？')) return;
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) { const key = localStorage.key(i); if (key?.startsWith(PREVIEW_PREFIX) && key !== ROLE_KEY) keys.push(key); }
      keys.forEach(key => originalRemoveItem.call(localStorage, key));
      window.location.reload();
    });
  }

  function installInteractionGuards() {
    document.addEventListener('pointerdown', event => { if (!permissions.has('shift.plan.edit') && event.target.closest('#view-planner .shift-bar')) block(event, '通常シフトの編集は本部のみです'); }, true);
    document.addEventListener('dragstart', event => { if (!permissions.has('shift.plan.edit') && event.target.closest('#staff-list .staff-card')) block(event, '通常シフトの追加は本部のみです'); }, true);
    document.addEventListener('click', event => {
      const target = event.target;
      if (!permissions.has('shift.plan.edit') && target.closest('#save-btn, #delete-shift')) return block(event, '通常シフトの編集は本部のみです');
      if (!permissions.has('store.master.edit') && target.closest('#settings-btn, #settings-save, #settings-reset')) return block(event, '店舗設定は本部のみです');
      if (!permissions.has('mf.export') && target.closest('#csv-download, #csv-refresh')) return block(event, 'MF CSVは本部のみです');
      const typeButton = target.closest('[data-exception-type]');
      if (typeButton && !canException(typeButton.dataset.exceptionType)) return block(event, 'この当日対応を登録する権限がありません');
    }, true);
    document.addEventListener('change', event => { if (!permissions.has('shift.plan.edit') && event.target.closest('#inspector #ins-store, #inspector #ins-start, #inspector #ins-end, #inspector #ins-memo')) block(event, '通常シフトの編集は本部のみです'); }, true);
  }

  function applyRoleUi() {
    document.body.dataset.previewRole = roleId;
    const login = document.getElementById('login-btn');
    if (login) { login.disabled = true; login.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${role.label}`; }
    const status = document.getElementById('sync-status');
    if (status) { status.textContent = '本番データ非接続'; status.style.color = '#fbbf24'; }
    const note = document.getElementById('preview-role-note');
    if (note) note.textContent = roleId==='hq' ? '通常シフト・人員条件まで編集可' : roleId==='managerQualified' ? '欠勤・臨時招集・スキルのみ編集可' : '自分のシフト閲覧のみ';
    setVisible(document.getElementById('save-btn'), permissions.has('shift.plan.edit'));
    setVisible(document.getElementById('settings-btn'), permissions.has('store.master.edit'));
    setVisible(document.querySelector('#view-planner .toolbar-right'), permissions.has('shift.plan.edit'));
    setVisible(document.querySelector('[data-view="csv"]'), permissions.has('mf.export'));
    setVisible(document.querySelector('[data-view="exceptions"]'), window.shiftV2Access.canAnyException());
    setVisible(document.querySelector('[data-view="skills"]'), permissions.has('staff.skill.edit'));
    setVisible(document.querySelector('[data-view="requirements"]'), roleId !== 'employee');
    document.querySelectorAll('#staff-list .staff-card').forEach(card => { if (!permissions.has('shift.plan.edit')) card.setAttribute('draggable','false'); });
    document.querySelectorAll('#gantt-canvas .handle').forEach(handle => { handle.style.display = permissions.has('shift.plan.edit') ? '' : 'none'; });
    document.querySelectorAll('#inspector input, #inspector select').forEach(control => { control.disabled = !permissions.has('shift.plan.edit'); });
    setVisible(document.getElementById('delete-shift'), permissions.has('shift.plan.edit'));
    if (roleId === 'employee') {
      ['planner','store','exceptions','csv','skills','requirements'].forEach(view => setVisible(document.querySelector(`[data-view="${view}"]`), false));
      activateStaffView(); filterOwnRows();
    }
  }

  function activateStaffView() { document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === 'staff')); document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === 'view-staff')); }
  function filterOwnRows() { if (roleId !== 'employee') return; const body = document.getElementById('staff-view-body'); if (!body) return; body.querySelectorAll('tr').forEach(row => { const cells=row.querySelectorAll('td'); if(cells.length<=1)return; row.style.display=String(cells[0]?.textContent||'').trim().toUpperCase()===String(role.staffId).toUpperCase()?'':'none'; }); }
  function canException(type) { const permission = type === 'absence' ? 'shift.exception.absence' : 'shift.exception.emergency_call'; return permissions.has(permission); }
  function setVisible(element, visible) { if (element) element.style.display = visible ? '' : 'none'; }
  function block(event, message) { event.preventDefault(); event.stopImmediatePropagation(); notify(message); }
  function notify(message) { const toast=document.getElementById('toast'); if(!toast)return; toast.textContent=message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),1800); }
  function dateKey(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,10); }
})();
