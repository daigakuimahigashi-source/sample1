import { SKILL_DEFINITIONS } from '../data/shift-platform-config.js';

const STAFF_KEY='okk_shift_v2_staff';
const SHIFTS_KEY='okk_shift_v2_shifts';
const STORES_KEY='okk_shift_v2_config';
const REQUIREMENTS_KEY='okk_shift_v2_staffing_requirements';
const HOLIDAY_KEY='okk_shift_v2_holidays';
const SLOT=30, DAY_START=900, DAY_END=1800, DAILY_MAX=480, WEEKLY_MAX=2400;
let current=null;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
document.addEventListener('shiftv2-access',applyAccess);

function init(){injectUi();bind();applyAccess();}

function injectUi(){
  const modal=document.getElementById('ai-candidate-modal');
  const body=modal?.querySelector('.ai-modal-body');
  if(!body||document.getElementById('ai-month-panel'))return;
  const panel=document.createElement('section');
  panel.id='ai-month-panel';
  panel.innerHTML=`
    <div class="aim-divider"><span>MONTHLY</span></div>
    <div class="aim-head"><div><strong>月間AIシフト候補</strong><small>月全体の休日・勤務可能条件・週上限・スキル不足を見ながら候補を作成</small></div><div class="aim-controls"><input id="ai-month" class="control" type="month"><button id="ai-month-calc" class="btn btn-light"><i class="fa-solid fa-calendar-check"></i> 月間候補を計算</button></div></div>
    <label class="ai-option"><input id="ai-month-soft" type="checkbox"> 推奨条件も月間候補の対象にする</label>
    <div id="ai-month-summary" class="aim-summary"></div>
    <div id="ai-month-body" class="aim-body"><div class="aim-empty">月を選んで「月間候補を計算」を押してください。</div></div>
    <div class="aim-foot"><button id="ai-month-apply" class="btn btn-green" disabled><i class="fa-solid fa-check-double"></i> 月間候補を一括反映</button></div>`;
  body.appendChild(panel);
  const style=document.createElement('style');style.textContent=`
    #ai-month-panel{margin-top:16px}.aim-divider{display:flex;align-items:center;gap:8px;margin:4px 0 10px;color:#667085;font-size:8px;font-weight:900}.aim-divider:before,.aim-divider:after{content:"";height:1px;background:#eaecf0;flex:1}.aim-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.aim-head strong{font-size:11px}.aim-head small{display:block;font-size:8px;color:#667085;margin-top:2px}.aim-controls{display:flex;gap:6px;align-items:center}.aim-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:9px 0}.aim-metric{border:1px solid #eaecf0;border-radius:8px;padding:8px;background:#fcfcfd}.aim-metric small{display:block;font-size:7px;color:#667085}.aim-metric strong{font-size:15px}.aim-body{border:1px solid #eaecf0;border-radius:9px;max-height:330px;overflow:auto}.aim-day{display:grid;grid-template-columns:90px 70px 1fr;gap:7px;padding:7px 9px;border-bottom:1px solid #f2f4f7;align-items:center}.aim-day-date{font-size:8px;font-weight:900}.aim-day-count{font-size:8px}.aim-day-count.bad{color:#b42318;font-weight:900}.aim-day-items{display:flex;gap:4px;flex-wrap:wrap}.aim-chip{font-size:7px;padding:2px 5px;border-radius:999px;background:#eef4ff;color:#3538cd;font-weight:800}.aim-person{display:grid;grid-template-columns:1fr 75px 75px;gap:6px;padding:6px 9px;border-bottom:1px solid #f2f4f7;font-size:8px}.aim-person strong{font-size:8px}.aim-empty{padding:20px;text-align:center;color:#98a2b3;font-size:9px}.aim-note{padding:8px 9px;background:#fffaeb;color:#b54708;font-size:8px;line-height:1.5}.aim-foot{display:flex;justify-content:flex-end;margin-top:8px}@media(max-width:760px){.aim-head{align-items:flex-start;flex-direction:column}.aim-summary{grid-template-columns:1fr 1fr}.aim-day{grid-template-columns:80px 60px 1fr}}`;
  document.head.appendChild(style);
  const month=document.getElementById('work-date')?.value?.slice(0,7)||monthKey(new Date());
  document.getElementById('ai-month').value=month;
}

function bind(){
  document.getElementById('ai-month-calc')?.addEventListener('click',calculate);
  document.getElementById('ai-month-soft')?.addEventListener('change',calculate);
  document.getElementById('ai-month-apply')?.addEventListener('click',applyMonth);
}

function calculate(){
  if(!canEdit())return notify('月間AIシフト候補は本部のみです');
  const month=document.getElementById('ai-month')?.value||monthKey(new Date());
  const includeSoft=Boolean(document.getElementById('ai-month-soft')?.checked);
  current=buildMonth(month,includeSoft);render();
}

function buildMonth(month,includeSoft){
  const staff=normalizeStaff(load(STAFF_KEY,[]));
  const stores=load(STORES_KEY,[]);
  const requirements=load(REQUIREMENTS_KEY,[]);
  const holidays=normalizeHoliday(load(HOLIDAY_KEY,{}));
  const original=load(SHIFTS_KEY,{});
  const working=clone(original);
  const proposals=[];
  const days=daysInMonth(month);
  const notes=[];

  for(const date of days){
    if(isCompanyClosure(holidays,date))continue;
    if(!Array.isArray(working[date]))working[date]=[];
    const rules=applicableRules(requirements,date).filter(r=>includeSoft||r.mode==='hard');
    const slotRules=expandRules(rules).sort((a,b)=>(a.mode==='hard'?0:1)-(b.mode==='hard'?0:1)||b.minLevel-a.minLevel||a.start-b.start);
    for(const sr of slotRules){
      let guard=0;
      while(coverageCount(sr,working[date],staff)<sr.count&&guard++<20){
        const candidate=chooseCandidate({date,sr,staff,working,proposals,holidays,month});
        if(!candidate)break;
        addProposal({date,sr,candidate,working,proposals});
      }
    }
  }

  const shortages=[];
  for(const date of days){
    if(isCompanyClosure(holidays,date))continue;
    const rules=applicableRules(requirements,date).filter(r=>includeSoft||r.mode==='hard');
    for(const sr of expandRules(rules)){
      const filled=coverageCount(sr,working[date]||[],staff);
      if(filled<sr.count)shortages.push({...sr,date,filled,shortage:sr.count-filled});
    }
  }

  const people=staff.map(person=>{
    const monthRows=[];
    for(const date of days)(working[date]||[]).forEach(s=>{if(canon(s.staffId)===person.id)monthRows.push({date,...s});});
    const minutes=monthRows.reduce((sum,s)=>sum+Math.max(0,Number(s.end)-Number(s.start)),0);
    const generated=monthRows.filter(s=>s.aiMonthCandidate).length;
    return {id:person.id,name:person.name,minutes,days:new Set(monthRows.map(s=>s.date)).size,generated};
  }).filter(p=>p.minutes||p.generated);

  if(!staff.length)notes.push('従業員マスタがありません。');
  if(!requirements.length)notes.push('人員・スキル条件がありません。');
  return {month,proposals,shortages,people,notes,stores};
}

function chooseCandidate({date,sr,staff,working,proposals,holidays,month}){
  const existingIds=new Set((working[date]||[]).filter(s=>!s.aiMonthCandidate).map(s=>canon(s.staffId)));
  const candidates=staff.filter(p=>{
    if(!p.id||p.active===false||p.autoAssign===false)return false;
    if(existingIds.has(p.id))return false;
    const own=(working[date]||[]).find(s=>canon(s.staffId)===p.id&&s.aiMonthCandidate);
    if(own&&own.startStoreId!==sr.storeId)return false;
    if(skillLevel(p,sr.skillId)<sr.minLevel)return false;
    if(!storeAllowed(p,sr.storeId))return false;
    if(isUnavailable(holidays,p.id,date))return false;
    if(!availableOn(p,date,sr.start,sr.end))return false;
    if(!withinLimits(p,date,sr,working,month))return false;
    return true;
  });
  candidates.sort((a,b)=>score(b,date,sr,working,month)-score(a,date,sr,working,month)||a.name.localeCompare(b.name,'ja'));
  return candidates[0]||null;
}

function addProposal({date,sr,candidate,working,proposals}){
  let row=(working[date]||[]).find(s=>canon(s.staffId)===candidate.id&&s.aiMonthCandidate&&s.startStoreId===sr.storeId);
  if(!row){
    const w=initialWindow(candidate,sr);
    row={id:`aim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,staffId:candidate.id,startStoreId:sr.storeId,start:w.start,end:w.end,memo:'月間AI候補',aiMonthCandidate:true,aiCandidate:true,aiReasons:[]};
    working[date].push(row);proposals.push({date,...row});
  }else{
    row.start=Math.max(DAY_START,Math.min(row.start,sr.start));row.end=Math.min(DAY_END,Math.max(row.end,sr.end));
    if(row.end-row.start>DAILY_MAX)row.end=row.start+DAILY_MAX;
    const p=proposals.find(x=>x.id===row.id);if(p){p.start=row.start;p.end=row.end;}
  }
  const reason=`${skillName(sr.skillId)} Lv${sr.minLevel} ${fmt(sr.start)}-${fmt(sr.end)}`;
  if(!row.aiReasons.includes(reason))row.aiReasons.push(reason);
  row.memo=`月間AI候補: ${row.aiReasons.slice(0,4).join(' / ')}`;
  const p=proposals.find(x=>x.id===row.id);if(p){p.aiReasons=[...row.aiReasons];p.memo=row.memo;}
}

function initialWindow(person,sr){
  const full=(person.employmentType||'')==='正社員'||person.salaryType==='monthly';
  const target=full?480:300;let start=sr.start,end=Math.min(DAY_END,Math.max(sr.end,start+target));
  const c=person.workConstraints||{};
  if(num(c.availableStart)!==null)start=Math.max(start,Number(c.availableStart));
  if(num(c.availableEnd)!==null)end=Math.min(end,Number(c.availableEnd));
  if(end<=start)end=Math.min(DAY_END,start+SLOT);
  return {start:snap(start),end:snap(end)};
}

function withinLimits(person,date,sr,working,month){
  const daily=Number(person.maxDailyMinutes||person.workConstraints?.maxDailyMinutes||DAILY_MAX);
  const weekly=Number(person.maxWeeklyMinutes||person.workConstraints?.maxWeeklyMinutes||WEEKLY_MAX);
  const monthlyRaw=person.maxMonthlyMinutes??person.monthlyHourCapMinutes??person.workConstraints?.maxMonthlyMinutes;
  const monthly=num(monthlyRaw);
  const own=(working[date]||[]).find(s=>canon(s.staffId)===person.id&&s.aiMonthCandidate);
  const proposed=own?Math.max(own.end,sr.end)-Math.min(own.start,sr.start):sr.end-sr.start;
  if(proposed>daily)return false;
  const wr=weekRange(date);let week=0,mon=0;
  Object.entries(working).forEach(([d,rows])=>{if(!Array.isArray(rows))return;rows.forEach(s=>{if(canon(s.staffId)!==person.id)return;const mins=Math.max(0,Number(s.end)-Number(s.start));if(d>=wr.start&&d<=wr.end&&d!==date)week+=mins;if(d.startsWith(month)&&d!==date)mon+=mins;});});
  if(week+proposed>weekly)return false;
  if(monthly!==null&&mon+proposed>monthly)return false;
  const maxDays=Number(person.workConstraints?.maxDaysPerWeek||7);
  if(workedDaysWeek(person.id,date,working)>=maxDays&&!own)return false;
  return true;
}

function score(person,date,sr,working,month){
  let s=skillLevel(person,sr.skillId)*120;
  if(person.mainStoreId===sr.storeId)s+=40;if((person.affiliationStoreIds||[]).includes(sr.storeId))s+=20;
  const own=(working[date]||[]).find(x=>canon(x.staffId)===person.id&&x.aiMonthCandidate);if(own)s+=90;
  const preferred=Number(person.workConstraints?.preferredDaysPerWeek||0);const weekDays=workedDaysWeek(person.id,date,working);if(preferred)s+=(preferred-weekDays)*18;
  const monthDays=workedDaysMonth(person.id,month,working);s-=monthDays*4;
  return s;
}

function coverageCount(sr,rows,staff){
  const eligible=(rows||[]).filter(s=>s.startStoreId===sr.storeId&&Number(s.start)<=sr.start&&Number(s.end)>=sr.end).map(s=>staff.find(p=>p.id===canon(s.staffId))).filter(p=>p&&skillLevel(p,sr.skillId)>=sr.minLevel);
  return new Set(eligible.map(p=>p.id)).size;
}
function expandRules(rules){const out=[];(rules||[]).forEach(r=>{for(let start=Number(r.start);start<Number(r.end);start+=SLOT)out.push({...r,start,end:Math.min(Number(r.end),start+SLOT)});});return out;}
function applicableRules(rules,date){return (rules||[]).filter(r=>r.active!==false&&matchesDate(r,date));}
function matchesDate(r,date){if(r.dayType==='specific')return r.specificDate===date;if(r.dayType==='all')return true;const d=new Date(`${date}T00:00:00`).getDay();if(r.dayType==='mon_thu')return d>=1&&d<=4;if(r.dayType==='fri_sat')return d===5||d===6;if(r.dayType==='sun')return d===0;return true;}
function availableOn(p,date,start,end){const c=p.workConstraints||{},day=String(new Date(`${date}T00:00:00`).getDay());if(Array.isArray(c.availableDays)&&c.availableDays.length&&!c.availableDays.includes(day))return false;if(Array.isArray(c.fixedOffDays)&&c.fixedOffDays.includes(day))return false;if(num(c.availableStart)!==null&&start<Number(c.availableStart))return false;if(num(c.availableEnd)!==null&&end>Number(c.availableEnd))return false;if((p.isMinor||p.highSchoolStudent)&&end>22*60)return false;return true;}
function storeAllowed(p,id){const a=Array.isArray(p.placementStoreIds)&&p.placementStoreIds.length?p.placementStoreIds:Array.isArray(p.affiliationStoreIds)?p.affiliationStoreIds:[];return !a.length||a.includes(id);}
function workedDaysWeek(id,date,working){const r=weekRange(date),days=new Set();Object.entries(working).forEach(([d,rows])=>{if(d<r.start||d>r.end||!Array.isArray(rows))return;if(rows.some(s=>canon(s.staffId)===id))days.add(d);});return days.size;}
function workedDaysMonth(id,month,working){const days=new Set();Object.entries(working).forEach(([d,rows])=>{if(!d.startsWith(month)||!Array.isArray(rows))return;if(rows.some(s=>canon(s.staffId)===id))days.add(d);});return days.size;}
function normalizeHoliday(v){const x=v&&typeof v==='object'?v:{};return {companyClosures:Array.isArray(x.companyClosures)?x.companyClosures:[],staffDays:Array.isArray(x.staffDays)?x.staffDays:[]};}
function isCompanyClosure(h,date){return h.companyClosures.some(x=>(typeof x==='string'?x:x.date)===date);}
function isUnavailable(h,id,date){if(isCompanyClosure(h,date))return true;return h.staffDays.some(x=>canon(x.staffId)===id&&x.date===date&&(x.type==='off'||x.type==='paid_leave'));}

function render(){
  const summary=document.getElementById('ai-month-summary'),body=document.getElementById('ai-month-body'),apply=document.getElementById('ai-month-apply');if(!summary||!body||!current)return;
  const hard=current.shortages.filter(x=>x.mode==='hard').reduce((a,b)=>a+b.shortage,0);
  const days=new Set(current.proposals.map(x=>x.date)).size;
  summary.innerHTML=metric('候補追加',`${current.proposals.length}件`)+metric('対象日',`${days}日`)+metric('必須残不足',`${hard}枠`)+metric('対象従業員',`${current.people.length}名`);
  const byDate=new Map();current.proposals.forEach(p=>{if(!byDate.has(p.date))byDate.set(p.date,[]);byDate.get(p.date).push(p);});
  const shortageByDate=new Map();current.shortages.forEach(s=>shortageByDate.set(s.date,(shortageByDate.get(s.date)||0)+s.shortage));
  const dayHtml=[...new Set([...byDate.keys(),...shortageByDate.keys()])].sort().map(date=>{
    const rows=byDate.get(date)||[],gap=shortageByDate.get(date)||0;
    return `<div class="aim-day"><div class="aim-day-date">${formatDate(date)}</div><div class="aim-day-count ${gap?'bad':''}">${rows.length}件 / 不足${gap}</div><div class="aim-day-items">${rows.map(p=>`<span class="aim-chip">${esc(staffName(p.staffId))}・${esc(storeName(p.startStoreId))} ${fmt(p.start)}-${fmt(p.end)}</span>`).join('')}</div></div>`;
  }).join('');
  const people=current.people.filter(p=>p.generated).sort((a,b)=>b.minutes-a.minutes).map(p=>`<div class="aim-person"><strong>${esc(p.name)}</strong><span>${p.days}日</span><span>${(p.minutes/60).toFixed(1)}h</span></div>`).join('');
  body.innerHTML=`${current.notes.length?`<div class="aim-note">${current.notes.map(esc).join('<br>')}</div>`:''}${dayHtml||'<div class="aim-empty">追加候補はありません。</div>'}${people?`<div class="aim-person"><strong>従業員</strong><span>勤務日</span><span>予定時間</span></div>${people}`:''}`;
  if(apply)apply.disabled=!current.proposals.length;
}
function metric(label,value){return `<div class="aim-metric"><small>${label}</small><strong>${value}</strong></div>`;}

function applyMonth(){
  if(!canEdit()||!current?.proposals?.length)return;
  if(!window.confirm(`${current.month} のAI候補 ${current.proposals.length}件を予定シフトへ反映します。既存シフトは変更しません。よろしいですか？`))return;
  const shifts=load(SHIFTS_KEY,{});let added=0;
  current.proposals.forEach(p=>{if(!Array.isArray(shifts[p.date]))shifts[p.date]=[];if(shifts[p.date].some(s=>canon(s.staffId)===canon(p.staffId)))return;const {date,...row}=p;shifts[p.date].push({...row,aiMonthCandidate:false,aiCandidate:false,aiGenerated:true,aiSource:'monthly-v1'});added++;});
  localStorage.setItem(SHIFTS_KEY,JSON.stringify(shifts));notify(`月間AI候補 ${added}件を反映しました`);current=null;renderEmpty();setTimeout(()=>window.location.reload(),300);
}
function renderEmpty(){const b=document.getElementById('ai-month-body'),s=document.getElementById('ai-month-summary'),a=document.getElementById('ai-month-apply');if(b)b.innerHTML='<div class="aim-empty">反映しました。再計算すると最新状態を確認できます。</div>';if(s)s.innerHTML='';if(a)a.disabled=true;}
function applyAccess(){const panel=document.getElementById('ai-month-panel');if(panel)panel.style.display=canEdit()?'':'none';}
function canEdit(){return Boolean(window.shiftV2Access?.can?.('shift.plan.edit'));}
function normalizeStaff(rows){return (Array.isArray(rows)?rows:[]).map(p=>({...p,id:canon(p.id||p.employeeNumber),name:p.name||`${p.lastName||''} ${p.firstName||''}`.trim(),employmentType:p.employmentType||(p.salaryType==='monthly'?'正社員':'アルバイト'),active:p.active!==false})).filter(p=>p.id);}
function skillLevel(p,id){const n=Number(p.skillLevels?.[id]);if(Number.isFinite(n))return Math.max(0,Math.min(3,n));const skill=SKILL_DEFINITIONS.find(x=>x.id===id);return skill?.legacyNames?.some(name=>(p.skills||[]).includes(name))?1:0;}
function skillName(id){return SKILL_DEFINITIONS.find(x=>x.id===id)?.name||id;}
function allStaff(){return normalizeStaff(load(STAFF_KEY,[]));}function allStores(){return load(STORES_KEY,[]);}function staffName(id){return allStaff().find(p=>p.id===canon(id))?.name||id;}function storeName(id){return allStores().find(s=>s.id===id)?.name||id;}
function daysInMonth(month){const[y,m]=month.split('-').map(Number),last=new Date(y,m,0).getDate();return Array.from({length:last},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);}
function weekRange(date){const d=new Date(`${date}T00:00:00`),day=d.getDay(),offset=day===0?-6:1-day,m=new Date(d);m.setDate(d.getDate()+offset);const s=new Date(m);s.setDate(m.getDate()+6);return {start:dateKey(m),end:dateKey(s)};}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}function formatDate(s){const d=new Date(`${s}T00:00:00`);return `${d.getMonth()+1}/${d.getDate()}(${['日','月','火','水','木','金','土'][d.getDay()]})`;}
function fmt(t){const h=Math.floor(t/60)%24,m=t%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}function snap(v){return Math.round(v/SLOT)*SLOT;}function canon(v){return String(v||'').toUpperCase();}function num(v){const n=Number(v);return Number.isFinite(n)?n:null;}function clone(v){return JSON.parse(JSON.stringify(v));}function load(k,f){try{const v=JSON.parse(localStorage.getItem(k));return v??clone(f);}catch{return clone(f);}}function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}function notify(m){const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);}
