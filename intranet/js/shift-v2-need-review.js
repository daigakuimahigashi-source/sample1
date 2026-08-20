(() => {
  'use strict';

  const READINESS_KEY = 'okk_shift_v2_master_readiness_v1';
  const STORES_KEY = 'okk_shift_v2_config';
  const STORE_KEY = 'okk_shift_v2_field_hearing_store';
  const PANEL_ID = 'need-review-panel';
  const STYLE_ID = 'shift-v2-need-review-style';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  if (window.__shiftV2NeedReviewInstalled) return;
  window.__shiftV2NeedReviewInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    bindEvents();
    setTimeout(refresh, 140);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const rules = event.target.closest?.('[data-view="rules"]');
      if (rules) {
        setTimeout(refresh, 120);
        return;
      }

      const tab = event.target.closest?.('#stable-rules-tabs [data-stable-tab]');
      if (tab) {
        setTimeout(refresh, 50);
        return;
      }

      const storeChip = event.target.closest?.('[data-need-store]');
      if (storeChip) {
        event.preventDefault();
        const select = document.getElementById('stable-store');
        if (!select) return;
        select.value = storeChip.dataset.needStore || '';
        select.dispatchEvent(new Event('change', { bubbles:true }));
        setTimeout(refresh, 30);
        return;
      }

      const confirm = event.target.closest?.('[data-stable-confirm="need"]');
      if (confirm) {
        // stable-ui が先に確認状態を保存するので、その直後に見た目を同期する。
        setTimeout(refresh, 0);
      }
    }, false);

    document.addEventListener('change', event => {
      if (event.target?.id === 'stable-store') {
        setTimeout(refresh, 30);
        return;
      }

      const cell = event.target?.closest?.('.hrm-cell');
      if (cell) {
        const storeId = currentStore();
        if (storeId) clearConfirmedStore(storeId);
        setTimeout(refresh, 0);
        setTimeout(refresh, 80);
      }
    }, false);
  }

  function refresh() {
    const section = document.getElementById('rs-requirements');
    if (!section) return;

    patchHeading(section);
    hideDuplicateStoreSelector(section);
    installPanel(section);
    updatePanel();
    updateConfirmButton();
    updateAllStoreMode(section);
  }

  function patchHeading(section) {
    const title = section.querySelector('.rs-head h3');
    const help = section.querySelector('.rs-head small');
    if (title) title.textContent = '2. 店舗・時間ごとの必要人数';
    if (help) help.textContent = '各セルはその1時間に必要な人員換算です。変更後は店舗ごとに内容を確認してください。';

    const toolbarHelp = section.querySelector('.hrm-toolbar > span');
    if (toolbarHelp) toolbarHelp.textContent = '店舗は上の「対象店舗」で切り替えます。0.5人単位で入力すると自動保存されます。';
  }

  function hideDuplicateStoreSelector(section) {
    const select = section.querySelector('#hrm-store');
    const label = select?.closest('label');
    if (label) label.classList.add('need-review-hidden-store-select');
  }

  function installPanel(section) {
    if (document.getElementById(PANEL_ID)) return;
    const toolbar = section.querySelector('.hrm-toolbar');
    if (!toolbar) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'need-review-panel';
    panel.innerHTML = `
      <div class="need-review-top">
        <div><strong>必要人数の確認状況</strong><span id="need-review-progress"></span></div>
        <small>数字を変更した店舗は、自動で未確認に戻ります。</small>
      </div>
      <div id="need-review-stores" class="need-review-stores"></div>
      <div id="need-review-all-note" class="need-review-all-note">店舗を選ぶと、その店舗の必要人数を編集できます。</div>`;
    toolbar.insertAdjacentElement('afterend', panel);
  }

  function updatePanel() {
    const stores = loadStores();
    const state = readiness();
    const confirmed = new Set((state.staffingNeedConfirmedStores || []).map(String));
    const selected = currentStore();
    const count = stores.filter(store => confirmed.has(String(store.id))).length;

    const progress = document.getElementById('need-review-progress');
    if (progress) progress.textContent = `${count}/${stores.length}店舗 確認済み`;

    const wrap = document.getElementById('need-review-stores');
    if (wrap) {
      wrap.innerHTML = stores.map(store => {
        const id = String(store.id);
        const done = confirmed.has(id);
        const active = selected === id;
        return `<button type="button" data-need-store="${esc(id)}" class="need-review-store ${done ? 'confirmed' : ''} ${active ? 'active' : ''}"><span>${esc(store.name)}</span><b>${done ? '確認済み' : '未確認'}</b></button>`;
      }).join('');
    }
  }

  function updateConfirmButton() {
    const button = document.querySelector('[data-stable-confirm="need"]');
    if (!button) return;

    const stores = loadStores();
    const state = readiness();
    const confirmed = new Set((state.staffingNeedConfirmedStores || []).map(String));
    const selected = currentStore();
    const label = button.querySelector('span');
    const status = button.querySelector('b');

    if (!selected) {
      const count = stores.filter(store => confirmed.has(String(store.id))).length;
      button.disabled = true;
      button.classList.toggle('confirmed', stores.length > 0 && count === stores.length);
      if (label) label.textContent = '必要人数';
      if (status) status.textContent = `${count}/${stores.length}店舗`;
      return;
    }

    const done = confirmed.has(selected);
    button.disabled = false;
    button.classList.toggle('confirmed', done);
    if (label) label.textContent = `${storeName(selected)} 必要人数`;
    if (status) status.textContent = done ? '確認済み' : 'この内容で確認';
  }

  function updateAllStoreMode(section) {
    const allStores = !currentStore();
    section.classList.toggle('need-review-all-stores', allStores);
    section.querySelectorAll('.hrm-cell').forEach(input => { input.disabled = allStores; });
    const note = document.getElementById('need-review-all-note');
    if (note) note.hidden = !allStores;
  }

  function clearConfirmedStore(storeId) {
    const state = readiness();
    const next = new Set((state.staffingNeedConfirmedStores || []).map(String));
    if (!next.delete(String(storeId))) return;
    state.staffingNeedConfirmedStores = Array.from(next);
    state.staffingNeedConfirmed = allStoresConfirmed(state.staffingNeedConfirmedStores);
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(READINESS_KEY, JSON.stringify(state));
  }

  function readiness() {
    try {
      const value = JSON.parse(localStorage.getItem(READINESS_KEY)) || {};
      const stores = loadStores();
      let confirmed = Array.isArray(value.staffingNeedConfirmedStores) ? value.staffingNeedConfirmedStores.map(String) : [];
      if (!confirmed.length && value.staffingNeedConfirmed === true) confirmed = stores.map(store => String(store.id));
      return { ...value, staffingNeedConfirmedStores:confirmed, staffingNeedConfirmed:Boolean(value.staffingNeedConfirmed) };
    } catch {
      return { staffingNeedConfirmed:false, staffingNeedConfirmedStores:[] };
    }
  }

  function allStoresConfirmed(ids) {
    const stores = loadStores();
    const set = new Set((ids || []).map(String));
    return Boolean(stores.length) && stores.every(store => set.has(String(store.id)));
  }

  function currentStore() {
    return String(document.getElementById('stable-store')?.value || sessionStorage.getItem(STORE_KEY) || '');
  }

  function loadStores() {
    try {
      const value = JSON.parse(localStorage.getItem(STORES_KEY));
      if (Array.isArray(value) && value.length) return value;
      if (Array.isArray(value?.stores) && value.stores.length) return value.stores;
    } catch {}
    return DEFAULT_STORES;
  }

  function storeName(id) {
    return loadStores().find(store => String(store.id) === String(id))?.name || id;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #rs-requirements .need-review-hidden-store-select{display:none!important}
      #rs-requirements .need-review-panel{margin:10px 0 12px;padding:10px 12px;border:1px solid #e4e7ec;border-radius:10px;background:#f9fafb}
      #rs-requirements .need-review-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
      #rs-requirements .need-review-top>div{display:flex;align-items:center;gap:8px}
      #rs-requirements .need-review-top strong{font-size:11px;color:#101828}
      #rs-requirements .need-review-top span{font-size:9px;font-weight:900;color:#475467;padding:3px 7px;border-radius:999px;background:#fff;border:1px solid #e4e7ec}
      #rs-requirements .need-review-top small{font-size:9px;color:#667085}
      #rs-requirements .need-review-stores{display:flex;gap:7px;flex-wrap:wrap}
      #rs-requirements .need-review-store{display:flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;color:#344054;cursor:pointer;font-size:9px;font-weight:900}
      #rs-requirements .need-review-store b{font-size:8px;color:#b54708;background:#fffaeb;border-radius:999px;padding:2px 5px}
      #rs-requirements .need-review-store.active{border-color:#98a2b3;box-shadow:0 0 0 2px rgba(152,162,179,.12)}
      #rs-requirements .need-review-store.confirmed{border-color:#abefc6;background:#ecfdf3;color:#067647}
      #rs-requirements .need-review-store.confirmed b{background:#d1fadf;color:#067647}
      #rs-requirements .need-review-all-note{margin-top:9px;padding:8px 10px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:9px;font-weight:800}
      #rs-requirements.need-review-all-stores .hrm-table-wrap{display:none!important}
      @media(max-width:900px){#rs-requirements .need-review-top{align-items:flex-start;flex-direction:column}#rs-requirements .need-review-store{flex:1 1 calc(50% - 7px);justify-content:space-between}}
    `;
    document.head.appendChild(style);
  }
})();
