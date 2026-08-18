(() => {
  'use strict';

  let rulesView = null;
  let placeholder = null;
  let previousClass = '';
  let previousStyle = '';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyle();
    ensureModal();

    document.addEventListener('click', event => {
      const trigger = event.target.closest?.('#easy-rules-open, .tab[data-view="rules"]');
      if (!trigger) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openDirect();
    }, true);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.getElementById('rules-direct-modal')?.classList.contains('open')) closeDirect();
    });
  }

  function ensureModal() {
    if (document.getElementById('rules-direct-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'rules-direct-modal';
    modal.className = 'rules-direct-modal';
    modal.innerHTML = `
      <div class="rules-direct-shell">
        <div class="rules-direct-head">
          <div>
            <strong>人員・スキル設定</strong>
            <small>スキル種類 → スタッフLv → 店舗・時間帯ごとの必要人数</small>
          </div>
          <button id="rules-direct-close" type="button" class="btn btn-light"><i class="fa-solid fa-xmark"></i> 閉じる</button>
        </div>
        <div id="rules-direct-body" class="rules-direct-body"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', event => { if (event.target === modal) closeDirect(); });
    modal.querySelector('#rules-direct-close')?.addEventListener('click', closeDirect);
  }

  function openDirect() {
    ensureModal();
    rulesView = document.getElementById('view-rules');
    if (!rulesView) {
      window.alert('人員・スキル設定画面の初期化に失敗しています。ページを再読み込みしてください。');
      return;
    }

    window.shiftV2RulesSafe?.reload?.();
    window.shiftV2RulesSafe?.renderAll?.();

    const body = document.getElementById('rules-direct-body');
    if (!body) return;
    if (rulesView.parentNode !== body) {
      placeholder = document.createComment('rules-view-placeholder');
      rulesView.parentNode?.insertBefore(placeholder, rulesView);
      previousClass = rulesView.className;
      previousStyle = rulesView.getAttribute('style') || '';
      body.appendChild(rulesView);
    }

    rulesView.classList.add('rules-direct-visible');
    rulesView.style.display = 'block';
    rulesView.style.width = '100%';
    document.getElementById('rules-direct-modal')?.classList.add('open');
    document.body.classList.add('rules-direct-lock');
  }

  function closeDirect() {
    const modal = document.getElementById('rules-direct-modal');
    modal?.classList.remove('open');
    document.body.classList.remove('rules-direct-lock');

    if (rulesView && placeholder?.parentNode) {
      placeholder.parentNode.insertBefore(rulesView, placeholder);
      placeholder.remove();
      placeholder = null;
      rulesView.className = previousClass || 'view';
      if (previousStyle) rulesView.setAttribute('style', previousStyle);
      else rulesView.removeAttribute('style');
    }
    rulesView = null;
  }

  function injectStyle() {
    if (document.getElementById('rules-direct-style')) return;
    const style = document.createElement('style');
    style.id = 'rules-direct-style';
    style.textContent = `
      body.rules-direct-lock{overflow:hidden!important}
      .rules-direct-modal{display:none;position:fixed;inset:0;z-index:20000;background:rgba(16,24,40,.55);padding:18px}
      .rules-direct-modal.open{display:block}
      .rules-direct-shell{height:calc(100vh - 36px);max-width:1480px;margin:0 auto;background:#f5f7fa;border-radius:14px;box-shadow:0 24px 70px rgba(16,24,40,.25);overflow:hidden;display:flex;flex-direction:column}
      .rules-direct-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 15px;background:#fff;border-bottom:1px solid #e4e7ec;flex:0 0 auto}
      .rules-direct-head strong{display:block;font-size:15px;color:#101828}
      .rules-direct-head small{display:block;font-size:8px;color:#667085;margin-top:2px}
      .rules-direct-body{padding:12px;overflow:auto;flex:1 1 auto;min-height:0}
      .rules-direct-body #view-rules.rules-direct-visible{display:block!important;margin:0!important;padding:0!important;max-width:none!important}
      @media(max-width:760px){.rules-direct-modal{padding:6px}.rules-direct-shell{height:calc(100vh - 12px)}.rules-direct-head small{display:none}}
    `;
    document.head.appendChild(style);
  }
})();
