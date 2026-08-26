(() => {
  'use strict';

  const IMPORT_KEY = 'skillSpreadsheetImport20260826v1';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const CLOUD_STAFF = 'staff';
  const CLOUD_SKILLS = 'shiftV2Skills';
  const IMPORTED_AT = '2026-08-26';

  const STORE_NAMES = {
    matsuyama: '松山店',
    kumoji: '久茂地店',
    miebashi: '美栄橋店',
    misato: '美里店',
  };

  // Existing IDs are retained for the original eight skills so current staffing rules keep working.
  const SKILL_SPECS = [
    { id:'opening', name:'オープン準備' },
    { id:'closing', name:'締め作業' },
    { id:'meat', name:'肉場（オーダー）' },
    { id:'meat_prep', name:'肉場（仕込み）' },
    { id:'meat_inventory', name:'肉場（発注・在庫管理）' },
    { id:'meat_food', name:'肉場（食材管理）' },
    { id:'meat_grill', name:'肉焼き' },
    { id:'salad', name:'サラダ場（オーダー）' },
    { id:'salad_prep', name:'サラダ場（仕込み）' },
    { id:'salad_inventory', name:'サラダ場（発注・在庫管理）' },
    { id:'salad_food', name:'サラダ場（食材管理）' },
    { id:'drink', name:'ドリンカー' },
    { id:'hall', name:'ホール' },
    { id:'dish', name:'洗い場' },
    { id:'register', name:'レジ' },
    { id:'training', name:'指導・教育' },
  ];

  // [employeeId, mainStoreId, A/B plan, 16 skill levels].
  // null skill string means the spreadsheet row was intentionally left blank and existing values are preserved.
  const ROWS = [["1","matsuyama",null,"3333333333333333"],["2","misato","B","3333333333333333"],["3","miebashi","B","3333333333333333"],["4","kumoji","B","3333333333333333"],["5","matsuyama","B","3333330333321303"],["6","kumoji","A","3310000331300102"],["7","kumoji","A","3333331110000202"],["8","miebashi","A","3222020220200102"],["9","matsuyama","A","2100000220200001"],["10","matsuyama","A","2222020000000001"],["11","kumoji","A","2200000220100000"],["12","matsuyama","A","1221020000000000"],["13","misato","A","2222221000012221"],["14","misato","A","1210000222201201"],["15","misato","A","2200002100022221"],["16","misato","A","2000002000012201"],["111","kumoji",null,"3300003110033232"],["112","matsuyama",null,"0100002000022221"],["113","matsuyama",null,"0000000000021200"],["114",null,null,null],["115","kumoji",null,"0100000000011200"],["116","kumoji",null,"0200002000032232"],["117","matsuyama",null,"0000002000002100"],["118","matsuyama",null,"0200002000022120"],["119","miebashi",null,"3000002000022222"],["120","kumoji",null,"2200000220210000"],["121","matsuyama",null,"2200002000022220"],["122","miebashi",null,"3200002000022221"],["123","kumoji",null,"3200002000022221"],["124","kumoji",null,"2000002000022220"],["125","matsuyama",null,"2000002000012000"],["126","matsuyama",null,"3300003000033333"],["127","matsuyama",null,"0200000000022220"],["128",null,null,null],["129","matsuyama",null,"0200002000022221"],["130","kumoji",null,"0100002000012100"],["132","misato",null,"1100002000022221"],["133","misato",null,"2121010332222223"],["134","misato",null,"2000002000022200"],["135",null,null,null],["136","misato",null,"2000002000022200"],["137","misato",null,"2100002210132221"],["138","misato","A","3200002000023222"],["139","misato",null,"0000002000022220"],["140","misato",null,"0222022110122221"],["141","misato",null,"1000000220110200"],["142","misato",null,"0200002000022210"],["143","misato",null,"1021010000000000"],["144",null,null,null],["145","misato",null,"2022020000011201"],["146","misato",null,"2000002000022200"],["148","matsuyama",null,"3310013110133333"],["149","misato",null,"1000002000022200"],["150",null,null,null],["151","matsuyama",null,"0000000000012120"]];

  let running = false;
  let finished = false;

  if (window.__shiftV2SkillSheetImport20260826Installed) return;
  window.__shiftV2SkillSheetImport20260826Installed = true;

  document.addEventListener('shiftv2-access-changed', event => {
    if (event.detail?.mode === 'editor') setTimeout(run, 120);
  });
  document.addEventListener('shiftv2-cloud-ready', () => setTimeout(runIfEditor, 300));

  function runIfEditor() {
    if (window.shiftV2Access?.canEditHeadquarters?.() === true) void run();
  }

  async function run() {
    if (running || finished) return;
    if (!window.shiftV2Cloud || !window.shiftV2User) return;
    if (window.shiftV2Access?.canEditHeadquarters?.() !== true) return;

    running = true;
    try {
      const marker = await window.shiftV2Cloud.get(IMPORT_KEY);
      if (marker?.done) {
        finished = true;
        return;
      }

      const [cloudStaff, cloudSkills] = await Promise.all([
        window.shiftV2Cloud.get(CLOUD_STAFF),
        window.shiftV2Cloud.get(CLOUD_SKILLS),
      ]);

      const staff = Array.isArray(cloudStaff) ? clone(cloudStaff) : readArray(STAFF_KEY);
      const currentSkills = Array.isArray(cloudSkills) ? clone(cloudSkills) : readArray(SKILLS_KEY);
      const skillMerge = mergeSkills(currentSkills);
      const result = mergeStaff(staff, skillMerge.skills, skillMerge.idByName);

      // Guard against importing into an unrelated or incomplete employee master.
      if (result.matched < 45) throw new Error(`employee-match-too-low:${result.matched}`);

      localStorage.setItem(SKILLS_KEY, JSON.stringify(skillMerge.skills));
      localStorage.setItem(STAFF_KEY, JSON.stringify(result.staff));

      await window.shiftV2Cloud.set(CLOUD_SKILLS, skillMerge.skills);
      await window.shiftV2Cloud.set(CLOUD_STAFF, result.staff);
      await window.shiftV2Cloud.set(IMPORT_KEY, {
        done:true,
        source:'OKK_従業員スキル入力_詳細スキル版.xlsx',
        importedAt:new Date().toISOString(),
        spreadsheetDate:IMPORTED_AT,
        rows:ROWS.length,
        matched:result.matched,
        unmatched:result.unmatched,
        skillRows:result.skillRows,
        skills:SKILL_SPECS.length,
      });

      finished = true;
      notify(`スキルデータを${result.matched}名に反映しました。再読み込みします`);
      setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      console.warn('Skill spreadsheet import failed', error);
      notify('スキル一括反映に失敗しました。データは上書きしていません');
    } finally {
      running = false;
    }
  }

  function mergeSkills(current) {
    const source = Array.isArray(current) ? current.filter(Boolean).map(skill => ({ ...skill })) : [];
    const usedIds = new Set();
    const canonicalNames = new Set(SKILL_SPECS.map(skill => skill.name));
    const skills = [];
    const idByName = {};

    SKILL_SPECS.forEach(spec => {
      const byId = source.find(skill => String(skill.id) === spec.id && !usedIds.has(String(skill.id)));
      const byName = source.find(skill => String(skill.name) === spec.name && !usedIds.has(String(skill.id)));
      const chosen = byId || byName || {};
      const id = String(chosen.id || spec.id);
      usedIds.add(id);
      idByName[spec.name] = id;
      skills.push({ ...chosen, id, name:spec.name, active:true });
    });

    source.forEach(skill => {
      const id = String(skill.id || '');
      if (!id || usedIds.has(id) || canonicalNames.has(String(skill.name || ''))) return;
      usedIds.add(id);
      skills.push(skill);
    });

    return { skills, idByName };
  }

  function mergeStaff(current, skills, idByName) {
    const staff = Array.isArray(current) ? current.map(person => ({ ...person })) : [];
    const byId = new Map(staff.map(person => [norm(person.id), person]));
    const unmatched = [];
    let matched = 0;
    let skillRows = 0;
    const now = new Date().toISOString();

    ROWS.forEach(([employeeId, storeId, plan, skillString]) => {
      const person = byId.get(norm(employeeId));
      if (!person) {
        unmatched.push(employeeId);
        return;
      }
      matched += 1;

      if (storeId && STORE_NAMES[storeId]) {
        person.mainAffiliation = STORE_NAMES[storeId];
        const existingIds = Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds.map(String) : [];
        person.affiliationStoreIds = [storeId, ...existingIds.filter(id => id !== storeId)];
        person.skillSheetMainStoreId = storeId;
      }

      if (plan === 'A' || plan === 'B') {
        person.workPlanId = plan;
        person.workPlanUpdatedAt = now;
      }

      if (typeof skillString === 'string' && skillString.length === SKILL_SPECS.length) {
        if (!person.skillLevels || typeof person.skillLevels !== 'object') person.skillLevels = {};
        SKILL_SPECS.forEach((spec, index) => {
          const skillId = idByName[spec.name];
          if (!skillId) return;
          person.skillLevels[skillId] = clamp(skillString.charAt(index));
        });
        person.skillUpdatedAt = now;
        person.skillSheetImportedAt = now;
        skillRows += 1;
      }

      person.skills = skills
        .filter(skill => skill?.active !== false && clamp(person.skillLevels?.[skill.id]) > 0)
        .map(skill => skill.name);
    });

    return { staff, matched, unmatched, skillRows };
  }

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0;
  }
  function norm(value) { return String(value ?? '').trim().toUpperCase(); }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  }
})();
