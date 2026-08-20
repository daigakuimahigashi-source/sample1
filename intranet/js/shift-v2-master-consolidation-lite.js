(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const CLOUD_STAFF = 'staff';
  let saving = false;

  if (window.__shiftV2MasterConsolidationLiteInstalled) return;
  window.__shiftV2MasterConsolidationLiteInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    bind();
    setTimeout(patchStaticUi, 180);
  }

  function bind() {
    document.addEventListener('click', event => {
      const manage = event.target.closest?.('#master-manage-skills');
      if (manage) {
        event.preventDefault();
        event.stopImmediatePropagation();
        document.querySelector('[data-unified-master="skills"]')?.click();
        return;
      }

      const skill = event.target.closest?.('[data-master-skill]');
      if (!skill) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!canEdit()) return;
      void cycleSkill(skill.dataset.personId, skill.dataset.masterSkill);
    }, true);

    document.addEventListener('change', event => {
      const plan = event.target.closest?.('[data-master-plan]');
      if (!plan) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!canEdit()) return;
      void savePlan(plan.dataset.masterPlan, plan.value);
    }, true);

    document.addEventListener('shiftv2-access-changed', () => setTimeout(patchStaticUi, 30));
  }

  function patchStaticUi() {
    const view = document.getElementById('view-master');
    if (!view) return;
    const heroActions = view.querySelector('.master-import-actions');
    if (heroActions && !document.getElementById('master-manage-skills')) {
      const button = document.createElement('button');
      button.id = 'master-manage-skills';
      button.type = 'button';
      button.className = 'btn btn-light';
      button.innerHTML = '<i class="fa-solid fa-list-check"></i> スキル項目を管理';
      heroActions.insertAdjacentElement('afterbegin', button);
    }

    const toolbar = view.querySelector('.master-toolbar');
    if (toolbar && !document.getElementById('master-plan-guide')) {
      const guide = document.createElement('div');
      guide.id = 'master-plan-guide';
      guide.innerHTML = '<strong>A/Bプラン</strong><span><b>A</b> 固定残業25h</span><span><b>B</b> 固定残業45h・臨時招集目安2回/月</span><small>正社員のみ選択</small>';
      toolbar.appendChild(guide);
    }
  }

  async function cycleSkill(personId, skillId) {
    if (saving) return;
    const before = staffList();
    const next = clone(before);
    const person = next.find(item => sameId(item.id, personId));
    if (!person) return;
    if (!person.skillLevels || typeof person.skillLevels !== 'object') person.skillLevels = {};
    const current = clamp(person.skillLevels[skillId]);
    person.skillLevels[skillId] = (current + 1) % 4;
    person.skillUpdatedAt = new Date().toISOString();
    await persist(next, before, `${person.name || person.id}：スキルLvを更新しました`);
  }

  async function savePlan(personId, value) {
    if (saving) return;
    const before = staffList();
    const next = clone(before);
    const person = next.find(item => sameId(item.id, personId));
    if (!person || person.employmentType !== '正社員') return;
    person.workPlanId = ['A','B'].includes(value) ? value : '';
    person.workPlanUpdatedAt = new Date().toISOString();
    await persist(next, before, `${person.name || person.id}：${person.workPlanId || '未設定'}プランを保存しました`);
  }

  async function persist(next, before, message) {
    saving = true;
    localStorage.setItem(STAFF_KEY, JSON.stringify(next));
    document.dispatchEvent(new CustomEvent('shiftv2-master-data-changed'));
    try {
      if (window.shiftV2Cloud && window.shiftV2User) await window.shiftV2Cloud.set(CLOUD_STAFF, next);
      toast(message);
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));
    } catch (error) {
      localStorage.setItem(STAFF_KEY, JSON.stringify(before));
      console.warn('Employee master save failed', error);
      toast('クラウド保存に失敗したため変更を戻しました');
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));
    } finally {
      saving = false;
    }
  }

  function canEdit() {
    if (window.shiftV2Access?.canEditHeadquarters?.() === true) return true;
    window.shiftV2Access?.assertEdit?.();
    return false;
  }

  function staffList() {
    try {
      const list = JSON.parse(localStorage.getItem(STAFF_KEY));
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 1800);
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0; }
  function sameId(a,b) { return String(a || '').toUpperCase() === String(b || '').toUpperCase(); }
})();
