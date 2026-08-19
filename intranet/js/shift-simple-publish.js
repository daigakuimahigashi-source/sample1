(() => {
  'use strict';

  const KEY='okk_shift_simple_publish';
  const STAFF_KEY='okk_shift_v2_staff';
  const SHIFT_KEY='okk_shift_simple_shifts';

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();

  function init(){injectStyles();injectButton();injectModal();bind();renderStatus();}

  function injectButton(){
    if(document.getElementById('publish-open'))return;
    const actions=document.querySelector('.topbar .actions');if(!actions)return;
    const status=document.createElement('span');status.id='publish-top-status';status.className='publish-top-status';actions.prepend(status);
    const btn=document.createElement('button');btn.id='publish-open';btn.className='btn btn-green';btn.type='button';btn.innerHTML='<i class="fa-solid fa-bullhorn"></i>公開管理';actions.appendChild(btn);
  }

  function injectModal(){
    if(document.getElementById('publish-modal'))return;
    const modal=document.createElement('div');modal.id='publish-modal';modal.className='publish-modal-bg';modal.innerHTML=`
      <div class="publish-modal">
        <div class="publish-modal-head"><div><strong>シフト公開管理</strong><span>正社員とアルバイトで公開期間を分けます</span></div><button class="btn btn-light btn-small" data-publish-close><i class="fa-solid fa-xmark"></i></button></div>
        <div class="publish-modal-body">
          <div class="publish-note"><i class="fa-solid fa-circle-info"></i><span>公開はシフト内容を変更しません。「従業員に見せてよい範囲」を記録するだけです。</span></div>
          <div class="publish-start-row"><label>公開開始日</label><input id="publish-start" type="date" class="control"><button id="publish-use-workdate" class="btn btn-light btn-small">選択日を使う</button></div>
          <div class="publish-grid">
            <section class="publish-card"><div class="publish-icon monthly"><i class="fa-solid fa-user-tie"></i></div><div><strong>正社員・月給者</strong><span>目安：1か月先まで</span></div><div class="publish-current" id="publish-monthly-current"></div><div class="publish-actions"><input id="publish-monthly-through" type="date" class="control"><button id="publish-monthly-suggest" class="btn btn-light btn-small">+1か月</button><button id="publish-monthly-do" class="btn btn-green btn-small">公開</button></div></section>
            <section class="publish-card"><div class="publish-icon hourly"><i class="fa-solid fa-user-clock"></i></div><div><strong>アルバイト・時給者</strong><span>目安：1週間先まで</span></div><div class="publish-current" id="publish-hourly-current"></div><div class="publish-actions"><input id="publish-hourly-through" type="date" class="control"><button id="publish-hourly-suggest" class="btn btn-light btn-small">+1週間</button><button id="publish-hourly-do" class="btn btn-green btn-small">公開</button></div></section>
          </div>
          <section class="publish-summary" id="publish-summary"></section>
          <section class="publish-message-box"><div><strong>通知文</strong><span>LINE / LINE WORKSへ貼り付ける文面</span></div><textarea id="publish-message" readonly></textarea><button id="publish-copy" class="btn btn-dark"><i class="fa-solid fa-copy"></i>通知文をコピー</button></section>
        </div>
        <div class="publish-modal-foot"><button id="publish-reset" class="btn btn-light"><i class="fa-solid fa-rotate-left"></i>公開状態をリセット</button><button class="btn btn-light" data-publish-close>閉じる</button></div>
      </div>`;
    document.body.appendChild(modal);
  }

  function bind(){
    document.getElementById('publish-open')?.addEventListener('click',open);
    document.addEventListener('click',e=>{if(e.target.closest('[data-publish-close]')||e.target.id==='publish-modal')close();});
    document.getElementById('publish-use-workdate')?.addEventListener('click',()=>{document.getElementById('publish-start').value=currentDate();suggestBoth();renderModal();});
    document.getElementById('publish-start')?.addEventListener('change',()=>{suggestBoth();renderModal();});
    document.getElementById('publish-monthly-suggest')?.addEventListener('click',()=>{document.getElementById('publish-monthly-through').value=addDays(document.getElementById('publish-start').value,30);});
    document.getElementById('publish-hourly-suggest')?.addEventListener('click',()=>{document.getElementById('publish-hourly-through').value=addDays(document.getElementById('publish-start').value,7);});
    document.getElementById('publish-monthly-do')?.addEventListener('click',()=>publish('monthly'));
    document.getElementById('publish-hourly-do')?.addEventListener('click',()=>publish('hourly'));
    document.getElementById('publish-copy')?.addEventListener('click',copyMessage);
    document.getElementById('publish-reset')?.addEventListener('click',()=>{if(confirm('公開状態だけをリセットします。シフト本体は消えません。')){localStorage.removeItem(KEY);renderModal();renderStatus();}});
    window.addEventListener('storage',e=>{if(e.key===KEY)renderStatus();});
  }

  function open(){
    const start=document.getElementById('publish-start');if(start&&!start.value)start.value=currentDate();
    suggestBoth(false);renderModal();document.getElementById('publish-modal')?.classList.add('open');
  }
  function close(){document.getElementById('publish-modal')?.classList.remove('open');}

  function suggestBoth(force=true){
    const start=document.getElementById('publish-start')?.value||currentDate();
    const m=document.getElementById('publish-monthly-through'),h=document.getElementById('publish-hourly-through');
    if(m&&(force||!m.value))m.value=addDays(start,30);if(h&&(force||!h.value))h.value=addDays(start,7);
  }

  function publish(type){
    const state=load();const start=document.getElementById('publish-start')?.value||currentDate();const through=document.getElementById(type==='monthly'?'publish-monthly-through':'publish-hourly-through')?.value;
    if(!through)return notify('公開終了日を選んでください');if(through<start)return notify('公開終了日は開始日以降にしてください');
    state.startDate=start;state[type==='monthly'?'monthlyThrough':'hourlyThrough']=through;state.updatedAt=new Date().toISOString();state.lastType=type;
    localStorage.setItem(KEY,JSON.stringify(state));renderModal();renderStatus();notify(`${type==='monthly'?'正社員':'アルバイト'}の公開範囲を更新しました`);
  }

  function renderStatus(){
    const state=load();const el=document.getElementById('publish-top-status');if(!el)return;
    if(!state.monthlyThrough&&!state.hourlyThrough){el.className='publish-top-status draft';el.textContent='未公開';return;}
    el.className='publish-top-status live';el.textContent=`社員 ${shortDate(state.monthlyThrough)||'—'} / バイト ${shortDate(state.hourlyThrough)||'—'}`;
  }

  function renderModal(){
    const state=load();const start=document.getElementById('publish-start');if(start&&!start.value)start.value=state.startDate||currentDate();
    document.getElementById('publish-monthly-current').innerHTML=state.monthlyThrough?`公開済み：<b>${state.startDate||'—'} 〜 ${state.monthlyThrough}</b>`:'<span>まだ公開していません</span>';
    document.getElementById('publish-hourly-current').innerHTML=state.hourlyThrough?`公開済み：<b>${state.startDate||'—'} 〜 ${state.hourlyThrough}</b>`:'<span>まだ公開していません</span>';
    const counts=countPublished(state);document.getElementById('publish-summary').innerHTML=`<div><span>公開対象シフト</span><strong>${counts.total}件</strong></div><div><span>正社員</span><strong>${counts.monthly}件</strong></div><div><span>アルバイト</span><strong>${counts.hourly}件</strong></div><div><span>対象従業員</span><strong>${counts.people}名</strong></div>`;
    document.getElementById('publish-message').value=buildMessage(state,counts);
  }

  function countPublished(state){
    const staff=normalizeStaff(loadJson(STAFF_KEY,[]));const shifts=loadJson(SHIFT_KEY,{});let monthly=0,hourly=0;const people=new Set();
    Object.entries(shifts).forEach(([date,rows])=>(Array.isArray(rows)?rows:[]).forEach(s=>{const p=staff.find(x=>x.id===String(s.staffId||'').toUpperCase());if(!p)return;const through=isMonthly(p)?state.monthlyThrough:state.hourlyThrough;if(through&&(!state.startDate||date>=state.startDate)&&date<=through){if(isMonthly(p))monthly++;else hourly++;people.add(p.id);}}));
    return{monthly,hourly,total:monthly+hourly,people:people.size};
  }

  function buildMessage(state,counts){
    const parts=['【シフト公開のお知らせ】'];
    if(state.monthlyThrough)parts.push(`正社員：${state.startDate||''}〜${state.monthlyThrough}`);
    if(state.hourlyThrough)parts.push(`アルバイト：${state.startDate||''}〜${state.hourlyThrough}`);
    parts.push(`公開対象：${counts.people}名 / ${counts.total}シフト`,'各自、シフトを確認してください。変更が必要な場合はシフト担当者まで連絡してください。');return parts.join('\n');
  }

  async function copyMessage(){const text=document.getElementById('publish-message')?.value||'';try{await navigator.clipboard.writeText(text);notify('通知文をコピーしました');}catch{const ta=document.getElementById('publish-message');ta?.select();document.execCommand('copy');notify('通知文をコピーしました');}}
  function normalizeStaff(list){return(Array.isArray(list)?list:[]).map(p=>({...p,id:String(p.id||p.employeeNumber||'').toUpperCase()})).filter(p=>p.id&&p.active!==false);}
  function isMonthly(p){if(p.salaryType)return p.salaryType==='monthly';return['正社員','契約社員','役員'].includes(p.employmentType);}
  function load(){return loadJson(KEY,{});}function currentDate(){return document.getElementById('work-date')?.value||dateKey(new Date());}
  function addDays(date,n){const d=new Date(`${date}T00:00:00`);d.setDate(d.getDate()+n);return dateKey(d);}function shortDate(d){return d?`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`:'';}function dateKey(d){d=new Date(d);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function loadJson(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}}
  function notify(m){const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400);}

  function injectStyles(){if(document.getElementById('publish-style'))return;const s=document.createElement('style');s.id='publish-style';s.textContent=`
    .publish-top-status{font-size:8px;font-weight:900;border-radius:999px;padding:4px 7px;border:1px solid #475467;color:#cbd5e1}.publish-top-status.live{color:#6ce9a6;border-color:#039855;background:#053321}.publish-top-status.draft{color:#fdb022;border-color:#b54708;background:#3b2415}.publish-modal-bg{position:fixed;inset:0;z-index:600;background:rgba(15,23,42,.7);display:none;align-items:center;justify-content:center;padding:16px}.publish-modal-bg.open{display:flex}.publish-modal{width:min(900px,100%);max-height:94vh;background:#fff;border-radius:16px;overflow:hidden;display:flex;flex-direction:column}.publish-modal-head,.publish-modal-foot{display:flex;justify-content:space-between;align-items:center;padding:13px 15px;border-bottom:1px solid #e4e7ec}.publish-modal-foot{border-bottom:0;border-top:1px solid #e4e7ec}.publish-modal-head>div{display:flex;align-items:baseline;gap:8px}.publish-modal-head strong{font-size:14px}.publish-modal-head span{font-size:8px;color:#667085}.publish-modal-body{padding:13px 15px;overflow:auto}.publish-note{display:flex;gap:7px;padding:8px 9px;background:#eff8ff;border:1px solid #d1e9ff;border-radius:8px;color:#175cd3;font-size:8px}.publish-start-row{display:flex;align-items:center;gap:7px;margin-top:10px}.publish-start-row label{font-size:8px;font-weight:900}.publish-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.publish-card{display:grid;grid-template-columns:36px 1fr;gap:6px 8px;border:1px solid #e4e7ec;border-radius:10px;padding:10px}.publish-icon{grid-row:1/3;width:34px;height:34px;border-radius:9px;display:grid;place-items:center}.publish-icon.monthly{background:#f4ebff;color:#6941c6}.publish-icon.hourly{background:#eff8ff;color:#175cd3}.publish-card strong{display:block;font-size:10px}.publish-card span{font-size:8px;color:#667085}.publish-current{grid-column:1/-1;background:#f9fafb;border-radius:7px;padding:6px;font-size:8px}.publish-current b{color:#027a48}.publish-actions{grid-column:1/-1;display:flex;gap:5px;align-items:center}.publish-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}.publish-summary>div{border:1px solid #e4e7ec;border-radius:8px;padding:7px}.publish-summary span{display:block;font-size:7px;color:#667085}.publish-summary strong{display:block;font-size:14px}.publish-message-box{margin-top:10px;border:1px solid #e4e7ec;border-radius:9px;padding:9px}.publish-message-box>div strong{font-size:9px}.publish-message-box>div span{font-size:7px;color:#667085;margin-left:6px}.publish-message-box textarea{width:100%;height:100px;margin:7px 0;border:1px solid #d0d5dd;border-radius:7px;padding:8px;font-size:9px;resize:vertical}@media(max-width:700px){.publish-grid{grid-template-columns:1fr}.publish-summary{grid-template-columns:repeat(2,1fr)}}
  `;document.head.appendChild(s);}
})();