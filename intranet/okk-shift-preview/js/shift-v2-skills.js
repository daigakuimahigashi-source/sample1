import { SKILL_DEFINITIONS, SKILL_LEVELS } from '../data/shift-platform-config.js';

const STAFF_KEY = 'okk_shift_v2_staff';
const AUDIT_KEY = 'okk_shift_v2_skill_audit';
const CLOUD_STAFF_KEY = 'staff';
const CLOUD_AUDIT_KEY = 'shiftV2SkillAudit';

let staff = load(STAFF_KEY, []);
let audit = load(AUDIT_KEY, []);
let query = '';
let employment = '';
let saving = false;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();

document.addEventListener('shiftv2-auth', () => setTimeout(hydrateCloud, 150));
document.addEventListener('shiftv2-access', applyAccess);

function init() {
  injectTabAndView();
  bind();
  render();
  setTimeout(hydrateCloud, 500);
}

function injectTabAndView() {
  if (document.getElementById('view-skills')) return;
  const tabs = document.querySelector('.tabs');
  const staffTab = tabs?.querySelector('[data-view="staff"]');
  const tab = document.createElement('button');
  tab.className = 'tab';
  tab.dataset.view = 'skills';
  tab.innerHTML = '<i class="fa-solid fa-table-cells"></i> スキル';
  if (staffTab) tabs.insertBefore(tab, staffTab); else tabs?.appendChild(tab);

  const section = document.createElement('section');
  section.id = 'view-skills';
  section.className = 'view';
  section.innerHTML = `
    <div class="card skill-hero">
      <div><h2>スキルマトリクス</h2><p>この評価を人員配置・必要スキル判定・AIシフト作成が共通で使用します。</p></div>
      <div id="skill-save-state" class="skill-save-state">自動保存</div>
    </div>
    <div class="card skill-toolbar">
      <input id="skill-search" class="control" placeholder="氏名・従業員番号・スキルで検索">
      <select id="skill-employment" class="control"><option value="">雇用区分：すべて</option><option value="正社員">正社員</option><option value="アルバイト">アルバイト</option></select>
      <div class="skill-legend">${SKILL_LEVELS.map(level => `<span class="skill-level-legend lv-${level.value}"><b>${level.value}</b>${esc(level.label)}</span>`).join('')}</div>
    </div>
    <div class="card skill-table-card"><div class="skill-table-wrap"><table class="skill-table"><thead><tr><th class="skill-person-col">従業員</th><th>雇用</th>${SKILL_DEFINITIONS.map(skill => `<th>${esc(skill.name)}</th>`).join('')}</tr></thead><tbody id="skill-body"></tbody></table></div></div>
    <div class="card skill-audit-card"><div class="data-head"><h2>最近のスキル変更</h2><span style="font-size:9px;color:#667085">最新20件</span></div><div id="skill-audit-list"></div></div>
  `;
  document.querySelector('.workspace')?.appendChild(section);
  injectStyles();

  tab.addEventListener('click', event => {
    event.preventDefault();
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view === section));
    render();
  });
}

function bind() {
  document.getElementById('skill-search')?.addEventListener('input', event => { query = event.target.value.trim().toLowerCase(); renderTable(); });
  document.getElementById('skill-employment')?.addEventListener('change', event => { employment = event.target.value; renderTable(); });
}

function render() { renderTable(); renderAudit(); applyAccess(); }

function filteredStaff() {
  return normalizeStaff(staff).filter(person => {
    if (person.active === false) return false;
    if (employment && person.employmentType !== employment) return false;
    const haystack = [person.id, person.name, person.employmentType, ...SKILL_DEFINITIONS.filter(skill => levelOf(person, skill) > 0).map(skill => skill.name)].join(' ').toLowerCase();
    return !query || haystack.includes(query);
  }).sort((a,b) => String(a.name).localeCompare(String(b.name), 'ja'));
}

function renderTable() {
  const body = document.getElementById('skill-body');
  if (!body) return;
  const canEdit = Boolean(window.shiftV2Access?.can?.('staff.skill.edit'));
  const people = filteredStaff();
  body.innerHTML = people.map(person => `<tr>
    <td class="skill-person-col"><strong>${esc(person.name || person.id)}</strong><span>${esc(person.id)}</span></td>
    <td><span class="badge ${person.salaryType === 'monthly' ? 'badge-monthly' : 'badge-hourly'}">${esc(person.employmentType || '')}</span>${person.managerQualified ? '<span class="manager-qualified-chip">店長資格</span>' : ''}</td>
    ${SKILL_DEFINITIONS.map(skill => {
      const level = levelOf(person, skill);
      return `<td class="skill-matrix-cell"><button class="skill-level-button lv-${level}" data-staff-id="${esc(person.id)}" data-skill-id="${esc(skill.id)}" ${canEdit ? '' : 'disabled'}><b>${level}</b><span>${esc(SKILL_LEVELS[level]?.label || '')}</span></button></td>`;
    }).join('')}
  </tr>`).join('') || `<tr><td colspan="${SKILL_DEFINITIONS.length + 2}" class="master-empty">条件に合う従業員はいません。</td></tr>`;

  body.querySelectorAll('[data-staff-id][data-skill-id]').forEach(button => button.addEventListener('click', () => changeSkill(button.dataset.staffId, button.dataset.skillId)));
}

async function changeSkill(staffId, skillId) {
  if (!window.shiftV2Access?.can?.('staff.skill.edit')) return notify('スキル編集権限がありません');
  const person = normalizeStaff(staff).find(row => row.id === staffId);
  if (!person) return;
  const target = staff.find(row => canonicalId(row) === staffId);
  if (!target) return;
  if (!target.skillLevels) target.skillLevels = {};

  const before = levelOf(target, SKILL_DEFINITIONS.find(skill => skill.id === skillId));
  const after = (before + 1) % 4;
  target.skillLevels[skillId] = after;
  syncLegacySkills(target);

  audit.unshift({
    id: `skill_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    at: new Date().toISOString(),
    by: window.shiftV2User?.email || window.shiftV2Access?.staffName || 'local-user',
    staffId,
    staffName: target.name || staffId,
    skillId,
    skillName: SKILL_DEFINITIONS.find(skill => skill.id === skillId)?.name || skillId,
    before,
    after,
  });
  audit = audit.slice(0, 500);

  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
  localStorage.setItem(AUDIT_KEY, JSON.stringify(audit));
  render();
  await saveCloud();
}

async function saveCloud() {
  if (!window.shiftV2Cloud || !window.shiftV2User || saving) return;
  saving = true;
  setSaveState('保存中…');
  try {
    await Promise.all([
      window.shiftV2Cloud.set(CLOUD_STAFF_KEY, staff),
      window.shiftV2Cloud.set(CLOUD_AUDIT_KEY, audit),
    ]);
    setSaveState('保存済み');
  } catch (error) {
    console.warn('Skill cloud save failed', error);
    setSaveState('端末保存済み');
  } finally {
    saving = false;
    setTimeout(() => setSaveState('自動保存'), 1200);
  }
}

async function hydrateCloud() {
  if (!window.shiftV2Cloud || !window.shiftV2User || hydrateCloud.running) return;
  hydrateCloud.running = true;
  try {
    const [cloudStaff, cloudAudit] = await Promise.all([
      window.shiftV2Cloud.get(CLOUD_STAFF_KEY),
      window.shiftV2Cloud.get(CLOUD_AUDIT_KEY),
    ]);
    if (Array.isArray(cloudStaff) && cloudStaff.length) { staff = cloudStaff; localStorage.setItem(STAFF_KEY, JSON.stringify(staff)); }
    if (Array.isArray(cloudAudit)) { audit = cloudAudit; localStorage.setItem(AUDIT_KEY, JSON.stringify(audit)); }
    render();
  } catch (error) { console.warn('Skill cloud load failed', error); }
  finally { hydrateCloud.running = false; }
}

function renderAudit() {
  const root = document.getElementById('skill-audit-list');
  if (!root) return;
  root.innerHTML = audit.slice(0,20).map(row => `<div class="skill-audit-row"><div><strong>${esc(row.staffName || row.staffId)}</strong><span>${esc(row.skillName)}</span></div><div class="skill-audit-change"><b class="lv-${row.before}">${row.before}</b><i class="fa-solid fa-arrow-right"></i><b class="lv-${row.after}">${row.after}</b></div><div class="skill-audit-meta">${esc(row.by || '')}<br>${esc(formatDateTime(row.at))}</div></div>`).join('') || '<div class="empty" style="padding:18px">スキル変更履歴はまだありません。</div>';
}

function applyAccess() {
  const tab = document.querySelector('[data-view="skills"]');
  if (!tab) return;
  const roleId = window.shiftV2Access?.roleId;
  tab.style.display = roleId === 'employee' ? 'none' : '';
  const canEdit = Boolean(window.shiftV2Access?.can?.('staff.skill.edit'));
  document.querySelectorAll('.skill-level-button').forEach(button => button.disabled = !canEdit);
}

function levelOf(person, skill) {
  if (!skill) return 0;
  const direct = Number(person?.skillLevels?.[skill.id]);
  if (Number.isFinite(direct)) return clampLevel(direct);
  const legacy = Array.isArray(person?.skills) ? person.skills : [];
  return skill.legacyNames.some(name => legacy.includes(name)) ? 1 : 0;
}

function syncLegacySkills(person) {
  person.skills = SKILL_DEFINITIONS.filter(skill => levelOf(person, skill) > 0).map(skill => skill.name);
}

function normalizeStaff(list) {
  return (Array.isArray(list) ? list : []).map(person => ({
    ...person,
    id: canonicalId(person),
    name: person.name || `${person.lastName || ''} ${person.firstName || ''}`.trim(),
    employmentType: person.employmentType || (person.salaryType === 'monthly' ? '正社員' : 'アルバイト'),
    salaryType: person.salaryType === 'monthly' ? 'monthly' : 'hourly',
  })).filter(person => person.id);
}

function canonicalId(person) { return String(person?.id || person?.employeeNumber || '').toUpperCase(); }
function clampLevel(value) { return Math.max(0, Math.min(3, Math.round(Number(value) || 0))); }
function load(key, fallback) { try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } }
function setSaveState(text) { const el = document.getElementById('skill-save-state'); if (el) el.textContent = text; }
function formatDateTime(value) { if (!value) return ''; const d = new Date(value); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function notify(message) { const el = document.getElementById('toast'); if (!el) return; el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }
function esc(value) { return String(value ?? '').replace(/[&<>\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char])); }

function injectStyles() {
  if (document.getElementById('shift-skill-style')) return;
  const style = document.createElement('style');
  style.id = 'shift-skill-style';
  style.textContent = `
    .skill-hero{padding:14px 16px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px}.skill-hero h2{font-size:16px;margin:0}.skill-hero p{font-size:10px;color:#667085;margin:4px 0 0}.skill-save-state{font-size:9px;font-weight:900;color:#047857;background:#ecfdf5;padding:5px 8px;border-radius:999px}.skill-toolbar{padding:10px;margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.skill-toolbar #skill-search{min-width:280px}.skill-legend{display:flex;gap:5px;flex-wrap:wrap;margin-left:auto}.skill-level-legend{display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:999px;font-size:8px;font-weight:800}.skill-level-legend b{font-size:10px}.skill-level-legend.lv-0{background:#f1f5f9;color:#64748b}.skill-level-legend.lv-1{background:#fef3c7;color:#92400e}.skill-level-legend.lv-2{background:#dbeafe;color:#1d4ed8}.skill-level-legend.lv-3{background:#dcfce7;color:#166534}.skill-table-card{overflow:hidden}.skill-table-wrap{overflow:auto;max-height:65vh}.skill-table{min-width:1180px}.skill-table th{text-align:center}.skill-table th.skill-person-col{text-align:left;left:0;z-index:3}.skill-person-col{position:sticky;left:0;background:#fff;min-width:170px;z-index:2}.skill-person-col strong{display:block;font-size:10px}.skill-person-col span{display:block;font-size:8px;color:#98a2b3}.skill-matrix-cell{text-align:center;padding:5px}.skill-level-button{width:74px;min-height:40px;border:1px solid transparent;border-radius:8px;display:flex;align-items:center;justify-content:center;gap:5px;font-size:8px;font-weight:800;cursor:pointer}.skill-level-button b{font-size:14px}.skill-level-button.lv-0{background:#f8fafc;color:#64748b;border-color:#e2e8f0}.skill-level-button.lv-1{background:#fffbeb;color:#92400e;border-color:#fde68a}.skill-level-button.lv-2{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}.skill-level-button.lv-3{background:#f0fdf4;color:#166534;border-color:#bbf7d0}.skill-level-button:disabled{cursor:default;opacity:.72}.manager-qualified-chip{display:block;width:max-content;margin-top:3px;padding:2px 5px;border-radius:999px;background:#ede9fe;color:#6d28d9;font-size:7px;font-weight:900}.skill-audit-card{margin-top:10px}.skill-audit-row{display:grid;grid-template-columns:1fr 120px 180px;gap:10px;align-items:center;padding:9px 12px;border-bottom:1px solid #edf0f4;font-size:9px}.skill-audit-row strong,.skill-audit-row span{display:block}.skill-audit-row span,.skill-audit-meta{color:#667085}.skill-audit-change{display:flex;align-items:center;gap:7px;justify-content:center}.skill-audit-change b{width:26px;height:26px;border-radius:7px;display:grid;place-items:center}.skill-audit-change .lv-0{background:#f1f5f9;color:#64748b}.skill-audit-change .lv-1{background:#fef3c7;color:#92400e}.skill-audit-change .lv-2{background:#dbeafe;color:#1d4ed8}.skill-audit-change .lv-3{background:#dcfce7;color:#166534}@media(max-width:760px){.skill-toolbar #skill-search{min-width:100%}.skill-audit-row{grid-template-columns:1fr 90px}.skill-audit-meta{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
}
