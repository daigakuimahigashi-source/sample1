(() => {
  'use strict';

  const EXCEPTION_STORAGE_KEY = 'okk_shift_v2_exceptions';

  document.addEventListener('shiftv2-access', apply);
  document.addEventListener('shiftv2-auth', () => setTimeout(apply, 0));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once:true });
  else setTimeout(apply, 0);

  const exceptionsRoot = () => document.getElementById('exception-list');
  setTimeout(() => {
    const root = exceptionsRoot();
    if (root) new MutationObserver(apply).observe(root, { childList:true, subtree:true });
  }, 100);

  document.addEventListener('click', event => {
    const access = window.shiftV2Access;
    if (!access) return;

    const supportType = event.target.closest('[data-exception-type="support_move"]');
    if (supportType && !access.can?.('shift.exception.support_move')) {
      block(event, '当日応援の登録は本部のみです');
      return;
    }

    const submit = event.target.closest('#view-exceptions #ex-submit');
    if (submit) {
      const activeType = document.querySelector('[data-exception-type].active')?.dataset.exceptionType || 'emergency_call';
      if (!canType(access, activeType)) block(event, 'この当日対応を登録する権限がありません');
      return;
    }

    const deleteButton = event.target.closest('[data-delete-exception]');
    if (deleteButton) {
      const record = findException(deleteButton.dataset.deleteException);
      if (record && !canType(access, record.type)) {
        block(event, `${label(record.type)}の削除権限がありません`);
      }
    }
  }, true);

  function apply() {
    const access = window.shiftV2Access;
    if (!access) return;

    const support = document.querySelector('[data-exception-type="support_move"]');
    if (support) support.style.display = access.can?.('shift.exception.support_move') ? '' : 'none';

    const skills = document.querySelector('[data-view="skills"]');
    if (skills) skills.style.display = access.roleId === 'employee' ? 'none' : '';

    document.querySelectorAll('[data-delete-exception]').forEach(button => {
      const record = findException(button.dataset.deleteException);
      button.style.display = record && canType(access, record.type) ? '' : 'none';
    });
  }

  function canType(access, type) {
    const permission = type === 'absence'
      ? 'shift.exception.absence'
      : type === 'support_move'
        ? 'shift.exception.support_move'
        : 'shift.exception.emergency_call';
    return Boolean(access.can?.(permission));
  }

  function findException(id) {
    const all = loadExceptions();
    for (const rows of Object.values(all)) {
      const record = Array.isArray(rows) ? rows.find(item => item?.id === id) : null;
      if (record) return record;
    }
    return null;
  }

  function loadExceptions() {
    try {
      const value = JSON.parse(localStorage.getItem(EXCEPTION_STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function label(type) {
    return type === 'absence' ? '欠勤' : type === 'support_move' ? '当日応援' : '臨時招集';
  }

  function block(event, message) {
    event.preventDefault();
    event.stopImmediatePropagation();
    notify(message);
  }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }
})();
