(() => {
  'use strict';

  const STORAGE_SKILLS = 'okk_shift_v2_skill_definitions';
  const STORAGE_REQUIREMENTS = 'okk_shift_v2_staffing_requirements';
  const STORAGE_STAFF = 'okk_shift_v2_staff';
  const STORAGE_SHIFTS = 'okk_shift_v2_shifts';
  const STORAGE_STORES = 'okk_shift_v2_config';
  const CLOUD_SKILLS = 'shiftV2Skills';
  const CLOUD_REQUIREMENTS = 'shiftV2Requirements';
  const CLOUD_STAFF = 'staff';
  const SLOT = 30;

  const LEVEL_LABELS = ['未経験', 'できる', '責任もってできる', '教育できる'];
  const DAY_LABELS = {
    all: '毎日',
    weekday: '平日（月〜木）',
    fri_sat: '金・土',
    sun: '日曜',
    specific: '特定日',
  };

  const DEFAULT_SKILLS = [
    { id: 'opening', name: 'オープン準備', active: true },
    { id: 'closing', name: '締め作業', active: true },
    { id: 'meat', name: '肉場', active: true },
    { id: 'salad', name: 'サラダ場', active: true },
    { id: 'hall', name: 'ホール', active: true },
    { id: 'drink', name: 'ドリンク', active: true },
    { id: 'dish', name: '洗い場', active: true },
    { id: 'register', name: 'レジ', active: true },
  ];

  const DEFAULT_STORES = [
    { id: 'matsuyama', name: '松山店', area: 'naha', close: 30 * 60, autoJoin: false, joinTarget: '' },
    { id: 'kumoji', name: '久茂地店', area: 'naha', close: 25 * 60, autoJoin: true, joinTarget: 'matsuyama' },
    { id: 'miebashi', name: '美栄橋店', area: 'naha', close: 25 * 60, autoJoin: true, joinTarget: 'matsuyama' },
    { id: 'misato', name: '美里店', area: 'okinawa', close: 26 * 60, autoJoin: false, joinTarget: '' },
  ];

  const DEFAULT_REQUIREMENTS = [
    req('matsuyama', 'all', 17, 23, 'hall', 1, 3),
    req('matsuyama', 'all', 17, 23, 'meat', 2, 1),
    req('matsuyama', 'all', 17, 23, 'salad', 1, 1),
    req('matsuyama', 'all', 17, 23, 'drink', 1, 1),
    req('matsuyama', 'all', 23, 30, 'hall', 1, 2),
    req('matsuyama', 'all', 23, 30, 'meat', 2, 1),
    req('matsuyama', 'all', 25, 30, 'closing', 2, 1),

    req('kumoji', 'all', 17, 22, 'hall', 1, 3),
    req('kumoji', 'all', 17, 22, 'meat', 2, 1),
    req('kumoji', 'all', 17, 22, 'salad', 1, 1),
    req('kumoji', 'all', 17, 22, 'drink', 1, 1),
    req('kumoji', 'all', 22, 25, 'hall', 1, 2),
    req('kumoji', 'all', 24, 25, 'closing', 2, 1),

    req('miebashi', 'all', 17, 22, 'hall', 1, 2),
    req('miebashi', 'all', 17, 22, 'meat', 2, 1),
    req('miebashi', 'all', 17, 22, 'drink', 1, 1),
    req('miebashi', 'all', 22, 25, 'hall', 1, 2),
    req('miebashi', 'all', 24, 25, 'closing', 2, 1),

    req('misato', 'all', 17, 22, 'hall', 1, 2),
    req('misato', 'all', 17, 22, 'meat', 2, 1),
    req('misato', 'all', 17, 22, 'salad', 1, 1),
    req('misato', 'all', 17, 22, 'drink', 1, 1),
    req('misato', 'all', 22, 26, 'hall', 1, 2),
    req('misato', 'all', 25, 26, 'closing', 2, 1),
  ];

  const state = {
    skills: normalizeSkills(loadJson(STORAGE_SKILLS, DEFAULT_SKILLS)),
    requirements: normalizeRequirements(loadJson(STORAGE_REQUIREMENTS, DEFAULT_REQUIREMENTS)),
    staff: normalizeStaff(loadJson(STORAGE_STAFF, [])),
    stores: loadJson(STORAGE_STORES, DEFAULT_STORES),
    employeeQuery: '',
    employeeType: '',
    rulesStore: '',
    rulesDay: '',
    dirty: false,
    cloudHydrated: false,
  };

  let refreshTimer = null;
  let cloudSaveTimer = null;
  let plannerObserver = null;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    injectStyles();
    injectRulesView();
    ensureCoverageBanner();
    bindPlannerRefresh();
    renderAll();
    setTimeout(hydrateCloud, 900);
  }

  function req(storeId, dayType, startHour, endHour, skillId, minLevel, count, mode = 'hard') {
    return {
      id: `r_${storeId}_${dayType}_${startHour}_${endHour}_${skillId}_${minLevel}_${count}`,
      storeId,
      dayType,
      specificDate: '',
      start: startHour * 60,
      end: endHour * 60,
      skillId,
      minLevel,
      count,
      mode,
      active: true,
    };
  }

  function injectRulesView() {
    if (document.getElementById('view-rules')) return;
    const tabs = document.querySelector('.tabs');
    const csvTab = tabs?.querySelector('[data-view="csv"]');
    const tab = document.createElement('button');
    tab.className = 'tab';
    tab.dataset.view = 'rules';
    tab.innerHTML = '<i class="fa-solid fa-sliders"></i> 配置ルール';
    if (csvTab) tabs.insertBefore(tab, csvTab);
    else tabs?.appendChild(tab);

    const section = document.createElement('section');
    section.id = 'view-rules';
    section.className = 'view';
    section.innerHTML = `
      <div class="card rules-hero">
        <div>
          <div class="rules-title">配置ルール・スキル設定</div>
          <div class="rules-sub">スキルの追加・名称変更、必要人数、習熟度条件をここで直接変更。変更内容はガントの不足判定へ即反映します。</div>
        </div>
        <div class="rules-hero-actions">
          <button id="rules-save-cloud" class="btn btn-green"><i class="fa-solid fa-cloud-arrow-up"></i> 保存</button>
          <button id="rules-reset-sample" class="btn btn-light"><i class="fa-solid fa-wand-magic-sparkles"></i> 初期サンプルに戻す</button>
        </div>
      </div>

      <div id="rules-summary" class="rules-summary"></div>

      <div class="rules-grid-two">
        <section class="card rules-card">
          <div class="rules-card-head">
            <div><h2>スキルマスタ</h2><small>追加・名称変更・利用停止ができます。IDは内部で固定し、過去データとの紐付けを維持します。</small></div>
            <div class="add-skill-box"><input id="new-skill-name" class="control" placeholder="例：発注、棚卸し"><button id="add-skill" class="btn btn-green btn-small"><i class="fa-solid fa-plus"></i>追加</button></div>
          </div>
          <div id="skill-master-list" class="skill-master-list"></div>
        </section>

        <section class="card rules-card level-card">
          <div class="rules-card-head"><div><h2>習熟度の共通基準</h2><small>すべてのスキルで同じ4段階を使います。</small></div></div>
          <div class="level-definition-grid">
            ${LEVEL_LABELS.map((label, level) => `<div class="level-definition level-${level}"><b>${level}</b><div><strong>${esc(label)}</strong><small>${level === 0 ? '配置対象にしない' : level === 1 ? '通常業務を担当できる' : level === 2 ? '責任をもって任せられる' : '他の従業員を教育できる'}</small></div></div>`).join('')}
          </div>
        </section>
      </div>

      <section class="card rules-card rules-requirements-card">
        <div class="rules-card-head">
          <div><h2>店舗・時間帯ごとの必要スキル人数</h2><small>ここが自動配置の基準です。人数や習熟度を変えるだけで不足判定が変わります。</small></div>
          <button id="add-requirement" class="btn btn-green"><i class="fa-solid fa-plus"></i> 条件を追加</button>
        </div>
        <div class="rules-filter-row">
          <select id="rules-store-filter" class="control"><option value="">全店舗</option>${storeOptions('')}</select>
          <select id="rules-day-filter" class="control"><option value="">全曜日区分</option>${Object.entries(DAY_LABELS).map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('')}</select>
          <span>赤＝必須 / 黄＝推奨。特定日は通常ルールより優先して扱います。</span>
        </div>
        <div class="rules-table-wrap">
          <table class="rules-table">
            <thead><tr><th>有効</th><th>店舗</th><th>曜日・日付</th><th>時間帯</th><th>必要スキル</th><th>最低Lv</th><th>人数</th><th>区分</th><th></th></tr></thead>
            <tbody id="requirements-body"></tbody>
          </table>
        </div>
      </section>

      <section class="card rules-card employee-skills-card">
        <div class="rules-card-head">
          <div><h2>従業員スキル一括編集</h2><small>セルをクリックすると 0→1→2→3→0。追加したスキルもここに自動で列が増えます。</small></div>
          <div class="employee-skill-filter"><input id="employee-skill-search" class="control" placeholder="氏名・従業員番号で検索"><select id="employee-type-filter" class="control"><option value="">雇用区分：すべて</option><option value="正社員">正社員</option><option value="アルバイト">アルバイト</option><option value="契約社員">契約社員</option><option value="役員">役員</option></select></div>
        </div>
        <div class="employee-skill-table-wrap"><table class="employee-skill-table"><thead id="employee-skill-head"></thead><tbody id="employee-skill-body"></tbody></table></div>
      </section>
    `;
    document.querySelector('.workspace')?.appendChild(section);

    tab.addEventListener('click', event => {
      event.preventDefault();
      activateRulesView();
    });

    document.getElementById('rules-save-cloud')?.addEventListener('click', () => saveAll(true));
    document.getElementById('rules-reset-sample')?.addEventListener('click', resetSamples);
    document.getElementById('add-skill')?.addEventListener('click', addSkillFromInput);
    document.getElementById('new-skill-name')?.addEventListener('keydown', event => { if (event.key === 'Enter') addSkillFromInput(); });
    document.getElementById('add-requirement')?.addEventListener('click', addRequirement);
    document.getElementById('rules-store-filter')?.addEventListener('change', event => { state.rulesStore = event.target.value; renderRequirements(); });
    document.getElementById('rules-day-filter')?.addEventListener('change', event => { state.rulesDay = event.target.value; renderRequirements(); });
    document.getElementById('employee-skill-search')?.addEventListener('input', event => { state.employeeQuery = event.target.value.trim().toLowerCase(); renderEmployeeSkills(); });
    document.getElementById('employee-type-filter')?.addEventListener('change', event => { state.employeeType = event.target.value; renderEmployeeSkills(); });
    document.addEventListener('shiftv2-auth', () => setTimeout(hydrateCloud, 250));
  }

  function activateRulesView() {
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item.dataset.view === 'rules'));
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === 'view-rules'));
    state.staff = normalizeStaff(loadJson(STORAGE_STAFF, state.staff));
    state.stores = loadJson(STORAGE_STORES, state.stores);
    renderAll();
  }

  function renderAll() {
    renderSummary();
    renderSkillMaster();
    renderRequirements();
    renderEmployeeSkills();
    renderCoverage();
  }

  function renderSummary() {
    const summary = document.getElementById('rules-summary');
    if (!summary) return;
    const activeSkills = state.skills.filter(skill => skill.active !== false).length;
    const activeRules = state.requirements.filter(rule => rule.active !== false).length;
    const activeStaff = state.staff.filter(person => person.active !== false).length;
    const skillAssigned = state.staff.filter(person => state.skills.some(skill => clampLevel(person.skillLevels?.[skill.id]) > 0)).length;
    summary.innerHTML = metric('利用中スキル', `${activeSkills}個`, '自由に追加・停止') + metric('配置条件', `${activeRules}件`, '店舗×時間×スキル') + metric('在籍従業員', `${activeStaff}名`, 'MF同期マスタ') + metric('スキル登録済', `${skillAssigned}名`, `未登録 ${Math.max(0, activeStaff - skillAssigned)}名`);
  }

  function metric(label, value, sub) {
    return `<div class="card rules-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub)}</span></div>`;
  }

  function renderSkillMaster() {
    const list = document.getElementById('skill-master-list');
    if (!list) return;
    list.innerHTML = state.skills.map(skill => `
      <div class="skill-master-row ${skill.active === false ? 'skill-inactive' : ''}" data-skill-row="${esc(skill.id)}">
        <span class="skill-master-id">${esc(skill.id)}</span>
        <input class="control" data-skill-name="${esc(skill.id)}" value="${esc(skill.name)}" ${skill.active === false ? 'disabled' : ''}>
        <button class="btn btn-light btn-small" data-skill-toggle="${esc(skill.id)}"><i class="fa-solid ${skill.active === false ? 'fa-rotate-left' : 'fa-ban'}"></i>${skill.active === false ? '再開' : '停止'}</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-skill-name]').forEach(input => input.addEventListener('change', () => {
      const skill = getSkill(input.dataset.skillName);
      const next = input.value.trim();
      if (!skill || !next) { renderSkillMaster(); return; }
      skill.name = next;
      markDirty();
      saveAll(false);
      renderRequirements();
      renderEmployeeSkills();
      renderCoverage();
    }));

    list.querySelectorAll('[data-skill-toggle]').forEach(button => button.addEventListener('click', () => {
      const skill = getSkill(button.dataset.skillToggle);
      if (!skill) return;
      skill.active = skill.active === false;
      markDirty();
      saveAll(false);
      renderAll();
    }));
  }

  function addSkillFromInput() {
    const input = document.getElementById('new-skill-name');
    const name = input?.value.trim() || '';
    if (!name) return;
    if (state.skills.some(skill => skill.name === name && skill.active !== false)) {
      notify('同じ名前のスキルがあります');
      return;
    }
    const id = `skill_${Date.now().toString(36)}`;
    state.skills.push({ id, name, active: true });
    state.staff.forEach(person => {
      if (!person.skillLevels) person.skillLevels = {};
      person.skillLevels[id] = 0;
    });
    if (input) input.value = '';
    markDirty();
    saveAll(false);
    renderAll();
    notify(`${name} を追加しました`);
  }

  function filteredRequirements() {
    return state.requirements.filter(rule => (!state.rulesStore || rule.storeId === state.rulesStore) && (!state.rulesDay || rule.dayType === state.rulesDay));
  }

  function renderRequirements() {
    const body = document.getElementById('requirements-body');
    if (!body) return;
    const activeSkills = state.skills.filter(skill => skill.active !== false);
    body.innerHTML = filteredRequirements().map(rule => `
      <tr data-rule-id="${esc(rule.id)}" class="${rule.mode === 'soft' ? 'soft-rule' : 'hard-rule'} ${rule.active === false ? 'inactive-rule' : ''}">
        <td><input type="checkbox" data-rule-field="active" ${rule.active === false ? '' : 'checked'}></td>
        <td><select data-rule-field="storeId">${storeOptions(rule.storeId)}</select></td>
        <td><div class="day-cell"><select data-rule-field="dayType">${Object.entries(DAY_LABELS).map(([value, label]) => `<option value="${value}" ${rule.dayType === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><input type="date" data-rule-field="specificDate" value="${esc(rule.specificDate || '')}" ${rule.dayType === 'specific' ? '' : 'disabled'}></div></td>
        <td><div class="time-cell"><select data-rule-field="start">${timeOptions(rule.start, 14 * 60, 30 * 60)}</select><span>〜</span><select data-rule-field="end">${timeOptions(rule.end, 14 * 60 + SLOT, 30 * 60)}</select></div></td>
        <td><select data-rule-field="skillId">${activeSkills.map(skill => `<option value="${esc(skill.id)}" ${skill.id === rule.skillId ? 'selected' : ''}>${esc(skill.name)}</option>`).join('')}</select></td>
        <td><select data-rule-field="minLevel">${[1,2,3].map(level => `<option value="${level}" ${Number(rule.minLevel) === level ? 'selected' : ''}>Lv${level} ${esc(LEVEL_LABELS[level])}</option>`).join('')}</select></td>
        <td><select data-rule-field="count">${[1,2,3,4,5,6,7,8].map(count => `<option value="${count}" ${Number(rule.count) === count ? 'selected' : ''}>${count}名</option>`).join('')}</select></td>
        <td><select data-rule-field="mode"><option value="hard" ${rule.mode !== 'soft' ? 'selected' : ''}>必須</option><option value="soft" ${rule.mode === 'soft' ? 'selected' : ''}>推奨</option></select></td>
        <td><button class="rule-delete" title="削除"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('') || '<tr><td colspan="9" class="rules-empty">条件がありません。「条件を追加」から作成できます。</td></tr>';

    body.querySelectorAll('[data-rule-id]').forEach(row => {
      const rule = getRequirement(row.dataset.ruleId);
      if (!rule) return;
      row.querySelectorAll('[data-rule-field]').forEach(input => input.addEventListener('change', () => {
        const field = input.dataset.ruleField;
        if (field === 'active') rule.active = input.checked;
        else if (['start','end','minLevel','count'].includes(field)) rule[field] = Number(input.value);
        else rule[field] = input.value;
        if (rule.end <= rule.start) rule.end = Math.min(30 * 60, rule.start + SLOT);
        markDirty();
        saveAll(false);
        renderRequirements();
        renderCoverage();
      }));
      row.querySelector('.rule-delete')?.addEventListener('click', () => {
        state.requirements = state.requirements.filter(item => item.id !== rule.id);
        markDirty();
        saveAll(false);
        renderRequirements();
        renderSummary();
        renderCoverage();
      });
    });
  }

  function addRequirement() {
    const firstSkill = state.skills.find(skill => skill.active !== false);
    if (!firstSkill) { notify('先にスキルを1つ追加してください'); return; }
    state.requirements.push({ id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`, storeId: state.rulesStore || 'matsuyama', dayType: state.rulesDay || 'all', specificDate: '', start: 17 * 60, end: 22 * 60, skillId: firstSkill.id, minLevel: 1, count: 1, mode: 'hard', active: true });
    markDirty();
    saveAll(false);
    renderRequirements();
    renderSummary();
    renderCoverage();
  }

  function renderEmployeeSkills() {
    const head = document.getElementById('employee-skill-head');
    const body = document.getElementById('employee-skill-body');
    if (!head || !body) return;
    const skills = state.skills.filter(skill => skill.active !== false);
    const staff = state.staff.filter(person => {
      if (person.active === false) return false;
      if (state.employeeType && person.employmentType !== state.employeeType) return false;
      const haystack = `${person.id || ''} ${person.name || ''}`.toLowerCase();
      return !state.employeeQuery || haystack.includes(state.employeeQuery);
    }).sort((a, b) => employmentOrder(a.employmentType) - employmentOrder(b.employmentType) || String(a.name || '').localeCompare(String(b.name || ''), 'ja'));

    head.innerHTML = `<tr><th class="employee-sticky">従業員</th><th>雇用</th>${skills.map(skill => `<th>${esc(skill.name)}</th>`).join('')}</tr>`;
    body.innerHTML = staff.map(person => `
      <tr>
        <td class="employee-sticky"><strong>${esc(person.name || person.id)}</strong><small>${esc(person.id || '')}</small></td>
        <td><span class="emp-type">${esc(person.employmentType || '')}</span></td>
        ${skills.map(skill => employeeSkillCell(person, skill)).join('')}
      </tr>
    `).join('') || `<tr><td colspan="${skills.length + 2}" class="rules-empty">該当する従業員がいません。</td></tr>`;

    body.querySelectorAll('[data-employee-skill]').forEach(button => button.addEventListener('click', () => {
      const person = state.staff.find(item => item.id === button.dataset.employeeId);
      if (!person) return;
      const skillId = button.dataset.employeeSkill;
      if (!person.skillLevels) person.skillLevels = {};
      person.skillLevels[skillId] = (clampLevel(person.skillLevels[skillId]) + 1) % 4;
      syncLegacySkills(person);
      localStorage.setItem(STORAGE_STAFF, JSON.stringify(state.staff));
      markDirty();
      queueCloudSave();
      renderEmployeeSkills();
      renderSummary();
      renderCoverage();
    }));
  }

  function employeeSkillCell(person, skill) {
    const level = clampLevel(person.skillLevels?.[skill.id]);
    return `<td class="employee-skill-cell"><button class="employee-skill level-${level}" data-employee-id="${esc(person.id)}" data-employee-skill="${esc(skill.id)}"><b>${level}</b><span>${esc(LEVEL_LABELS[level])}</span></button></td>`;
  }

  function ensureCoverageBanner() {
    const planner = document.getElementById('view-planner');
    if (!planner) return;
    let banner = document.getElementById('staffing-coverage-banner');
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'staffing-coverage-banner';
      banner.className = 'staffing-coverage-banner';
      const audit = document.getElementById('shift-audit-bar');
      const labor = document.getElementById('labor-alert-banner');
      const toolbar = planner.querySelector('.toolbar');
      if (audit) audit.insertAdjacentElement('afterend', banner);
      else if (labor) labor.insertAdjacentElement('afterend', banner);
      else toolbar?.insertAdjacentElement('afterend', banner);
    }
  }

  function bindPlannerRefresh() {
    const workspace = document.querySelector('.workspace');
    const date = document.getElementById('work-date');
    date?.addEventListener('change', scheduleCoverage);
    document.addEventListener('pointerup', () => setTimeout(scheduleCoverage, 40));
    document.addEventListener('drop', () => setTimeout(scheduleCoverage, 40));
    window.addEventListener('storage', event => {
      if ([STORAGE_SKILLS, STORAGE_REQUIREMENTS, STORAGE_STAFF, STORAGE_SHIFTS, STORAGE_STORES].includes(event.key)) {
        reloadState();
        scheduleCoverage();
      }
    });
    if (workspace) {
      plannerObserver = new MutationObserver(scheduleCoverage);
      plannerObserver.observe(workspace, { childList: true, subtree: true });
    }
  }

  function scheduleCoverage() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      plannerObserver?.disconnect();
      try { renderCoverage(); }
      finally {
        const workspace = document.querySelector('.workspace');
        if (plannerObserver && workspace) plannerObserver.observe(workspace, { childList: true, subtree: true });
      }
    }, 60);
  }

  function renderCoverage() {
    ensureCoverageBanner();
    const banner = document.getElementById('staffing-coverage-banner');
    const date = document.getElementById('work-date')?.value;
    if (!banner || !date) return;
    reloadRuntimeData();
    const applicable = applicableRequirements(date);
    if (!applicable.length) {
      banner.className = 'staffing-coverage-banner coverage-clear';
      banner.innerHTML = `<div><strong><i class="fa-solid fa-circle-check"></i> 必要スキル条件なし</strong><span>${esc(date)} に適用される配置条件はありません。</span></div><button class="coverage-edit-btn" type="button">ルール編集</button>`;
      banner.querySelector('.coverage-edit-btn')?.addEventListener('click', activateRulesView);
      return;
    }

    const results = applicable.map(rule => evaluateRequirement(date, rule));
    const shortages = results.filter(result => result.shortage > 0);
    const hard = shortages.filter(result => result.rule.mode !== 'soft');
    banner.className = `staffing-coverage-banner ${shortages.length ? (hard.length ? 'coverage-danger' : 'coverage-warn') : 'coverage-clear'}`;
    const top = shortages.slice(0, 10);
    banner.innerHTML = `
      <div class="coverage-head">
        <div><strong><i class="fa-solid ${shortages.length ? 'fa-people-group' : 'fa-circle-check'}"></i> 必要スキル充足チェック</strong><span>${shortages.length ? `不足 ${shortages.length}条件（必須 ${hard.length}）` : `${applicable.length}条件すべて充足`}</span></div>
        <button class="coverage-edit-btn" type="button"><i class="fa-solid fa-pen"></i>ルール編集</button>
      </div>
      <div class="coverage-items">
        ${top.length ? top.map(result => coverageItem(date, result)).join('') : '<span class="coverage-ok-message">現在の配置で、設定した必要人数とスキル条件を満たしています。</span>'}
        ${shortages.length > top.length ? `<span class="coverage-more">ほか ${shortages.length - top.length}件</span>` : ''}
      </div>
    `;
    banner.querySelector('.coverage-edit-btn')?.addEventListener('click', activateRulesView);
  }

  function coverageItem(date, result) {
    const rule = result.rule;
    const skill = getSkill(rule.skillId);
    const store = getStore(rule.storeId);
    const candidates = candidateNames(date, rule).slice(0, 3);
    return `<div class="coverage-item ${rule.mode === 'soft' ? 'soft' : 'hard'}"><strong>${esc(store?.name || rule.storeId)} ${fmtTime(rule.start)}-${fmtTime(rule.end)}</strong><span>${esc(skill?.name || rule.skillId)} Lv${rule.minLevel}以上：${result.minimum}/${rule.count}名</span>${candidates.length ? `<small>候補 ${esc(candidates.join('、'))}</small>` : '<small>配置可能な候補なし</small>'}</div>`;
  }

  function applicableRequirements(date) {
    const all = state.requirements.filter(rule => rule.active !== false && getSkill(rule.skillId)?.active !== false);
    const specificStores = new Set(all.filter(rule => rule.dayType === 'specific' && rule.specificDate === date).map(rule => `${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`));
    return all.filter(rule => {
      if (!dayMatches(rule, date)) return false;
      if (rule.dayType !== 'specific' && specificStores.has(`${rule.storeId}|${rule.skillId}|${rule.start}|${rule.end}`)) return false;
      return true;
    });
  }

  function dayMatches(rule, dateString) {
    if (rule.dayType === 'specific') return rule.specificDate === dateString;
    const day = new Date(`${dateString}T00:00:00`).getDay();
    if (rule.dayType === 'weekday') return day >= 1 && day <= 4;
    if (rule.dayType === 'fri_sat') return day === 5 || day === 6;
    if (rule.dayType === 'sun') return day === 0;
    return true;
  }

  function evaluateRequirement(date, rule) {
    let minimum = Infinity;
    for (let minute = rule.start; minute < rule.end; minute += SLOT) {
      const ids = qualifiedWorkingStaff(date, rule, minute, Math.min(rule.end, minute + SLOT));
      minimum = Math.min(minimum, ids.size);
    }
    if (!Number.isFinite(minimum)) minimum = 0;
    return { rule, minimum, shortage: Math.max(0, Number(rule.count) - minimum) };
  }

  function qualifiedWorkingStaff(date, rule, start, end) {
    const ids = new Set();
    const shifts = loadJson(STORAGE_SHIFTS, {});
    const rows = Array.isArray(shifts[date]) ? shifts[date] : [];
    rows.forEach(shift => {
      const person = state.staff.find(item => item.id === String(shift.staffId || '').toUpperCase());
      if (!person || person.active === false) return;
      if (clampLevel(person.skillLevels?.[rule.skillId]) < Number(rule.minLevel)) return;
      const segments = deriveSegments(shift);
      if (segments.some(segment => segment.storeId === rule.storeId && segment.start <= start && segment.end >= end)) ids.add(person.id);
    });
    return ids;
  }

  function candidateNames(date, rule) {
    const shifts = loadJson(STORAGE_SHIFTS, {});
    const dayRows = Array.isArray(shifts[date]) ? shifts[date] : [];
    return state.staff.filter(person => {
      if (person.active === false || person.autoAssign === false) return false;
      if (clampLevel(person.skillLevels?.[rule.skillId]) < Number(rule.minLevel)) return false;
      const allowedStores = person.placementStoreIds || person.affiliationStoreIds || [];
      if (allowedStores.length && !allowedStores.includes(rule.storeId)) return false;
      const own = dayRows.filter(shift => String(shift.staffId || '').toUpperCase() === person.id);
      if (own.some(shift => intervalsOverlap(shift.start, shift.end, rule.start, rule.end))) return false;
      return true;
    }).sort((a, b) => clampLevel(b.skillLevels?.[rule.skillId]) - clampLevel(a.skillLevels?.[rule.skillId]) || employmentOrder(a.employmentType) - employmentOrder(b.employmentType)).map(person => person.name || person.id);
  }

  function deriveSegments(shift) {
    const store = getStore(shift.startStoreId);
    if (!store) return [{ storeId: shift.startStoreId, start: Number(shift.start), end: Number(shift.end) }];
    const start = Number(shift.start);
    const end = Number(shift.end);
    if (store.autoJoin && store.joinTarget && end > Number(store.close)) {
      if (start >= Number(store.close)) return [{ storeId: store.joinTarget, start, end }];
      return [{ storeId: store.id, start, end: Number(store.close) }, { storeId: store.joinTarget, start: Number(store.close), end }];
    }
    return [{ storeId: store.id, start, end }];
  }

  function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
    return Number(aStart) < Number(bEnd) && Number(aEnd) > Number(bStart);
  }

  function resetSamples() {
    if (!window.confirm('スキルマスタと必要人数条件を初期サンプルへ戻します。従業員ごとの習熟度は消しません。')) return;
    state.skills = normalizeSkills(DEFAULT_SKILLS);
    state.requirements = normalizeRequirements(DEFAULT_REQUIREMENTS);
    markDirty();
    saveAll(true);
    renderAll();
  }

  function markDirty() {
    state.dirty = true;
    localStorage.setItem(STORAGE_SKILLS, JSON.stringify(state.skills));
    localStorage.setItem(STORAGE_REQUIREMENTS, JSON.stringify(state.requirements));
  }

  async function saveAll(showToast = false) {
    localStorage.setItem(STORAGE_SKILLS, JSON.stringify(state.skills));
    localStorage.setItem(STORAGE_REQUIREMENTS, JSON.stringify(state.requirements));
    localStorage.setItem(STORAGE_STAFF, JSON.stringify(state.staff));
    queueCloudSave(showToast);
  }

  function queueCloudSave(showToast = false) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(async () => {
      if (!window.shiftV2Cloud || !window.shiftV2User) {
        if (showToast) notify('この端末に保存しました。ログインするとクラウドにも保存できます');
        return;
      }
      try {
        await Promise.all([
          window.shiftV2Cloud.set(CLOUD_SKILLS, state.skills),
          window.shiftV2Cloud.set(CLOUD_REQUIREMENTS, state.requirements),
          window.shiftV2Cloud.set(CLOUD_STAFF, state.staff),
        ]);
        if (showToast) notify('配置ルールとスキルをクラウド保存しました');
      } catch (error) {
        console.warn('Rule cloud save failed', error);
        if (showToast) notify('端末には保存しました。クラウド保存は失敗しました');
      }
    }, 180);
  }

  async function hydrateCloud() {
    if (!window.shiftV2Cloud || !window.shiftV2User || hydrateCloud.running) return;
    hydrateCloud.running = true;
    try {
      const [skills, requirements, staff] = await Promise.all([
        window.shiftV2Cloud.get(CLOUD_SKILLS),
        window.shiftV2Cloud.get(CLOUD_REQUIREMENTS),
        window.shiftV2Cloud.get(CLOUD_STAFF),
      ]);
      if (Array.isArray(skills) && skills.length) state.skills = normalizeSkills(skills);
      else await window.shiftV2Cloud.set(CLOUD_SKILLS, state.skills);
      if (Array.isArray(requirements) && requirements.length) state.requirements = normalizeRequirements(requirements);
      else await window.shiftV2Cloud.set(CLOUD_REQUIREMENTS, state.requirements);
      if (Array.isArray(staff) && staff.length) state.staff = normalizeStaff(staff);
      localStorage.setItem(STORAGE_SKILLS, JSON.stringify(state.skills));
      localStorage.setItem(STORAGE_REQUIREMENTS, JSON.stringify(state.requirements));
      localStorage.setItem(STORAGE_STAFF, JSON.stringify(state.staff));
      state.cloudHydrated = true;
      renderAll();
    } catch (error) {
      console.warn('Rule cloud hydration failed', error);
    } finally {
      hydrateCloud.running = false;
    }
  }

  function reloadState() {
    state.skills = normalizeSkills(loadJson(STORAGE_SKILLS, state.skills));
    state.requirements = normalizeRequirements(loadJson(STORAGE_REQUIREMENTS, state.requirements));
    state.staff = normalizeStaff(loadJson(STORAGE_STAFF, state.staff));
    state.stores = loadJson(STORAGE_STORES, state.stores);
    renderAll();
  }

  function reloadRuntimeData() {
    state.staff = normalizeStaff(loadJson(STORAGE_STAFF, state.staff));
    state.stores = loadJson(STORAGE_STORES, state.stores);
  }

  function normalizeSkills(list) {
    const source = Array.isArray(list) && list.length ? list : DEFAULT_SKILLS;
    const seen = new Set();
    return source.map((skill, index) => ({ id: String(skill.id || `skill_${index}`), name: String(skill.name || `スキル${index + 1}`), active: skill.active !== false })).filter(skill => skill.id && !seen.has(skill.id) && seen.add(skill.id));
  }

  function normalizeRequirements(list) {
    const source = Array.isArray(list) ? list : DEFAULT_REQUIREMENTS;
    return source.map((rule, index) => ({
      id: String(rule.id || `r_${index}_${Date.now().toString(36)}`),
      storeId: String(rule.storeId || 'matsuyama'),
      dayType: DAY_LABELS[rule.dayType] ? rule.dayType : 'all',
      specificDate: String(rule.specificDate || ''),
      start: validMinute(rule.start, 17 * 60),
      end: validMinute(rule.end, 22 * 60),
      skillId: String(rule.skillId || 'hall'),
      minLevel: Math.max(1, Math.min(3, Number(rule.minLevel || 1))),
      count: Math.max(1, Math.min(20, Number(rule.count || 1))),
      mode: rule.mode === 'soft' ? 'soft' : 'hard',
      active: rule.active !== false,
    }));
  }

  function normalizeStaff(list) {
    if (!Array.isArray(list)) return [];
    return list.map(person => ({
      ...person,
      id: String(person.id || person.employeeNumber || '').toUpperCase(),
      name: person.name || `${person.lastName || ''} ${person.firstName || ''}`.trim(),
      employmentType: person.employmentType || (person.salaryType === 'monthly' ? '正社員' : 'アルバイト'),
      skillLevels: normalizeSkillLevels(person),
      active: typeof person.active === 'boolean' ? person.active : true,
    })).filter(person => person.id);
  }

  function normalizeSkillLevels(person) {
    const levels = { ...(person.skillLevels || {}) };
    const legacy = Array.isArray(person.skills) ? person.skills : [];
    const map = { 'オープン準備':'opening','締め作業':'closing','肉場':'meat','サラダ場':'salad','ホール':'hall','ホール（肉焼ける）':'hall','ホール（肉焼けない）':'hall','ドリンク':'drink','ドリンカー':'drink','洗い場':'dish','レジ':'register' };
    legacy.forEach(name => { const id = map[name]; if (id && !levels[id]) levels[id] = 1; });
    state.skills?.forEach(skill => { levels[skill.id] = clampLevel(levels[skill.id]); });
    return levels;
  }

  function syncLegacySkills(person) {
    person.skills = state.skills.filter(skill => skill.active !== false && clampLevel(person.skillLevels?.[skill.id]) > 0).map(skill => skill.name);
  }

  function getSkill(id) { return state.skills.find(skill => skill.id === id); }
  function getRequirement(id) { return state.requirements.find(rule => rule.id === id); }
  function getStore(id) { return state.stores.find(store => store.id === id) || DEFAULT_STORES.find(store => store.id === id); }

  function storeOptions(selected) {
    return (state.stores?.length ? state.stores : DEFAULT_STORES).map(store => `<option value="${esc(store.id)}" ${store.id === selected ? 'selected' : ''}>${esc(store.name)}</option>`).join('');
  }

  function timeOptions(selected, min, max) {
    let html = '';
    for (let minute = min; minute <= max; minute += SLOT) html += `<option value="${minute}" ${Number(selected) === minute ? 'selected' : ''}>${fmtTime(minute, true)}</option>`;
    return html;
  }

  function fmtTime(totalMinutes, verbose = false) {
    const minuteValue = Number(totalMinutes);
    const next = minuteValue >= 24 * 60;
    const hour = Math.floor(minuteValue / 60) % 24;
    const minute = minuteValue % 60;
    const clock = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
    return verbose && next ? `翌 ${clock}` : clock;
  }

  function validMinute(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clampLevel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(3, Math.round(n))) : 0;
  }

  function employmentOrder(value) {
    return ({ '正社員': 0, '契約社員': 1, 'アルバイト': 2, '役員': 3 })[value] ?? 9;
  }

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? clone(fallback);
    } catch {
      return clone(fallback);
    }
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;' }[char])); }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return window.alert(message);
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function injectStyles() {
    if (document.getElementById('shift-v2-rules-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-rules-style';
    style.textContent = `
      .rules-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:15px 17px;margin-bottom:10px}.rules-title{font-size:16px;font-weight:900;color:#101828}.rules-sub{font-size:10px;color:#667085;margin-top:3px}.rules-hero-actions{display:flex;gap:7px;flex-wrap:wrap}.rules-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:10px}.rules-metric{padding:11px 13px;display:flex;flex-direction:column}.rules-metric small{font-size:9px;font-weight:800;color:#667085}.rules-metric strong{font-size:18px;margin-top:2px}.rules-metric span{font-size:8px;color:#98a2b3}.rules-grid-two{display:grid;grid-template-columns:1.15fr .85fr;gap:10px;margin-bottom:10px}.rules-card{padding:0;overflow:hidden;margin-bottom:10px}.rules-card-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid #eaecf0}.rules-card-head h2{font-size:11px;margin:0;color:#344054}.rules-card-head small{display:block;font-size:8px;color:#98a2b3;margin-top:2px}.add-skill-box,.employee-skill-filter{display:flex;gap:6px;align-items:center}.add-skill-box input{min-width:180px}.skill-master-list{padding:8px 10px;max-height:280px;overflow:auto}.skill-master-row{display:grid;grid-template-columns:120px 1fr auto;gap:7px;align-items:center;padding:6px;border-bottom:1px solid #f2f4f7}.skill-master-row:last-child{border-bottom:0}.skill-master-id{font-size:8px;color:#98a2b3;font-family:ui-monospace,monospace}.skill-master-row.skill-inactive{opacity:.55}.level-definition-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}.level-definition{border:1px solid #eaecf0;border-radius:9px;padding:10px;display:flex;gap:9px;align-items:center}.level-definition>b{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#fff;font-size:16px}.level-definition strong{display:block;font-size:10px}.level-definition small{display:block;font-size:8px;margin-top:2px}.level-0{background:#f9fafb;color:#667085}.level-1{background:#eff8ff;color:#175cd3}.level-2{background:#fffaeb;color:#b54708}.level-3{background:#ecfdf3;color:#027a48}.rules-filter-row{display:flex;gap:7px;align-items:center;padding:8px 10px;background:#fcfcfd;border-bottom:1px solid #eaecf0}.rules-filter-row>span{font-size:8px;color:#667085}.rules-table-wrap{overflow:auto;max-height:390px}.rules-table{width:100%;border-collapse:separate;border-spacing:0;min-width:1120px;font-size:9px}.rules-table th{position:sticky;top:0;z-index:3;background:#f8fafc;color:#475467;padding:7px;border-bottom:1px solid #e4e7ec;white-space:nowrap}.rules-table td{padding:6px;border-bottom:1px solid #eef1f4;text-align:center;background:#fff}.rules-table tr.hard-rule td:first-child{border-left:3px solid #f04438}.rules-table tr.soft-rule td:first-child{border-left:3px solid #f79009}.rules-table tr.inactive-rule td{opacity:.45}.rules-table select,.rules-table input[type=date]{height:29px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;padding:0 5px;font-size:9px}.rules-table input[type=checkbox]{width:auto}.day-cell,.time-cell{display:flex;align-items:center;gap:4px;justify-content:center}.day-cell input[type=date]{width:118px}.rule-delete{border:0;background:#fef3f2;color:#b42318;border-radius:6px;width:28px;height:28px;cursor:pointer}.rules-empty{padding:28px!important;text-align:center;color:#98a2b3!important}.employee-skill-table-wrap{overflow:auto;max-height:480px}.employee-skill-table{border-collapse:separate;border-spacing:0;min-width:100%;font-size:9px}.employee-skill-table th{position:sticky;top:0;z-index:4;background:#f8fafc;padding:7px;border-bottom:1px solid #e4e7ec;white-space:nowrap;min-width:100px}.employee-skill-table td{background:#fff;padding:5px;border-bottom:1px solid #eef1f4;text-align:center}.employee-skill-table .employee-sticky{position:sticky;left:0;z-index:2;min-width:175px;text-align:left}.employee-skill-table th.employee-sticky{z-index:6;background:#f8fafc}.employee-sticky strong{display:block;font-size:10px}.employee-sticky small{display:block;color:#98a2b3;font-size:8px}.emp-type{font-size:8px;font-weight:800}.employee-skill{width:92px;border:1px solid #e4e7ec;border-radius:7px;padding:4px 5px;cursor:pointer}.employee-skill b{display:inline-grid;place-items:center;width:21px;height:21px;border-radius:6px;background:#fff;margin-right:3px}.employee-skill span{font-size:7px;font-weight:800}.staffing-coverage-banner{margin:0 0 10px;border-radius:10px;padding:10px 12px;border:1px solid #d0d5dd;background:#fff;font-size:9px}.coverage-head,.staffing-coverage-banner>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:10px}.coverage-head>div,.staffing-coverage-banner>div:first-child>div{display:flex;align-items:center;gap:8px}.coverage-head strong,.staffing-coverage-banner strong{font-size:10px}.coverage-head span,.staffing-coverage-banner>div:first-child>span{font-size:8px}.coverage-edit-btn{border:0;background:#fff;border-radius:7px;padding:5px 8px;font-size:8px;font-weight:900;cursor:pointer;color:#344054;white-space:nowrap}.coverage-danger{background:#fff5f4;border-color:#fda29b;color:#912018}.coverage-warn{background:#fffaeb;border-color:#fedf89;color:#93370d}.coverage-clear{background:#ecfdf3;border-color:#abefc6;color:#05603a}.coverage-items{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.coverage-item{border-radius:8px;padding:6px 8px;background:#fff;border:1px solid rgba(0,0,0,.07);display:flex;flex-direction:column;gap:1px}.coverage-item.hard{border-left:3px solid #f04438}.coverage-item.soft{border-left:3px solid #f79009}.coverage-item strong{font-size:8px}.coverage-item span{font-size:8px;font-weight:900}.coverage-item small{font-size:7px;color:#667085}.coverage-ok-message,.coverage-more{font-size:8px;font-weight:800}.coverage-more{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;background:#fff}@media(max-width:1000px){.rules-grid-two{grid-template-columns:1fr}.rules-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.rules-card-head,.rules-hero{align-items:flex-start;flex-direction:column}.employee-skill-filter{width:100%;flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }
})();