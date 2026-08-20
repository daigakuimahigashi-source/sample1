(() => {
  'use strict';

  const STYLE_ID = 'shift-v2-auth-gate-style';
  const GATE_ID = 'shift-v2-auth-gate';
  let resolved = false;
  let currentUser = null;
  let currentAdmin = false;

  if (window.__shiftV2AuthGateInstalled) return;
  window.__shiftV2AuthGateInstalled = true;

  injectStyles();
  installGate();
  document.addEventListener('shiftv2-auth', event => {
    resolved = true;
    currentUser = event.detail?.user || null;
    currentAdmin = Boolean(event.detail?.admin);
    render();
  });

  function installGate() {
    if (document.getElementById(GATE_ID)) return;
    const gate = document.createElement('div');
    gate.id = GATE_ID;
    gate.innerHTML = `
      <div class="auth-gate-card">
        <div class="auth-gate-mark"><i class="fa-solid fa-chart-gantt"></i></div>
        <h1>OKK シフトプランナー</h1>
        <p id="auth-gate-message">ログイン状態を確認しています…</p>
        <button id="auth-gate-login" type="button" class="auth-gate-login" disabled>
          <i class="fa-brands fa-google"></i><span>Googleでログイン</span>
        </button>
        <button id="auth-gate-retry" type="button" class="auth-gate-retry" hidden>もう一度確認</button>
        <small>登録されたGoogleアカウントでログインしてください。</small>
      </div>`;
    document.body.appendChild(gate);

    document.getElementById('auth-gate-login')?.addEventListener('click', async () => {
      const button = document.getElementById('auth-gate-login');
      const message = document.getElementById('auth-gate-message');
      if (!window.shiftV2Login) {
        if (message) message.textContent = 'ログイン機能を読み込み中です。数秒後にもう一度押してください。';
        return;
      }
      button.disabled = true;
      if (message) message.textContent = 'Googleログインを開いています…';
      try {
        await window.shiftV2Login();
      } catch (error) {
        console.warn('Google login failed', error);
        button.disabled = false;
        if (message) message.textContent = error?.code === 'auth/popup-closed-by-user' ? 'ログインがキャンセルされました。' : 'ログインできませんでした。もう一度お試しください。';
      }
    });

    document.getElementById('auth-gate-retry')?.addEventListener('click', () => window.location.reload());
    render();
  }

  function render() {
    const gate = document.getElementById(GATE_ID);
    const login = document.getElementById('auth-gate-login');
    const retry = document.getElementById('auth-gate-retry');
    const message = document.getElementById('auth-gate-message');
    if (!gate || !login || !message) return;

    if (!resolved) {
      gate.classList.remove('hidden');
      login.disabled = !window.shiftV2Login;
      login.hidden = false;
      retry.hidden = true;
      message.textContent = window.shiftV2Login ? 'Googleアカウントでログインしてください。' : 'ログイン状態を確認しています…';
      return;
    }

    if (!currentUser) {
      gate.classList.remove('hidden');
      login.disabled = false;
      login.hidden = false;
      retry.hidden = true;
      message.textContent = 'Googleアカウントでログインしてください。';
      return;
    }

    if (!currentAdmin) {
      gate.classList.remove('hidden');
      login.hidden = true;
      retry.hidden = false;
      message.innerHTML = `このアカウントには利用権限がありません。<br><strong>${esc(currentUser.email || '')}</strong>`;
      return;
    }

    gate.classList.add('hidden');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${GATE_ID}{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;background:#f4f7fb;font-family:'Noto Sans JP',sans-serif;padding:24px}
      #${GATE_ID}.hidden{display:none!important}
      #${GATE_ID} .auth-gate-card{width:min(420px,94vw);background:#fff;border:1px solid #e4e7ec;border-radius:18px;padding:34px 32px;text-align:center;box-shadow:0 18px 54px rgba(16,24,40,.12)}
      #${GATE_ID} .auth-gate-mark{display:grid;place-items:center;width:52px;height:52px;margin:0 auto 14px;border-radius:14px;background:#101828;color:#fff;font-size:21px}
      #${GATE_ID} h1{margin:0;color:#101828;font-size:20px;font-weight:900}
      #${GATE_ID} p{margin:10px 0 20px;color:#475467;font-size:11px;line-height:1.8}
      #${GATE_ID} .auth-gate-login{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid #d0d5dd;border-radius:10px;background:#fff;color:#344054;padding:11px 14px;font-size:12px;font-weight:900;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.05)}
      #${GATE_ID} .auth-gate-login:hover:not(:disabled){background:#f9fafb}
      #${GATE_ID} .auth-gate-login:disabled{opacity:.5;cursor:wait}
      #${GATE_ID} .auth-gate-retry{border:0;border-radius:9px;background:#101828;color:#fff;padding:10px 15px;font-size:11px;font-weight:900;cursor:pointer}
      #${GATE_ID} small{display:block;margin-top:13px;color:#98a2b3;font-size:9px}
    `;
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
})();
