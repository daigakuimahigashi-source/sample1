(() => {
  'use strict';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    removeLegacyModal();

    document.addEventListener('click', event => {
      const trigger = event.target.closest?.('#easy-rules-open');
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openRulesView();
    }, true);
  }

  function openRulesView() {
    const view = document.getElementById('view-rules');
    if (!view) {
      window.alert('人員・スキル設定画面の初期化に失敗しています。ページを再読み込みしてください。');
      return;
    }

    window.shiftV2RulesSafe?.reload?.();
    window.shiftV2RulesSafe?.renderAll?.();

    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === 'rules'));
    document.querySelectorAll('.view').forEach(node => node.classList.toggle('active', node === view));
    document.body.classList.remove('rules-direct-lock');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function removeLegacyModal() {
    document.body.classList.remove('rules-direct-lock');
    document.getElementById('rules-direct-modal')?.remove();
    document.getElementById('rules-direct-style')?.remove();
  }
})();
