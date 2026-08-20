(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const CLOUD_STAFF = 'staff';
  const CLOUD_SKILLS = 'shiftV2Skills';
  const CLOUD_REQUIREMENTS = 'shiftV2Requirements';
  const STYLE_ID = 'shift-v2-unified-master-style';
  let saveTimer = null;

  if (window.__shiftV2UnifiedMasterInstalled) return;
  window.__shiftV2UnifiedMasterInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    installNavigation();
    bindEvents();
    setTimeout(() => {
      installNavigation();
      showSection('employees', false);
    }, 180);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const nav = event.target.closest?.('[data-unified-master]');
      if (nav) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showSection(nav.dataset.unifiedMaster, true);
        return;
      }

      const manageSkills = event.target.closest?.('#master-manage-skills');
      if (manageSkills) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showSection('skills', true);
        return;
      }

      const mainMaster = event.target.closest?.('.tab[data-view="master"]');
      if (mainMaster) setTimeout(() => showSection('employees', false), 30);

      if (event.target.closest?.('#rs-requirements button,#rs-skills button,#requirements-body button,#skill-master-list button,#rs-add-skill,#add-requirement')) {
        scheduleCloudSave();
      }
    }, true);

    document.addEventListener('change', event => {
      if (event.target?.closest?.('#rs-requirements,#rs-skills,#requirements-body,#skill-master-list')) scheduleCloudSave();
    }, false);

    document.addEventListener('input', event => {
      if (event.target?.closest?.('#rs-requirements,#rs-skills,#requirements-body,#skill-master-list')) scheduleCloudSave();
    }, false);

    document.addEventListener('click', event => {
      const save = event.target.closest?.('#master-sync-cloud');
      if (!save) return;
      setTimeout(() => saveAllMasterData(true), 30);
    }, false);

    document.addEventListener('shiftv2-auth', () => setTimeout(hydrateMasterData, 300));
    document.addEventListener('shiftv2-cloud-ready', () => setTimeout(hydrateMasterData, 300));
  }

  function installNavigation() {
    const masterTab = document.querySelector('.tab[data-view="master"]');
    if (masterTab) masterTab.innerHTML = '<i class="fa-solid fa-database"></i> 従業員・店舗マスタ';

    const rulesTab = document.querySelector('.tab[data-view="rules"]');
    if (rulesTab) rulesTab.style.display = 'none';

    installNavFor(document.getElementById('view-master'));
    installNavFor(document.getElementById('view-rules'));

    const masterTitle = document.querySelector('#view-master .master-title');
    if (masterTitle) masterTitle.textContent = '従業員・店舗マスタ';
    const masterSub = document.querySelector('#view-master .master-sub');
    if (masterSub) masterSub.textContent = '従業員・A/B・スキル・店舗必要人数をここで一元管理します。';

    const rulesHeroTitle = document.querySelector('#view-rules .rs-hero h2');
    if (rulesHeroTitle) rulesHeroTitle.textContent = '従業員・店舗マスタ';
    const rulesHeroText = document.querySelector('#view-rules .rs-hero p');
    if (rulesHeroText) rulesHeroText.textContent = '店舗必要人数とスキル項目を、従業員マスタと同じクラウドデータとして管理します。';
  }

  function installNavFor(view) {
    if (!view || view.querySelector('.unified-master-nav')) return;
    const nav = document.createElement('div');
    nav.className = 'unified-master-nav card';
    nav.innerHTML = `
      <button type="button" data-unified-master="employees"><i class="fa-solid fa-users"></i><span>従業員</span></button>
      <button type="button" data-unified-master="requirements"><i class="fa-solid fa-people-group"></i><span>店舗必要人数</span></button>
      <button type="button" data-unified-master="skills"><i class="fa-solid fa-list-check"></i><span>スキル項目</span></button>`;
    const hero = view.querySelector('.master-hero,.rs-hero,.rules-hero');
    if (hero) hero.insertAdjacentElement('afterend', nav);
    else view.insertAdjacentElement('afterbegin', nav);
  }

  function showSection(section, userInitiated) {
    installNavigation();
    const masterView = document.getElementById('view-master');
    const rulesView = document.getElementById('view-rules');
    const masterTab = document.querySelector('.tab[data-view="master"]');
    if (!masterView || !rulesView) return;

    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab === masterTab));
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));

    if (section === 'employees') {
      masterView.classList.add('active');
      markNav(section);
      return;
    }

    rulesView.classList.add('active');
    const wanted = section === 'skills' ? 'skills' : 'requirements';
    sessionStorage.setItem('okk_shift_v2_rules_ui_tab', wanted);

    setTimeout(() => {
      installNavigation();
      const button = document.querySelector(`#stable-rules-tabs [data-stable-tab="${wanted}"]`);
      button?.click();
      hideRulesChrome(wanted);
      markNav(section);
    }, userInitiated ? 40 : 0);
  }

  function hideRulesChrome(wanted) {
    const tabs = document.getElementById('stable-rules-tabs');
    const toolbar = document.getElementById('stable-field-toolbar');
    if (tabs) tabs.style.display = 'none';
    if (toolbar) toolbar.style.display = wanted === 'requirements' ? '' : 'none';
    document.querySelectorAll('#view-rules #rules-save-cloud,#view-rules .rules-hero-actions,#view-rules [data-stable-confirm="staff"]').forEach(node => node.style.display = 'none');
  }

  function markNav(section) {
    document.querySelectorAll('.unified-master-nav [data-unified-master]').forEach(button => {
      button.classList.toggle('active', button.dataset.unifiedMaster === section);
    });
  }

  function scheduleCloudSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveAllMasterData(false), 450);
  }

  async function saveAllMasterData(showToast) {
    if (!window.shiftV2Cloud || !window.shiftV2User) return;
    if (window.shiftV2Access?.canEditHeadquarters?.() !== true) return;

    const staff = readArray(STAFF_KEY);
    const skills = readArray(SKILLS_KEY);
    const requirements = readArray(REQUIREMENTS_KEY);

    try {
      await Promise.all([
        window.shiftV2Cloud.set(CLOUD_STAFF, staff),
        window.shiftV2Cloud.set(CLOUD_SKILLS, skills),
        window.shiftV2Cloud.set(CLOUD_REQUIREMENTS, requirements),
      ]);
      if (showToast) toast('従業員・店舗マスタをクラウド保存しました');
    } catch (error) {
      console.warn('Unified master cloud save failed', error);
      toast('クラウド保存に失敗しました');
    }
  }

  async function hydrateMasterData() {
    if (!window.shiftV2Cloud || !window.shiftV2User) return;
    try {
      const [skills, requirements] = await Promise.all([
        window.shiftV2Cloud.get(CLOUD_SKILLS),
        window.shiftV2Cloud.get(CLOUD_REQUIREMENTS),
      ]);
      if (Array.isArray(skills)) localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
      if (Array.isArray(requirements)) localStorage.setItem(REQUIREMENTS_KEY, JSON.stringify(requirements));
      window.shiftV2RulesSafe?.reload?.();
      window.shiftV2RulesSafe?.renderAll?.();
    } catch (error) {
      console.warn('Unified master hydrate failed', error);
    }
  }

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 2000);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #work-plan-panel{display:none!important}
      .tab[data-view="rules"]{display:none!important}
      .unified-master-nav{display:flex;gap:6px;padding:7px;margin-bottom:8px;background:#fff}
      .unified-master-nav button{display:flex;align-items:center;justify-content:center;gap:6px;min-width:125px;height:36px;padding:0 13px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;color:#475467;font-size:10px;font-weight:900;cursor:pointer}
      .unified-master-nav button:hover{background:#f9fafb}
      .unified-master-nav button.active{background:#101828;border-color:#101828;color:#fff}
      #view-rules.active .rs-hero{margin-bottom:8px}
      #view-rules.active #stable-rules-tabs{display:none!important}
      #view-rules.active .rs-steps{display:none!important}
      #view-rules.active .rs-hero .btn-green,#view-rules.active #rules-save-cloud{display:none!important}
      @media(max-width:760px){.unified-master-nav{overflow-x:auto}.unified-master-nav button{min-width:115px;flex:0 0 auto}}
    `;
    document.head.appendChild(style);
  }
})();
