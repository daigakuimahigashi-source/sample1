(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';
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
    selectedStore = sessionStorage.getItem('okk_shift_v2_field_hearing_store') || '';
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
    patchHero(view);
    patchTabs(view);
    installToolbar(view);
    syncStoreControls();
    filterStaffRows();
    updateStatus();

    if (!localStorage.getItem(FIRST_OPEN_KEY)) {
      localStorage.setItem(FIRST_OPEN_KEY, '1');
      sessionStorage.setItem(TAB_KEY, 'staff');
      setTimeout(() => view.querySelector('[data-rs-tab="staff"]')?.click(), 0);
    }
  }

  function patchHero(view) {
    const hero = view.querySelector('.rs-hero');
    if (!hero || hero.dataset.fhPatched === '1') return;
    hero.dataset.fhPatched = '1';
    const title = hero.querySelector('h2');
    const text = hero.querySelector('p');
    if (title) title.textContent = '人員・スキル設定';
    if (text) text.textContent = '現場では「スタッフのスキル」→「必要人数」の2つだけ確認すればOKです。スキル項目の追加・名称変更は詳細設定から行います。';
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
            <option value="">全店舗</option>
            ${stores.map(store => `<option value="${esc(store.id)}">${esc(store.name)}</option>`).join('')}
          </select>
        </label>
        <div id="fh-visible-count" class="fh-visible-count"></div>
      </div>
      <div class="fh-confirm-area">
        <button type="button" class="fh-confirm" data-fh-confirm="staff"><i class="fa-solid fa-user-check"></i><span>人員・スキル</span><b>未確認</b></button>
        <button type="button" class="fh-confirm" data-fh-confirm="need"><i class="fa-solid fa-people-group"></i><span>必要人数</span><b>未確認</b></button>
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
      const storeName = loadStores().find(store => store.id === selectedStore)?.name || '全店舗';
      count.innerHTML = `<strong>${esc(storeName)}</strong> ${visible}名表示${unset ? ` / <span>${unset}名 Lv未設定</span>` : ''}`;
    }
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
  }

  function onClick(event) {
    const confirm = event.target.closest?.('[data-fh-confirm]');
    if (!confirm) return;
    const type = confirm.dataset.fhConfirm;
    const s = readiness();
    if (type === 'staff') s.staffSkillsConfirmed = !s.staffSkillsConfirmed;
    if (type === 'need') s.staffingNeedConfirmed = !s.staffingNeedConfirmed;
    s.updatedAt = new Date().toISOString();
    localStorage.setItem(READINESS_KEY, JSON.stringify(s));

    const mirror = document.getElementById(type === 'staff' ? 'mr-staff-skills' : 'mr-staffing-need');
    if (mirror) {
      mirror.checked = type === 'staff' ? s.staffSkillsConfirmed : s.staffingNeedConfirmed;
      mirror.dispatchEvent(new Event('change', { bubbles:true }));
    }
    updateStatus();
  }

  function updateStatus() {
    const s = readiness();
    document.querySelectorAll('[data-fh-confirm]').forEach(button => {
      const confirmed = button.dataset.fhConfirm === 'staff' ? s.staffSkillsConfirmed : s.staffingNeedConfirmed;
      button.classList.toggle('confirmed', confirmed);
      const stateNode = button.querySelector('b');
      if (stateNode) stateNode.textContent = confirmed ? '確認済み' : '未確認';
    });
  }

  function readiness() {
    try {
      const value = JSON.parse(localStorage.getItem(READINESS_KEY));
      return {
        staffSkillsConfirmed:Boolean(value?.staffSkillsConfirmed),
        staffingNeedConfirmed:Boolean(value?.staffingNeedConfirmed),
        updatedAt:value?.updatedAt || ''
      };
    } catch {
      return { staffSkillsConfirmed:false, staffingNeedConfirmed:false, updatedAt:'' };
    }
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

  function sameId(a,b) {
    return String(a || '').toUpperCase() === String(b || '').toUpperCase();
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-rules .field-hearing-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px;padding:10px 12px;background:#f8fafc;border:1px solid #dbe3ee;border-radius:10px}
      #view-rules .fh-left{display:flex;align-items:center;gap:12px;min-width:0;flex-wrap:wrap}.fh-title span{display:block;font-size:8px;font-weight:900;color:#667085;letter-spacing:.08em}.fh-title strong{display:block;font-size:11px;color:#101828;margin-top:1px}.fh-store-label{display:flex;align-items:center;gap:6px;font-size:9px;font-weight:900;color:#344054}.fh-store-label select{min-width:120px}.fh-visible-count{font-size:9px;color:#667085;font-weight:700}.fh-visible-count strong{color:#344054}.fh-visible-count span{color:#b54708}
      #view-rules .fh-confirm-area{display:flex;gap:6px;flex-wrap:wrap}.fh-confirm{display:flex;align-items:center;gap:5px;border:1px solid #d0d5dd;background:#fff;color:#475467;border-radius:8px;padding:7px 9px;cursor:pointer;font-size:9px;font-weight:800}.fh-confirm b{margin-left:2px;border-radius:999px;padding:2px 5px;background:#f2f4f7;color:#667085;font-size:8px}.fh-confirm.confirmed{border-color:#abefc6;background:#ecfdf3;color:#067647}.fh-confirm.confirmed b{background:#067647;color:#fff}
      #view-rules .rs-independent-tabs{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(160px,.55fr)!important}.rs-independent-tabs .fh-detail-tab{opacity:.78}.rs-independent-tabs .fh-detail-tab b{background:#f2f4f7!important;color:#667085!important}.rs-independent-tabs .fh-detail-tab.active{opacity:1}.rs-independent-tabs .fh-detail-tab.active b{background:#fff!important;color:#344054!important}
      #view-rules #rs-staff-body tr.fh-store-hidden{display:none!important}.fh-person-status{display:inline-block;margin-left:7px;border-radius:999px;padding:2px 5px;font-size:8px;font-weight:900;vertical-align:middle}.fh-person-status.set{background:#ecfdf3;color:#067647}.fh-person-status.unset{background:#fffaeb;color:#b54708}.fh-person-stores{display:block!important;margin-top:3px!important;font-size:8px!important;color:#98a2b3!important}
      #view-rules #rs-staff .rs-head small::after{content:'　クリックするたび Lv0→1→2→3→0';color:#667085;font-weight:700}
      @media(max-width:900px){#view-rules .field-hearing-toolbar{align-items:flex-start;flex-direction:column}#view-rules .rs-independent-tabs{grid-template-columns:1fr!important}.fh-confirm-area{width:100%}.fh-confirm{flex:1;justify-content:center}}
    `;
    document.head.appendChild(style);
  }
})();