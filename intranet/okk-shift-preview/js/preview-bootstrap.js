(() => {
  'use strict';

  const SOURCE_PREFIX = 'okk_shift_v2_';
  const PREVIEW_PREFIX = 'okk_shift_preview_v1_';
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

  const permissions = new Set([
    'shift.plan.create','shift.plan.edit','shift.plan.confirm',
    'shift.exception.absence','shift.exception.emergency_call','shift.exception.support_move',
    'staff.skill.edit','staff.master.edit','store.master.edit','requirements.master.edit',
    'mf.export','shift.view.all'
  ]);

  window.shiftV2User = { email:'preview@okk.local', displayName:'プレビュー本部' };
  window.shiftV2IsAdmin = true;
  window.shiftV2Cloud = null;
  window.shiftV2Login = async () => {};
  window.shiftV2Logout = async () => {};
  window.shiftV2Access = {
    roleId:'hq', roleLabel:'本部（プレビュー）', staffId:null, staffName:'プレビュー本部', linked:true, authenticated:true,
    can: permission => permissions.has(permission),
    canAnyException: () => true,
  };

  document.addEventListener('DOMContentLoaded', () => {
    const login = document.getElementById('login-btn');
    if (login) { login.disabled = true; login.innerHTML = '<i class="fa-solid fa-shield-halved"></i> ローカルデモ'; }
    const status = document.getElementById('sync-status');
    if (status) { status.textContent = '本番データ非接続'; status.style.color = '#fbbf24'; }
    document.dispatchEvent(new CustomEvent('shiftv2-auth', { detail:{ user:window.shiftV2User, admin:true, access:window.shiftV2Access } }));
    document.dispatchEvent(new CustomEvent('shiftv2-access', { detail:window.shiftV2Access }));
  });

  function dateKey(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,10);
  }
})();
