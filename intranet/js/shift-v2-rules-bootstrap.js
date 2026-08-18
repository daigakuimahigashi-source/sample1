(() => {
  'use strict';

  const KEY = 'okk_shift_v2_staff';
  if (window.__shiftV2RulesBootstrap) return;

  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  let staff;
  try { staff = JSON.parse(raw); } catch { return; }
  if (!Array.isArray(staff) || !staff.length) return;

  window.__shiftV2RulesBootstrap = { raw };
  localStorage.setItem(KEY, '[]');

  const restore = () => setTimeout(() => {
    const saved = window.__shiftV2RulesBootstrap?.raw;
    if (typeof saved !== 'string') return;
    localStorage.setItem(KEY, saved);
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, oldValue: '[]', newValue: saved, storageArea: localStorage }));
    } catch {
      const event = new Event('storage');
      Object.defineProperty(event, 'key', { value: KEY });
      window.dispatchEvent(event);
    }
    delete window.__shiftV2RulesBootstrap;
  }, 0);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restore, { once: true });
  else restore();
})();