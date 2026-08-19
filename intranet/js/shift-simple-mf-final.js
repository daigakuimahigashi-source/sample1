(() => {
  'use strict';

  const PROFILE_KEY='okk_shift_simple_mf_profile_final';
  const SHIFT_KEY='okk_shift_simple_shifts';
  const STAFF_KEY='okk_shift_v2_staff';
  const KNOWN_HEADERS=['従業員番号','苗字','名前','日付','勤怠区分','勤務パターン','開始時刻','終了時刻','休憩開始時刻1','休憩終了時刻1','休憩開始時刻2','休憩終了時刻2','休憩開始時刻3','休憩終了時刻3'];

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();

  function init(){replaceButtons();injectControls();bind();render();}

  function replaceButtons(){
    const oldDownload=document.getElementById('csv-download');if(oldDownload){const clone=oldDownload.cloneNode(true);oldDownload.replaceWith(clone);}
    const oldRefresh=document.getElementById('csv-refresh');if(oldRefresh){const clone=oldRefresh.cloneNode(true);oldRefresh.replaceWith(clone);}
  }

  function injectControls(){
    if(document.getElementById('mf-final-file'))return;
    const toolbar=document.querySelector('#view-csv .toolbar');if(!toolbar)return;
    const download=document.getElementById('csv-download');
    const box=document.createElement('div');box.className='mf-final-controls';box.innerHTML=`<input id="mf-final-file" type="file" accept=".csv,text/csv" hidden><span id="mf-final-status"></span><button id="mf-final-load" type="button" class="btn btn-light"><i class="fa-solid fa-file-arrow-up"></i>MF実CSVを読込</button><button id="mf-final-clear" type="button" class="btn btn-light btn-small" title="テンプレート解除"><i class="fa-solid fa-trash"></i></button>`;
    if(download)toolbar.insertBefore(box,download);else toolbar.appendChild(box);
    const note=document.querySelector('#view-csv .simple-setting-note');if(note)note.innerHTML='<strong>本番出力はMFから取得した実CSVの読込が必須です。</strong> 1行目の列順を保持し、2行目に値があれば勤怠区分・勤務パターン等の固定値も引き継ぎます。従業員番号・氏名・日付・開始・終了だけシフトデータで差し替えます。';
  }

  function bind(){
    document.getElementById('mf-final-load')?.addEventListener('click',()=>document.getElementById('mf-final-file')?.click());
    document.getElementById('mf-final-file')?.addEventListener('change',importFile);
    document.getElementById('mf-final-clear')?.addEventListener('click',()=>{localStorage.removeItem(PROFILE_KEY);render();notify('MFテンプレートを解除しました');});
    document.getElementById('csv-refresh')?.addEventListener('click',e=>{e.preventDefault();render();});
    document.getElementById('csv-download')?.addEventListener('click',e=>{e.preventDefault();download();});
    document.getElementById('csv-start')?.addEventListener('change',render);
    document.getElementById('csv-end')?.addEventListener('change',render);
    document.querySelector('[data-view="csv"]')?.addEventListener('click',()=>setTimeout(render,0));
    window.addEventListener('storage',e=>{if([PROFILE_KEY,SHIFT_KEY,STAFF_KEY].includes(e.key))render();});
  }

  async function importFile(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    try{
      const text=await readText(file);const rows=parseCsv(text).filter(row=>row.some(cell=>String(cell||'').trim()!==''));const headers=(rows[0]||[]).map(v=>String(v||'').replace(/^\uFEFF/,'').trim());
      if(!headers.length)throw new Error('ヘッダー行を読み取れません');
      const sample=(rows[1]||[]).map(v=>String(v??''));const defaults={};headers.forEach((h,i)=>{defaults[h]=sample[i]??'';});
      const dynamicHits=headers.filter(h=>dynamicType(h));
      if(!dynamicHits.some(h=>dynamicType(h)==='employee'))throw new Error('従業員番号列を確認できません');
      if(!dynamicHits.some(h=>dynamicType(h)==='date'))throw new Error('日付列を確認できません');
      if(!dynamicHits.some(h=>dynamicType(h)==='start')||!dynamicHits.some(h=>dynamicType(h)==='end'))throw new Error('開始/終了時刻列を確認できません');
      localStorage.setItem(PROFILE_KEY,JSON.stringify({fileName:file.name,importedAt:new Date().toISOString(),headers,defaults,sampleRows:rows.length-1}));render();notify(`MF実CSVを登録しました（${headers.length}列）`);
    }catch(err){console.error(err);notify(`MF CSV読込エラー：${err.message||err}`);}
  }

  function render(){
    const p=profile();const status=document.getElementById('mf-final-status');const dl=document.getElementById('csv-download');const preview=document.getElementById('csv-preview');
    if(status){status.className=`mf-final-status ${p?'ready':'required'}`;status.innerHTML=p?`<i class="fa-solid fa-circle-check"></i> ${esc(p.fileName)} / ${p.headers.length}列`:'<i class="fa-solid fa-circle-exclamation"></i> MF実CSV未登録';}
    if(dl){dl.disabled=!p;dl.title=p?'Shift-JISでMF用CSVを保存':'先に「MF実CSVを読込」してください';}
    if(preview){if(p)preview.value=buildCsv(p);else preview.value=`${KNOWN_HEADERS.join(',')}\r\n\r\n※ 本番出力するには「MF実CSVを読込」してください。`;}
  }

  function buildCsv(p){
    const start=document.getElementById('csv-start')?.value||'';const end=document.getElementById('csv-end')?.value||'';const staff=normalizeStaff(loadJson(STAFF_KEY,[]));const staffMap=new Map(staff.map(x=>[x.id,x]));const shifts=loadJson(SHIFT_KEY,{});const rows=[p.headers];
    Object.entries(shifts).sort(([a],[b])=>a.localeCompare(b)).forEach(([date,day])=>{
      if(start&&date<start)return;if(end&&date>end)return;
      (Array.isArray(day)?day:[]).slice().sort((a,b)=>String(a.staffId).localeCompare(String(b.staffId))).forEach(shift=>{
        const person=staffMap.get(String(shift.staffId||'').toUpperCase())||{id:String(shift.staffId||'').toUpperCase(),name:'',lastName:'',firstName:''};
        rows.push(p.headers.map(h=>value(h,p.defaults?.[h]??'',{date,shift,person})));
      });
    });
    return rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
  }

  function value(header,defaultValue,ctx){
    const type=dynamicType(header);if(type==='employee')return ctx.person.id;if(type==='last')return ctx.person.lastName;if(type==='first')return ctx.person.firstName;if(type==='name')return ctx.person.name;if(type==='date')return ctx.date.replaceAll('-','/');if(type==='start')return mfTime(ctx.shift.start);if(type==='end')return mfTime(ctx.shift.end);
    if(type==='breakStart'||type==='breakEnd')return defaultValue||'';
    return defaultValue;
  }

  function dynamicType(header){
    const k=norm(header);if(['従業員番号','従業員コード','社員番号','employeeid','employeenumber'].some(x=>k===norm(x)))return'employee';if(['苗字','姓','lastname'].some(x=>k===norm(x)))return'last';if(['名前','名','firstname'].some(x=>k===norm(x)))return'first';if(['氏名','従業員名','社員名','name'].some(x=>k===norm(x)))return'name';if(['日付','勤務日','対象日','date'].some(x=>k===norm(x)))return'date';if(['開始時刻','勤務開始時刻','出勤時刻','所定開始時刻','予定開始時刻','starttime'].some(x=>k===norm(x)))return'start';if(['終了時刻','勤務終了時刻','退勤時刻','所定終了時刻','予定終了時刻','endtime'].some(x=>k===norm(x)))return'end';if(/休憩.*(開始|start)/i.test(String(header||'')))return'breakStart';if(/休憩.*(終了|end)/i.test(String(header||'')))return'breakEnd';return'';
  }

  function normalizeStaff(list){return(Array.isArray(list)?list:[]).map(raw=>{const id=String(raw.id||raw.employeeNumber||'').toUpperCase();const name=String(raw.name||`${raw.lastName||''} ${raw.firstName||''}`).trim();const parts=name.split(/\s+/);return{...raw,id,name,lastName:String(raw.lastName||parts[0]||''),firstName:String(raw.firstName||parts.slice(1).join(' ')||'')};}).filter(x=>x.id);}
  function mfTime(total){const n=Number(total||0);return`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}

  function download(){const p=profile();if(!p)return notify('先にMF実CSVを読み込んでください');const csv=buildCsv(p);let blob;if(window.Encoding){const unicode=window.Encoding.stringToCode(csv);const sjis=window.Encoding.convert(unicode,{to:'SJIS',from:'UNICODE'});blob=new Blob([new Uint8Array(sjis)],{type:'text/csv;charset=shift_jis'});}else{blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});}const start=document.getElementById('csv-start')?.value||'start',end=document.getElementById('csv-end')?.value||'end';const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`MFシフト_${start}_${end}.csv`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);notify('MF用CSVを保存しました');}

  async function readText(file){const bytes=new Uint8Array(await file.arrayBuffer());if(window.Encoding){const detected=window.Encoding.detect(bytes)||'UTF8';const unicode=window.Encoding.convert(bytes,{to:'UNICODE',from:detected});return window.Encoding.codeToString(unicode).replace(/^\uFEFF/,'');}return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/,'');}
  function parseCsv(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')q=false;else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}return rows;}
  function csvCell(v){const t=String(v??'');return/[",\r\n]/.test(t)?`"${t.replaceAll('"','""')}"`:t;}
  function norm(v){return String(v||'').trim().toLowerCase().replace(/[\s　_\-()（）\[\]【】]/g,'');}
  function profile(){const p=loadJson(PROFILE_KEY,null);return p&&Array.isArray(p.headers)&&p.headers.length?p:null;}
  function loadJson(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}}
  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function notify(m){const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600);}

  const style=document.createElement('style');style.textContent='.mf-final-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:auto}.mf-final-status{font-size:8px;font-weight:900;border-radius:999px;padding:4px 6px}.mf-final-status.ready{background:#ecfdf3;color:#027a48}.mf-final-status.required{background:#fef3f2;color:#b42318}#csv-download:disabled{opacity:.45;cursor:not-allowed}';document.head.appendChild(style);
})();