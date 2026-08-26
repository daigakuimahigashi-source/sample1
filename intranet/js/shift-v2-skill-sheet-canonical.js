(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const CLOUD_STAFF = 'staff';
  const CLOUD_SKILLS = 'shiftV2Skills';
  const CLOUD_MARKER = 'skillSpreadsheetCanonical20260826v1';

  const SKILLS = [
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

  const STORE_NAMES = {
    matsuyama:'松山店', kumoji:'久茂地店', miebashi:'美栄橋店', misato:'美里店'
  };

  // [employeeId, spreadsheetName, mainStoreId, A/B plan, 16 skill levels]
  const ROWS = [["1","又吉 達朗","matsuyama",null,"3333333333333333"],["2","新城 優樹","misato","B","3333333333333333"],["3","又吉 健太","miebashi","B","3333333333333333"],["4","三澤 北斗","kumoji","B","3333333333333333"],["5","チャン フー ダット","matsuyama","B","3333330333321303"],["6","ガンガナート","kumoji","A","3310000331300102"],["7","ダヌカ","kumoji","A","3333331110000202"],["8","チャミル","miebashi","A","3222020220200102"],["9","プラタナ","matsuyama","A","2100000220200001"],["10","ラヒル","matsuyama","A","2222020000000001"],["11","アウィシカ","kumoji","A","2200000220100000"],["12","エシャン","matsuyama","A","1221020000000000"],["13","仲里 大三","misato","A","2222221000012221"],["14","松下 宰","misato","A","1210000222201201"],["15","松田 海人","misato","A","2200002100022221"],["16","川上 なつみ","misato","A","2000002000012201"],["111","大城 未琴","kumoji",null,"3300003110033232"],["112","安里茜マーティン","matsuyama",null,"0100002000022221"],["113","佐久田 春斗","matsuyama",null,"0000000000021200"],["114","知念 あおい",null,null,null],["115","岸田 博行","kumoji",null,"0100000000011200"],["116","宮城 文弥","kumoji",null,"0200002000032232"],["117","名嘉 崚馬","matsuyama",null,"0000002000002100"],["118","下地 美弥","matsuyama",null,"0200002000022120"],["119","仲地 海斗","miebashi",null,"3000002000022222"],["120","池原 幸輝","kumoji",null,"2200000220210000"],["121","安仁屋 匠冴","matsuyama",null,"2200002000022220"],["122","榮 竜騎","miebashi",null,"3200002000022221"],["123","新里 紫緒那","kumoji",null,"3200002000022221"],["124","平川 翔","kumoji",null,"2000002000022220"],["125","前大 仁胡","matsuyama",null,"2000002000012000"],["126","玉那覇 文美","matsuyama",null,"3300003000033333"],["127","久保 真人","matsuyama",null,"0200000000022220"],["128","村田 悠華",null,null,null],["129","玉城 悠登","matsuyama",null,"0200002000022221"],["130","島袋 玲亜琉","kumoji",null,"0100002000012100"],["132","阿波根 啓","misato",null,"1100002000022221"],["133","桑江 旭","misato",null,"2121010332222223"],["134","上江洲 杏果","misato",null,"2000002000022200"],["135","當銘 マリン",null,null,null],["136","糸満 苺莉愛","misato",null,"2000002000022200"],["137","平田 明久","misato",null,"2100002210132221"],["138","栄野比 あいみ","misato","A","3200002000023222"],["139","金城 綾華","misato",null,"0000002000022220"],["140","大嶺 華笑","misato",null,"0222022110122221"],["141","當山 健人","misato",null,"1000000220110200"],["142","松田 淳生","misato",null,"0200002000022210"],["143","兼城 清琉","misato",null,"1021010000000000"],["144","譜久里 光流",null,null,null],["145","渡口 来夢","misato",null,"2022020000011201"],["146","具志堅 詩苑","misato",null,"2000002000022200"],["148","又吉 未愉","matsuyama",null,"3310013110133333"],["149","サリバン 莉愛","misato",null,"1000002000022200"],["150","新里 海笑",null,null,null],["151","又吉 敦子","matsuyama",null,"0000000000012120"]];

  const NAME_ALIASES = new Map([
    [normName('又吉 達朗'), normName('又吉 達郎')],
    [normName('大城 未琴'), normName('大城 美琴')],
  ]);

  let cloudSaving = false;
  let lastCloudSignature = '';

  if (window.__shiftV2SkillSheetCanonicalInstalled) return;
  window.__shiftV2SkillSheetCanonicalInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scheduleApply(600));
  else scheduleApply(600);

  document.addEventListener('shiftv2-auth', () => scheduleApply(1700));
  document.addEventListener('shiftv2-cloud-ready', () => scheduleApply(1900));
  document.addEventListener('shiftv2-access-changed', () => scheduleApply(350));
  document.addEventListener('click', event => {
    if (event.target.closest?.('.tab[data-view="master"],[data-unified-master="employees"]')) scheduleApply(80);
  }, false);

  function scheduleApply(delay) {
    setTimeout(() => void applyCanonical(), delay);
  }

  async function applyCanonical() {
    const currentStaff = readArray(STAFF_KEY);
    if (!currentStaff.length) return;

    const canonicalSkills = buildCanonicalSkills(readArray(SKILLS_KEY));
    const merged = mergeStaff(currentStaff, canonicalSkills);
    if (merged.matchedSkillRows < 45) return;

    const skillsJson = JSON.stringify(canonicalSkills);
    const staffJson = JSON.stringify(merged.staff);
    const localChanged = localStorage.getItem(SKILLS_KEY) !== skillsJson || localStorage.getItem(STAFF_KEY) !== staffJson;

    if (localChanged) {
      localStorage.setItem(SKILLS_KEY, skillsJson);
      localStorage.setItem(STAFF_KEY, staffJson);
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));
    }

    // Persist the same canonical view to Firestore whenever this browser owns headquarters edit mode.
    if (window.shiftV2Access?.canEditHeadquarters?.() === true && window.shiftV2Cloud && window.shiftV2User) {
      const signature = fastSignature(staffJson + skillsJson);
      if (!cloudSaving && signature !== lastCloudSignature) {
        cloudSaving = true;
        try {
          await window.shiftV2Cloud.set(CLOUD_SKILLS, canonicalSkills);
          await window.shiftV2Cloud.set(CLOUD_STAFF, merged.staff);
          const [checkSkills, checkStaff] = await Promise.all([
            window.shiftV2Cloud.get(CLOUD_SKILLS),
            window.shiftV2Cloud.get(CLOUD_STAFF),
          ]);
          const check = verify(checkStaff, checkSkills);
          if (!check.ok) throw new Error(`canonical-verify-failed:${check.matched}/${check.expected}`);
          await window.shiftV2Cloud.set(CLOUD_MARKER, {
            verified:true,
            verifiedAt:new Date().toISOString(),
            source:'OKK_従業員スキル入力_詳細スキル版.xlsx',
            matchedRows:check.matched,
            checkedCells:check.checkedCells,
            skills:SKILLS.length,
          });
          lastCloudSignature = signature;
          localStorage.setItem(SKILLS_KEY, JSON.stringify(checkSkills));
          localStorage.setItem(STAFF_KEY, JSON.stringify(checkStaff));
          document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));
          toast(`スキル反映確認済：${check.matched}名 × 16項目`);
        } catch (error) {
          console.warn('Canonical skill cloud save failed', error);
        } finally {
          cloudSaving = false;
        }
      }
    }
  }

  function buildCanonicalSkills(current) {
    const source = Array.isArray(current) ? current.filter(Boolean) : [];
    return SKILLS.map(spec => {
      const existing = source.find(skill => String(skill.id || '') === spec.id) || source.find(skill => String(skill.name || '') === spec.name) || {};
      return { ...existing, id:spec.id, name:spec.name, active:true };
    });
  }

  function mergeStaff(current, canonicalSkills) {
    const staff = current.map(person => ({ ...person, skillLevels:{ ...(person.skillLevels || {}) } }));
    const index = createIndex(staff);
    let matchedSkillRows = 0;

    ROWS.forEach(([employeeId, spreadsheetName, storeId, plan, levels]) => {
      const person = findPerson(index, employeeId, spreadsheetName);
      if (!person) return;

      if (storeId && STORE_NAMES[storeId]) {
        person.mainAffiliation = STORE_NAMES[storeId];
        const ids = Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds.map(String) : [];
        person.affiliationStoreIds = [storeId, ...ids.filter(id => id !== storeId)];
      }
      if (plan === 'A' || plan === 'B') person.workPlanId = plan;

      if (typeof levels === 'string' && levels.length === SKILLS.length) {
        SKILLS.forEach((skill, index) => {
          person.skillLevels[skill.id] = clamp(levels.charAt(index));
        });
        person.skillSheetImportedAt = '2026-08-26';
        matchedSkillRows += 1;
      }

      person.skills = canonicalSkills.filter(skill => clamp(person.skillLevels?.[skill.id]) > 0).map(skill => skill.name);
    });

    return { staff, matchedSkillRows };
  }

  function verify(staff, skills) {
    if (!Array.isArray(staff) || !Array.isArray(skills)) return { ok:false, matched:0, expected:0, checkedCells:0 };
    const skillIds = new Map(skills.map(skill => [String(skill.name || ''), String(skill.id || '')]));
    if (SKILLS.some(skill => !skillIds.get(skill.name))) return { ok:false, matched:0, expected:0, checkedCells:0 };

    const index = createIndex(staff);
    const expectedRows = ROWS.filter(row => typeof row[4] === 'string').length;
    let matched = 0;
    let checkedCells = 0;

    ROWS.forEach(([employeeId, spreadsheetName, , , levels]) => {
      if (typeof levels !== 'string') return;
      const person = findPerson(index, employeeId, spreadsheetName);
      if (!person) return;
      let rowOk = true;
      SKILLS.forEach((skill, i) => {
        const id = skillIds.get(skill.name);
        const actual = clamp(person.skillLevels?.[id]);
        const expected = clamp(levels.charAt(i));
        checkedCells += 1;
        if (actual !== expected) rowOk = false;
      });
      if (rowOk) matched += 1;
    });

    return { ok:matched === expectedRows && checkedCells === expectedRows * SKILLS.length, matched, expected:expectedRows, checkedCells };
  }

  function createIndex(staff) {
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
    if (byId) return byId;
    const name = normName(spreadsheetName);
    if (index.byName.has(name)) return index.byName.get(name);
    const alias = NAME_ALIASES.get(name);
    return alias ? index.byName.get(alias) || null : null;
  }

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function normId(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const digits = text.replace(/[^0-9]/g, '');
    return digits ? String(Number(digits)) : text.toUpperCase();
  }
  function normName(value) { return String(value ?? '').replace(/[\s\u3000]+/g, '').toLowerCase(); }
  function clamp(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0; }
  function fastSignature(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return String(hash >>> 0);
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 2800);
  }
})();
