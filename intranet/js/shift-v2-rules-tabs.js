(() => {
  'use strict';

  const TAB_KEY = 'okk_shift_v2_rules_ui_tab';
  let observer = null;
  let queued = false;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    patch();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList:true, subtree:true });
  }

  function schedule() {
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

    const hero = view.querySelector('.rules-hero');
    const summary = document.getElementById('rules-summary');
    const skillGroup = view.querySelector('.rules-grid-two');
    const staffSkills = view.querySelector('.employee-skills-card');
    const requirements = view.querySelector('.rules-requirements-card');
    if (!hero || !skillGroup || !staffSkills || !requirements) return;

    const guide = document.getElementById('rules-easy-guide');
    if (guide) guide.style.display = 'none';

    let tabs = view.querySelector('.rules-section-tabs');
    if (!tabs) {
      tabs = document.createElement('nav');
      tabs.className = 'rules-section-tabs';
      tabs.setAttribute('aria-label', '人員・スキル設定内の表示切替');
      tabs.innerHTML = `
        <button type="button" class="rules-section-tab" data-rules-section="skills">
          <b>1</b><span><strong>スキル種類</strong><small>種類・名称・習熟度基準</small></span>
        </button>
        <button type="button" class="rules-section-tab" data-rules-section="staff">
          <b>2</b><span><strong>スタッフのスキルLv</strong><small>従業員ごとの0〜3</small></span>
        </button>
        <button type="button" class="rules-section-tab" data-rules-section="requirements">
          <b>3</b><span><strong>スキル別・時間ごとの必要人数</strong><small>店舗・曜日・時間帯・人数</small></span>
        </button>
      `;
      if (summary) summary.insertAdjacentElement('afterend', tabs);
      else hero.insertAdjacentElement('afterend', tabs);
      tabs.querySelectorAll('[data-rules-section]').forEach(button => {
        button.addEventListener('click', () => activate(button.dataset.rulesSection));
      });
    }

    const skillsPane = ensurePane(view, 'skills');
    const staffPane = ensurePane(view, 'staff');
    const requirementsPane = ensurePane(view, 'requirements');

    if (skillGroup.parentElement !== skillsPane) skillsPane.appendChild(skillGroup);
    if (staffSkills.parentElement !== staffPane) staffPane.appendChild(staffSkills);
    if (requirements.parentElement !== requirementsPane) requirementsPane.appendChild(requirements);

    [skillsPane, staffPane, requirementsPane].forEach((pane, index, panes) => {
      const previous = index === 0 ? tabs : panes[index - 1];
      if (pane.previousElementSibling !== previous) previous.insertAdjacentElement('afterend', pane);
    });

    const masterHeading = skillsPane.querySelector('.rules-card-head h2');
    if (masterHeading) masterHeading.textContent = 'スキル種類';
    const staffHeading = staffPane.querySelector('.rules-card-head h2');
    if (staffHeading) staffHeading.textContent = 'スタッフのスキルLv';
    const requirementHeading = requirementsPane.querySelector('.rules-card-head h2');
    if (requirementHeading) requirementHeading.textContent = 'スキル別・時間ごとの必要人数';

    const saved = sessionStorage.getItem(TAB_KEY) || 'skills';
    activate(saved, false);
  }

  function ensurePane(view, key) {
    let pane = view.querySelector(`.rules-section-pane[data-rules-pane="${key}"]`);
    if (!pane) {
      pane = document.createElement('div');
      pane.className = 'rules-section-pane';
      pane.dataset.rulesPane = key;
      view.appendChild(pane);
    }
    return pane;
  }

  function activate(key, persist = true) {
    const view = document.getElementById('view-rules');
    if (!view) return;
    const valid = ['skills','staff','requirements'].includes(key) ? key : 'skills';

    view.querySelectorAll('.rules-section-tab').forEach(button => {
      const active = button.dataset.rulesSection === valid;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    view.querySelectorAll('.rules-section-pane').forEach(pane => {
      pane.classList.toggle('active', pane.dataset.rulesPane === valid);
    });
    if (persist) sessionStorage.setItem(TAB_KEY, valid);
  }

  function injectStyles() {
    if (document.getElementById('shift-v2-rules-tabs-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-rules-tabs-style';
    style.textContent = `
      #view-rules .rules-section-tabs{
        display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;
        padding:5px;margin:0 0 10px;background:#fff;border:1px solid #dde3ec;
        border-radius:11px;box-shadow:0 4px 18px rgba(15,23,42,.04);
        position:sticky;top:0;z-index:35;
      }
      #view-rules .rules-section-tab{
        display:flex;align-items:center;gap:8px;text-align:left;
        border:0;background:transparent;color:#667085;border-radius:8px;
        padding:8px 10px;min-width:0;cursor:pointer;
      }
      #view-rules .rules-section-tab:hover{background:#f8fafc;color:#344054}
      #view-rules .rules-section-tab.active{background:#111827;color:#fff;box-shadow:0 2px 7px rgba(15,23,42,.14)}
      #view-rules .rules-section-tab>b{
        width:25px;height:25px;border-radius:50%;display:grid;place-items:center;
        flex:0 0 auto;background:#eef2f6;color:#344054;font-size:10px;
      }
      #view-rules .rules-section-tab.active>b{background:#f59e0b;color:#111827}
      #view-rules .rules-section-tab>span{display:block;min-width:0}
      #view-rules .rules-section-tab strong{display:block;font-size:10px;white-space:normal}
      #view-rules .rules-section-tab small{display:block;font-size:7px;margin-top:1px;opacity:.72;white-space:normal}

      /* Only the page itself scrolls vertically. */
      #view-rules .rules-section-pane{display:none;max-height:none!important;height:auto!important;overflow:visible!important}
      #view-rules .rules-section-pane.active{display:block}
      #view-rules .rules-section-pane>.rules-card,
      #view-rules .rules-section-pane>.rules-grid-two{margin-bottom:10px;max-height:none!important;height:auto!important}
      #view-rules .rules-section-pane[data-rules-pane="skills"] .rules-grid-two{
        grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);
      }
      #view-rules .skill-master-list{
        max-height:none!important;height:auto!important;overflow:visible!important;
      }
      #view-rules .employee-skill-table-wrap,
      #view-rules .rules-table-wrap{
        max-height:none!important;height:auto!important;
        overflow-x:auto!important;
        overflow-y:visible!important;
      }
      #view-rules .employee-skills-card,
      #view-rules .rules-requirements-card,
      #view-rules .rules-card{
        max-height:none!important;height:auto!important;
      }

      @media(max-width:900px){
        #view-rules .rules-section-tabs{grid-template-columns:1fr}
        #view-rules .rules-section-pane[data-rules-pane="skills"] .rules-grid-two{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }
})();
