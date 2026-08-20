(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const CLOUD_STAFF = 'staff';
  const LEVEL_LABELS = ['未経験','できる','責任もってできる','教育できる'];
  const STYLE_ID = 'shift-v2-master-consolidation-style';
  const RULE_TAB_KEY = 'okk_shift_v2_rules_ui_tab';
  let masterObserver = null;
  let syncTimer = null;

  if (window.__shiftV2MasterConsolidationInstalled) return;
  window.__shiftV2MasterConsolidationInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    bindEvents();
    sessionStorage.setItem(RULE_TAB_KEY, 'requirements');
    setTimeout(() => { patchMaster(); patchRules(); }, 180);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const manage = event.target.closest?.('#master-manage-skills');
      if (manage) {
        event.preventDefault();
        document.querySelector('.tab[data-view="rules"]')?.click();
        setTimeout(() => {
          patchRules();
          document.querySelector('#stable-rules-tabs [data-stable-tab="skills"]')?.click();
        }, 100);
        return;
      }

      const skill = event.target.closest?.('[data-master-skill]');
      if (skill) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!requireEditor()) return;
        void cycleSkill(skill.dataset.personId, skill.dataset.masterSkill);
        return;
      }

      if (event.target.closest?.('.tab[data-view="master"]')) setTimeout(patchMaster, 80);
      if (event.target.closest?.('.tab[data-view="rules"]')) setTimeout(patchRules, 80);
    }, true);

    document.addEventListener('change', event => {
      const select = event.target.closest?.('[data-master-plan]');
      if (!select) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!requireEditor()) { patchMasterRows(); return; }
      void savePlan(select.dataset.masterPlan, select.value);
    }, true);

    document.addEventListener('shiftv2-access-changed', () => setTimeout(patchMaster, 30));
  }

  function patchMaster() {
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

    patchMasterHeader();
    patchMasterRows();

    const body = document.getElementById('master-body');
    if (body && !masterObserver) {
      masterObserver = new MutationObserver(() => {
        patchMasterHeader();
        patchMasterRows();
      });
      masterObserver.observe(body, { childList:true });
    }
  }

  function patchMasterHeader() {
    const row = document.querySelector('#view-master .master-table thead tr');
    if (!row) return;
    const cells = Array.from(row.children);
    if (cells.length < 4) return;

    row.querySelectorAll('.master-plan-head,.skill-head').forEach(node => node.remove());
    const current = Array.from(row.children);
    const employment = current[1];
    const placement = current[current.length - 1];

    const plan = document.createElement('th');
    plan.className = 'master-plan-head';
    plan.innerHTML = 'A/B<small>正社員</small>';
    employment.insertAdjacentElement('afterend', plan);

    activeSkills().forEach(skill => {
      const th = document.createElement('th');
      th.className = 'skill-head';
      th.textContent = skill.name;
      placement.insertAdjacentElement('beforebegin', th);
    });
  }

  function patchMasterRows() {
    const staff = staffList();
    const people = new Map(staff.map(person => [String(person.id || '').toUpperCase(), person]));
    const skills = activeSkills();

    document.querySelectorAll('#master-body tr[data-person-id]').forEach(row => {
      const id = String(row.dataset.personId || '').toUpperCase();
      const person = people.get(id);
      if (!person) return;

      row.querySelectorAll('.master-plan-cell,.skill-cell').forEach(node => node.remove());
      const cells = Array.from(row.children);
      if (cells.length < 4) return;
      const employment = cells[1];
      const placement = cells[cells.length - 1];

      const planCell = document.createElement('td');
      planCell.className = 'master-plan-cell';
      if (person.employmentType === '正社員') {
        planCell.innerHTML = `<select data-master-plan="${esc(person.id)}" aria-label="${esc(person.name || person.id)} A/Bプラン"><option value="">—</option><option value="A" ${person.workPlanId === 'A' ? 'selected' : ''}>A</option><option value="B" ${person.workPlanId === 'B' ? 'selected' : ''}>B</option></select>`;
      } else {
        planCell.innerHTML = '<span class="plan-na">—</span>';
      }
      employment.insertAdjacentElement('afterend', planCell);

      skills.forEach(skill => {
        const level = clamp(person.skillLevels?.[skill.id]);
        const td = document.createElement('td');
        td.className = 'skill-cell';
        td.innerHTML = `<button type="button" class="skill-level level-${level}" data-master-skill="${esc(skill.id)}" data-person-id="${esc(person.id)}" title="${esc(`${skill.name}: ${level} ${LEVEL_LABELS[level]}`)}"><b>${level}</b><span>${esc(LEVEL_LABELS[level])}</span></button>`;
        placement.insertAdjacentElement('beforebegin', td);
      });
    });

    const empty = document.querySelector('#master-body .master-empty');
    if (empty) empty.colSpan = 4 + skills.length + 1;
  }

  async function cycleSkill(personId, skillId) {
    const before = staffList();
    const next = clone(before);
    const person = next.find(item => sameId(item.id, personId));
    if (!person) return;
    if (!person.skillLevels || typeof person.skillLevels !== 'object') person.skillLevels = {};
    const current = clamp(person.skillLevels[skillId]);
    person.skillLevels[skillId] = (current + 1) % 4;
    person.skillUpdatedAt = new Date().toISOString();
    await persistStaff(next, before, `${person.name || person.id}：スキルLvを更新しました`);
  }

  async function savePlan(personId, value) {
    const before = staffList();
    const next = clone(before);
    const person = next.find(item => sameId(item.id, personId));
    if (!person || person.employmentType !== '正社員') return;
    person.workPlanId = ['A','B'].includes(value) ? value : '';
    person.workPlanUpdatedAt = new Date().toISOString();
    await persistStaff(next, before, `${person.name || person.id}：${person.workPlanId ? person.workPlanId + 'プラン' : 'プラン未設定'}に保存しました`);
  }

  async function persistStaff(next, before, message) {
    localStorage.setItem(STAFF_KEY, JSON.stringify(next));
    patchMasterRows();
    try {
      if (window.shiftV2Cloud && window.shiftV2User) await window.shiftV2Cloud.set(CLOUD_STAFF, next);
      notify(message);
      scheduleClosureSync();
    } catch (error) {
      localStorage.setItem(STAFF_KEY, JSON.stringify(before));
      patchMasterRows();
      console.warn('Employee master save failed', error);
      notify('クラウド保存に失敗したため変更を戻しました');
    }
  }

  function scheduleClosureSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (!window.shiftV2User) return;
      document.dispatchEvent(new CustomEvent('shiftv2-auth', { detail:{ user:window.shiftV2User, admin:Boolean(window.shiftV2IsAdmin) } }));
    }, 500);
  }

  function patchRules() {
    const view = document.getElementById('view-rules');
    if (!view) return;
    sessionStorage.setItem(RULE_TAB_KEY, 'requirements');

    const hero = view.querySelector('.rs-hero p');
    if (hero) hero.textContent = '必要人数とスキル項目を管理します。スタッフ別の習熟度は「従業員マスタ」で一元管理します。';

    const tabs = document.getElementById('stable-rules-tabs');
    if (tabs) {
      const staffTab = tabs.querySelector('[data-stable-tab="staff"]');
      staffTab?.remove();
      const requirements = tabs.querySelector('[data-stable-tab="requirements"]');
      if (requirements) {
        requirements.querySelector('b').textContent = '1';
        const strong = requirements.querySelector('strong');
        const small = requirements.querySelector('small');
        if (strong) strong.textContent = '必要人数';
        if (small) small.textContent = '店舗・時間ごとの基準';
      }
      const skills = tabs.querySelector('[data-stable-tab="skills"]');
      if (skills) {
        const strong = skills.querySelector('strong');
        const small = skills.querySelector('small');
        if (strong) strong.textContent = 'スキル項目管理';
        if (small) small.textContent = '追加・名称・順番・削除';
      }
      if (!tabs.querySelector('.active') || tabs.querySelector('[data-stable-tab="staff"].active')) requirements?.click();
    }

    const staffSection = document.getElementById('rs-staff');
    if (staffSection) staffSection.style.setProperty('display','none','important');
    document.querySelector('[data-stable-confirm="staff"]')?.remove();
    const staffCount = document.getElementById('stable-staff-count');
    if (staffCount) staffCount.style.display = 'none';
  }

  function activeSkills() {
    try {
      const list = JSON.parse(localStorage.getItem(SKILLS_KEY));
      return Array.isArray(list) ? list.filter(skill => skill && skill.active !== false) : [];
    } catch { return []; }
  }

  function staffList() {
    try {
      const list = JSON.parse(localStorage.getItem(STAFF_KEY));
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }

  function requireEditor() {
    if (window.shiftV2Access?.canEditHeadquarters?.() === true) return true;
    window.shiftV2Access?.assertEdit?.();
    return false;
  }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #work-plan-panel{display:none!important}
      #master-plan-guide{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:7px;border-top:1px solid #eaecf0;font-size:8px;color:#667085}
      #master-plan-guide>strong{color:#344054;font-size:9px}#master-plan-guide span{display:inline-flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid #eaecf0;border-radius:999px;padding:4px 7px}#master-plan-guide span b{font-size:10px;color:#101828}#master-plan-guide small{color:#98a2b3}
      .master-plan-head{min-width:60px}.master-plan-head small{display:block;font-size:7px;color:#98a2b3;font-weight:500;margin-top:2px}.master-plan-cell{text-align:center;min-width:60px}.master-plan-cell select{width:50px;height:28px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;font-weight:900;text-align:center}.master-plan-cell .plan-na{color:#98a2b3}
      #master-manage-skills{white-space:nowrap}
      #stable-rules-tabs{grid-template-columns:1fr 1fr!important}
    `;
    document.head.appendChild(style);
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0; }
  function sameId(a,b) { return String(a || '').toUpperCase() === String(b || '').toUpperCase(); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
})();
