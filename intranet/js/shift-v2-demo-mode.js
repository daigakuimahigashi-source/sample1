(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const PLAN_KEY = 'okk_shift_v2_work_plans';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const RETURN_CANDIDATES_KEY = 'okk_shift_v2_holiday_return_candidates';
  const DEMO_KEY = 'okk_shift_v2_demo_mode';
  const BACKUP_KEY = 'okk_shift_v2_demo_backup_v3';
  const STORES = ['matsuyama', 'kumoji', 'miebashi', 'misato'];
  const SKILLS = ['opening', 'closing', 'meat', 'salad', 'hall', 'drink', 'dish', 'register'];
  const SKILL_NAMES = {
    opening: 'オープン準備', closing: '締め作業', meat: '肉場', salad: 'サラダ場',
    hall: 'ホール', drink: 'ドリンク', dish: '洗い場', register: 'レジ'
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectButtons();
    setTimeout(injectButtons, 300);
    setTimeout(injectButtons, 1000);
  }

  function injectButtons() {
    const demo = localStorage.getItem(DEMO_KEY) === '1';
    const top = document.querySelector('.topbar .actions');
    const toolbar = document.querySelector('#view-planner .toolbar .toolbar-left');

    if (top && !document.getElementById('demo-mode-button')) {
      const button = makeButton('demo-mode-button', demo);
      top.insertBefore(button, top.firstChild);
    }
    if (demo && top && !document.getElementById('demo-reset-button')) {
      const button = makeResetButton('demo-reset-button');
      top.insertBefore(button, document.getElementById('demo-mode-button') || top.firstChild);
    }

    if (toolbar && !document.getElementById('demo-mode-button-toolbar')) {
      const button = makeButton('demo-mode-button-toolbar', demo);
      button.style.marginLeft = '6px';
      toolbar.appendChild(button);
    }
    if (demo && toolbar && !document.getElementById('demo-reset-button-toolbar')) {
      const button = makeResetButton('demo-reset-button-toolbar');
      button.style.marginLeft = '6px';
      toolbar.appendChild(button);
    }
  }

  function makeButton(id, demo) {
    const button = document.createElement('button');
    button.id = id;
    button.className = demo ? 'btn btn-light' : 'btn btn-dark';
    button.innerHTML = demo
      ? '<i class="fa-solid fa-flask-vial"></i> デモ解除'
      : '<i class="fa-solid fa-users"></i> 36名デモへ';
    button.title = demo ? 'デモ投入前のローカルデータへ戻す' : '旧サンプルを36名の架空テスト人員へ安全に差し替える';
    button.addEventListener('click', demo ? restoreBackup : startDemo);
    return button;
  }

  function makeResetButton(id) {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'btn btn-light';
    button.innerHTML = '<i class="fa-solid fa-rotate-left"></i> デモ初期化';
    button.title = 'デモのスタッフ・スキル・必要人数・シフト・公休を初期状態へ戻す';
    button.addEventListener('click', resetDemo);
    return button;
  }

  function startDemo() {
    const staff = readArray(STAFF_KEY);
    if (!isSafeToReplace(staff)) {
      window.alert('実データらしき従業員情報が入っているため、36名デモへの差し替えを止めました。MF取込済みデータは上書きしません。');
      return;
    }

    if (!window.confirm('現在の旧サンプルを一時バックアップして、架空の36名デモへ差し替えます。デモ中はクラウド同期を停止します。よろしいですか？')) return;

    const backup = {
      staff: localStorage.getItem(STAFF_KEY),
      shifts: localStorage.getItem(SHIFTS_KEY),
      holiday: localStorage.getItem(HOLIDAY_KEY),
      plan: localStorage.getItem(PLAN_KEY),
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));

    seedDemoState();
    localStorage.setItem(DEMO_KEY, '1');
    sessionStorage.setItem('okk_shift_v2_return_view', 'planner');
    window.location.reload();
  }

  function resetDemo() {
    if (localStorage.getItem(DEMO_KEY) !== '1') return;
    if (!window.confirm('デモを初期状態に戻します。テスト中に変更したシフト・スタッフLv・必要人数・公休はリセットされます。実データのバックアップには触れません。よろしいですか？')) return;
    seedDemoState();
    localStorage.removeItem(RETURN_CANDIDATES_KEY);
    sessionStorage.setItem('okk_shift_v2_return_view', 'planner');
    window.location.reload();
  }

  function seedDemoState() {
    localStorage.setItem(STAFF_KEY, JSON.stringify(buildStaff()));
    localStorage.setItem(SHIFTS_KEY, JSON.stringify({}));

    const holiday = readJson(HOLIDAY_KEY, {});
    holiday.staffDays = [];
    localStorage.setItem(HOLIDAY_KEY, JSON.stringify(holiday));

    const defaults = window.shiftV2BootstrapDefaults || {};
    if (Array.isArray(defaults.skills) && defaults.skills.length) {
      localStorage.setItem(SKILLS_KEY, JSON.stringify(defaults.skills));
    }
    if (Array.isArray(defaults.requirements) && defaults.requirements.length) {
      localStorage.setItem(REQUIREMENTS_KEY, JSON.stringify(defaults.requirements));
    }

    localStorage.setItem(PLAN_KEY, JSON.stringify({
      common: { operationalOvertimeCapHours: 30 },
      A: { id: 'A', name: 'Aプラン', fixedOvertimeHours: 25, emergencyCallTarget: 0 },
      B: { id: 'B', name: 'Bプラン', fixedOvertimeHours: 45, emergencyCallTarget: 2 }
    }));
  }

  function restoreBackup() {
    if (!window.confirm('36名デモを解除して、デモ投入前のローカルデータへ戻します。')) return;
    const backup = readJson(BACKUP_KEY, null);
    if (backup) {
      restoreKey(STAFF_KEY, backup.staff);
      restoreKey(SHIFTS_KEY, backup.shifts);
      restoreKey(HOLIDAY_KEY, backup.holiday);
      restoreKey(PLAN_KEY, backup.plan);
    } else {
      localStorage.removeItem(STAFF_KEY);
      localStorage.removeItem(SHIFTS_KEY);
    }
    localStorage.removeItem(DEMO_KEY);
    localStorage.removeItem(BACKUP_KEY);
    window.location.reload();
  }

  function isSafeToReplace(staff) {
    if (!staff.length) return true;
    if (staff.some(person => person?.mf?.syncedAt || person?.mfSyncedAt)) return false;
    if (staff.some(person => person?.demoOnly)) return true;
    if (staff.length > 12) return false;
    return staff.every(person => /^OKK10\d{3,}$/i.test(String(person.id || person.employeeNumber || '')));
  }

  function buildStaff() {
    const people = [];
    for (let index = 0; index < 36; index += 1) {
      const full = index < 12;
      const storeIndex = index % 4;
      const storeId = STORES[storeIndex];
      const id = `DEMO${String(index + 1).padStart(3, '0')}`;
      const levels = Object.fromEntries(SKILLS.map(skill => [skill, 0]));

      levels.hall = full ? 2 : 1;
      levels.register = index % 3 === 0 ? 2 : 1;
      levels.dish = 1;

      if (full) {
        levels.opening = index % 3 === 0 ? 3 : 2;
        levels.closing = index % 3 === 1 ? 3 : 2;
        levels.meat = index % 3 === 2 ? 3 : 2;
        levels.salad = index % 2 === 0 ? 2 : 1;
        levels.drink = index % 2 === 1 ? 2 : 1;
      } else {
        levels.salad = index % 4 === 0 ? 2 : index % 2 === 0 ? 1 : 0;
        levels.drink = index % 4 === 1 ? 2 : index % 2 === 1 ? 1 : 0;
        levels.meat = index % 8 === 0 ? 2 : 0;
        levels.closing = index % 8 === 1 ? 2 : 0;
      }

      const crossStore = index % 6 === 0 ? STORES[(storeIndex + 1) % 4] : null;
      const placementStoreIds = crossStore ? [storeId, crossStore] : [storeId];
      const availableDays = full
        ? ['0', '1', '2', '3', '4', '5', '6']
        : ['0', '1', '2', '3', '4', '5', '6'].filter(day => day !== String((index + 2) % 7));

      people.push({
        id,
        employeeNumber: id,
        name: `${full ? 'デモ社員' : 'デモバイト'} ${String(full ? index + 1 : index - 11).padStart(2, '0')}`,
        active: true,
        demoOnly: true,
        employmentType: full ? '正社員' : 'アルバイト',
        salaryType: full ? 'monthly' : 'hourly',
        workPlanId: full ? (index % 4 === 0 ? 'B' : 'A') : '',
        mainStoreId: storeId,
        affiliationStoreIds: [storeId],
        placementStoreIds,
        autoAssign: true,
        skillLevels: levels,
        skills: SKILLS.filter(skill => levels[skill] > 0).map(skill => SKILL_NAMES[skill]),
        workConstraints: {
          availableDays,
          fixedOffDays: [],
          availableStart: full ? 16 * 60 : (17 + (index % 3)) * 60,
          availableEnd: full ? 30 * 60 : (24 + (index % 3)) * 60,
          preferredDaysPerWeek: full ? 5 : 3 + (index % 2),
          maxDaysPerWeek: full ? 6 : 5,
          note: '36名デモ用の架空設定'
        }
      });
    }
    return people;
  }

  function restoreKey(key, raw) {
    if (typeof raw === 'string') localStorage.setItem(key, raw);
    else localStorage.removeItem(key);
  }

  function readArray(key) {
    const value = readJson(key, []);
    return Array.isArray(value) ? value : [];
  }

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }
})();
