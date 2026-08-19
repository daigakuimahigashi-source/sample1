(() => {
  'use strict';

  const STAFF_KEY='okk_shift_v2_staff';
  const SKILLS_KEY='okk_shift_v2_skill_definitions';
  const RULES_KEY='okk_shift_v2_staffing_requirements';
  const SHIFTS_KEY='okk_shift_simple_shifts';
  const STORES_KEY='okk_shift_simple_stores';
  const SLOT=30;
  const MINOR_END=22*60;
  const UNDO_DAY='okk_shift_simple_final_day_undo';
  const UNDO_PERIOD='okk_shift_simple_final_period_undo';

  let lastDayPlan=null;
  let lastPeriodPlan=null;

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();

  function init(){injectStyles();injectCoverage();injectActions();injectModals();bind();renderCoverageSoon();}

  function injectCoverage(){
    if(document.getElementById('final-coverage')) return;
    const planner=document.getElementById('view-planner');
    const toolbar=planner?.querySelector('.toolbar');
    if(!planner||!toolbar) return;
    const node=document.createElement('section');
    node.id='final-coverage';node.className='card final-coverage';
    toolbar.insertAdjacentElement('afterend',node);
  }

  function injectActions(){
    const left=document.querySelector('#view-planner .toolbar-left');
    if(!left||document.getElementById('final-day-fill')) return;
    const day=document.createElement('button');day.id='final-day-fill';day.className='btn btn-green';day.type='button';day.innerHTML='<i class="fa-solid fa-wand-magic-sparkles"></i> 1日自動補完';
    const period=document.createElement('button');period.id='final-period-fill';period.className='btn btn-dark';period.type='button';period.innerHTML='<i class="fa-solid fa-calendar-days"></i> 週・月候補生成';
    left.append(day,period);
  }

  function injectModals(){
    if(!document.getElementById('final-day-modal')){
      const m=document.createElement('div');m.id='final-day-modal';m.className='final-modal-bg';m.innerHTML=`<div class="final-modal"><div class="final-modal-head"><div><strong>1日自動補完</strong><span id="final-day-label"></span></div><button class="btn btn-light btn-small" data-final-close="day"><i class="fa-solid fa-xmark"></i></button></div><div class="final-modal-body"><div class="final-policy"><i class="fa-solid fa-shield-halved"></i><div><strong>出勤店舗・開始・終了だけで判定</strong><span>店舗移動は推測しません。必須不足だけを対象に、既存シフトの延長を優先して候補化します。</span></div></div><div id="final-day-result"></div></div><div class="final-modal-foot"><button id="final-day-undo" class="btn btn-light" style="display:none"><i class="fa-solid fa-rotate-left"></i>元に戻す</button><div><button id="final-day-refresh" class="btn btn-light"><i class="fa-solid fa-rotate"></i>作り直す</button><button id="final-day-apply" class="btn btn-green" disabled><i class="fa-solid fa-check"></i>一括反映</button></div></div></div>`;document.body.appendChild(m);
    }
    if(!document.getElementById('final-period-modal')){
      const m=document.createElement('div');m.id='final-period-modal';m.className='final-modal-bg';m.innerHTML=`<div class="final-modal final-modal-wide"><div class="final-modal-head"><div><strong>週・月の候補生成</strong><span id="final-period-label"></span></div><button class="btn btn-light btn-small" data-final-close="period"><i class="fa-solid fa-xmark"></i></button></div><div class="final-modal-body"><div class="final-period-controls"><div class="final-segment"><button class="active" data-final-mode="week">1週間</button><button data-final-mode="month">1か月</button></div><input id="final-period-anchor" type="date" class="control"><button id="final-period-generate" class="btn btn-green"><i class="fa-solid fa-wand-magic-sparkles"></i>候補を生成</button></div><div class="final-policy"><i class="fa-solid fa-layer-group"></i><div><strong>既存シフトは残し、不足分だけ補完</strong><span>週勤務日数・月間時間上限を期間全体で累積判定します。</span></div></div><div id="final-period-result" class="final-empty">候補を生成してください。</div></div><div class="final-modal-foot"><button id="final-period-undo" class="btn btn-light" style="display:none"><i class="fa-solid fa-rotate-left"></i>元に戻す</button><div><button id="final-period-refresh" class="btn btn-light" disabled><i class="fa-solid fa-rotate"></i>作り直す</button><button id="final-period-apply" class="btn btn-green" disabled><i class="fa-solid fa-check"></i>一括反映</button></div></div></div>`;document.body.appendChild(m);
    }
  }

  function bind(){
    document.getElementById('work-date')?.addEventListener('change',renderCoverageSoon);
    document.addEventListener('pointerup',()=>setTimeout(renderCoverageSoon,30));
    document.addEventListener('drop',()=>setTimeout(renderCoverageSoon,30));
    document.addEventListener('change',e=>{if(e.target.closest('#inspector')) setTimeout(renderCoverageSoon,30);});
    window.addEventListener('storage',e=>{if([STAFF_KEY,SKILLS_KEY,RULES_KEY,SHIFTS_KEY,STORES_KEY].includes(e.key)) renderCoverageSoon();});

    document.getElementById('final-day-fill')?.addEventListener('click',openDay);
    document.getElementById('final-day-refresh')?.addEventListener('click',buildDay);
    document.getElementById('final-day-apply')?.addEventListener('click',applyDay);
    document.getElementById('final-day-undo')?.addEventListener('click',undoDay);
    document.getElementById('final-period-fill')?.addEventListener('click',openPeriod);
    document.getElementById('final-period-generate')?.addEventListener('click',buildPeriod);
    document.getElementById('final-period-refresh')?.addEventListener('click',buildPeriod);
    document.getElementById('final-period-apply')?.addEventListener('click',applyPeriod);
    document.getElementById('final-period-undo')?.addEventListener('click',undoPeriod);
    document.addEventListener('click',e=>{
      const close=e.target.closest('[data-final-close]');if(close) document.getElementById(`final-${close.dataset.finalClose}-modal`)?.classList.remove('open');
      const mode=e.target.closest('[data-final-mode]');if(mode){document.querySelectorAll('[data-final-mode]').forEach(b=>b.classList.toggle('active',b===mode));updatePeriodLabel();}
      const place=e.target.closest('[data-final-place]');if(place) applyOne(place.dataset.finalPlace);
    });
    document.getElementById('final-period-anchor')?.addEventListener('change',updatePeriodLabel);
  }

  let coverageTimer;
  function renderCoverageSoon(){clearTimeout(coverageTimer);coverageTimer=setTimeout(renderCoverage,70);}
  function renderCoverage(){
    const box=document.getElementById('final-coverage');const date=currentDate();if(!box||!date)return;
    const data=runtime();const results=rulesForDate(data,date).map(r=>evaluate(data,date,r));const shortages=results.filter(x=>x.shortage>0);const hard=shortages.filter(x=>x.rule.mode!=='soft');
    box.className=`card final-coverage ${hard.length?'danger':shortages.length?'warn':'ok'}`;
    const byStore=data.stores.map(s=>({s,items:shortages.filter(x=>x.rule.storeId===s.id)})).filter(x=>x.items.length);
    box.innerHTML=`<div class="final-coverage-head"><div><strong><i class="fa-solid ${shortages.length?'fa-people-group':'fa-circle-check'}"></i> 必要スキル充足</strong><span>${results.length-shortages.length}/${results.length}条件を充足</span></div><div>${byStore.map(x=>`<span class="final-store-chip ${x.items.some(y=>y.rule.mode!=='soft')?'danger':'warn'}">${esc(x.s.name)} 不足${x.items.length}</span>`).join('')}</div></div>${shortages.length?`<div class="final-shortages">${shortages.slice(0,8).map(x=>shortageCard(x,data,true)).join('')}</div>`:'<div class="final-ok-text">現在の配置で、設定済み条件を満たしています。</div>'}`;
    decorateBars(data,date,shortages);
  }

  function decorateBars(data,date,shortages){
    document.querySelectorAll('.final-shortage-dot').forEach(n=>n.remove());
    const selected=document.querySelector('#new-store-buttons [data-store].active')?.dataset.store||'';
    if(!selected)return;
    document.querySelectorAll('.shift-bar[data-shift-id]').forEach(bar=>{
      const shift=(data.shifts[date]||[]).find(x=>x.id===bar.dataset.shiftId);if(!shift||shift.startStoreId!==selected)return;
      const hit=shortages.some(x=>x.rule.storeId===selected&&Number(shift.start)<Number(x.rule.end)&&Number(shift.end)>Number(x.rule.start));
      if(hit){const dot=document.createElement('span');dot.className='final-shortage-dot';dot.title='この店舗・時間帯に不足条件があります';dot.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i>';bar.appendChild(dot);}
    });
  }

  function openDay(){document.getElementById('final-day-modal')?.classList.add('open');buildDay();}
  function buildDay(){
    const date=currentDate();document.getElementById('final-day-label').textContent=date.replaceAll('-','/');
    const result=document.getElementById('final-day-result');if(result)result.innerHTML='<div class="final-loading"><i class="fa-solid fa-spinner fa-spin"></i>候補計算中...</div>';
    setTimeout(()=>{lastDayPlan=simulateDates([date]);renderDayPlan(lastDayPlan,date);},20);
  }
  function renderDayPlan(plan,date){
    const result=document.getElementById('final-day-result');const apply=document.getElementById('final-day-apply');const undo=document.getElementById('final-day-undo');if(!result||!apply||!undo)return;
    const day=plan.days[0];apply.disabled=!day.changes.length;undo.style.display=sessionStorage.getItem(UNDO_DAY)?'':'none';
    result.innerHTML=`<div class="final-metrics">${metric('補完前',`${day.before}条件`)}${metric('解消',`${Math.max(0,day.before-day.after)}条件`,'ok')}${metric('変更',`${day.changes.length}名`)}${metric('残る不足',`${day.after}条件`,day.after?'warn':'ok')}</div><div class="final-review-list">${day.changes.map(c=>changeCard(c,plan.data,date)).join('')||'<div class="final-empty">反映できる候補はありません。</div>'}</div>${day.unresolved.length?`<div class="final-unresolved">${day.unresolved.slice(0,8).map(x=>shortageCard(x,plan.data,false)).join('')}</div>`:''}`;
  }

  function openPeriod(){const a=document.getElementById('final-period-anchor');if(a)a.value=currentDate();updatePeriodLabel();document.getElementById('final-period-modal')?.classList.add('open');document.getElementById('final-period-undo').style.display=sessionStorage.getItem(UNDO_PERIOD)?'':'none';}
  function periodMode(){return document.querySelector('[data-final-mode].active')?.dataset.finalMode||'week';}
  function updatePeriodLabel(){const dates=rangeDates(periodMode(),document.getElementById('final-period-anchor')?.value||currentDate());const el=document.getElementById('final-period-label');if(el&&dates.length)el.textContent=`${dates[0].replaceAll('-','/')} 〜 ${dates.at(-1).replaceAll('-','/')}`;}
  function buildPeriod(){
    const dates=rangeDates(periodMode(),document.getElementById('final-period-anchor')?.value||currentDate());const result=document.getElementById('final-period-result');if(result)result.innerHTML='<div class="final-loading"><i class="fa-solid fa-spinner fa-spin"></i>期間全体を計算中...</div>';
    document.getElementById('final-period-apply').disabled=true;document.getElementById('final-period-refresh').disabled=true;
    setTimeout(()=>{lastPeriodPlan=simulateDates(dates);renderPeriodPlan(lastPeriodPlan);document.getElementById('final-period-refresh').disabled=false;document.getElementById('final-period-apply').disabled=!lastPeriodPlan.allChanges.length;},30);
  }
  function renderPeriodPlan(plan){
    const result=document.getElementById('final-period-result');if(!result)return;const before=plan.days.reduce((s,d)=>s+d.before,0),after=plan.days.reduce((s,d)=>s+d.after,0),changedDays=plan.days.filter(d=>d.changes.length).length,people=new Set(plan.allChanges.map(c=>c.staffId)).size;
    result.innerHTML=`<div class="final-metrics final-six">${metric('補完前',`${before}条件`)}${metric('解消',`${Math.max(0,before-after)}条件`,'ok')}${metric('変更日',`${changedDays}日`)}${metric('変更する人',`${people}名`)}${metric('変更件数',`${plan.allChanges.length}件`)}${metric('残る不足',`${after}条件`,after?'warn':'ok')}</div><div class="final-period-days">${plan.days.filter(d=>d.changes.length||d.unresolved.length).map(d=>`<section class="final-day-block"><div class="final-day-block-head"><strong>${d.date.replaceAll('-','/')}（${weekday(d.date)}）</strong><span>変更${d.changes.length} / 不足${d.after}</span></div>${d.changes.length?`<div class="final-review-list">${d.changes.map(c=>changeCard(c,plan.data,d.date)).join('')}</div>`:''}${d.unresolved.length?`<div class="final-unresolved">${d.unresolved.slice(0,6).map(x=>shortageCard(x,plan.data,false)).join('')}</div>`:''}</section>`).join('')||'<div class="final-empty">変更提案はありません。</div>'}</div>`;
  }

  function simulateDates(dates){
    const data=runtime();const original=clone(data.shifts),sim=clone(data.shifts),base=pickDates(original,dates),days=[];let safety=0;
    for(const date of dates){if(!Array.isArray(sim[date]))sim[date]=[];const beforeDay=clone(sim[date]);const simData={...data,shifts:sim};const rules=rulesForDate(simData,date).filter(r=>r.mode!=='soft').sort((a,b)=>Number(a.start)-Number(b.start)||Number(b.minLevel||1)-Number(a.minLevel||1));const initial=rules.map(r=>evaluate(simData,date,r)).filter(x=>x.shortage>0).length;
      for(const rule of rules){while(safety++<8000){const current=evaluate(simData,date,rule);if(current.shortage<=0)break;const candidates=candidatesFor(simData,date,rule);let improved=false;for(const c of candidates){const snap=clone(sim[date]);applyCandidate(sim[date],c);if(evaluate(simData,date,rule).shortage<current.shortage){improved=true;break;}sim[date].splice(0,sim[date].length,...snap);}if(!improved)break;}}
      const unresolved=rules.map(r=>evaluate(simData,date,r)).filter(x=>x.shortage>0);const changes=diffDay(beforeDay,sim[date],data.staff);days.push({date,before:initial,after:unresolved.length,unresolved,changes});
    }
    return{dates,data,original,sim,base,baseFingerprint:JSON.stringify(base),final:pickDates(sim,dates),days,allChanges:days.flatMap(d=>d.changes.map(c=>({...c,date:d.date})))};
  }

  function candidatesFor(data,date,rule){
    const skill=skillById(data,rule.skillId),day=data.shifts[date]||[],month=date.slice(0,7),out=[];
    for(const person of data.staff){if(!person||person.active===false||person.autoAssign===false)continue;const staffId=String(person.id||person.employeeNumber||'').toUpperCase();if(!staffId)continue;const level=skillLevel(person,skill);if(level<Number(rule.minLevel||1)||!storeAllowed(person,rule.storeId))continue;const existing=day.find(s=>sameId(s.staffId,staffId));const monthly=minutesForMonth(data.shifts,staffId,month);let score=50+level*12-Math.min(25,Math.round(monthly/600));if((person.placementStoreIds||[]).includes(rule.storeId))score+=10;if((person.affiliationStoreIds||[]).includes(rule.storeId))score+=8;
      if(existing){if(existing.startStoreId!==rule.storeId)continue;const after={...existing,start:Math.min(Number(existing.start),Number(rule.start)),end:Math.max(Number(existing.end),Number(rule.end))};const add=(after.end-after.start)-(Number(existing.end)-Number(existing.start));if(!availability(person,date,after.start,after.end)||isMinor(person,date,after.end)||!monthlyAllowed(person,monthly,add))continue;out.push({type:'extend',staffId,shiftId:existing.id,after,score:score+15,person});}
      else{if(!availability(person,date,Number(rule.start),Number(rule.end))||isMinor(person,date,Number(rule.end))||!weeklyAllowed(person,data.shifts,date,staffId)||!monthlyAllowed(person,monthly,Number(rule.end)-Number(rule.start)))continue;out.push({type:'new',staffId,startStoreId:rule.storeId,start:Number(rule.start),end:Number(rule.end),score,person});}
    }
    return out.sort((a,b)=>b.score-a.score||String(a.person.name||'').localeCompare(String(b.person.name||''),'ja'));
  }

  function applyCandidate(day,c){if(c.type==='new')day.push({id:`sh_final_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`,staffId:c.staffId,startStoreId:c.startStoreId,start:c.start,end:c.end,memo:'自動補完候補から配置'});else{const s=day.find(x=>x.id===c.shiftId&&sameId(x.staffId,c.staffId));if(s){s.start=c.after.start;s.end=c.after.end;s.memo=[s.memo,'自動補完で時間調整'].filter(Boolean).join(' / ');}}}

  function applyOne(token){const p=decodeToken(token);if(!p)return;const data=runtime(),rule=data.requirements.find(r=>r.id===p.ruleId),all=loadObject(SHIFTS_KEY,{}),day=all[p.date]||[];if(!rule)return;const cand=candidatesFor({...data,shifts:all},p.date,rule).find(c=>c.staffId===p.staffId);if(!cand)return notify('候補条件が変わっています');applyCandidate(day,cand);all[p.date]=day;localStorage.setItem(SHIFTS_KEY,JSON.stringify(all));location.reload();}

  function applyDay(){if(!lastDayPlan||!lastDayPlan.allChanges.length)return;const date=lastDayPlan.dates[0],all=loadObject(SHIFTS_KEY,{});if(JSON.stringify(pickDates(all,[date]))!==lastDayPlan.baseFingerprint)return notify('シフトが更新されています。作り直してください。');sessionStorage.setItem(UNDO_DAY,JSON.stringify({date,before:lastDayPlan.base[date],after:lastDayPlan.final[date]}));all[date]=clone(lastDayPlan.sim[date]);localStorage.setItem(SHIFTS_KEY,JSON.stringify(all));location.reload();}
  function undoDay(){const raw=sessionStorage.getItem(UNDO_DAY);if(!raw)return;const u=JSON.parse(raw),all=loadObject(SHIFTS_KEY,{});all[u.date]=u.before||[];localStorage.setItem(SHIFTS_KEY,JSON.stringify(all));sessionStorage.removeItem(UNDO_DAY);location.reload();}
  function applyPeriod(){if(!lastPeriodPlan||!lastPeriodPlan.allChanges.length)return;const all=loadObject(SHIFTS_KEY,{});if(JSON.stringify(pickDates(all,lastPeriodPlan.dates))!==lastPeriodPlan.baseFingerprint)return notify('期間内のシフトが更新されています。作り直してください。');sessionStorage.setItem(UNDO_PERIOD,JSON.stringify({dates:lastPeriodPlan.dates,before:lastPeriodPlan.base,after:lastPeriodPlan.final}));lastPeriodPlan.dates.forEach(d=>all[d]=clone(lastPeriodPlan.sim[d]||[]));localStorage.setItem(SHIFTS_KEY,JSON.stringify(all));location.reload();}
  function undoPeriod(){const raw=sessionStorage.getItem(UNDO_PERIOD);if(!raw)return;const u=JSON.parse(raw),all=loadObject(SHIFTS_KEY,{});u.dates.forEach(d=>all[d]=clone(u.before[d]||[]));localStorage.setItem(SHIFTS_KEY,JSON.stringify(all));sessionStorage.removeItem(UNDO_PERIOD);location.reload();}

  function rulesForDate(data,date){const active=data.requirements.filter(r=>r.active!==false&&skillById(data,r.skillId)?.active!==false);const specific=new Set(active.filter(r=>r.dayType==='specific'&&r.specificDate===date).map(r=>`${r.storeId}|${r.skillId}|${r.start}|${r.end}`));return active.filter(r=>dayMatches(r,date)&&(r.dayType==='specific'||!specific.has(`${r.storeId}|${r.skillId}|${r.start}|${r.end}`)));}
  function evaluate(data,date,rule){let min=Infinity;for(let m=Number(rule.start);m<Number(rule.end);m+=SLOT){let n=0;const ids=new Set();for(const s of data.shifts[date]||[]){if(s.startStoreId!==rule.storeId||Number(s.start)>m||Number(s.end)<Math.min(Number(rule.end),m+SLOT))continue;const p=data.staff.find(x=>sameId(x.id||x.employeeNumber,s.staffId));if(!p||p.active===false||skillLevel(p,skillById(data,rule.skillId))<Number(rule.minLevel||1))continue;ids.add(String(p.id||p.employeeNumber).toUpperCase());}n=ids.size;min=Math.min(min,n);}if(!Number.isFinite(min))min=0;return{rule,minimum:min,shortage:Math.max(0,Number(rule.count||0)-min)};}
  function dayMatches(r,date){if(r.dayType==='specific')return r.specificDate===date;const d=new Date(`${date}T00:00:00`).getDay();if(r.dayType==='weekday')return d>=1&&d<=4;if(r.dayType==='fri_sat')return d===5||d===6;if(r.dayType==='sun')return d===0;return true;}
  function skillLevel(p,s){if(!s)return 0;const n=Number(p?.skillLevels?.[s.id]);if(Number.isFinite(n))return Math.max(0,Math.min(3,n));return (p.skills||[]).some(x=>norm(x)===norm(s.name))?1:0;}
  function availability(p,date,start,end){const c=p.workConstraints;if(!c)return true;const wd=String(new Date(`${date}T00:00:00`).getDay());if(Array.isArray(c.availableDays)&&c.availableDays.length&&!c.availableDays.includes(wd))return false;if(Number.isFinite(Number(c.availableStart))&&start<Number(c.availableStart))return false;if(Number.isFinite(Number(c.availableEnd))&&end>Number(c.availableEnd))return false;return true;}
  function storeAllowed(p,id){const a=Array.isArray(p.placementStoreIds)?p.placementStoreIds.filter(Boolean):[];return !a.length||a.includes(id);}
  function isMinor(p,date,end){const birth=parseDate(p?.dob||p?.birthdate||p?.birthday||'');if(!birth||end<=MINOR_END)return false;const work=parseDate(date);let age=work.getFullYear()-birth.getFullYear();if(work.getMonth()<birth.getMonth()||(work.getMonth()===birth.getMonth()&&work.getDate()<birth.getDate()))age--;return age<18;}
  function weeklyAllowed(p,shifts,date,id){const max=Number(p?.workConstraints?.maxDaysPerWeek);if(!Number.isFinite(max)||max<=0)return true;const base=new Date(`${date}T00:00:00`),mon=new Date(base);mon.setDate(base.getDate()-((base.getDay()+6)%7));const sun=new Date(mon);sun.setDate(mon.getDate()+6);let count=0;for(const [d,rows]of Object.entries(shifts)){const x=new Date(`${d}T00:00:00`);if(x<mon||x>sun)continue;if((rows||[]).some(s=>sameId(s.staffId,id)))count++;}return count<max;}
  function monthlyAllowed(p,current,add){const c=p?.workConstraints||{},max=Number(c.maxMonthlyHours??c.monthlyMaxHours??c.maxHoursPerMonth??p.maxMonthlyHours);return !Number.isFinite(max)||max<=0||current+Math.max(0,add)<=max*60;}
  function minutesForMonth(shifts,id,month){let t=0;for(const[d,rows]of Object.entries(shifts)){if(!d.startsWith(month))continue;for(const s of rows||[])if(sameId(s.staffId,id))t+=Math.max(0,Number(s.end)-Number(s.start));}return t;}
  function diffDay(before,after,staff){const bm=new Map((before||[]).map(s=>[String(s.staffId).toUpperCase(),s])),out=[];for(const s of after||[]){const id=String(s.staffId).toUpperCase(),b=bm.get(id),p=staff.find(x=>sameId(x.id||x.employeeNumber,id));if(!b)out.push({type:'new',staffId:id,name:p?.name||id,before:null,after:clone(s)});else if(Number(b.start)!==Number(s.start)||Number(b.end)!==Number(s.end)||b.startStoreId!==s.startStoreId)out.push({type:'extend',staffId:id,name:p?.name||id,before:clone(b),after:clone(s)});}return out;}
  function changeCard(c,data,date){const st=storeById(data,c.after.startStoreId);return`<article class="final-change"><div><strong>${esc(c.name)}</strong><span>${esc(c.staffId)}</span></div><span>${esc(st?.name||c.after.startStoreId)}</span><div>${c.before?`${fmt(c.before.start)}-${fmt(c.before.end)}`:'未配置'} <i class="fa-solid fa-arrow-right"></i> <b>${fmt(c.after.start)}-${fmt(c.after.end)}</b></div><small>${c.type==='new'?'追加':'時間変更'}</small></article>`;}
  function shortageCard(x,data,withCandidates){const r=x.rule,s=storeById(data,r.storeId),sk=skillById(data,r.skillId),cands=withCandidates?candidatesFor(data,currentDate(),r).slice(0,3):[];return`<div class="final-shortage"><strong>${esc(s?.name||r.storeId)} ${fmt(r.start)}-${fmt(r.end)}</strong><span>${esc(sk?.name||r.skillId)} Lv${r.minLevel}以上 ${x.minimum}/${r.count}名</span>${cands.length?`<div>${cands.map(c=>`<button data-final-place="${encodeToken({date:currentDate(),ruleId:r.id,staffId:c.staffId})}">${esc(c.person.name||c.staffId)}</button>`).join('')}</div>`:''}</div>`;}
  function metric(l,v,k=''){return`<div class="final-metric ${k}"><span>${l}</span><strong>${v}</strong></div>`;}

  function runtime(){return{staff:loadArray(STAFF_KEY,[]),skills:loadArray(SKILLS_KEY,defaultSkills()),requirements:loadArray(RULES_KEY,[]),shifts:loadObject(SHIFTS_KEY,{}),stores:loadArray(STORES_KEY,defaultStores())};}
  function defaultSkills(){return[{id:'opening',name:'オープン準備',active:true},{id:'closing',name:'締め作業',active:true},{id:'meat',name:'肉場',active:true},{id:'salad',name:'サラダ場',active:true},{id:'hall',name:'ホール',active:true},{id:'drink',name:'ドリンク',active:true},{id:'dish',name:'洗い場',active:true},{id:'register',name:'レジ',active:true}];}
  function defaultStores(){return[{id:'matsuyama',name:'松山店',area:'naha',close:1800,color:'#7c3aed'},{id:'kumoji',name:'久茂地店',area:'naha',close:1500,color:'#059669'},{id:'miebashi',name:'美栄橋店',area:'naha',close:1500,color:'#2563eb'},{id:'misato',name:'美里店',area:'okinawa',close:1560,color:'#ea580c'}];}
  function currentDate(){return document.getElementById('work-date')?.value||dateKey(new Date());}
  function rangeDates(mode,anchor){const b=new Date(`${anchor}T00:00:00`);if(mode==='month'){const f=new Date(b.getFullYear(),b.getMonth(),1),l=new Date(b.getFullYear(),b.getMonth()+1,0);return between(f,l);}const m=new Date(b);m.setDate(b.getDate()-((b.getDay()+6)%7));const s=new Date(m);s.setDate(m.getDate()+6);return between(m,s);}
  function between(a,b){const out=[],c=new Date(a);while(c<=b){out.push(dateKey(c));c.setDate(c.getDate()+1);}return out;}
  function pickDates(shifts,dates){const o={};dates.forEach(d=>o[d]=clone(Array.isArray(shifts[d])?shifts[d]:[]));return o;}
  function weekday(d){return['日','月','火','水','木','金','土'][new Date(`${d}T00:00:00`).getDay()];}
  function parseDate(v){const m=String(v||'').replace(/[./]/g,'-').match(/(\d{4})-(\d{1,2})-(\d{1,2})/);return m?new Date(+m[1],+m[2]-1,+m[3]):null;}
  function skillById(d,id){return d.skills.find(x=>x.id===id);}function storeById(d,id){return d.stores.find(x=>x.id===id);}function norm(v){return String(v||'').replace(/[\s　（）()]/g,'').toLowerCase();}function sameId(a,b){return String(a||'').toUpperCase()===String(b||'').toUpperCase();}
  function fmt(n){n=Number(n||0);return`${n>=1440?'翌':''}${String(Math.floor(n/60)%24).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}function dateKey(d){d=new Date(d);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function loadArray(k,f){const v=load(k,null);return Array.isArray(v)?v:f;}function loadObject(k,f){const v=load(k,null);return v&&typeof v==='object'&&!Array.isArray(v)?v:f;}function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}}function clone(v){return JSON.parse(JSON.stringify(v));}
  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}function encodeToken(v){return btoa(unescape(encodeURIComponent(JSON.stringify(v))));}function decodeToken(v){try{return JSON.parse(decodeURIComponent(escape(atob(v))));}catch{return null;}}
  function notify(m){const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}

  function injectStyles(){if(document.getElementById('final-assist-style'))return;const s=document.createElement('style');s.id='final-assist-style';s.textContent=`
    .final-coverage{margin:-1px 0 10px;padding:10px 12px;border-left:4px solid #12b76a}.final-coverage.warn{border-left-color:#f79009}.final-coverage.danger{border-left-color:#f04438}.final-coverage-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.final-coverage-head>div{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.final-coverage-head strong{font-size:10px}.final-coverage-head span{font-size:8px;color:#667085}.final-store-chip{border-radius:999px;padding:3px 6px!important;font-weight:900}.final-store-chip.warn{background:#fffaeb;color:#b54708!important}.final-store-chip.danger{background:#fef3f2;color:#b42318!important}.final-shortages{display:flex;gap:6px;overflow:auto;margin-top:7px}.final-shortage{min-width:165px;border:1px solid #fedf89;background:#fffaeb;border-radius:8px;padding:6px;display:grid;gap:2px}.final-shortage strong{font-size:8px}.final-shortage span{font-size:8px;color:#667085}.final-shortage div{display:flex;gap:3px;flex-wrap:wrap;margin-top:3px}.final-shortage button{font-size:7px;padding:2px 5px;border:1px solid #d0d5dd;background:#fff;border-radius:999px;color:#344054}.final-ok-text{font-size:8px;color:#667085;margin-top:5px}.final-shortage-dot{position:absolute;right:-8px;top:-8px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:#f04438;color:#fff;font-size:8px;z-index:20}.final-modal-bg{position:fixed;inset:0;z-index:500;background:rgba(15,23,42,.7);display:none;align-items:center;justify-content:center;padding:16px}.final-modal-bg.open{display:flex}.final-modal{width:min(880px,100%);max-height:94vh;background:#fff;border-radius:15px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(15,23,42,.4)}.final-modal-wide{width:min(1100px,100%)}.final-modal-head,.final-modal-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #e4e7ec}.final-modal-foot{border-bottom:0;border-top:1px solid #e4e7ec}.final-modal-foot>div{display:flex;gap:6px}.final-modal-head>div{display:flex;gap:8px;align-items:baseline}.final-modal-head strong{font-size:14px}.final-modal-head span{font-size:8px;color:#667085}.final-modal-body{padding:12px 14px;overflow:auto}.final-policy{display:flex;gap:8px;padding:9px;border:1px solid #d1e9ff;background:#eff8ff;border-radius:8px}.final-policy strong{display:block;font-size:9px}.final-policy span{display:block;font-size:8px;color:#667085;margin-top:2px}.final-loading,.final-empty{padding:24px;text-align:center;color:#667085;font-size:9px}.final-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.final-metrics.final-six{grid-template-columns:repeat(6,minmax(0,1fr))}.final-metric{border:1px solid #e4e7ec;border-radius:8px;padding:7px}.final-metric span{display:block;font-size:7px;color:#667085}.final-metric strong{display:block;font-size:14px}.final-metric.ok{background:#ecfdf3;border-color:#abefc6}.final-metric.warn{background:#fffaeb;border-color:#fedf89}.final-review-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:8px}.final-change{border:1px solid #e4e7ec;border-radius:8px;padding:7px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 6px;font-size:8px}.final-change strong{display:block;font-size:9px}.final-change span{font-size:7px;color:#175cd3}.final-change small{justify-self:end;color:#6941c6;font-weight:900}.final-unresolved{display:flex;gap:5px;overflow:auto;margin-top:7px}.final-period-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.final-segment{display:flex;padding:2px;background:#f2f4f7;border-radius:8px}.final-segment button{border:0;background:transparent;padding:5px 10px;border-radius:6px;font-size:8px;font-weight:900}.final-segment button.active{background:#fff;box-shadow:0 1px 3px rgba(16,24,40,.14)}.final-period-days{display:grid;gap:6px;margin-top:8px}.final-day-block{border:1px solid #e4e7ec;border-radius:8px;overflow:hidden}.final-day-block-head{display:flex;justify-content:space-between;padding:6px 8px;background:#f9fafb}.final-day-block-head strong{font-size:8px}.final-day-block-head span{font-size:7px;color:#667085}@media(max-width:850px){.final-metrics,.final-metrics.final-six{grid-template-columns:repeat(2,minmax(0,1fr))}.final-review-list{grid-template-columns:1fr}}
  `;document.head.appendChild(s);}
})();