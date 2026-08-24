(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const CLOUD_STAFF = 'staff';
  const LEVEL_LABELS = ['未経験','サポートがあればできる','一人でできる','教育できる'];
  let cloudTimer = null;
  let cloudSaving = false;
  let pendingSnapshot = null;
  let pendingMessage = '';

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
      cycleSkill(skill);
    }, true);

    document.addEventListener('change', event => {
      const plan = event.target.closest?.('[data-master-plan]');
      if (!plan) return;
      event.stopImmediatePropagation();
      if (!canEdit()) return;
      updatePlanUi(plan);
      savePlan(plan.dataset.masterPlan, plan.value);
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

  function cycleSkill(button) {
    const personId = button.dataset.personId;
    const skillId = button.dataset.masterSkill;
    const next = staffList();
    const person = next.find(item => sameId(item.id, personId));
    if (!person) return;
    if (!person.skillLevels || typeof person.skillLevels !== 'object') person.skillLevels = {};
    const current = clamp(person.skillLevels[skillId]);
    const level = (current + 1) % 4;
    person.skillLevels[skillId] = level;
    person.skillUpdatedAt = new Date().toISOString();

    // 押したセルだけ即時更新。テーブル全体は描画し直さない。
    button.classList.remove('level-0','level-1','level-2','level-3');
    button.classList.add(`level-${level}`);
    const number = button.querySelector('b');
    const label = button.querySelector('span');
    if (number) number.textContent = String(level);
    if (label) label.textContent = LEVEL_LABELS[level];
    const skillName = String(button.title || '').split(':')[0];
    if (skillName) button.title = `${skillName}: ${level} ${LEVEL_LABELS[level]}`;

    persistLocalAndQueue(next, `${person.name || person.id}：スキルLvを更新しました`);
  }

  function savePlan(personId, value) {
    const next = staffList();
    const person = next.find(item => sameId(item.id, personId));
    if (!person || person.employmentType !== '正社員') return;
    person.workPlanId = ['A','B'].includes(value) ? value : '';
    person.workPlanUpdatedAt = new Date().toISOString();
    persistLocalAndQueue(next, `${person.name || person.id}：${person.workPlanId || '未設定'}プランを保存しました`);
  }

  function updatePlanUi(input) {
    const group = input.closest('.master-plan-radios');
    if (!group) return;
    group.querySelectorAll('input[data-master-plan]').forEach(node => {
      node.checked = node === input;
    });
    group.querySelectorAll('.plan-radio').forEach(label => {
      label.classList.toggle('selected', label.contains(input));
    });
  }

  function persistLocalAndQueue(next, message) {
    localStorage.setItem(STAFF_KEY, JSON.stringify(next));

    // 画面は既に対象セルだけ更新済み。全表の再描画イベントは発火しない。
    pendingSnapshot = clone(next);
    pendingMessage = message;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(flushCloud, 220);
  }

  async function flushCloud() {
    if (cloudSaving || !pendingSnapshot) return;
    if (!window.shiftV2Cloud || !window.shiftV2User) return;

    const snapshot = pendingSnapshot;
    const message = pendingMessage;
    pendingSnapshot = null;
    pendingMessage = '';
    cloudSaving = true;

    try {
      await window.shiftV2Cloud.set(CLOUD_STAFF, snapshot);
      if (!pendingSnapshot) toast(message);
    } catch (error) {
      console.warn('Employee master background save failed', error);
      toast('クラウド保存に失敗しました。もう一度変更してください');
    } finally {
      cloudSaving = false;
      if (pendingSnapshot) {
        clearTimeout(cloudTimer);
        cloudTimer = setTimeout(flushCloud, 80);
      }
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
