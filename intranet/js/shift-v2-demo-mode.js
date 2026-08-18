(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const RULES_KEY = 'okk_shift_v2_staffing_requirements';
  const PLAN_KEY = 'okk_shift_v2_work_plans';
  const DEMO_KEY = 'okk_shift_v2_demo_mode';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';

  const SKILLS = [
    ['opening','オープン準備'],['closing','締め作業'],['meat','肉場'],['salad','サラダ場'],
    ['hall','ホール'],['drink','ドリンク'],['dish','洗い場'],['register','レジ'],
  ].map(([id,name]) => ({ id, name, active: true }));

  const STORES = ['matsuyama','kumoji','miebashi','misato'];

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectButton();
  }

  function injectButton() {
    const host = document.querySelector('.topbar .actions');
    if (!host || document.getElementById('demo-mode-button')) return;
    const demo = localStorage.getItem(DEMO_KEY) === '1';
    const staff = loadArray(STAFF_KEY);
    const button = document.createElement('button');
    button.id = 'demo-mode-button';
    button.className = 'btn btn-light';
    button.innerHTML = demo
      ? '<i class="fa-solid fa-flask-vial"></i> デモ削除'
      : '<i class="fa-solid fa-flask"></i> デモで触る';
    button.title = demo ? 'この端末に入れたデモデータだけ削除します' : '架空の従業員データをこの端末だけに入れてV2を試します';
    host.insertBefore(button, host.firstChild);
    button.addEventListener('click', demo ? clearDemo : () => seedDemo(staff));
  }

  function seedDemo(currentStaff) {
    if (window.shiftV2User) {
      window.alert('クラウドへ誤ってデモデータを保存しないため、デモモードはログアウト状態で使ってください。');
      return;
    }
    if (currentStaff.length) {
      window.alert('従業員データが既に入っています。実データを守るため、デモデータは追加しません。');
      return;
    }
    const shifts = loadJson(SHIFTS_KEY, {});
    const hasShifts = Object.values(shifts || {}).some(rows => Array.isArray(rows) && rows.length);
    if (hasShifts) {
      window.alert('既存シフトがあります。実データを守るため、デモモードは開始しません。');
      return;
    }
    if (!window.confirm('架空の従業員16名とテスト用スキル・配置ルールを、このブラウザのローカル保存だけに入れます。実在従業員データは使用しません。')) return;

    localStorage.setItem(SKILLS_KEY, JSON.stringify(SKILLS));
    localStorage.setItem(RULES_KEY, JSON.stringify(defaultRules()));
    localStorage.setItem(PLAN_KEY, JSON.stringify({
      common: { operationalOvertimeCapHours: 30 },
      A: { id:'A', name:'Aプラン', fixedOvertimeHours:25, emergencyCallTarget:0 },
      B: { id:'B', name:'Bプラン', fixedOvertimeHours:45, emergencyCallTarget:2 },
    }));
    localStorage.setItem(STAFF_KEY, JSON.stringify(demoStaff()));
    localStorage.setItem(DEMO_KEY, '1');
    sessionStorage.setItem('okk_shift_v2_return_view', 'planner');
    notify('デモデータを投入しました');
    setTimeout(() => window.location.reload(), 350);
  }

  function clearDemo() {
    if (!window.confirm('この端末のデモ従業員・デモシフト・デモ用ルールを削除します。会社休業日や手入力した実データがある場合は触りません。')) return;
    const staff = loadArray(STAFF_KEY);
    const remaining = staff.filter(person => !person.demoOnly);
    localStorage.setItem(STAFF_KEY, JSON.stringify(remaining));

    const shifts = loadJson(SHIFTS_KEY, {});
    Object.keys(shifts || {}).forEach(date => {
      if (!Array.isArray(shifts[date])) return;
      shifts[date] = shifts[date].filter(shift => !String(shift.staffId || '').startsWith('DEMO') && shift.autoSource !== 'v2-month-builder');
    });
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));

    const holiday = loadJson('okk_shift_v2_holidays', {});
    if (holiday && Array.isArray(holiday.staffDays)) {
      holiday.staffDays = holiday.staffDays.filter(item => !String(item.staffId || '').startsWith('DEMO'));
      localStorage.setItem('okk_shift_v2_holidays', JSON.stringify(holiday));
    }
    localStorage.removeItem(DEMO_KEY);
    notify('デモデータを削除しました');
    setTimeout(() => window.location.reload(), 350);
  }

  function demoStaff() {
    const names = [
      '比嘉 太郎','金城 花','島袋 蓮','宮里 葵','玉城 海','新垣 結','上原 翔','仲村 凛',
      '知念 陽','大城 凪','平良 空','照屋 澪','伊波 悠','山城 紬','喜屋武 湊','屋良 莉子',
    ];
    return names.map((name, index) => {
      const full = index < 8;
      const id = `DEMO${String(index + 1).padStart(3, '0')}`;
      const primary = STORES[index % STORES.length];
      const second = STORES[(index + 1) % STORES.length];
      const skillLevels = {};
      SKILLS.forEach((skill, skillIndex) => {
        const raw = (index * 7 + skillIndex * 3) % 10;
        skillLevels[skill.id] = full ? (raw < 2 ? 0 : raw < 5 ? 1 : raw < 8 ? 2 : 3) : (raw < 4 ? 0 : raw < 8 ? 1 : 2);
      });
      skillLevels.hall = Math.max(skillLevels.hall, 1);
      if (full) {
        skillLevels.closing = Math.max(skillLevels.closing, index % 3 === 0 ? 3 : 2);
        skillLevels.meat = Math.max(skillLevels.meat, index % 2 === 0 ? 2 : 1);
      }
      const off1 = String((index + 1) % 7);
      const off2 = String((index + 4) % 7);
      const availableDays = ['0','1','2','3','4','5','6'].filter(day => day !== off1 && (full || day !== off2));
      return {
        id,
        employeeNumber: id,
        name,
        active: true,
        demoOnly: true,
        employmentType: full ? '正社員' : 'アルバイト',
        salaryType: full ? 'monthly' : 'hourly',
        workPlanId: full ? (index % 3 === 0 ? 'B' : 'A') : '',
        mainStoreId: primary,
        affiliationStoreIds: index % 5 === 0 ? [primary, second] : [primary],
        placementStoreIds: index % 5 === 0 ? [primary, second] : [primary],
        autoAssign: true,
        skillLevels,
        skills: SKILLS.filter(skill => skillLevels[skill.id] > 0).map(skill => skill.name),
        workConstraints: {
          availableDays,
          fixedOffDays: full ? [off1] : [off1, off2],
          availableStart: full ? 16 * 60 : (17 + index % 3) * 60,
          availableEnd: full ? 30 * 60 : (24 + index % 3) * 60,
          preferredDaysPerWeek: full ? 5 : 3 + (index % 2),
          maxDaysPerWeek: full ? 6 : 5,
          note: 'デモ用の架空設定',
        },
      };
    });
  }

  function defaultRules() {
    const rows = [];
    const add = (storeId, start, end, skillId, minLevel, count, mode='hard') => rows.push({
      id: `demo_${storeId}_${start}_${end}_${skillId}`,
      storeId, dayType:'all', specificDate:'', start:start*60, end:end*60,
      skillId, minLevel, count, mode, active:true,
    });
    add('matsuyama',17,23,'hall',1,3); add('matsuyama',17,23,'meat',2,1); add('matsuyama',23,30,'hall',1,2); add('matsuyama',25,30,'closing',2,1);
    add('kumoji',17,22,'hall',1,3); add('kumoji',17,22,'meat',2,1); add('kumoji',22,25,'hall',1,2); add('kumoji',24,25,'closing',2,1);
    add('miebashi',17,22,'hall',1,2); add('miebashi',17,22,'drink',1,1); add('miebashi',22,25,'hall',1,2); add('miebashi',24,25,'closing',2,1);
    add('misato',17,22,'hall',1,2); add('misato',17,22,'meat',2,1); add('misato',22,26,'hall',1,2); add('misato',25,26,'closing',2,1);
    return rows;
  }

  function loadArray(key) { const value = loadJson(key, []); return Array.isArray(value) ? value : []; }
  function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
  function notify(message) { const toast = document.getElementById('toast'); if (!toast) return; toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1800); }
})();