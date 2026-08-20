(() => {
  'use strict';

  const ACTION_ID = 'stable-visible-delete';
  const STYLE_ID = 'stable-visible-delete-style';

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();

    document.addEventListener('click', event => {
      const edit = event.target.closest?.('#gantt-canvas [data-select], #gantt-canvas .shift-bar');
      if (!edit) return;

      [0, 40, 120, 260, 500].forEach(delay => setTimeout(ensureVisibleDelete, delay));
    }, false);

    document.addEventListener('click', event => {
      const visible = event.target.closest?.(`#${ACTION_ID}`);
      if (!visible) return;

      event.preventDefault();
      const core = document.getElementById('delete-shift');
      if (!core) return;

      core.click();
    }, false);
  }

  function ensureVisibleDelete() {
    const inspector = document.getElementById('inspector');
    const core = document.getElementById('delete-shift');
    if (!inspector || !core) return;

    let action = document.getElementById(ACTION_ID);
    if (!action) {
      action = document.createElement('button');
      action.id = ACTION_ID;
      action.type = 'button';
      action.className = 'stable-visible-delete';
      action.innerHTML = '<i class="fa-solid fa-trash"></i><span>配置を削除</span>';
      action.title = 'このスタッフのこの日の配置を削除';
    }

    const form = inspector.querySelector('.form-grid');
    if (form) form.insertAdjacentElement('afterend', action);
    else inspector.prepend(action);

    core.style.setProperty('display', 'none', 'important');
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #inspector .stable-visible-delete{
        display:inline-flex;align-items:center;justify-content:center;gap:6px;
        margin:8px 0 10px;padding:7px 10px;border:1px solid #fecdca;border-radius:8px;
        background:#fff;color:#b42318;font-size:10px;font-weight:800;cursor:pointer;box-shadow:none
      }
      #inspector .stable-visible-delete:hover{background:#fef3f2;border-color:#fda29b}
    `;
    document.head.appendChild(style);
  }
})();
