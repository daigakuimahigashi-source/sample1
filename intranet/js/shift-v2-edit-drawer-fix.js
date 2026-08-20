(() => {
  'use strict';

  if (window.__shiftV2EditDrawerFixInstalled) return;
  window.__shiftV2EditDrawerFixInstalled = true;

  document.addEventListener('click', event => {
    const edit = event.target.closest?.('#view-planner [data-select]');
    if (!edit) return;

    // V2本体の選択・詳細描画が終わった直後に、詳細ドロワーを開く。
    [0, 30, 100].forEach(delay => {
      setTimeout(() => {
        const panel = document.querySelector('#view-planner .inspector-panel');
        const detail = document.getElementById('inspector');
        if (!panel || !detail) return;
        if (detail.querySelector('.empty') || !detail.textContent.trim()) return;
        panel.classList.add('okk-inspector-open');
      }, delay);
    });
  }, true);
})();
