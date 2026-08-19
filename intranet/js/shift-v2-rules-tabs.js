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

    // LIVE7 actually renders the safe UI with these three section IDs.
    const sections = {
      skills: document.getElementById('rs-skills'),
      staff: document.getElementById('rs-staff'),
      requirements: document.getElementById('rs-requirements'),
    };
    if (!sections.skills || !sections.staff || !sections.requirements) return;

    // Remove the old 1 -> 2 -> 3 jump UI. It only scrolled within one long page.
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

    // These are three independent screens. Never stack them vertically.
    Object.entries(sections).forEach(([key, section]) => {
      section.dataset.rsIndependentScreen = key;
    });

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

    if (persist) {
      sessionStorage.setItem(TAB_KEY, key);
      const top = Math.max(0, view.getBoundingClientRect().top + window.scrollY - 8);
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function injectStyles() {
    if (document.getElementById('rs-independent-tabs-style')) return;
    const style = document.createElement('style');
    style.id = 'rs-independent-tabs-style';
    style.textContent = `
      #view-rules .rs-independent-tabs{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:5px;
        margin:0 0 10px;
        padding:5px;
        background:#fff;
        border:1px solid #dde3ec;
        border-radius:11px;
        box-shadow:0 4px 18px rgba(15,23,42,.04);
      }
      #view-rules .rs-independent-tabs>button{
        display:flex;
        align-items:center;
        gap:9px;
        min-width:0;
        padding:10px 12px;
        border:0;
        border-radius:8px;
        background:transparent;
        color:#667085;
        text-align:left;
        cursor:pointer;
      }
      #view-rules .rs-independent-tabs>button:hover{background:#f8fafc;color:#344054}
      #view-rules .rs-independent-tabs>button.active{background:#111827;color:#fff;box-shadow:0 2px 7px rgba(15,23,42,.14)}
      #view-rules .rs-independent-tabs b{
        width:26px;height:26px;display:grid;place-items:center;flex:0 0 auto;
        border-radius:50%;background:#eef2f6;color:#344054;font-size:10px;
      }
      #view-rules .rs-independent-tabs>button.active b{background:#f59e0b;color:#111827}
      #view-rules .rs-independent-tabs span{min-width:0}
      #view-rules .rs-independent-tabs strong{display:block;font-size:10px;line-height:1.35}
      #view-rules .rs-independent-tabs small{display:block;margin-top:2px;font-size:7px;opacity:.72;line-height:1.35}

      /* Critical: only one of the three LIVE7 sections may exist visually at once. */
      #view-rules [data-rs-independent-screen]{display:none!important}
      #view-rules [data-rs-independent-screen].rs-independent-active{display:block!important}

      /* No nested vertical scrolling inside any of the three screens. */
      #view-rules #rs-skills,
      #view-rules #rs-staff,
      #view-rules #rs-requirements,
      #view-rules .rs-skill-list,
      #view-rules .rs-table-wrap,
      #view-rules .hrm-table-wrap{
        max-height:none!important;
        height:auto!important;
        overflow-y:visible!important;
      }
      #view-rules .rs-table-wrap,
      #view-rules .hrm-table-wrap{overflow-x:auto!important}

      @media(max-width:900px){
        #view-rules .rs-independent-tabs{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }
})();
