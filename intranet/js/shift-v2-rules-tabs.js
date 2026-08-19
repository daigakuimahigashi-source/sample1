(() => {
  'use strict';

  const TAB_KEY = 'okk_shift_v2_rules_ui_tab';
  const VALID = ['skills', 'staff', 'requirements'];
  let observer = null;
  let queued = false;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    patch();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      observer?.disconnect();
      try { patch(); }
      finally { observer?.observe(document.body, { childList: true, subtree: true }); }
    });
  }

  function patch() {
    const view = document.getElementById('view-rules');
    if (!view) return;

    const sections = {
      skills: document.getElementById('rs-skills'),
      staff: document.getElementById('rs-staff'),
      requirements: document.getElementById('rs-requirements'),
    };
    if (!sections.skills || !sections.staff || !sections.requirements) return;

    view.querySelector('.rs-steps')?.remove();
    view.querySelector('.rules-section-tabs')?.remove();

    let tabs = view.querySelector('.rs-independent-tabs');
    if (!tabs) {
      tabs = document.createElement('nav');
      tabs.className = 'rs-independent-tabs';
      tabs.setAttribute('aria-label', '人員・スキル設定の画面切替');
      tabs.innerHTML = `
        <button type="button" data-rs-tab="skills">
          <b>1</b><span><strong>スキル種類</strong><small>種類・名称を設定</small></span>
        </button>
        <button type="button" data-rs-tab="staff">
          <b>2</b><span><strong>スタッフのスキルLv</strong><small>従業員ごとのLv0〜3</small></span>
        </button>
        <button type="button" data-rs-tab="requirements">
          <b>3</b><span><strong>スキル別・時間ごとの必要人数</strong><small>店舗・時間帯ごとの人数</small></span>
        </button>
      `;
      const summary = document.getElementById('rs-summary');
      if (summary) summary.insertAdjacentElement('afterend', tabs);
      else view.querySelector('.rs-hero')?.insertAdjacentElement('afterend', tabs);
      tabs.querySelectorAll('[data-rs-tab]').forEach(button => {
        button.addEventListener('click', () => activate(button.dataset.rsTab, true));
      });
    }

    Object.entries(sections).forEach(([key, section]) => {
      section.dataset.rsIndependentScreen = key;
    });

    enforceNoNestedScroll(view);
    decorateStaffRows();

    const saved = sessionStorage.getItem(TAB_KEY);
    activate(VALID.includes(saved) ? saved : 'skills', false);
  }

  function activate(key, persist) {
    if (!VALID.includes(key)) key = 'skills';
    const view = document.getElementById('view-rules');
    if (!view) return;

    view.querySelectorAll('[data-rs-tab]').forEach(button => {
      const active = button.dataset.rsTab === key;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    VALID.forEach(sectionKey => {
      const section = document.getElementById(`rs-${sectionKey}`);
      if (!section) return;
      const active = sectionKey === key;
      section.classList.toggle('rs-independent-active', active);
      section.hidden = !active;
      section.setAttribute('aria-hidden', active ? 'false' : 'true');
    });

    enforceNoNestedScroll(view);
    decorateStaffRows();

    if (persist) {
      sessionStorage.setItem(TAB_KEY, key);
      const top = Math.max(0, view.getBoundingClientRect().top + window.scrollY - 8);
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function decorateStaffRows() {
    document.querySelectorAll('#rs-staff-body tr[data-person] td:first-child').forEach(cell => {
      if (cell.querySelector('.rs-person-line')) return;
      const nameNode = cell.querySelector('strong');
      const metaNode = cell.querySelector('small');
      if (!nameNode) return;

      const name = nameNode.textContent.trim();
      const meta = metaNode?.textContent.trim() || '';
      cell.textContent = '';

      const line = document.createElement('div');
      line.className = 'rs-person-line';

      const strong = document.createElement('strong');
      strong.className = 'rs-person-name';
      strong.textContent = name;
      line.appendChild(strong);

      if (meta) {
        const span = document.createElement('span');
        span.className = 'rs-person-meta';
        span.textContent = meta;
        line.appendChild(span);
      }

      cell.appendChild(line);
    });
  }

  function enforceNoNestedScroll(view) {
    view.querySelectorAll('#rs-skills,#rs-staff,#rs-requirements,.rs-skill-list,.rs-table-wrap,.hrm-table-wrap').forEach(node => {
      node.style.setProperty('max-height', 'none', 'important');
      node.style.setProperty('height', 'auto', 'important');
      node.style.setProperty('overflow-y', 'visible', 'important');
    });

    view.querySelectorAll('.rs-table-wrap,.hrm-table-wrap').forEach(node => {
      node.style.setProperty('overflow-x', 'auto', 'important');
    });
  }

  function injectStyles() {
    document.getElementById('rs-independent-tabs-style')?.remove();
    const style = document.createElement('style');
    style.id = 'rs-independent-tabs-style';
    style.textContent = `
      #view-rules{font-size:11px}
      #view-rules .rs-independent-tabs{
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;
        margin:0 0 10px;padding:5px;background:#fff;border:1px solid #dde3ec;
        border-radius:11px;box-shadow:0 4px 18px rgba(15,23,42,.04)
      }
      #view-rules .rs-independent-tabs>button{
        display:flex;align-items:center;gap:9px;min-width:0;padding:10px 12px;
        border:0;border-radius:8px;background:transparent;color:#667085;text-align:left;cursor:pointer
      }
      #view-rules .rs-independent-tabs>button:hover{background:#f8fafc;color:#344054}
      #view-rules .rs-independent-tabs>button.active{background:#111827;color:#fff;box-shadow:0 2px 7px rgba(15,23,42,.14)}
      #view-rules .rs-independent-tabs b{
        width:26px;height:26px;display:grid;place-items:center;flex:0 0 auto;
        border-radius:50%;background:#eef2f6;color:#344054;font-size:11px
      }
      #view-rules .rs-independent-tabs>button.active b{background:#f59e0b;color:#111827}
      #view-rules .rs-independent-tabs span{min-width:0}
      #view-rules .rs-independent-tabs strong{display:block;font-size:11px;line-height:1.35}
      #view-rules .rs-independent-tabs small{display:block;margin-top:2px;font-size:10px;opacity:.75;line-height:1.35}

      #view-rules [data-rs-independent-screen]{display:none!important}
      #view-rules [data-rs-independent-screen].rs-independent-active{display:block!important}

      #view-rules .rs-head h3{font-size:13px!important}
      #view-rules .rs-head small{font-size:10px!important}
      #view-rules .rs-rule-filter span{font-size:10px!important}
      #view-rules .rs-id{font-size:10px!important}
      #view-rules .rs-staff-table,
      #view-rules .rs-rule-table,
      #view-rules .hrm-table{font-size:11px!important}
      #view-rules .rs-staff-table th,
      #view-rules .rs-rule-table th,
      #view-rules .hrm-table th{font-size:11px!important;font-weight:700}
      #view-rules .rs-staff-table td,
      #view-rules .rs-rule-table td,
      #view-rules .hrm-table td{font-size:11px!important}
      #view-rules .control,
      #view-rules input,
      #view-rules select,
      #view-rules button{font-size:11px}
      #view-rules .rs-lv{font-size:11px!important}

      #view-rules .rs-staff-table th:first-child,
      #view-rules .rs-staff-table td:first-child{min-width:280px;width:280px}
      #view-rules .rs-person-line{
        display:flex;align-items:center;gap:10px;white-space:nowrap;min-height:28px
      }
      #view-rules .rs-person-name{
        font-size:12px!important;font-weight:900!important;color:#101828!important;line-height:1.3
      }
      #view-rules .rs-person-meta{
        font-size:11px!important;font-weight:500;color:#475467;line-height:1.3
      }

      #view-rules #rs-skills,
      #view-rules #rs-staff,
      #view-rules #rs-requirements,
      #view-rules .rs-skill-list,
      #view-rules .rs-table-wrap,
      #view-rules .hrm-table-wrap{
        max-height:none!important;height:auto!important;overflow-y:visible!important
      }
      #view-rules .rs-table-wrap,
      #view-rules .hrm-table-wrap{overflow-x:auto!important}

      @media(max-width:900px){
        #view-rules .rs-independent-tabs{grid-template-columns:1fr}
        #view-rules .rs-staff-table th:first-child,
        #view-rules .rs-staff-table td:first-child{min-width:240px;width:240px}
      }
    `;
    document.head.appendChild(style);
  }
})();
