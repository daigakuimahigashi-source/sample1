(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const PLAN_KEY = 'okk_shift_v2_work_plans';
  const CLOUD_STAFF = 'staff';
  const CLOUD_PLANS = 'shiftV2WorkPlans';

  const DEFAULT_PLANS = {
    common: { operationalOvertimeCapHours: 30 },
    A: { id: 'A', name: 'Aプラン', fixedOvertimeHours: 25, emergencyCallTarget: 0 },
    B: { id: 'B', name: 'Bプラン', fixedOvertimeHours: 45, emergencyCallTarget: 2 },
  };

  const state = {
    plans: normalizePlans(loadJson(PLAN_KEY, DEFAULT_PLANS)),
    staff: loadStaff(),
    saving: false,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    injectPanel();
    observeMaster();
    render();
    document.addEventListener('shiftv2-auth', () => setTimeout(hydrateCloud, 250));
    setTimeout(hydrateCloud, 1000);
  }

  function injectPanel() {
    const master = document.getElementById('view-master');
    const summary = document.getElementById('master-summary');
    if (!master || !summary || document.getElementById('work-plan-panel')) return;
    const panel = document.createElement('section');
    panel.id = 'work-plan-panel';
    panel.className = 'card work-plan-panel';
    summary.insertAdjacentElement('afterend', panel);
  }

  function observeMaster() {
    const master = document.getElementById('view-master');
    if (!master) return;
    new MutationObserver(() => {
      if (!document.getElementById('work-plan-panel')) injectPanel();
      render();
    }).observe(master, { childList: true, subtree: true });
  }

  function render() {
    const panel = document.getElementById('work-plan-panel');
    if (!panel) return;
    state.staff = loadStaff();
    const fullTime = state.staff.filter(person => person.active !== false && person.employmentType === '正社員');
    const counts = {
      A: fullTime.filter(person => person.workPlanId === 'A').length,
      B: fullTime.filter(person => person.workPlanId === 'B').length,
      blank: fullTime.filter(person => !['A', 'B'].includes(person.workPlanId)).length,
    };

    panel.innerHTML = `
      <div class="work-plan-head">
        <div>
          <h2>正社員 A / B プラン</h2>
          <p>固定残業時間は給与設計上の属性として保持し、シフト作成上の「使い切る目標」にはしません。残業の運用目安・36協定チェックとは別管理です。</p>
        </div>
        <div class="work-plan-counts"><span>A ${counts.A}名</span><span>B ${counts.B}名</span>${counts.blank ? `<span class="warn">未設定 ${counts.blank}名</span>` : ''}</div>
      </div>

      <div class="work-plan-settings">
        ${planCard('A', state.plans.A)}
        ${planCard('B', state.plans.B)}
        <div class="work-plan-rule-card common">
          <strong>共通の社内運用目安</strong>
          <label>月の予定時間外を原則 <input type="number" min="0" max="45" step="1" data-common-cap value="${num(state.plans.common.operationalOvertimeCapHours, 30)}"> 時間以内</label>
          <small>固定残業25h/45hとは別。36協定の法的上限より手前で止めるための社内目安です。</small>
        </div>
      </div>

      <div class="work-plan-table-wrap">
        <table class="work-plan-table">
          <thead><tr><th>正社員</th><th class="plan-choice-head plan-a-col">A</th><th class="plan-choice-head plan-b-col">B</th><th>固定残業時間</th><th>臨時招集の月目安</th><th>運用上限</th></tr></thead>
          <tbody>${fullTime.map(person => personRow(person)).join('') || '<tr><td colspan="6" class="work-plan-empty">正社員データがありません。</td></tr>'}</tbody>
        </table>
      </div>
      <div class="work-plan-note"><i class="fa-solid fa-circle-info"></i> A / B はラジオ位置を縦に揃えているため、一覧でプラン分布を視覚的に確認できます。Bプランの「月2回」は不足時の臨時招集目安で、休日カレンダー上の公休日から候補を選びます。</div>
    `;

    panel.querySelectorAll('[data-plan-field]').forEach(input => input.addEventListener('change', onPlanDefinitionChange));
    panel.querySelector('[data-common-cap]')?.addEventListener('change', onCommonCapChange);
    panel.querySelectorAll('[data-person-plan]').forEach(input => input.addEventListener('change', onPersonPlanChange));
  }

  function planCard(id, plan) {
    return `<div class="work-plan-rule-card plan-${id.toLowerCase()}">
      <div class="plan-label"><b>${esc(id)}</b><strong>${esc(plan.name)}</strong></div>
      <label>固定残業 <input type="number" min="0" max="60" step="1" data-plan-field="fixedOvertimeHours" data-plan-id="${id}" value="${num(plan.fixedOvertimeHours, id === 'A' ? 25 : 45)}"> 時間</label>
      <label>臨時招集目安 <input type="number" min="0" max="10" step="1" data-plan-field="emergencyCallTarget" data-plan-id="${id}" value="${num(plan.emergencyCallTarget, id === 'B' ? 2 : 0)}"> 回/月</label>
    </div>`;
  }

  function personRow(person) {
    const plan = state.plans[person.workPlanId] || null;
    const group = `work-plan-${String(person.id || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return `<tr>
      <td><strong>${esc(person.name || person.id)}</strong><small>${esc(person.id || '')}</small></td>
      <td class="plan-choice-cell plan-a-col"><input class="work-plan-radio radio-a" type="radio" name="${esc(group)}" data-person-plan="${esc(person.id)}" value="A" aria-label="${esc(person.name || person.id)} Aプラン" ${person.workPlanId === 'A' ? 'checked' : ''}></td>
      <td class="plan-choice-cell plan-b-col"><input class="work-plan-radio radio-b" type="radio" name="${esc(group)}" data-person-plan="${esc(person.id)}" value="B" aria-label="${esc(person.name || person.id)} Bプラン" ${person.workPlanId === 'B' ? 'checked' : ''}></td>
      <td>${plan ? `${num(plan.fixedOvertimeHours, 0)}h` : '—'}</td>
      <td>${plan ? `${num(plan.emergencyCallTarget, 0)}回` : '—'}</td>
      <td>${num(state.plans.common.operationalOvertimeCapHours, 30)}h/月</td>
    </tr>`;
  }

  function onPlanDefinitionChange(event) {
    const id = event.target.dataset.planId;
    const field = event.target.dataset.planField;
    if (!state.plans[id] || !field) return;
    state.plans[id][field] = Math.max(0, Number(event.target.value) || 0);
    savePlans();
    render();
  }

  function onCommonCapChange(event) {
    state.plans.common.operationalOvertimeCapHours = Math.max(0, Math.min(45, Number(event.target.value) || 30));
    savePlans();
    render();
  }

  function onPersonPlanChange(event) {
    if (!event.target.checked) return;
    const id = String(event.target.dataset.personPlan || '').toUpperCase();
    const staff = loadStaff();
    const person = staff.find(item => String(item.id || '').toUpperCase() === id);
    if (!person) return;
    person.workPlanId = ['A', 'B'].includes(event.target.value) ? event.target.value : '';
    person.workPlanUpdatedAt = new Date().toISOString();
    localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
    state.staff = staff;
    saveCloudStaff(staff);
    render();
    notify(`${person.name || person.id}：${person.workPlanId ? person.workPlanId + 'プラン' : 'プラン未設定'} に変更しました`);
  }

  function savePlans() {
    localStorage.setItem(PLAN_KEY, JSON.stringify(state.plans));
    if (window.shiftV2Cloud && window.shiftV2User) {
      window.shiftV2Cloud.set(CLOUD_PLANS, state.plans).catch(error => console.warn('Work plan cloud save failed', error));
    }
  }

  function saveCloudStaff(staff) {
    if (!window.shiftV2Cloud || !window.shiftV2User) return;
    window.shiftV2Cloud.set(CLOUD_STAFF, staff).catch(error => console.warn('Work plan staff save failed', error));
  }

  async function hydrateCloud() {
    if (!window.shiftV2Cloud || !window.shiftV2User || state.saving) return;
    state.saving = true;
    try {
      const cloudPlans = await window.shiftV2Cloud.get(CLOUD_PLANS);
      if (cloudPlans && typeof cloudPlans === 'object' && cloudPlans.A && cloudPlans.B) {
        state.plans = normalizePlans(cloudPlans);
        localStorage.setItem(PLAN_KEY, JSON.stringify(state.plans));
      } else {
        await window.shiftV2Cloud.set(CLOUD_PLANS, state.plans);
      }
      render();
    } catch (error) {
      console.warn('Work plan cloud hydration failed', error);
    } finally {
      state.saving = false;
    }
  }

  function loadStaff() {
    const staff = loadJson(STAFF_KEY, []);
    return Array.isArray(staff) ? staff : [];
  }

  function normalizePlans(value) {
    const source = value && typeof value === 'object' ? value : DEFAULT_PLANS;
    return {
      common: { operationalOvertimeCapHours: num(source.common?.operationalOvertimeCapHours, 30) },
      A: { id: 'A', name: source.A?.name || 'Aプラン', fixedOvertimeHours: num(source.A?.fixedOvertimeHours, 25), emergencyCallTarget: num(source.A?.emergencyCallTarget, 0) },
      B: { id: 'B', name: source.B?.name || 'Bプラン', fixedOvertimeHours: num(source.B?.fixedOvertimeHours, 45), emergencyCallTarget: num(source.B?.emergencyCallTarget, 2) },
    };
  }

  function loadJson(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? clone(fallback); }
    catch { return clone(fallback); }
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function num(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[char])); }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function injectStyles() {
    if (document.getElementById('shift-v2-work-plan-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-work-plan-style';
    style.textContent = `
      .work-plan-panel{margin:0 0 10px;padding:0;overflow:hidden}.work-plan-head{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid #eaecf0}.work-plan-head h2{font-size:12px;margin:0;color:#344054}.work-plan-head p{font-size:8px;color:#667085;margin:3px 0 0;line-height:1.5}.work-plan-counts{display:flex;gap:5px;align-items:flex-start;flex-wrap:wrap}.work-plan-counts span{font-size:8px;font-weight:900;padding:4px 7px;border-radius:999px;background:#f2f4f7;color:#475467}.work-plan-counts .warn{background:#fffaeb;color:#b54708}.work-plan-settings{display:grid;grid-template-columns:1fr 1fr 1.35fr;gap:8px;padding:10px 12px;background:#fcfcfd;border-bottom:1px solid #eaecf0}.work-plan-rule-card{border:1px solid #e4e7ec;border-radius:9px;background:#fff;padding:9px;display:flex;flex-direction:column;gap:5px}.work-plan-rule-card.plan-a{border-left:3px solid #2e90fa}.work-plan-rule-card.plan-b{border-left:3px solid #12b76a}.work-plan-rule-card.common{border-left:3px solid #7f56d9}.plan-label{display:flex;align-items:center;gap:6px}.plan-label b{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:#f2f4f7}.plan-label strong,.work-plan-rule-card>strong{font-size:9px}.work-plan-rule-card label{font-size:8px;color:#475467;font-weight:800}.work-plan-rule-card input{width:55px;height:26px;border:1px solid #d0d5dd;border-radius:6px;padding:0 5px}.work-plan-rule-card small{font-size:7px;color:#667085;line-height:1.5}.work-plan-table-wrap{overflow:auto;max-height:300px}.work-plan-table{width:100%;border-collapse:collapse;font-size:9px}.work-plan-table th{position:sticky;top:0;background:#f8fafc;color:#475467;padding:7px;border-bottom:1px solid #e4e7ec}.work-plan-table td{padding:7px;border-bottom:1px solid #f2f4f7;text-align:center}.work-plan-table td:first-child{text-align:left}.work-plan-table td:first-child strong{display:block;font-size:9px}.work-plan-table td:first-child small{display:block;font-size:7px;color:#98a2b3}.work-plan-table .plan-choice-head{width:54px;font-size:10px;font-weight:900}.work-plan-table .plan-a-col{background:#f5faff}.work-plan-table .plan-b-col{background:#f3fdf7}.work-plan-table td.plan-choice-cell{padding:5px 7px}.work-plan-radio{width:17px;height:17px;margin:0;cursor:pointer;vertical-align:middle}.work-plan-radio.radio-a{accent-color:#2e90fa}.work-plan-radio.radio-b{accent-color:#12b76a}.work-plan-table tbody tr:hover td{background-image:linear-gradient(rgba(16,24,40,.025),rgba(16,24,40,.025))}.work-plan-table tbody tr:hover td.plan-a-col{background-color:#edf7ff}.work-plan-table tbody tr:hover td.plan-b-col{background-color:#ecfdf3}.work-plan-empty{padding:22px!important;color:#98a2b3}.work-plan-note{padding:8px 12px;background:#f8fafc;color:#667085;font-size:8px;line-height:1.55}.work-plan-note i{margin-right:4px}@media(max-width:900px){.work-plan-settings{grid-template-columns:1fr}.work-plan-head{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }
})();