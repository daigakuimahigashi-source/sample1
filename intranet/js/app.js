/**
 * 焼肉店 FL管理ダッシュボード - メインアプリ（日/月/年 対応）
 */
(function () {
  'use strict';

  // ===== 状態管理 =====
  const state = {
    period: 'day',          // 'day' | 'month' | 'year'
    selectedDate: null,     // 'YYYY-MM-DD'
    selectedMonth: null,    // 'YYYY-MM'
    selectedYear: null,     // 'YYYY'
    selectedStoreId: null,
    laborStoreId: 'ALL',    // 人件費タブの店舗フィルタ
  };

  // ===== ユーティリティ =====
  const fmt = {
    yen: (n) => '¥' + Math.round(n).toLocaleString('ja-JP'),
    yenShort: (n) => {
      const abs = Math.abs(n);
      if (abs >= 100000000) return '¥' + (n / 100000000).toFixed(2) + '億';
      if (abs >= 10000) return '¥' + Math.round(n / 10000).toLocaleString('ja-JP') + '万';
      return '¥' + Math.round(n).toLocaleString('ja-JP');
    },
    pct: (n, digits = 1) => (isFinite(n) ? n.toFixed(digits) + '%' : '--'),
    dateMD: (dateStr) => {
      const [, m, d] = dateStr.split('-');
      return `${parseInt(m)}/${parseInt(d)}`;
    },
    monthYM: (monthStr) => {
      const [y, m] = monthStr.split('-');
      return `${y}/${parseInt(m)}`;
    },
  };

  function daysInMonth(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  function dateToMonth(dateStr) { return dateStr.substring(0, 7); }
  function dateToYear(dateStr)  { return dateStr.substring(0, 4); }
  function monthToYear(monthStr){ return monthStr.substring(0, 4); }

  // ===== データアクセス =====
  function getData() { return SAMPLE_DATA; }
  function getStore(storeId) { return getData().stores.find(s => s.id === storeId); }

  function getAllDates() {
    const set = new Set(getData().dailySales.map(r => r.date));
    return Array.from(set).sort();
  }
  function getAllMonths() {
    const set = new Set(getData().dailySales.map(r => r.date.substring(0, 7)));
    return Array.from(set).sort();
  }
  function getAllYears() {
    const set = new Set(getData().dailySales.map(r => r.date.substring(0, 4)));
    return Array.from(set).sort();
  }
  function getLatestDate()  { const a = getAllDates();  return a[a.length - 1]; }
  function getLatestMonth() { const a = getAllMonths(); return a[a.length - 1]; }
  function getLatestYear()  { const a = getAllYears();  return a[a.length - 1]; }

  function getPrevDate(d)  { const a = getAllDates();  const i = a.indexOf(d); return i > 0 ? a[i - 1] : null; }
  function getPrevMonth(m) { const a = getAllMonths(); const i = a.indexOf(m); return i > 0 ? a[i - 1] : null; }
  function getPrevYear(y)  { const a = getAllYears();  const i = a.indexOf(y); return i > 0 ? a[i - 1] : null; }

  function getDailyRow(storeId, dateStr) {
    return getData().dailySales.find(r => r.storeId === storeId && r.date === dateStr) || null;
  }

  // ===== 集計関数 =====
  /** 日次：1店舗 */
  function calcDaily(storeId, dateStr) {
    const row = getDailyRow(storeId, dateStr);
    if (!row) return null;
    const fRate = (row.estimatedFoodCost / row.sales) * 100;
    const lRate = (row.laborCost / row.sales) * 100;
    const flProfit = row.sales - row.estimatedFoodCost - row.laborCost;
    const flRate = fRate + lRate;
    const exp = getData().monthlyExpenses.find(e => e.storeId === storeId && e.month === dateToMonth(dateStr));
    const dailyFixed = exp ? (exp.rent + exp.utilities) / daysInMonth(exp.month) : 0;
    const opProfit = flProfit - dailyFixed;
    return {
      date: row.date, storeId: row.storeId,
      sales: row.sales, f: row.estimatedFoodCost, l: row.laborCost,
      customers: row.customers,
      fRate, lRate, flRate, flProfit, dailyFixed, opProfit,
      rent: dailyFixed ? (exp.rent / daysInMonth(exp.month)) : 0,
      utilities: dailyFixed ? (exp.utilities / daysInMonth(exp.month)) : 0,
      ordProfit: opProfit,
      opProfitRate: (opProfit / row.sales) * 100,
      flProfitRate: (flProfit / row.sales) * 100,
    };
  }

  function calcDailyAll(dateStr) {
    return aggregateRows(
      getData().stores.map(s => calcDaily(s.id, dateStr)).filter(Boolean),
      { date: dateStr }
    );
  }

  /** 月次：1店舗 */
  function calcMonthly(storeId, monthStr) {
    const dailyRows = getData().dailySales
      .filter(r => r.storeId === storeId && r.date.startsWith(monthStr))
      .map(r => calcDaily(r.storeId, r.date));
    if (dailyRows.length === 0) return null;
    const agg = aggregateRows(dailyRows, { storeId, month: monthStr });
    // 月次の固定費は実経過日数分だけ
    const exp = getData().monthlyExpenses.find(e => e.storeId === storeId && e.month === monthStr);
    if (exp) {
      const ratio = dailyRows.length / daysInMonth(monthStr);
      agg.rent = exp.rent * ratio;
      agg.utilities = exp.utilities * ratio;
    }
    return agg;
  }

  function calcMonthlyAll(monthStr) {
    const rows = getData().stores.map(s => calcMonthly(s.id, monthStr)).filter(Boolean);
    if (rows.length === 0) return null;
    return aggregateRows(rows, { month: monthStr });
  }

  /** 年次：1店舗 */
  function calcYearly(storeId, yearStr) {
    const months = getAllMonths().filter(m => m.startsWith(yearStr));
    const rows = months.map(m => calcMonthly(storeId, m)).filter(Boolean);
    if (rows.length === 0) return null;
    return aggregateRows(rows, { storeId, year: yearStr });
  }

  function calcYearlyAll(yearStr) {
    const rows = getData().stores.map(s => calcYearly(s.id, yearStr)).filter(Boolean);
    if (rows.length === 0) return null;
    return aggregateRows(rows, { year: yearStr });
  }

  /** 集計ヘルパ：flProfit/opProfit/f/l/sales/rent/utilities を合算し、率を再計算 */
  function aggregateRows(rows, meta) {
    const sum = rows.reduce((a, r) => ({
      sales: a.sales + (r.sales || 0),
      f:     a.f     + (r.f     || 0),
      l:     a.l     + (r.l     || 0),
      flProfit:  a.flProfit  + (r.flProfit  || 0),
      rent:      a.rent      + (r.rent      || 0),
      utilities: a.utilities + (r.utilities || 0),
      customers: a.customers + (r.customers || 0),
    }), { sales: 0, f: 0, l: 0, flProfit: 0, rent: 0, utilities: 0, customers: 0 });
    const fixed = sum.rent + sum.utilities;
    const opProfit = sum.flProfit - fixed;
    return {
      ...meta,
      sales: sum.sales, f: sum.f, l: sum.l,
      customers: sum.customers,
      flProfit: sum.flProfit,
      rent: sum.rent, utilities: sum.utilities,
      dailyFixed: fixed,
      opProfit,
      ordProfit: opProfit,
      fRate: (sum.f / sum.sales) * 100,
      lRate: (sum.l / sum.sales) * 100,
      flRate: ((sum.f + sum.l) / sum.sales) * 100,
      flProfitRate: (sum.flProfit / sum.sales) * 100,
      opProfitRate: (opProfit / sum.sales) * 100,
    };
  }

  // ===== 期間シリーズ（グラフ用） =====
  /** 現在のstateに応じて店舗×期間シリーズを返す（直近N件、古い→新しい順） */
  function getPeriodSeries(storeId, count) {
    if (state.period === 'year') {
      const years = getAllYears();
      const idx = years.indexOf(state.selectedYear);
      const slice = years.slice(Math.max(0, idx - count + 1), idx + 1);
      return slice.map(y => storeId === 'ALL' ? calcYearlyAll(y) : calcYearly(storeId, y)).filter(Boolean);
    }
    if (state.period === 'month') {
      const months = getAllMonths();
      const idx = months.indexOf(state.selectedMonth);
      const slice = months.slice(Math.max(0, idx - count + 1), idx + 1);
      return slice.map(m => storeId === 'ALL' ? calcMonthlyAll(m) : calcMonthly(storeId, m)).filter(Boolean);
    }
    const dates = getAllDates();
    const idx = dates.indexOf(state.selectedDate);
    const slice = dates.slice(Math.max(0, idx - count + 1), idx + 1);
    return slice.map(d => storeId === 'ALL' ? calcDailyAll(d) : calcDaily(storeId, d)).filter(Boolean);
  }

  /** 現在選択中の「単一期間」の集計を返す */
  function calcCurrent(storeId) {
    if (state.period === 'year')  return storeId === 'ALL' ? calcYearlyAll(state.selectedYear)   : calcYearly(storeId, state.selectedYear);
    if (state.period === 'month') return storeId === 'ALL' ? calcMonthlyAll(state.selectedMonth) : calcMonthly(storeId, state.selectedMonth);
    return storeId === 'ALL' ? calcDailyAll(state.selectedDate) : calcDaily(storeId, state.selectedDate);
  }

  /** 前期比較用 */
  function calcPrev(storeId) {
    if (state.period === 'year') {
      const y = getPrevYear(state.selectedYear);
      return y ? (storeId === 'ALL' ? calcYearlyAll(y) : calcYearly(storeId, y)) : null;
    }
    if (state.period === 'month') {
      const m = getPrevMonth(state.selectedMonth);
      return m ? (storeId === 'ALL' ? calcMonthlyAll(m) : calcMonthly(storeId, m)) : null;
    }
    const d = getPrevDate(state.selectedDate);
    return d ? (storeId === 'ALL' ? calcDailyAll(d) : calcDaily(storeId, d)) : null;
  }

  // ===== 期間ラベル（UI文言） =====
  const PERIOD_LABELS = {
    day:   { kpiTitle: '本日の全店 KPI',        sales: '本日売上', prev: '前日比', trend: '直近30日の売上 × FL引き後利益', ranking: '本日の店舗別売上ランキング', fl: '直近14日 F率・L率推移（全店）', storePeriod: 'の本日実績', storeChart: '直近14日の売上＆利益', storeTable: '直近14日の日次明細', storeCol: '日付', opLabel: '営業利益（Daily）' },
    month: { kpiTitle: '今月の全店 KPI',        sales: '今月売上', prev: '前月比', trend: '直近12ヶ月の売上 × FL引き後利益', ranking: '今月の店舗別売上ランキング', fl: '直近12ヶ月 F率・L率推移（全店）', storePeriod: 'の今月実績', storeChart: '直近12ヶ月の売上＆利益', storeTable: '直近12ヶ月の月次明細', storeCol: '月',   opLabel: '営業利益（Monthly）' },
    year:  { kpiTitle: '今年の全店 KPI',        sales: '今年売上', prev: '前年比', trend: '直近3年の売上 × FL引き後利益',    ranking: '今年の店舗別売上ランキング', fl: '直近3年 F率・L率推移（全店）',    storePeriod: 'の今年実績', storeChart: '直近3年の売上＆利益',   storeTable: '直近3年の年次明細',   storeCol: '年',   opLabel: '営業利益（Yearly）' },
  };

  function rowKey(r) {
    if (state.period === 'year')  return r.year + '年';
    if (state.period === 'month') return fmt.monthYM(r.month);
    return fmt.dateMD(r.date);
  }

  // ===== 期間セレクタ & ピッカー =====
  function initPickers() {
    // year picker options
    const yearSel = document.getElementById('year-picker');
    yearSel.innerHTML = '';
    getAllYears().forEach(y => {
      const o = document.createElement('option');
      o.value = y; o.textContent = y + '年';
      yearSel.appendChild(o);
    });

    const datePicker  = document.getElementById('date-picker');
    const monthPicker = document.getElementById('month-picker');

    datePicker.min  = getAllDates()[0];
    datePicker.max  = getLatestDate();
    monthPicker.min = getAllMonths()[0];
    monthPicker.max = getLatestMonth();

    datePicker.value  = state.selectedDate;
    monthPicker.value = state.selectedMonth;
    yearSel.value     = state.selectedYear;

    datePicker.addEventListener('change', (e) => {
      const dates = getAllDates();
      state.selectedDate = dates.includes(e.target.value)
        ? e.target.value
        : dates.reduce((best, d) => Math.abs(new Date(d) - new Date(e.target.value)) < Math.abs(new Date(best) - new Date(e.target.value)) ? d : best, dates[0]);
      datePicker.value = state.selectedDate;
      renderAll();
    });
    monthPicker.addEventListener('change', (e) => {
      const months = getAllMonths();
      state.selectedMonth = months.includes(e.target.value) ? e.target.value : getLatestMonth();
      monthPicker.value = state.selectedMonth;
      renderAll();
    });
    yearSel.addEventListener('change', (e) => {
      state.selectedYear = e.target.value;
      renderAll();
    });
  }

  function initPeriodToggle() {
    const btns = document.querySelectorAll('.period-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.period = btn.dataset.period;
        // ピッカー切替
        document.querySelectorAll('.period-input').forEach(p => {
          p.classList.toggle('hidden', p.dataset.period !== state.period);
        });
        renderAll();
      });
    });
  }

  // ===== トグル初期化 =====
  function initDetailToggle() {
    // F・L明細トグル
    const btn = document.getElementById('detail-toggle');
    const table = document.getElementById('table-store-detail');
    const label = document.getElementById('detail-toggle-label');
    if (btn && table) {
      btn.addEventListener('click', () => {
        const open = !table.classList.contains('show-detail');
        table.classList.toggle('show-detail', open);
        btn.classList.toggle('active', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        label.textContent = open ? 'F・L 明細を隠す' : 'F・L 明細を表示';
      });
    }
    // シフト明細トグル
    const shiftBtn = document.getElementById('shift-toggle');
    const shiftWrap = document.getElementById('shift-detail-wrap');
    const shiftLabel = document.getElementById('shift-toggle-label');
    if (shiftBtn && shiftWrap) {
      shiftBtn.addEventListener('click', () => {
        const open = shiftWrap.style.display === 'none';
        shiftWrap.style.display = open ? '' : 'none';
        shiftBtn.classList.toggle('active', open);
        shiftBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        shiftLabel.textContent = open ? 'シフト明細を隠す' : 'シフト明細を表示';
      });
    }
  }

  // ===== タブ切り替え =====
  function initTabs() {
    const btns = document.querySelectorAll('.nav-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + tab).classList.add('active');
        renderAll();
      });
    });
  }

  // ===== 差分バッジ =====
  function diffBadge(current, previous, isRate = false, invertColor = false) {
    if (!isFinite(current) || !isFinite(previous) || previous === 0) {
      return '<span class="diff-badge neutral">--</span>';
    }
    const diff = current - previous;
    const pct = (diff / Math.abs(previous)) * 100;
    const positive = diff >= 0;
    const cls = invertColor ? (positive ? 'bad' : 'good') : (positive ? 'good' : 'bad');
    const sign = positive ? '▲' : '▼';
    const val = isRate ? `${sign} ${Math.abs(diff).toFixed(1)}pt` : `${sign} ${Math.abs(pct).toFixed(1)}%`;
    return `<span class="diff-badge ${cls}">${val}</span>`;
  }

  // ===== ダッシュボードタブ =====
  function renderOverview() {
    const L = PERIOD_LABELS[state.period];
    const cur = calcCurrent('ALL');
    const prev = calcPrev('ALL');
    const $ = (id) => document.getElementById(id);

    $('overview-kpi-title').textContent = L.kpiTitle;
    $('kpi-sales-label').textContent = L.sales;
    $('kpi-op-profit-label').textContent = L.opLabel;
    $('overview-trend-title').textContent = L.trend;
    $('overview-ranking-title').textContent = L.ranking;
    $('overview-fl-title').textContent = L.fl;

    if (!cur) {
      ['kpi-sales','kpi-f','kpi-l','kpi-fl-rate','kpi-fl-profit','kpi-op-profit'].forEach(id => $(id).textContent = '--');
      return;
    }

    $('kpi-sales').textContent = fmt.yenShort(cur.sales);
    $('kpi-sales-diff').innerHTML = L.prev + ' ' + (prev ? diffBadge(cur.sales, prev.sales) : '--');

    $('kpi-f').textContent = fmt.yenShort(cur.f);
    $('kpi-f-rate').textContent = fmt.pct(cur.fRate);

    $('kpi-l').textContent = fmt.yenShort(cur.l);
    $('kpi-l-rate').textContent = fmt.pct(cur.lRate);

    const avgTargetFL = getData().stores.reduce((a, s) => a + s.targetF + s.targetL, 0) / getData().stores.length;
    $('kpi-fl-rate').textContent = fmt.pct(cur.flRate);
    const flDiff = cur.flRate - avgTargetFL;
    const flBadgeCls = flDiff <= 0 ? 'good' : 'bad';
    const flSign = flDiff >= 0 ? '▲' : '▼';
    $('kpi-fl-diff').innerHTML = `目標平均 ${avgTargetFL.toFixed(1)}% <span class="diff-badge ${flBadgeCls}">${flSign} ${Math.abs(flDiff).toFixed(1)}pt</span>`;

    $('kpi-fl-profit').textContent = fmt.yenShort(cur.flProfit);
    $('kpi-fl-profit-rate').textContent = fmt.pct(cur.flProfitRate);

    $('kpi-op-profit').textContent = fmt.yenShort(cur.opProfit);
    $('kpi-op-profit-rate').textContent = fmt.pct(cur.opProfitRate);

    // トレンドグラフ
    const trendCount = state.period === 'day' ? 30 : state.period === 'month' ? 12 : 3;
    const trendRows = getPeriodSeries('ALL', trendCount);
    Charts.renderPeriodSalesProfit('chart-daily-sales', trendRows, state.period);

    // 店舗別ランキング
    const storeRows = getData().stores.map(s => {
      const d = calcCurrent(s.id);
      return d ? { name: s.name, sales: d.sales } : null;
    }).filter(Boolean);
    Charts.renderStoreRanking('chart-store-ranking', storeRows);

    // FL比率推移
    const flCount = state.period === 'day' ? 14 : state.period === 'month' ? 12 : 3;
    const flRows = getPeriodSeries('ALL', flCount);
    Charts.renderFLTrend('chart-fl-trend', flRows, 32, 27, state.period);
  }

  // ===== 店舗別タブ =====
  function renderStoreChips() {
    const container = document.getElementById('store-chips');
    container.innerHTML = '';
    getData().stores.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'store-chip' + (s.id === state.selectedStoreId ? ' active' : '');
      btn.textContent = s.name;
      btn.addEventListener('click', () => {
        state.selectedStoreId = s.id;
        renderStoreChips();
        renderStoreDetail();
      });
      container.appendChild(btn);
    });
  }

  function renderStoreDetail() {
    const L = PERIOD_LABELS[state.period];
    const store = getStore(state.selectedStoreId);
    if (!store) return;
    const d = calcCurrent(store.id);
    const $ = (id) => document.getElementById(id);

    $('store-title').textContent = store.name;
    $('store-period-label').textContent = L.storePeriod;
    $('store-chart-title').textContent = L.storeChart;
    $('store-table-title').textContent = L.storeTable;
    $('store-table-period-col').textContent = L.storeCol;

    if (!d) {
      ['store-sales','store-f','store-l','store-fl-profit','store-op-profit'].forEach(id => $(id).textContent = '--');
      return;
    }

    $('store-sales').textContent = fmt.yenShort(d.sales);
    $('store-customers').textContent = `${(d.customers || 0).toLocaleString()} 組`;

    $('store-f').textContent = fmt.yenShort(d.f);
    $('store-f-rate').textContent = `${fmt.pct(d.fRate)}（目標 ${store.targetF}%）`;
    const fBar = $('store-f-bar');
    fBar.style.width = Math.min(d.fRate / store.targetF * 100, 150) + '%';
    fBar.className = 'kpi-progress-bar ' + (d.fRate <= store.targetF ? 'good' : 'bad');

    $('store-l').textContent = fmt.yenShort(d.l);
    $('store-l-rate').textContent = `${fmt.pct(d.lRate)}（目標 ${store.targetL}%）`;
    const lBar = $('store-l-bar');
    lBar.style.width = Math.min(d.lRate / store.targetL * 100, 150) + '%';
    lBar.className = 'kpi-progress-bar ' + (d.lRate <= store.targetL ? 'good' : 'bad');

    $('store-fl-profit').textContent = fmt.yenShort(d.flProfit);
    $('store-fl-profit-rate').textContent = fmt.pct(d.flProfitRate);

    $('store-op-profit').textContent = fmt.yenShort(d.opProfit);
    $('store-op-profit-rate').textContent = fmt.pct(d.opProfitRate);

    // 目標FL情報カード
    const info = document.getElementById('store-target-info');
    const targetFL = store.targetF + store.targetL;
    const diff = d.flRate - targetFL;
    const good = diff <= 0;
    info.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:var(--text-secondary); font-size:0.85rem;">目標FL比率</span>
          <strong style="font-size:1.1rem;">${targetFL}%（F:${store.targetF}% / L:${store.targetL}%）</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="color:var(--text-secondary); font-size:0.85rem;">当期FL比率</span>
          <strong style="font-size:1.1rem; color:${good ? 'var(--success)' : 'var(--danger)'};">${d.flRate.toFixed(1)}%</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; padding-top:8px; border-top:1px solid var(--border);">
          <span style="color:var(--text-secondary); font-size:0.85rem;">目標差</span>
          <span class="diff-badge ${good ? 'good' : 'bad'}" style="font-size:0.9rem;">
            ${good ? '▼' : '▲'} ${Math.abs(diff).toFixed(1)}pt
          </span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); line-height:1.6; padding-top:8px;">
          ${good
            ? '✅ 目標を達成しています。この調子でいきましょう。'
            : '⚠️ 目標を上回っています。原価または人件費の見直しを検討してください。'}
        </div>
      </div>
    `;

    // グラフ & テーブル
    const count = state.period === 'day' ? 14 : state.period === 'month' ? 12 : 3;
    const series = getPeriodSeries(store.id, count);
    Charts.renderStorePeriod('chart-store-daily', series, state.period);

    const tbody = document.querySelector('#table-store-detail tbody');
    tbody.innerHTML = '';
    [...series].reverse().forEach(r => {
      const fGood = r.fRate <= store.targetF;
      const lGood = r.lRate <= store.targetL;
      const profitGood = r.flProfit >= 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${rowKey(r)}</strong></td>
        <td class="num">${fmt.yen(r.sales)}</td>
        <td class="num"><strong style="color:${profitGood ? 'var(--success)' : 'var(--danger)'};">${fmt.yen(r.flProfit)}</strong></td>
        <td class="num">${r.flProfitRate.toFixed(1)}%</td>
        <td class="num detail-col">${fmt.yen(r.f)}</td>
        <td class="num detail-col" style="color:${fGood ? 'var(--success)' : 'var(--danger)'};">${r.fRate.toFixed(1)}%</td>
        <td class="num detail-col">${fmt.yen(r.l)}</td>
        <td class="num detail-col" style="color:${lGood ? 'var(--success)' : 'var(--danger)'};">${r.lRate.toFixed(1)}%</td>
        <td class="num detail-col">${r.flRate.toFixed(1)}%</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ===== 人件費管理タブ =====

  /** シフトデータを期間・店舗でフィルタ */
  function getShiftsForPeriod(storeId) {
    const shifts = getData().dailyShifts;
    let filtered;
    if (state.period === 'year') {
      filtered = shifts.filter(s => s.date.startsWith(state.selectedYear));
    } else if (state.period === 'month') {
      filtered = shifts.filter(s => s.date.startsWith(state.selectedMonth));
    } else {
      filtered = shifts.filter(s => s.date === state.selectedDate);
    }
    if (storeId && storeId !== 'ALL') {
      filtered = filtered.filter(s => s.storeId === storeId);
    }
    return filtered;
  }

  function renderLaborChips() {
    const container = document.getElementById('labor-store-chips');
    container.innerHTML = '';
    // 全店ボタン
    const allBtn = document.createElement('button');
    allBtn.className = 'store-chip' + (state.laborStoreId === 'ALL' ? ' active' : '');
    allBtn.textContent = '全店';
    allBtn.addEventListener('click', () => { state.laborStoreId = 'ALL'; renderLaborChips(); renderLabor(); });
    container.appendChild(allBtn);
    getData().stores.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'store-chip' + (s.id === state.laborStoreId ? ' active' : '');
      btn.textContent = s.name;
      btn.addEventListener('click', () => { state.laborStoreId = s.id; renderLaborChips(); renderLabor(); });
      container.appendChild(btn);
    });
  }

  function renderLabor() {
    const $ = (id) => document.getElementById(id);
    const storeId = state.laborStoreId;
    const isAll = storeId === 'ALL';
    const storeName = isAll ? '全店' : getStore(storeId).name;
    const periodLabels = { day: 'の本日人件費', month: 'の今月人件費', year: 'の今年人件費' };

    $('labor-title').textContent = storeName;
    $('labor-period-label').textContent = periodLabels[state.period] || 'の人件費サマリ';

    const shifts = getShiftsForPeriod(storeId);
    const totalCost = shifts.reduce((a, s) => a + s.laborCost, 0);
    const totalHours = shifts.reduce((a, s) => a + s.hours, 0);
    const uniqueStaff = new Set(shifts.map(s => s.staffId));
    const headCount = uniqueStaff.size;
    const perPerson = headCount > 0 ? totalCost / headCount : 0;
    const avgHours = headCount > 0 ? totalHours / headCount : 0;

    // 売上を取得してL率を計算
    const curData = isAll ? calcCurrent('ALL') : calcCurrent(storeId);
    const sales = curData ? curData.sales : 0;
    const lRate = sales > 0 ? (totalCost / sales) * 100 : 0;
    const targetL = isAll
      ? getData().stores.reduce((a, s) => a + s.targetL, 0) / getData().stores.length
      : getStore(storeId).targetL;

    $('labor-total-cost').textContent = fmt.yenShort(totalCost);
    $('labor-l-rate').textContent = fmt.pct(lRate);
    const lDiff = lRate - targetL;
    const lGood = lDiff <= 0;
    $('labor-l-target').innerHTML = `目標 ${targetL}% <span class="diff-badge ${lGood ? 'good' : 'bad'}">${lGood ? '▼' : '▲'} ${Math.abs(lDiff).toFixed(1)}pt</span>`;
    $('labor-head-count').textContent = headCount + '名';
    $('labor-total-hours').textContent = `合計 ${totalHours.toFixed(1)}h`;
    $('labor-per-person').textContent = fmt.yenShort(perPerson);
    $('labor-avg-hours').textContent = `平均 ${avgHours.toFixed(1)}h`;

    // --- 店舗別人件費チャート（横棒） ---
    renderLaborByStoreChart(shifts);

    // --- 人件費推移チャート ---
    renderLaborTrendChart();

    // --- スタッフ別集計テーブル ---
    renderStaffTable(shifts, storeId);

    // --- シフト明細テーブル ---
    renderShiftTable(shifts);
  }

  function renderLaborByStoreChart(shifts) {
    const canvas = document.getElementById('chart-labor-by-store');
    const ctx = canvas.getContext('2d');
    if (canvas._chart) canvas._chart.destroy();

    const stores = getData().stores;
    const perStore = stores.map(s => ({
      name: s.name,
      cost: shifts.filter(sh => sh.storeId === s.id).reduce((a, sh) => a + sh.laborCost, 0),
    }));

    canvas._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: perStore.map(s => s.name),
        datasets: [{
          data: perStore.map(s => s.cost),
          backgroundColor: ['#e74c3c', '#e67e22', '#8b5e3c', '#27ae60', '#9b59b6'],
          borderRadius: 6,
          maxBarThickness: 36,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { callback: v => fmt.yenShort(v) }, grid: { color: 'rgba(0,0,0,0.06)' } },
          y: { grid: { display: false } },
        },
      },
    });
  }

  function renderLaborTrendChart() {
    const canvas = document.getElementById('chart-labor-trend');
    const ctx = canvas.getContext('2d');
    if (canvas._chart) canvas._chart.destroy();

    const storeId = state.laborStoreId;
    const count = state.period === 'day' ? 14 : state.period === 'month' ? 12 : 3;
    let series, labels;

    if (state.period === 'day') {
      const dates = getAllDates();
      const idx = dates.indexOf(state.selectedDate);
      const slice = dates.slice(Math.max(0, idx - count + 1), idx + 1);
      labels = slice.map(d => { const [,m,dd] = d.split('-'); return `${parseInt(m)}/${parseInt(dd)}`; });
      series = slice.map(d => {
        let sh = getData().dailyShifts.filter(s => s.date === d);
        if (storeId !== 'ALL') sh = sh.filter(s => s.storeId === storeId);
        return sh.reduce((a, s) => a + s.laborCost, 0);
      });
    } else if (state.period === 'month') {
      const months = getAllMonths();
      const idx = months.indexOf(state.selectedMonth);
      const slice = months.slice(Math.max(0, idx - count + 1), idx + 1);
      labels = slice.map(m => { const [y,mm] = m.split('-'); return `${y.slice(2)}/${parseInt(mm)}`; });
      series = slice.map(m => {
        let sh = getData().dailyShifts.filter(s => s.date.startsWith(m));
        if (storeId !== 'ALL') sh = sh.filter(s => s.storeId === storeId);
        return sh.reduce((a, s) => a + s.laborCost, 0);
      });
    } else {
      const years = getAllYears();
      labels = years.map(y => y + '年');
      series = years.map(y => {
        let sh = getData().dailyShifts.filter(s => s.date.startsWith(y));
        if (storeId !== 'ALL') sh = sh.filter(s => s.storeId === storeId);
        return sh.reduce((a, s) => a + s.laborCost, 0);
      });
    }

    canvas._chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: series,
          borderColor: '#8b5e3c',
          backgroundColor: 'rgba(139,94,60,0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => fmt.yenShort(v) }, grid: { color: 'rgba(0,0,0,0.06)' } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  function renderStaffTable(shifts, storeId) {
    const tbody = document.querySelector('#table-staff-summary tbody');
    tbody.innerHTML = '';

    // 対象スタッフ
    const relevantStaff = storeId === 'ALL'
      ? getData().staff
      : getData().staff.filter(s => s.stores.includes(storeId));

    const rows = relevantStaff.map(staff => {
      const myShifts = shifts.filter(s => s.staffId === staff.id);
      const totalHours = myShifts.reduce((a, s) => a + s.hours, 0);
      const totalCost = myShifts.reduce((a, s) => a + s.laborCost, 0);
      const days = new Set(myShifts.map(s => s.date)).size;
      return { staff, days, totalHours, totalCost };
    }).filter(r => r.days > 0).sort((a, b) => b.totalCost - a.totalCost);

    rows.forEach(r => {
      const storeNames = r.staff.stores.map(sid => {
        const s = getStore(sid);
        return s ? s.name.replace('那覇', '').replace('店', '') : sid;
      }).join('・');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${r.staff.name}</strong></td>
        <td style="font-size:0.82rem; color:var(--text-secondary);">${storeNames}</td>
        <td class="num">¥${r.staff.hourlyRate.toLocaleString()}</td>
        <td class="num">${r.days}日</td>
        <td class="num">${r.totalHours.toFixed(1)}h</td>
        <td class="num"><strong>${fmt.yen(r.totalCost)}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderShiftTable(shifts) {
    const tbody = document.querySelector('#table-shift-detail tbody');
    tbody.innerHTML = '';

    // 日付降順、直近100件まで
    const sorted = [...shifts].sort((a, b) => b.date.localeCompare(a.date) || a.staffId.localeCompare(b.staffId));
    const limited = sorted.slice(0, 100);

    limited.forEach(sh => {
      const staff = getData().staff.find(s => s.id === sh.staffId);
      const store = getStore(sh.storeId);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmt.dateMD(sh.date)}</td>
        <td>${staff ? staff.name : sh.staffId}</td>
        <td style="font-size:0.82rem;">${store ? store.name : sh.storeId}</td>
        <td class="num">${sh.startHour}:00</td>
        <td class="num">${sh.endHour}:00</td>
        <td class="num">${sh.hours}h</td>
        <td class="num">${sh.breakMinutes}分</td>
        <td class="num">${fmt.yen(sh.laborCost)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ===== 全体レンダリング =====
  function renderAll() {
    renderOverview();
    renderStoreChips();
    renderStoreDetail();
    renderLaborChips();
    renderLabor();
  }

  // ===== 初期化 =====
  function init() {
    state.selectedDate  = getLatestDate();
    state.selectedMonth = getLatestMonth();
    state.selectedYear  = getLatestYear();
    state.selectedStoreId = getData().stores[0].id;
    initTabs();
    initPeriodToggle();
    initPickers();
    initDetailToggle();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
