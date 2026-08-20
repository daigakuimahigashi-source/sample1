(() => {
  'use strict';

  const SESSION_KEY = 'okk_shift_v2_editor_session';
  const HEARTBEAT_MS = 60 * 1000;
  const STYLE_ID = 'shift-v2-access-control-style';
  let user = null;
  let isAdmin = false;
  let lease = null;
  let mode = 'viewer';
  let heartbeat = null;
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  if (window.__shiftV2AccessControlInstalled) return;
  window.__shiftV2AccessControlInstalled = true;

  injectStyles();
  installGuards();
  document.addEventListener('shiftv2-auth', onAuth);
  document.addEventListener('shiftv2-editor-lease', event => {
    lease = event.detail?.lease || null;
    recalcMode();
  });
  document.addEventListener('DOMContentLoaded', () => setTimeout(render, 100), { once:true });
  window.addEventListener('beforeunload', () => {
    if (mode === 'editor') window.shiftV2EditorLease?.release?.(user, sessionId).catch?.(() => {});
  });

  window.shiftV2Access = {
    get mode(){ return mode; },
    get lease(){ return lease; },
    canEditHeadquarters(){ return mode === 'editor'; },
    assertEdit(){
      if (mode === 'editor') return true;
      notifyLocked();
      return false;
    },
  };

  async function onAuth(event) {
    user = event.detail?.user || null;
    isAdmin = Boolean(event.detail?.admin);
    stopHeartbeat();
    if (!user || !isAdmin) {
      mode = 'viewer';
      render();
      return;
    }
    try {
      const result = await window.shiftV2EditorLease?.acquire?.(user, sessionId);
      lease = result?.lease || lease;
      mode = result?.acquired ? 'editor' : 'viewer';
      if (mode === 'editor') startHeartbeat();
    } catch (error) {
      console.warn('Editor lease acquire failed', error);
      mode = 'viewer';
    }
    render();
  }

  function recalcMode() {
    if (!user || !isAdmin) mode = 'viewer';
    else mode = lease && lease.uid === user.uid && lease.sessionId === sessionId && Number(lease.expiresAt || 0) > Date.now() ? 'editor' : 'viewer';
    if (mode === 'editor') startHeartbeat(); else stopHeartbeat();
    render();
  }

  function startHeartbeat() {
    if (heartbeat) return;
    heartbeat = setInterval(async () => {
      try {
        const result = await window.shiftV2EditorLease?.renew?.(user, sessionId);
        lease = result?.lease || lease;
        if (!result?.renewed) recalcMode();
      } catch (error) {
        console.warn('Editor lease heartbeat failed', error);
      }
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
  }

  function installGuards() {
    const blockedSelector = [
      '#save-btn','#settings-btn','#settings-save','#settings-reset',
      '#mf-staff-import','#mf-staff-file','#master-sync-cloud',
      '#month-builder-open','#month-builder-calc','#month-builder-apply',
      '[data-auto]','[data-skill-person]','[data-select]','[data-handle]',
      '.hrm-cell','[data-stable-confirm="need"]'
    ].join(',');

    const guard = event => {
      if (mode === 'editor') return;
      const target = event.target?.closest?.(blockedSelector);
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      notifyLocked();
    };

    ['click','change','input','pointerdown','dragstart','drop'].forEach(type => document.addEventListener(type, guard, true));

    document.addEventListener('pointerdown', event => {
      if (mode === 'editor') return;
      if (!event.target?.closest?.('.shift-bar')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      notifyLocked();
    }, true);

    document.addEventListener('drop', event => {
      if (mode === 'editor') return;
      if (!event.target?.closest?.('#gantt-canvas,#empty-drop-track,.track')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      notifyLocked();
    }, true);
  }

  function render() {
    renderBanner();
    applyReadonlyUi();
    document.dispatchEvent(new CustomEvent('shiftv2-access-changed', { detail:{ mode, lease } }));
  }

  function renderBanner() {
    let bar = document.getElementById('shift-v2-access-banner');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'shift-v2-access-banner';
      document.querySelector('.topbar')?.insertAdjacentElement('afterend', bar);
    }
    if (!bar) return;
    if (!user) {
      bar.className = 'access-banner viewer';
      bar.innerHTML = '<strong>閲覧モード</strong><span>Googleログイン後、本部管理者は空いていれば編集席を取得します。</span>';
      return;
    }
    if (mode === 'editor') {
      bar.className = 'access-banner editor';
      bar.innerHTML = `<strong>本部編集モード</strong><span>${esc(user.displayName || user.email || '本部管理者')}さんが編集席を使用中</span>`;
      return;
    }
    const holder = lease && Number(lease.expiresAt || 0) > Date.now() ? (lease.displayName || lease.email || '別の本部管理者') : '別の本部管理者';
    bar.className = 'access-banner viewer';
    bar.innerHTML = `<strong>閲覧・店長相当モード</strong><span>${esc(holder)}さんが本部編集モードを使用中です。シフト・マスタ変更はできません。</span>`;
  }

  function applyReadonlyUi() {
    const readonly = mode !== 'editor';
    document.documentElement.classList.toggle('shift-v2-headquarters-readonly', readonly);
    ['save-btn','settings-btn','settings-save','settings-reset','mf-staff-import','master-sync-cloud','month-builder-calc','month-builder-apply'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.disabled = readonly;
    });
    const masterTab = document.querySelector('.tab[data-view="master"]');
    if (masterTab) masterTab.hidden = readonly;
    document.querySelectorAll('.hrm-cell').forEach(node => { node.disabled = readonly || !document.getElementById('stable-store')?.value; });
    document.querySelectorAll('[data-auto],[data-skill-person]').forEach(node => { node.disabled = readonly; });
    document.querySelectorAll('.staff-card').forEach(node => { if (readonly) node.setAttribute('draggable','false'); });
  }

  function notifyLocked() {
    const holder = lease && Number(lease.expiresAt || 0) > Date.now() ? (lease.displayName || lease.email || '別の本部管理者') : '別の本部管理者';
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = `${holder}さんが本部編集モードを使用中です`;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .access-banner{display:flex;align-items:center;gap:10px;padding:7px 16px;font:700 10px/1.5 'Noto Sans JP',sans-serif;border-bottom:1px solid #e4e7ec}
      .access-banner strong{font-size:10px}.access-banner span{color:#475467}
      .access-banner.editor{background:#ecfdf3;color:#067647;border-color:#abefc6}.access-banner.viewer{background:#fffaeb;color:#b54708;border-color:#fedf89}
      .shift-v2-headquarters-readonly #view-master{display:none!important}
      .shift-v2-headquarters-readonly .shift-bar{cursor:default!important}
      .shift-v2-headquarters-readonly [data-handle]{display:none!important}
      .shift-v2-headquarters-readonly #empty-drop-track{opacity:.65}
      .shift-v2-headquarters-readonly #settings-btn,.shift-v2-headquarters-readonly #save-btn{opacity:.45}
    `;
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
})();
