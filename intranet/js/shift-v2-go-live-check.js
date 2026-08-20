(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const REVIEW_KEY = 'okk_shift_v2_staff_review_v1';
  const READINESS_KEY = 'okk_shift_v2_master_readiness_v1';
  const STORES_KEY = 'okk_shift_v2_config';
  const PANEL_ID = 'shift-v2-go-live-check';
  const STYLE_ID = 'shift-v2-go-live-check-style';
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  if (window.__shiftV2GoLiveCheckInstalled) return;
  window.__shiftV2GoLiveCheckInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    installWithRetry(0);
    bindEvents();
  }

  function installWithRetry(attempt) {
    if (installPanel()) {
      refresh();
      return;
    }
    if (attempt < 12) setTimeout(() => installWithRetry(attempt + 1), 120);
  }

  function installPanel() {
    if (document.getElementById(PANEL_ID)) return true;
    const guide = document.getElementById('shift-v2-guided-help');
    if (!guide) return false;

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'go-live-check';
    panel.innerHTML = `
      <div class="go-live-head">
        <div>
          <span class="go-live-kicker">運用開始チェック</span>
          <strong id="go-live-title">現場確認待ち</strong>
          <small id="go-live-sub">スタッフと必要人数の確認が終わると正式マスタになります。</small>
        </div>
        <span id="go-live-badge" class="go-live-badge pending">準備中</span>
      </div>
      <div class="go-live-steps">
        <button type="button" class="go-live-step" data-go-live="staff">
          <b>1</b><span><small>スタッフ・スキル</small><strong id="go-live-staff">確認状況を取得中</strong></span><i class="fa-solid fa-chevron-right"></i>
        </button>
        <button type="button" class="go-live-step" data-go-live="need">
          <b>2</b><span><small>必要人数</small><strong id="go-live-need">確認状況を取得中</strong></span><i class="fa-solid fa-chevron-right"></i>
        </button>
        <button type="button" class="go-live-step final" data-go-live="month">
          <b>3</b><span><small>月間一括作成</small><strong id="go-live-month">仮計算できます</strong></span><i class="fa-solid fa-calendar-plus"></i>
        </button>
      </div>`;
    guide.insertAdjacentElement('afterend', panel);
    return true;
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const action = event.target.closest?.('[data-go-live]');
      if (action) {
        const type = action.dataset.goLive;
        if (type === 'staff') return openRulesTab('staff');
        if (type === 'need') return openRulesTab('requirements');
        if (type === 'month') return document.getElementById('month-builder-open')?.click();
      }

      if (event.target.closest?.('[data-staff-review],[data-stable-confirm="need"],#rs-staff-body .rs-lv')) {
        setTimeout(refresh, 80);
        setTimeout(refresh, 220);
      }

      if (event.target.closest?.('[data-view="planner"]')) {
        setTimeout(() => {
          installPanel();
          refresh();
        }, 80);
      }
    }, false);

    document.addEventListener('shiftv2-master-readiness-changed', () => setTimeout(refresh, 20));
    window.addEventListener('storage', event => {
      if ([STAFF_KEY, REVIEW_KEY, READINESS_KEY, STORES_KEY].includes(event.key)) refresh();
    });
  }

  function refresh() {
    if (!document.getElementById(PANEL_ID)) {
      installPanel();
      if (!document.getElementById(PANEL_ID)) return;
    }

    const readiness = loadReadiness();
    const staffProgress = calculateStaffProgress();
    const stores = loadStores();
    const needConfirmed = new Set((readiness.staffingNeedConfirmedStores || []).map(String));
    const needDone = stores.filter(store => needConfirmed.has(String(store.id))).length;
    const needTotal = stores.length;
    const staffReady = Boolean(readiness.staffSkillsConfirmed);
    const needReady = Boolean(readiness.staffingNeedConfirmed);
    const ready = staffReady && needReady;

    const title = document.getElementById('go-live-title');
    const sub = document.getElementById('go-live-sub');
    const badge = document.getElementById('go-live-badge');
    const staff = document.getElementById('go-live-staff');
    const need = document.getElementById('go-live-need');
    const month = document.getElementById('go-live-month');

    if (title) title.textContent = ready ? '本番運用できます' : '現場確認待ち';
    if (sub) sub.textContent = ready
      ? '正式マスタで月間AUTOと不足判定を使えます。'
      : '未確認の項目を開いて現場確認を完了してください。';
    if (badge) {
      badge.textContent = ready ? '本番準備OK' : '準備中';
      badge.className = `go-live-badge ${ready ? 'ready' : 'pending'}`;
    }
    if (staff) staff.textContent = staffReady
      ? `${staffProgress.total}/${staffProgress.total}件 確認済み`
      : `${staffProgress.done}/${staffProgress.total}件 確認済み`;
    if (need) need.textContent = needReady
      ? `${needTotal}/${needTotal}店舗 確認済み`
      : `${needDone}/${needTotal}店舗 確認済み`;
    if (month) month.textContent = ready ? '正式マスタで作成できます' : '仮マスタで計算できます';

    document.querySelector('[data-go-live="staff"]')?.classList.toggle('done', staffReady);
    document.querySelector('[data-go-live="need"]')?.classList.toggle('done', needReady);
    document.querySelector('[data-go-live="month"]')?.classList.toggle('ready', ready);
  }

  function openRulesTab(tab) {
    const nav = document.querySelector('[data-view="rules"]');
    nav?.click();
    sessionStorage.setItem('okk_shift_v2_rules_ui_tab', tab);
    setTimeout(() => {
      const target = document.querySelector(`#stable-rules-tabs [data-stable-tab="${tab}"]`);
      target?.click();
      target?.scrollIntoView({ behavior:'smooth', block:'center' });
    }, 120);
  }

  function calculateStaffProgress() {
    const staff = loadStaff().filter(person => person && person.active !== false && person.shiftTarget !== false && person.shiftEnabled !== false && person.shiftEligible !== false);
    const stores = loadStores();
    const validStores = new Set(stores.map(store => String(store.id)));
    const reviews = loadReviews();
    let total = 0;
    let done = 0;

    staff.forEach(person => {
      const personId = normalizeId(person.id || person.employeeNumber);
      const storeIds = Array.from(new Set([
        person.mainStoreId,
        ...(Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : []),
        ...(Array.isArray(person.placementStoreIds) ? person.placementStoreIds : []),
      ].filter(Boolean).map(String))).filter(id => validStores.has(id));

      storeIds.forEach(storeId => {
        total += 1;
        if (reviews?.[storeId]?.[personId]) done += 1;
      });
    });

    return { done, total };
  }

  function loadStaff() {
    try {
      const value = JSON.parse(localStorage.getItem(STAFF_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function loadReviews() {
    try {
      const value = JSON.parse(localStorage.getItem(REVIEW_KEY));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function loadReadiness() {
    try {
      const value = JSON.parse(localStorage.getItem(READINESS_KEY)) || {};
      return {
        staffSkillsConfirmed:Boolean(value.staffSkillsConfirmed),
        staffingNeedConfirmed:Boolean(value.staffingNeedConfirmed),
        staffingNeedConfirmedStores:Array.isArray(value.staffingNeedConfirmedStores) ? value.staffingNeedConfirmedStores.map(String) : [],
      };
    } catch {
      return { staffSkillsConfirmed:false, staffingNeedConfirmed:false, staffingNeedConfirmedStores:[] };
    }
  }

  function loadStores() {
    try {
      const value = JSON.parse(localStorage.getItem(STORES_KEY));
      if (Array.isArray(value) && value.length) return value;
      if (Array.isArray(value?.stores) && value.stores.length) return value.stores;
    } catch {}
    return DEFAULT_STORES;
  }

  function normalizeId(value) {
    return String(value || '').trim().toUpperCase();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:0 0 12px;padding:11px 12px;border:1px solid #d0d5dd;border-radius:11px;background:#f8fafc;font-family:'Noto Sans JP',sans-serif}
      #${PANEL_ID} .go-live-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:9px}
      #${PANEL_ID} .go-live-kicker{display:block;font-size:8px;font-weight:900;letter-spacing:.08em;color:#667085}
      #${PANEL_ID} .go-live-head strong{display:block;margin-top:1px;font-size:13px;color:#101828}
      #${PANEL_ID} .go-live-head small{display:block;margin-top:2px;font-size:8px;font-weight:700;color:#667085}
      #${PANEL_ID} .go-live-badge{padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900;white-space:nowrap}
      #${PANEL_ID} .go-live-badge.pending{background:#fef0c7;color:#b54708}#${PANEL_ID} .go-live-badge.ready{background:#dcfae6;color:#067647}
      #${PANEL_ID} .go-live-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
      #${PANEL_ID} .go-live-step{display:flex;align-items:center;gap:8px;width:100%;padding:8px 9px;border:1px solid #e4e7ec;border-radius:9px;background:#fff;text-align:left;cursor:pointer;color:#344054}
      #${PANEL_ID} .go-live-step:hover{border-color:#98a2b3;background:#fcfcfd}
      #${PANEL_ID} .go-live-step>b{display:grid;place-items:center;width:23px;height:23px;flex:0 0 23px;border-radius:999px;background:#f2f4f7;color:#475467;font-size:9px}
      #${PANEL_ID} .go-live-step span{min-width:0;flex:1}#${PANEL_ID} .go-live-step small,#${PANEL_ID} .go-live-step strong{display:block}
      #${PANEL_ID} .go-live-step small{font-size:7px;color:#667085;font-weight:800}#${PANEL_ID} .go-live-step strong{font-size:9px;color:#344054;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${PANEL_ID} .go-live-step>i{font-size:8px;color:#98a2b3}
      #${PANEL_ID} .go-live-step.done{border-color:#abefc6;background:#f6fef9}#${PANEL_ID} .go-live-step.done>b{background:#dcfae6;color:#067647}
      #${PANEL_ID} .go-live-step.ready{border-color:#84caff;background:#eff8ff}#${PANEL_ID} .go-live-step.ready>b{background:#d1e9ff;color:#175cd3}
      @media(max-width:800px){#${PANEL_ID} .go-live-steps{grid-template-columns:1fr}#${PANEL_ID} .go-live-head{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }
})();
