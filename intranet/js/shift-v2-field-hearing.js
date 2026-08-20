(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const READINESS_KEY = 'okk_shift_v2_master_readiness_v1';
  const TAB_KEY = 'okk_shift_v2_rules_ui_tab';
  const FIRST_OPEN_KEY = 'okk_shift_v2_field_hearing_seen_v1';
  const STYLE_ID = 'shift-v2-field-hearing-style';
  const TOOLBAR_ID = 'field-hearing-toolbar';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  let selectedStore = '';
  let queued = false;
  let observer = null;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    const stores = loadStores();
    selectedStore = sessionStorage.getItem('okk_shift_v2_field_hearing_store') || stores[0]?.id || '';
    if (selectedStore) sessionStorage.setItem('okk_shift_v2_field_hearing_store', selectedStore);
    patch();
    observer = new MutationObserver(schedulePatch);
    observer.observe(document.body, { childList:true, subtree:true });
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
  }

  function schedulePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      observer?.disconnect();
      try { patch(); }
      finally { observer?.observe(document.body, { childList:true, subtree:true }); }
    });
  }

  function patch() {
    const view = document.getElementById('view-rules');
    if (!view) return;
    hideDuplicateMasterPanel(view);
    patchHero(view);
    patchTabs(view);
    patchSectionHeadings();
    installToolbar(view);
    syncStoreControls();
    filterStaffRows();
    patchSummary();
    updateStatus();

    if (!localStorage.getItem(FIRST_OPEN_KEY)) {
      localStorage.setItem(FIRST_OPEN_KEY, '1');
      sessionStorage.setItem(TAB_KEY, 'staff');
      setTimeout(() => view.querySelector('[data-rs-tab="staff"]')?.click(), 0);
    }
  }

  function hideDuplicateMasterPanel(view) {
    const panel = view.querySelector('#master-readiness-panel');
    if (panel) panel.classList.add('fh-hidden-master-panel');
  }

  function patchHero(view) {
    const hero = view.querySelector('.rs-hero');
    if (!hero) return;
    const title = hero.querySelector('h2');
    const text = hero.querySelector('p');
    if (title) title.textContent = '人員・スキル設定';
    if (text) text.textContent = '現場では「スタッフのスキル」→「必要人数」の2つだけ確認すればOKです。必要人数は店舗ごとに確認します。';
  }

  function patchTabs(view) {
    const tabs = view.querySelector('.rs-independent-tabs');
    if (!tabs) return;
    const staff = tabs.querySelector('[data-rs-tab="staff"]');
    const requirements = tabs.querySelector('[data-rs-tab="requirements"]');
    const skills = tabs.querySelector('[data-rs-tab="skills"]');
    if (!staff || !requirements || !skills) return;

    staff.innerHTML = '<b>1</b><span><strong>スタッフのスキル</strong><small>人ごとのLvを現場で確認</small></span>';
    requirements.innerHTML = '<b>2</b><span><strong>必要人数</strong><small>店舗・時間ごとの基準を確認</small></span>';
    skills.innerHTML = '<b><i class="fa-solid fa-gear"></i></b><span><strong>詳細設定</strong><small>スキル種類の追加・名称変更</small></span>';
    staff.classList.add('fh-primary-tab');
    requirements.classList.add('fh-primary-tab');
    skills.classList.add('fh-detail-tab');

    if (tabs.children[0] !== staff) tabs.append(staff, requirements, skills);
  }

  function patchSectionHeadings() {
    const staffTitle = document.querySelector('#rs-staff .rs-head h3');
    if (staffTitle) staffTitle.textContent = '1. スタッフのスキル';
    const requirementTitle = document.querySelector('#rs-requirements .rs-head h3');
    if (requirementTitle) requirementTitle.textContent = '2. 店舗・時間ごとの必要人数';
  }

  function installToolbar(view) {
    if (document.getElementById(TOOLBAR_ID)) return;
    const summary = document.getElementById('rs-summary');
    if (!summary) return;
    const stores = loadStores();
    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;
    toolbar.className = 'field-hearing-toolbar';
    toolbar.innerHTML = `
      <div class="fh-left">
        <div class="fh-title"><span>現場ヒアリング</span><strong>店舗を選んで、2ステップだけ確認</strong></div>
        <label class="fh-store-label">対象店舗
          <select id="fh-store" class="control">
            ${stores.map(store => `<option value="${esc(store.id)}">${esc(store.name)}</option>`).join('')}
            <option value="">全店舗を見る</option>
          </select>
        </label>
        <div id="fh-visible-count" class="fh-visible-count"></div>
      </div>
      <div class="fh-confirm-area">
        <button type="button" class="fh-confirm" data-fh-confirm="staff"><i class="fa-solid fa-user-check"></i><span>人員・スキル</span><b>未確認</b></button>
        <button type="button" class="fh-confirm" data-fh-confirm="need"><i class="fa-solid fa-people-group"></i><span id="fh-need-label">必要人数</span><b>未確認</b></button>
      </div>`;
    summary.insertAdjacentElement('afterend', toolbar);
    const select = document.getElementById('fh-store');
    if (select) select.value = selectedStore;
  }

  function syncStoreControls() {
    const select = document.getElementById('fh-store');
    if (select && select.value !== selectedStore) select.value = selectedStore;

    const hourly = document.getElementById('hrm-store');
    if (hourly && selectedStore && hourly.value !== selectedStore) {
      hourly.value = selectedStore;
      hourly.dispatchEvent(new Event('change', { bubbles:true }));
    }

    const legacy = document.getElementById('rs-store-filter');
    if (legacy && legacy.value !== selectedStore) {
      legacy.value = selectedStore;
      legacy.dispatchEvent(new Event('change', { bubbles:true }));
    }
  }

  function filterStaffRows() {
    const rows = document.querySelectorAll('#rs-staff-body tr[data-person]');
    if (!rows.length) return;
    const people = loadStaff();
    let visible = 0;
    let unset = 0;

    rows.forEach(row => {
      const person = people.find(item => sameId(item.id || item.employeeNumber, row.dataset.person));
      const matches = !selectedStore || matchesStore(person, selectedStore);
      row.classList.toggle('fh-store-hidden', !matches);
      if (!matches) return;
      visible += 1;
      const hasSkill = Object.values(person?.skillLevels || {}).some(value => Number(value) > 0);
      if (!hasSkill) unset += 1;
      decoratePersonCell(row, person, !hasSkill);
    });

    const count = document.getElementById('fh-visible-count');
    if (count) {
      const storeName = storeNameFor(selectedStore) || '全店舗';
      count.innerHTML = `<strong>${esc(storeName)}</strong> ${visible}名表示${unset ? ` / <span>${unset}名 Lv未設定</span>` : ''}`;
    }
  }

  function patchSummary() {
    const node = document.getElementById('rs-summary');
    if (!node) return;
    const people = loadStaff().filter(person => !selectedStore || matchesStore(person, selectedStore));
    const skilled = people.filter(person => Object.values(person?.skillLevels || {}).some(value => Number(value) > 0)).length;
    const unset = Math.max(0, people.length - skilled);
    const rules = loadRequirements().filter(rule => rule?.active !== false && (!selectedStore || String(rule.storeId || '') === String(selectedStore)));
    const storeName = storeNameFor(selectedStore) || '全店舗';
    node.innerHTML = [
      metric('対象店舗', storeName),
      metric('対象スタッフ', `${people.length}名`),
      metric('Lv入力済', `${skilled}名`),
      metric('Lv未設定', `${unset}名`, unset ? '現場確認が必要' : '入力済み'),
      metric('必要人数設定', `${rules.length}件`),
    ].join('');
  }

  function decoratePersonCell(row, person, unset) {
    const cell = row.querySelector('td:first-child');
    if (!cell) return;
    let badge = cell.querySelector('.fh-person-status');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'fh-person-status';
      cell.appendChild(badge);
    }
    badge.textContent = unset ? 'Lv未設定' : '入力あり';
    badge.classList.toggle('unset', unset);
    badge.classList.toggle('set', !unset);

    let stores = cell.querySelector('.fh-person-stores');
    if (!stores) {
      stores = document.createElement('small');
      stores.className = 'fh-person-stores';
      cell.appendChild(stores);
    }
    const names = placementStoreNames(person);
    stores.textContent = names.length ? `対象：${names.join(' / ')}` : '';
  }

  function onChange(event) {
    if (event.target?.id !== 'fh-store') return;
    selectedStore = event.target.value || '';
    sessionStorage.setItem('okk_shift_v2_field_hearing_store', selectedStore);
    syncStoreControls();
    filterStaffRows();
    patchSummary();
    updateStatus();
  }

  function onClick(event) {
    const confirm = event.target.closest?.('[data-fh-confirm]');
    if (!confirm) return;
    const type = confirm.dataset.fhConfirm;
    const s = readiness();

    if (type === 'staff') {
      s.staffSkillsConfirmed = !s.staffSkillsConfirmed;
    }

    if (type === 'need') {
      if (!selectedStore) {
        showToast('必要人数は店舗を選んで、店舗ごとに確認してください。');
        return;
      }
      const confirmed = new Set(s.staffingNeedConfirmedStores || []);
      if (confirmed.has(selectedStore)) confirmed.delete(selectedStore);
      else confirmed.add(selectedStore);
      s.staffingNeedConfirmedStores = Array.from(confirmed);
      s.staffingNeedConfirmed = allStoresConfirmed(s.staffingNeedConfirmedStores);
    }

    s.updatedAt = new Date().toISOString();
    localStorage.setItem(READINESS_KEY, JSON.stringify(s));

    const staffMirror = document.getElementById('mr-staff-skills');
    const needMirror = document.getElementById('mr-staffing-need');
    if (staffMirror) staffMirror.checked = s.staffSkillsConfirmed;
    if (needMirror) needMirror.checked = s.staffingNeedConfirmed;
    updateStatus();
  }

  function updateStatus() {
    const s = readiness();
    const stores = loadStores();
    const confirmedStores = new Set(s.staffingNeedConfirmedStores || []);

    const staffButton = document.querySelector('[data-fh-confirm="staff"]');
    if (staffButton) setConfirmButton(staffButton, s.staffSkillsConfirmed, '人員・スキル', s.staffSkillsConfirmed ? '確認済み' : '未確認');

    const needButton = document.querySelector('[data-fh-confirm="need"]');
    if (needButton) {
      if (selectedStore) {
        const confirmed = confirmedStores.has(selectedStore);
        setConfirmButton(needButton, confirmed, `${storeNameFor(selectedStore)} 必要人数`, confirmed ? '確認済み' : '未確認');
        needButton.disabled = false;
      } else {
        const count = stores.filter(store => confirmedStores.has(String(store.id))).length;
        setConfirmButton(needButton, count === stores.length && stores.length > 0, '必要人数', `${count}/${stores.length}店舗`);
        needButton.disabled = true;
      }
    }
  }

  function setConfirmButton(button, confirmed, label, status) {
    button.classList.toggle('confirmed', Boolean(confirmed));
    const labelNode = button.querySelector('span');
    const stateNode = button.querySelector('b');
    if (labelNode) labelNode.textContent = label;
    if (stateNode) stateNode.textContent = status;
  }

  function readiness() {
    try {
      const value = JSON.parse(localStorage.getItem(READINESS_KEY));
      const stores = loadStores();
      let confirmedStores = Array.isArray(value?.staffingNeedConfirmedStores) ? value.staffingNeedConfirmedStores.map(String) : [];
      if (!confirmedStores.length && value?.staffingNeedConfirmed === true) confirmedStores = stores.map(store => String(store.id));
      return {
        staffSkillsConfirmed:Boolean(value?.staffSkillsConfirmed),
        staffingNeedConfirmed:Boolean(value?.staffingNeedConfirmed),
        staffingNeedConfirmedStores:confirmedStores,
        updatedAt:value?.updatedAt || ''
      };
    } catch {
      return { staffSkillsConfirmed:false, staffingNeedConfirmed:false, staffingNeedConfirmedStores:[], updatedAt:'' };
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

  function placementStoreNames(person) {
    if (!person) return [];
    const ids = Array.from(new Set([
      person.mainStoreId,
      ...(Array.isArray(person.placementStoreIds) ? person.placementStoreIds : []),
    ].filter(Boolean).map(String)));
    const stores = loadStores();
    return ids.map(id => stores.find(store => String(store.id) === id)?.name || id);
  }

  function storeNameFor(id) {
    return loadStores().find(store => String(store.id) === String(id || ''))?.name || '';
  }

  function loadStores() {
    try {
      const value = JSON.parse(localStorage.getItem(STORES_KEY));
      if (Array.isArray(value) && value.length) return value;
    } catch {}
    return DEFAULT_STORES;
  }

  function loadStaff() {
    try {
      const value = JSON.parse(localStorage.getItem(STAFF_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function loadRequirements() {
    try {
      const value = JSON.parse(localStorage.getItem(REQUIREMENTS_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function metric(label, value, sub = '') {
    return `<div class="rs-summary-card"><small>${esc(label)}</small><strong>${esc(value)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  }

  function sameId(a,b) {
    return String(a || '').toUpperCase() === String(b || '').toUpperCase();
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    } else {
      window.alert(message);
    }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-rules #master-readiness-panel.fh-hidden-master-panel{display:none!important}
      #view-rules .field-hearing-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px;padding:10px 12px;background:#f8fafc;border:1px solid #dbe3ee;border-radius:10px}
      #view-rules .fh-left{display:flex;align-items:center;gap:12px;min-width:0;flex-wrap:wrap}.fh-title span{display:block;font-size:8px;font-weight:900;color:#667085;letter-spacing:.08em}.fh-title strong{display:block;font-size:11px;color:#101828;margin-top:1px}.fh-store-label{display:flex;align-items:center;gap:6px;font-size:9px;font-weight:900;color:#344054}.fh-store-label select{min-width:130px}.fh-visible-count{font-size:9px;color:#667085;font-weight:700}.fh-visible-count strong{color:#344054}.fh-visible-count span{color:#b54708}
      #view-rules .fh-confirm-area{display:flex;gap:6px;flex-wrap:wrap}.fh-confirm{display:flex;align-items:center;gap:5px;border:1px solid #d0d5dd;background:#fff;color:#475467;border-radius:8px;padding:7px 9px;cursor:pointer;font-size:9px;font-weight:800}.fh-confirm b{margin-left:2px;border-radius:999px;padding:2px 5px;background:#f2f4f7;color:#667085;font-size:8px}.fh-confirm.confirmed{border-color:#abefc6;background:#ecfdf3;color:#067647}.fh-confirm.confirmed b{background:#067647;color:#fff}.fh-confirm:disabled{opacity:.72;cursor:default}
      #view-rules .rs-independent-tabs{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(160px,.55fr)!important}.rs-independent-tabs .fh-detail-tab{opacity:.78}.rs-independent-tabs .fh-detail-tab b{background:#f2f4f7!important;color:#667085!important}.rs-independent-tabs .fh-detail-tab.active{opacity:1}.rs-independent-tabs .fh-detail-tab.active b{background:#fff!important;color:#344054!important}
      #view-rules #rs-staff-body tr.fh-store-hidden{display:none!important}.fh-person-status{display:inline-block;margin-left:7px;border-radius:999px;padding:2px 5px;font-size:8px;font-weight:900;vertical-align:middle}.fh-person-status.set{background:#ecfdf3;color:#067647}.fh-person-status.unset{background:#fffaeb;color:#b54708}.fh-person-stores{display:block!important;margin-top:3px!important;font-size:8px!important;color:#98a2b3!important}
      #view-rules #rs-staff .rs-head small::after{content:'　クリックするたび Lv0→1→2→3→0';color:#667085;font-weight:700}
      #view-rules #rs-summary{grid-template-columns:repeat(5,minmax(0,1fr))!important}.rs-summary-card{background:#fff;border:1px solid #dde3ec;border-radius:10px;padding:10px 12px}.rs-summary-card small{display:block;font-size:8px;color:#667085;font-weight:700}.rs-summary-card strong{display:block;margin-top:2px;font-size:17px;color:#101828}.rs-summary-card span{display:block;margin-top:2px;font-size:8px;color:#b54708;font-weight:700}
      @media(max-width:900px){#view-rules .field-hearing-toolbar{align-items:flex-start;flex-direction:column}#view-rules .rs-independent-tabs{grid-template-columns:1fr!important}.fh-confirm-area{width:100%}.fh-confirm{flex:1;justify-content:center}#view-rules #rs-summary{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    `;
    document.head.appendChild(style);
  }
})();