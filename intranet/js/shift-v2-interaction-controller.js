(() => {
  'use strict';

  const TAB_KEY = 'okk_shift_v2_rules_ui_tab';
  const VALID_TABS = ['staff', 'requirements', 'skills'];
  const STYLE_ID = 'shift-v2-interaction-controller-style';
  let ganttObserver = null;
  let tabRetryCount = 0;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    installRulesTabsWithRetry();
    installGanttDelete();

    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-view="rules"]')) {
        setTimeout(installRulesTabsWithRetry, 80);
      }
    }, false);
  }

  function installRulesTabsWithRetry() {
    const view = document.getElementById('view-rules');
    const oldNav = view?.querySelector('.rs-independent-tabs');
    if (!view || !oldNav) {
      if (tabRetryCount < 25) {
        tabRetryCount += 1;
        setTimeout(installRulesTabsWithRetry, 120);
      }
      return;
    }
    tabRetryCount = 0;

    if (oldNav.dataset.interactionController === '1') {
      activateRulesTab(sessionStorage.getItem(TAB_KEY) || 'staff', false);
      return;
    }

    // これまで複数ファイルで付いた古いクリックイベントを完全に捨てる。
    const nav = oldNav.cloneNode(true);
    nav.dataset.interactionController = '1';
    oldNav.replaceWith(nav);

    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-rs-tab]');
      if (!button || !nav.contains(button)) return;
      const key = String(button.dataset.rsTab || '');
      if (!VALID_TABS.includes(key)) return;
      event.preventDefault();
      event.stopPropagation();
      activateRulesTab(key, true);
    });

    activateRulesTab(sessionStorage.getItem(TAB_KEY) || 'staff', false);
  }

  function activateRulesTab(key, persist = true) {
    if (!VALID_TABS.includes(key)) key = 'staff';
    const view = document.getElementById('view-rules');
    if (!view) return;

    if (persist) sessionStorage.setItem(TAB_KEY, key);

    view.querySelectorAll('.rs-independent-tabs [data-rs-tab]').forEach(button => {
      const active = String(button.dataset.rsTab || '') === key;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    VALID_TABS.forEach(sectionKey => {
      const section = document.getElementById(`rs-${sectionKey}`);
      if (!section) return;
      const active = sectionKey === key;
      section.hidden = !active;
      section.setAttribute('aria-hidden', active ? 'false' : 'true');
      section.classList.toggle('rs-independent-active', active);
      section.style.setProperty('display', active ? 'block' : 'none', 'important');
      section.style.setProperty('visibility', active ? 'visible' : 'hidden', 'important');
    });

    if (key === 'requirements') {
      window.shiftV2SkillHourlyMatrix?.reload?.();
      const hearingStore = document.getElementById('fh-store')?.value || '';
      const hourlyStore = document.getElementById('hrm-store');
      if (hearingStore && hourlyStore && hourlyStore.value !== hearingStore) {
        hourlyStore.value = hearingStore;
        hourlyStore.dispatchEvent(new Event('change', { bubbles:true }));
      }
    }
  }

  function installGanttDelete() {
    const canvas = document.getElementById('gantt-canvas');
    if (!canvas) {
      setTimeout(installGanttDelete, 150);
      return;
    }

    enhanceGanttDeleteButtons();
    if (!ganttObserver) {
      ganttObserver = new MutationObserver(() => enhanceGanttDeleteButtons());
      ganttObserver.observe(canvas, { childList:true, subtree:true });
    }

    document.addEventListener('click', event => {
      const deleteButton = event.target.closest?.('[data-direct-delete-shift]');
      if (!deleteButton) return;

      event.preventDefault();
      event.stopPropagation();
      const shiftId = String(deleteButton.dataset.directDeleteShift || '');
      if (!shiftId) return;

      if (!window.confirm('この配置を削除しますか？')) return;

      // V2本体の既存削除処理を使う。これにより保存・再描画も既存ロジックに統一される。
      const editButton = Array.from(document.querySelectorAll('#gantt-canvas [data-select]'))
        .find(button => String(button.dataset.select || '') === shiftId);
      editButton?.click();

      setTimeout(() => {
        const coreDelete = document.getElementById('delete-shift');
        if (coreDelete) {
          coreDelete.click();
          showToast('配置を削除しました');
          return;
        }
        showToast('削除処理を開けませんでした。もう一度「編集」を押してください。');
      }, 40);
    }, false);
  }

  function enhanceGanttDeleteButtons() {
    document.querySelectorAll('#gantt-canvas [data-select]').forEach(editButton => {
      const shiftId = String(editButton.dataset.select || '');
      const cell = editButton.closest('.staff-cell');
      if (!shiftId || !cell) return;
      if (cell.querySelector(`[data-direct-delete-shift="${cssEscape(shiftId)}"]`)) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-small direct-shift-delete';
      button.dataset.directDeleteShift = shiftId;
      button.title = 'この配置を削除';
      button.innerHTML = '<i class="fa-solid fa-trash"></i><span>削除</span>';
      editButton.insertAdjacentElement('afterend', button);
    });
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
      return;
    }
    const node = document.createElement('div');
    node.className = 'interaction-controller-toast';
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2200);
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #gantt-canvas .staff-cell{gap:5px}
      #gantt-canvas .direct-shift-delete{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:54px;background:#fff;color:#b42318;border:1px solid #fecdca;font-weight:900}
      #gantt-canvas .direct-shift-delete:hover{background:#fef3f2;border-color:#fda29b}
      .interaction-controller-toast{position:fixed;left:50%;top:88px;transform:translateX(-50%);z-index:12000;background:#101828;color:#fff;padding:9px 13px;border-radius:9px;font:800 11px/1.5 'Noto Sans JP',sans-serif;box-shadow:0 12px 30px rgba(16,24,40,.22)}
    `;
    document.head.appendChild(style);
  }
})();
