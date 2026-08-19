(() => {
  'use strict';

  const TEMPLATE_KEY = 'okk_shift_simple_mf_template';
  const SHIFT_KEY = 'okk_shift_simple_shifts';
  const STAFF_KEY = 'okk_shift_v2_staff';
  const FALLBACK_HEADERS = [
    '従業員番号','苗字','名前','日付','勤怠区分','勤務パターン','開始時刻','終了時刻',
    '休憩開始時刻1','休憩終了時刻1','休憩開始時刻2','休憩終了時刻2','休憩開始時刻3','休憩終了時刻3'
  ];

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  function init() {
    const download = document.getElementById('csv-download');
    const refresh = document.getElementById('csv-refresh');
    const preview = document.getElementById('csv-preview');
    if (!download || !preview) return;

    injectControls();
    download.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      downloadCurrentCsv();
    }, true);
    refresh?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderPreview();
    }, true);
    document.querySelector('[data-view="csv"]')?.addEventListener('click', () => setTimeout(renderPreview, 0));
    document.getElementById('csv-start')?.addEventListener('change', renderPreview);
    document.getElementById('csv-end')?.addEventListener('change', renderPreview);
    renderStatus();
    renderPreview();
  }

  function injectControls() {
    if (document.getElementById('mf-template-file')) return;
    const toolbar = document.querySelector('#view-csv .toolbar');
    if (!toolbar) return;
    const right = toolbar.lastElementChild;
    const box = document.createElement('div');
    box.style.cssText = 'display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-left:auto';
    box.innerHTML = `
      <input id="mf-template-file" type="file" accept=".csv,text/csv" hidden>
      <span id="mf-template-status" style="font-size:9px;color:#667085;font-weight:800"></span>
      <button id="mf-template-load" type="button" class="btn btn-light"><i class="fa-solid fa-file-arrow-up"></i> MFテンプレート読込</button>
      <button id="mf-template-reset" type="button" class="btn btn-light" title="暫定14列へ戻す"><i class="fa-solid fa-rotate-left"></i></button>
    `;
    if (right && right.id === 'csv-download') toolbar.insertBefore(box, right);
    else toolbar.appendChild(box);

    document.getElementById('mf-template-load')?.addEventListener('click', () => document.getElementById('mf-template-file')?.click());
    document.getElementById('mf-template-file')?.addEventListener('change', importTemplate);
    document.getElementById('mf-template-reset')?.addEventListener('click', () => {
      localStorage.removeItem(TEMPLATE_KEY);
      renderStatus();
      renderPreview();
      notify('MFテンプレート設定を初期化しました');
    });

    const note = document.querySelector('#view-csv .simple-setting-note');
    if (note) note.innerHTML = 'MFクラウド勤怠向けCSV。<strong>実際にMFからダウンロードしたCSVを「MFテンプレート読込」に入れると、その列順を保持して出力</strong>します。未読込時は暫定14列形式です。店舗移動では分割せず、開始〜終了を1本で出力します。';
  }

  async function importTemplate(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await readText(file);
      const rows = parseCsv(text);
      const headers = (rows[0] || []).map(value => String(value || '').replace(/^\uFEFF/, '').trim());
      if (!headers.length || !headers.some(Boolean)) throw new Error('ヘッダー行を読み取れませんでした');
      const profile = { fileName: file.name, importedAt: new Date().toISOString(), headers };
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(profile));
      renderStatus();
      renderPreview();
      notify(`MFテンプレートを読み込みました（${headers.length}列）`);
    } catch (error) {
      console.error(error);
      notify(`MFテンプレート読込エラー: ${error.message || error}`);
    }
  }

  function renderStatus() {
    const el = document.getElementById('mf-template-status');
    if (!el) return;
    const profile = loadJson(TEMPLATE_KEY, null);
    el.textContent = profile?.headers?.length ? `MF: ${profile.headers.length}列・${profile.fileName || 'テンプレート'}` : 'MF: 暫定14列';
    el.title = profile?.headers?.join(' / ') || FALLBACK_HEADERS.join(' / ');
  }

  function renderPreview() {
    const preview = document.getElementById('csv-preview');
    if (!preview) return;
    preview.value = buildCsv();
  }

  function buildCsv() {
    const profile = loadJson(TEMPLATE_KEY, null);
    const headers = Array.isArray(profile?.headers) && profile.headers.length ? profile.headers : FALLBACK_HEADERS;
    const start = document.getElementById('csv-start')?.value || '';
    const end = document.getElementById('csv-end')?.value || '';
    const staff = normalizeStaff(loadJson(STAFF_KEY, []));
    const staffMap = new Map(staff.map(person => [person.id, person]));
    const shifts = loadJson(SHIFT_KEY, {});
    const rows = [headers];

    Object.entries(shifts).sort(([a], [b]) => a.localeCompare(b)).forEach(([date, day]) => {
      if (start && date < start) return;
      if (end && date > end) return;
      (Array.isArray(day) ? day : []).slice().sort((a, b) => String(a.staffId).localeCompare(String(b.staffId))).forEach(shift => {
        const person = staffMap.get(String(shift.staffId || '').toUpperCase()) || fallbackPerson(shift.staffId);
        const context = { date, shift, person };
        rows.push(headers.map(header => valueForHeader(header, context)));
      });
    });
    return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }

  function valueForHeader(header, { date, shift, person }) {
    const key = normalizeHeader(header);
    if (matches(key, ['従業員番号','従業員コード','社員番号','employeeid','employeenumber'])) return person.id;
    if (matches(key, ['苗字','姓','lastname'])) return person.lastName;
    if (matches(key, ['名前','名','firstname'])) return person.firstName;
    if (matches(key, ['氏名','従業員名','社員名','name'])) return person.name;
    if (matches(key, ['日付','勤務日','対象日','date'])) return date.replaceAll('-', '/');
    if (matches(key, ['勤怠区分','勤務区分','出勤区分'])) return '平日';
    if (matches(key, ['勤務パターン','勤務パターン名','就業パターン'])) return '';
    if (matches(key, ['開始時刻','勤務開始時刻','出勤時刻','所定開始時刻','予定開始時刻','starttime'])) return mfTime(shift.start);
    if (matches(key, ['終了時刻','勤務終了時刻','退勤時刻','所定終了時刻','予定終了時刻','endtime'])) return mfTime(shift.end);
    if (/休憩.*(開始|start)/i.test(String(header || ''))) return '';
    if (/休憩.*(終了|end)/i.test(String(header || ''))) return '';
    return '';
  }

  function matches(value, aliases) {
    return aliases.some(alias => value === normalizeHeader(alias));
  }

  function normalizeHeader(value) {
    return String(value || '').trim().toLowerCase().replace(/[\s　_\-()（）\[\]【】]/g, '');
  }

  function normalizeStaff(list) {
    if (!Array.isArray(list)) return [];
    return list.map(raw => {
      const id = String(raw.id || raw.employeeNumber || '').toUpperCase();
      const name = String(raw.name || `${raw.lastName || ''} ${raw.firstName || ''}`).trim() || id;
      const parts = name.split(/\s+/);
      return {
        ...raw,
        id,
        name,
        lastName: String(raw.lastName || parts[0] || ''),
        firstName: String(raw.firstName || parts.slice(1).join(' ') || ''),
      };
    }).filter(person => person.id);
  }

  function fallbackPerson(id) {
    const employeeId = String(id || '').toUpperCase();
    return { id: employeeId, name: employeeId, lastName: '', firstName: '' };
  }

  async function readText(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (window.Encoding) {
      const detected = window.Encoding.detect(bytes) || 'UTF8';
      const unicode = window.Encoding.convert(bytes, { to: 'UNICODE', from: detected });
      return window.Encoding.codeToString(unicode).replace(/^\uFEFF/, '');
    }
    return new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ',') { row.push(cell); cell = ''; }
      else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += char;
    }
    if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
    return rows;
  }

  function downloadCurrentCsv() {
    const csv = buildCsv();
    const start = document.getElementById('csv-start')?.value || 'start';
    const end = document.getElementById('csv-end')?.value || 'end';
    let blob;
    if (window.Encoding) {
      const unicode = window.Encoding.stringToCode(csv);
      const sjis = window.Encoding.convert(unicode, { to: 'SJIS', from: 'UNICODE' });
      blob = new Blob([new Uint8Array(sjis)], { type: 'text/csv;charset=shift_jis' });
    } else {
      blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `MFシフト_${start}_${end}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    notify('MF用CSVを保存しました');
  }

  function mfTime(total) {
    const value = Number(total || 0);
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  function csvCell(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function notify(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }
})();
