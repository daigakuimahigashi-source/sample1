(() => {
  'use strict';

  const STORAGE_STAFF = 'okk_shift_v2_staff';
  const CLOUD_KEY = 'staff';
  const SKILLS = [
    { id: 'opening', name: 'オープン準備' },
    { id: 'closing', name: '締め作業' },
    { id: 'meat', name: '肉場' },
    { id: 'salad', name: 'サラダ場' },
    { id: 'hall', name: 'ホール' },
    { id: 'drink', name: 'ドリンク' },
    { id: 'dish', name: '洗い場' },
    { id: 'register', name: 'レジ' },
  ];
  const LEVEL_LABELS = ['未経験', 'できる', '責任もってできる', '教育できる'];
  const STORE_MAP = {
    '那覇松山店': 'matsuyama',
    '松山店': 'matsuyama',
    '那覇久茂地店': 'kumoji',
    '久茂地店': 'kumoji',
    '美栄橋店': 'miebashi',
    '沖縄美里店': 'misato',
    '美里店': 'misato',
  };
  const STORE_NAMES = {
    matsuyama: '松山店',
    kumoji: '久茂地店',
    miebashi: '美栄橋店',
    misato: '美里店',
  };
  const H = {
    effectiveDate: '適用開始日',
    id: '基本情報 - 従業員 - 従業員番号',
    lastName: '基本情報 - 従業員 - 姓',
    firstName: '基本情報 - 従業員 - 名',
    lastKana: '基本情報 - 従業員 - 姓（フリガナ）',
    firstKana: '基本情報 - 従業員 - 名（フリガナ）',
    dob: '個人情報 - 基礎情報 - 生年月日',
    employmentType: '人事情報 - 業務 - 契約種別',
    jobCode: '人事情報 - 職種 - 職種コード',
    jobName: '人事情報 - 職種 - 職種名',
    joinDate: '人事情報 - 入退社 - 入社年月日',
    retireDate: '人事情報 - 入退社 - 退職年月日',
    retireType: '人事情報 - 入退社 - 退職区分',
    payType: '給与関連情報 - 支給項目 - 給与区分',
  };

  const state = {
    staff: normalizeStaffList(loadJson(STORAGE_STAFF, [])),
    query: '',
    employment: '',
    store: '',
    showInactive: false,
    selectedId: '',
    dirty: false,
    saving: false,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    injectStyles();
    injectUi();
    bindGlobalEvents();
    decoratePlannerStaff();
    render();
    setTimeout(hydrateCloud, 800);
    setTimeout(restoreViewAfterReload, 150);
  }

  function injectUi() {
    if (document.getElementById('view-master')) return;
    const tabs = document.querySelector('.tabs');
    const csvTab = tabs?.querySelector('[data-view="csv"]');
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.dataset.view = 'master';
    tab.innerHTML = '<i class="fa-solid fa-address-card"></i> 従業員マスタ';
    if (csvTab) tabs.insertBefore(tab, csvTab);
    else tabs?.appendChild(tab);

    const section = document.createElement('section');
    section.id = 'view-master';
    section.className = 'view';
    section.innerHTML = `
      <div class="master-hero card">
        <div>
          <div class="master-title">従業員カルテ・スキルマトリクス</div>
          <div class="master-sub">MFクラウド人事のCSVを従業員番号で同期。MF由来情報だけ更新し、スキル・配置条件は残します。</div>
        </div>
        <div class="master-import-actions">
          <input id="mf-staff-file" type="file" accept=".csv,text/csv" hidden>
          <button id="mf-staff-import" class="btn btn-green"><i class="fa-solid fa-file-import"></i> MF従業員CSV取込</button>
          <button id="master-sync-cloud" class="btn btn-light"><i class="fa-solid fa-cloud-arrow-up"></i> クラウド保存</button>
        </div>
      </div>

      <div id="master-summary" class="master-summary"></div>

      <div class="card master-toolbar">
        <div class="master-filter-group">
          <input id="master-search" class="control" placeholder="氏名・従業員番号・所属で検索">
          <select id="master-employment" class="control"><option value="">雇用区分：すべて</option><option>正社員</option><option>アルバイト</option><option>契約社員</option><option>役員</option><option value="__blank">未設定</option></select>
          <select id="master-store" class="control"><option value="">所属：すべて</option><option value="matsuyama">松山店</option><option value="kumoji">久茂地店</option><option value="miebashi">美栄橋店</option><option value="misato">美里店</option></select>
          <label class="master-check"><input id="master-inactive" type="checkbox"> 退職者も表示</label>
        </div>
        <div class="skill-legend"><span>習熟度</span>${LEVEL_LABELS.map((label, i) => `<span class="skill-legend-item level-${i}"><b>${i}</b>${esc(label)}</span>`).join('')}</div>
      </div>

      <div class="card master-table-card">
        <div class="master-table-wrap">
          <table class="master-table">
            <thead><tr><th class="sticky-col employee-col">従業員</th><th>雇用</th><th>主所属</th>${SKILLS.map(skill => `<th class="skill-head">${esc(skill.name)}</th>`).join('')}<th>配置</th></tr></thead>
            <tbody id="master-body"></tbody>
          </table>
        </div>
      </div>
    `;
    document.querySelector('.workspace')?.appendChild(section);

    const modal = document.createElement('div');
    modal.id = 'staff-card-modal';
    modal.className = 'staff-card-modal-bg';
    modal.innerHTML = '<div class="staff-card-modal"><div id="staff-card-modal-content"></div></div>';
    document.body.appendChild(modal);

    tab.addEventListener('click', event => {
      event.preventDefault();
      activateMasterView();
    });
  }

  function bindGlobalEvents() {
    document.getElementById('mf-staff-import')?.addEventListener('click', () => document.getElementById('mf-staff-file')?.click());
    document.getElementById('mf-staff-file')?.addEventListener('change', onImportFile);
    document.getElementById('master-sync-cloud')?.addEventListener('click', () => saveStaff(true));
    document.getElementById('master-search')?.addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); renderTable(); });
    document.getElementById('master-employment')?.addEventListener('change', event => { state.employment = event.target.value; renderTable(); });
    document.getElementById('master-store')?.addEventListener('change', event => { state.store = event.target.value; renderTable(); });
    document.getElementById('master-inactive')?.addEventListener('change', event => { state.showInactive = event.target.checked; renderTable(); });
    document.getElementById('staff-card-modal')?.addEventListener('click', event => { if (event.target.id === 'staff-card-modal') closeCard(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeCard(); });
    document.addEventListener('shiftv2-auth', () => setTimeout(hydrateCloud, 250));

    document.querySelectorAll('.tab:not([data-view="master"])').forEach(tab => {
      tab.addEventListener('click', event => {
        if (!state.dirty || !document.getElementById('view-master')?.classList.contains('active')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        sessionStorage.setItem('okk_shift_v2_return_view', tab.dataset.view || 'planner');
        window.location.reload();
      }, true);
    });

    const staffList = document.getElementById('staff-list');
    if (staffList) new MutationObserver(decoratePlannerStaff).observe(staffList, { childList: true, subtree: true });
  }

  function activateMasterView() {
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item.dataset.view === 'master'));
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === 'view-master'));
    render();
  }

  function restoreViewAfterReload() {
    const target = sessionStorage.getItem('okk_shift_v2_return_view');
    if (!target) return;
    sessionStorage.removeItem('okk_shift_v2_return_view');
    const tab = document.querySelector(`.tab[data-view="${cssEsc(target)}"]`);
    if (target === 'master') activateMasterView();
    else tab?.click();
  }

  function render() { renderSummary(); renderTable(); }

  function renderSummary() {
    const active = state.staff.filter(person => person.active !== false);
    const fullTime = active.filter(person => person.employmentType === '正社員').length;
    const partTime = active.filter(person => person.employmentType === 'アルバイト').length;
    const skillReady = active.filter(person => SKILLS.some(skill => Number(person.skillLevels?.[skill.id] || 0) > 0)).length;
    const synced = state.staff.filter(person => person.mf?.syncedAt).length;
    const summary = document.getElementById('master-summary');
    if (!summary) return;
    summary.innerHTML = metric('在籍', `${active.length}名`, `登録 ${state.staff.length}名`) + metric('正社員', `${fullTime}名`, '自動配置で先行') + metric('アルバイト', `${partTime}名`, '不足枠を補完') + metric('スキル登録済', `${skillReady}名`, `未登録 ${Math.max(0, active.length - skillReady)}名`) + metric('MF同期済', `${synced}名`, synced ? '従業員番号で更新' : 'CSV取込待ち');
  }

  function metric(label, value, sub) { return `<div class="card master-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`; }

  function filteredStaff() {
    return state.staff.filter(person => {
      if (!state.showInactive && person.active === false) return false;
      if (state.employment === '__blank' && person.employmentType) return false;
      if (state.employment && state.employment !== '__blank' && person.employmentType !== state.employment) return false;
      if (state.store && !(person.affiliationStoreIds || []).includes(state.store)) return false;
      const haystack = [person.id, person.name, person.kana, person.employmentType, person.mainAffiliation, ...(person.affiliations || []).map(item => item.name), ...SKILLS.filter(skill => Number(person.skillLevels?.[skill.id] || 0) > 0).map(skill => skill.name)].join(' ').toLowerCase();
      if (state.query && !haystack.includes(state.query)) return false;
      return true;
    }).sort((a, b) => Number(a.active === false) - Number(b.active === false) || employmentOrder(a.employmentType) - employmentOrder(b.employmentType) || String(a.name).localeCompare(String(b.name), 'ja'));
  }

  function renderTable() {
    const body = document.getElementById('master-body');
    if (!body) return;
    const people = filteredStaff();
    body.innerHTML = people.map(person => `
      <tr data-person-id="${esc(person.id)}" class="${person.active === false ? 'inactive-row' : ''}">
        <td class="sticky-col employee-col"><button class="employee-button" data-open-card="${esc(person.id)}"><strong>${esc(person.name || person.id)}</strong><span>${esc(person.id)}</span>${person.active === false ? '<em>退職</em>' : ''}</button></td>
        <td><span class="employment-chip ${employmentClass(person.employmentType)}">${esc(person.employmentType || '未設定')}</span><small class="pay-type">${esc(person.payType || '')}</small></td>
        <td><strong>${esc(shortAffiliation(person.mainAffiliation || ''))}</strong><small class="affiliation-sub">${Math.max(0, (person.affiliations || []).length - 1) ? `ほか${(person.affiliations || []).length - 1}` : ''}</small></td>
        ${SKILLS.map(skill => skillButton(person, skill)).join('')}
        <td><button class="auto-chip ${person.autoAssign === false ? 'off' : 'on'}" data-auto="${esc(person.id)}">${person.autoAssign === false ? '対象外' : '自動配置'}</button></td>
      </tr>
    `).join('') || '<tr><td colspan="12" class="master-empty">条件に合う従業員はいません。</td></tr>';

    body.querySelectorAll('[data-skill-person]').forEach(button => button.addEventListener('click', () => {
      const person = getPerson(button.dataset.skillPerson);
      if (!person) return;
      const skillId = button.dataset.skillId;
      const current = Number(person.skillLevels?.[skillId] || 0);
      if (!person.skillLevels) person.skillLevels = {};
      person.skillLevels[skillId] = (current + 1) % 4;
      syncLegacySkills(person);
      markDirtyAndSave();
      renderSummary();
      renderTable();
    }));

    body.querySelectorAll('[data-auto]').forEach(button => button.addEventListener('click', () => {
      const person = getPerson(button.dataset.auto);
      if (!person) return;
      person.autoAssign = person.autoAssign === false;
      markDirtyAndSave();
      renderTable();
    }));

    body.querySelectorAll('[data-open-card]').forEach(button => button.addEventListener('click', () => openCard(button.dataset.openCard)));
  }

  function skillButton(person, skill) {
    const level = clampLevel(person.skillLevels?.[skill.id]);
    return `<td class="skill-cell"><button class="skill-level level-${level}" data-skill-person="${esc(person.id)}" data-skill-id="${esc(skill.id)}" title="${esc(`${skill.name}: ${level} ${LEVEL_LABELS[level]}`)}"><b>${level}</b><span>${esc(LEVEL_LABELS[level])}</span></button></td>`;
  }

  function openCard(id) {
    const person = getPerson(id);
    if (!person) return;
    state.selectedId = id;
    const modal = document.getElementById('staff-card-modal');
    const content = document.getElementById('staff-card-modal-content');
    if (!modal || !content) return;
    content.innerHTML = `
      <div class="staff-card-head">
        <div><span class="staff-card-kicker">従業員カルテ</span><h2>${esc(person.name || person.id)}</h2><div>${esc(person.id)} ・ ${esc(person.employmentType || '未設定')} ・ ${esc(person.payType || '')}</div></div>
        <button id="staff-card-close" class="btn btn-light btn-small"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="staff-card-body">
        <section class="staff-card-section"><h3>MFクラウド人事から同期</h3>
          <div class="staff-info-grid">
            ${info('氏名（フリガナ）', person.kana || '—')}
            ${info('主所属', person.mainAffiliation || '—')}
            ${info('兼務所属', (person.affiliations || []).map(item => item.name).join(' / ') || '—')}
            ${info('入社日', person.joinDate || '—')}
            ${info('退職日', person.retireDate || '—')}
            ${info('生年月日', person.dob || '—')}
            ${info('職種', person.jobName || person.jobCode || '—')}
            ${info('MF適用開始日', person.mf?.effectiveDate || '—')}
          </div>
          <div class="staff-mf-note"><i class="fa-solid fa-lock"></i> この欄はMFを正本としてCSV再取込で更新します。</div>
        </section>
        <section class="staff-card-section"><h3>スキル・習熟度</h3><div class="card-skill-grid">${SKILLS.map(skill => {
          const level = clampLevel(person.skillLevels?.[skill.id]);
          return `<button class="card-skill level-${level}" data-card-skill="${esc(skill.id)}"><span>${esc(skill.name)}</span><b>${level}</b><small>${esc(LEVEL_LABELS[level])}</small></button>`;
        }).join('')}</div></section>
        <section class="staff-card-section"><h3>配置条件</h3>
          <div class="placement-grid">
            <label class="placement-switch"><input id="card-auto-assign" type="checkbox" ${person.autoAssign === false ? '' : 'checked'}> 自動配置の対象にする</label>
            <div><label class="field-label">配置可能店舗</label><div class="store-checks">${Object.entries(STORE_NAMES).map(([storeId, name]) => `<label><input type="checkbox" data-placement-store="${esc(storeId)}" ${(person.placementStoreIds || person.affiliationStoreIds || []).includes(storeId) ? 'checked' : ''}> ${esc(name)}</label>`).join('')}</div></div>
            <div><label class="field-label">運用メモ</label><textarea id="card-operation-memo" class="control" rows="3" placeholder="学校・固定休・配置上の注意など。機微な人事情報は書かない。">${esc(person.operationMemo || '')}</textarea></div>
          </div>
        </section>
      </div>
      <div class="staff-card-foot"><span>スキルはクリックで 0→1→2→3→0</span><button id="staff-card-save" class="btn btn-green"><i class="fa-solid fa-floppy-disk"></i>カルテを保存</button></div>
    `;
    modal.classList.add('open');
    document.getElementById('staff-card-close')?.addEventListener('click', closeCard);
    content.querySelectorAll('[data-card-skill]').forEach(button => button.addEventListener('click', () => {
      if (!person.skillLevels) person.skillLevels = {};
      const skillId = button.dataset.cardSkill;
      person.skillLevels[skillId] = (clampLevel(person.skillLevels[skillId]) + 1) % 4;
      syncLegacySkills(person);
      openCard(person.id);
      markDirtyAndSave();
    }));
    document.getElementById('staff-card-save')?.addEventListener('click', () => {
      person.autoAssign = document.getElementById('card-auto-assign')?.checked !== false;
      person.placementStoreIds = Array.from(content.querySelectorAll('[data-placement-store]:checked')).map(input => input.dataset.placementStore);
      person.operationMemo = document.getElementById('card-operation-memo')?.value.trim() || '';
      markDirtyAndSave(true);
      render();
      closeCard();
    });
  }

  function info(label, value) { return `<div class="staff-info"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`; }
  function closeCard() { document.getElementById('staff-card-modal')?.classList.remove('open'); state.selectedId = ''; }

  async function onImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await decodeCsvFile(file);
      const rows = parseCsvObjects(text);
      const result = buildImport(rows);
      if (!result.imported.length) throw new Error('従業員番号が入った行を読み取れませんでした。MFクラウド人事の従業員CSVを選んでください。');
      const message = [
        `MF従業員CSVを読み取りました。`,
        `対象: ${result.imported.length}名`,
        `新規: ${result.stats.added}名 / 更新候補: ${result.stats.updated}名 / 変更なし: ${result.stats.unchanged}名`,
        `退職者: ${result.imported.filter(person => person.active === false).length}名`,
        result.stats.skipped ? `従業員番号なしで除外: ${result.stats.skipped}行` : '',
        '',
        'MF由来の基本情報だけ更新し、既存のスキル・配置条件・運用メモは保持します。反映しますか？',
      ].filter(Boolean).join('\n');
      if (!window.confirm(message)) return;
      state.staff = result.imported;
      state.dirty = true;
      await saveStaff(true);
      render();
      notify(`MF従業員CSVを反映しました（${state.staff.length}名）`);
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'CSV取込に失敗しました。');
    }
  }

  function buildImport(rows) {
    const existingMap = new Map(state.staff.map(person => [String(person.id || '').toUpperCase(), person]));
    const incoming = new Map();
    let skipped = 0;
    rows.forEach(row => {
      const id = clean(row[H.id]).toUpperCase();
      if (!id) { skipped += 1; return; }
      incoming.set(id, rowToPerson(row, existingMap.get(id)));
    });

    let added = 0;
    let updated = 0;
    let unchanged = 0;
    incoming.forEach((person, id) => {
      const before = existingMap.get(id);
      if (!before) added += 1;
      else if (mfFingerprint(before) === mfFingerprint(person)) unchanged += 1;
      else updated += 1;
    });

    const imported = Array.from(incoming.values());
    existingMap.forEach((person, id) => {
      if (!incoming.has(id) && !person.mf?.syncedAt) imported.push(person);
    });

    return { imported: normalizeStaffList(imported), stats: { added, updated, unchanged, skipped } };
  }

  function rowToPerson(row, existing) {
    const id = clean(row[H.id]).toUpperCase();
    const lastName = clean(row[H.lastName]);
    const firstName = clean(row[H.firstName]);
    const lastKana = clean(row[H.lastKana]);
    const firstKana = clean(row[H.firstKana]);
    const affiliations = [];
    for (let i = 1; i <= 10; i += 1) {
      const name = clean(row[`基本情報 - 所属 ${i} - 組織名`]);
      if (!name) continue;
      affiliations.push({
        name,
        code: clean(row[`基本情報 - 所属 ${i} - 組織コード`]),
        roleCode: clean(row[`基本情報 - 所属 ${i} - 役職コード`]),
        roleName: clean(row[`基本情報 - 所属 ${i} - 役職名`]),
        primary: clean(row[`基本情報 - 所属 ${i} - 主務かどうか`]) === '主務',
        storeId: STORE_MAP[name] || '',
      });
    }
    const primary = affiliations.find(item => item.primary) || affiliations[0] || null;
    const affiliationStoreIds = unique(affiliations.map(item => item.storeId).filter(Boolean));
    const employmentType = clean(row[H.employmentType]);
    const payType = clean(row[H.payType]);
    const retireDate = clean(row[H.retireDate]);
    const existingLevels = normalizeSkillLevels(existing);
    const person = {
      ...(existing || {}),
      id,
      employeeNumber: id,
      lastName,
      firstName,
      name: `${lastName} ${firstName}`.trim() || id,
      lastKana,
      firstKana,
      kana: `${lastKana} ${firstKana}`.trim(),
      dob: clean(row[H.dob]),
      employmentType,
      payType,
      salaryType: payType === '月給' ? 'monthly' : 'hourly',
      jobCode: clean(row[H.jobCode]),
      jobName: clean(row[H.jobName]),
      joinDate: clean(row[H.joinDate]),
      retireDate,
      retireType: clean(row[H.retireType]),
      active: !retireDate || retireDate > todayKey(),
      affiliations,
      mainAffiliation: primary?.name || '',
      mainStoreId: primary?.storeId || '',
      affiliationStoreIds,
      placementStoreIds: Array.isArray(existing?.placementStoreIds) ? existing.placementStoreIds : affiliationStoreIds,
      autoAssign: existing?.autoAssign !== false,
      operationMemo: existing?.operationMemo || '',
      skillLevels: existingLevels,
      mf: { effectiveDate: clean(row[H.effectiveDate]), syncedAt: new Date().toISOString(), source: 'MFクラウド人事 従業員CSV' },
    };
    syncLegacySkills(person);
    return person;
  }

  async function decodeCsvFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (window.Encoding) {
      const detected = window.Encoding.detect(bytes) || 'UTF8';
      const unicode = window.Encoding.convert(bytes, { to: 'UNICODE', from: detected });
      return window.Encoding.codeToString(unicode).replace(/^\uFEFF/, '');
    }
    return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  }

  function parseCsvObjects(text) {
    const matrix = parseCsv(text);
    if (!matrix.length) return [];
    const headers = matrix[0].map(value => String(value || '').trim());
    if (!headers.includes(H.id)) throw new Error('MFクラウド人事の「従業員番号」列が見つかりません。');
    return matrix.slice(1).filter(row => row.some(value => String(value || '').trim())).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
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

  async function saveStaff(showToast = false) {
    state.staff = normalizeStaffList(state.staff);
    localStorage.setItem(STORAGE_STAFF, JSON.stringify(state.staff));
    state.dirty = true;
    if (window.shiftV2Cloud && window.shiftV2User) {
      state.saving = true;
      try {
        await window.shiftV2Cloud.set(CLOUD_KEY, state.staff);
        if (showToast) notify('従業員マスタをクラウド保存しました');
      } catch (error) {
        console.warn('Staff cloud save failed', error);
        if (showToast) notify('端末には保存しました。クラウド保存は失敗しました');
      } finally {
        state.saving = false;
      }
    } else if (showToast) notify('この端末に保存しました。ログインするとクラウドにも保存できます');
    decoratePlannerStaff();
  }

  async function hydrateCloud() {
    if (!window.shiftV2Cloud || !window.shiftV2User || hydrateCloud.running) return;
    hydrateCloud.running = true;
    try {
      const cloudStaff = await window.shiftV2Cloud.get(CLOUD_KEY);
      if (Array.isArray(cloudStaff) && cloudStaff.length) {
        state.staff = normalizeStaffList(cloudStaff);
        localStorage.setItem(STORAGE_STAFF, JSON.stringify(state.staff));
        render();
        decoratePlannerStaff();
      }
    } catch (error) { console.warn('Staff master cloud load failed', error); }
    finally { hydrateCloud.running = false; }
  }

  function markDirtyAndSave(showToast = false) { state.dirty = true; saveStaff(showToast); }

  function decoratePlannerStaff() {
    const people = new Map(state.staff.map(person => [person.id, person]));
    document.querySelectorAll('#staff-list .staff-card').forEach(card => {
      const person = people.get(String(card.dataset.staffId || '').toUpperCase());
      if (!person) return;
      card.style.display = person.active === false ? 'none' : '';
      const badge = card.querySelector('.badge-monthly, .badge-hourly');
      if (badge && person.employmentType) badge.textContent = person.employmentType;
    });
  }

  function normalizeStaffList(list) {
    if (!Array.isArray(list)) return [];
    return list.map(person => {
      const normalized = { ...person };
      normalized.id = String(person.id || person.employeeNumber || '').toUpperCase();
      normalized.name = person.name || `${person.lastName || ''} ${person.firstName || ''}`.trim() || normalized.id;
      normalized.employmentType = person.employmentType || (person.salaryType === 'monthly' ? '正社員' : 'アルバイト');
      normalized.payType = person.payType || (person.salaryType === 'monthly' ? '月給' : '時給');
      normalized.salaryType = person.salaryType === 'monthly' || normalized.payType === '月給' ? 'monthly' : 'hourly';
      normalized.skillLevels = normalizeSkillLevels(person);
      normalized.affiliations = Array.isArray(person.affiliations) ? person.affiliations : [];
      normalized.affiliationStoreIds = Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : unique(normalized.affiliations.map(item => item.storeId).filter(Boolean));
      normalized.placementStoreIds = Array.isArray(person.placementStoreIds) ? person.placementStoreIds : normalized.affiliationStoreIds;
      normalized.autoAssign = person.autoAssign !== false;
      if (typeof normalized.active !== 'boolean') normalized.active = !normalized.retireDate || normalized.retireDate > todayKey();
      syncLegacySkills(normalized);
      return normalized;
    }).filter(person => person.id);
  }

  function normalizeSkillLevels(person) {
    const levels = {};
    SKILLS.forEach(skill => { levels[skill.id] = clampLevel(person?.skillLevels?.[skill.id]); });
    const legacy = Array.isArray(person?.skills) ? person.skills : [];
    const legacyMap = { 'オープン準備': 'opening', '締め作業': 'closing', '肉場': 'meat', 'サラダ場': 'salad', 'ホール': 'hall', 'ホール（肉焼ける）': 'hall', 'ホール（肉焼けない）': 'hall', 'ドリンク': 'drink', 'ドリンカー': 'drink', '洗い場': 'dish', 'レジ': 'register' };
    legacy.forEach(name => { const id = legacyMap[name]; if (id && levels[id] === 0) levels[id] = 1; });
    return levels;
  }

  function syncLegacySkills(person) { person.skills = SKILLS.filter(skill => clampLevel(person.skillLevels?.[skill.id]) > 0).map(skill => skill.name); }

  function mfFingerprint(person) {
    return JSON.stringify({ name: person.name || '', kana: person.kana || '', dob: person.dob || '', employmentType: person.employmentType || '', payType: person.payType || '', jobCode: person.jobCode || '', jobName: person.jobName || '', joinDate: person.joinDate || '', retireDate: person.retireDate || '', retireType: person.retireType || '', affiliations: (person.affiliations || []).map(item => [item.name, item.code, item.roleName, Boolean(item.primary)]), mfEffectiveDate: person.mf?.effectiveDate || '' });
  }

  function getPerson(id) { return state.staff.find(person => person.id === String(id || '').toUpperCase()); }
  function clampLevel(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0; }
  function clean(value) { return String(value ?? '').trim(); }
  function unique(values) { return Array.from(new Set(values)); }
  function todayKey() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function employmentOrder(value) { return ({ '正社員': 0, '契約社員': 1, 'アルバイト': 2, '役員': 3 })[value] ?? 9; }
  function employmentClass(value) { return value === '正社員' ? 'full' : value === 'アルバイト' ? 'part' : value === '契約社員' ? 'contract' : 'other'; }
  function shortAffiliation(value) { return String(value || '').replace('那覇松山店', '松山店').replace('那覇久茂地店', '久茂地店').replace('沖縄美里店', '美里店'); }
  function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
  function cssEsc(value) { return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, ''); }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char])); }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function injectStyles() {
    if (document.getElementById('shift-v2-staff-master-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-staff-master-style';
    style.textContent = `.master-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 18px;margin-bottom:10px}.master-title{font-size:16px;font-weight:900;color:#101828}.master-sub{font-size:10px;color:#667085;margin-top:3px}.master-import-actions{display:flex;gap:7px;flex-wrap:wrap}.master-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-bottom:10px}.master-metric{padding:11px 13px;display:flex;flex-direction:column}.master-metric small{font-size:9px;color:#667085;font-weight:800}.master-metric strong{font-size:19px;margin-top:2px}.master-metric span{font-size:8px;color:#98a2b3}.master-toolbar{padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px}.master-filter-group{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.master-filter-group #master-search{min-width:240px}.master-check{font-size:10px;font-weight:800;color:#475467;display:flex;align-items:center;gap:5px}.master-check input{width:auto}.skill-legend{display:flex;align-items:center;gap:5px;font-size:9px;color:#667085;flex-wrap:wrap;justify-content:flex-end}.skill-legend>span:first-child{font-weight:900;margin-right:2px}.skill-legend-item{display:inline-flex;align-items:center;gap:3px;border-radius:999px;padding:3px 7px;background:#f2f4f7}.skill-legend-item b{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#fff}.master-table-card{overflow:hidden}.master-table-wrap{overflow:auto;max-height:calc(100vh - 300px)}.master-table{border-collapse:separate;border-spacing:0;min-width:1210px;width:100%;font-size:9px}.master-table th{position:sticky;top:0;z-index:4;background:#f8fafc;color:#475467;font-weight:900;border-bottom:1px solid #e4e7ec;padding:8px 7px;text-align:center;white-space:nowrap}.master-table td{border-bottom:1px solid #eef1f4;padding:6px 6px;text-align:center;background:#fff}.master-table tr:hover td{background:#fbfcfe}.master-table .sticky-col{position:sticky;left:0;z-index:2;text-align:left}.master-table th.sticky-col{z-index:6;background:#f8fafc}.master-table tr:hover .sticky-col{background:#fbfcfe}.employee-col{min-width:190px}.employee-button{border:0;background:transparent;text-align:left;cursor:pointer;padding:1px 2px;width:100%;color:#101828}.employee-button strong{display:block;font-size:10px}.employee-button span{display:inline-block;font-size:8px;color:#98a2b3;margin-right:5px}.employee-button em{font-size:8px;color:#b42318;background:#fef3f2;border-radius:999px;padding:1px 5px;font-style:normal}.employment-chip{display:inline-block;font-size:8px;font-weight:900;padding:3px 6px;border-radius:999px;background:#f2f4f7}.employment-chip.full{background:#ecfdf3;color:#027a48}.employment-chip.part{background:#eff8ff;color:#175cd3}.employment-chip.contract{background:#fffaeb;color:#b54708}.pay-type,.affiliation-sub{display:block;font-size:8px;color:#98a2b3;margin-top:2px}.skill-head{min-width:100px}.skill-cell{min-width:100px}.skill-level{width:91px;border:1px solid #e4e7ec;border-radius:7px;background:#f9fafb;cursor:pointer;padding:4px 5px;line-height:1;transition:.12s}.skill-level:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(16,24,40,.08)}.skill-level b{display:inline-grid;place-items:center;width:21px;height:21px;border-radius:6px;font-size:11px;margin-right:3px;background:#fff}.skill-level span{font-size:7px;font-weight:800}.level-0{color:#667085;background:#f9fafb}.level-1{color:#175cd3;background:#eff8ff;border-color:#b2ddff}.level-2{color:#b54708;background:#fffaeb;border-color:#fedf89}.level-3{color:#027a48;background:#ecfdf3;border-color:#abefc6}.auto-chip{border:0;border-radius:999px;padding:5px 8px;font-size:8px;font-weight:900;cursor:pointer}.auto-chip.on{background:#ecfdf3;color:#027a48}.auto-chip.off{background:#f2f4f7;color:#667085}.inactive-row td{opacity:.6}.master-empty{padding:35px!important;color:#98a2b3!important}.staff-card-modal-bg{display:none;position:fixed;inset:0;z-index:1200;background:rgba(16,24,40,.58);padding:28px;align-items:center;justify-content:center}.staff-card-modal-bg.open{display:flex}.staff-card-modal{background:#fff;border-radius:14px;box-shadow:0 22px 60px rgba(16,24,40,.28);width:min(900px,96vw);max-height:92vh;overflow:auto}.staff-card-head{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #e4e7ec}.staff-card-kicker{font-size:9px;font-weight:900;color:#667085}.staff-card-head h2{margin:2px 0;font-size:20px}.staff-card-head>div>div{font-size:10px;color:#667085}.staff-card-body{padding:16px 20px}.staff-card-section{margin-bottom:18px}.staff-card-section h3{font-size:11px;margin:0 0 8px;color:#344054}.staff-info-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.staff-info{border:1px solid #eaecf0;border-radius:8px;padding:8px;background:#fcfcfd}.staff-info span{display:block;font-size:8px;color:#98a2b3}.staff-info strong{display:block;font-size:10px;margin-top:2px;word-break:break-word}.staff-mf-note{margin-top:7px;font-size:8px;color:#667085}.card-skill-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.card-skill{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;text-align:left;border:1px solid #e4e7ec;border-radius:9px;padding:8px 9px;cursor:pointer}.card-skill span{font-size:10px;font-weight:900}.card-skill b{grid-row:1/3;grid-column:2;display:grid;place-items:center;font-size:20px;padding-left:8px}.card-skill small{font-size:8px}.placement-grid{display:grid;gap:10px}.placement-switch{font-size:10px;font-weight:900;display:flex;align-items:center;gap:6px}.placement-switch input{width:auto}.field-label{display:block;font-size:9px;font-weight:900;color:#475467;margin-bottom:5px}.store-checks{display:flex;gap:12px;flex-wrap:wrap}.store-checks label{font-size:10px}.store-checks input{width:auto}.staff-card-foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e4e7ec;padding:12px 20px;font-size:8px;color:#667085}.staff-card-foot .btn{min-width:150px}@media(max-width:900px){.master-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.master-hero,.master-toolbar{align-items:flex-start;flex-direction:column}.skill-legend{justify-content:flex-start}.staff-info-grid,.card-skill-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
    document.head.appendChild(style);
  }
})();