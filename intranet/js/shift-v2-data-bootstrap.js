(() => {
  'use strict';

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

  const DEFAULT_REQUIREMENTS = [
    req('matsuyama', 'all', 17, 23, 'hall', 1, 3),
    req('matsuyama', 'all', 17, 23, 'meat', 2, 1),
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