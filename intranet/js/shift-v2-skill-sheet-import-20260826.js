(() => {
  'use strict';

  const IMPORT_KEY = 'skillSpreadsheetImport20260826v2';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const CLOUD_STAFF = 'staff';
  const CLOUD_SKILLS = 'shiftV2Skills';
  const IMPORTED_AT = '2026-08-26';
  const MAX_ATTEMPTS = 3;

  const STORE_NAMES = {
    matsuyama: '松山店',
    kumoji: '久茂地店',
    miebashi: '美栄橋店',
    misato: '美里店',
  };

  // Existing IDs for the original skills are retained so current staffing rules keep working.
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

  // [employeeId, spreadsheetName, mainStoreId, A/B plan, 16 skill levels].
  // null skill string means the spreadsheet row was intentionally left blank and existing values are preserved.
  const ROWS = [["1","又吉 達朗","matsuyama",null,"3333333333333333"],["2","新城 優樹","misato","B","3333333333333333"],["3","又吉 健太","miebashi","B","3333333333333333"],["4","三澤 北斗","kumoji","B","3333333333333333"],["5","チャン フー ダット","matsuyama","B","3333330333321303"],["6","ガンガナート","kumoji","A","3310000331300102"],["7","ダヌカ","kumoji","A","3333331110000202"],["8","チャミル","miebashi","A","3222020220200102"],["9","プラタナ","matsuyama","A","2100000220200001"],["10","ラヒル","matsuyama","A","2222020000000001"],["11","アウィシカ","kumoji","A","2200000220100000"],["12","エシャン","matsuyama","A","1221020000000000"],["13","仲里 大三","misato","A","2222221000012221"],["14","松下 宰","misato","A","1210000222201201"],["15","松田 海人","misato","A","2200002100022221"],["16","川上 なつみ","misato","A","2000002000012201"],["111","大城 未琴","kumoji",null,"3300003110033232"],["112","安里茜マーティン","matsuyama",null,"0100002000022221"],["113","佐久田 春斗","matsuyama",null,"0000000000021200"],["114","知念 あおい",null,null,null],["115","岸田 博行","kumoji",null,"0100000000011200"],["116","宮城 文弥","kumoji",null,"0200002000032232"],["117","名嘉 崚馬","matsuyama",null,"0000002000002100"],["118","下地 美弥","matsuyama",null,"0200002000022120"],["119","仲地 海斗","miebashi",null,"3000002000022222"],["120","池原 幸輝","kumoji",null,"2200000220210000"],["121","安仁屋 匠冴","matsuyama",null,"2200002000022220"],["122","榮 竜騎","miebashi",null,"3200002000022221"],["123","新里 紫緒那","kumoji",null,"3200002000022221"],["124","平川 翔","kumoji",null,"2000002000022220"],["125","前大 仁胡","matsuyama",null,"2000002000012000"],["126","玉那覇 文美","matsuyama",null,"3300003000033333"],["127","久保 真人","matsuyama",null,"0200000000022220"],["128","村田 悠華",null,null,null],["129","玉城 悠登","matsuyama",null,"0200002000022221"],["130","島袋 玲亜琉","kumoji",null,"0100002000012100"],["132","阿波根 啓","misato",null,"1100002000022221"],["133","桑江 旭","misato",null,"2121010332222223"],["134","上江洲 杏果","misato",null,"2000002000022200"],["135","當銘 マリン",null,null,null],["136","糸満 苺莉愛","misato",null,"2000002000022200"],["137","平田 明久","misato",null,"2100002210132221"],["138","栄野比 あいみ","misato","A","3200002000023222"],["139","金城 綾華","misato",null,"0000002000022220"],["140","大嶺 華笑","misato",null,"0222022110122221"],["141","當山 健人","misato",null,"1000000220110200"],["142","松田 淳生","misato",null,"0200002000022210"],["143","兼城 清琉","misato",null,"1021010000000000"],["144","譜久里 光流",null,null,null],["145","渡口 来夢","misato",null,"2022020000011201"],["146","具志堅 詩苑","misato",null,"2000002000022200"],["148","又吉 未愉","matsuyama",null,"3310013110133333"],["149","サリバン 莉愛","misato",null,"1000002000022200"],["150","新里 海笑",null,null,null],["151","又吉 敦子","matsuyama",null,"0000000000012120"]];

  const NAME_ALIASES = new Map([
    [normName('又吉 達朗'), normName('又吉 達郎')],
    [normName('大城 未琴'), normName('大城 美琴')],
  ]);

  let running = false;
  let finished = false;
  let attempts = 0;
  let stage = '待機';

  if (window.__shiftV2SkillSheetImport20260826Installed) return;
  window.__shiftV2SkillSheetImport20260826Installed = true;

  document.addEventListener('shiftv2-access-changed', event => {
    if (event.detail?.mode === 'editor') setTimeout(run, 2200);
  });
  document.addEventListener('shiftv2-cloud-ready', () => setTimeout(runIfEditor, 2600));
  setTimeout(runIfEditor, 3200);

  function runIfEditor() {
    if (window.shiftV2Access?.canEditHeadquarters?.() === true) void run();
  }

  async function run() {
    if (running || finished) return;
    if (!window.shiftV2Cloud || !window.shiftV2User) return;
    if (window.shiftV2Access?.canEditHeadquarters?.() !== true) return;

    running = true;
    attempts += 1;
    try {
      stage = '完了記録確認';
      const marker = await window.shiftV2Cloud.get(IMPORT_KEY);
      if (marker?.done && marker?.verified === true) {
        finished = true;
        return;
      }

      stage = 'クラウド読込';
      const [cloudStaff, cloudSkills] = await Promise.all([
        window.shiftV2Cloud.get(CLOUD_STAFF),
        window.shiftV2Cloud.get(CLOUD_SKILLS),
      ]);
      if (!Array.isArray(cloudStaff) || cloudStaff.length < 45) {
        throw new Error(`cloud-staff-unavailable:${Array.isArray(cloudStaff) ? cloudStaff.length : 'null'}`);
      }

      const currentSkills = Array.isArray(cloudSkills) ? clone(cloudSkills) : readArray(SKILLS_KEY);
      const skillMerge = mergeSkills(currentSkills);
      const result = mergeStaff(cloudStaff, skillMerge.skills, skillMerge.idByName);
      const expectedSkillRows = ROWS.filter(row => typeof row[4] === 'string').length;

      if (result.skillRows !== expectedSkillRows) {
        throw new Error(`employee-match-failed:${result.skillRows}/${expectedSkillRows};unmatched=${result.unmatched.join(',')}`);
      }

      stage = '16スキル保存';
      await window.shiftV2Cloud.set(CLOUD_SKILLS, skillMerge.skills);
      stage = '従業員スキル保存';
      await window.shiftV2Cloud.set(CLOUD_STAFF, result.staff);

      // Give Firestore and the other startup hydration handlers a moment to settle, then read back authoritative data.
      stage = '保存結果待機';
      await sleep(450);
      stage = '保存結果再読込';
      const [verifiedStaff, verifiedSkills] = await Promise.all([
        window.shiftV2Cloud.get(CLOUD_STAFF),
        window.shiftV2Cloud.get(CLOUD_SKILLS),
      ]);

      stage = '16項目全件照合';
      const verification = verifyImport(verifiedStaff, verifiedSkills);
      if (!verification.ok) {
        throw new Error(`verify-failed:${verification.matchedRows}/${verification.expectedRows};errors=${verification.errors.slice(0,5).join('|')}`);
      }

      // Only after read-back verification succeeds do local state and the completion marker become authoritative.
      localStorage.setItem(SKILLS_KEY, JSON.stringify(verifiedSkills));
      localStorage.setItem(STAFF_KEY, JSON.stringify(verifiedStaff));
      document.dispatchEvent(new CustomEvent('shiftv2-master-data-changed'));
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));

      stage = '完了記録';
      await window.shiftV2Cloud.set(IMPORT_KEY, {
        done:true,
        verified:true,
        source:'OKK_従業員スキル入力_詳細スキル版.xlsx',
        importedAt:new Date().toISOString(),
        spreadsheetDate:IMPORTED_AT,
        rows:ROWS.length,
        matched:result.matched,
        matchedById:result.matchedById,
        matchedByName:result.matchedByName,
        skillRows:result.skillRows,
        verifiedRows:verification.matchedRows,
        verifiedCells:verification.checkedCells,
        skills:SKILL_SPECS.length,
      });

      finished = true;
      stage = '完了';
      notify(`16スキル反映・照合OK：${verification.matchedRows}名 × 16項目`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      console.warn(`Skill spreadsheet import failed at ${stage}`, error);
      if (attempts < MAX_ATTEMPTS) {
        const retry = attempts + 1;
        notify(`スキル反映を再確認中… ${retry}/${MAX_ATTEMPTS}`);
        setTimeout(run, 1400);
      } else {
        notify(`スキル反映エラー：${stage}。自動上書きを停止しました`);
      }
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
    const index = createStaffIndex(staff);
    const unmatched = [];
    let matched = 0;
    let matchedById = 0;
    let matchedByName = 0;
    let skillRows = 0;
    const now = new Date().toISOString();

    ROWS.forEach(([employeeId, spreadsheetName, storeId, plan, skillString]) => {
      const found = findPerson(index, employeeId, spreadsheetName);
      const person = found.person;
      if (!person) {
        unmatched.push(`${employeeId}:${spreadsheetName}`);
        return;
      }
      matched += 1;
      if (found.via === 'id') matchedById += 1;
      else matchedByName += 1;

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
        SKILL_SPECS.forEach((spec, skillIndex) => {
          const skillId = idByName[spec.name];
          if (!skillId) return;
          person.skillLevels[skillId] = clamp(skillString.charAt(skillIndex));
        });
        person.skillUpdatedAt = now;
        person.skillSheetImportedAt = now;
        skillRows += 1;
      }

      person.skills = skills
        .filter(skill => skill?.active !== false && clamp(person.skillLevels?.[skill.id]) > 0)
        .map(skill => skill.name);
    });

    return { staff, matched, matchedById, matchedByName, unmatched, skillRows };
  }

  function verifyImport(staff, skills) {
    if (!Array.isArray(staff) || !Array.isArray(skills)) {
      return { ok:false, matchedRows:0, expectedRows:0, checkedCells:0, errors:['cloud-data-not-array'] };
    }

    const expectedRows = ROWS.filter(row => typeof row[4] === 'string').length;
    const skillIdByName = {};
    SKILL_SPECS.forEach(spec => {
      const item = skills.find(skill => String(skill?.name || '') === spec.name);
      if (item?.id) skillIdByName[spec.name] = String(item.id);
    });

    const missingSkills = SKILL_SPECS.filter(spec => !skillIdByName[spec.name]);
    if (missingSkills.length) {
      return { ok:false, matchedRows:0, expectedRows, checkedCells:0, errors:missingSkills.map(skill => `missing-skill:${skill.name}`) };
    }

    const index = createStaffIndex(staff);
    const errors = [];
    let matchedRows = 0;
    let checkedCells = 0;

    ROWS.forEach(([employeeId, spreadsheetName, , , skillString]) => {
      if (typeof skillString !== 'string') return;
      const person = findPerson(index, employeeId, spreadsheetName).person;
      if (!person) {
        errors.push(`missing-person:${employeeId}:${spreadsheetName}`);
        return;
      }

      let rowOk = true;
      SKILL_SPECS.forEach((spec, skillIndex) => {
        const skillId = skillIdByName[spec.name];
        const expected = clamp(skillString.charAt(skillIndex));
        const actual = clamp(person.skillLevels?.[skillId]);
        checkedCells += 1;
        if (actual !== expected) {
          rowOk = false;
          if (errors.length < 20) errors.push(`${employeeId}:${spec.name}:${actual}!=${expected}`);
        }
      });
      if (rowOk) matchedRows += 1;
    });

    return {
      ok: matchedRows === expectedRows && checkedCells === expectedRows * SKILL_SPECS.length && errors.length === 0,
      matchedRows,
      expectedRows,
      checkedCells,
      errors,
    };
  }

  function createStaffIndex(staff) {
    const byId = new Map();
    const byName = new Map();
    staff.forEach(person => {
      const id = normId(person?.id);
      const name = normName(person?.name);
      if (id) byId.set(id, person);
      if (name && !byName.has(name)) byName.set(name, person);
    });
    return { byId, byName };
  }

  function findPerson(index, employeeId, spreadsheetName) {
    const byId = index.byId.get(normId(employeeId));
    if (byId) return { person:byId, via:'id' };

    const rawName = normName(spreadsheetName);
    const direct = index.byName.get(rawName);
    if (direct) return { person:direct, via:'name' };

    const alias = NAME_ALIASES.get(rawName);
    if (alias) {
      const aliased = index.byName.get(alias);
      if (aliased) return { person:aliased, via:'name' };
    }
    return { person:null, via:'' };
  }

  function normId(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const digits = text.replace(/[^0-9]/g, '');
    if (digits) return String(Number(digits));
    return text.toUpperCase();
  }

  function normName(value) {
    return String(value ?? '').replace(/[\s\u3000]+/g, '').trim().toLowerCase();
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
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3600);
  }
})();
