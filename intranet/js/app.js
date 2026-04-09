/**
 * メインアプリケーション
 */
(function () {
  'use strict';

  // ===== ユーティリティ =====
  const fmt = {
    yen: (n) => '¥' + n.toLocaleString('ja-JP'),
    yenShort: (n) => {
      if (n >= 100000000) return '¥' + (n / 100000000).toFixed(1) + '億';
      if (n >= 10000) return '¥' + (n / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 0 }) + '万';
      return '¥' + n.toLocaleString('ja-JP');
    },
    pct: (n) => n.toFixed(1) + '%',
  };

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
        // タブ切り替え時にグラフを再描画（サイズ対応）
        if (tab === 'overview') renderOverview();
        if (tab === 'sales') renderSales();
      });
    });
  }

  // ===== データ取得 =====
  async function getData() {
    // SheetsAPI が利用可能でURLが設定されている場合はそちらを使う
    if (typeof SheetsAPI !== 'undefined' && SheetsAPI.isConfigured()) {
      try {
        return await SheetsAPI.fetchAll();
      } catch (e) {
        console.warn('Sheets API error, falling back to sample data:', e);
      }
    }
    return SAMPLE_DATA;
  }

  // ===== 概要ページ =====
  function renderOverview() {
    getData().then(data => {
      const totalSales = data.monthlySales.reduce((s, d) => s + d.sales, 0);
      const totalTarget = data.monthlySales.reduce((s, d) => s + d.target, 0);
      const achievement = (totalSales / totalTarget) * 100;
      const totalDeals = data.pipeline.reduce((s, d) => s + d.count, 0);
      const closeRate = (data.pipeline[data.pipeline.length - 1].count / data.pipeline[0].count) * 100;

      document.getElementById('kpi-total-sales').textContent = fmt.yenShort(totalSales);
      document.getElementById('kpi-total-sales-sub').textContent = '目標 ' + fmt.yenShort(totalTarget);
      document.getElementById('kpi-achievement').textContent = fmt.pct(achievement);
      const bar = document.getElementById('kpi-achievement-bar');
      bar.style.width = Math.min(achievement, 100) + '%';
      bar.style.background = achievement >= 100
        ? 'linear-gradient(90deg, #2ecc71, #27ae60)'
        : 'linear-gradient(90deg, #4361ee, #5a7bff)';

      document.getElementById('kpi-deals').textContent = totalDeals + '件';
      document.getElementById('kpi-close-rate').textContent = fmt.pct(closeRate);

      Charts.renderMonthly('chart-monthly', data.monthlySales);
    });
  }

  // ===== 営業ページ =====
  function renderSales() {
    getData().then(data => {
      // 今月（最新月）
      const latest = data.monthlySales[data.monthlySales.length - 1];
      const rate = (latest.sales / latest.target) * 100;

      document.getElementById('kpi-current-sales').textContent = fmt.yenShort(latest.sales);
      document.getElementById('kpi-current-target').textContent = fmt.yenShort(latest.target);
      document.getElementById('kpi-current-rate').textContent = fmt.pct(rate);

      const rateBar = document.getElementById('kpi-current-rate-bar');
      rateBar.style.width = Math.min(rate, 100) + '%';
      if (rate >= 100) {
        rateBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
        document.getElementById('kpi-current-rate-card').classList.add('accent-green');
      }

      // パイプライン
      renderFunnel(data.pipeline);

      // 担当者別
      Charts.renderMembers('chart-members', data.members);
      renderMembersTable(data.members);
    });
  }

  function renderFunnel(pipeline) {
    const container = document.getElementById('funnel-container');
    container.innerHTML = '';
    const maxAmount = Math.max(...pipeline.map(p => p.amount));

    pipeline.forEach((stage, i) => {
      const pct = (stage.amount / maxAmount) * 100;
      const row = document.createElement('div');
      row.className = 'funnel-row';
      row.innerHTML = `
        <div class="funnel-label">${stage.stage}</div>
        <div class="funnel-bar-wrap">
          <div class="funnel-bar stage-${i}" style="width: ${pct}%">
            ${stage.count}件
          </div>
        </div>
        <div class="funnel-stats">${fmt.yenShort(stage.amount)}</div>
      `;
      container.appendChild(row);
    });
  }

  function renderMembersTable(members) {
    const tbody = document.querySelector('#table-members tbody');
    tbody.innerHTML = '';
    const sorted = [...members].sort((a, b) => b.sales - a.sales);

    sorted.forEach(m => {
      const rate = (m.sales / m.target) * 100;
      const badgeClass = rate >= 100 ? 'good' : rate >= 85 ? 'warn' : 'bad';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${m.name}</strong></td>
        <td>${m.role}</td>
        <td class="num">${fmt.yenShort(m.sales)}</td>
        <td class="num">${fmt.yenShort(m.target)}</td>
        <td><span class="rate-badge ${badgeClass}">${fmt.pct(rate)}</span></td>
        <td class="num">${m.deals}件</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ===== 管理ページ =====
  function renderAdmin() {
    getData().then(data => {
      // チームメンバー
      const tbody = document.querySelector('#table-team tbody');
      tbody.innerHTML = '';
      data.team.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${m.name}</strong></td>
          <td>${m.role}</td>
          <td>${m.email}</td>
          <td>${m.phone}</td>
          <td><span class="status-badge ${m.status}">${m.status === 'active' ? '稼働中' : '休止'}</span></td>
        `;
        tbody.appendChild(tr);
      });

      // お知らせ
      const list = document.getElementById('announcements-list');
      list.innerHTML = '';
      data.announcements.forEach(a => {
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
    });
  }

  // ===== 初期化 =====
  function init() {
    initTabs();
    renderOverview();
    renderAdmin(); // 管理ページも事前レンダリング
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
