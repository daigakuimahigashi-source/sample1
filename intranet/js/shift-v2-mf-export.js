(() => {
  'use strict';

  const SHIFTS = 'okk_shift_v2_shifts';
  const STAFF = 'okk_shift_v2_staff';
  const HOLIDAYS = 'okk_shift_v2_holidays';
  const HEADERS = [
    '従業員番号','苗字','名前','日付','勤怠区分','勤務パターン','開始時刻','終了時刻',
    '休憩開始時刻1','休憩終了時刻1','休憩開始時刻2','休憩終了時刻2','休憩開始時刻3','休憩終了時刻3'
  ];
  let retries = 0;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

  function init() {
    const view = document.getElementById('view-csv');
    if (!view) {
      if (retries++ < 40) setTimeout(init, 100);
      return;
    }
    if (view.dataset.mfV4 === '1') return;
    view.dataset.mfV4 = '1';
    injectUi(view);
    bind();
    render();
  }

  function injectUi(view) {
    const oldPreview = document.getElementById('csv-preview');
    if (oldPreview) oldPreview.style.display = 'none';
    document.getElementById('mf-v2-box')?.remove();
    document.getElementById('mf-v3-box')?.remove();

    const box = document.createElement('div');
    box.id = 'mf-v4-box';
    box.innerHTML = `
      <div class="mf-note">
        <strong>MFクラウド勤怠 連携設定</strong>
        <span>勤務日＝平日 / 公休・会社休日＝休日 / 日付変更 8:00 / 休憩は実打刻</span>
      </div>
      <div class="mf-rule-row">
        <span><b>勤務パターン</b> 空欄</span>
        <span><b>予定時刻</b> OKKの開始・終了を出力</span>
        <span><b>翌日5:00</b> 29:00</span>
        <span><b>翌日6:00</b> 30:00</span>
        <span><b>休憩</b> CSVは空欄、MFで休憩開始/終了を打刻</span>
      </div>
      <div id="mf-v4-status"></div>
      <div id="mf-v4-errors"></div>
      <div id="mf-v4-preview"></div>`;
    view.querySelector('.csv-panel')?.prepend(box);
    injectStyles();
  }

  function bind() {
    document.addEventListener('change', event => {
      if (event.target?.id === 'csv-start' || event.target?.id === 'csv-end') render();
    });
    document.addEventListener('click', event => {
      if (event.target.closest?.('#csv-refresh')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        render();
      }
      if (event.target.closest?.('#csv-download')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        download();
      }
      if (event.target.closest?.('[data-view="csv"]')) setTimeout(render, 0);
    }, true);
  }

  function build() {
    const startDate = document.getElementById('csv-start')?.value || '';
    const endDate = document.getElementById('csv-end')?.value || '';
    const rawStaff = Array.isArray(read(STAFF, [])) ? read(STAFF, []) : [];
    const masterCheck = validateStaffMaster(rawStaff);
    const staff = normalizeStaff(rawStaff);
    const shifts = read(SHIFTS, {});
    const holidays = normalizeHolidays(read(HOLIDAYS, {}));
    const rows = [];
    const errors = [...masterCheck.errors];
    const warnings = [...masterCheck.warnings];
    const seen = new Map();
    const exportPeople = new Set();
    let nextDay = 0;
    let thirtyHour = 0;
    let holidayRows = 0;

    Object.keys(shifts || {}).sort().forEach(date => {
      if ((startDate && date < startDate) || (endDate && date > endDate)) return;
      const dayRows = Array.isArray(shifts[date]) ? shifts[date] : [];

      dayRows.forEach(shift => {
        const staffId = canon(shift.staffId);
        const matches = staff.filter(item => item.id === staffId);
        const person = matches[0];
        const employeeNumber = String(person?.employeeNumber || person?.id || shift.staffId || '').trim().toUpperCase();
        const displayName = person?.name || employeeNumber;
        const label = `${date} ${displayName}`;

        if (!person) errors.push(`${label}: 従業員マスタに一致しません`);
        if (matches.length > 1) errors.push(`${label}: 同じ従業員番号が従業員マスタに複数あります`);
        if (!employeeNumber) errors.push(`${label}: 従業員番号がありません`);
        if (employeeNumber) exportPeople.add(employeeNumber);

        const key = `${employeeNumber}|${date}`;
        seen.set(key, (seen.get(key) || 0) + 1);

        const start = numberOrNull(shift.start);
        const end = numberOrNull(shift.end);
        if (start === null || end === null || end <= start) errors.push(`${label}: 開始・終了時刻が不正です`);
        if (end !== null && end >= 24 * 60) nextDay += 1;
        if (end !== null && end >= 30 * 60) thirtyHour += 1;

        const dayType = attendanceType(date, staffId, holidays);
        if (dayType.error) errors.push(`${label}: ${dayType.error}`);
        if (dayType.value === '休日') holidayRows += 1;

        const [last, first] = splitName(person, displayName);
        rows.push([
          employeeNumber,
          last,
          first,
          date.replaceAll('-', '/'),
          dayType.value,
          '',
          start === null ? '' : fmt(start),
          end === null ? '' : fmt(end),
          '', '', '', '', '', ''
        ]);
      });
    });

    seen.forEach((count, key) => {
      if (count <= 1) return;
      const [employeeNumber, date] = key.split('|');
      errors.push(`${date} ${employeeNumber}: 同一日に${count}件のシフトがあります。MFは同一従業員・同一日を複数行にできません`);
    });

    rows.sort((a, b) => a[0].localeCompare(b[0]) || a[3].localeCompare(b[3]));
    const csv = [HEADERS, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    return {
      rows,
      errors:[...new Set(errors)],
      warnings:[...new Set(warnings)],
      csv,
      nextDay,
      thirtyHour,
      holidayRows,
      exportPeople:exportPeople.size,
      activeStaff:masterCheck.activeCount,
      mfSynced:masterCheck.mfSynced
    };
  }

  function validateStaffMaster(rawStaff) {
    const errors = [];
    const warnings = [];
    const active = rawStaff.filter(person => person?.active !== false);
    const numberMap = new Map();
    let mfSynced = 0;

    active.forEach(person => {
      const raw = String(person?.employeeNumber || person?.id || '').trim();
      const number = canon(raw);
      if (!number) {
        warnings.push(`${person?.name || '氏名未設定'}: 従業員番号が未設定です`);
        return;
      }
      if (!numberMap.has(number)) numberMap.set(number, []);
      numberMap.get(number).push(person);
      if (raw !== number) warnings.push(`${person?.name || number}: 従業員番号はCSV出力時に ${number} へ大文字化します`);
      if (person?.mf?.syncedAt) mfSynced += 1;
    });

    numberMap.forEach((people, number) => {
      if (people.length <= 1) return;
      errors.push(`従業員番号 ${number}: ${people.length}名に重複しています（${people.map(person => person.name || '氏名未設定').join(' / ')}）`);
    });

    return { errors, warnings, activeCount:active.length, mfSynced };
  }

  function attendanceType(date, staffId, holidays) {
    const staffDay = holidays.staffDays.find(row => row.date === date && canon(row.staffId) === staffId);
    if (staffDay?.type === 'paid_leave') return { value:'', error:'有休登録日と予定シフトが重複しています' };
    if (staffDay?.type === 'off') return { value:'休日' };
    if (holidays.companyClosures.some(row => row.date === date)) return { value:'休日' };
    return { value:'平日' };
  }

  function render() {
    const result = build();
    const status = document.getElementById('mf-v4-status');
    const errors = document.getElementById('mf-v4-errors');
    const preview = document.getElementById('mf-v4-preview');
    const button = document.getElementById('csv-download');

    if (status) {
      status.innerHTML = `
        <div class="mf-metric"><small>出力従業員</small><strong>${result.exportPeople}名</strong><span>在籍 ${result.activeStaff}名</span></div>
        <div class="mf-metric"><small>出力対象</small><strong>${result.rows.length}行</strong><span>休日 ${result.holidayRows}行</span></div>
        <div class="mf-metric"><small>日跨ぎ</small><strong>${result.nextDay}行</strong><span>30:00到達 ${result.thirtyHour}行</span></div>
        <div class="mf-metric ${result.errors.length ? 'bad' : 'good'}"><small>事前チェック</small><strong>${result.errors.length ? `エラー ${result.errors.length}` : 'OK'}</strong><span>注意 ${result.warnings.length}件</span></div>`;
    }

    if (errors) {
      const errorHtml = result.errors.length
        ? `<div class="mf-error"><strong>CSV保存前に修正が必要</strong><ul>${result.errors.slice(0,20).map(error => `<li>${esc(error)}</li>`).join('')}</ul></div>`
        : '<div class="mf-ok"><i class="fa-solid fa-circle-check"></i> MF取込用チェックを通過しています。休憩6列は空欄で出力します。</div>';
      const warningHtml = result.warnings.length
        ? `<div class="mf-warning"><strong>確認事項</strong><ul>${result.warnings.slice(0,20).map(warning => `<li>${esc(warning)}</li>`).join('')}</ul></div>`
        : '';
      errors.innerHTML = errorHtml + warningHtml;
    }

    if (preview) {
      preview.innerHTML = result.rows.length
        ? `<div class="mf-table-wrap"><table><thead><tr>${HEADERS.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${result.rows.slice(0,120).map(row => `<tr>${row.map(value => `<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : '<div class="mf-empty">対象期間に予定シフトがありません。</div>';
    }

    if (button) button.disabled = result.errors.length > 0 || result.rows.length === 0;
  }

  function download() {
    const result = build();
    if (!result.rows.length) return window.alert('対象期間に予定シフトがありません。');
    if (result.errors.length) {
      render();
      return window.alert('MF CSVを保存できません。\n' + result.errors.slice(0,5).join('\n'));
    }
    if (!window.Encoding?.convert || !window.Encoding?.stringToCode) {
      return window.alert('CP932変換ライブラリの読み込み待ちです。少し待ってから再度保存してください。');
    }

    const unicode = window.Encoding.stringToCode(result.csv);
    const sjis = window.Encoding.convert(unicode, { to:'SJIS', from:'UNICODE' });
    const blob = new Blob([new Uint8Array(sjis)], { type:'text/csv;charset=Shift_JIS' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `MFシフト_${document.getElementById('csv-start')?.value || '開始'}_${document.getElementById('csv-end')?.value || '終了'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function normalizeStaff(value) {
    return (Array.isArray(value) ? value : []).map(person => ({
      ...person,
      id:canon(person.id || person.employeeNumber),
      employeeNumber:String(person.employeeNumber || person.id || '').trim().toUpperCase()
    }));
  }

  function normalizeHolidays(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      companyClosures:Array.isArray(source.companyClosures) ? source.companyClosures : [],
      staffDays:Array.isArray(source.staffDays) ? source.staffDays : []
    };
  }

  function splitName(person, fallback) {
    const last = String(person?.lastName || person?.familyName || person?.sei || '').trim();
    const first = String(person?.firstName || person?.givenName || person?.mei || '').trim();
    if (last || first) return [last, first];
    const parts = String(fallback || '').trim().split(/\s+/).filter(Boolean);
    return [parts.shift() || '', parts.join(' ')];
  }

  function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  function fmt(total) {
    if (!Number.isFinite(total)) return '';
    const hour = Math.floor(total / 60);
    const minute = total % 60;
    return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }

  function canon(value) {
    return String(value || '').trim().toUpperCase();
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
  }

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[char]));
  }

  function injectStyles() {
    if (document.getElementById('mf-v4-style')) return;
    const style = document.createElement('style');
    style.id = 'mf-v4-style';
    style.textContent = `
      #mf-v4-box{font-size:10px;color:#344054}
      #mf-v4-box .mf-note{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:10px 12px;border:1px solid #b2ddff;background:#eff8ff;border-radius:9px;margin-bottom:8px}
      #mf-v4-box .mf-note strong{font-size:11px;color:#175cd3}#mf-v4-box .mf-note span{font-size:9px;color:#344054}
      #mf-v4-box .mf-rule-row{display:flex;gap:14px;flex-wrap:wrap;padding:8px 10px;border:1px solid #eaecf0;border-radius:8px;background:#fff;margin-bottom:8px;font-size:9px}
      #mf-v4-status{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}
      #mf-v4-status .mf-metric{border:1px solid #eaecf0;background:#fcfcfd;border-radius:8px;padding:7px 9px}#mf-v4-status .mf-metric.good{background:#ecfdf3;border-color:#abefc6}#mf-v4-status .mf-metric.bad{background:#fef3f2;border-color:#fecdca}
      #mf-v4-status small{display:block;font-size:8px;color:#667085}#mf-v4-status strong{display:block;font-size:13px;color:#101828;margin-top:2px}#mf-v4-status span{display:block;font-size:8px;color:#667085;margin-top:2px}
      #mf-v4-errors .mf-ok{padding:8px 10px;border:1px solid #abefc6;background:#ecfdf3;color:#067647;border-radius:8px;font-weight:800}
      #mf-v4-errors .mf-error{padding:8px 10px;border:1px solid #fecdca;background:#fef3f2;color:#b42318;border-radius:8px}#mf-v4-errors .mf-warning{padding:8px 10px;border:1px solid #fedf89;background:#fffaeb;color:#b54708;border-radius:8px;margin-top:6px}
      #mf-v4-errors ul{margin:5px 0 0;padding-left:18px;line-height:1.6}
      #mf-v4-preview .mf-table-wrap{overflow-x:auto!important;overflow-y:visible!important;max-height:none!important;margin-top:9px}
      #mf-v4-preview table{min-width:1500px;width:100%;border-collapse:collapse;font-size:9px}#mf-v4-preview th,#mf-v4-preview td{padding:6px 7px;border-bottom:1px solid #eaecf0;white-space:nowrap;text-align:left}#mf-v4-preview th{background:#f8fafc;font-weight:900}
      #mf-v4-preview .mf-empty{padding:20px;text-align:center;color:#98a2b3}
      #csv-download:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:760px){#mf-v4-box .mf-note{align-items:flex-start;flex-direction:column}#mf-v4-status{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }
})();
