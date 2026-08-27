(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const CLOUD_STAFF = 'staff';
  const CLOUD_MARKER = 'skillSpreadsheetMapped20260827v1';

  const STORE_NAMES = {
    matsuyama:'松山店', kumoji:'久茂地店', miebashi:'美栄橋店', misato:'美里店'
  };

  // Spreadsheet skill order:
  // 0 オープン準備 / 1 締め作業 / 2 肉場（オーダー） / 3 肉場（仕込み）
  // 4 肉場（発注・在庫管理） / 5 肉場（食材管理） / 6 肉焼き
  // 7 サラダ場（オーダー） / 8 サラダ場（仕込み） / 9 サラダ場（発注・在庫管理）
  // 10 サラダ場（食材管理） / 11 ドリンカー / 12 ホール / 13 洗い場 / 14 レジ / 15 指導・教育
  const ROWS = [["1","又吉 達朗","matsuyama",null,"3333333333333333"],["2","新城 優樹","misato","B","3333333333333333"],["3","又吉 健太","miebashi","B","3333333333333333"],["4","三澤 北斗","kumoji","B","3333333333333333"],["5","チャン フー ダット","matsuyama","B","3333330333321303"],["6","ガンガナート","kumoji","A","3310000331300102"],["7","ダヌカ","kumoji","A","3333331110000202"],["8","チャミル","miebashi","A","3222020220200102"],["9","プラタナ","matsuyama","A","2100000220200001"],["10","ラヒル","matsuyama","A","2222020000000001"],["11","アウィシカ","kumoji","A","2200000220100000"],["12","エシャン","matsuyama","A","1221020000000000"],["13","仲里 大三","misato","A","2222221000012221"],["14","松下 宰","misato","A","1210000222201201"],["15","松田 海人","misato","A","2200002100022221"],["16","川上 なつみ","misato","A","2000002000012201"],["111","大城 未琴","kumoji",null,"3300003110033232"],["112","安里茜マーティン","matsuyama",null,"0100002000022221"],["113","佐久田 春斗","matsuyama",null,"0000000000021200"],["114","知念 あおい",null,null,null],["115","岸田 博行","kumoji",null,"0100000000011200"],["116","宮城 文弥","kumoji",null,"0200002000032232"],["117","名嘉 崚馬","matsuyama",null,"0000002000002100"],["118","下地 美弥","matsuyama",null,"0200002000022120"],["119","仲地 海斗","miebashi",null,"3000002000022222"],["120","池原 幸輝","kumoji",null,"2200000220210000"],["121","安仁屋 匠冴","matsuyama",null,"2200002000022220"],["122","榮 竜騎","miebashi",null,"3200002000022221"],["123","新里 紫緒那","kumoji",null,"3200002000022221"],["124","平川 翔","kumoji",null,"2000002000022220"],["125","前大 仁胡","matsuyama",null,"2000002000012000"],["126","玉那覇 文美","matsuyama",null,"3300003000033333"],["127","久保 真人","matsuyama",null,"0200000000022220"],["128","村田 悠華",null,null,null],["129","玉城 悠登","matsuyama",null,"0200002000022221"],["130","島袋 玲亜琉","kumoji",null,"0100002000012100"],["132","阿波根 啓","misato",null,"1100002000022221"],["133","桑江 旭","misato",null,"2121010332222223"],["134","上江洲 杏果","misato",null,"2000002000022200"],["135","當銘 マリン",null,null,null],["136","糸満 苺莉愛","misato",null,"2000002000022200"],["137","平田 明久","misato",null,"2100002210132221"],["138","栄野比 あいみ","misato","A","3200002000023222"],["139","金城 綾華","misato",null,"0000002000022220"],["140","大嶺 華笑","misato",null,"0222022110122221"],["141","當山 健人","misato",null,"1000000220110200"],["142","松田 淳生","misato",null,"0200002000022210"],["143","兼城 清琉","misato",null,"1021010000000000"],["144","譜久里 光流",null,null,null],["145","渡口 来夢","misato",null,"2022020000011201"],["146","具志堅 詩苑","misato",null,"2000002000022200"],["148","又吉 未愉","matsuyama",null,"3310013110133333"],["149","サリバン 莉愛","misato",null,"1000002000022200"],["150","新里 海笑",null,null,null],["151","又吉 敦子","matsuyama",null,"0000000000012120"]];

  const NAME_ALIASES = new Map([
    [normName('又吉 達朗'), normName('又吉 達郎')],
    [normName('大城 未琴'), normName('大城 美琴')],
  ]);

  let cloudSaving = false;
  let lastCloudSignature = '';

  if (window.__shiftV2SkillSheetCanonicalInstalled) return;
  window.__shiftV2SkillSheetCanonicalInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scheduleApply(900), { once:true });
  else scheduleApply(900);

  document.addEventListener('shiftv2-auth', () => scheduleApply(1900));
  document.addEventListener('shiftv2-cloud-ready', () => scheduleApply(2100));
  document.addEventListener('shiftv2-access-changed', () => scheduleApply(500));
  document.addEventListener('shiftv2-master-data-changed', () => scheduleApply(120));
  document.addEventListener('click', event => {
    if (event.target.closest?.('.tab[data-view="master"],[data-unified-master="employees"]')) scheduleApply(100);
  }, false);

  function scheduleApply(delay) {
    setTimeout(() => void applyMappedSpreadsheet(), delay);
  }

  async function applyMappedSpreadsheet() {
    let siteSkills = readArray(SKILLS_KEY).filter(skill => skill && skill.active !== false);
    let currentStaff = readArray(STAFF_KEY);

    if (window.shiftV2Cloud && window.shiftV2User) {
      try {
        const [cloudSkills, cloudStaff] = await Promise.all([
          window.shiftV2Cloud.get('shiftV2Skills'),
          window.shiftV2Cloud.get(CLOUD_STAFF),
        ]);
        if (Array.isArray(cloudSkills) && cloudSkills.length) {
          const cloudMapped = mappedSiteSkills(cloudSkills);
          const localMapped = mappedSiteSkills(siteSkills);
          if (cloudMapped.length >= localMapped.length) {
            siteSkills = cloudSkills.filter(skill => skill && skill.active !== false);
            localStorage.setItem(SKILLS_KEY, JSON.stringify(cloudSkills));
          }
        }
        if (Array.isArray(cloudStaff) && cloudStaff.length) currentStaff = cloudStaff;
      } catch (error) {
        console.warn('Skill spreadsheet: cloud preload failed', error);
      }
    }

    if (!currentStaff.length || !siteSkills.length) return;

    const mappedSkills = mappedSiteSkills(siteSkills);
    const unmapped = siteSkills.filter(skill => sourceIndexForSiteSkill(skill.name) < 0).map(skill => String(skill.name || ''));
    if (mappedSkills.length < 15) {
      console.warn('Skill spreadsheet: site skill mapping incomplete', { mappedSkills, unmapped, siteSkills });
      toast(`スキル対応表エラー：${mappedSkills.length}項目しか認識できません`);
      return;
    }

    const merged = mergeStaff(currentStaff, siteSkills, mappedSkills);
    if (merged.matchedSkillRows < 45) {
      console.warn('Skill spreadsheet: employee match too low', merged);
      toast(`従業員照合エラー：${merged.matchedSkillRows}名のみ一致`);
      return;
    }

    const staffJson = JSON.stringify(merged.staff);
    if (localStorage.getItem(STAFF_KEY) !== staffJson) {
      localStorage.setItem(STAFF_KEY, staffJson);
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));
    }

    window.shiftV2SkillSpreadsheetStatus = {
      mappedSkillNames: mappedSkills.map(item => item.skill.name),
      unmappedSkillNames: unmapped,
      matchedEmployees: merged.matchedSkillRows,
      unmatchedEmployees: merged.unmatched,
    };

    if (window.shiftV2Access?.canEditHeadquarters?.() !== true || !window.shiftV2Cloud || !window.shiftV2User) return;

    const signature = fastSignature(staffJson + JSON.stringify(mappedSkills.map(item => [item.skill.id, item.sourceIndex])));
    if (cloudSaving || signature === lastCloudSignature) return;

    cloudSaving = true;
    try {
      // Important: preserve the site's existing skill definitions and IDs. Only staff levels are updated.
      await window.shiftV2Cloud.set(CLOUD_STAFF, merged.staff);
      const checkStaff = await window.shiftV2Cloud.get(CLOUD_STAFF);
      const check = verify(checkStaff, siteSkills, mappedSkills);
      if (!check.ok) {
        throw new Error(`verify-failed rows=${check.matchedRows}/${check.expectedRows} cells=${check.checkedCells}/${check.expectedCells}`);
      }

      await window.shiftV2Cloud.set(CLOUD_MARKER, {
        verified:true,
        verifiedAt:new Date().toISOString(),
        source:'OKK_従業員スキル入力_詳細スキル版.xlsx',
        matchedRows:check.matchedRows,
        mappedSkills:mappedSkills.length,
        checkedCells:check.checkedCells,
        unmappedSkills:unmapped,
      });

      lastCloudSignature = signature;
      localStorage.setItem(STAFF_KEY, JSON.stringify(checkStaff));
      document.dispatchEvent(new CustomEvent('shiftv2-master-render-request'));
      toast(`スキル反映確認済：${check.matchedRows}名 × ${mappedSkills.length}項目`);
    } catch (error) {
      console.warn('Skill spreadsheet mapped save failed', error);
      toast('スキル反映エラー：保存後の照合に失敗しました');
    } finally {
      cloudSaving = false;
    }
  }

  function mappedSiteSkills(siteSkills) {
    return siteSkills
      .map(skill => ({ skill, sourceIndex:sourceIndexForSiteSkill(skill?.name) }))
      .filter(item => item.sourceIndex >= 0 && item.skill?.id);
  }

  function sourceIndexForSiteSkill(name) {
    const n = normSkill(name);
    if (!n) return -1;

    if (n.includes('オープン準備')) return 0;
    if (n.includes('締め作業') || n === '締め') return 1;

    if (n.includes('肉場') && n.includes('オーダー')) return 2;
    if (n.includes('肉場') && n.includes('仕込み')) return 3;
    if (n.includes('肉場') && n.includes('発注') && n.includes('在庫')) return 4;
    if (n.includes('肉場') && n.includes('食材管理')) return 5;

    // Current site separates hall staff by whether they can grill meat.
    if (n.includes('ホール') && n.includes('肉焼けない')) return 12;
    if (n.includes('ホール') && n.includes('肉焼ける')) return 6;
    if (n === '肉焼き' || n.includes('肉焼き')) return 6;

    if (n.includes('サラダ場') && n.includes('オーダー')) return 7;
    if (n.includes('サラダ場') && n.includes('仕込み')) return 8;
    if (n.includes('サラダ場') && n.includes('発注') && n.includes('在庫')) return 9;
    if (n.includes('サラダ場') && n.includes('食材管理')) return 10;

    if (n.includes('ドリンカー') || n === 'ドリンク') return 11;
    if (n === 'ホール') return 12;
    if (n.includes('洗い場')) return 13;
    if (n === 'レジ' || n.includes('レジ')) return 14;
    if (n.includes('指導') || n.includes('教育')) return 15;

    // Compatibility with older generic skill names if they are still present.
    if (n === '肉場') return 2;
    if (n === 'サラダ場') return 7;
    return -1;
  }

  function mergeStaff(current, siteSkills, mappedSkills) {
    const staff = current.map(person => ({ ...person, skillLevels:{ ...(person.skillLevels || {}) } }));
    const index = createIndex(staff);
    let matchedSkillRows = 0;
    const unmatched = [];
    const now = new Date().toISOString();

    ROWS.forEach(([employeeId, spreadsheetName, storeId, plan, levels]) => {
      const person = findPerson(index, employeeId, spreadsheetName);
      if (!person) {
        if (typeof levels === 'string') unmatched.push(`${employeeId}:${spreadsheetName}`);
        return;
      }

      if (storeId && STORE_NAMES[storeId]) {
        person.mainAffiliation = STORE_NAMES[storeId];
        const ids = Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds.map(String) : [];
        person.affiliationStoreIds = [storeId, ...ids.filter(id => id !== storeId)];
      }
      if (plan === 'A' || plan === 'B') person.workPlanId = plan;

      if (typeof levels === 'string' && levels.length === 16) {
        mappedSkills.forEach(({ skill, sourceIndex }) => {
          person.skillLevels[skill.id] = clamp(levels.charAt(sourceIndex));
        });
        person.skillUpdatedAt = now;
        person.skillSheetImportedAt = now;
        matchedSkillRows += 1;
      }

      person.skills = siteSkills
        .filter(skill => skill?.active !== false && clamp(person.skillLevels?.[skill.id]) > 0)
        .map(skill => skill.name);
    });

    return { staff, matchedSkillRows, unmatched };
  }

  function verify(staff, siteSkills, mappedSkills) {
    if (!Array.isArray(staff)) return { ok:false, matchedRows:0, expectedRows:0, checkedCells:0, expectedCells:0 };
    const index = createIndex(staff);
    const expectedDataRows = ROWS.filter(row => typeof row[4] === 'string');
    let matchedRows = 0;
    let checkedCells = 0;
    let foundRows = 0;

    expectedDataRows.forEach(([employeeId, spreadsheetName, , , levels]) => {
      const person = findPerson(index, employeeId, spreadsheetName);
      if (!person) return;
      foundRows += 1;
      let rowOk = true;
      mappedSkills.forEach(({ skill, sourceIndex }) => {
        const expected = clamp(levels.charAt(sourceIndex));
        const actual = clamp(person.skillLevels?.[skill.id]);
        checkedCells += 1;
        if (actual !== expected) rowOk = false;
      });
      if (rowOk) matchedRows += 1;
    });

    const expectedCells = foundRows * mappedSkills.length;
    return {
      ok: foundRows >= 45 && matchedRows === foundRows && checkedCells === expectedCells,
      matchedRows,
      expectedRows:foundRows,
      checkedCells,
      expectedCells,
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

  function normName(value) {
    return String(value ?? '').replace(/[\s\u3000]+/g, '').trim().toLowerCase();
  }

  function normSkill(value) {
    return String(value ?? '')
      .replace(/[\s\u3000]+/g, '')
      .replace(/[（(]/g, '（')
      .replace(/[）)]/g, '）')
      .replace(/[&＆]/g, '・')
      .replace(/\/|／/g, '・')
      .toLowerCase();
  }

  function clamp(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0;
  }

  function fastSignature(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return String(hash >>> 0);
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 3800);
  }
})();
