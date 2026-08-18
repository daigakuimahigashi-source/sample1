(() => {
  'use strict';

  const STORAGE_STAFF = 'okk_shift_v2_staff';
  const STORAGE_SKILLS = 'okk_shift_v2_skill_definitions';
  const CLOUD_STAFF = 'staff';
  const TEST_SEED_VERSION = 1;
  const DAYS = [
    { key: '1', label: '月' }, { key: '2', label: '火' }, { key: '3', label: '水' },
    { key: '4', label: '木' }, { key: '5', label: '金' }, { key: '6', label: '土' }, { key: '0', label: '日' },
  ];

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    injectStyles();
    injectMasterActions();
    observeMasterUi();
    document.addEventListener('shiftv2-auth', () => setTimeout(injectMasterActions, 250));
  }

  function injectMasterActions() {
    const host = document.querySelector('#view-master .master-import-actions');
    if (!host || document.getElementById('seed-test-data')) return;
    const seed = document.createElement('button');
    seed.id = 'seed-test-data';
    seed.className = 'btn btn-light';
    seed.innerHTML = '<i class="fa-solid fa-flask"></i> テスト値を補完';
    const clear = document.createElement('button');
    clear.id = 'clear-test-data';
    clear.className = 'btn btn-light';
    clear.innerHTML = '<i class="fa-solid fa-eraser"></i> テスト値だけ消す';
    host.append(seed, clear);
    seed.addEventListener('click', seedTestData);
    clear.addEventListener('click', clearTestData);
  }

  function observeMasterUi() {
    const workspace = document.querySelector('.workspace');
    if (!workspace) return;
    new MutationObserver(() => {
      injectMasterActions();
      enhanceOpenCard();
    }).observe(workspace, { childList: true, subtree: true });
    const modal = document.getElementById('staff-card-modal');
    if (modal) new MutationObserver(enhanceOpenCard).observe(modal, { childList: true, subtree: true });
  }

  async function seedTestData() {
    const staff = loadStaff();
    if (!staff.length) return notify('先にMF従業員CSVを取り込んでください');
    if (!window.confirm('未入力のスキル・配置可能店舗・勤務可能曜日/時間だけにテスト値を補完します。既に入力済みの値は上書きしません。')) return;
    const skills = loadSkills();
    let changed = 0;
    staff.forEach((person, index) => {
      if (person.active === false) return;
      let personChanged = false;
      person.skillLevels = person.skillLevels || {};
      const hasAnySkill = skills.some(skill => Number(person.skillLevels[skill.id] || 0) > 0);
      if (!hasAnySkill) {
        const seed = hash(String(person.id || index));
        skills.forEach((skill, skillIndex) => {
          const raw = (seed + skillIndex * 17) % 10;
          person.skillLevels[skill.id] = raw < 4 ? 0 : raw < 7 ? 1 : raw < 9 ? 2 : 3;
        });
        if (person.employmentType === '正社員' || person.employmentType === '契約社員') {
          promote(person, 'hall', 2);
          if (index % 2 === 0) promote(person, 'closing', 2);
          if (index % 3 === 0) promote(person, 'meat', 2);
        }
        personChanged = true;
      }
      if (!Array.isArray(person.placementStoreIds) || !person.placementStoreIds.length) {
        person.placementStoreIds = Array.isArray(person.affiliationStoreIds) && person.affiliationStoreIds.length
          ? [...person.affiliationStoreIds]
          : [index % 4 === 0 ? 'misato' : index % 3 === 0 ? 'miebashi' : index % 2 === 0 ? 'kumoji' : 'matsuyama'];
        personChanged = true;
      }
      if (!person.workConstraints) {
        const full = person.employmentType === '正社員' || person.employmentType === '契約社員';
        const pattern = index % 5;
        const unavailable = full ? (pattern === 0 ? ['2'] : pattern === 1 ? ['3'] : pattern === 2 ? ['4'] : pattern === 3 ? ['1'] : ['0'])
          : pattern === 0 ? ['1','3'] : pattern === 1 ? ['2','4'] : pattern === 2 ? ['0','2'] : pattern === 3 ? ['1','5'] : ['3','6'];
        person.workConstraints = {
          availableDays: DAYS.map(d => d.key).filter(day => !unavailable.includes(day)),
          availableStart: full ? 16 * 60 : (index % 3 === 0 ? 17 : index % 3 === 1 ? 18 : 19) * 60,
          availableEnd: full ? 30 * 60 : (index % 4 === 0 ? 24 : index % 4 === 1 ? 25 : index % 4 === 2 ? 26 : 27) * 60,
          preferredDaysPerWeek: full ? 5 : 3 + (index % 3),
          maxDaysPerWeek: full ? 6 : 4 + (index % 2),
          fixedOffDays: unavailable,
          note: 'テスト用の仮設定',
        };
        personChanged = true;
      }
      if (personChanged) {
        person.testSeed = { version: TEST_SEED_VERSION, seededAt: new Date().toISOString() };
        syncLegacySkills(person, skills);
        changed += 1;
      }
    });
    await saveStaff(staff);
    notify(`テスト値を ${changed}名に補完しました`);
    setTimeout(() => window.location.reload(), 500);
  }

  async function clearTestData() {
    const staff = loadStaff();
    const seeded = staff.filter(person => person.testSeed?.version === TEST_SEED_VERSION);
    if (!seeded.length) return notify('消せるテスト値はありません');
    if (!window.confirm(`テスト補完の印がある ${seeded.length}名について、勤務条件だけを消します。スキルは実運用値と区別できないため残します。`)) return;
    seeded.forEach(person => {
      if (person.workConstraints?.note === 'テスト用の仮設定') delete person.workConstraints;
      delete person.testSeed;
    });
    await saveStaff(staff);
    notify('テスト用の勤務条件を消しました');
    setTimeout(() => window.location.reload(), 500);
  }

  function enhanceOpenCard() {
    const content = document.getElementById('staff-card-modal-content');
    if (!content || !document.getElementById('staff-card-modal')?.classList.contains('open')) return;
    if (content.querySelector('#work-constraints-section')) return;
    const idText = content.querySelector('.staff-card-head>div>div')?.textContent || '';
    const id = (idText.match(/[A-Za-z0-9_-]+/) || [])[0] || '';
    const staff = loadStaff();
    const person = staff.find(item => String(item.id || '').toUpperCase() === id.toUpperCase());
    if (!person) return;
    const c = person.workConstraints || defaultConstraints(person);
    const section = document.createElement('section');
    section.id = 'work-constraints-section';
    section.className = 'staff-card-section constraints-section';
    section.innerHTML = `
      <h3>勤務可能条件</h3>
      <div class="constraints-grid">
        <div class="constraints-field"><label>勤務可能曜日</label><div class="constraint-days">${DAYS.map(day => `<label><input type="checkbox" data-work-day="${day.key}" ${(c.availableDays || []).includes(day.key) ? 'checked' : ''}>${day.label}</label>`).join('')}</div></div>
        <div class="constraints-field"><label>勤務可能時間</label><div class="constraint-time"><select id="constraint-start" class="control">${timeOptions(c.availableStart ?? 17*60)}</select><span>〜</span><select id="constraint-end" class="control">${timeOptions(c.availableEnd ?? 26*60)}</select></div></div>
        <div class="constraints-field"><label>希望勤務日数 / 週</label><select id="constraint-preferred-days" class="control">${dayCountOptions(c.preferredDaysPerWeek ?? 4)}</select></div>
        <div class="constraints-field"><label>最大勤務日数 / 週</label><select id="constraint-max-days" class="control">${dayCountOptions(c.maxDaysPerWeek ?? 6)}</select></div>
      </div>
      <div class="constraints-note">固定休は「勤務可能曜日」のチェックを外すだけ。ここは後から何度でも変更できます。</div>
    `;
    const placement = Array.from(content.querySelectorAll('.staff-card-section')).find(node => node.querySelector('h3')?.textContent === '配置条件');
    if (placement) placement.insertAdjacentElement('afterend', section);
    else content.querySelector('.staff-card-body')?.appendChild(section);

    const saveButton = content.querySelector('#staff-card-save');
    if (saveButton && !saveButton.dataset.constraintsBound) {
      saveButton.dataset.constraintsBound = '1';
      saveButton.addEventListener('click', async () => {
        const fresh = loadStaff();
        const target = fresh.find(item => String(item.id || '').toUpperCase() === id.toUpperCase());
        if (!target) return;
        target.workConstraints = {
          ...(target.workConstraints || {}),
          availableDays: Array.from(content.querySelectorAll('[data-work-day]:checked')).map(input => input.dataset.workDay),
          availableStart: Number(content.querySelector('#constraint-start')?.value || 17 * 60),
          availableEnd: Number(content.querySelector('#constraint-end')?.value || 26 * 60),
          preferredDaysPerWeek: Number(content.querySelector('#constraint-preferred-days')?.value || 4),
          maxDaysPerWeek: Number(content.querySelector('#constraint-max-days')?.value || 6),
          note: target.workConstraints?.note === 'テスト用の仮設定' ? 'テスト用の仮設定' : (target.workConstraints?.note || ''),
        };
        await saveStaff(fresh);
      }, true);
    }
  }

  function defaultConstraints(person) {
    const full = person.employmentType === '正社員' || person.employmentType === '契約社員';
    return { availableDays: DAYS.map(day => day.key), availableStart: full ? 16*60 : 18*60, availableEnd: full ? 30*60 : 26*60, preferredDaysPerWeek: full ? 5 : 4, maxDaysPerWeek: full ? 6 : 5 };
  }

  function timeOptions(selected) {
    let html = '';
    for (let minute = 15 * 60; minute <= 30 * 60; minute += 30) html += `<option value="${minute}" ${minute === Number(selected) ? 'selected' : ''}>${fmtTime(minute)}</option>`;
    return html;
  }

  function dayCountOptions(selected) {
    return [1,2,3,4,5,6,7].map(value => `<option value="${value}" ${value === Number(selected) ? 'selected' : ''}>${value}日</option>`).join('');
  }

  function promote(person, skillId, level) {
    if (person.skillLevels && Object.prototype.hasOwnProperty.call(person.skillLevels, skillId)) person.skillLevels[skillId] = Math.max(Number(person.skillLevels[skillId] || 0), level);
  }

  function syncLegacySkills(person, skills) {
    person.skills = skills.filter(skill => Number(person.skillLevels?.[skill.id] || 0) > 0).map(skill => skill.name);
  }

  function loadSkills() {
    const list = loadJson(STORAGE_SKILLS, []);
    return Array.isArray(list) && list.length ? list.filter(skill => skill.active !== false) : [
      { id:'opening',name:'オープン準備'},{ id:'closing',name:'締め作業'},{ id:'meat',name:'肉場'},{ id:'salad',name:'サラダ場'},{ id:'hall',name:'ホール'},{ id:'drink',name:'ドリンク'},{ id:'dish',name:'洗い場'},{ id:'register',name:'レジ' }
    ];
  }

  function loadStaff() { const value = loadJson(STORAGE_STAFF, []); return Array.isArray(value) ? value : []; }

  async function saveStaff(staff) {
    localStorage.setItem(STORAGE_STAFF, JSON.stringify(staff));
    if (window.shiftV2Cloud && window.shiftV2User) {
      try { await window.shiftV2Cloud.set(CLOUD_STAFF, staff); }
      catch (error) { console.warn('Test seed cloud save failed', error); }
    }
  }

  function hash(value) { let h = 0; for (let i = 0; i < value.length; i += 1) h = ((h << 5) - h + value.charCodeAt(i)) | 0; return Math.abs(h); }
  function fmtTime(total) { const next = total >= 1440; const h = Math.floor(total / 60) % 24; const m = total % 60; return `${next ? '翌 ' : ''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function loadJson(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return window.alert(message);
    toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function injectStyles() {
    if (document.getElementById('shift-v2-constraints-style')) return;
    const style = document.createElement('style');
    style.id = 'shift-v2-constraints-style';
    style.textContent = `.constraints-section{border-top:1px solid #eaecf0;padding-top:14px}.constraints-grid{display:grid;grid-template-columns:1.2fr 1fr .7fr .7fr;gap:9px}.constraints-field{border:1px solid #eaecf0;border-radius:8px;padding:8px;background:#fcfcfd}.constraints-field>label{display:block;font-size:8px;font-weight:900;color:#475467;margin-bottom:6px}.constraint-days{display:flex;gap:5px;flex-wrap:wrap}.constraint-days label{display:flex;align-items:center;gap:3px;border:1px solid #e4e7ec;border-radius:999px;padding:4px 7px;font-size:9px;background:#fff}.constraint-days input{width:auto}.constraint-time{display:flex;align-items:center;gap:5px}.constraint-time .control{min-width:88px}.constraints-note{font-size:8px;color:#667085;margin-top:6px}@media(max-width:900px){.constraints-grid{grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(style);
  }
})();