(() => {
  'use strict';

  const SESSION_KEY = 'okk_shift_v2_editor_session';
  const HEARTBEAT_MS = 60 * 1000;
  const TAKEOVER_CHECK_MS = 30 * 1000;
  const STYLE_ID = 'shift-v2-access-control-style';
  let user = null;
  let isAdmin = false;
  let authResolved = false;
  let lease = null;
  let mode = 'signed-out';
  let heartbeat = null;
  let takeoverTimer = null;
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }

  if (window.__shiftV2AccessControlInstalled) return;
  window.__shiftV2AccessControlInstalled = true;

  injectStyles();
  installGuards();
  render();
  document.addEventListener('shiftv2-auth', onAuth);
  document.addEventListener('shiftv2-editor-lease', event => {
    lease = event.detail?.lease || null;
    recalcMode();
  });
  window.addEventListener('beforeunload', () => {
    if (mode === 'editor') window.shiftV2EditorLease?.release?.(user, sessionId).catch?.(() => {});
  });

  window.shiftV2Access = {
    get mode(){ return mode; },
    get lease(){ return lease; },
    get authResolved(){ return authResolved; },
    canEditHeadquarters(){ return mode === 'editor'; },
    canUseManagerFunctions(){ return mode === 'editor' || mode === 'admin-viewer'; },
    isSignedIn(){ return Boolean(user); },
    assertEdit(){
      if (mode === 'editor') return true;
      notifyLocked();
      return false;
    },
  };

  async function onAuth(event) {
    authResolved = true;
    const nextUser = event.detail?.user || null;
    const nextAdmin = Boolean(event.detail?.admin);
    const previousUser = user;
    const wasEditor = mode === 'editor';

    if (wasEditor && previousUser && (!nextUser || nextUser.uid !== previousUser.uid)) {
      try { await window.shiftV2EditorLease?.release?.(previousUser, sessionId); } catch (error) { console.warn('Editor lease release failed', error); }
    }

    user = nextUser;
    isAdmin = nextAdmin;
    stopHeartbeat();
    stopTakeoverTimer();

    if (!user) {
      mode = 'signed-out';
      render();
      return;
    }
    if (!isAdmin) {
      mode = 'no-access';
      render();
      return;
    }
    await tryAcquire();
  }

  async function tryAcquire() {
    try {
      const result = await window.shiftV2EditorLease?.acquire?.(user, sessionId);
      lease = result?.lease || lease;
      mode = result?.acquired ? 'editor' : 'admin-viewer';
      if (mode === 'editor') startHeartbeat();
      else startTakeoverTimer();
    } catch (error) {
      console.warn('Editor lease acquire failed', error);
      mode = 'admin-viewer';
      startTakeoverTimer();
    }
    render();
  }

  function recalcMode() {
    if (!authResolved) mode = 'signed-out';
    else if (!user) mode = 'signed-out';
    else if (!isAdmin) mode = 'no-access';
    else if (lease && lease.uid === user.uid && lease.sessionId === sessionId && Number(lease.expiresAt || 0) > Date.now()) mode = 'editor';
    else mode = 'admin-viewer';

    if (mode === 'editor') {
      stopTakeoverTimer();
      startHeartbeat();
    } else {
      stopHeartbeat();
      if (mode === 'admin-viewer') startTakeoverTimer();
    }
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
  function stopHeartbeat() { if (heartbeat) clearInterval(heartbeat); heartbeat = null; }

  function startTakeoverTimer() {
    if (takeoverTimer) return;
    takeoverTimer = setInterval(() => {
      if (!user || !isAdmin || mode === 'editor') return;
      const sameAccount = lease && lease.uid === user.uid;
      if (sameAccount || !lease || Number(lease.expiresAt || 0) <= Date.now()) tryAcquire();
    }, TAKEOVER_CHECK_MS);
  }
  function stopTakeoverTimer() { if (takeoverTimer) clearInterval(takeoverTimer); takeoverTimer = null; }

  function installGuards() {
    const headquartersOnly = [
      '#save-btn','#settings-btn','#settings-save','#settings-reset',
      '#mf-staff-import','#mf-staff-file','#master-sync-cloud',
      '#month-builder-open','#month-builder-calc','#month-builder-apply',
      '[data-auto]','[data-select]','[data-handle]',
      '.hrm-cell','[data-stable-confirm="need"]'
    ].join(',');

    const anySignedInManager = [
      '#rs-staff-body .rs-lv',
      '[data-card-skill]'
    ].join(',');

    const guard = event => {
      const target = event.target?.closest?.(`${headquartersOnly},${anySignedInManager}`);
      if (!target) return;
      const managerAllowed = target.matches?.(anySignedInManager) || target.closest?.(anySignedInManager);
      const allowed = managerAllowed ? (mode === 'editor' || mode === 'admin-viewer') : mode === 'editor';
      if (allowed) return;
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
  }

  function render() {
    renderBanner();
    applyReadonlyUi();
    document.dispatchEvent(new CustomEvent('shiftv2-access-changed', { detail:{ mode, lease, user, authResolved } }));
  }

  function renderBanner() {
    let bar = document.getElementById('shift-v2-access-banner');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'shift-v2-access-banner';
      document.querySelector('.topbar')?.insertAdjacentElement('afterend', bar);
    }
    if (!bar) return;
    if (mode === 'signed-out') {
      bar.className = 'access-banner viewer';
      bar.innerHTML = '<strong>ログインが必要です</strong><span>Googleアカウントでログインしてください。</span>';
      return;
    }
    if (mode === 'no-access') {
      bar.className = 'access-banner viewer';
      bar.innerHTML = '<strong>権限未登録</strong><span>このGoogleアカウントにはOKKシフトの利用権限が登録されていません。</span>';
      return;
    }
    if (mode === 'editor') {
      bar.className = 'access-banner editor';
      bar.innerHTML = `<strong>本部編集モード</strong><span>${esc(user?.displayName || user?.email || '本部管理者')}さんが編集席を使用中</span>`;
      return;
    }
    const holder = lease && Number(lease.expiresAt || 0) > Date.now() ? (lease.displayName || lease.email || '別の本部管理者') : '別の本部管理者';
    bar.className = 'access-banner viewer';
    bar.innerHTML = `<strong>閲覧・店長相当モード</strong><span>${esc(holder)}さんが本部編集モードを使用中です。</span>`;
  }

  function applyReadonlyUi() {
    const headquartersReadonly = mode !== 'editor';
    document.documentElement.classList.toggle('shift-v2-headquarters-readonly', headquartersReadonly);
    document.documentElement.classList.toggle('shift-v2-no-access', mode === 'signed-out' || mode === 'no-access');
    ['save-btn','settings-btn','settings-save','settings-reset','mf-staff-import','master-sync-cloud','month-builder-calc','month-builder-apply'].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.disabled = headquartersReadonly;
    });
    const masterTab = document.querySelector('.tab[data-view="master"]');
    if (masterTab) masterTab.hidden = headquartersReadonly;
    document.querySelectorAll('.hrm-cell').forEach(node => { node.disabled = headquartersReadonly || !document.getElementById('stable-store')?.value; });
    document.querySelectorAll('[data-auto]').forEach(node => { node.disabled = headquartersReadonly; });
    document.querySelectorAll('.staff-card').forEach(node => { node.setAttribute('draggable', mode === 'editor' ? 'true' : 'false'); });
  }

  function notifyLocked() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    let message = 'この操作は現在できません';
    if (mode === 'signed-out') message = 'Googleログイン後に操作できます';
    else if (mode === 'no-access') message = 'このアカウントには利用権限がありません';
    else if (mode === 'admin-viewer') {
      const holder = lease && Number(lease.expiresAt || 0) > Date.now() ? (lease.displayName || lease.email || '別の本部管理者') : '別の本部管理者';
      message = `${holder}さんが本部編集モードを使用中です`;
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
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
