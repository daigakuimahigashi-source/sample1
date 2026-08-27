(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const CLOUD_STAFF = 'staff';
  const CLOUD_SKILLS = 'shiftV2Skills';
  const CLOUD_MARKER = 'skillSpreadsheetRepair20260827v1';

  const SITE_SKILLS = [
    { id:'opening', name:'オープン準備（ホール）', sourceIndex:0 },
    { id:'opening_kitchen', name:'オープン準備（キッチン）', sourceIndex:0 },
    { id:'dish', name:'洗い場', sourceIndex:13 },
    { id:'drink', name:'ドリンク', sourceIndex:11 },
    { id:'register', name:'レジ', sourceIndex:14 },
    { id:'hall', name:'ホール（肉焼けない子）', sourceIndex:12 },
    { id:'hall_grill', name:'ホール（肉焼ける子）', sourceIndex:6 },
    { id:'meat', name:'肉場（オーダー）', sourceIndex:2 },
    { id:'meat_prep', name:'肉場（仕込み）', sourceIndex:3 },
    { id:'meat_inventory', name:'肉場（発注＆在庫管理）', sourceIndex:4 },
    { id:'meat_food', name:'肉場（食材管理）', sourceIndex:5 },
    { id:'salad', name:'サラダ場（オーダー）', sourceIndex:7 },
    { id:'salad_prep', name:'サラダ場（仕込み）', sourceIndex:8 },
    { id:'salad_inventory', name:'サラダ場（発注＆在庫管理）', sourceIndex:9 },
    { id:'salad_food', name:'サラダ場（食材管理）', sourceIndex:10 },
    { id:'closing', name:'締め作業', sourceIndex:1 },
  ];

  const STORE_NAMES = {
    matsuyama:'松山店', kumoji:'久茂地店', miebashi:'美栄橋店', misato:'美里店'
  };

  // [employeeId in source sheet, name, main store, A/B, 16 source values]
  const ROWS = [["1","又吉 達朗","matsuyama",null,"3333333333333333"],["2","新城 優樹","misato","B","3333333333333333"],["3","又吉 健太","miebashi","B","3333333333333333"],["4","三澤 北斗","kumoji","B","3333333333333333"],["5","チャン フー ダット","matsuyama","B","3333330333321303"],["6","ガンガナート","kumoji","A","3310000331300102"],["7","ダヌカ","kumoji","A","3333331110000202"],["8","チャミル","miebashi","A","3222020220200102"],["9","プラタナ","matsuyama","A","2100000220200001"],["10","ラヒル","matsuyama","A","2222020000000001"],["11","アウィシカ","kumoji","A","2200000220100000"],["12","エシャン","matsuyama","A","1221020000000000"],["13","仲里 大三","misato","A","2222221000012221"],["14","松下 宰","misato","A","1210000222201201"],["15","松田 海人","misato","A","2200002100022221"],["16","川上 なつみ","misato","A","2000002000012201"],["111","大城 未琴","kumoji",null,"3300003110033232"],["112","安里茜マーティン","matsuyama",null,"0100002000022221"],["113","佐久田 春斗","matsuyama",null,"0000000000021200"],["114","知念 あおい",null,null,null],["115","岸田 博行","kumoji",null,"0100000000011200"],["116","宮城 文弥","kumoji",null,"0200002000032232"],["117","名嘉 崚馬","matsuyama",null,"0000002000002100"],["118","下地 美弥","matsuyama",null,"0200002000022120"],["119","仲地 海斗","miebashi",null,"3000002000022222"],["120","池原 幸輝","kumoji",null,"2200000220210000"],["121","安仁屋 匠冴","matsuyama",null,"2200002000022220"],["122","榮 竜騎","miebashi",null,"3200002000022221"],["123","新里 紫緒那","kumoji",null,"3200002000022221"],["124","平川 翔","kumoji",null,"2000002000022220"],["125","前大 仁胡","matsuyama",null,"2000002000012000"],["126","玉那覇 文美","matsuyama",null,"3300003000033333"],["127","久保 真人","matsuyama",null,"0200000000022220"],["128","村田 悠華",null,null,null],["129","玉城 悠登","matsuyama",null,"0200002000022221"],["130","島袋 玲亜琉","kumoji",null,"0100002000012100"],["132","阿波根 啓","misato",null,"1100002000022221"],["133","桑江 旭","misato",null,"2121010332222223"],["134","上江洲 杏果","misato",null,"2000002000022200"],["135","當銘 マリン",null,null,null],["136","糸満 苺莉愛","misato",null,"2000002000022200"],["137","平田 明久","misato",null,"2100002210132221"],["138","栄野比 あいみ","misato","A","3200002000023222"],["139","金城 綾華","misato",null,"0000002000022220"],["140","大嶺 華笑","misato",null,"0222022110122221"],["141","當山 健人","misato",null,"1000000220110200"],["142","松田 淳生","misato",null,"0200002000022210"],["143","兼城 清琉","misato",null,"1021010000000000"],["144","譜久里 光流",null,null,null],["145","渡口 来夢","misato",null,"2022020000011201"],["146","具志堅 詩苑","misato",null,"2000002000022200"],["148","又吉 未愉","matsuyama",null,"3310013110133333"],["149","サリバン 莉愛","misato",null,"1000002000022200"],["150","新里 海笑",null,null,null],["151","又吉 敦子","matsuyama",null,"0000000000012120"]];

  const NAME_ALIASES = new Map([
    [normName('又吉 達朗'), normName('又吉 達郎')],
    [normName('大城 未琴'), normName('大城 美琴')],
  ]);

  let running = false;
  let lastSignature = '';
  let rerunRequested = false;

  window.__shiftV2SkillSheetRepairInstalled = true;

  schedule(900);
  schedule(3200);
  schedule(6500);
  document.addEventListener('shiftv2-auth', () => schedule(1800));
  document.addEventListener('shiftv2-cloud-ready', () => schedule(2200));
  document.addEventListener('shiftv2-access-changed', () => schedule(700));
  document.addEventListener('shiftv2-master-data-changed', () => schedule(250));
  document.addEventListener('click', event => {
    if (event.target.closest?.('.tab[data-view="master"],[data-unified-master="employees"]')) schedule(150);
  }, false);

  function schedule(delay) {
    setTimeout(() => void repair(), delay);
  }

  async function repair() {
    if (running) {
      rerunRequested = true;
      return;
    }
    running = true;
    rerunRequested = false;
    setBadge('照合中…', 'checking');

    try {
      let localSkills = readArray(SKILLS_KEY);
      let staff = readArray(STAFF_KEY);
      let cloudSkills = [];
      let cloudStaff = [];

      if (window.shiftV2Cloud && window.shiftV2User) {
        try {
          [cloudSkills, cloudStaff] = await Promise.all([
            window.shiftV2Cloud.get(CLOUD_SKILLS),
            window.shiftV2Cloud.get(CLOUD_STAFF),
          ]);
        } catch (error) {
          console.warn('Skill repair cloud preload failed', error);
        }
      }

      const skills = buildSiteSkills(localSkills, cloudSkills);
      if (Array.isArray(cloudStaff) && cloudStaff.length) staff = cloudStaff;
      if (!staff.length) {
        setBadge('従業員データ待ち', 'error');
        return;
      }

      const merged = mergeStaff(staff, skills);
      const expectedRows = ROWS.filter(row => typeof row[4] === 'string').length;
      if (merged.matchedRows !== expectedRows) {
        console.warn('Skill repair employee mismatch', merged.unmatched);
        setBadge(`従業員照合 ${merged.matchedRows}/${expectedRows}`, 'error');
        return;
      }

      localStorage.setItem(SKILLS_KEY, JSON.stringify(skills));
      localStorage.setItem(STAFF_KEY, JSON.stringify(merged.staff));
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));

      const localCheck = verify(merged.staff, skills);
      if (!localCheck.ok) {
        setBadge(`ローカル照合 ${localCheck.checkedCells}/${localCheck.expectedCells}`, 'error');
        return;
      }

      // Viewer mode still gets the correct local display. Only the headquarters editor persists to Firestore.
      if (window.shiftV2Access?.canEditHeadquarters?.() !== true || !window.shiftV2Cloud || !window.shiftV2User) {
        setBadge(`表示照合OK ${localCheck.checkedCells}/${localCheck.expectedCells}`, 'local');
        return;
      }

      const signature = fastSignature(JSON.stringify(skills) + JSON.stringify(merged.staff));
      if (signature === lastSignature) {
        setBadge(`クラウド照合OK ${localCheck.checkedCells}/${localCheck.expectedCells}`, 'ok');
        return;
      }

      await window.shiftV2Cloud.set(CLOUD_SKILLS, skills);
      await window.shiftV2Cloud.set(CLOUD_STAFF, merged.staff);
      await sleep(350);

      const [savedSkills, savedStaff] = await Promise.all([
        window.shiftV2Cloud.get(CLOUD_SKILLS),
        window.shiftV2Cloud.get(CLOUD_STAFF),
      ]);
      const cloudCheck = verify(savedStaff, savedSkills);
      if (!cloudCheck.ok) {
        console.warn('Skill repair readback mismatch', cloudCheck);
        setBadge(`保存照合NG ${cloudCheck.checkedCells}/${cloudCheck.expectedCells}`, 'error');
        return;
      }

      await window.shiftV2Cloud.set(CLOUD_MARKER, {
        verified:true,
        verifiedAt:new Date().toISOString(),
        source:'OKK_従業員スキル入力_詳細スキル版.xlsx',
        matchedRows:cloudCheck.matchedRows,
        siteSkills:SITE_SKILLS.length,
        checkedCells:cloudCheck.checkedCells,
        expectedCells:cloudCheck.expectedCells,
      });

      localStorage.setItem(SKILLS_KEY, JSON.stringify(savedSkills));
      localStorage.setItem(STAFF_KEY, JSON.stringify(savedStaff));
      lastSignature = signature;
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));
      setBadge(`クラウド照合OK ${cloudCheck.checkedCells}/${cloudCheck.expectedCells}`, 'ok');
      toast(`Excelスキル照合OK：${cloudCheck.matchedRows}名・${cloudCheck.checkedCells}セル`);
    } catch (error) {
      console.warn('Skill repair failed', error);
      setBadge('スキル修復エラー', 'error');
    } finally {
      running = false;
      if (rerunRequested) schedule(350);
    }
  }

  function buildSiteSkills(localSkills, cloudSkills) {
    const candidates = [];
    if (Array.isArray(localSkills)) candidates.push(...localSkills);
    if (Array.isArray(cloudSkills)) candidates.push(...cloudSkills);
    const used = new Set();

    return SITE_SKILLS.map(spec => {
      const exact = candidates.find(skill => !used.has(String(skill?.id || '')) && sameSkillName(skill?.name, spec.name));
      const idMatch = candidates.find(skill => !used.has(String(skill?.id || '')) && String(skill?.id || '') === spec.id);
      const chosen = exact || idMatch || {};
      const id = String(chosen.id || spec.id);
      used.add(id);
      return { ...chosen, id, name:spec.name, active:true };
    });
  }

  function mergeStaff(current, skills) {
    const staff = current.map(person => ({ ...person, skillLevels:{ ...(person.skillLevels || {}) } }));
    const index = createIndex(staff);
    const unmatched = [];
    let matchedRows = 0;
    const now = new Date().toISOString();

    ROWS.forEach(([sourceId, sourceName, storeId, plan, values]) => {
      const person = findPerson(index, sourceId, sourceName);
      if (!person) {
        if (typeof values === 'string') unmatched.push(`${sourceId}:${sourceName}`);
        return;
      }

      if (storeId && STORE_NAMES[storeId]) {
        person.mainAffiliation = STORE_NAMES[storeId];
        const ids = Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds.map(String) : [];
        person.affiliationStoreIds = [storeId, ...ids.filter(id => id !== storeId)];
      }
      if (plan === 'A' || plan === 'B') person.workPlanId = plan;

      if (typeof values === 'string' && values.length === 16) {
        SITE_SKILLS.forEach((spec, i) => {
          const skill = skills[i];
          person.skillLevels[skill.id] = level(values.charAt(spec.sourceIndex));
        });
        person.skillSheetTrainingLevel = level(values.charAt(15));
        person.skillSheetImportedAt = now;
        person.skillUpdatedAt = now;
        matchedRows += 1;
      }

      person.skills = skills
        .filter(skill => level(person.skillLevels?.[skill.id]) > 0)
        .map(skill => skill.name);
    });

    return { staff, matchedRows, unmatched };
  }

  function verify(staff, skills) {
    const dataRows = ROWS.filter(row => typeof row[4] === 'string');
    const expectedCells = dataRows.length * SITE_SKILLS.length;
    if (!Array.isArray(staff) || !Array.isArray(skills) || skills.length !== SITE_SKILLS.length) {
      return { ok:false, matchedRows:0, checkedCells:0, expectedCells };
    }

    const index = createIndex(staff);
    let matchedRows = 0;
    let checkedCells = 0;
    const errors = [];

    dataRows.forEach(([sourceId, sourceName, , , values]) => {
      const person = findPerson(index, sourceId, sourceName);
      if (!person) {
        errors.push(`missing:${sourceName}`);
        return;
      }
      let rowOk = true;
      SITE_SKILLS.forEach((spec, i) => {
        const skill = skills[i];
        if (!sameSkillName(skill?.name, spec.name)) {
          rowOk = false;
          errors.push(`skill-name:${i}:${skill?.name || ''}`);
          return;
        }
        const expected = level(values.charAt(spec.sourceIndex));
        const actual = level(person.skillLevels?.[skill.id]);
        checkedCells += 1;
        if (actual !== expected) {
          rowOk = false;
          if (errors.length < 20) errors.push(`${sourceName}:${spec.name}:${actual}!=${expected}`);
        }
      });
      if (rowOk) matchedRows += 1;
    });

    return {
      ok:matchedRows === dataRows.length && checkedCells === expectedCells && errors.length === 0,
      matchedRows,
      checkedCells,
      expectedCells,
      errors,
    };
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

  function findPerson(index, sourceId, sourceName) {
    const byId = index.byId.get(normId(sourceId));
    if (byId) return byId;
    const name = normName(sourceName);
    if (index.byName.has(name)) return index.byName.get(name);
    const alias = NAME_ALIASES.get(name);
    return alias ? index.byName.get(alias) || null : null;
  }

  function sameSkillName(a, b) {
    return normSkill(a) === normSkill(b);
  }

  function normSkill(value) {
    return String(value ?? '')
      .replace(/[\s\u3000]+/g, '')
      .replace(/[（(]/g, '（')
      .replace(/[）)]/g, '）')
      .replace(/[&＆]/g, '＆')
      .replace(/\/|／/g, '＆')
      .toLowerCase();
  }

  function normId(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const digits = text.replace(/[^0-9]/g, '');
    return digits ? String(Number(digits)) : text.toUpperCase();
  }

  function normName(value) {
    return String(value ?? '').replace(/[\s\u3000]+/g, '').trim().toLowerCase();
  }

  function level(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0;
  }

  function readArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function setBadge(text, mode) {
    let badge = document.getElementById('skill-sheet-verify-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'skill-sheet-verify-badge';
      badge.style.cssText = 'position:fixed;right:74px;bottom:10px;z-index:9997;padding:5px 9px;border-radius:999px;font:800 9px/1.2 "Noto Sans JP",sans-serif;box-shadow:0 2px 8px rgba(16,24,40,.12);pointer-events:none';
      document.body.appendChild(badge);
    }
    const palette = {
      ok:['#027a48','#ecfdf3','#abefc6'],
      local:['#175cd3','#eff8ff','#b2ddff'],
      checking:['#344054','#f2f4f7','#d0d5dd'],
      error:['#b42318','#fef3f2','#fecdca'],
    };
    const [fg,bg,border] = palette[mode] || palette.checking;
    badge.textContent = `Excelスキル：${text}`;
    badge.style.color = fg;
    badge.style.background = bg;
    badge.style.border = `1px solid ${border}`;
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 3500);
  }

  function fastSignature(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return String(hash >>> 0);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
