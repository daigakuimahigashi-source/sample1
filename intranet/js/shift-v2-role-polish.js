(() => {
  'use strict';

  document.addEventListener('shiftv2-access', apply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once:true });
  else setTimeout(apply, 0);

  document.addEventListener('click', event => {
    const access = window.shiftV2Access;
    if (!access) return;

    const supportType = event.target.closest('[data-exception-type="support_move"]');
    if (supportType && !access.can?.('shift.exception.support_move')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify('当日応援の登録は本部のみです');
      return;
    }

    const submit = event.target.closest('#view-exceptions #ex-submit');
    if (!submit) return;
    const activeType = document.querySelector('[data-exception-type].active')?.dataset.exceptionType;
    const permission = activeType === 'absence'
      ? 'shift.exception.absence'
      : activeType === 'support_move'
        ? 'shift.exception.support_move'
        : 'shift.exception.emergency_call';
    if (!access.can?.(permission)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      notify('この当日対応を登録する権限がありません');
    }
  }, true);

  function apply() {
    const access = window.shiftV2Access;
    if (!access) return;
    const support = document.querySelector('[data-exception-type="support_move"]');
    if (support) support.style.display = access.can?.('shift.exception.support_move') ? '' : 'none';

    const skills = document.querySelector('[data-view="skills"]');
    if (skills) skills.style.display = access.roleId === 'employee' ? 'none' : '';
  }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }
})();
