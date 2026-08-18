(() => {
  'use strict';
  const KEY = 'okk_shift_v2_staff';
  const saved = window.__shiftV2RulesBootstrap?.raw;
  if (typeof saved !== 'string') return;

  localStorage.setItem(KEY, saved);
  delete window.__shiftV2RulesBootstrap;

  const notifyRules = () => {
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, oldValue: '[]', newValue: saved, storageArea: localStorage }));
    } catch {
      const event = new Event('storage');
      Object.defineProperty(event, 'key', { value: KEY });
      window.dispatchEvent(event);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(notifyRules, 0), { once: true });
  else setTimeout(notifyRules, 0);
})();