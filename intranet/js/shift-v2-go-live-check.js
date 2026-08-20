(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const REVIEW_KEY = 'okk_shift_v2_staff_review_v1';
  const READINESS_KEY = 'okk_shift_v2_master_readiness_v1';
  const STORES_KEY = 'okk_shift_v2_config';
  const DEMO_KEY = 'okk_shift_v2_demo_mode';
  const PANEL_ID = 'shift-v2-go-live-check';
  const STYLE_ID = 'shift-v2-go-live-check-style';
  const FALLBACK_IDS = new Set(['OKK10001','OKK10003','OKK10004','OKK10005','OKK10008','OKK10009','OKK10010','OKK10012','OKK10016','OKK10020']);
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];

  if (window.__shiftV2GoLiveCheckInstalled) return;
  window.__shiftV2GoLiveCheckInstalled = true;
  window.shiftV2GoLive = {
    dataStatus,
    isProductionReady: () => {
      const readiness = loadReadiness();
      return Boolean(dataStatus().ready && readiness.staffSkillsConfirmed && readiness.staffingNeedConfirmed);
    },
    refresh,
  };

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
          <strong id="go-live-title">本番データ確認中</strong>
          <small id="go-live-sub">従業員データ・スキル・必要人数を確認すると本番運用できます。</small>
        </div>
        <span id="go-live-badge" class="go-live-badge pending">準備中</span>
      </div>
      <div class="go-live-steps">
        <button type="button" class="go-live-step" data-go-live="data">
          <b>1</b><span><small>従業員データ</small><strong id="go-live-data">確認状況を取得中</strong></span><i class="fa-solid fa-chevron-right"></i>
        </button>
        <button type="button" class="go-live-step" data-go-live="staff">
          <b>2</b><span><small>スタッフ・スキル</small><strong id="go-live-staff">確認状況を取得中</strong></span><i class="fa-solid fa-chevron-right"></i>
        </button>
        <button type="button" class="go-live-step" data-go-live="need">
          <b>3</b><span><small>必要人数</small><strong id="go-live-need">確認状況を取得中</strong></span><i class="fa-solid fa-chevron-right"></i>
        </button>
        <button type="button" class="go-live-step final" data-go-live="month">
          <b>4</b><span><small>月間一括作成</small><strong id="go-live-month">仮計算できます</strong></span><i class="fa-solid fa-calendar-plus"></i>
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
        if (type === 'data') return openMaster();
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
    document.addEventListener('shiftv2-auth', () => setTimeout(refresh, 80));
    window.addEventListener('storage', event => {
      if ([STAFF_KEY, REVIEW_KEY, READINESS_KEY, STORES_KEY, DEMO_KEY].includes(event.key)) refresh();
    });
  }

  function refresh() {
    if (!document.getElementById(PANEL_ID)) {
      installPanel();
      if (!document.getElementById(PANEL_ID)) return;
    }

    const source = dataStatus();
    const readiness = loadReadiness();
    const staffProgress = calculateStaffProgress();
    const stores = loadStores();
    const needConfirmed = new Set((readiness.staffingNeedConfirmedStores || []).map(String));
    const needDone = stores.filter(store => needConfirmed.has(String(store.id))).length;
    const needTotal = stores.length;
    const dataReady = Boolean(source.ready);
    const staffReady = Boolean(readiness.staffSkillsConfirmed);
    const needReady = Boolean(readiness.staffingNeedConfirmed);
    const ready = dataReady && staffReady && needReady;

    const title = document.getElementById('go-live-title');
    const sub = document.getElementById('go-live-sub');
    const badge = document.getElementById('go-live-badge');
    const data = document.getElementById('go-live-data');
    const staff = document.getElementById('go-live-staff');
    const need = document.getElementById('go-live-need');
    const month = document.getElementById('go-live-month');

    if (title) title.textContent = ready ? '本番運用できます' : !dataReady ? '従業員データ投入待ち' : '現場確認待ち';
    if (sub) sub.textContent = ready
      ? '正式マスタで月間AUTOと不足判定を使えます。'
      : !dataReady
        ? source.help
        : '未確認のスキル・必要人数を開いて現場確認を完了してください。';
    if (badge) {
      badge.textContent = ready ? '本番準備OK' : '準備中';
      badge.className = `go-live-badge ${ready ? 'ready' : 'pending'}`;
    }
    if (data) data.textContent = source.label;
    if (staff) staff.textContent = staffReady
      ? `${staffProgress.total}/${staffProgress.total}件 確認済み`
      : `${staffProgress.done}/${staffProgress.total}件 確認済み`;
    if (need) need.textContent = needReady
      ? `${needTotal}/${needTotal}店舗 確認済み`
      : `${needDone}/${needTotal}店舗 確認済み`;
    if (month) month.textContent = ready ? '正式マスタで作成できます' : '仮マスタで計算できます';

    document.querySelector('[data-go-live="data"]')?.classList.toggle('done', dataReady);
    document.querySelector('[data-go-live="staff"]')?.classList.toggle('done', staffReady);
    document.querySelector('[data-go-live="need"]')?.classList.toggle('done', needReady);
    document.querySelector('[data-go-live="month"]')?.classList.toggle('ready', ready);
  }

  function dataStatus() {
    const staff = loadStaff();
    const active = staff.filter(person => person && person.active !== false);
    const assignable = active.filter(person => person.autoAssign !== false && person.shiftTarget !== false && person.shiftEnabled !== false && person.shiftEligible !== false);
    const demo = localStorage.getItem(DEMO_KEY) === '1' || active.some(isDemoPerson);
    const mfSynced = active.filter(person => Boolean(person?.mf?.syncedAt || person?.mfSyncedAt)).length;
    const fallbackOnly = active.length > 0 && mfSynced === 0 && active.every(person => FALLBACK_IDS.has(normalizeId(person.id || person.employeeNumber)));
    const issues = assignable.filter(person => {
      const id = normalizeId(person.id || person.employeeNumber);
      const name = String(person.name || '').trim();
      const employment = String(person.employmentType || '').trim();
      const storeIds = [person.mainStoreId, ...(Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : []), ...(Array.isArray(person.placementStoreIds) ? person.placementStoreIds : [])].filter(Boolean);
      return !id || !name || !employment || employment === '未設定' || !storeIds.length;
    }).length;

    if (demo) {
      return { ready:false, kind:'demo', label:'デモデータのため本番不可', help:'デモを解除し、従業員マスタに実データを入れてください。', active:active.length, mfSynced, issues };
    }
    if (!active.length) {
      return { ready:false, kind:'empty', label:'従業員データ未登録', help:'従業員マスタからMF従業員CSVを取り込んでください。', active:0, mfSynced:0, issues:0 };
    }
    if (fallbackOnly) {
      return { ready:false, kind:'fallback', label:`初期${active.length}名の仮データ`, help:'初期サンプルの従業員データです。従業員マスタからMF従業員CSVを取り込むと本番データへ切り替わります。', active:active.length, mfSynced, issues };
    }
    if (issues) {
      return { ready:false, kind:'issues', label:`配置情報未設定 ${issues}名`, help:'従業員マスタで雇用区分と所属店舗を確認してください。', active:active.length, mfSynced, issues };
    }
    if (mfSynced) {
      return { ready:true, kind:'mf', label:`MF同期済 ${mfSynced}名`, help:'MF従業員データを本番マスタとして使用します。', active:active.length, mfSynced, issues:0 };
    }
    return { ready:true, kind:'manual', label:`手動マスタ ${active.length}名`, help:'手動登録された従業員データを使用します。スキル確認を完了してください。', active:active.length, mfSynced:0, issues:0 };
  }

  function openMaster() {
    const tab = document.querySelector('.tab[data-view="master"]');
    tab?.click();
    setTimeout(() => {
      document.querySelector('#view-master .master-hero')?.scrollIntoView({ behavior:'smooth', block:'start' });
      document.getElementById('mf-staff-import')?.classList.add('go-live-pulse');
      setTimeout(() => document.getElementById('mf-staff-import')?.classList.remove('go-live-pulse'), 2600);
    }, 120);
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
    const staff = loadStaff().filter(person => person && person.active !== false && person.shiftTarget !== false && person.shiftEnabled !== false && person.shiftEligible !== false && person.autoAssign !== false);
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

  function isDemoPerson(person) {
    return Boolean(person?.demoOnly) || /^DEMO\d+/i.test(normalizeId(person?.id || person?.employeeNumber));
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
      #${PANEL_ID} .go-live-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
      #${PANEL_ID} .go-live-step{display:flex;align-items:center;gap:8px;width:100%;padding:8px 9px;border:1px solid #e4e7ec;border-radius:9px;background:#fff;text-align:left;cursor:pointer;color:#344054}
      #${PANEL_ID} .go-live-step:hover{border-color:#98a2b3;background:#fcfcfd}
      #${PANEL_ID} .go-live-step>b{display:grid;place-items:center;width:23px;height:23px;flex:0 0 23px;border-radius:999px;background:#f2f4f7;color:#475467;font-size:9px}
      #${PANEL_ID} .go-live-step span{min-width:0;flex:1}#${PANEL_ID} .go-live-step small,#${PANEL_ID} .go-live-step strong{display:block}
      #${PANEL_ID} .go-live-step small{font-size:7px;color:#667085;font-weight:800}#${PANEL_ID} .go-live-step strong{font-size:9px;color:#344054;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${PANEL_ID} .go-live-step>i{font-size:8px;color:#98a2b3}
      #${PANEL_ID} .go-live-step.done{border-color:#abefc6;background:#f6fef9}#${PANEL_ID} .go-live-step.done>b{background:#dcfae6;color:#067647}
      #${PANEL_ID} .go-live-step.ready{border-color:#84caff;background:#eff8ff}#${PANEL_ID} .go-live-step.ready>b{background:#d1e9ff;color:#175cd3}
      .go-live-pulse{animation:goLivePulse .8s ease 3}@keyframes goLivePulse{0%,100%{box-shadow:0 0 0 0 rgba(23,92,211,0)}50%{box-shadow:0 0 0 5px rgba(23,92,211,.18)}}
      @media(max-width:1000px){#${PANEL_ID} .go-live-steps{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:700px){#${PANEL_ID} .go-live-steps{grid-template-columns:1fr}#${PANEL_ID} .go-live-head{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }
})();
