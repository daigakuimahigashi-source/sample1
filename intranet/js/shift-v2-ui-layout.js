(() => {
  'use strict';

  const MASTER_TAB_KEY = 'okk_shift_v2_master_ui_tab';
  let masterObserver = null;
  let inspectorObserver = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    injectStyles();
    setupPlannerLayout();
    setupMasterTabs();
    observeDynamicUi();
    bindGlobalEvents();
  }

  function injectStyles() {
    if (document.getElementById('shift-v2-ui-layout-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-ui-layout-style';
    style.textContent = `
      #view-master .master-section-tabs{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin:0 0 10px;padding:5px;background:#fff;border:1px solid #dde3ec;border-radius:11px;box-shadow:0 4px 18px rgba(15,23,42,.04);position:sticky;top:0;z-index:35}
      #view-master .master-section-tab{border:0;background:transparent;color:#667085;border-radius:8px;padding:8px 12px;font-size:10px;font-weight:900;white-space:nowrap}
      #view-master .master-section-tab:hover{background:#f8fafc;color:#344054}
      #view-master .master-section-tab.active{background:#111827;color:#fff;box-shadow:0 2px 7px rgba(15,23,42,.14)}
      #view-master .master-section-tab i{margin-right:5px}
      #view-master .master-section-pane{display:none}
      #view-master .master-section-pane.active{display:block}
      #view-master .master-section-pane>.card:first-child{margin-top:0}
      #view-master .master-table-wrap,#view-master .overtime-table-wrap,#view-master .overtime-master-table-wrap,#view-master [class*="overtime"][class*="table-wrap"]{max-height:none!important;overflow-y:visible!important;overflow-x:auto!important}
      #view-master .master-table-card,#view-master #overtime-master-panel{margin-bottom:10px}
      #view-master .master-section-pane[data-master-pane="employee"] .master-summary{margin-bottom:10px}
      #view-master .master-section-pane[data-master-pane="overtime"] #overtime-master-panel{border-radius:12px}
      #work-plan-panel{display:none!important}

      #view-planner .planner{grid-template-columns:220px minmax(0,1fr)!important;gap:10px!important}
      #view-planner .gantt-card{min-width:0;width:100%}
      #view-planner .inspector-panel{display:none!important;position:fixed!important;right:18px!important;top:94px!important;width:min(360px,calc(100vw - 36px))!important;max-height:calc(100vh - 118px)!important;overflow:auto!important;z-index:1450!important;border:1px solid #d0d5dd!important;box-shadow:0 22px 55px rgba(15,23,42,.24)!important;background:#fff!important}
      #view-planner .inspector-panel.okk-inspector-open{display:block!important}
      #view-planner .inspector-panel .panel-title{position:sticky;top:0;z-index:2;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:8px}
      #view-planner .inspector-panel .panel-title>span:first-child{min-width:0}
      #view-planner .okk-inspector-close{border:1px solid #d0d5dd;background:#fff;color:#475467;border-radius:7px;width:28px;height:28px;display:grid;place-items:center;flex:0 0 auto}
      #view-planner .okk-inspector-close:hover{background:#f2f4f7;color:#101828}
      #view-planner .okk-detail-hint{font-size:8px;color:#667085;font-weight:700;margin-left:4px}
      @media(max-width:1120px){#view-planner .planner{grid-template-columns:200px minmax(0,1fr)!important}#view-planner .inspector-panel{grid-column:auto!important}}
      @media(max-width:760px){#view-planner .planner{display:block!important}#view-planner .inspector-panel{left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;width:auto!important;max-height:72vh!important}}
    `;
    document.head.appendChild(style);
  }

  function setupMasterTabs() {
    const master = document.getElementById('view-master');
    if (!master) return;

    const hero = master.querySelector('.master-hero');
    const summary = document.getElementById('master-summary');
    const toolbar = master.querySelector('.master-toolbar');
    const tableCard = master.querySelector('.master-table-card');
    const overtime = document.getElementById('overtime-master-panel');
    if (!hero || !summary || !toolbar || !tableCard) return;

    document.getElementById('work-plan-panel')?.remove();
    master.querySelector('.master-section-pane[data-master-pane="workplan"]')?.remove();

    let tabs = master.querySelector('.master-section-tabs');
    if (!tabs) {
      tabs = document.createElement('nav');
      tabs.className = 'master-section-tabs';
      tabs.setAttribute('aria-label', '従業員マスタ内の表示切替');
      hero.insertAdjacentElement('afterend', tabs);
    }
    tabs.innerHTML = `
      <button type="button" class="master-section-tab" data-master-section="employee"><i class="fa-solid fa-users"></i>従業員</button>
      <button type="button" class="master-section-tab" data-master-section="overtime"><i class="fa-solid fa-shield-halved"></i>残業・36協定・例外承認</button>`;
    tabs.querySelectorAll('[data-master-section]').forEach(button => {
      button.addEventListener('click', () => activateMasterSection(button.dataset.masterSection));
    });

    const employeePane = ensurePane(master, 'employee');
    if (summary.parentElement !== employeePane) employeePane.appendChild(summary);
    if (toolbar.parentElement !== employeePane) employeePane.appendChild(toolbar);
    if (tableCard.parentElement !== employeePane) employeePane.appendChild(tableCard);

    const overtimePane = ensurePane(master, 'overtime');
    if (overtime && overtime.parentElement !== overtimePane) overtimePane.appendChild(overtime);

    const anchor = tabs;
    [employeePane, overtimePane].forEach((pane, index) => {
      const expectedPrevious = index === 0 ? anchor : employeePane;
      if (pane.previousElementSibling !== expectedPrevious) expectedPrevious.insertAdjacentElement('afterend', pane);
    });

    const saved = sessionStorage.getItem(MASTER_TAB_KEY);
    activateMasterSection(saved === 'overtime' ? 'overtime' : 'employee', false);
  }

  function ensurePane(master, key) {
    let pane = master.querySelector(`.master-section-pane[data-master-pane="${key}"]`);
    if (!pane) {
      pane = document.createElement('div');
      pane.className = 'master-section-pane';
      pane.dataset.masterPane = key;
      master.appendChild(pane);
    }
    return pane;
  }

  function activateMasterSection(key, persist = true) {
    const master = document.getElementById('view-master');
    if (!master) return;
    const valid = key === 'overtime' ? 'overtime' : 'employee';
    master.querySelectorAll('.master-section-tab').forEach(button => {
      const active = button.dataset.masterSection === valid;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    master.querySelectorAll('.master-section-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.masterPane === valid));
    if (persist) sessionStorage.setItem(MASTER_TAB_KEY, valid);
  }

  function setupPlannerLayout() {
    const planner = document.getElementById('view-planner');
    const panel = planner?.querySelector('.inspector-panel');
    if (!planner || !panel) return;
    const title = panel.querySelector('.panel-title');
    if (title && !title.querySelector('.okk-inspector-close')) {
      const original = title.innerHTML;
      title.innerHTML = `<span>${original}</span><button type="button" class="okk-inspector-close" aria-label="シフト詳細を閉じる"><i class="fa-solid fa-xmark"></i></button>`;
      title.querySelector('.okk-inspector-close')?.addEventListener('click', closeInspector);
    }
    const detail = document.getElementById('inspector');
    if (detail && !inspectorObserver) {
      inspectorObserver = new MutationObserver(() => {
        const empty = !detail.textContent.trim() || detail.querySelector('.empty');
        if (empty) closeInspector();
      });
      inspectorObserver.observe(detail, { childList:true, subtree:true, characterData:true });
    }
  }

  function openInspector() { document.querySelector('#view-planner .inspector-panel')?.classList.add('okk-inspector-open'); }
  function closeInspector() { document.querySelector('#view-planner .inspector-panel')?.classList.remove('okk-inspector-open'); }

  function observeDynamicUi() {
    const workspace = document.querySelector('.workspace');
    if (!workspace || masterObserver) return;
    masterObserver = new MutationObserver(() => {
      setupMasterTabs();
      setupPlannerLayout();
    });
    masterObserver.observe(workspace, { childList:true, subtree:false });
  }

  function bindGlobalEvents() {
    document.addEventListener('click', event => {
      const shiftBar = event.target.closest?.('#view-planner .shift-bar');
      if (shiftBar) { setTimeout(openInspector, 0); return; }
      const overtimeMaster = event.target.closest?.('#overtime-open-master');
      if (overtimeMaster) setTimeout(() => activateMasterSection('overtime'), 30);
    }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeInspector(); });
    document.addEventListener('shiftv2-access', () => setTimeout(() => { setupMasterTabs(); setupPlannerLayout(); }, 0));
  }
})();
