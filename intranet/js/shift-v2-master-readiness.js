(() => {
  'use strict';

  const KEY = 'okk_shift_v2_master_readiness_v1';
  const STYLE_ID = 'shift-v2-master-readiness-style';
  const PANEL_ID = 'master-readiness-panel';
  const BANNER_ID = 'master-readiness-banner';

  if (window.__shiftV2MasterReadinessInstalled) return;
  window.__shiftV2MasterReadinessInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    installPanel();
    patchMonthUi();
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    document.addEventListener('shiftv2-master-readiness-changed', () => {
      renderPanel();
      patchMonthUi();
    });
    window.addEventListener('storage', event => {
      if (event.key !== KEY) return;
      renderPanel();
      patchMonthUi();
    });
  }

  function state() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      return {
        staffSkillsConfirmed: Boolean(value?.staffSkillsConfirmed),
        staffingNeedConfirmed: Boolean(value?.staffingNeedConfirmed),
        staffingNeedConfirmedStores: Array.isArray(value?.staffingNeedConfirmedStores) ? value.staffingNeedConfirmedStores.map(String) : [],
        updatedAt: value?.updatedAt || ''
      };
    } catch {
      return { staffSkillsConfirmed:false, staffingNeedConfirmed:false, staffingNeedConfirmedStores:[], updatedAt:'' };
    }
  }

  function save(next) {
    const value = { ...next, updatedAt:new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(value));
    renderPanel();
    patchMonthUi();
    document.dispatchEvent(new CustomEvent('shiftv2-master-readiness-changed', { detail:value }));
  }

  function isConfirmed(s = state()) {
    return s.staffSkillsConfirmed && s.staffingNeedConfirmed;
  }

  function installPanel() {
    const view = document.getElementById('view-rules') || document.getElementById('view-constraints');
    if (!view || document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'master-readiness-panel';
    panel.innerHTML = `
      <div class="mr-head">
        <div>
          <span class="mr-kicker">MASTER STATUS</span>
          <h3>マスタ確認状態</h3>
          <p>現場確認前は「仮設定」。両方を確認済みにすると、不足判定を正式値として扱います。</p>
        </div>
        <span id="mr-status" class="mr-status provisional">仮設定</span>
      </div>
      <div class="mr-checks">
        <label><input type="checkbox" id="mr-staff-skills"> 人員・スキルを現場確認済み</label>
        <label><input type="checkbox" id="mr-staffing-need"> 店舗別・時間別の必要人数を現場確認済み</label>
      </div>
      <div class="mr-note">今の仮データでもシフト作成ロジックは動かせます。ただし不足日数・不足人数は参考値として見てください。</div>`;
    const target = view.querySelector('.rs-wrap,.rules-wrap,.view-body') || view.firstElementChild || view;
    target.prepend(panel);
    renderPanel();
  }

  function renderPanel() {
    const s = state();
    const staff = document.getElementById('mr-staff-skills');
    const need = document.getElementById('mr-staffing-need');
    if (staff) staff.checked = s.staffSkillsConfirmed;
    if (need) need.checked = s.staffingNeedConfirmed;
    const status = document.getElementById('mr-status');
    if (status) {
      const confirmed = isConfirmed(s);
      const text = confirmed ? '正式マスタ' : '仮設定';
      const className = `mr-status ${confirmed ? 'confirmed' : 'provisional'}`;
      if (status.textContent !== text) status.textContent = text;
      if (status.className !== className) status.className = className;
    }
  }

  function patchMonthUi() {
    // 月間画面の正式/仮マスタ表示は「反映判定」パネルに一本化する。
    document.getElementById(BANNER_ID)?.remove();

    const summary = document.getElementById('month-builder-summary');
    if (!summary) return;
    const confirmed = isConfirmed(state());
    const metrics = Array.from(summary.querySelectorAll('.month-metric'));
    const shortage = metrics.find(metric => {
      const label = metric.querySelector('small')?.textContent?.trim() || '';
      return label === '不足' || label === '不足（仮判定）' || label === '残る不足';
    });

    if (shortage) {
      const label = shortage.querySelector('small');
      const nextLabel = confirmed ? '不足' : '不足（仮判定）';
      if (label && label.textContent !== nextLabel) label.textContent = nextLabel;
      shortage.classList.toggle('mr-provisional-metric', !confirmed);
    }
  }

  function onChange(event) {
    if (!['mr-staff-skills','mr-staffing-need'].includes(event.target?.id)) return;
    const current = state();
    save({
      ...current,
      staffSkillsConfirmed: document.getElementById('mr-staff-skills')?.checked || false,
      staffingNeedConfirmed: document.getElementById('mr-staffing-need')?.checked || false,
    });
  }

  function onClick(event) {
    if (event.target.closest?.('[data-view="rules"]')) {
      setTimeout(() => { installPanel(); renderPanel(); }, 60);
    }
    if (event.target.closest?.('#month-builder-open,#month-builder-calc')) {
      setTimeout(patchMonthUi, 80);
      setTimeout(patchMonthUi, 260);
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .master-readiness-panel{margin:0 0 14px;padding:14px 16px;border:1px solid #fedf89;border-radius:12px;background:#fffaeb;font-family:'Noto Sans JP',sans-serif}
      .mr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.mr-kicker{display:block;font-size:8px;font-weight:900;letter-spacing:.08em;color:#b54708}.mr-head h3{margin:2px 0 3px;font-size:14px;color:#101828}.mr-head p{margin:0;font-size:9px;color:#667085;font-weight:700;line-height:1.6}.mr-status{border-radius:999px;padding:5px 9px;font-size:9px;font-weight:900;white-space:nowrap}.mr-status.provisional{background:#fef0c7;color:#b54708}.mr-status.confirmed{background:#dcfae6;color:#067647}.mr-checks{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.mr-checks label{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid #e4e7ec;border-radius:8px;padding:8px 10px;font-size:9px;font-weight:800;color:#344054}.mr-note{margin-top:9px;font-size:8px;font-weight:700;color:#93370d;line-height:1.6}.mr-provisional-metric{border-color:#fedf89!important;background:#fffaeb!important}
      @media(max-width:700px){.mr-head{flex-direction:column}.mr-checks{flex-direction:column}.mr-checks label{width:100%}}
    `;
    document.head.appendChild(style);
  }
})();
