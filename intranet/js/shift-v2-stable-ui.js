(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const READINESS_KEY = 'okk_shift_v2_master_readiness_v1';
  const TAB_KEY = 'okk_shift_v2_rules_ui_tab';
  const STORE_KEY = 'okk_shift_v2_field_hearing_store';
  const STYLE_ID = 'shift-v2-stable-ui-style';
  const TABS_ID = 'stable-rules-tabs';
  const TOOLBAR_ID = 'stable-field-toolbar';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  let selectedStore = '';
  let currentTab = 'staff';
  let initialized = false;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    if (initialized) return;
    initialized = true;
    injectStyles();
    selectedStore = sessionStorage.getItem(STORE_KEY) || loadStores()[0]?.id || '';
    currentTab = normalizeTab(sessionStorage.getItem(TAB_KEY));
    bindGlobalEvents();
    refreshRulesUi();
  }

  function bindGlobalEvents() {
    document.addEventListener('click', event => {
      const mainRules = event.target.closest?.('[data-view="rules"]');
      if (mainRules) {
        setTimeout(refreshRulesUi, 50);
        return;
      }

      const tab = event.target.closest?.(`#${TABS_ID} [data-stable-tab]`);
      if (tab) {
        event.preventDefault();
        currentTab = normalizeTab(tab.dataset.stableTab);
        sessionStorage.setItem(TAB_KEY, currentTab);
        activateTab(currentTab);
        return;
      }

      if (event.target.closest?.('#rs-staff-body .rs-lv')) {
        setTimeout(() => {
          filterStaffRows();
          patchSummary();
          activateTab(currentTab);
        }, 40);
        return;
      }

      if (event.target.closest?.('#rs-add-skill,#rs-skill-list button,.rs-delete')) {
        setTimeout(refreshRulesUi, 80);
        return;
      }

      const confirm = event.target.closest?.('[data-stable-confirm]');
      if (confirm) {
        event.preventDefault();
        handleConfirm(confirm.dataset.stableConfirm);
        return;
      }

      const edit = event.target.closest?.('#gantt-canvas [data-select]');
      if (edit) {
        setTimeout(enhanceInspectorDelete, 20);
      }
    }, false);

    document.addEventListener('change', event => {
      if (event.target?.id === 'stable-store') {
        selectedStore = event.target.value || '';
        sessionStorage.setItem(STORE_KEY, selectedStore);
        syncRequirementStore();
        filterStaffRows();
        patchSummary();
        updateConfirmStatus();
        return;
      }
      if (event.target?.id === 'hrm-store' || event.target?.id === 'rs-store-filter') {
        setTimeout(() => activateTab(currentTab), 20);
      }
    }, false);

    document.addEventListener('click', event => {
      const deleteButton = event.target.closest?.('#delete-shift');
      if (!deleteButton) return;
      if (!window.confirm('この配置を削除しますか？')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function refreshRulesUi() {
    const view = document.getElementById('view-rules');
    if (!view) {
      setTimeout(refreshRulesUi, 80);
      return;
    }

    view.querySelector('.rs-steps')?.remove();
    view.querySelector('.rules-section-tabs')?.remove();
    view.querySelector('.rs-independent-tabs')?.remove();
    view.querySelector('#master-readiness-panel')?.classList.add('stable-hidden');

    patchHero(view);
    installTabs(view);
    installToolbar();
    patchHeadings();
    syncStoreUi();
    filterStaffRows();
    patchSummary();
    activateTab(currentTab);
    updateConfirmStatus();
  }

  function patchHero(view) {
    const title = view.querySelector('.rs-hero h2');
    const text = view.querySelector('.rs-hero p');
    if (title) title.textContent = '人員・スキル設定';
    if (text) text.textContent = '現場では「スタッフのスキル」→「必要人数」の2つだけ確認します。詳細設定は必要な時だけ使います。';
  }

  function installTabs(view) {
    if (document.getElementById(TABS_ID)) return;
    const nav = document.createElement('nav');
    nav.id = TABS_ID;
    nav.className = 'stable-rules-tabs';
    nav.innerHTML = `
      <button type="button" data-stable-tab="staff"><b>1</b><span><strong>スタッフのスキル</strong><small>人ごとのLvを確認</small></span></button>
      <button type="button" data-stable-tab="requirements"><b>2</b><span><strong>必要人数</strong><small>店舗・時間ごとの基準</small></span></button>
      <button type="button" data-stable-tab="skills" class="detail"><b><i class="fa-solid fa-gear"></i></b><span><strong>詳細設定</strong><small>スキル種類の追加・名称変更</small></span></button>`;
    const summary = document.getElementById('rs-summary');
    if (summary) summary.insertAdjacentElement('afterend', nav);
    else view.querySelector('.rs-hero')?.insertAdjacentElement('afterend', nav);
  }

  function installToolbar() {
    if (document.getElementById(TOOLBAR_ID)) return;
    const tabs = document.getElementById(TABS_ID);
    if (!tabs) return;
    const stores = loadStores();
    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;
    toolbar.className = 'stable-field-toolbar';
    toolbar.innerHTML = `
      <div class="stable-field-left">
        <label>対象店舗
          <select id="stable-store" class="control">
            ${stores.map(store => `<option value="${esc(store.id)}">${esc(store.name)}</option>`).join('')}
            <option value="">全店舗を見る</option>
          </select>
        </label>
        <div id="stable-staff-count"></div>
      </div>
      <div class="stable-confirm-area">
        <button type="button" data-stable-confirm="staff"><i class="fa-solid fa-user-check"></i><span>人員・スキル</span><b>未確認</b></button>
        <button type="button" data-stable-confirm="need"><i class="fa-solid fa-people-group"></i><span>必要人数</span><b>未確認</b></button>
      </div>`;
    tabs.insertAdjacentElement('afterend', toolbar);
  }

  function syncStoreUi() {
    const select = document.getElementById('stable-store');
    if (select) select.value = selectedStore;
    syncRequirementStore();
  }

  function syncRequirementStore() {
    if (!selectedStore) return;
    const hourly = document.getElementById('hrm-store');
    if (hourly && hourly.value !== selectedStore) {
      hourly.value = selectedStore;
      hourly.dispatchEvent(new Event('change', { bubbles:true }));
    }
    const legacy = document.getElementById('rs-store-filter');
    if (legacy && legacy.value !== selectedStore) {
      legacy.value = selectedStore;
      legacy.dispatchEvent(new Event('change', { bubbles:true }));
    }
  }

  function patchHeadings() {
    const staffTitle = document.querySelector('#rs-staff .rs-head h3');
    const staffHelp = document.querySelector('#rs-staff .rs-head small');
    const needTitle = document.querySelector('#rs-requirements .rs-head h3');
    if (staffTitle) staffTitle.textContent = '1. スタッフのスキル';
    if (staffHelp) staffHelp.textContent = '0 未経験 / 1 できる / 2 任せられる / 3 教えられる';
    if (needTitle) needTitle.textContent = '2. 店舗・時間ごとの必要人数';
  }

  function activateTab(key) {
    currentTab = normalizeTab(key);
    sessionStorage.setItem(TAB_KEY, currentTab);
    const nav = document.getElementById(TABS_ID);
    if (!nav) return;

    nav.querySelectorAll('[data-stable-tab]').forEach(button => {
      const active = button.dataset.stableTab === currentTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    ['staff','requirements','skills'].forEach(name => {
      const section = document.getElementById(`rs-${name}`);
      if (!section) return;
      const active = name === currentTab;
      section.hidden = !active;
      section.style.setProperty('display', active ? 'block' : 'none', 'important');
      section.style.setProperty('visibility', active ? 'visible' : 'hidden', 'important');
      section.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    if (currentTab === 'requirements') {
      syncRequirementStore();
      window.shiftV2SkillHourlyMatrix?.reload?.();
    }
  }

  function filterStaffRows() {
    const rows = document.querySelectorAll('#rs-staff-body tr[data-person]');
    const people = loadStaff();
    let visible = 0;
    let unset = 0;
    rows.forEach(row => {
      const person = people.find(item => sameId(item.id || item.employeeNumber, row.dataset.person));
      const matches = !selectedStore || matchesStore(person, selectedStore);
      row.classList.toggle('stable-store-hidden', !matches);
      if (!matches) return;
      visible += 1;
      const hasSkill = Object.values(person?.skillLevels || {}).some(value => Number(value) > 0);
      if (!hasSkill) unset += 1;
    });
    const count = document.getElementById('stable-staff-count');
    if (count) {
      const name = storeName(selectedStore) || '全店舗';
      count.innerHTML = `<strong>${esc(name)}</strong> ${visible}名${unset ? ` / <span>${unset}名 Lv未設定</span>` : ''}`;
    }
  }

  function patchSummary() {
    const node = document.getElementById('rs-summary');
    if (!node) return;
    const people = loadStaff().filter(person => !selectedStore || matchesStore(person, selectedStore));
    const skilled = people.filter(person => Object.values(person?.skillLevels || {}).some(value => Number(value) > 0)).length;
    const unset = Math.max(0, people.length - skilled);
    const requirements = loadRequirements().filter(rule => rule?.active !== false && (!selectedStore || String(rule.storeId || '') === String(selectedStore)));
    node.innerHTML = [
      metric('対象店舗', storeName(selectedStore) || '全店舗'),
      metric('対象スタッフ', `${people.length}名`),
      metric('Lv入力済', `${skilled}名`),
      metric('Lv未設定', `${unset}名`, unset ? '現場確認が必要' : '入力済み'),
      metric('必要人数設定', `${requirements.length}件`),
    ].join('');
  }

  function handleConfirm(type) {
    const s = readiness();
    if (type === 'staff') {
      s.staffSkillsConfirmed = !s.staffSkillsConfirmed;
    }
    if (type === 'need') {
      if (!selectedStore) {
        toast('必要人数は店舗を選んで、店舗ごとに確認してください。');
        return;
      }
      const set = new Set(s.staffingNeedConfirmedStores || []);
      if (set.has(selectedStore)) set.delete(selectedStore); else set.add(selectedStore);
      s.staffingNeedConfirmedStores = Array.from(set);
      s.staffingNeedConfirmed = allStoresConfirmed(s.staffingNeedConfirmedStores);
    }
    s.updatedAt = new Date().toISOString();
    localStorage.setItem(READINESS_KEY, JSON.stringify(s));
    updateConfirmStatus();
  }

  function updateConfirmStatus() {
    const s = readiness();
    const staff = document.querySelector('[data-stable-confirm="staff"]');
    if (staff) setConfirm(staff, s.staffSkillsConfirmed, '人員・スキル', s.staffSkillsConfirmed ? '確認済み' : '未確認');

    const need = document.querySelector('[data-stable-confirm="need"]');
    if (!need) return;
    const stores = loadStores();
    const confirmed = new Set(s.staffingNeedConfirmedStores || []);
    if (selectedStore) {
      const done = confirmed.has(selectedStore);
      need.disabled = false;
      setConfirm(need, done, `${storeName(selectedStore)} 必要人数`, done ? '確認済み' : '未確認');
    } else {
      const count = stores.filter(store => confirmed.has(String(store.id))).length;
      need.disabled = true;
      setConfirm(need, count === stores.length && stores.length > 0, '必要人数', `${count}/${stores.length}店舗`);
    }
  }

  function setConfirm(button, confirmed, label, status) {
    button.classList.toggle('confirmed', Boolean(confirmed));
    const labelNode = button.querySelector('span');
    const stateNode = button.querySelector('b');
    if (labelNode) labelNode.textContent = label;
    if (stateNode) stateNode.textContent = status;
  }

  function enhanceInspectorDelete() {
    const button = document.getElementById('delete-shift');
    const inspector = document.getElementById('inspector');
    if (!button || !inspector) return;
    button.classList.add('stable-inspector-delete');
    button.innerHTML = '<i class="fa-solid fa-trash"></i><span>配置を削除</span>';
    button.title = 'このスタッフのこの日の配置を削除';
    const form = inspector.querySelector('.form-grid');
    if (form && button.previousElementSibling !== form) form.insertAdjacentElement('afterend', button);
  }

  function readiness() {
    try {
      const value = JSON.parse(localStorage.getItem(READINESS_KEY)) || {};
      const stores = loadStores();
      let needStores = Array.isArray(value.staffingNeedConfirmedStores) ? value.staffingNeedConfirmedStores.map(String) : [];
      if (!needStores.length && value.staffingNeedConfirmed === true) needStores = stores.map(store => String(store.id));
      return {
        ...value,
        staffSkillsConfirmed:Boolean(value.staffSkillsConfirmed),
        staffingNeedConfirmed:Boolean(value.staffingNeedConfirmed),
        staffingNeedConfirmedStores:needStores,
      };
    } catch {
      return { staffSkillsConfirmed:false, staffingNeedConfirmed:false, staffingNeedConfirmedStores:[] };
    }
  }

  function allStoresConfirmed(ids) {
    const set = new Set((ids || []).map(String));
    const stores = loadStores();
    return Boolean(stores.length) && stores.every(store => set.has(String(store.id)));
  }

  function matchesStore(person, storeId) {
    if (!person) return false;
    const ids = [
      person.mainStoreId,
      ...(Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : []),
      ...(Array.isArray(person.placementStoreIds) ? person.placementStoreIds : []),
    ].filter(Boolean).map(String);
    return ids.includes(String(storeId));
  }

  function loadStaff() {
    try { const value = JSON.parse(localStorage.getItem(STAFF_KEY)); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  function loadRequirements() {
    try { const value = JSON.parse(localStorage.getItem(REQUIREMENTS_KEY)); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  function loadStores() {
    try {
      const value = JSON.parse(localStorage.getItem(STORES_KEY));
      if (Array.isArray(value) && value.length) return value;
    } catch {}
    return DEFAULT_STORES;
  }

  function storeName(id) {
    return loadStores().find(store => String(store.id) === String(id || ''))?.name || '';
  }

  function sameId(a,b) { return String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase(); }
  function normalizeTab(value) { return ['staff','requirements','skills'].includes(value) ? value : 'staff'; }
  function metric(label, value, sub='') { return `<div class="rs-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }

  function toast(message) {
    const node = document.getElementById('toast');
    if (node) {
      node.textContent = message;
      node.classList.add('show');
      setTimeout(() => node.classList.remove('show'), 2200);
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .stable-hidden{display:none!important}
      #${TABS_ID}{display:grid;grid-template-columns:1fr 1fr .7fr;gap:6px;margin:0 0 8px;padding:5px;background:#fff;border:1px solid #dde3ec;border-radius:11px}
      #${TABS_ID} button{display:flex;align-items:center;gap:9px;padding:10px 12px;border:0;border-radius:8px;background:transparent;color:#667085;text-align:left;cursor:pointer}
      #${TABS_ID} button:hover{background:#f8fafc;color:#344054}
      #${TABS_ID} button.active{background:#111827;color:#fff;box-shadow:0 2px 7px rgba(15,23,42,.14)}
      #${TABS_ID} button b{width:26px;height:26px;display:grid;place-items:center;flex:0 0 auto;border-radius:50%;background:#eef2f6;color:#344054;font-size:11px}
      #${TABS_ID} button.active b{background:#f59e0b;color:#111827}
      #${TABS_ID} button strong{display:block;font-size:11px}.stable-rules-tabs button small{display:block;margin-top:2px;font-size:9px;opacity:.75}
      #${TOOLBAR_ID}{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;padding:9px 10px;border:1px solid #e4e7ec;border-radius:10px;background:#fcfcfd}
      .stable-field-left{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:10px;color:#475467}.stable-field-left label{display:flex;align-items:center;gap:6px;font-weight:800}.stable-field-left #stable-staff-count strong{color:#101828}.stable-field-left #stable-staff-count span{color:#b54708;font-weight:800}
      .stable-confirm-area{display:flex;gap:6px}.stable-confirm-area button{display:flex;align-items:center;gap:6px;border:1px solid #d0d5dd;background:#fff;color:#475467;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer}.stable-confirm-area button b{font-size:8px;padding:2px 5px;border-radius:999px;background:#fffaeb;color:#b54708}.stable-confirm-area button.confirmed{background:#ecfdf3;border-color:#abefc6;color:#067647}.stable-confirm-area button.confirmed b{background:#d1fadf;color:#05603a}.stable-confirm-area button:disabled{opacity:.6;cursor:not-allowed}
      #rs-staff-body tr.stable-store-hidden{display:none!important}
      #inspector .stable-inspector-delete{display:flex;align-items:center;justify-content:center;gap:6px;width:auto!important;margin:10px 0 12px!important;padding:7px 10px!important;background:#fff!important;color:#b42318!important;border:1px solid #fecdca!important;border-radius:8px!important;font-size:10px!important;font-weight:800!important;box-shadow:none!important}
      #inspector .stable-inspector-delete:hover{background:#fef3f2!important;border-color:#fda29b!important}
      @media(max-width:900px){#${TABS_ID}{grid-template-columns:1fr}#${TOOLBAR_ID}{align-items:stretch;flex-direction:column}.stable-confirm-area{flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }
})();
