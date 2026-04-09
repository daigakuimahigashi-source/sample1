/**
 * Chart.js グラフ描画モジュール
 * 焼肉店 FL管理ダッシュボード用
 */
const Charts = (() => {
  // Chart.js グローバル設定（ライトテーマ用）
  Chart.defaults.color = '#7a5d4a';
  Chart.defaults.borderColor = 'rgba(44, 24, 16, 0.08)';
  Chart.defaults.font.family = "'Noto Sans JP', sans-serif";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(44, 24, 16, 0.92)';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;

  // カラーパレット
  const COLORS = {
    accent: '#d64933',
    accentLight: '#e86b4f',
    warm: '#f4a261',
    success: '#4a9960',
    brown: '#8b5a3c',
    purple: '#8e5a9c',
    muted: 'rgba(44, 24, 16, 0.08)',
  };

  const instances = {};

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  const fmtYenAxis = v => {
    if (Math.abs(v) >= 10000) return (v / 10000).toLocaleString() + '万';
    return v.toLocaleString();
  };
  const fmtYenTooltip = v => '¥' + Number(v).toLocaleString();

  /** 直近N日の売上（棒）＋FL引き後利益（折れ線） */
  function renderDailySalesProfit(canvasId, rows) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = rows.map(r => {
      const [, m, d] = r.date.split('-');
      return `${parseInt(m)}/${parseInt(d)}`;
    });

    instances[canvasId] = new Chart(ctx, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: '売上',
            data: rows.map(r => r.sales),
            backgroundColor: 'rgba(214, 73, 51, 0.7)',
            borderColor: COLORS.accent,
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
            yAxisID: 'y',
          },
          {
            type: 'line',
            label: 'FL引き後利益',
            data: rows.map(r => r.flProfit),
            borderColor: COLORS.success,
            backgroundColor: 'rgba(74, 153, 96, 0.15)',
            borderWidth: 2.5,
            pointBackgroundColor: COLORS.success,
            pointRadius: 3,
            tension: 0.3,
            fill: true,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: COLORS.muted },
            ticks: { callback: fmtYenAxis },
          },
          x: { grid: { display: false } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${fmtYenTooltip(ctx.parsed.y)}`,
            },
          },
        },
      },
    });
  }

  /** 店舗別売上ランキング（横棒） */
  function renderStoreRanking(canvasId, storeRows) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const sorted = [...storeRows].sort((a, b) => b.sales - a.sales);
    const palette = [COLORS.accent, COLORS.warm, COLORS.purple, COLORS.success, COLORS.brown];

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(s => s.name),
        datasets: [
          {
            label: '売上',
            data: sorted.map(s => s.sales),
            backgroundColor: sorted.map((_, i) => palette[i % palette.length] + 'cc'),
            borderColor: sorted.map((_, i) => palette[i % palette.length]),
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: COLORS.muted },
            ticks: { callback: fmtYenAxis },
          },
          y: { grid: { display: false } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => fmtYenTooltip(ctx.parsed.x),
            },
          },
        },
      },
    });
  }

  /** F率・L率 推移（折れ線、目標ライン付き） */
  function renderFLTrend(canvasId, rows, targetF, targetL) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = rows.map(r => {
      const [, m, d] = r.date.split('-');
      return `${parseInt(m)}/${parseInt(d)}`;
    });

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'F率',
            data: rows.map(r => r.fRate),
            borderColor: COLORS.warm,
            backgroundColor: 'rgba(244, 162, 97, 0.15)',
            borderWidth: 2.5,
            pointRadius: 2,
            tension: 0.3,
            fill: true,
          },
          {
            label: 'L率',
            data: rows.map(r => r.lRate),
            borderColor: COLORS.brown,
            backgroundColor: 'rgba(139, 90, 60, 0.12)',
            borderWidth: 2.5,
            pointRadius: 2,
            tension: 0.3,
            fill: true,
          },
          {
            label: '目標F率',
            data: rows.map(() => targetF),
            borderColor: COLORS.warm,
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            fill: false,
          },
          {
            label: '目標L率',
            data: rows.map(() => targetL),
            borderColor: COLORS.brown,
            borderWidth: 1.5,
            borderDash: [5, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: COLORS.muted },
            ticks: { callback: v => v + '%' },
          },
          x: { grid: { display: false } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
            },
          },
        },
      },
    });
  }

  /** 店舗別の日次売上＆FL後利益（小さめ） */
  function renderStoreDaily(canvasId, rows) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = rows.map(r => {
      const [, m, d] = r.date.split('-');
      return `${parseInt(m)}/${parseInt(d)}`;
    });

    instances[canvasId] = new Chart(ctx, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: '売上',
            data: rows.map(r => r.sales),
            backgroundColor: 'rgba(214, 73, 51, 0.7)',
            borderColor: COLORS.accent,
            borderWidth: 1,
            borderRadius: 3,
            barPercentage: 0.65,
          },
          {
            type: 'line',
            label: 'FL引き後利益',
            data: rows.map(r => r.flProfit),
            borderColor: COLORS.success,
            backgroundColor: 'rgba(74, 153, 96, 0.15)',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { beginAtZero: true, grid: { color: COLORS.muted }, ticks: { callback: fmtYenAxis } },
          x: { grid: { display: false } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${fmtYenTooltip(ctx.parsed.y)}`,
            },
          },
        },
      },
    });
  }

  return { renderDailySalesProfit, renderStoreRanking, renderFLTrend, renderStoreDaily };
})();
