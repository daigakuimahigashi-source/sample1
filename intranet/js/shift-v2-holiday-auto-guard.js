(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const AUTO_ACTIONS = '#auto-placement-open, #auto-recalculate, #auto-include-soft, [data-auto-mode]';
  let restoring = false;

  document.addEventListener('click', guardAutoPlacement, true);
  document.addEventListener('change', guardAutoPlacement, true);

  function guardAutoPlacement(event) {
    if (restoring) return;
    const trigger = event.target.closest?.(AUTO_ACTIONS);
    if (!trigger) return;
    const holiday = window.shiftV2Holiday;
    if (!holiday) return;
    const date = document.getElementById('work-date')?.value || '';
    if (!date) return;

    if (holiday.isCompanyClosure(date)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      window.alert(`${date} は会社休業日です。通常の自動配置は実行しません。`);
      return;
    }

    const staff = loadStaff();
    const affected = staff.filter(person => holiday.isUnavailable(person.id, date));
    if (!affected.length) return;

    const backup = affected.map(person => ({
      id: String(person.id || '').toUpperCase(),
      hadAutoAssign: Object.prototype.hasOwnProperty.call(person, 'autoAssign'),
      autoAssign: person.autoAssign,
    }));

    const ids = new Set(backup.map(item => item.id));
    const filtered = staff.map(person => ids.has(String(person.id || '').toUpperCase()) ? { ...person, autoAssign: false } : person);
    localStorage.setItem(STAFF_KEY, JSON.stringify(filtered));

    queueMicrotask(() => {
      restoring = true;
      try {
        const current = loadStaff();
        const backupMap = new Map(backup.map(item => [item.id, item]));
        const restored = current.map(person => {
          const key = String(person.id || '').toUpperCase();
          const saved = backupMap.get(key);
          if (!saved) return person;
          const next = { ...person };
          if (saved.hadAutoAssign) next.autoAssign = saved.autoAssign;
          else delete next.autoAssign;
          return next;
        });
        localStorage.setItem(STAFF_KEY, JSON.stringify(restored));
      } finally {
        restoring = false;
      }
    });
  }

  function loadStaff() {
    try {
      const value = JSON.parse(localStorage.getItem(STAFF_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
})();