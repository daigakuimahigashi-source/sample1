(() => {
  'use strict';

  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';
  const CLOUD_SKILLS = 'shiftV2Skills';
  const CLOUD_REQUIREMENTS = 'shiftV2Requirements';
  const CLOUD_STAFF = 'staff';

  const DEFAULT_SKILLS = [
    { id:'opening', name:'オープン準備', active:true },
    { id:'closing', name:'締め作業', active:true },
    { id:'meat', name:'肉場', active:true },
    { id:'salad', name:'サラダ場', active:true },
    { id:'hall', name:'ホール', active:true },
    { id:'drink', name:'ドリンク', active:true },
    { id:'dish', name:'洗い場', active:true },
    { id:'register', name:'レジ', active:true },
  ];
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji', name:'久茂地店' },
    { id:'miebashi', name:'美栄橋店' },
    { id:'misato', name:'美里店' },
  ];
  const DAY_TYPES = [
    ['all','毎日'], ['weekday','平日（月〜木）'], ['fri_sat','金・土'], ['sun','日曜'], ['specific','特定日']
  ];
  const LEVEL_TEXT = ['0 未経験','1 できる','2 責任をもってできる','3 教育できる'];

  let state = { skills:[], requirements:[], staff:[], stores:[] };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), { once:true });
  else setTimeout(init, 0);

  function init() {
    if (document.getElementById('view-rules')) return;
    injectStyles();
    buildView();
    reload();
    renderAll();
    window.shiftV2RulesSafe = { reload, renderAll };
  }

  function reload() {
    state.skills = normalizeSkills(readJson(SKILLS_KEY, DEFAULT_SKILLS));
    state.requirements = normalizeRequirements(readJson(REQUIREMENTS_KEY, []));
    state.staff = normalizeStaff(readJson(STAFF_KEY, []));
    const stores = readJson(STORES_KEY, DEFAULT_STORES);
    state.stores = Array.isArray(stores) && stores.length ? stores : DEFAULT_STORES;
  }

  function buildView() {
    const tabs = document.querySelector('.tabs');
    if (!tabs) return;
    let tab = tabs.querySelector('[data-view="rules"]');
    if (!tab) {
      tab = document.createElement('button');
      tab.className = 'tab';
      tab.dataset.view = 'rules';
      const csv = tabs.querySelector('[data-view="csv"]');
      if (csv) tabs.insertBefore(tab, csv); else tabs.appendChild(tab);
    }
    tab.innerHTML = '<i class="fa-solid fa-users-gear"></i> 人員・スキル設定';
    tab.addEventListener('click', event => { event.preventDefault(); activate(); });

    const view = document.createElement('section');
    view.id = 'view-rules';
    view.className = 'view';
    view.innerHTML = `
      <div class="card rs-hero">
        <div><h2>人員・スキル設定</h2><p>月間AUTOの基準をここで変更します。基本は 1 → 2 → 3 の順で設定してください。</p></div>
        <button id="rs-save" class="btn btn-green"><i class="fa-solid fa-floppy-disk"></i> 保存</button>
      </div>
      <div id="rs-summary" class="rs-summary"></div>
      <div class="rs-steps">
        <button data-jump="rs-skills"><b>1</b><span><strong>スキル種類</strong><small>項目の追加・名称変更</small></span></button>
        <i class="fa-solid fa-chevron-right"></i>
        <button data-jump="rs-staff"><b>2</b><span><strong>スタッフLv</strong><small>0〜3を設定</small></span></button>
        <i class="fa-solid fa-chevron-right"></i>
        <button data-jump="rs-requirements"><b>3</b><span><strong>必要人数</strong><small>店舗・時間帯・Lv・人数</small></span></button>
      </div>
      <section id="rs-skills" class="card rs-card">
        <div class="rs-head"><div><h3>1. スキル種類</h3><small>新しいスキルは自由に追加できます。</small></div><div class="rs-add"><input id="rs-new-skill" class="control" placeholder="例：発注、棚卸し"><button id="rs-add-skill" class="btn btn-green btn-small">追加</button></div></div>
        <div id="rs-skill-list" class="rs-skill-list"></div>
      </section>
      <section id="rs-staff" class="card rs-card">
        <div class="rs-head"><div><h3>2. スタッフのスキルLv</h3><small>0 未経験 / 1 できる / 2 責任をもってできる / 3 教育できる</small></div><input id="rs-staff-search" class="control" placeholder="氏名・従業員番号で検索"></div>
        <div class="rs-table-wrap"><table class="rs-staff-table"><thead id="rs-staff-head"></thead><tbody id="rs-staff-body"></tbody></table></div>
      </section>
      <section id="rs-requirements" class="card rs-card">
        <div class="rs-head"><div><h3>3. 店舗・時間帯ごとの必要人数</h3><small>この条件を月間AUTOと不足判定が使います。</small></div><button id="rs-add-rule" class="btn btn-green"><i class="fa-solid fa-plus"></i> 条件を追加</button></div>
        <div class="rs-rule-filter"><select id="rs-store-filter" class="control"><option value="">全店舗</option></select><span>「最低Lv 2・1人」なら、その時間帯にLv2以上を最低1人必要とします。</span></div>
        <div class="rs-table-wrap"><table class="rs-rule-table"><thead><tr><th>有効</th><th>店舗</th><th>曜日</th><th>時間</th><th>スキル</th><th>最低Lv</th><th>人数</th><th>区分</th><th></th></tr></thead><tbody id="rs-rule-body"></tbody></table></div>
      </section>
    `;
    document.querySelector('.workspace')?.appendChild(view);

    document.getElementById('rs-save')?.addEventListener('click', () => save(true));
    document.getElementById('rs-add-skill')?.addEventListener('click', addSkill);
    document.getElementById('rs-new-skill')?.addEventListener('keydown', e => { if (e.key === 'Enter') addSkill(); });
    document.getElementById('rs-add-rule')?.addEventListener('click', addRule);
    document.getElementById('rs-staff-search')?.addEventListener('input', renderStaff);
    document.getElementById('rs-store-filter')?.addEventListener('change', renderRules);
    view.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.jump)?.scrollIntoView({ behavior:'smooth', block:'start' })));
  }

  function activate() {
    reload();
    renderAll();
    document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === 'rules'));
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === 'view-rules'));
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function renderAll() {
    renderSummary();
    renderSkills();
    renderStaff();
    renderRules();
    renderStoreFilter();
  }

  function renderSummary() {
    const node = document.getElementById('rs-summary');
    if (!node) return;
    const activeSkills = state.skills.filter(s => s.active !== false).length;
    const activeRules = state.requirements.filter(r => r.active !== false).length;
    const skilled = state.staff.filter(p => Object.values(p.skillLevels || {}).some(v => Number(v) > 0)).length;
    node.innerHTML = metric('利用中スキル', `${activeSkills}個`) + metric('配置条件', `${activeRules}件`) + metric('スタッフ', `${state.staff.length}名`) + metric('Lv登録済', `${skilled}名`);
  }

  function renderSkills() {
    const node = document.getElementById('rs-skill-list');
    if (!node) return;
    node.innerHTML = state.skills.map(skill => `
      <div class="rs-skill-row" data-skill="${esc(skill.id)}">
        <span class="rs-id">${esc(skill.id)}</span>
        <input class="control rs-skill-name" value="${esc(skill.name)}">
        <label><input class="rs-skill-active" type="checkbox" ${skill.active !== false ? 'checked' : ''}> 利用中</label>
      </div>
    `).join('');
    node.querySelectorAll('[data-skill]').forEach(row => {
      const skill = state.skills.find(s => s.id === row.dataset.skill);
      row.querySelector('.rs-skill-name')?.addEventListener('change', e => { skill.name = e.target.value.trim() || skill.name; save(false); renderStaff(); renderRules(); });
      row.querySelector('.rs-skill-active')?.addEventListener('change', e => { skill.active = e.target.checked; save(false); renderAll(); });
    });
  }

  function renderStaff() {
    const head = document.getElementById('rs-staff-head');
    const body = document.getElementById('rs-staff-body');
    if (!head || !body) return;
    const skills = state.skills.filter(s => s.active !== false);
    const query = document.getElementById('rs-staff-search')?.value.trim().toLowerCase() || '';
    const people = state.staff.filter(p => !query || `${p.id} ${p.name}`.toLowerCase().includes(query));
    head.innerHTML = `<tr><th>従業員</th>${skills.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr>`;
    body.innerHTML = people.map(person => `<tr data-person="${esc(person.id)}"><td><strong>${esc(person.name || person.id)}</strong><small>${esc(person.id)}${person.employmentType ? ` ・ ${esc(person.employmentType)}` : ''}</small></td>${skills.map(skill => {
      const lv = clampLevel(person.skillLevels?.[skill.id]);
      return `<td><button class="rs-lv lv${lv}" data-skill="${esc(skill.id)}" title="${esc(LEVEL_TEXT[lv])}">${lv}</button></td>`;
    }).join('')}</tr>`).join('') || `<tr><td colspan="${skills.length + 1}">スタッフがいません。</td></tr>`;
    body.querySelectorAll('.rs-lv').forEach(button => button.addEventListener('click', () => {
      const row = button.closest('[data-person]');
      const person = state.staff.find(p => p.id === row?.dataset.person);
      if (!person) return;
      const skillId = button.dataset.skill;
      person.skillLevels = person.skillLevels || {};
      person.skillLevels[skillId] = (clampLevel(person.skillLevels[skillId]) + 1) % 4;
      syncLegacySkills(person);
      save(false);
      renderStaff();
      renderSummary();
    }));
  }

  function renderStoreFilter() {
    const select = document.getElementById('rs-store-filter');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">全店舗</option>' + state.stores.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    select.value = current;
  }

  function renderRules() {
    const body = document.getElementById('rs-rule-body');
    if (!body) return;
    const filter = document.getElementById('rs-store-filter')?.value || '';
    const skills = state.skills.filter(s => s.active !== false);
    const rules = state.requirements.filter(r => !filter || r.storeId === filter);
    body.innerHTML = rules.map(rule => `
      <tr data-rule="${esc(rule.id)}">
        <td><input data-field="active" type="checkbox" ${rule.active !== false ? 'checked' : ''}></td>
        <td><select data-field="storeId" class="control">${state.stores.map(s => option(s.id, s.name, rule.storeId)).join('')}</select></td>
        <td><select data-field="dayType" class="control">${DAY_TYPES.map(([v,l]) => option(v,l,rule.dayType)).join('')}</select>${rule.dayType === 'specific' ? `<input data-field="specificDate" class="control" type="date" value="${esc(rule.specificDate || '')}">` : ''}</td>
        <td class="rs-time"><select data-field="start" class="control">${timeOptions(rule.start)}</select><span>〜</span><select data-field="end" class="control">${timeOptions(rule.end)}</select></td>
        <td><select data-field="skillId" class="control">${skills.map(s => option(s.id,s.name,rule.skillId)).join('')}</select></td>
        <td><select data-field="minLevel" class="control">${[1,2,3].map(v => option(v,`Lv${v}`,rule.minLevel)).join('')}</select></td>
        <td><input data-field="count" class="control rs-count" type="number" min="1" max="20" value="${Number(rule.count || 1)}"></td>
        <td><select data-field="mode" class="control">${option('hard','必須',rule.mode)}${option('soft','推奨',rule.mode)}</select></td>
        <td><button class="btn btn-light btn-small rs-delete"><i class="fa-solid fa-trash"></i></button></td>
      </tr>
    `).join('') || '<tr><td colspan="9">条件がありません。「条件を追加」から作成できます。</td></tr>';

    body.querySelectorAll('[data-rule]').forEach(row => {
      const rule = state.requirements.find(r => r.id === row.dataset.rule);
      row.querySelectorAll('[data-field]').forEach(control => control.addEventListener('change', () => {
        const field = control.dataset.field;
        if (field === 'active') rule.active = control.checked;
        else if (['start','end','minLevel','count'].includes(field)) rule[field] = Number(control.value);
        else rule[field] = control.value;
        if (rule.end <= rule.start) rule.end = Math.min(30 * 60, rule.start + 30);
        save(false);
        if (field === 'dayType') renderRules();
      }));
      row.querySelector('.rs-delete')?.addEventListener('click', () => {
        state.requirements = state.requirements.filter(r => r.id !== rule.id);
        save(false); renderRules(); renderSummary();
      });
    });
  }

  function addSkill() {
    const input = document.getElementById('rs-new-skill');
    const name = input?.value.trim();
    if (!name) return;
    const base = `skill_${Date.now().toString(36)}`;
    state.skills.push({ id:base, name, active:true });
    state.staff.forEach(p => { p.skillLevels = p.skillLevels || {}; p.skillLevels[base] = 0; });
    input.value = '';
    save(false); renderAll();
  }

  function addRule() {
    const firstStore = state.stores[0]?.id || 'matsuyama';
    const firstSkill = state.skills.find(s => s.active !== false)?.id || 'hall';
    state.requirements.push({ id:`r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`, storeId:firstStore, dayType:'all', specificDate:'', start:17*60, end:22*60, skillId:firstSkill, minLevel:1, count:1, mode:'hard', active:true });
    save(false); renderRules(); renderSummary();
  }

  async function save(showToast) {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(state.skills));
    localStorage.setItem(REQUIREMENTS_KEY, JSON.stringify(state.requirements));
    localStorage.setItem(STAFF_KEY, JSON.stringify(state.staff));
    if (showToast && window.shiftV2Cloud && window.shiftV2User) {
      try {
        await Promise.all([
          window.shiftV2Cloud.set(CLOUD_SKILLS, state.skills),
          window.shiftV2Cloud.set(CLOUD_REQUIREMENTS, state.requirements),
          window.shiftV2Cloud.set(CLOUD_STAFF, state.staff),
        ]);
        notify('人員・スキル設定を保存しました');
      } catch (error) {
        console.warn(error); notify('端末には保存しました。クラウド保存は失敗しました');
      }
    } else if (showToast) notify('人員・スキル設定をこの端末に保存しました');
  }

  function normalizeSkills(list) {
    const source = Array.isArray(list) && list.length ? list : DEFAULT_SKILLS;
    return source.map((s,i) => ({ id:String(s.id || `skill_${i}`), name:String(s.name || `スキル${i+1}`), active:s.active !== false }));
  }
  function normalizeRequirements(list) {
    if (!Array.isArray(list)) return [];
    return list.map((r,i) => ({ id:String(r.id || `r_${i}`), storeId:String(r.storeId || 'matsuyama'), dayType:DAY_TYPES.some(([v]) => v === r.dayType) ? r.dayType : 'all', specificDate:String(r.specificDate || ''), start:Number(r.start ?? 17*60), end:Number(r.end ?? 22*60), skillId:String(r.skillId || 'hall'), minLevel:Math.max(1,Math.min(3,Number(r.minLevel || 1))), count:Math.max(1,Number(r.count || 1)), mode:r.mode === 'soft' ? 'soft' : 'hard', active:r.active !== false }));
  }
  function normalizeStaff(list) {
    if (!Array.isArray(list)) return [];
    return list.map(p => ({ ...p, id:String(p.id || p.employeeNumber || '').toUpperCase(), name:p.name || `${p.lastName || ''} ${p.firstName || ''}`.trim(), employmentType:p.employmentType || (p.salaryType === 'monthly' ? '正社員' : 'アルバイト'), skillLevels:{ ...(p.skillLevels || {}) } })).filter(p => p.id);
  }
  function syncLegacySkills(person) {
    person.skills = state.skills.filter(s => s.active !== false && clampLevel(person.skillLevels?.[s.id]) > 0).map(s => s.name);
  }
  function clampLevel(v) { const n=Number(v); return Number.isFinite(n) ? Math.max(0,Math.min(3,Math.round(n))) : 0; }
  function metric(label,value) { return `<div class="card rs-metric"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`; }
  function option(value,label,selected) { return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label)}</option>`; }
  function timeOptions(selected) { let html=''; for(let m=15*60;m<=30*60;m+=30) html += option(m,fmtTime(m),selected); return html; }
  function fmtTime(v) { const n=Number(v), next=n>=1440, h=Math.floor(n/60)%24, m=n%60; return `${next?'翌 ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function readJson(key,fallback) { try { const value=JSON.parse(localStorage.getItem(key)); return value ?? clone(fallback); } catch { return clone(fallback); } }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function esc(v) { return String(v ?? '').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])); }
  function notify(message) { const toast=document.getElementById('toast'); if(!toast) return window.alert(message); toast.textContent=message; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),2200); }

  function injectStyles() {
    if (document.getElementById('rs-style')) return;
    const style=document.createElement('style'); style.id='rs-style'; style.textContent=`
      .rs-hero{display:flex;align-items:center;justify-content:space-between;padding:15px 17px;margin-bottom:10px}.rs-hero h2{margin:0;font-size:16px}.rs-hero p{margin:4px 0 0;font-size:9px;color:#667085}.rs-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.rs-metric{padding:10px 12px}.rs-metric small{display:block;font-size:8px;color:#667085}.rs-metric strong{font-size:18px}.rs-steps{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:7px;align-items:center;margin-bottom:10px}.rs-steps button{display:flex;gap:8px;align-items:center;text-align:left;background:#fff;border:1px solid #d0d5dd;border-radius:10px;padding:9px;cursor:pointer}.rs-steps button b{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#101828;color:#fff}.rs-steps strong,.rs-steps small{display:block}.rs-steps strong{font-size:10px}.rs-steps small{font-size:7px;color:#667085}.rs-steps>i{color:#98a2b3;font-size:9px}.rs-card{margin-bottom:10px;overflow:hidden}.rs-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #eaecf0}.rs-head h3{margin:0;font-size:11px}.rs-head small{font-size:8px;color:#667085}.rs-add{display:flex;gap:6px}.rs-skill-list{padding:8px 12px}.rs-skill-row{display:grid;grid-template-columns:130px minmax(180px,1fr) 90px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f2f4f7}.rs-id{font:8px ui-monospace,monospace;color:#98a2b3}.rs-table-wrap{overflow:auto;max-height:520px}.rs-staff-table,.rs-rule-table{border-collapse:separate;border-spacing:0;width:100%;font-size:9px}.rs-staff-table{min-width:950px}.rs-rule-table{min-width:1120px}.rs-staff-table th,.rs-rule-table th{position:sticky;top:0;background:#f8fafc;z-index:3;padding:7px;border-bottom:1px solid #e4e7ec}.rs-staff-table td,.rs-rule-table td{padding:6px;border-bottom:1px solid #eef1f4;text-align:center;background:#fff}.rs-staff-table td:first-child{text-align:left;position:sticky;left:0;z-index:2}.rs-staff-table td:first-child strong,.rs-staff-table td:first-child small{display:block}.rs-staff-table td:first-child small{font-size:7px;color:#98a2b3}.rs-lv{border:0;border-radius:8px;width:31px;height:27px;font-weight:900;cursor:pointer}.rs-lv.lv0{background:#f2f4f7;color:#667085}.rs-lv.lv1{background:#eff8ff;color:#175cd3}.rs-lv.lv2{background:#fffaeb;color:#b54708}.rs-lv.lv3{background:#ecfdf3;color:#027a48}.rs-rule-filter{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fcfcfd;border-bottom:1px solid #eaecf0}.rs-rule-filter span{font-size:8px;color:#667085}.rs-time{display:flex;align-items:center;gap:4px}.rs-count{width:65px}.rs-rule-table .control{min-width:105px}@media(max-width:900px){.rs-summary,.rs-steps{grid-template-columns:1fr}.rs-steps>i{display:none}.rs-head{align-items:flex-start;flex-direction:column}}
    `; document.head.appendChild(style);
  }
})();
