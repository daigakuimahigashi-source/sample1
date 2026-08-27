(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const CLOUD_STAFF = 'staff';
  const CLOUD_SKILLS = 'shiftV2Skills';
  const CLOUD_MARKER = 'skillSpreadsheetFinalized20260828v1';

  const SITE_SKILLS = [
    { fallbackId:'opening', name:'オープン準備（ホール）', sourceIndex:0 },
    { fallbackId:'opening_kitchen', name:'オープン準備（キッチン）', sourceIndex:0 },
    { fallbackId:'dish', name:'洗い場', sourceIndex:13 },
    { fallbackId:'drink', name:'ドリンク', sourceIndex:11 },
    { fallbackId:'register', name:'レジ', sourceIndex:14 },
    { fallbackId:'hall', name:'ホール（肉焼けない子）', sourceIndex:12 },
    { fallbackId:'hall_grill', name:'ホール（肉焼ける子）', sourceIndex:6 },
    { fallbackId:'meat', name:'肉場（オーダー）', sourceIndex:2 },
    { fallbackId:'meat_prep', name:'肉場（仕込み）', sourceIndex:3 },
    { fallbackId:'meat_inventory', name:'肉場（発注＆在庫管理）', sourceIndex:4 },
    { fallbackId:'meat_food', name:'肉場（食材管理）', sourceIndex:5 },
    { fallbackId:'salad', name:'サラダ場（オーダー）', sourceIndex:7 },
    { fallbackId:'salad_prep', name:'サラダ場（仕込み）', sourceIndex:8 },
    { fallbackId:'salad_inventory', name:'サラダ場（発注＆在庫管理）', sourceIndex:9 },
    { fallbackId:'salad_food', name:'サラダ場（食材管理）', sourceIndex:10 },
    { fallbackId:'closing', name:'締め作業', sourceIndex:1 },
  ];

  const STORE_NAMES = {
    matsuyama:'松山店', kumoji:'久茂地店', miebashi:'美栄橋店', misato:'美里店'
  };

  // Source: OKK_従業員スキル入力_詳細スキル版.xlsx
  // [payrollNo, name, mainStoreId, A/B, 16 source skill levels]
  const ROWS = [["1","又吉 達朗","matsuyama",null,"3333333333333333"],["2","新城 優樹","misato","B","3333333333333333"],["3","又吉 健太","miebashi","B","3333333333333333"],["4","三澤 北斗","kumoji","B","3333333333333333"],["5","チャン フー ダット","matsuyama","B","3333330333321303"],["6","ガンガナート","kumoji","A","3310000331300102"],["7","ダヌカ","kumoji","A","3333331110000202"],["8","チャミル","miebashi","A","3222020220200102"],["9","プラタナ","matsuyama","A","2100000220200001"],["10","ラヒル","matsuyama","A","2222020000000001"],["11","アウィシカ","kumoji","A","2200000220100000"],["12","エシャン","matsuyama","A","1221020000000000"],["13","仲里 大三","misato","A","2222221000012221"],["14","松下 宰","misato","A","1210000222201201"],["15","松田 海人","misato","A","2200002100022221"],["16","川上 なつみ","misato","A","2000002000012201"],["111","大城 未琴","kumoji",null,"3300003110033232"],["112","安里茜マーティン","matsuyama",null,"0100002000022221"],["113","佐久田 春斗","matsuyama",null,"0000000000021200"],["114","知念 あおい",null,null,null],["115","岸田 博行","kumoji",null,"0100000000011200"],["116","宮城 文弥","kumoji",null,"0200002000032232"],["117","名嘉 崚馬","matsuyama",null,"0000002000002100"],["118","下地 美弥","matsuyama",null,"0200002000022120"],["119","仲地 海斗","miebashi",null,"3000002000022222"],["120","池原 幸輝","kumoji",null,"2200000220210000"],["121","安仁屋 匠冴","matsuyama",null,"2200002000022220"],["122","榮 竜騎","miebashi",null,"3200002000022221"],["123","新里 紫緒那","kumoji",null,"3200002000022221"],["124","平川 翔","kumoji",null,"2000002000022220"],["125","前大 仁胡","matsuyama",null,"2000002000012000"],["126","玉那覇 文美","matsuyama",null,"3300003000033333"],["127","久保 真人","matsuyama",null,"0200000000022220"],["128","村田 悠華",null,null,null],["129","玉城 悠登","matsuyama",null,"0200002000022221"],["130","島袋 玲亜琉","kumoji",null,"0100002000012100"],["132","阿波根 啓","misato",null,"1100002000022221"],["133","桑江 旭","misato",null,"2121010332222223"],["134","上江洲 杏果","misato",null,"2000002000022200"],["135","當銘 マリン",null,null,null],["136","糸満 苺莉愛","misato",null,"2000002000022200"],["137","平田 明久","misato",null,"2100002210132221"],["138","栄野比 あいみ","misato","A","3200002000023222"],["139","金城 綾華","misato",null,"0000002000022220"],["140","大嶺 華笑","misato",null,"0222022110122221"],["141","當山 健人","misato",null,"1000000220110200"],["142","松田 淳生","misato",null,"0200002000022210"],["143","兼城 清琉","misato",null,"1021010000000000"],["144","譜久里 光流",null,null,null],["145","渡口 来夢","misato",null,"2022020000011201"],["146","具志堅 詩苑","misato",null,"2000002000022200"],["148","又吉 未愉","matsuyama",null,"3310013110133333"],["149","サリバン 莉愛","misato",null,"1000002000022200"],["150","新里 海笑",null,null,null],["151","又吉 敦子","matsuyama",null,"0000000000012120"]];

  const NAME_ALIASES = new Map([
    [normName('又吉 達朗'), normName('又吉 達郎')],
    [normName('大城 未琴'), normName('大城 美琴')],
  ]);

  let originalStorageSetItem = null;
  let cloudWrapped = false;
  let importing = false;
  let rerun = false;
  let lastVerifiedSignature = '';

  installStorageProtection();
  installCloudProtection();

  scheduleImport(600);
  scheduleImport(1800);
  scheduleImport(4200);
  document.addEventListener('shiftv2-auth', () => { installCloudProtection(); scheduleImport(900); });
  document.addEventListener('shiftv2-cloud-ready', () => { installCloudProtection(); scheduleImport(1200); });
  document.addEventListener('shiftv2-access-changed', () => scheduleImport(350));
  document.addEventListener('click', event => {
    if (event.target.closest?.('.tab[data-view="master"],[data-unified-master="employees"]')) scheduleImport(100);
  }, false);

  function installStorageProtection() {
    if (window.__shiftV2DynamicSkillStorageProtected) return;
    window.__shiftV2DynamicSkillStorageProtected = true;
    originalStorageSetItem = Storage.prototype.setItem;

    Storage.prototype.setItem = function(key, value) {
      if (this === window.localStorage && key === STAFF_KEY) {
        try {
          const incoming = JSON.parse(value);
          const previous = readArrayRaw(STAFF_KEY);
          const skills = readArrayRaw(SKILLS_KEY);
          if (Array.isArray(incoming) && incoming.length && previous.length && skills.length) {
            value = JSON.stringify(mergeSkillState(incoming, previous, skills, false));
          }
        } catch (error) {
          console.warn('Dynamic skill local protection skipped', error);
        }
      }
      const result = originalStorageSetItem.call(this, key, value);
      if (this === window.localStorage && key === STAFF_KEY) {
        setTimeout(() => document.dispatchEvent(new CustomEvent('shiftv2-master-render-request')), 0);
      }
      return result;
    };
  }

  function installCloudProtection() {
    setTimeout(() => {
      if (cloudWrapped || !window.shiftV2Cloud?.set) return;
      const originalSet = window.shiftV2Cloud.set.bind(window.shiftV2Cloud);
      window.shiftV2Cloud.set = async (key, value) => {
        if (key === CLOUD_STAFF && Array.isArray(value)) {
          const localStaff = readArrayRaw(STAFF_KEY);
          const skills = readArrayRaw(SKILLS_KEY);
          if (localStaff.length && skills.length) value = mergeSkillState(value, localStaff, skills, true);
        }
        return originalSet(key, value);
      };
      cloudWrapped = true;
    }, 0);
  }

  function mergeSkillState(incoming, current, skills, forceAllSkills) {
    const currentIndex = createIndex(current);
    const activeIds = skills.filter(skill => skill && skill.active !== false && skill.id).map(skill => String(skill.id));
    return incoming.map(person => {
      const next = { ...person, skillLevels:{ ...(person?.skillLevels || {}) } };
      const existing = findByCurrentIdentity(currentIndex, person);
      if (!existing?.skillLevels) return next;
      activeIds.forEach(skillId => {
        const hasIncoming = Object.prototype.hasOwnProperty.call(next.skillLevels, skillId);
        const imported = Boolean(existing.skillSheetImportedAt || existing.skillSheetSource === 'OKK_従業員スキル入力_詳細スキル版.xlsx');
        if ((!hasIncoming || (forceAllSkills && imported)) && Object.prototype.hasOwnProperty.call(existing.skillLevels, skillId)) {
          next.skillLevels[skillId] = existing.skillLevels[skillId];
        }
      });
      if (!next.skillSheetImportedAt && existing.skillSheetImportedAt) next.skillSheetImportedAt = existing.skillSheetImportedAt;
      if (!next.skillSheetSource && existing.skillSheetSource) next.skillSheetSource = existing.skillSheetSource;
      if (existing.skillSheetTrainingLevel != null && next.skillSheetTrainingLevel == null) next.skillSheetTrainingLevel = existing.skillSheetTrainingLevel;
      return next;
    });
  }

  function scheduleImport(delay) {
    setTimeout(() => void runImport(), delay);
  }

  async function runImport() {
    if (importing) {
      rerun = true;
      return;
    }
    importing = true;
    rerun = false;
    setBadge('照合中…', 'checking');

    try {
      let localStaff = readArrayRaw(STAFF_KEY);
      let localSkills = readArrayRaw(SKILLS_KEY);
      let cloudStaff = [];
      let cloudSkills = [];

      if (window.shiftV2Cloud && window.shiftV2User) {
        try {
          [cloudStaff, cloudSkills] = await Promise.all([
            window.shiftV2Cloud.get(CLOUD_STAFF),
            window.shiftV2Cloud.get(CLOUD_SKILLS),
          ]);
        } catch (error) {
          console.warn('Spreadsheet finalizer cloud preload failed', error);
        }
      }

      const skills = buildSiteSkills(localSkills, cloudSkills);
      let staff = Array.isArray(cloudStaff) && cloudStaff.length ? cloudStaff : localStaff;
      if (!staff.length) {
        setBadge('従業員データ待ち', 'warning');
        return;
      }

      const result = applySpreadsheet(staff, skills);
      if (!result.matchedRows) {
        setBadge('氏名一致 0名', 'error');
        return;
      }

      writeRaw(SKILLS_KEY, JSON.stringify(skills));
      writeRaw(STAFF_KEY, JSON.stringify(result.staff));
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));

      const localCheck = verify(result.staff, skills, result.matchedSourceNames);
      if (!localCheck.ok) {
        setBadge(`ローカル不一致 ${localCheck.checkedCells}/${localCheck.expectedCells}`, 'error');
        return;
      }

      const unmatchedText = result.unmatched.length ? `／未照合${result.unmatched.length}名` : '';
      if (window.shiftV2Access?.canEditHeadquarters?.() !== true || !window.shiftV2Cloud || !window.shiftV2User) {
        setBadge(`${result.matchedRows}名・${localCheck.checkedCells}/${localCheck.expectedCells}一致${unmatchedText}`, 'local');
        return;
      }

      installCloudProtection();
      await window.shiftV2Cloud.set(CLOUD_SKILLS, skills);
      await window.shiftV2Cloud.set(CLOUD_STAFF, result.staff);
      await sleep(250);

      const [savedStaff, savedSkills] = await Promise.all([
        window.shiftV2Cloud.get(CLOUD_STAFF),
        window.shiftV2Cloud.get(CLOUD_SKILLS),
      ]);
      const cloudCheck = verify(savedStaff, savedSkills, result.matchedSourceNames);
      if (!cloudCheck.ok) {
        setBadge(`保存不一致 ${cloudCheck.checkedCells}/${cloudCheck.expectedCells}`, 'error');
        return;
      }

      const signature = fastSignature(JSON.stringify(savedSkills) + JSON.stringify(savedStaff));
      if (signature !== lastVerifiedSignature) {
        await window.shiftV2Cloud.set(CLOUD_MARKER, {
          verified:true,
          verifiedAt:new Date().toISOString(),
          source:'OKK_従業員スキル入力_詳細スキル版.xlsx',
          matchedRows:result.matchedRows,
          unmatched:result.unmatched,
          checkedCells:cloudCheck.checkedCells,
          expectedCells:cloudCheck.expectedCells,
        });
        lastVerifiedSignature = signature;
      }

      writeRaw(SKILLS_KEY, JSON.stringify(savedSkills));
      writeRaw(STAFF_KEY, JSON.stringify(savedStaff));
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));
      setBadge(`${result.matchedRows}名・${cloudCheck.checkedCells}/${cloudCheck.expectedCells}一致${unmatchedText}`, 'ok');
    } catch (error) {
      console.warn('Spreadsheet finalizer failed', error);
      setBadge('取込エラー', 'error');
    } finally {
      importing = false;
      if (rerun) scheduleImport(300);
    }
  }

  function buildSiteSkills(localSkills, cloudSkills) {
    const candidates = [];
    if (Array.isArray(localSkills)) candidates.push(...localSkills);
    if (Array.isArray(cloudSkills)) candidates.push(...cloudSkills);
    const usedIds = new Set();

    return SITE_SKILLS.map(spec => {
      const exact = candidates.find(skill => {
        const id = String(skill?.id || '');
        return id && !usedIds.has(id) && sameSkillName(skill?.name, spec.name);
      });
      const fallback = candidates.find(skill => {
        const id = String(skill?.id || '');
        return id === spec.fallbackId && !usedIds.has(id);
      });
      const chosen = exact || fallback || {};
      const id = String(chosen.id || spec.fallbackId);
      usedIds.add(id);
      return { ...chosen, id, name:spec.name, active:true, sourceIndex:spec.sourceIndex };
    });
  }

  function applySpreadsheet(currentStaff, skills) {
    const staff = currentStaff.map(person => ({ ...person, skillLevels:{ ...(person?.skillLevels || {}) } }));
    const index = createIndex(staff);
    const unmatched = [];
    const matchedSourceNames = [];
    let matchedRows = 0;
    const now = new Date().toISOString();

    ROWS.forEach(([sourceId, sourceName, storeId, plan, values]) => {
      if (typeof values !== 'string' || values.length !== 16) return;
      const person = findSourcePerson(index, sourceName);
      if (!person) {
        unmatched.push(sourceName);
        return;
      }

      skills.forEach(skill => {
        person.skillLevels[skill.id] = level(values.charAt(Number(skill.sourceIndex)));
      });
      if (storeId && STORE_NAMES[storeId]) {
        person.mainAffiliation = STORE_NAMES[storeId];
        const ids = Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds.map(String) : [];
        person.affiliationStoreIds = [storeId, ...ids.filter(id => id !== storeId)];
      }
      if (plan === 'A' || plan === 'B') person.workPlanId = plan;
      person.skillSheetTrainingLevel = level(values.charAt(15));
      person.skillSheetImportedAt = now;
      person.skillSheetSource = 'OKK_従業員スキル入力_詳細スキル版.xlsx';
      person.skillUpdatedAt = now;
      person.skills = skills.filter(skill => level(person.skillLevels?.[skill.id]) > 0).map(skill => skill.name);
      matchedSourceNames.push(sourceName);
      matchedRows += 1;
    });

    return { staff, matchedRows, matchedSourceNames, unmatched };
  }

  function verify(staff, skills, matchedSourceNames) {
    const allowed = new Set((matchedSourceNames || []).map(normName));
    const sourceRows = ROWS.filter(row => typeof row[4] === 'string' && allowed.has(normName(row[1])));
    const expectedCells = sourceRows.length * skills.length;
    if (!Array.isArray(staff) || !Array.isArray(skills) || !sourceRows.length) {
      return { ok:false, checkedCells:0, expectedCells, errors:['no-data'] };
    }

    const index = createIndex(staff);
    let checkedCells = 0;
    const errors = [];

    sourceRows.forEach(([, sourceName, , , values]) => {
      const person = findSourcePerson(index, sourceName);
      if (!person) {
        errors.push(`missing:${sourceName}`);
        return;
      }
      skills.forEach(skill => {
        const expected = level(values.charAt(Number(skill.sourceIndex)));
        const actual = level(person.skillLevels?.[skill.id]);
        checkedCells += 1;
        if (actual !== expected && errors.length < 25) errors.push(`${sourceName}:${skill.name}:${actual}!=${expected}`);
      });
    });

    return { ok:checkedCells === expectedCells && errors.length === 0, checkedCells, expectedCells, errors };
  }

  function createIndex(staff) {
    const byId = new Map();
    const byName = new Map();
    staff.forEach(person => {
      const id = String(person?.id || person?.employeeNumber || '').trim().toUpperCase();
      const name = normName(person?.name);
      if (id) byId.set(id, person);
      if (name && !byName.has(name)) byName.set(name, person);
    });
    return { byId, byName };
  }

  function findSourcePerson(index, sourceName) {
    const direct = index.byName.get(normName(sourceName));
    if (direct) return direct;
    const alias = NAME_ALIASES.get(normName(sourceName));
    return alias ? index.byName.get(alias) || null : null;
  }

  function findByCurrentIdentity(index, person) {
    const id = String(person?.id || person?.employeeNumber || '').trim().toUpperCase();
    if (id && index.byId.has(id)) return index.byId.get(id);
    const name = normName(person?.name);
    return name ? index.byName.get(name) || null : null;
  }

  function readArrayRaw(key) {
    try {
      const raw = localStorage.getItem(key);
      const value = raw ? JSON.parse(raw) : [];
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function writeRaw(key, value) {
    const setter = originalStorageSetItem || Storage.prototype.setItem;
    setter.call(localStorage, key, value);
  }

  function normName(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/[\s\u3000・･.．,，]/g, '')
      .trim()
      .toLowerCase();
  }

  function normSkill(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .replace(/[\s\u3000]/g, '')
      .replace(/[（(]/g, '（')
      .replace(/[）)]/g, '）')
      .replace(/[&＆]/g, '＆')
      .replace(/[\/／・]/g, '＆')
      .toLowerCase();
  }

  function sameSkillName(a, b) { return normSkill(a) === normSkill(b); }
  function level(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0; }
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  function setBadge(text, mode) {
    let badge = document.getElementById('skill-sheet-verify-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'skill-sheet-verify-badge';
      badge.style.cssText = 'position:fixed;right:74px;bottom:10px;z-index:9997;padding:5px 9px;border-radius:999px;font:800 9px/1.2 "Noto Sans JP",sans-serif;box-shadow:0 2px 8px rgba(16,24,40,.12);pointer-events:none;max-width:430px;white-space:nowrap';
      document.body.appendChild(badge);
    }
    const palette = {
      ok:['#027a48','#ecfdf3','#abefc6'],
      local:['#175cd3','#eff8ff','#b2ddff'],
      checking:['#344054','#f2f4f7','#d0d5dd'],
      warning:['#b54708','#fffaeb','#fedf89'],
      error:['#b42318','#fef3f2','#fecdca'],
    };
    const [fg,bg,border] = palette[mode] || palette.checking;
    badge.textContent = `Excelスキル：${text}`;
    badge.title = badge.textContent;
    badge.style.color = fg;
    badge.style.background = bg;
    badge.style.border = `1px solid ${border}`;
  }

  function fastSignature(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return String(hash >>> 0);
  }
})();
