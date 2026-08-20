(() => {
  'use strict';

  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const CLOUD_SKILLS = 'shiftV2Skills';
  const CLOUD_REQUIREMENTS = 'shiftV2Requirements';
  const CLOUD_STAFF = 'staff';
  const STYLE_ID = 'shift-v2-skill-manager-controls-style';
  let draggedSkillId = '';
  let listObserver = null;

  if (window.__shiftV2SkillManagerControlsInstalled) return;
  window.__shiftV2SkillManagerControlsInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    bindEvents();
    setTimeout(attach, 150);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const move = event.target.closest?.('[data-skill-move]');
      if (move) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!requireEditor()) return;
        void moveSkill(move.dataset.skillId, move.dataset.skillMove === 'up' ? -1 : 1);
        return;
      }

      const remove = event.target.closest?.('[data-skill-delete]');
      if (remove) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!requireEditor()) return;
        void deleteSkill(remove.dataset.skillDelete);
        return;
      }

      if (event.target.closest?.('[data-view="rules"],#stable-rules-tabs [data-stable-tab="skills"],#rs-add-skill')) {
        setTimeout(attach, 100);
      }
    }, true);

    document.addEventListener('shiftv2-access-changed', () => setTimeout(decorate, 30));

    document.addEventListener('dragstart', event => {
      const handle = event.target.closest?.('[data-skill-drag]');
      const row = handle?.closest?.('#rs-skill-list [data-skill]');
      if (!handle || !row) return;
      if (!requireEditor()) {
        event.preventDefault();
        return;
      }
      draggedSkillId = row.dataset.skill || '';
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', draggedSkillId);
      row.classList.add('skill-dragging');
    }, true);

    document.addEventListener('dragend', event => {
      event.target.closest?.('#rs-skill-list [data-skill]')?.classList.remove('skill-dragging');
      document.querySelectorAll('#rs-skill-list .skill-drop-target').forEach(node => node.classList.remove('skill-drop-target'));
      draggedSkillId = '';
    }, true);

    document.addEventListener('dragover', event => {
      const row = event.target.closest?.('#rs-skill-list [data-skill]');
      if (!row || !draggedSkillId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('#rs-skill-list .skill-drop-target').forEach(node => node.classList.remove('skill-drop-target'));
      row.classList.add('skill-drop-target');
    }, true);

    document.addEventListener('drop', event => {
      const row = event.target.closest?.('#rs-skill-list [data-skill]');
      if (!row || !draggedSkillId) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!requireEditor()) return;
      const targetId = row.dataset.skill || '';
      document.querySelectorAll('#rs-skill-list .skill-drop-target').forEach(node => node.classList.remove('skill-drop-target'));
      if (targetId && targetId !== draggedSkillId) void reorderByDrop(draggedSkillId, targetId, event.clientY, row);
      draggedSkillId = '';
    }, true);
  }

  function attach() {
    const list = document.getElementById('rs-skill-list');
    if (!list) return;
    decorate();
    if (listObserver) listObserver.disconnect();
    listObserver = new MutationObserver(() => decorate());
    listObserver.observe(list, { childList:true });
  }

  function decorate() {
    const list = document.getElementById('rs-skill-list');
    if (!list) return;
    const rows = Array.from(list.querySelectorAll(':scope > [data-skill]'));
    rows.forEach((row, index) => {
      const skillId = row.dataset.skill || '';
      row.classList.add('skill-manager-row');
      row.draggable = false;

      let order = row.querySelector('.skill-order-actions');
      if (!order) {
        order = document.createElement('div');
        order.className = 'skill-order-actions';
        order.innerHTML = `
          <button type="button" class="skill-drag-handle" data-skill-drag="${esc(skillId)}" title="ドラッグして並び替え" draggable="true"><i class="fa-solid fa-grip-vertical"></i></button>
          <button type="button" data-skill-move="up" data-skill-id="${esc(skillId)}" title="上へ"><i class="fa-solid fa-chevron-up"></i></button>
          <button type="button" data-skill-move="down" data-skill-id="${esc(skillId)}" title="下へ"><i class="fa-solid fa-chevron-down"></i></button>`;
        row.insertAdjacentElement('afterbegin', order);
      }

      const drag = order.querySelector('[data-skill-drag]');
      if (drag) drag.draggable = true;

      let remove = row.querySelector('[data-skill-delete]');
      if (!remove) {
        remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'skill-delete-button';
        remove.dataset.skillDelete = skillId;
        remove.title = 'このスキルを削除';
        remove.innerHTML = '<i class="fa-solid fa-trash"></i> 削除';
        row.appendChild(remove);
      }

      const up = order.querySelector('[data-skill-move="up"]');
      const down = order.querySelector('[data-skill-move="down"]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === rows.length - 1;
      remove.disabled = false;
    });
  }

  function requireEditor() {
    if (window.shiftV2Access?.canEditHeadquarters?.() === true) return true;
    window.shiftV2Access?.assertEdit?.();
    return false;
  }

  async function moveSkill(skillId, delta) {
    const before = read(SKILLS_KEY, []);
    const index = before.findIndex(skill => same(skill.id, skillId));
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= before.length) return;
    const next = before.slice();
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    await saveSkills(next, before, 'スキルの順番を変更しました');
  }

  async function reorderByDrop(skillId, targetId, clientY, targetRow) {
    const before = read(SKILLS_KEY, []);
    const from = before.findIndex(skill => same(skill.id, skillId));
    let to = before.findIndex(skill => same(skill.id, targetId));
    if (from < 0 || to < 0) return;

    const next = before.slice();
    const [item] = next.splice(from, 1);
    to = next.findIndex(skill => same(skill.id, targetId));
    const rect = targetRow.getBoundingClientRect();
    if (clientY > rect.top + rect.height / 2) to += 1;
    next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
    if (next.map(skill => skill.id).join('|') === before.map(skill => skill.id).join('|')) return;
    await saveSkills(next, before, 'スキルの順番を変更しました');
  }

  async function saveSkills(next, before, message) {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(next));
    try {
      if (window.shiftV2Cloud && window.shiftV2User) await window.shiftV2Cloud.set(CLOUD_SKILLS, next);
    } catch (error) {
      localStorage.setItem(SKILLS_KEY, JSON.stringify(before));
      console.warn('Skill order save failed', error);
      refreshRules();
      notify('クラウド保存に失敗したため、並び順は変更していません');
      return;
    }
    refreshRules();
    notify(message);
  }

  async function deleteSkill(skillId) {
    const skillsBefore = read(SKILLS_KEY, []);
    const requirementsBefore = read(REQUIREMENTS_KEY, []);
    const staffBefore = read(STAFF_KEY, []);
    const skill = skillsBefore.find(item => same(item.id, skillId));
    if (!skill) return;

    const linkedRules = requirementsBefore.filter(rule => same(rule.skillId, skillId)).length;
    const linkedPeople = staffBefore.filter(person => Number(person?.skillLevels?.[skillId] || 0) > 0).length;
    const ok = window.confirm(
      `「${skill.name || skillId}」を削除します。\n\n` +
      `設定済み従業員：${linkedPeople}名\n` +
      `必要人数条件：${linkedRules}件\n\n` +
      '従業員の習熟度と必要人数条件の紐付けも削除します。よろしいですか？'
    );
    if (!ok) return;

    const skillsNext = skillsBefore.filter(item => !same(item.id, skillId));
    const requirementsNext = requirementsBefore.filter(rule => !same(rule.skillId, skillId));
    const staffNext = staffBefore.map(person => {
      const next = { ...person };
      if (next.skillLevels && typeof next.skillLevels === 'object') {
        next.skillLevels = { ...next.skillLevels };
        delete next.skillLevels[skillId];
      }
      if (Array.isArray(next.skills)) next.skills = next.skills.filter(name => String(name) !== String(skill.name || ''));
      return next;
    });

    localStorage.setItem(SKILLS_KEY, JSON.stringify(skillsNext));
    localStorage.setItem(REQUIREMENTS_KEY, JSON.stringify(requirementsNext));
    localStorage.setItem(STAFF_KEY, JSON.stringify(staffNext));

    try {
      if (window.shiftV2Cloud && window.shiftV2User) {
        await Promise.all([
          window.shiftV2Cloud.set(CLOUD_SKILLS, skillsNext),
          window.shiftV2Cloud.set(CLOUD_REQUIREMENTS, requirementsNext),
          window.shiftV2Cloud.set(CLOUD_STAFF, staffNext),
        ]);
      }
    } catch (error) {
      localStorage.setItem(SKILLS_KEY, JSON.stringify(skillsBefore));
      localStorage.setItem(REQUIREMENTS_KEY, JSON.stringify(requirementsBefore));
      localStorage.setItem(STAFF_KEY, JSON.stringify(staffBefore));
      console.warn('Skill delete save failed', error);
      refreshRules();
      notify('クラウド保存に失敗したため、削除していません');
      return;
    }

    refreshRules();
    notify(`「${skill.name || skillId}」を削除しました`);
  }

  function refreshRules() {
    try {
      window.shiftV2RulesSafe?.reload?.();
      window.shiftV2RulesSafe?.renderAll?.();
    } catch (error) {
      console.warn('Rules refresh failed', error);
    }
    setTimeout(() => {
      document.querySelector('#stable-rules-tabs [data-stable-tab="skills"]')?.click();
      attach();
    }, 40);
  }

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function same(a, b) { return String(a ?? '') === String(b ?? ''); }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #rs-skill-list .skill-manager-row{grid-template-columns:76px 76px minmax(180px,1fr) auto auto!important;gap:8px!important;align-items:center}
      #rs-skill-list .skill-order-actions{display:flex;align-items:center;gap:3px}
      #rs-skill-list .skill-order-actions button{display:grid;place-items:center;width:22px;height:28px;padding:0;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#475467;cursor:pointer}
      #rs-skill-list .skill-order-actions button:hover:not(:disabled){background:#f2f4f7;color:#101828}
      #rs-skill-list .skill-order-actions button:disabled{opacity:.22;cursor:default}
      #rs-skill-list .skill-drag-handle{cursor:grab!important}
      #rs-skill-list .skill-drag-handle:active{cursor:grabbing!important}
      #rs-skill-list .skill-dragging{opacity:.4}
      #rs-skill-list .skill-drop-target{background:#eff8ff!important;box-shadow:inset 0 0 0 2px #84caff}
      #rs-skill-list .skill-delete-button{border:1px solid #fecdca;background:#fff5f4;color:#b42318;border-radius:7px;padding:7px 10px;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}
      #rs-skill-list .skill-delete-button:hover{background:#fee4e2}
      @media(max-width:760px){#rs-skill-list .skill-manager-row{grid-template-columns:76px minmax(150px,1fr) auto!important}#rs-skill-list .rs-id{display:none}}
    `;
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
})();
