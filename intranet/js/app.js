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
    day:   { kpiTitle: '本日の全店 KPI',        sales: '本日売上', prev: '前日比', trend: '直近30日の売上 × FL引き後利益', ranking: '本日の店舗別売上ランキング', fl: '直近14日 F率・L率推移（全店）', storePeriod: 'の本日実績', storeChart: '直近14日の売上＆利益', storeTable: '直近14日の日次明細', storeCol: '日付', adminPl: '月次PL（全店合算）', opLabel: '営業利益（Daily）' },
    month: { kpiTitle: '今月の全店 KPI',        sales: '今月売上', prev: '前月比', trend: '直近12ヶ月の売上 × FL引き後利益', ranking: '今月の店舗別売上ランキング', fl: '直近12ヶ月 F率・L率推移（全店）', storePeriod: 'の今月実績', storeChart: '直近12ヶ月の売上＆利益', storeTable: '直近12ヶ月の月次明細', storeCol: '月',   adminPl: '月次PL（全店合算）',     opLabel: '営業利益（Monthly）' },
    year:  { kpiTitle: '今年の全店 KPI',        sales: '今年売上', prev: '前年比', trend: '直近3年の売上 × FL引き後利益',    ranking: '今年の店舗別売上ランキング', fl: '直近3年 F率・L率推移（全店）',    storePeriod: 'の今年実績', storeChart: '直近3年の売上＆利益',   storeTable: '直近3年の年次明細',   storeCol: '年',   adminPl: '年次PL（全店合算）',     opLabel: '営業利益（Yearly）' },
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
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${rowKey(r)}</strong></td>
        <td class="num">${fmt.yen(r.sales)}</td>
        <td class="num">${fmt.yen(r.f)}</td>
        <td class="num" style="color:${fGood ? 'var(--success)' : 'var(--danger)'};">${r.fRate.toFixed(1)}%</td>
        <td class="num">${fmt.yen(r.l)}</td>
        <td class="num" style="color:${lGood ? 'var(--success)' : 'var(--danger)'};">${r.lRate.toFixed(1)}%</td>
        <td class="num">${r.flRate.toFixed(1)}%</td>
        <td class="num"><strong>${fmt.yen(r.flProfit)}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ===== 管理タブ =====
  function renderAdmin() {
    const L = PERIOD_LABELS[state.period];
    const stores = getData().stores;
    document.getElementById('admin-pl-title').textContent = L.adminPl;

    // PL（期間対応）
    const plTbody = document.querySelector('#table-monthly-pl tbody');
    plTbody.innerHTML = '';
    const items = [
      { key: 'sales',     label: '売上',             highlight: false },
      { key: 'f',         label: 'F（食材原価）',    highlight: false },
      { key: 'l',         label: 'L（人件費）',      highlight: false },
      { key: 'flProfit',  label: 'FL引き後利益',     highlight: true  },
      { key: 'rent',      label: '家賃',             highlight: false },
      { key: 'utilities', label: '光熱費',           highlight: false },
      { key: 'opProfit',  label: '営業利益',         highlight: true  },
      { key: 'ordProfit', label: '経常利益',         highlight: true  },
    ];
    const perStore = stores.map(s => ({ store: s, data: calcCurrent(s.id) }));
    items.forEach(item => {
      const tr = document.createElement('tr');
      if (item.highlight) tr.classList.add('highlight-row');
      let cells = `<td>${item.label}</td>`;
      let total = 0;
      perStore.forEach(m => {
        const val = m.data ? m.data[item.key] : 0;
        total += val || 0;
        cells += `<td class="num">${val ? fmt.yenShort(val) : '--'}</td>`;
      });
      cells += `<td class="num"><strong>${fmt.yenShort(total)}</strong></td>`;
      tr.innerHTML = cells;
      plTbody.appendChild(tr);
    });

    // 固定費テーブル（常に月次ベース：現在選択月 or 選択日が属する月）
    let refMonth;
    if (state.period === 'month') refMonth = state.selectedMonth;
    else if (state.period === 'year') {
      const monthsInYear = getAllMonths().filter(m => m.startsWith(state.selectedYear));
      refMonth = monthsInYear[monthsInYear.length - 1] || getLatestMonth();
    } else refMonth = dateToMonth(state.selectedDate);
    const expTbody = document.querySelector('#table-expenses tbody');
    expTbody.innerHTML = '';
    stores.forEach(s => {
      const exp = getData().monthlyExpenses.find(e => e.storeId === s.id && e.month === refMonth);
      if (!exp) return;
      const total = exp.rent + exp.utilities;
      const daily = total / daysInMonth(refMonth);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.name}</strong></td>
        <td class="num">${fmt.yen(exp.rent)}</td>
        <td class="num">${fmt.yen(exp.utilities)}</td>
        <td class="num">${fmt.yen(total)}</td>
        <td class="num">${fmt.yen(daily)}</td>
      `;
      expTbody.appendChild(tr);
    });

    // MF突合
    const mfTbody = document.querySelector('#table-mf tbody');
    mfTbody.innerHTML = '';
    getData().mfReconciliation.forEach(r => {
      const diff = r.mfValue - r.ourValue;
      const diffAbs = Math.abs(diff);
      const threshold = r.ourValue * 0.005;
      const isAlert = diffAbs > threshold && diffAbs > 1000;
      const cls = diff === 0 ? 'neutral' : (isAlert ? 'bad' : 'neutral');
      const sign = diff > 0 ? '+' : (diff < 0 ? '−' : '');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.month}</td>
        <td>${r.item}</td>
        <td class="num">${fmt.yen(r.ourValue)}</td>
        <td class="num">${fmt.yen(r.mfValue)}</td>
        <td class="num"><span class="diff-badge ${cls}">${sign}${fmt.yen(diffAbs)}</span></td>
        <td style="color:var(--text-secondary); font-size:0.82rem;">${r.note}</td>
      `;
      mfTbody.appendChild(tr);
    });

    // お知らせ
    const list = document.getElementById('announcements-list');
    list.innerHTML = '';
    getData().announcements.forEach(a => {
      const card = document.createElement('div');
      card.className = 'announcement-card';
      card.innerHTML = `
        <div class="announcement-header">
          <span class="announcement-title">${a.title}</span>
          <span class="announcement-date">${a.date}</span>
        </div>
        <div class="announcement-content">${a.content}</div>
      `;
      list.appendChild(card);
    });
  }

  // ===== 全体レンダリング =====
  function renderAll() {
    renderOverview();
    renderStoreChips();
    renderStoreDetail();
    renderAdmin();
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
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
