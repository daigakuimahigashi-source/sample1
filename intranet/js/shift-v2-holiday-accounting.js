(() => {
  'use strict';

  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const STORES_KEY = 'okk_shift_v2_config';
  const DEMO_KEY = 'okk_shift_v2_demo_mode';
  const CLOUD_SHIFTS = 'shiftV2Shifts';
  const CLOUD_HOLIDAYS = 'shiftV2Holidays';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  let previewFn = null;
  let currentPreview = null;
  let currentMonth = '';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    previewFn = window.shiftV2MonthBuilderFinal?.preview;
    if (typeof previewFn !== 'function') return;
    takeover('month-builder-open', openModal);
    takeover('month-builder-calc', calculate);
    takeover('month-builder-month', calculate, 'change');
    takeover('month-builder-auto-off', calculate, 'change');
    takeover('month-builder-soft', calculate, 'change');
    takeover('month-builder-apply', applyPreview);
    window.shiftV2HolidayAccounting = { version:'1', preview:() => currentPreview };
  }

  function takeover(id, handler, eventName='click') {
    const node = document.getElementById(id);
    if (!node) return;
    const clone = node.cloneNode(true);
    node.replaceWith(clone);
    clone.addEventListener(eventName, handler);
  }

  function openModal() {
    const selected = document.getElementById('work-date')?.value;
    currentMonth = selected?.slice(0,7) || monthKey(new Date());
    const input = document.getElementById('month-builder-month');
    if (input) input.value = currentMonth;
    document.getElementById('month-builder-modal')?.classList.add('open');
    calculate();
  }

  function calculate() {
    currentMonth = document.getElementById('month-builder-month')?.value || currentMonth || monthKey(new Date());
    currentPreview = previewFn(currentMonth, {
      autoOff: document.getElementById('month-builder-auto-off')?.checked !== false,
      includeSoft: Boolean(document.getElementById('month-builder-soft')?.checked),
    });
    render(currentPreview);
  }

  function render(p) {
    const summary = document.getElementById('month-builder-summary');
    const body = document.getElementById('month-builder-body');
    const apply = document.getElementById('month-builder-apply');
    if (!summary || !body || !p) return;

    const scheduledOffWorkTotal = (p.people || []).reduce((sum,item) => sum + Number(item.emergency || 0), 0);
    summary.innerHTML = [
      metric('会社休業', `${p.closures?.length || 0}日`, '全社休業'),
      metric('公休予定', `${p.generatedOffCount || 0}日`, '正社員・月8休を設定'),
      metric('正社員 基礎配置', `${p.baseProposals?.length || 0}件`, '所定勤務日数'),
      metric('B臨時招集', `${p.bEmergencyCalls?.length || 0}件`, '公休勤務・必要時のみ'),
      metric('休日戻し候補', `${scheduledOffWorkTotal}日`, '年間休日管理で要調整'),
      metric('残る不足', `${p.shortages?.length || 0}件`, '要確認'),
    ].join('');

    const rows = (p.people || []).map(item => {
      const target = Number(item.targetShiftDays ?? Math.max(0, Number(item.prescribedDays || 0) - Number(item.paid || 0)));
      const plannedOff = Number(item.off || 0);
      const offWork = Number(item.emergency || 0);
      const actualRest = Math.max(0, plannedOff - offWork);
      const callText = item.plan === 'B' ? `${offWork}/${item.emergencyTarget ?? 2}` : '—';
      const placement = offWork > 0 ? `${target}所定 + ${offWork}臨時 = ${item.shifts}日` : `${item.shifts}/${target}日`;
      const warn = Number(item.overtimeMinutes || 0) > Number(item.allowedOvertimeHours || 0) * 60;
      return `<tr class="${warn ? 'danger' : Number(item.overtimeMinutes || 0) > 25*60 ? 'warn' : ''}"><td><strong>${esc(item.name)}</strong><small>${esc(item.staffId)} ${item.plan ? '・'+esc(item.plan)+'プラン' : ''}</small></td><td>${plannedOff}日</td><td>${offWork ? `<b>${offWork}日</b>` : '0日'}</td><td><b>${actualRest}日</b></td><td>${item.paid}</td><td>${item.prescribedDays}日</td><td><b>${placement}</b></td><td>${formatHours(item.overtimeMinutes)}h / ${item.allowedOvertimeHours}h</td><td><b>${callText}</b>${offWork ? `<small>休日戻し候補 ${offWork}日</small>` : ''}</td></tr>`;
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

    body.innerHTML = `${conflicts}${notes}<section class="month-builder-section"><h3>正社員 月間サマリー</h3><div class="month-table-wrap"><table class="month-table"><thead><tr><th>従業員</th><th>公休予定</th><th>公休勤務</th><th>実休見込</th><th>有休</th><th>所定日</th><th>配置内訳</th><th>予定時間外 / 許容</th><th>臨時招集</th></tr></thead><tbody>${rows || '<tr><td colspan="9">正社員がいません。</td></tr>'}</tbody></table></div></section><section class="month-builder-section"><h3>配置後も残る不足</h3><div class="month-shortages">${shortages || '<div class="month-all-clear"><i class="fa-solid fa-circle-check"></i> 対象ルールは充足しています。</div>'}</div></section><div class="month-builder-assumption"><strong>休日の数え方：</strong>「公休予定」は元々休みにした日、「公休勤務」はその日に臨時招集した日、「実休見込」は実際に休む予定の日数です。Bプランで公休勤務を入れた分は、年間105日の会社休日設計を維持するための「休日戻し候補」として別管理します。固定残業A25h/B45hは配置上限には使わず、30h社内ライン・承認済み例外・36協定設定を優先します。</div>`;

    if (apply) apply.disabled = (p.conflicts || []).some(item => ['company_closure','paid_leave','off'].includes(item.type));
  }

  async function applyPreview() {
    const p = currentPreview;
    if (!p) return;
    if ((p.conflicts || []).some(item => ['company_closure','paid_leave','off'].includes(item.type))) return window.alert('会社休業・公休・有休と既存シフトの重複があります。先に重複を解消してください。');
    const scheduledOffWorkTotal = (p.people || []).reduce((sum,item) => sum + Number(item.emergency || 0), 0);
    if (!window.confirm(`${p.month} の月間AUTOを反映します。\nB臨時招集 ${p.bEmergencyCalls?.length || 0}件 / 休日戻し候補 ${scheduledOffWorkTotal}日\n「公休予定」と「実休」は分けて管理します。`)) return;
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(p.shifts));
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(p.holiday));
    localStorage.setItem('okk_shift_v2_holiday_return_candidates', JSON.stringify(buildReturnCandidates(p)));
    if (localStorage.getItem(DEMO_KEY) !== '1' && window.shiftV2Cloud && window.shiftV2User) {
      try { await Promise.all([window.shiftV2Cloud.set(CLOUD_SHIFTS,p.shifts), window.shiftV2Cloud.set(CLOUD_HOLIDAYS,p.holiday)]); }
      catch (error) { console.warn('Holiday accounting save failed', error); }
    }
    sessionStorage.setItem('okk_shift_v2_month_restore_date', `${p.month}-01`);
    notify(`月間AUTO反映：休日戻し候補 ${scheduledOffWorkTotal}日`);
    document.getElementById('month-builder-modal')?.classList.remove('open');
    setTimeout(() => window.location.reload(),350);
  }

  function buildReturnCandidates(p) {
    return (p.people || []).filter(item => Number(item.emergency || 0) > 0).map(item => ({
      month:p.month,
      staffId:item.staffId,
      staffName:item.name,
      days:Number(item.emergency || 0),
      status:'pending',
      source:'b-plan-emergency-call',
      createdAt:new Date().toISOString(),
    }));
  }

  function loadStores() {
    const value = readJson(STORES_KEY, DEFAULT_STORES);
    return Array.isArray(value) && value.length ? value : DEFAULT_STORES;
  }
  function monthKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
  function fmtTime(total) { const v=Number(total),next=v>=1440,h=Math.floor(v/60)%24,m=v%60; return `${next?'翌':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function formatHours(minutes) { const h=Math.max(0,Number(minutes)||0)/60; return Number.isInteger(h)?String(h):h.toFixed(1); }
  function metric(label,value,sub) { return `<div class="month-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`; }
  function readArray(key) { const value=readJson(key,[]); return Array.isArray(value)?value:[]; }
  function readJson(key,fallback) { try{const value=JSON.parse(localStorage.getItem(key)); return value ?? JSON.parse(JSON.stringify(fallback));}catch{return JSON.parse(JSON.stringify(fallback));} }
  function esc(value) { return String(value??'').replace(/[&<>\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char])); }
  function notify(message) { const toast=document.getElementById('toast'); if(!toast)return window.alert(message); toast.textContent=message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2200); }
})();
