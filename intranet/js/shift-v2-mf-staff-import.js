(() => {
  'use strict';

  const STAFF_KEY = 'okk_shift_v2_staff';
  const SHIFTS_KEY = 'okk_shift_v2_shifts';
  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const DEMO_KEY = 'okk_shift_v2_demo_mode';
  const PENDING_SYNC_KEY = 'okk_shift_v2_mf_staff_pending_sync';
  const REPORT_KEY = 'okk_shift_v2_mf_staff_import_report';
  const CLOUD_KEY = 'staff';
  const STORE_MAP = {
    '那覇松山店':'matsuyama', '松山店':'matsuyama',
    '那覇久茂地店':'kumoji', '久茂地店':'kumoji',
    '美栄橋店':'miebashi',
    '沖縄美里店':'misato', '美里店':'misato'
  };
  const H = {
    effectiveDate:'適用開始日',
    id:'基本情報 - 従業員 - 従業員番号',
    lastName:'基本情報 - 従業員 - 姓',
    firstName:'基本情報 - 従業員 - 名',
    lastKana:'基本情報 - 従業員 - 姓（フリガナ）',
    firstKana:'基本情報 - 従業員 - 名（フリガナ）',
    dob:'個人情報 - 基礎情報 - 生年月日',
    employmentType:'人事情報 - 業務 - 契約種別',
    jobCode:'人事情報 - 職種 - 職種コード',
    jobName:'人事情報 - 職種 - 職種名',
    joinDate:'人事情報 - 入退社 - 入社年月日',
    retireDate:'人事情報 - 入退社 - 退職年月日',
    retireType:'人事情報 - 入退社 - 退職区分',
    payType:'給与関連情報 - 支給項目 - 給与区分'
  };

  document.addEventListener('change', onFileChange, true);
  document.addEventListener('shiftv2-cloud-ready', protectPendingSync);
  document.addEventListener('shiftv2-auth', syncPendingToCloud);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    protectPendingSync();
    setTimeout(renderLastReport, 300);
    setTimeout(renderLastReport, 1000);
  }

  async function onFileChange(event) {
    if (event.target?.id !== 'mf-staff-file') return;
    event.stopImmediatePropagation();
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await decode(file);
      const rows = parseObjects(text);
      const result = buildImport(rows);
      if (!result.people.length) throw new Error('従業員番号が入った行を読み取れませんでした。');
      if (result.duplicateIds.length) throw new Error(`従業員番号の重複があります: ${result.duplicateIds.join(', ')}`);

      const demoCount = readArray(STAFF_KEY).filter(isDemoPerson).length;
      const message = [
        'MFクラウド人事 従業員CSVを確認しました。',
        '',
        `CSV行数: ${result.fileRows}行`,
        `取込対象: ${result.people.length}名`,
        `在籍: ${result.activeCount}名 / 退職: ${result.retiredCount}名`,
        `従業員番号なしで除外: ${result.skippedCount}行`,
        `従業員番号重複: ${result.duplicateIds.length}件`,
        `契約種別未設定: ${result.missingEmploymentCount}名`,
        `OKK4店舗の所属なし（在籍）: ${result.noCoreStoreActiveCount}名`,
        demoCount ? `デモ従業員: ${demoCount}名を除外して実データへ切替` : '',
        '',
        'MF由来の基本情報を従業員番号で同期します。既存のスキル・配置条件は同じ従業員番号なら保持します。',
        '反映しますか？'
      ].filter(Boolean).join('\n');
      if (!window.confirm(message)) return;

      applyImport(result);
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'MF従業員CSVの取込に失敗しました。');
    }
  }

  function buildImport(rows) {
    const existing = readArray(STAFF_KEY);
    const existingMap = new Map(existing.filter(person => !isDemoPerson(person)).map(person => [canon(person.id || person.employeeNumber), person]));
    const incoming = new Map();
    const duplicateIds = new Set();
    let skippedCount = 0;
    let missingEmploymentCount = 0;

    rows.forEach(row => {
      const id = canon(row[H.id]);
      if (!id) { skippedCount += 1; return; }
      if (incoming.has(id)) duplicateIds.add(id);
      const person = rowToPerson(row, existingMap.get(id));
      if (person.employmentType === '未設定') missingEmploymentCount += 1;
      incoming.set(id, person);
    });

    const people = [...incoming.values()];
    existingMap.forEach((person, id) => {
      if (!incoming.has(id) && !person.mf?.syncedAt) people.push(person);
    });

    const active = people.filter(person => person.active !== false && person.mf?.syncedAt);
    const retired = people.filter(person => person.active === false && person.mf?.syncedAt);
    const noCoreStoreActiveCount = active.filter(person => !(person.affiliationStoreIds || []).length).length;

    return {
      people,
      fileRows:rows.length,
      skippedCount,
      duplicateIds:[...duplicateIds],
      activeCount:active.length,
      retiredCount:retired.length,
      missingEmploymentCount,
      noCoreStoreActiveCount
    };
  }

  function rowToPerson(row, existing) {
    const id = canon(row[H.id]);
    const lastName = clean(row[H.lastName]);
    const firstName = clean(row[H.firstName]);
    const lastKana = clean(row[H.lastKana]);
    const firstKana = clean(row[H.firstKana]);
    const affiliations = [];

    for (let index = 1; index <= 30; index += 1) {
      const name = clean(row[`基本情報 - 所属 ${index} - 組織名`]);
      if (!name) continue;
      affiliations.push({
        name,
        code:clean(row[`基本情報 - 所属 ${index} - 組織コード`]),
        roleCode:clean(row[`基本情報 - 所属 ${index} - 役職コード`]),
        roleName:clean(row[`基本情報 - 所属 ${index} - 役職名`]),
        primary:clean(row[`基本情報 - 所属 ${index} - 主務かどうか`]) === '主務',
        storeId:STORE_MAP[name] || ''
      });
    }

    const primary = affiliations.find(item => item.primary) || affiliations[0] || null;
    const affiliationStoreIds = unique(affiliations.map(item => item.storeId).filter(Boolean));
    const payType = clean(row[H.payType]);
    const employmentType = clean(row[H.employmentType]) || '未設定';
    const retireDate = clean(row[H.retireDate]);
    const active = !retireDate || retireDate > todayKey();

    return {
      ...(existing || {}),
      id,
      employeeNumber:id,
      lastName,
      firstName,
      name:`${lastName} ${firstName}`.trim() || id,
      lastKana,
      firstKana,
      kana:`${lastKana} ${firstKana}`.trim(),
      dob:clean(row[H.dob]),
      employmentType,
      payType,
      salaryType:payType === '月給' ? 'monthly' : 'hourly',
      jobCode:clean(row[H.jobCode]),
      jobName:clean(row[H.jobName]),
      joinDate:clean(row[H.joinDate]),
      retireDate,
      retireType:clean(row[H.retireType]),
      active,
      affiliations,
      mainAffiliation:primary?.name || '',
      mainStoreId:primary?.storeId || '',
      affiliationStoreIds,
      placementStoreIds:Array.isArray(existing?.placementStoreIds) ? existing.placementStoreIds : affiliationStoreIds,
      autoAssign:affiliationStoreIds.length > 0 && existing?.autoAssign !== false,
      operationMemo:existing?.operationMemo || '',
      skillLevels:existing?.skillLevels && typeof existing.skillLevels === 'object' ? existing.skillLevels : {},
      skills:Array.isArray(existing?.skills) ? existing.skills : [],
      workConstraints:existing?.workConstraints && typeof existing.workConstraints === 'object' ? existing.workConstraints : undefined,
      workPlanId:existing?.workPlanId || '',
      mf:{
        effectiveDate:clean(row[H.effectiveDate]),
        syncedAt:new Date().toISOString(),
        source:'MFクラウド人事 従業員CSV'
      }
    };
  }

  function applyImport(result) {
    localStorage.setItem(STAFF_KEY, JSON.stringify(result.people));

    if (localStorage.getItem(DEMO_KEY) === '1' || readArray(STAFF_KEY).some(isDemoPerson)) {
      localStorage.removeItem(DEMO_KEY);
    }
    stripDemoReferences();

    const report = {
      importedAt:new Date().toISOString(),
      total:result.people.filter(person => person.mf?.syncedAt).length,
      active:result.activeCount,
      retired:result.retiredCount,
      skipped:result.skippedCount,
      missingEmployment:result.missingEmploymentCount,
      noCoreStoreActive:result.noCoreStoreActiveCount
    };
    localStorage.setItem(REPORT_KEY, JSON.stringify(report));
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify({ createdAt:new Date().toISOString() }));
    sessionStorage.setItem('okk_shift_v2_return_view', 'master');

    if (window.shiftV2Cloud && window.shiftV2User) {
      syncPendingToCloud().finally(() => window.location.reload());
    } else {
      window.location.reload();
    }
  }

  function stripDemoReferences() {
    const shifts = readJson(SHIFTS_KEY, {});
    Object.keys(shifts).forEach(date => {
      if (!Array.isArray(shifts[date])) return;
      shifts[date] = shifts[date].filter(shift => !isDemoId(shift?.staffId));
    });
    localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts));

    const holidays = readJson(HOLIDAY_KEY, {});
    if (Array.isArray(holidays.staffDays)) {
      holidays.staffDays = holidays.staffDays.filter(row => !isDemoId(row?.staffId));
      localStorage.setItem(HOLIDAY_KEY, JSON.stringify(holidays));
    }
  }

  function protectPendingSync() {
    if (!localStorage.getItem(PENDING_SYNC_KEY)) return;
    const cloud = window.shiftV2Cloud;
    if (!cloud?.get || cloud.__mfStaffProtected) return;
    const originalGet = cloud.get.bind(cloud);
    cloud.get = async key => {
      if (key === CLOUD_KEY && localStorage.getItem(PENDING_SYNC_KEY)) return readArray(STAFF_KEY);
      return originalGet(key);
    };
    cloud.__mfStaffProtected = true;
    if (window.shiftV2User) syncPendingToCloud();
  }

  async function syncPendingToCloud() {
    if (!localStorage.getItem(PENDING_SYNC_KEY)) return;
    if (!window.shiftV2Cloud?.set || !window.shiftV2User) return;
    try {
      await window.shiftV2Cloud.set(CLOUD_KEY, readArray(STAFF_KEY));
      localStorage.removeItem(PENDING_SYNC_KEY);
    } catch (error) {
      console.warn('MF staff pending cloud sync failed', error);
    }
  }

  function renderLastReport() {
    const report = readJson(REPORT_KEY, null);
    const hero = document.querySelector('#view-master .master-hero');
    if (!report || !hero || document.getElementById('mf-import-report')) return;
    const box = document.createElement('div');
    box.id = 'mf-import-report';
    box.style.cssText = 'margin:0 0 10px;padding:9px 12px;border:1px solid #abefc6;border-radius:9px;background:#ecfdf3;color:#067647;font-size:10px;font-weight:700';
    box.innerHTML = `<strong>MF人事CSV 同期済み ${report.total}名</strong>　在籍 ${report.active}名 / 退職 ${report.retired}名 / 番号なし除外 ${report.skipped}行${report.missingEmployment ? ` / 契約種別未設定 ${report.missingEmployment}名` : ''}${report.noCoreStoreActive ? ` / OKK4店舗所属なし ${report.noCoreStoreActive}名` : ''}`;
    hero.insertAdjacentElement('afterend', box);
  }

  async function decode(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (window.Encoding?.detect) {
      const detected = window.Encoding.detect(bytes) || 'UTF8';
      const unicode = window.Encoding.convert(bytes, { to:'UNICODE', from:detected });
      return window.Encoding.codeToString(unicode).replace(/^\uFEFF/, '');
    }
    return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  }

  function parseObjects(text) {
    const matrix = parseCsv(text);
    if (!matrix.length) return [];
    const headers = matrix[0].map(value => clean(value));
    if (!headers.includes(H.id)) throw new Error('MFクラウド人事の従業員番号列が見つかりません。');
    return matrix.slice(1)
      .filter(row => row.some(value => clean(value)))
      .map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { row.push(cell); cell = ''; }
      else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += char;
    }
    if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
    return rows;
  }

  function isDemoPerson(person) {
    return Boolean(person?.demoOnly) || isDemoId(person?.id || person?.employeeNumber);
  }
  function isDemoId(value) { return /^DEMO\d+/i.test(String(value || '').trim()); }
  function canon(value) { return clean(value).toUpperCase(); }
  function clean(value) { return String(value ?? '').trim(); }
  function unique(values) { return [...new Set(values)]; }
  function todayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function readArray(key) { const value = readJson(key, []); return Array.isArray(value) ? value : []; }
  function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
})();
