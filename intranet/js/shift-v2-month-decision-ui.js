(() => {
  'use strict';

  const HOLIDAY_KEY = 'okk_shift_v2_holidays';
  const READINESS_KEY = 'okk_shift_v2_master_readiness_v1';
  const PANEL_ID = 'month-decision-panel';
  const STYLE_ID = 'shift-v2-month-decision-ui-style';
  let timer = null;
  let calculating = false;

  if (window.__shiftV2MonthDecisionUiInstalled) return;
  window.__shiftV2MonthDecisionUiInstalled = true;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    injectStyles();
    bindEvents();
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      if (event.target.closest?.('#month-builder-open,#month-builder-calc')) schedule(140);
    }, false);

    document.addEventListener('change', event => {
      if (['month-builder-month','month-builder-auto-off','month-builder-soft'].includes(event.target?.id)) schedule(140);
    }, false);

    document.addEventListener('shiftv2-master-readiness-changed', () => schedule(40));
    document.addEventListener('shiftv2-requested-off-changed', () => schedule(80));
  }

  function schedule(delay = 100) {
    clearTimeout(timer);
    timer = setTimeout(render, delay);
  }

  function render() {
    const modal = document.getElementById('month-builder-modal');
    const summary = document.getElementById('month-builder-summary');
    if (!modal?.classList.contains('open') || !summary || calculating) return;

    // 反映判定パネル側で正式/仮マスタを表示するため、旧バナーは重複表示しない。
    document.getElementById('master-readiness-banner')?.remove();

    const month = document.getElementById('month-builder-month')?.value || document.getElementById('work-date')?.value?.slice(0,7) || monthKey(new Date());
    const options = {
      autoOff: document.getElementById('month-builder-auto-off')?.checked !== false,
      includeSoft: Boolean(document.getElementById('month-builder-soft')?.checked),
    };

    const previewFn = window.shiftV2MonthBuilderEnhanced?.preview || window.shiftV2MonthBuilder?.preview;
    if (typeof previewFn !== 'function') return;

    calculating = true;
    let preview;
    try {
      preview = previewFn(month, options);
    } catch (error) {
      console.warn('Month decision preview failed', error);
      calculating = false;
      return;
    }
    calculating = false;
    if (!preview) return;

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'month-decision-panel';
      summary.insertAdjacentElement('beforebegin', panel);
    }

    const conflicts = Array.isArray(preview.conflicts) ? preview.conflicts : [];
    const blockers = conflicts.filter(item => ['company_closure','paid_leave','off'].includes(item?.type));
    const shortageGroups = groupShortages(preview.shortages || []);
    const targetShort = (preview.people || []).filter(person => {
      const target = Number(person.targetShiftDays ?? Math.max(0, Number(person.prescribedDays || 0) - Number(person.paid || 0)));
      return Number(person.shifts || 0) < target;
    });
    const overtimeOver = (preview.people || []).filter(person => Number(person.overtimeMinutes || 0) > Number(person.allowedOvertimeHours || 0) * 60);
    const readiness = loadReadiness();
    const masterConfirmed = readiness.staffSkillsConfirmed && readiness.staffingNeedConfirmed;
    const requestedOff = requestedOffCount(month);
    const employeeBase = Number(preview.baseProposals?.length || 0);
    const employeeExtra = Math.max(0, Number(preview.employeeProposals?.length || 0) - employeeBase);
    const parttime = Number(preview.parttimeProposals?.length || 0);

    const status = decisionStatus({ blockers, shortageGroups, targetShort, overtimeOver, masterConfirmed });

    panel.className = `month-decision-panel ${status.kind}`;
    panel.innerHTML = `
      <div class="month-decision-head">
        <div class="month-decision-title">
          <span>反映判定</span>
          <strong><i class="fa-solid ${status.icon}"></i> ${esc(status.title)}</strong>
          <small>${esc(status.text)}</small>
        </div>
        <div class="month-decision-master ${masterConfirmed ? 'confirmed' : 'provisional'}">
          <i class="fa-solid ${masterConfirmed ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
          ${masterConfirmed ? '正式マスタ' : '仮マスタ'}
        </div>
      </div>
      <div class="month-decision-flow">
        ${step('1','正社員 基礎配置',`${employeeBase}件`)}
        <i class="fa-solid fa-chevron-right"></i>
        ${step('2','社員 追加補完',`${employeeExtra}件`)}
        <i class="fa-solid fa-chevron-right"></i>
        ${step('3','バイト補完',`${parttime}件`)}
        <i class="fa-solid fa-chevron-right"></i>
        ${step('4','残る不足',`${shortageGroups.length}店舗日`, shortageGroups.length ? 'warn' : 'ok')}
      </div>
      <div class="month-decision-checks">
        ${checkItem('希望休', `${requestedOff}件反映`, 'ok', 'fa-calendar-xmark')}
        ${checkItem('既存シフト重複', blockers.length ? `${blockers.length}件 要修正` : 'なし', blockers.length ? 'danger' : 'ok', blockers.length ? 'fa-circle-xmark' : 'fa-circle-check')}
        ${checkItem('社員勤務目標', targetShort.length ? `${targetShort.length}名 未達` : '全員到達', targetShort.length ? 'warn' : 'ok', targetShort.length ? 'fa-triangle-exclamation' : 'fa-circle-check')}
        ${checkItem('予定時間外', overtimeOver.length ? `${overtimeOver.length}名 上限超過` : '上限内', overtimeOver.length ? 'warn' : 'ok', overtimeOver.length ? 'fa-triangle-exclamation' : 'fa-circle-check')}
        ${checkItem('不足', shortageGroups.length ? `${shortageGroups.length}店舗日` : 'なし', shortageGroups.length ? 'warn' : 'ok', shortageGroups.length ? 'fa-triangle-exclamation' : 'fa-circle-check')}
      </div>
      ${status.action ? `<div class="month-decision-action"><strong>次に見るところ</strong><span>${esc(status.action)}</span></div>` : ''}
    `;

    const apply = document.getElementById('month-builder-apply');
    if (apply) {
      apply.disabled = blockers.length > 0;
      apply.title = blockers.length ? '会社休業・公休・有休との重複を先に解消してください' : '';
    }
  }

  function decisionStatus({ blockers, shortageGroups, targetShort, overtimeOver, masterConfirmed }) {
    if (blockers.length) {
      return {
        kind:'danger', icon:'fa-circle-xmark', title:'反映前に修正が必要',
        text:`既存シフトとの重複が${blockers.length}件あります。`,
        action:'赤い「既存データとの重複」を解消してから再計算してください。',
      };
    }
    if (!masterConfirmed) {
      return {
        kind:'provisional', icon:'fa-flask', title:'仮マスタで計算中',
        text:'ロジック確認としては反映できますが、不足判定は参考値です。',
        action: shortageGroups.length ? '不足日は参考値として確認。現場確認完了後にもう一度再計算します。' : '現場確認完了後に再計算すると正式判定になります。',
      };
    }
    if (overtimeOver.length || targetShort.length || shortageGroups.length) {
      const parts = [];
      if (shortageGroups.length) parts.push(`不足${shortageGroups.length}店舗日`);
      if (targetShort.length) parts.push(`勤務目標未達${targetShort.length}名`);
      if (overtimeOver.length) parts.push(`時間外上限超過${overtimeOver.length}名`);
      return {
        kind:'warning', icon:'fa-triangle-exclamation', title:'反映可能・要確認あり',
        text:`${parts.join(' / ')}。`,
        action: shortageGroups.length ? '反映後は不足が残る店舗日だけ個別修正してください。' : '社員サマリーの警告行を確認してください。',
      };
    }
    return {
      kind:'good', icon:'fa-circle-check', title:'そのまま反映OK',
      text:'重複・不足・勤務目標未達・時間外上限超過はありません。',
      action:'「この案を反映」で月間AUTOを反映できます。',
    };
  }

  function groupShortages(rows) {
    const set = new Set();
    (Array.isArray(rows) ? rows : []).forEach(item => {
      const date = String(item?.date || '');
      const store = String(item?.rule?.storeId || '');
      if (date && store) set.add(`${date}|${store}`);
    });
    return Array.from(set);
  }

  function requestedOffCount(month) {
    try {
      const holiday = JSON.parse(localStorage.getItem(HOLIDAY_KEY)) || {};
      return (Array.isArray(holiday.staffDays) ? holiday.staffDays : []).filter(item => item?.requestedOff === true && String(item.date || '').startsWith(month)).length;
    } catch {
      return 0;
    }
  }

  function loadReadiness() {
    try {
      const value = JSON.parse(localStorage.getItem(READINESS_KEY)) || {};
      return { staffSkillsConfirmed:Boolean(value.staffSkillsConfirmed), staffingNeedConfirmed:Boolean(value.staffingNeedConfirmed) };
    } catch {
      return { staffSkillsConfirmed:false, staffingNeedConfirmed:false };
    }
  }

  function step(no, label, value, state = '') {
    return `<div class="month-decision-step ${state}"><b>${no}</b><span><small>${esc(label)}</small><strong>${esc(value)}</strong></span></div>`;
  }

  function checkItem(label, value, state, icon) {
    return `<div class="month-decision-check ${state}"><i class="fa-solid ${icon}"></i><span><small>${esc(label)}</small><strong>${esc(value)}</strong></span></div>`;
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .month-decision-panel{margin:10px 0 12px;padding:12px 14px;border:1px solid #d0d5dd;border-radius:12px;background:#fff;font-family:'Noto Sans JP',sans-serif}
      .month-decision-panel.good{border-color:#abefc6;background:#f6fef9}.month-decision-panel.warning{border-color:#fedf89;background:#fffcf5}.month-decision-panel.danger{border-color:#fecdca;background:#fffafa}.month-decision-panel.provisional{border-color:#b2ddff;background:#f5fbff}
      .month-decision-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.month-decision-title>span{display:block;font-size:8px;font-weight:900;letter-spacing:.08em;color:#667085}.month-decision-title>strong{display:block;margin-top:2px;font-size:15px;color:#101828}.month-decision-title>strong i{margin-right:5px}.month-decision-title>small{display:block;margin-top:4px;font-size:9px;font-weight:700;color:#475467}
      .month-decision-master{display:flex;align-items:center;gap:5px;border-radius:999px;padding:5px 8px;font-size:8px;font-weight:900;white-space:nowrap}.month-decision-master.confirmed{background:#dcfae6;color:#067647}.month-decision-master.provisional{background:#eff8ff;color:#175cd3}
      .month-decision-flow{display:flex;align-items:center;gap:6px;margin-top:11px;padding:9px;border:1px solid #eaecf0;border-radius:9px;background:#fff;overflow:auto}.month-decision-flow>i{font-size:8px;color:#98a2b3;flex:0 0 auto}.month-decision-step{display:flex;align-items:center;gap:6px;min-width:130px}.month-decision-step>b{display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:#f2f4f7;color:#475467;font-size:9px}.month-decision-step span small,.month-decision-step span strong{display:block}.month-decision-step span small{font-size:7px;color:#667085;font-weight:800}.month-decision-step span strong{font-size:10px;color:#101828}.month-decision-step.ok>b{background:#dcfae6;color:#067647}.month-decision-step.warn>b{background:#fef0c7;color:#b54708}
      .month-decision-checks{display:grid;grid-template-columns:repeat(5,minmax(110px,1fr));gap:6px;margin-top:8px}.month-decision-check{display:flex;align-items:center;gap:7px;border:1px solid #eaecf0;border-radius:8px;background:#fff;padding:7px 8px}.month-decision-check>i{font-size:12px}.month-decision-check span small,.month-decision-check span strong{display:block}.month-decision-check span small{font-size:7px;color:#667085;font-weight:800}.month-decision-check span strong{font-size:9px;color:#344054}.month-decision-check.ok>i{color:#17b26a}.month-decision-check.warn>i{color:#f79009}.month-decision-check.danger>i{color:#f04438}
      .month-decision-action{display:flex;gap:8px;align-items:center;margin-top:8px;padding:7px 9px;border-radius:8px;background:rgba(255,255,255,.78);font-size:8px;color:#475467}.month-decision-action strong{color:#344054;white-space:nowrap}
      @media(max-width:900px){.month-decision-checks{grid-template-columns:repeat(2,minmax(120px,1fr))}.month-decision-head{flex-direction:column}.month-decision-flow{align-items:stretch}.month-decision-step{min-width:115px}}
    `;
    document.head.appendChild(style);
  }
})();
