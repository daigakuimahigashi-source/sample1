(() => {
  'use strict';

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
    addTopButton();
    relabelRulesTab();
    addGuide();
  }

  function addTopButton() {
    if (document.getElementById('easy-rules-open')) return;
    const anchor = document.getElementById('month-builder-open') || document.querySelector('.toolbar-left .btn');
    const parent = anchor?.parentElement;
    if (!parent) return;

    const button = document.createElement('button');
    button.id = 'easy-rules-open';
    button.type = 'button';
    button.className = 'btn btn-light';
    button.innerHTML = '<i class="fa-solid fa-users-gear"></i> 人員・スキル設定';
    button.title = 'スキル種類、従業員Lv、店舗・時間帯ごとの必要人数を設定';
    button.addEventListener('click', openRules);

    if (anchor.nextSibling) parent.insertBefore(button, anchor.nextSibling);
    else parent.appendChild(button);
  }

  function relabelRulesTab() {
    const tab = document.querySelector('.tab[data-view="rules"]');
    if (!tab) return;
    tab.innerHTML = '<i class="fa-solid fa-users-gear"></i> 人員・スキル設定';
  }

  function openRules() {
    const tab = document.querySelector('.tab[data-view="rules"]');
    if (tab) {
      tab.click();
      setTimeout(() => document.getElementById('view-rules')?.scrollIntoView({ block:'start', behavior:'smooth' }), 30);
      return;
    }
    const view = document.getElementById('view-rules');
    if (view) {
      document.querySelectorAll('.view').forEach(node => node.classList.toggle('active', node === view));
      view.scrollIntoView({ block:'start', behavior:'smooth' });
    }
  }

  function addGuide() {
    const view = document.getElementById('view-rules');
    if (!view || document.getElementById('rules-easy-guide')) return;
    const hero = view.querySelector('.rules-hero');
    if (!hero) return;

    const title = hero.querySelector('.rules-title');
    if (title) title.textContent = '人員・スキル設定';
    const sub = hero.querySelector('.rules-sub');
    if (sub) sub.textContent = 'ここだけ直せば月間AUTOの配置基準が変わります。基本は 1 → 2 → 3 の順で設定してください。';

    const guide = document.createElement('div');
    guide.id = 'rules-easy-guide';
    guide.className = 'rules-easy-guide';
    guide.innerHTML = `
      <button type="button" data-jump="skill-master-list"><b>1</b><span><strong>スキル種類</strong><small>肉場・ホールなどを追加/整理</small></span></button>
      <i class="fa-solid fa-chevron-right"></i>
      <button type="button" data-jump="employee-skill-body"><b>2</b><span><strong>スタッフLv</strong><small>0 未経験 / 1 できる / 2 責任者 / 3 教育</small></span></button>
      <i class="fa-solid fa-chevron-right"></i>
      <button type="button" data-jump="requirements-body"><b>3</b><span><strong>必要人数</strong><small>店舗・曜日・時間帯・Lv・人数</small></span></button>
    `;
    hero.insertAdjacentElement('afterend', guide);

    guide.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.jump);
      target?.closest('.rules-card')?.scrollIntoView({ behavior:'smooth', block:'start' });
    }));

    const skillHead = view.querySelector('.employee-skills-card .rules-card-head h2');
    if (skillHead) skillHead.textContent = '2. スタッフのスキルLv';
    const reqHead = view.querySelector('.rules-requirements-card .rules-card-head h2');
    if (reqHead) reqHead.textContent = '3. 店舗・時間帯ごとの必要人数';
    const masterHead = view.querySelector('.rules-grid-two .rules-card .rules-card-head h2');
    if (masterHead) masterHead.textContent = '1. スキル種類';
  }

  function injectStyles() {
    if (document.getElementById('rules-easy-entry-style')) return;
    const style = document.createElement('style');
    style.id = 'rules-easy-entry-style';
    style.textContent = `
      .rules-easy-guide{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr);gap:8px;align-items:center;margin:10px 0 14px}.rules-easy-guide>button{display:flex;align-items:center;gap:9px;text-align:left;background:#fff;border:1px solid #d0d5dd;border-radius:10px;padding:10px 12px;cursor:pointer;color:#344054}.rules-easy-guide>button:hover{border-color:#98a2b3;background:#f9fafb}.rules-easy-guide>button>b{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#101828;color:#fff;font-size:11px;flex:0 0 auto}.rules-easy-guide span{display:block;min-width:0}.rules-easy-guide strong{display:block;font-size:11px}.rules-easy-guide small{display:block;font-size:8px;color:#667085;margin-top:2px;white-space:normal}.rules-easy-guide>i{font-size:9px;color:#98a2b3}@media(max-width:900px){.rules-easy-guide{grid-template-columns:1fr}.rules-easy-guide>i{display:none}}
    `;
    document.head.appendChild(style);
  }
})();
