/**
 * Chart.js グラフ描画モジュール
 */
const Charts = (() => {
  // Chart.js グローバル設定
  Chart.defaults.color = '#8888a8';
  Chart.defaults.font.family = "'Noto Sans JP', sans-serif";
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;

  const instances = {};

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  /** 月次売上推移（棒グラフ + 目標ライン） */
  function renderMonthly(canvasId, data) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    const labels = data.map(d => {
      const [y, m] = d.month.split('-');
      return `${parseInt(m)}月`;
    });

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '売上',
            data: data.map(d => d.sales),
            backgroundColor: 'rgba(67, 97, 238, 0.7)',
            borderColor: '#4361ee',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.6,
          },
          {
            label: '目標',
            data: data.map(d => d.target),
            type: 'line',
            borderColor: '#e74c3c',
            borderWidth: 2,
            borderDash: [6, 3],
            pointBackgroundColor: '#e74c3c',
            pointRadius: 3,
            fill: false,
            tension: 0.3,
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
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              callback: v => (v / 10000).toLocaleString() + '万',
            },
          },
          x: { grid: { display: false } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ¥${ctx.parsed.y.toLocaleString()}`,
            },
          },
        },
      },
    });
  }

  /** 担当者別売上（横棒グラフ） */
  function renderMembers(canvasId, members) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    const sorted = [...members].sort((a, b) => b.sales - a.sales);

    const colors = ['#4361ee', '#7c3aed', '#e67e22', '#2ecc71', '#e74c3c'];

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(m => m.name),
        datasets: [
          {
            label: '売上',
            data: sorted.map(m => m.sales),
            backgroundColor: sorted.map((_, i) => colors[i % colors.length] + 'cc'),
            borderColor: sorted.map((_, i) => colors[i % colors.length]),
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.6,
          },
          {
            label: '目標',
            data: sorted.map(m => m.target),
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderColor: 'rgba(255,255,255,0.2)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.6,
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
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              callback: v => (v / 10000).toLocaleString() + '万',
            },
          },
          y: { grid: { display: false } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ¥${ctx.parsed.x.toLocaleString()}`,
            },
          },
        },
      },
    });
  }

  return { renderMonthly, renderMembers };
})();
