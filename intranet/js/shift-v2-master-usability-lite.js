(() => {
  'use strict';

  const STYLE_ID = 'shift-v2-master-usability-style';
  let syncing = false;
  let resizeTimer = null;
  let refreshTimer = null;

  if (window.__shiftV2MasterUsabilityLiteInstalled) return;
  window.__shiftV2MasterUsabilityLiteInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    bindEvents();
    scheduleRefresh(180);
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncScrollerWidth, 120);
    });
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      if (event.target.closest?.('.tab[data-view="master"],[data-unified-master="employees"],#master-manage-skills')) scheduleRefresh(60);
      if (event.target.closest?.('[data-master-skill],#master-sync-cloud')) scheduleRefresh(40);
    }, true);

    document.addEventListener('input', event => {
      if (event.target?.matches?.('#master-search')) scheduleRefresh(20);
    }, false);

    document.addEventListener('change', event => {
      if (event.target?.matches?.('#master-employment,#master-store,#master-inactive')) scheduleRefresh(20);
      if (event.target?.matches?.('input[type="radio"][data-master-plan],select[data-master-plan]')) scheduleRefresh(20);
    }, false);

    document.addEventListener('shiftv2-auth', () => scheduleRefresh(260));
    document.addEventListener('shiftv2-access-changed', () => scheduleRefresh(40));
  }

  function scheduleRefresh(delay = 0) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, delay);
  }

  function refresh() {
    decoratePlanCells();
    installTopScroller();
    syncScrollerWidth();
  }

  function decoratePlanCells() {
    document.querySelectorAll('#master-body .master-plan-cell').forEach(cell => {
      const select = cell.querySelector('select[data-master-plan]');
      if (!select) {
        const group = cell.querySelector('.master-plan-radios');
        if (group) updateSelected(group);
        return;
      }
      const personId = select.dataset.masterPlan || '';
      const selected = select.value || '';
      const aria = select.getAttribute('aria-label') || `${personId} A/Bプラン`;
      cell.innerHTML = `<div class="master-plan-radios" role="radiogroup" aria-label="${esc(aria)}"><label class="plan-radio plan-a ${selected === 'A' ? 'selected' : ''}"><input type="radio" data-master-plan="${esc(personId)}" name="master-plan-${escAttr(personId)}" value="A" ${selected === 'A' ? 'checked' : ''}><span>A</span></label><label class="plan-radio plan-b ${selected === 'B' ? 'selected' : ''}"><input type="radio" data-master-plan="${esc(personId)}" name="master-plan-${escAttr(personId)}" value="B" ${selected === 'B' ? 'checked' : ''}><span>B</span></label></div>`;
    });
  }

  function updateSelected(group) {
    const checked = group.querySelector('input:checked')?.value || '';
    group.querySelectorAll('.plan-radio').forEach(label => label.classList.toggle('selected', label.querySelector('input')?.value === checked));
  }

  function installTopScroller() {
    const wrap = document.querySelector('#view-master .master-table-wrap');
    if (!wrap || document.getElementById('master-top-scroll')) return;
    const top = document.createElement('div');
    top.id = 'master-top-scroll';
    top.setAttribute('aria-label', '従業員マスタ横スクロール');
    top.innerHTML = '<div id="master-top-scroll-inner"></div>';
    wrap.insertAdjacentElement('beforebegin', top);

    top.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      wrap.scrollLeft = top.scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    }, { passive:true });
    wrap.addEventListener('scroll', () => {
      if (syncing) return;
      syncing = true;
      top.scrollLeft = wrap.scrollLeft;
      requestAnimationFrame(() => { syncing = false; });
    }, { passive:true });
  }

  function syncScrollerWidth() {
    const wrap = document.querySelector('#view-master .master-table-wrap');
    const inner = document.getElementById('master-top-scroll-inner');
    const top = document.getElementById('master-top-scroll');
    const table = wrap?.querySelector('.master-table');
    if (!wrap || !inner || !top || !table) return;
    const width = Math.max(table.scrollWidth, wrap.clientWidth);
    if (inner.dataset.width !== String(width)) {
      inner.dataset.width = String(width);
      inner.style.width = `${width}px`;
    }
    top.style.display = width > wrap.clientWidth + 2 ? 'block' : 'none';
    if (Math.abs(top.scrollLeft - wrap.scrollLeft) > 1) top.scrollLeft = wrap.scrollLeft;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `#view-master .master-plan-head{min-width:82px!important;width:82px!important}#view-master .master-plan-cell{min-width:82px!important;width:82px!important;padding-left:5px!important;padding-right:5px!important}#view-master .master-plan-radios{display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap}#view-master .plan-radio{position:relative;display:flex;align-items:center;justify-content:center;width:31px;height:28px;border:1px solid #d0d5dd;border-radius:7px;background:#fff;color:#667085;font-size:11px;font-weight:900;cursor:pointer;transition:.12s ease}#view-master .plan-radio input{position:absolute;opacity:0;pointer-events:none}#view-master .plan-radio:hover{border-color:#98a2b3;background:#f9fafb}#view-master .plan-radio.selected{border-color:#344054;background:#344054;color:#fff;box-shadow:0 0 0 1px rgba(52,64,84,.08)}#master-top-scroll{height:18px;overflow-x:auto;overflow-y:hidden;margin:0 4px 7px;border-radius:6px;background:#f8fafc;border:1px solid #eaecf0}#master-top-scroll-inner{height:1px}#master-top-scroll::-webkit-scrollbar{height:14px}#master-top-scroll::-webkit-scrollbar-track{background:#f2f4f7;border-radius:999px}#master-top-scroll::-webkit-scrollbar-thumb{background:#98a2b3;border:3px solid #f2f4f7;border-radius:999px}`;
    document.head.appendChild(style);
  }

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
  function escAttr(value) { return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '_'); }
})();
