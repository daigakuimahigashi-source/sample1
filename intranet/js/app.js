/**
 * 焼肉店 FL管理ダッシュボード - メインアプリ
 */
(function () {
  'use strict';

  // ===== 状態管理 =====
  const state = {
    selectedDate: null,     // 'YYYY-MM-DD'
    selectedStoreId: null,  // 店舗ID
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
  };

  function daysInMonth(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }

  function dateToMonth(dateStr) {
    return dateStr.substring(0, 7);
  }

  // ===== データアクセス =====
  function getData() { return SAMPLE_DATA; }
  function getStore(storeId) { return getData().stores.find(s => s.id === storeId); }

  function getAllDates() {
    const set = new Set(getData().dailySales.map(r => r.date));
    return Array.from(set).sort();
  }
  function getLatestDate() {
    const dates = getAllDates();
    return dates[dates.length - 1];
  }
  function getPrevDate(dateStr) {
    const dates = getAllDates();
    const idx = dates.indexOf(dateStr);
    return idx > 0 ? dates[idx - 1] : null;
  }

  /** 指定日の1店舗分の生データ（なければnull） */
  function getDailyRow(storeId, dateStr) {
    return getData().dailySales.find(r => r.storeId === storeId && r.date === dateStr) || null;
  }

  /** 指定日・店舗の集計（F/L/利益を計算） */
  function calcDaily(storeId, dateStr) {
    const row = getDailyRow(storeId, dateStr);
    if (!row) return null;
    const fRate = (row.estimatedFoodCost / row.sales) * 100;
    const lRate = (row.laborCost / row.sales) * 100;
    const flProfit = row.sales - row.estimatedFoodCost - row.laborCost;
    const flRate = fRate + lRate;
    // 日割り固定費
    const exp = getData().monthlyExpenses.find(e => e.storeId === storeId && e.month === dateToMonth(dateStr));
    const dailyFixed = exp ? (exp.rent + exp.utilities) / daysInMonth(exp.month) : 0;
    const opProfit = flProfit - dailyFixed;
    return {
      date: row.date,
      storeId: row.storeId,
      sales: row.sales,
      f: row.estimatedFoodCost,
      l: row.laborCost,
      customers: row.customers,
      fRate, lRate, flRate,
      flProfit,
      dailyFixed,
      opProfit,
      opProfitRate: (opProfit / row.sales) * 100,
      flProfitRate: (flProfit / row.sales) * 100,
    };
  }

  /** 指定日の全店合算 */
  function calcDailyAll(dateStr) {
    const rows = getData().stores.map(s => calcDaily(s.id, dateStr)).filter(Boolean);
    const sum = rows.reduce((a, r) => ({
      sales: a.sales + r.sales,
      f: a.f + r.f,
      l: a.l + r.l,
      flProfit: a.flProfit + r.flProfit,
      dailyFixed: a.dailyFixed + r.dailyFixed,
      opProfit: a.opProfit + r.opProfit,
    }), { sales: 0, f: 0, l: 0, flProfit: 0, dailyFixed: 0, opProfit: 0 });
    return {
      ...sum,
      date: dateStr,
      fRate: (sum.f / sum.sales) * 100,
      lRate: (sum.l / sum.sales) * 100,
      flRate: ((sum.f + sum.l) / sum.sales) * 100,
      flProfitRate: (sum.flProfit / sum.sales) * 100,
      opProfitRate: (sum.opProfit / sum.sales) * 100,
    };
  }

  /** 店舗の過去N日間の集計（降順） */
  function calcRecentDays(storeId, dateStr, days) {
    const dates = getAllDates();
    const idx = dates.indexOf(dateStr);
    if (idx < 0) return [];
    const start = Math.max(0, idx - days + 1);
    const targetDates = dates.slice(start, idx + 1);
    return targetDates.map(d => storeId === 'ALL' ? calcDailyAll(d) : calcDaily(storeId, d)).filter(Boolean);
  }

  /** 月次集計 */
  function calcMonthly(storeId, monthStr) {
    const rows = getData().dailySales.filter(r => r.storeId === storeId && r.date.startsWith(monthStr));
    if (rows.length === 0) return null;
    const daily = rows.map(r => calcDaily(r.storeId, r.date));
    const sum = daily.reduce((a, r) => ({
      sales: a.sales + r.sales,
      f: a.f + r.f,
      l: a.l + r.l,
      flProfit: a.flProfit + r.flProfit,
    }), { sales: 0, f: 0, l: 0, flProfit: 0 });
    const exp = getData().monthlyExpenses.find(e => e.storeId === storeId && e.month === monthStr);
    const rent = exp ? exp.rent : 0;
    const utilities = exp ? exp.utilities : 0;
    // 経過日数分の固定費を計算（その月の全日ではなく現在までの日割り × 日数）
    const fixedTotal = (rent + utilities) * (rows.length / daysInMonth(monthStr));
    const opProfit = sum.flProfit - fixedTotal;
    return {
      storeId, month: monthStr,
      sales: sum.sales, f: sum.f, l: sum.l,
      flProfit: sum.flProfit,
      rent: rent * (rows.length / daysInMonth(monthStr)),
      utilities: utilities * (rows.length / daysInMonth(monthStr)),
      opProfit,
      ordProfit: opProfit, // 営業利益＝経常利益の簡易モデル
      fRate: (sum.f / sum.sales) * 100,
      lRate: (sum.l / sum.sales) * 100,
    };
  }

  // ===== ヘッダー日付ピッカー =====
  function initDatePicker() {
    const picker = document.getElementById('date-picker');
    picker.value = state.selectedDate;
    picker.min = getAllDates()[0];
    picker.max = getAllDates()[getAllDates().length - 1];
    picker.addEventListener('change', (e) => {
      const dates = getAllDates();
      if (dates.includes(e.target.value)) {
        state.selectedDate = e.target.value;
      } else {
        // 最寄りの実在日付にフォールバック
        state.selectedDate = dates.reduce((best, d) => Math.abs(new Date(d) - new Date(e.target.value)) < Math.abs(new Date(best) - new Date(e.target.value)) ? d : best, dates[0]);
        picker.value = state.selectedDate;
      }
      renderAll();
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

  // ===== 差分バッジ生成 =====
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
    const date = state.selectedDate;
    const today = calcDailyAll(date);
    const prev = getPrevDate(date) ? calcDailyAll(getPrevDate(date)) : null;

    const $ = (id) => document.getElementById(id);

    $('kpi-sales').textContent = fmt.yenShort(today.sales);
    $('kpi-sales-diff').innerHTML = '前日比 ' + (prev ? diffBadge(today.sales, prev.sales) : '--');

    $('kpi-f').textContent = fmt.yenShort(today.f);
    $('kpi-f-rate').textContent = fmt.pct(today.fRate);

    $('kpi-l').textContent = fmt.yenShort(today.l);
    $('kpi-l-rate').textContent = fmt.pct(today.lRate);

    // FL合計比率 vs 平均目標（全店の目標平均）
    const avgTargetFL = getData().stores.reduce((a, s) => a + s.targetF + s.targetL, 0) / getData().stores.length;
    $('kpi-fl-rate').textContent = fmt.pct(today.flRate);
    const flDiff = today.flRate - avgTargetFL;
    const flBadgeCls = flDiff <= 0 ? 'good' : 'bad';
    const flSign = flDiff >= 0 ? '▲' : '▼';
    $('kpi-fl-diff').innerHTML = `目標平均 ${avgTargetFL.toFixed(1)}% <span class="diff-badge ${flBadgeCls}">${flSign} ${Math.abs(flDiff).toFixed(1)}pt</span>`;

    $('kpi-fl-profit').textContent = fmt.yenShort(today.flProfit);
    $('kpi-fl-profit-rate').textContent = fmt.pct(today.flProfitRate);

    $('kpi-op-profit').textContent = fmt.yenShort(today.opProfit);
    $('kpi-op-profit-rate').textContent = fmt.pct(today.opProfitRate);

    // 直近30日のグラフ
    const recent30 = calcRecentDays('ALL', date, 30);
    Charts.renderDailySalesProfit('chart-daily-sales', recent30);

    // 店舗別ランキング
    const storeRows = getData().stores.map(s => {
      const d = calcDaily(s.id, date);
      return d ? { name: s.name, sales: d.sales } : null;
    }).filter(Boolean);
    Charts.renderStoreRanking('chart-store-ranking', storeRows);

    // FL比率推移（14日）
    const recent14 = calcRecentDays('ALL', date, 14);
    Charts.renderFLTrend('chart-fl-trend', recent14, 32, 27);
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
    const store = getStore(state.selectedStoreId);
    if (!store) return;
    const d = calcDaily(store.id, state.selectedDate);
    const $ = (id) => document.getElementById(id);

    $('store-title').textContent = store.name;

    if (!d) {
      ['store-sales','store-f','store-l','store-fl-profit','store-op-profit'].forEach(id => $(id).textContent = '--');
      return;
    }

    $('store-sales').textContent = fmt.yenShort(d.sales);
    $('store-customers').textContent = `${d.customers} 組`;

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
          <span style="color:var(--text-secondary); font-size:0.85rem;">本日FL比率</span>
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

    // 直近14日グラフ
    const recent14 = calcRecentDays(store.id, state.selectedDate, 14);
    Charts.renderStoreDaily('chart-store-daily', recent14);

    // 日次明細テーブル（新しい順）
    const tbody = document.querySelector('#table-store-detail tbody');
    tbody.innerHTML = '';
    [...recent14].reverse().forEach(r => {
      const fGood = r.fRate <= store.targetF;
      const lGood = r.lRate <= store.targetL;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${fmt.dateMD(r.date)}</strong></td>
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
    const month = dateToMonth(state.selectedDate);
    const stores = getData().stores;

    // 月次PL
    const plTbody = document.querySelector('#table-monthly-pl tbody');
    plTbody.innerHTML = '';
    const items = [
      { key: 'sales',     label: '売上',          highlight: false },
      { key: 'f',         label: 'F（食材原価）', highlight: false },
      { key: 'l',         label: 'L（人件費）',   highlight: false },
      { key: 'flProfit',  label: 'FL引き後利益',  highlight: true  },
      { key: 'rent',      label: '家賃（経過日割）',   highlight: false },
      { key: 'utilities', label: '光熱費（経過日割）', highlight: false },
      { key: 'opProfit',  label: '営業利益',      highlight: true  },
      { key: 'ordProfit', label: '経常利益',      highlight: true  },
    ];
    const monthly = stores.map(s => ({ store: s, data: calcMonthly(s.id, month) }));
    items.forEach(item => {
      const tr = document.createElement('tr');
      if (item.highlight) tr.classList.add('highlight-row');
      let cells = `<td>${item.label}</td>`;
      let total = 0;
      monthly.forEach(m => {
        const val = m.data ? m.data[item.key] : 0;
        total += val || 0;
        cells += `<td class="num">${val ? fmt.yenShort(val) : '--'}</td>`;
      });
      cells += `<td class="num"><strong>${fmt.yenShort(total)}</strong></td>`;
      tr.innerHTML = cells;
      plTbody.appendChild(tr);
    });

    // 固定費テーブル
    const expTbody = document.querySelector('#table-expenses tbody');
    expTbody.innerHTML = '';
    stores.forEach(s => {
      const exp = getData().monthlyExpenses.find(e => e.storeId === s.id && e.month === month);
      if (!exp) return;
      const total = exp.rent + exp.utilities;
      const daily = total / daysInMonth(month);
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

    // MF突合テーブル
    const mfTbody = document.querySelector('#table-mf tbody');
    mfTbody.innerHTML = '';
    getData().mfReconciliation.forEach(r => {
      const diff = r.mfValue - r.ourValue;
      const diffAbs = Math.abs(diff);
      const threshold = r.ourValue * 0.005; // 0.5%を閾値
      const isAlert = diffAbs > threshold && diffAbs > 1000;
      const cls = diff === 0 ? 'neutral' : (isAlert ? 'bad' : 'neutral');
      const sign = diff > 0 ? '+' : (diff < 0 ? '−' : '');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.month}</td>
        <td>${r.item}</td>
        <td class="num">${fmt.yen(r.ourValue)}</td>
        <td class="num">${fmt.yen(r.mfValue)}</td>
        <td class="num"><span class="diff-badge ${cls}">${sign}${fmt.yen(diffAbs).replace('¥', '¥')}</span></td>
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
    state.selectedDate = getLatestDate();
    state.selectedStoreId = getData().stores[0].id;
    initTabs();
    initDatePicker();
    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
