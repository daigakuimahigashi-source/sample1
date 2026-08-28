(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SOURCE = 'OKK_従業員スキル入力_詳細スキル版.xlsx';

  if (window.__shiftV2SkillStateProtectInstalled) return;
  window.__shiftV2SkillStateProtectInstalled = true;

  const originalSetItem = Storage.prototype.setItem;

  Storage.prototype.setItem = function(key, value) {
    if (this === window.localStorage && key === STAFF_KEY) {
      try {
        const incoming = JSON.parse(value);
        const previousRaw = originalGet(STAFF_KEY);
        const previous = previousRaw ? JSON.parse(previousRaw) : [];
        if (Array.isArray(incoming) && Array.isArray(previous) && previous.length) {
          value = JSON.stringify(preserveImportedSkills(incoming, previous));
        }
      } catch (error) {
        console.warn('Skill state protection skipped', error);
      }
    }

    const result = originalSetItem.call(this, key, value);
    if (this === window.localStorage && key === STAFF_KEY) {
      // Legacy employee-master may render from its old 8-skill state immediately after this write.
      // Re-run the dynamic renderer after that render completes.
      setTimeout(() => document.dispatchEvent(new CustomEvent('shiftv2-master-render-request')), 0);
      setTimeout(() => document.dispatchEvent(new CustomEvent('shiftv2-master-render-request')), 40);
    }
    return result;
  };

  function preserveImportedSkills(incoming, previous) {
    const byId = new Map();
    const byName = new Map();
    previous.forEach(person => {
      const id = normId(person?.id || person?.employeeNumber);
      const name = normName(person?.name);
      if (id) byId.set(id, person);
      if (name && !byName.has(name)) byName.set(name, person);
    });

    return incoming.map(person => {
      const id = normId(person?.id || person?.employeeNumber);
      const name = normName(person?.name);
      const old = (id && byId.get(id)) || (name && byName.get(name));
      if (!old) return person;

      const imported = old.skillSheetSource === SOURCE || Boolean(old.skillSheetImportedAt);
      if (!imported || !old.skillLevels || typeof old.skillLevels !== 'object') return person;

      // Imported spreadsheet values are the authoritative initial skill values.
      // Always preserve them here, including IDs that collide with legacy generic skills
      // such as hall / meat / salad.
      const next = { ...person, skillLevels:{ ...(person?.skillLevels || {}) } };
      Object.entries(old.skillLevels).forEach(([skillId, level]) => {
        next.skillLevels[skillId] = clamp(level);
      });
      next.skillSheetImportedAt = old.skillSheetImportedAt;
      next.skillSheetSource = old.skillSheetSource || SOURCE;
      if (old.skillSheetTrainingLevel != null) next.skillSheetTrainingLevel = old.skillSheetTrainingLevel;
      return next;
    });
  }

  function originalGet(key) {
    return Storage.prototype.getItem.call(window.localStorage, key);
  }

  function normId(value) {
    return String(value ?? '').trim().toUpperCase();
  }

  function normName(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/[\s\u3000・･.．,，]/g, '')
      .trim()
      .toLowerCase();
  }

  function clamp(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0;
  }
})();
