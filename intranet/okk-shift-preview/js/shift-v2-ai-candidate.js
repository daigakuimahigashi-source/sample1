import { SKILL_DEFINITIONS } from '../data/shift-platform-config.js';

const STORAGE_REQUIREMENTS = 'okk_shift_v2_staffing_requirements';
const STORAGE_STAFF = 'okk_shift_v2_staff';
const STORAGE_SHIFTS = 'okk_shift_v2_shifts';
const STORAGE_STORES = 'okk_shift_v2_config';
const STORAGE_EXCEPTIONS = 'okk_shift_v2_exceptions';
const SLOT = 30;
const DAY_START = 15 * 60;
const DAY_END = 30 * 60;
const DEFAULT_DAILY_MAX = 8 * 60;
const DEFAULT_WEEKLY_MAX = 40 * 60;

let currentPlan = null;
let includeRecommended = false;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();

document.addEventListener('shiftv2-access', applyAccess);

actionSafeObserver();

function init() {
  injectUi();
  bind();
  applyAccess();
}

function injectUi() {
  const toolbar = document.querySelector('#view-planner .toolbar-left');
  if (toolbar && !document.getElementById('ai-candidate-open')) {
    const group = document.createElement('div');
    group.className = 'ai-candidate-toolbar';
    group.innerHTML = '<button id="ai-candidate-open" class="btn btn-green"><i class="fa-solid fa-wand-magic-sparkles"></i> AIシフト候補</button><span class="ai-candidate-caption">条件を満たす候補を別レイヤーで作成</span>';
    toolbar.appendChild(group);
  }

  if (!document.getElementById('ai-candidate-modal')) {
    const modal = document.createElement('div');
    modal.id = 'ai-candidate-modal';
    modal.className = 'ai-modal-bg';
    modal.innerHTML = `
      <div class="ai-modal" role="dialog" aria-modal="true">
        <div class="ai-modal-head">
          <div><small>AI SHIFT CANDIDATE</small><h2>AIシフト候補</h2><span id="ai-candidate-date"></span></div>
          <button id="ai-candidate-close" class="btn btn-light btn-small"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="ai-modal-body">
          <div class="ai-assumption">
            <i class="fa-solid fa-circle-info"></i>
            <div><strong>候補は確定シフトへ直接書き込みません。</strong><span>既存シフトは固定し、人員・スキル条件と従業員マスタを読んで候補だけ作成します。</span></div>
          </div>
          <label class="ai-option"><input id="ai-include-recommended" type="checkbox"> 推奨条件も候補生成の対象にする</label>
          <div id="ai-candidate-summary" class="ai-summary"></div>
          <div id="ai-candidate-body"></div>
        </div>
        <div class="ai-modal-foot">
          <button id="ai-candidate-recalc" class="btn btn-light"><i class="fa-solid fa-rotate"></i> 再計算</button>
          <button id="ai-candidate-apply" class="btn btn-green"><i class="fa-solid fa-check"></i> 候補を予定シフトへ反映</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  injectStyles();
}

function bind() {
  document.getElementById('ai-candidate-open')?.addEventListener('click', openModal);
  document.getElementById('ai-candidate-close')?.addEventListener('click', closeModal);
  document.getElementById('ai-candidate-modal')?.addEventListener('click', event => {
    if (event.target.id === 'ai-candidate-modal') closeModal();
  });
  document.getElementById('ai-candidate-recalc')?.addEventListener('click', calculateAndRender);
  document.getElementById('ai-include-recommended')?.addEventListener('change', event => {
    includeRecommended = event.target.checked;
    calculateAndRender();
  });
  document.getElementById('ai-candidate-apply')?.addEventListener('click', applyPlan);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
}

function openModal() {
  if (!canEditPlan()) return notify('AIシフト候補の反映は本部のみです');
  const date = selectedDate();
  document.getElementById('ai-candidate-date').textContent = formatDateJa(date);
  document.getElementById('ai-candidate-modal')?.classList.add('open');
  calculateAndRender();
}

function closeModal() {
  document.getElementById('ai-candidate-modal')?.classList.remove('open');
}

function calculateAndRender() {
  currentPlan = buildPlan(selectedDate(), includeRecommended);
  renderPlan();
}

function buildPlan(date, includeSoft) {
  const stores = allStores();
  const staff = normalizeStaff(allStaff());
  const allShifts = load(STORAGE_SHIFTS, {});
  const existing = Array.isArray(allShifts[date]) ? clone(allShifts[date]) : [];
  const working = existing.map(shift => ({...shift, staffId:canon(shift.staffId)}));
  const proposals = [];
  const notes = [];
  const rules = applicableRules(date).filter(rule => includeSoft || rule.mode === 'hard');

  const excludedIds = new Set(working.map(shift => shift.staffId));
  const fixedAbsences = new Set(dayExceptions(date).filter(row=>row.type==='absence').map(row=>canon(row.staffId)));
  fixedAbsences.forEach(id => excludedIds.add(id));

  const ruleSlots = expandRulesToSlots(rules);
  const orderedSlots = ruleSlots.sort((a,b) => {
    if (a.mode !== b.mode) return a.mode === 'hard' ? -1 : 1;
    if (b.minLevel !== a.minLevel) return b.minLevel - a.minLevel;
    return a.start - b.start;
  });

  orderedSlots.forEach(slotRule => {
    let guard = 0;
    while (coverageCount(slotRule, working, staff) < slotRule.count && guard < 20) {
      guard += 1;
      const candidate = chooseCandidate({date, slotRule, staff, working, proposals, excludedIds});
      if (!candidate) break;
      addOrExtendProposal({date, slotRule, candidate, working, proposals});
    }
  });

  const shortages = orderedSlots.filter(slotRule => coverageCount(slotRule, working, staff) < slotRule.count)
    .map(slotRule => ({...slotRule, filled:coverageCount(slotRule, working, staff), shortage:slotRule.count-coverageCount(slotRule, working, staff)}));

  if (!staff.some(person => person.workConstraints)) notes.push('勤務可能曜日・時間が未設定の従業員は、制約なしとして候補対象にしています。');
  if (!rules.length) notes.push('選択日に適用される人員・スキル条件がありません。');

  return {date, proposals, shortages, rules, notes, stores, staff};
}

function chooseCandidate(context) {
  const {date, slotRule, staff, working, proposals, excludedIds} = context;
  const candidates = staff.filter(person => {
    if (!person.id || person.active === false || person.autoAssign === false) return false;
    if (fixedExistingOrProposal(person.id, working, proposals, slotRule.storeId)) return false;
    if (excludedIds.has(person.id) && !proposals.some(p=>p.staffId===person.id)) return false;
    if (skillLevel(person, slotRule.skillId) < slotRule.minLevel) return false;
    if (!storeAllowed(person, slotRule.storeId)) return false;
    if (!availableOn(person, date, slotRule.start, slotRule.end)) return false;
    if (!withinLimits(person, date, slotRule.start, slotRule.end, working, proposals)) return false;
    return true;
  });

  candidates.sort((a,b) => scoreCandidate(b,slotRule,date,working,proposals) - scoreCandidate(a,slotRule,date,working,proposals) || a.name.localeCompare(b.name,'ja'));
  return candidates[0] || null;
}

function fixedExistingOrProposal(staffId, working, proposals, storeId) {
  const existing = working.find(shift => shift.staffId === staffId && !shift.aiCandidate);
  if (existing) return true;
  const ownProposal = proposals.find(shift => shift.staffId === staffId);
  return ownProposal ? ownProposal.startStoreId !== storeId : false;
}

function addOrExtendProposal({slotRule,candidate,working,proposals}) {
  let proposal = proposals.find(item => item.staffId === candidate.id && item.startStoreId === slotRule.storeId);
  if (!proposal) {
    const window = initialWindow(candidate, slotRule);
    proposal = {
      id:`ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,
      staffId:candidate.id,
      startStoreId:slotRule.storeId,
      start:window.start,
      end:window.end,
      memo:'AI候補',
      aiCandidate:true,
      aiReasons:[],
    };
    proposals.push(proposal);
    working.push(proposal);
  } else {
    proposal.start = Math.max(DAY_START, Math.min(proposal.start, slotRule.start));
    proposal.end = Math.min(DAY_END, Math.max(proposal.end, slotRule.end));
    if (proposal.end - proposal.start > DEFAULT_DAILY_MAX) {
      if (slotRule.end > proposal.end) proposal.start = proposal.end - DEFAULT_DAILY_MAX;
      else proposal.end = proposal.start + DEFAULT_DAILY_MAX;
    }
  }
  const reason = `${skillName(slotRule.skillId)} Lv${slotRule.minLevel} ${fmt(slotRule.start)}-${fmt(slotRule.end)}`;
  if (!proposal.aiReasons.includes(reason)) proposal.aiReasons.push(reason);
  proposal.memo = `AI候補: ${proposal.aiReasons.slice(0,4).join(' / ')}`;
}

function initialWindow(person, slotRule) {
  const employment = person.employmentType || (person.salaryType==='monthly'?'正社員':'アルバイト');
  const target = employment === '正社員' ? 8*60 : 5*60;
  let start = slotRule.start;
  let end = Math.min(DAY_END, Math.max(slotRule.end, start + target));
  const c = person.workConstraints || {};
  if (Number.isFinite(Number(c.availableStart))) start = Math.max(start, Number(c.availableStart));
  if (Number.isFinite(Number(c.availableEnd))) end = Math.min(end, Number(c.availableEnd));
  if (end <= start) end = Math.min(DAY_END,start+SLOT);
  return {start:snap(start),end:snap(end)};
}

function coverageCount(slotRule, working, staff) {
  const eligible = working.filter(shift => shift.startStoreId === slotRule.storeId && Number(shift.start) <= slotRule.start && Number(shift.end) >= slotRule.end)
    .map(shift => staff.find(person => person.id === canon(shift.staffId)))
    .filter(Boolean)
    .filter(person => skillLevel(person, slotRule.skillId) >= slotRule.minLevel);
  return new Set(eligible.map(person=>person.id)).size;
}

function expandRulesToSlots(rules) {
  const result = [];
  rules.forEach(rule => {
    for (let start=Number(rule.start); start<Number(rule.end); start+=SLOT) {
      result.push({...rule,start,end:Math.min(Number(rule.end),start+SLOT)});
    }
  });
  return result;
}

function applicableRules(date) {
  return allRequirements().filter(rule => rule.active !== false && matchesDate(rule,date));
}

function matchesDate(rule,date) {
  if (rule.dayType==='specific') return rule.specificDate===date;
  if (rule.dayType==='all') return true;
  const day = new Date(`${date}T00:00:00`).getDay();
  if (rule.dayType==='mon_thu') return day>=1 && day<=4;
  if (rule.dayType==='fri_sat') return day===5 || day===6;
  if (rule.dayType==='sun') return day===0;
  return true;
}

function availableOn(person,date,start,end) {
  const c = person.workConstraints || {};
  const day = String(new Date(`${date}T00:00:00`).getDay());
  if (Array.isArray(c.availableDays) && c.availableDays.length && !c.availableDays.includes(day)) return false;
  if (Array.isArray(c.fixedOffDays) && c.fixedOffDays.includes(day)) return false;
  if (Number.isFinite(Number(c.availableStart)) && start < Number(c.availableStart)) return false;
  if (Number.isFinite(Number(c.availableEnd)) && end > Number(c.availableEnd)) return false;
  return true;
}

function withinLimits(person,date,start,end,working,proposals) {
  const dailyMax = Number(person.maxDailyMinutes || person.workConstraints?.maxDailyMinutes || DEFAULT_DAILY_MAX);
  const weeklyMax = Number(person.maxWeeklyMinutes || person.workConstraints?.maxWeeklyMinutes || DEFAULT_WEEKLY_MAX);
  const own = proposals.find(p=>p.staffId===person.id);
  const prospective = own ? Math.max(own.end,end)-Math.min(own.start,start) : end-start;
  if (prospective > dailyMax) return false;
  const range = weekRange(date);
  const shifts = load(STORAGE_SHIFTS, {});
  let weekly = 0;
  Object.entries(shifts).forEach(([d,rows]) => {
    if (d<range.start || d>range.end || d===date || !Array.isArray(rows)) return;
    rows.forEach(shift => { if (canon(shift.staffId)===person.id) weekly += Math.max(0,Number(shift.end)-Number(shift.start)); });
  });
  return weekly + prospective <= weeklyMax;
}

function storeAllowed(person,storeId) {
  const allowed = Array.isArray(person.placementStoreIds) && person.placementStoreIds.length ? person.placementStoreIds : Array.isArray(person.affiliationStoreIds) ? person.affiliationStoreIds : [];
  return !allowed.length || allowed.includes(storeId);
}

function scoreCandidate(person,slotRule,date,working,proposals) {
  let score = skillLevel(person,slotRule.skillId)*120;
  if (person.managerQualified) score += 10;
  if (person.mainStoreId===slotRule.storeId) score += 35;
  if ((person.affiliationStoreIds||[]).includes(slotRule.storeId)) score += 20;
  const currentProposal = proposals.find(p=>p.staffId===person.id);
  if (currentProposal && currentProposal.startStoreId===slotRule.storeId) score += 70;
  const employment = person.employmentType || (person.salaryType==='monthly'?'正社員':'アルバイト');
  if (employment==='正社員') score += 12;
  const c = person.workConstraints || {};
  if (Number.isFinite(Number(c.preferredDaysPerWeek))) {
    const days = workedDaysInWeek(person.id,date,working);
    if (days < Number(c.preferredDaysPerWeek)) score += 15;
  }
  return score;
}

function workedDaysInWeek(staffId,date,workingToday) {
  const range=weekRange(date); const shifts=load(STORAGE_SHIFTS,{}); const dates=new Set();
  Object.entries(shifts).forEach(([d,rows])=>{if(d<range.start||d>range.end||!Array.isArray(rows))return;if(rows.some(s=>canon(s.staffId)===staffId))dates.add(d);});
  if (workingToday.some(s=>canon(s.staffId)===staffId)) dates.add(date);
  return dates.size;
}

function renderPlan() {
  const summary=document.getElementById('ai-candidate-summary');
  const body=document.getElementById('ai-candidate-body');
  const apply=document.getElementById('ai-candidate-apply');
  if(!summary||!body||!currentPlan)return;
  const hard=currentPlan.shortages.filter(s=>s.mode==='hard').reduce((sum,s)=>sum+s.shortage,0);
  const recommended=currentPlan.shortages.filter(s=>s.mode!=='hard').reduce((sum,s)=>sum+s.shortage,0);
  summary.innerHTML=`<div><small>候補</small><strong>${currentPlan.proposals.length}名</strong></div><div><small>必須残不足</small><strong>${hard}</strong></div><div><small>推奨残不足</small><strong>${recommended}</strong></div>`;

  const proposalHtml=currentPlan.proposals.map(p=>{
    const person=currentPlan.staff.find(s=>s.id===p.staffId); const store=currentPlan.stores.find(s=>s.id===p.startStoreId);
    return `<div class="ai-proposal"><div><strong>${esc(person?.name||p.staffId)}</strong><span>${esc(store?.name||p.startStoreId)} ・ ${fmt(p.start)}-${fmt(p.end)}</span></div><div class="ai-reasons">${p.aiReasons.map(r=>`<span>${esc(r)}</span>`).join('')}</div></div>`;
  }).join('');
  const shortageHtml=currentPlan.shortages.slice(0,40).map(s=>`<div class="ai-shortage ${s.mode==='hard'?'hard':'recommended'}"><strong>${esc(storeName(s.storeId))} ${fmt(s.start)}-${fmt(s.end)}</strong><span>${esc(skillName(s.skillId))} Lv${s.minLevel} ${s.filled}/${s.count}</span></div>`).join('');
  body.innerHTML=`${currentPlan.notes.length?`<div class="ai-notes">${currentPlan.notes.map(n=>`<div>${esc(n)}</div>`).join('')}</div>`:''}<section class="ai-section"><h3>候補シフト</h3>${proposalHtml||'<div class="empty">追加候補はありません。</div>'}</section><section class="ai-section"><h3>候補生成後も残る不足</h3>${shortageHtml||'<div class="ai-clear"><i class="fa-solid fa-circle-check"></i> 対象条件を満たせる候補です。</div>'}</section>`;
  if(apply) apply.disabled=currentPlan.proposals.length===0;
}

function applyPlan() {
  if (!canEditPlan()) return notify('予定シフトへの反映は本部のみです');
  if (!currentPlan?.proposals?.length) return;
  const shifts=load(STORAGE_SHIFTS,{});
  if(!Array.isArray(shifts[currentPlan.date]))shifts[currentPlan.date]=[];
  const existing=new Set(shifts[currentPlan.date].map(s=>canon(s.staffId)));
  const additions=currentPlan.proposals.filter(p=>!existing.has(p.staffId)).map(p=>({...clone(p),aiCandidate:false,source:'ai_candidate',updatedAt:new Date().toISOString()}));
  shifts[currentPlan.date].push(...additions);
  localStorage.setItem(STORAGE_SHIFTS,JSON.stringify(shifts));
  closeModal();
  notify(`AI候補 ${additions.length}名を予定シフトへ反映しました`);
  setTimeout(()=>window.location.reload(),350);
}

function applyAccess() {
  const button=document.getElementById('ai-candidate-open');
  if(button) button.style.display=canEditPlan()?'':'none';
}

function canEditPlan(){return Boolean(window.shiftV2Access?.can?.('shift.plan.edit'));}
function selectedDate(){return document.getElementById('work-date')?.value||today();}
function allRequirements(){return load(STORAGE_REQUIREMENTS,[]);}
function allStaff(){return load(STORAGE_STAFF,[]);}
function allStores(){return load(STORAGE_STORES,[]);}
function dayExceptions(date){const all=load(STORAGE_EXCEPTIONS,{});return Array.isArray(all[date])?all[date]:[];}
function normalizeStaff(rows){return (Array.isArray(rows)?rows:[]).map(p=>({...p,id:canon(p.id||p.employeeNumber),name:p.name||`${p.lastName||''} ${p.firstName||''}`.trim(),active:p.active!==false})).filter(p=>p.id);}
function skillLevel(person,id){const n=Number(person?.skillLevels?.[id]);if(Number.isFinite(n))return Math.max(0,Math.min(3,n));const def=SKILL_DEFINITIONS.find(s=>s.id===id);return def?.legacyNames?.some(name=>(person.skills||[]).includes(name))?1:0;}
function skillName(id){return SKILL_DEFINITIONS.find(s=>s.id===id)?.name||id;}
function storeName(id){return allStores().find(s=>s.id===id)?.name||id;}
function weekRange(date){const d=new Date(`${date}T00:00:00`);const day=d.getDay();const offset=day===0?-6:1-day;const mon=new Date(d);mon.setDate(d.getDate()+offset);const sun=new Date(mon);sun.setDate(mon.getDate()+6);return{start:dateKey(mon),end:dateKey(sun)};}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function formatDateJa(date){const d=new Date(`${date}T00:00:00`);return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（${['日','月','火','水','木','金','土'][d.getDay()]}）`;}
function today(){return dateKey(new Date());}
function fmt(total){const h=Math.floor(Number(total)/60)%24,m=Number(total)%60;return `${total>=1440?'翌 ':''}${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
function snap(v){return Math.round(v/SLOT)*SLOT;}
function canon(v){return String(v||'').toUpperCase();}
function load(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??clone(fallback);}catch{return clone(fallback);}}
function clone(v){return JSON.parse(JSON.stringify(v));}
function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function notify(message){const t=document.getElementById('toast');if(!t)return; t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);}
function actionSafeObserver(){document.addEventListener('shiftv2-requirements-changed',()=>{if(document.getElementById('ai-candidate-modal')?.classList.contains('open'))calculateAndRender();});}

function injectStyles(){
  if(document.getElementById('ai-candidate-style'))return;
  const style=document.createElement('style');style.id='ai-candidate-style';style.textContent=`
  .ai-candidate-toolbar{display:flex;align-items:center;gap:6px;margin-left:5px}.ai-candidate-caption{font-size:8px;color:#667085}.ai-modal-bg{display:none;position:fixed;inset:0;background:rgba(15,23,42,.68);z-index:300;align-items:center;justify-content:center;padding:18px}.ai-modal-bg.open{display:flex}.ai-modal{width:min(900px,100%);max-height:90vh;background:#fff;border-radius:14px;display:flex;flex-direction:column;overflow:hidden}.ai-modal-head,.ai-modal-foot{padding:12px 15px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e4e7ec}.ai-modal-head h2{margin:2px 0;font-size:17px}.ai-modal-head small{font-size:8px;color:#7c3aed;font-weight:900}.ai-modal-head span{font-size:9px;color:#667085}.ai-modal-body{padding:14px;overflow:auto}.ai-modal-foot{border-bottom:0;border-top:1px solid #e4e7ec;justify-content:flex-end;gap:7px}.ai-assumption{display:flex;gap:9px;padding:10px;border:1px solid #d6bbfb;background:#f9f5ff;border-radius:10px;color:#53389e;font-size:9px}.ai-assumption strong,.ai-assumption span{display:block}.ai-assumption span{font-weight:500;margin-top:2px}.ai-option{display:flex;align-items:center;gap:6px;margin:10px 0;font-size:9px;font-weight:800}.ai-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.ai-summary>div{border:1px solid #e4e7ec;border-radius:9px;padding:9px;background:#fcfcfd}.ai-summary small{display:block;font-size:8px;color:#667085}.ai-summary strong{font-size:18px}.ai-section{margin-top:12px}.ai-section h3{font-size:11px;margin:0 0 7px}.ai-proposal{border:1px solid #e4e7ec;border-radius:9px;padding:9px;margin-bottom:6px;display:grid;grid-template-columns:210px 1fr;gap:8px}.ai-proposal strong,.ai-proposal span{display:block}.ai-proposal strong{font-size:10px}.ai-proposal>div:first-child span{font-size:8px;color:#667085}.ai-reasons{display:flex;gap:4px;flex-wrap:wrap}.ai-reasons span{font-size:7px;font-weight:800;background:#eef4ff;color:#3538cd;border-radius:999px;padding:3px 5px}.ai-shortage{border-left:4px solid #f79009;background:#fffaeb;padding:7px 9px;margin-bottom:5px;border-radius:6px;display:flex;justify-content:space-between;font-size:8px}.ai-shortage.hard{border-left-color:#d92d20;background:#fef3f2;color:#b42318}.ai-clear{padding:12px;border-radius:9px;background:#ecfdf3;color:#027a48;font-size:9px;font-weight:900}.ai-notes{background:#f2f4f7;color:#475467;border-radius:8px;padding:8px;font-size:8px}.ai-notes div+div{margin-top:3px}@media(max-width:700px){.ai-candidate-caption{display:none}.ai-summary{grid-template-columns:1fr}.ai-proposal{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}
