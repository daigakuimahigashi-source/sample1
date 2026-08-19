(() => {
  'use strict';

  const REQUIREMENTS_KEY = 'okk_shift_v2_staffing_requirements';
  const LEGACY_BACKUP_KEY = 'okk_shift_v2_staffing_requirements_before_hourly_v1';
  const SKILLS_KEY = 'okk_shift_v2_skill_definitions';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const STORES_KEY = 'okk_shift_v2_config';
  const MODEL = 'skill_fte_hourly_v1';
  const END_HOURS = Array.from({ length: 13 }, (_, i) => 18 + i); // 18 => 17:00-18:00 ... 30 => 29:00-30:00
  const DEFAULT_STORES = [
    { id:'matsuyama', name:'松山店', close:30*60, autoJoin:false, joinTarget:'' },
    { id:'kumoji', name:'久茂地店', close:25*60, autoJoin:true, joinTarget:'matsuyama' },
    { id:'miebashi', name:'美栄橋店', close:25*60, autoJoin:true, joinTarget:'matsuyama' },
    { id:'misato', name:'美里店', close:26*60, autoJoin:false, joinTarget:'' },
  ];

  let matrix = {};
  let currentStoreId = 'matsuyama';
  let patchQueued = false;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 80), { once:true });
  else setTimeout(init, 80);

  function init() {
    migrateRequirementsIfNeeded();
    matrix = buildMatrix(readArray(REQUIREMENTS_KEY));
    installMatrixUi();
    bindMonthPreviewHooks();
    patchSkillLegend();
    window.shiftV2SkillHourlyMatrix = {
      model: MODEL,
      reload: () => { matrix = buildMatrix(readArray(REQUIREMENTS_KEY)); renderMatrix(); },
      contribution: skillContribution,
      weightedShortages: () => calculateWeightedShortages(window.shiftV2HolidayAccounting?.preview?.()),
    };
  }

  function migrateRequirementsIfNeeded() {
    const rows = readArray(REQUIREMENTS_KEY);
    if (!rows.length || isHourlyModel(rows)) return;
    if (!localStorage.getItem(LEGACY_BACKUP_KEY)) localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify(rows));

    const nextMatrix = {};
    const allRows = rows.filter(rule => rule && rule.active !== false && (rule.dayType || 'all') === 'all');
    allRows.forEach(rule => {
      END_HOURS.forEach(endHour => {
        const start = (endHour - 1) * 60;
        const end = endHour * 60;
        if (Number(rule.start) <= start && Number(rule.end) >= end) {
          const key = cellKey(String(rule.storeId || ''), String(rule.skillId || ''), endHour);
          nextMatrix[key] = Math.max(Number(nextMatrix[key] || 0), normalizeNeed(rule.count));
        }
      });
    });
    const converted = matrixToRequirements(nextMatrix);
    localStorage.setItem(REQUIREMENTS_KEY, JSON.stringify(converted));
  }

  function isHourlyModel(rows) {
    const active = rows.filter(rule => rule && rule.active !== false);
    if (!active.length) return false;
    return active.every(rule => {
      const start = Number(rule.start);
      const end = Number(rule.end);
      return end - start === 60 && END_HOURS.includes(end / 60) && Number(rule.minLevel || 1) === 1;
    });
  }

  function buildMatrix(rows) {
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach(rule => {
      if (!rule || rule.active === false) return;
      const start = Number(rule.start);
      const end = Number(rule.end);
      if (end - start !== 60 || !END_HOURS.includes(end / 60)) return;
      const key = cellKey(String(rule.storeId || ''), String(rule.skillId || ''), end / 60);
      out[key] = Math.max(Number(out[key] || 0), normalizeNeed(rule.count));
    });
    return out;
  }

  function matrixToRequirements(source) {
    const rows = [];
    Object.entries(source || {}).forEach(([key, raw]) => {
      const need = normalizeNeed(raw);
      if (need <= 0) return;
      const [storeId, skillId, hourText] = key.split('|');
      const endHour = Number(hourText);
      if (!storeId || !skillId || !END_HOURS.includes(endHour)) return;
      rows.push({
        id:`fte_${storeId}_${skillId}_${endHour}`,
        model:MODEL,
        storeId,
        dayType:'all',
        specificDate:'',
        start:(endHour - 1) * 60,
        end:endHour * 60,
        skillId,
        minLevel:1,
        count:need,
        mode:'hard',
        active:true,
      });
    });
    return rows.sort((a,b) => a.storeId.localeCompare(b.storeId) || a.start - b.start || a.skillId.localeCompare(b.skillId));
  }

  function installMatrixUi() {
    const section = document.getElementById('rs-requirements');
    if (!section) return;
    const stores = loadStores();
    if (!stores.some(store => store.id === currentStoreId)) currentStoreId = stores[0]?.id || 'matsuyama';

    section.innerHTML = `
      <div class="rs-head">
        <div>
          <h3>3. スキル別・時間ごとの必要人数</h3>
          <small>18列は17:00〜18:00、30列は29:00〜30:00です。各セルはその1時間に必要な「人換算」を0.5人単位で設定します。</small>
        </div>
        <div class="hrm-status" id="hrm-save-status">自動保存</div>
      </div>
      <div class="hrm-guide">
        <strong>スタッフLvの人員換算：</strong>
        <span>Lv0 = 0人</span><span>Lv1 = 0.5人</span><span>Lv2 = 1人</span><span>Lv3 = 1人</span>
      </div>
      <div class="hrm-toolbar">
        <label>店舗 <select id="hrm-store" class="control">${stores.map(store => `<option value="${esc(store.id)}" ${store.id === currentStoreId ? 'selected' : ''}>${esc(store.name)}</option>`).join('')}</select></label>
        <span>例：ホール「4」なら、その時間にスキル換算合計4.0人以上を必要とします。</span>
      </div>
      <div class="hrm-table-wrap"><table class="hrm-table"><thead id="hrm-head"></thead><tbody id="hrm-body"></tbody></table></div>
    `;

    injectStyles();
    document.getElementById('hrm-store')?.addEventListener('change', event => {
      currentStoreId = event.target.value;
      renderMatrix();
    });
    renderMatrix();

    document.getElementById('rs-add-skill')?.addEventListener('click', () => setTimeout(() => { patchSkillLegend(); installMatrixUi(); }, 80), true);
    document.getElementById('rs-skill-list')?.addEventListener('change', () => setTimeout(() => { patchSkillLegend(); installMatrixUi(); }, 80), true);
  }

  function renderMatrix() {
    const head = document.getElementById('hrm-head');
    const body = document.getElementById('hrm-body');
    if (!head || !body) return;
    const skills = readArray(SKILLS_KEY).filter(skill => skill && skill.active !== false);
    head.innerHTML = `<tr><th class="hrm-skill">スキル</th>${END_HOURS.map(hour => `<th><b>${hour}</b><small>${hour-1}-${hour}</small></th>`).join('')}</tr>`;
    body.innerHTML = skills.map(skill => {
      const cells = END_HOURS.map(hour => {
        const value = matrix[cellKey(currentStoreId, skill.id, hour)] || 0;
        return `<td><input class="hrm-cell" data-skill="${esc(skill.id)}" data-hour="${hour}" type="number" min="0" max="20" step="0.5" value="${formatNeed(value)}" aria-label="${esc(skill.name)} ${hour-1}-${hour}時 必要人数"></td>`;
      }).join('');
      return `<tr><th class="hrm-skill">${esc(skill.name)}</th>${cells}</tr>`;
    }).join('') || '<tr><td>利用中のスキルがありません。</td></tr>';

    body.querySelectorAll('.hrm-cell').forEach(input => {
      input.addEventListener('change', () => {
        const hour = Number(input.dataset.hour);
        const key = cellKey(currentStoreId, input.dataset.skill, hour);
        const need = normalizeNeed(input.value);
        if (need > 0) matrix[key] = need; else delete matrix[key];
        input.value = formatNeed(need);
        saveMatrix();
      });
    });
  }

  function saveMatrix() {
    const rows = matrixToRequirements(matrix);
    localStorage.setItem(REQUIREMENTS_KEY, JSON.stringify(rows));
    window.shiftV2RulesSafe?.reload?.();
    const status = document.getElementById('hrm-save-status');
    if (status) {
      status.textContent = '保存済み';
      clearTimeout(status._timer);
      status._timer = setTimeout(() => { status.textContent = '自動保存'; }, 1200);
    }
  }

  function patchSkillLegend() {
    const section = document.getElementById('rs-staff');
    if (!section) return;
    const small = section.querySelector('.rs-head small');
    if (small) small.textContent = 'Lv0 未経験 = 0人換算 / Lv1 できる = 0.5人換算 / Lv2 責任をもってできる = 1人 / Lv3 教育できる = 1人';
  }

  function bindMonthPreviewHooks() {
    ['month-builder-open','month-builder-calc'].forEach(id => document.getElementById(id)?.addEventListener('click', queueWeightedPatch));
    ['month-builder-month','month-builder-auto-off','month-builder-soft'].forEach(id => document.getElementById(id)?.addEventListener('change', queueWeightedPatch));
    document.addEventListener('click', event => {
      if (event.target.closest?.('#month-builder-open,#month-builder-calc')) queueWeightedPatch();
    }, true);
  }

  function queueWeightedPatch() {
    if (patchQueued) return;
    patchQueued = true;
    setTimeout(() => {
      patchQueued = false;
      const preview = window.shiftV2HolidayAccounting?.preview?.();
      if (!preview) return;
      const shortages = calculateWeightedShortages(preview);
      preview.shortages = shortages;
      patchMonthlyUi(shortages);
    }, 0);
  }

  function calculateWeightedShortages(preview) {
    if (!preview || !preview.month || !preview.shifts) return [];
    const staff = readArray(STAFF_KEY).map(person => ({ ...person, id:String(person.id || person.employeeNumber || '').toUpperCase() }));
    const stores = loadStores();
    const skills = new Set(readArray(SKILLS_KEY).filter(skill => skill.active !== false).map(skill => skill.id));
    const rules = readArray(REQUIREMENTS_KEY).filter(rule => rule.active !== false && skills.has(rule.skillId));
    const holiday = preview.holiday || { companyClosures:[] };
    const closures = new Set((holiday.companyClosures || []).map(item => item.date));
    const output = [];

    daysInMonth(preview.month).forEach(date => {
      if (closures.has(date)) return;
      rules.forEach(rule => {
        const minimum = weightedMinimum(preview.shifts, staff, stores, date, rule);
        const need = normalizeNeed(rule.count);
        const shortage = roundHalf(Math.max(0, need - minimum));
        if (shortage > 0) output.push({ date, rule, minimum:roundHalf(minimum), shortage });
      });
    });
    return output;
  }

  function weightedMinimum(shifts, staff, stores, date, rule) {
    let minimum = Infinity;
    for (let slotStart = Number(rule.start); slotStart < Number(rule.end); slotStart += 30) {
      const slotEnd = Math.min(Number(rule.end), slotStart + 30);
      let total = 0;
      (Array.isArray(shifts?.[date]) ? shifts[date] : []).forEach(shift => {
        const person = staff.find(row => row.id === String(shift.staffId || '').toUpperCase());
        if (!person) return;
        const contribution = skillContribution(person.skillLevels?.[rule.skillId]);
        if (contribution <= 0) return;
        const covered = deriveSegments(shift, stores).some(segment => segment.storeId === rule.storeId && segment.start <= slotStart && segment.end >= slotEnd);
        if (covered) total += contribution;
      });
      minimum = Math.min(minimum, total);
    }
    return Number.isFinite(minimum) ? minimum : 0;
  }

  function skillContribution(level) {
    const lv = Math.max(0, Math.min(3, Math.round(Number(level) || 0)));
    if (lv === 1) return 0.5;
    if (lv >= 2) return 1;
    return 0;
  }

  function patchMonthlyUi(shortages) {
    const summary = document.getElementById('month-builder-summary');
    const metrics = summary?.querySelectorAll('.month-metric');
    const last = metrics?.[metrics.length - 1];
    if (last) {
      const value = last.querySelector('strong');
      const sub = last.querySelector('span');
      if (value) value.textContent = `${shortages.length}件`;
      if (sub) sub.textContent = 'スキル換算で判定';
    }

    const wrap = document.querySelector('#month-builder-body .month-shortages');
    if (!wrap) return;
    const stores = loadStores();
    const skills = readArray(SKILLS_KEY);
    wrap.innerHTML = shortages.slice(0,120).map(item => {
      const store = stores.find(row => row.id === item.rule.storeId);
      const skill = skills.find(row => row.id === item.rule.skillId);
      return `<div class="month-shortage hard"><b>${esc(item.date)} ${esc(store?.name || item.rule.storeId)}</b><span>${fmtTime(item.rule.start)}-${fmtTime(item.rule.end)} ${esc(skill?.name || item.rule.skillId)}：${formatNeed(item.minimum)} / ${formatNeed(item.rule.count)}人換算（不足${formatNeed(item.shortage)}）</span></div>`;
    }).join('') || '<div class="month-all-clear"><i class="fa-solid fa-circle-check"></i> スキル換算でも必要人数を満たしています。</div>';
    const section = wrap.closest('.month-builder-section');
    const title = section?.querySelector('h3');
    if (title) title.textContent = '配置後も残る不足（スキル換算）';
  }

  function deriveSegments(shift, stores) {
    const store = stores.find(item => item.id === shift.startStoreId);
    const start = Number(shift.start);
    const end = Number(shift.end);
    if (!store) return [{ storeId:shift.startStoreId, start, end }];
    if (store.autoJoin && store.joinTarget && end > Number(store.close)) {
      if (start >= Number(store.close)) return [{ storeId:store.joinTarget, start, end }];
      return [{ storeId:store.id, start, end:Number(store.close) }, { storeId:store.joinTarget, start:Number(store.close), end }];
    }
    return [{ storeId:store.id, start, end }];
  }

  function loadStores() {
    const value = readJson(STORES_KEY, DEFAULT_STORES);
    return Array.isArray(value) && value.length ? value : DEFAULT_STORES;
  }

  function daysInMonth(month) {
    const [year, mon] = String(month).split('-').map(Number);
    const last = new Date(year, mon, 0).getDate();
    return Array.from({ length:last }, (_, i) => `${year}-${String(mon).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`);
  }

  function cellKey(storeId, skillId, endHour) { return `${storeId}|${skillId}|${endHour}`; }
  function normalizeNeed(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(20, roundHalf(n))) : 0; }
  function roundHalf(value) { return Math.round((Number(value) || 0) * 2) / 2; }
  function formatNeed(value) { const n = roundHalf(value); return Number.isInteger(n) ? String(n) : n.toFixed(1); }
  function fmtTime(total) { const v=Number(total),next=v>=1440,h=Math.floor(v/60)%24,m=v%60; return `${next?'翌':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }
  function readArray(key) { const value=readJson(key,[]); return Array.isArray(value)?value:[]; }
  function readJson(key,fallback) { try { const value=JSON.parse(localStorage.getItem(key)); return value ?? JSON.parse(JSON.stringify(fallback)); } catch { return JSON.parse(JSON.stringify(fallback)); } }
  function esc(value) { return String(value??'').replace(/[&<>\"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char])); }

  function injectStyles() {
    if (document.getElementById('hrm-style')) return;
    const style = document.createElement('style');
    style.id = 'hrm-style';
    style.textContent = `
      .hrm-guide{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0 12px;padding:10px 12px;border:1px solid #d0d5dd;border-radius:10px;background:#f9fafb;font-size:12px}.hrm-guide span{padding:4px 8px;border-radius:999px;background:#fff;border:1px solid #e4e7ec;font-weight:700}.hrm-toolbar{display:flex;align-items:center;gap:16px;margin-bottom:12px;font-size:12px;color:#667085}.hrm-toolbar label{display:flex;align-items:center;gap:8px;font-weight:800;color:#344054}.hrm-table-wrap{overflow:auto;border:1px solid #e4e7ec;border-radius:12px;max-width:100%}.hrm-table{border-collapse:separate;border-spacing:0;min-width:1180px;width:100%;background:#fff}.hrm-table th,.hrm-table td{border-right:1px solid #eaecf0;border-bottom:1px solid #eaecf0;padding:6px;text-align:center}.hrm-table thead th{position:sticky;top:0;z-index:2;background:#f9fafb;font-size:11px;color:#475467}.hrm-table thead th small{display:block;font-size:9px;font-weight:500;color:#98a2b3}.hrm-table .hrm-skill{position:sticky;left:0;z-index:3;min-width:112px;text-align:left;background:#fff;font-size:12px}.hrm-table thead .hrm-skill{background:#f9fafb;z-index:4}.hrm-cell{width:56px;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:8px;padding:7px 4px;text-align:center;font-weight:800;color:#101828;background:#fff}.hrm-cell:focus{outline:2px solid rgba(18,183,106,.22);border-color:#12b76a}.hrm-status{font-size:11px;font-weight:800;color:#027a48;background:#ecfdf3;border:1px solid #abefc6;border-radius:999px;padding:5px 9px}
    `;
    document.head.appendChild(style);
  }
})();
