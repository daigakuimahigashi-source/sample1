(() => {
  'use strict';

  const SHIFTS='okk_shift_v2_shifts';
  const STAFF='okk_shift_v2_staff';
  const SETTINGS='okk_shift_v2_mf_export_settings';
  const HEADERS=['従業員番号','苗字','名前','日付','勤怠区分','勤務パターン','開始時刻','終了時刻','休憩開始時刻1','休憩終了時刻1','休憩開始時刻2','休憩終了時刻2','休憩開始時刻3','休憩終了時刻3'];

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();

  function init(){
    const view=document.getElementById('view-csv');
    if(!view)return setTimeout(init,100);
    if(view.dataset.mfV2==='1')return;
    view.dataset.mfV2='1';
    injectUi(view);bind();render();
  }

  function injectUi(view){
    document.getElementById('csv-preview')?.style.setProperty('display','none');
    const box=document.createElement('div');
    box.id='mf-v2-box';
    box.innerHTML=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><strong style="font-size:11px">MFクラウド勤怠 CSV設定</strong><label style="font-size:10px">通常勤務の勤怠区分 <select id="mf-attendance-type" class="control"><option value="">未設定</option><option>平日</option><option>所定休日</option><option>法定休日</option><option>休日</option></select></label></div><div id="mf-v2-status" style="font-size:10px;margin-bottom:8px"></div><div id="mf-v2-preview" style="overflow-x:auto;overflow-y:visible;max-height:none"></div>`;
    view.querySelector('.csv-panel')?.prepend(box);
    const saved=read(SETTINGS,{});
    document.getElementById('mf-attendance-type').value=saved.defaultAttendanceType||'';
  }

  function bind(){
    document.addEventListener('change',e=>{
      if(e.target?.id==='mf-attendance-type'){
        write(SETTINGS,{defaultAttendanceType:e.target.value});render();
      }
      if(e.target?.id==='csv-start'||e.target?.id==='csv-end')render();
    });
    document.addEventListener('click',e=>{
      if(e.target.closest?.('#csv-refresh')){e.preventDefault();e.stopImmediatePropagation();render();}
      if(e.target.closest?.('#csv-download')){e.preventDefault();e.stopImmediatePropagation();download();}
      if(e.target.closest?.('[data-view="csv"]'))setTimeout(render,0);
    },true);
  }

  function build(){
    const start=document.getElementById('csv-start')?.value||'';
    const end=document.getElementById('csv-end')?.value||'';
    const attendance=read(SETTINGS,{}).defaultAttendanceType||'';
    const staff=(read(STAFF,[])||[]).map(p=>({...p,id:canon(p.id||p.employeeNumber)}));
    const shifts=read(SHIFTS,{});
    const rows=[];const errors=[];const seen=new Set();

    Object.keys(shifts||{}).sort().forEach(date=>{
      if(start&&date<start||end&&date>end)return;
      (Array.isArray(shifts[date])?shifts[date]:[]).forEach(shift=>{
        const id=canon(shift.staffId);
        const person=staff.find(p=>p.id===id);
        const employee=String(person?.employeeNumber||person?.id||id).toUpperCase();
        const key=`${employee}|${date}`;
        if(seen.has(key))errors.push(`${date} ${employee}: 同一日に複数シフトがあります`);else seen.add(key);
        if(!attendance)errors.push('通常勤務の勤怠区分が未設定です');
        if(!person)errors.push(`${date} ${employee}: 従業員マスタ未登録`);
        const startMin=Number(shift.start),endMin=Number(shift.end);
        if(!Number.isFinite(startMin)||!Number.isFinite(endMin)||endMin<=startMin)errors.push(`${date} ${employee}: 時刻が不正です`);
        const [last,first]=splitName(person?.name||employee);
        rows.push([employee,last,first,date.replaceAll('-','/'),attendance,'',fmt(startMin),fmt(endMin),'','','','','','']);
      });
    });
    const csv=[HEADERS,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
    return{rows,errors:[...new Set(errors)],csv};
  }

  function render(){
    const result=build();
    const status=document.getElementById('mf-v2-status');
    const preview=document.getElementById('mf-v2-preview');
    const button=document.getElementById('csv-download');
    if(status)status.innerHTML=result.errors.length?`<span style="color:#b42318;font-weight:800">要確認 ${result.errors.length}件</span>　${result.errors.slice(0,3).map(esc).join(' / ')}`:`<span style="color:#067647;font-weight:800">出力可能 ${result.rows.length}行</span>　翌日5:00は29:00として出力`;
    if(preview)preview.innerHTML=result.rows.length?`<table style="min-width:1450px;font-size:9px"><thead><tr>${HEADERS.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${result.rows.slice(0,100).map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<div style="padding:16px;color:#98a2b3">対象シフトなし</div>';
    if(button)button.disabled=Boolean(result.errors.length)||!result.rows.length;
  }

  function download(){
    const result=build();
    if(result.errors.length)return alert('MF CSVを保存できません。\n'+result.errors.slice(0,5).join('\n'));
    if(!window.Encoding?.convert)return alert('CP932変換ライブラリの読み込み待ちです。');
    const codes=window.Encoding.stringToCode(result.csv);
    const sjis=window.Encoding.convert(codes,{to:'SJIS',from:'UNICODE'});
    const blob=new Blob([new Uint8Array(sjis)],{type:'text/csv;charset=Shift_JIS'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mf_shift.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function fmt(v){if(!Number.isFinite(v))return'';const h=Math.floor(v/60),m=v%60;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;}
  function splitName(v){const p=String(v||'').trim().split(/\s+/);return[p.shift()||'',p.join(' ')];}
  function canon(v){return String(v||'').trim().toUpperCase();}
  function cell(v){const s=String(v??'');return/[",\r\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
  function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v));}
  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
})();
