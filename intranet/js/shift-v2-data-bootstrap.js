(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';

  const DEFAULT_SKILLS = [
    { id: 'opening', name: 'オープン準備', active: true },
    { id: 'closing', name: '締め作業', active: true },
    { id: 'meat', name: '肉場', active: true },
    { id: 'salad', name: 'サラダ場', active: true },
    { id: 'hall', name: 'ホール', active: true },
    { id: 'drink', name: 'ドリンク', active: true },
    { id: 'dish', name: '洗い場', active: true },
    { id: 'register', name: 'レジ', active: true },
  ];

  const LEGACY_SKILL_MAP = {
    'オープン準備': 'opening',
    '締め作業': 'closing',
    '肉場': 'meat',
    'サラダ場': 'salad',
    'ホール': 'hall',
    'ホール（肉焼ける）': 'hall',
    'ホール（肉焼けない）': 'hall',
    'ドリンク': 'drink',
    'ドリンカー': 'drink',
    '洗い場': 'dish',
    'レジ': 'register',
  };

  const DEFAULT_REQUIREMENTS = [
    req('matsuyama', 'all', 17, 23, 'hall', 1, 4),
    req('matsuyama', 'all', 17, 23, 'meat', 2, 2),
    req('matsuyama', 'all', 17, 23, 'salad', 1, 1),
    req('matsuyama', 'all', 17, 23, 'drink', 1, 1),
    req('matsuyama', 'all', 23, 30, 'hall', 1, 2),
    req('matsuyama', 'all', 23, 30, 'meat', 2, 1),
    req('matsuyama', 'all', 25, 30, 'closing', 2, 1),

    req('kumoji', 'all', 17, 22, 'hall', 1, 3),
    req('kumoji', 'all', 17, 22, 'meat', 2, 1),
    req('kumoji', 'all', 17, 22, 'salad', 1, 1),
    req('kumoji', 'all', 17, 22, 'drink', 1, 1),
    req('kumoji', 'all', 22, 25, 'hall', 1, 2),
    req('kumoji', 'all', 24, 25, 'closing', 2, 1),

    req('miebashi', 'all', 17, 22, 'hall', 1, 2),
    req('miebashi', 'all', 17, 22, 'meat', 2, 1),
    req('miebashi', 'all', 17, 22, 'drink', 1, 1),
    req('miebashi', 'all', 22, 25, 'hall', 1, 2),
    req('miebashi', 'all', 24, 25, 'closing', 2, 1),

    req('misato', 'all', 17, 22, 'hall', 1, 2),
    req('misato', 'all', 17, 22, 'meat', 2, 1),
    req('misato', 'all', 17, 22, 'salad', 1, 1),
    req('misato', 'all', 17, 22, 'drink', 1, 1),
    req('misato', 'all', 22, 26, 'hall', 1, 2),
    req('misato', 'all', 25, 26, 'closing', 2, 1),
  ];

  let changed = false;

  const skills = readArray(SKILLS_KEY);
  if (!skills.length) {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(DEFAULT_SKILLS));
    changed = true;
  }

  const requirements = readArray(REQUIREMENTS_KEY);
  if (!requirements.length) {
    localStorage.setItem(REQUIREMENTS_KEY, JSON.stringify(DEFAULT_REQUIREMENTS));
    changed = true;
  }

  const staff = readArray(STAFF_KEY);
  if (staff.length) {
    let staffChanged = false;
    staff.forEach(person => {
      if (!person || typeof person !== 'object') return;

      if (!person.employmentType && person.salaryType) {
        person.employmentType = person.salaryType === 'monthly' ? '正社員' : 'アルバイト';
        staffChanged = true;
      }

      const levels = { ...(person.skillLevels || {}) };
      DEFAULT_SKILLS.forEach(skill => {
        const n = Number(levels[skill.id]);
        levels[skill.id] = Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0;
      });

      (Array.isArray(person.skills) ? person.skills : []).forEach(name => {
        const id = LEGACY_SKILL_MAP[name];
        if (id && Number(levels[id] || 0) === 0) {
          levels[id] = 1;
          staffChanged = true;
        }
      });

      if (!person.skillLevels || DEFAULT_SKILLS.some(skill => Number(person.skillLevels?.[skill.id] ?? -1) !== Number(levels[skill.id]))) {
        person.skillLevels = levels;
        staffChanged = true;
      }
    });

    if (staffChanged) {
      localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
      changed = true;
    }
  }

  window.shiftV2BootstrapDefaults = {
    skills: DEFAULT_SKILLS,
    requirements: DEFAULT_REQUIREMENTS,
    seeded: changed,
  };

  function req(storeId, dayType, startHour, endHour, skillId, minLevel, count, mode = 'hard') {
    return {
      id: `r_${storeId}_${dayType}_${startHour}_${endHour}_${skillId}_${minLevel}_${count}`,
      storeId,
      dayType,
      specificDate: '',
      start: startHour * 60,
      end: endHour * 60,
      skillId,
      minLevel,
      count,
      mode,
      active: true,
    };
  }

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
})();