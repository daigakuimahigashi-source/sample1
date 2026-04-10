/**
 * 焼肉店 5店舗 Daily/Monthly/Yearly FL管理ダッシュボード用 ダミーデータ
 *
 * 将来的にはレジPOS・MF勤怠・MFクラウド会計からデータ取得する前提。
 * 当面はこのファイルで開発・検証を行う。
 *
 * 生成内容:
 * - 過去 24ヶ月分の日次売上データ（季節性・成長トレンド付き）
 * - 24ヶ月分の月次固定費（家賃固定、光熱費は夏冬増加）
 */

// ===== 店舗マスタ =====
const STORES = [
  { id: 'matsuyama',   name: '那覇松山店',   targetF: 32, targetL: 28 },
  { id: 'kumoji',      name: '那覇久茂地店', targetF: 33, targetL: 27 },
  { id: 'miebashi',    name: '美栄橋店',     targetF: 32, targetL: 28 },
  { id: 'misato',      name: '美里店',       targetF: 30, targetL: 26 },
  { id: 'isshokenmei', name: '一所懸命',     targetF: 34, targetL: 26 },
];

// ===== 基準日 =====
const TODAY = new Date('2026-04-10');
const MONTHS_BACK = 24; // 24ヶ月分のデータを生成

// ===== 店舗プロファイル =====
const STORE_PROFILES = {
  matsuyama:   { base: 520000, variance: 120000, fRate: 0.325, lRate: 0.275, weekendBoost: 1.35, baseRent: 520000, baseUtilities: 180000 },
  kumoji:      { base: 480000, variance: 110000, fRate: 0.335, lRate: 0.270, weekendBoost: 1.40, baseRent: 480000, baseUtilities: 170000 },
  miebashi:    { base: 430000, variance: 100000, fRate: 0.320, lRate: 0.285, weekendBoost: 1.30, baseRent: 510000, baseUtilities: 175000 },
  misato:      { base: 380000, variance: 85000,  fRate: 0.295, lRate: 0.260, weekendBoost: 1.25, baseRent: 380000, baseUtilities: 155000 },
  isshokenmei: { base: 410000, variance: 95000,  fRate: 0.345, lRate: 0.258, weekendBoost: 1.32, baseRent: 420000, baseUtilities: 165000 },
};

// ===== 決定論的な疑似乱数 =====
function pseudoRandom(seed) {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
  x = (x * 9301 + 49297) % 233280;
  return x / 233280;
}

// ===== 季節性係数（月ベース） =====
function seasonalFactor(month) {
  // month: 1-12
  const factors = {
    1: 0.88,  // 1月: 閑散期
    2: 0.90,  // 2月: 閑散期
    3: 1.15,  // 3月: 歓送迎会シーズン
    4: 1.12,  // 4月: 歓迎会シーズン
    5: 1.02,  // 5月: GW後やや落ち着く
    6: 0.98,  // 6月: 梅雨で少し低迷
    7: 1.10,  // 7月: 夏ビール需要
    8: 1.12,  // 8月: 夏休み・お盆
    9: 1.00,  // 9月: 平常
    10: 1.05, // 10月: 秋の会食シーズン
    11: 1.08, // 11月: 忘年会シーズン入り
    12: 1.28, // 12月: 忘年会ピーク
  };
  return factors[month] || 1.0;
}

// ===== 光熱費の季節変動 =====
function utilitiesFactor(month) {
  // 夏冬はエアコンで上昇
  const factors = {
    1: 1.25, 2: 1.22, 3: 1.05, 4: 0.95, 5: 0.92, 6: 1.00,
    7: 1.30, 8: 1.35, 9: 1.15, 10: 0.95, 11: 1.00, 12: 1.18,
  };
  return factors[month] || 1.0;
}

// ===== 日次売上データを生成 =====
function generateDailySales() {
  const result = [];
  const startDate = new Date(TODAY);
  startDate.setMonth(startDate.getMonth() - MONTHS_BACK);
  startDate.setDate(1);

  // 生成総日数
  const totalDays = Math.ceil((TODAY - startDate) / (24 * 60 * 60 * 1000));

  for (let offset = 0; offset <= totalDays; offset++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    if (date > TODAY) break;

    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const dd = date.getDate();
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const isWeekend = date.getDay() === 5 || date.getDay() === 6; // 金土
    const dow = date.getDay(); // 0:日 ~ 6:土
    const season = seasonalFactor(m);

    // 経過月数ベースの成長トレンド (+0.5%/月)
    const monthsElapsed = (y - startDate.getFullYear()) * 12 + (m - (startDate.getMonth() + 1));
    const growth = 1 + monthsElapsed * 0.005;

    STORES.forEach(store => {
      const p = STORE_PROFILES[store.id];
      const r1 = pseudoRandom(dateStr + store.id + '1');
      const r2 = pseudoRandom(dateStr + store.id + '2');
      const r3 = pseudoRandom(dateStr + store.id + '3');

      const weekendMul = isWeekend ? p.weekendBoost : (dow === 0 ? 0.85 : 1); // 日曜日は少し控えめ
      const sales = Math.round((p.base + (r1 - 0.5) * 2 * p.variance) * weekendMul * season * growth / 1000) * 1000;
      const fRateActual = p.fRate + (r2 - 0.5) * 0.04;
      const lRateActual = p.lRate + (r3 - 0.5) * 0.03;
      const estimatedFoodCost = Math.round(sales * fRateActual / 100) * 100;
      const laborCost = Math.round(sales * lRateActual / 100) * 100;
      const customers = Math.round(sales / (4200 + (r1 - 0.5) * 800));

      result.push({
        date: dateStr,
        storeId: store.id,
        sales,
        estimatedFoodCost,
        laborCost,
        customers,
      });
    });
  }

  return result;
}

// ===== 月次固定費を生成（24ヶ月分） =====
function generateMonthlyExpenses() {
  const result = [];
  const startDate = new Date(TODAY);
  startDate.setMonth(startDate.getMonth() - MONTHS_BACK);
  startDate.setDate(1);

  for (let i = 0; i <= MONTHS_BACK; i++) {
    const d = new Date(startDate);
    d.setMonth(startDate.getMonth() + i);
    if (d > TODAY) break;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;
    const uFactor = utilitiesFactor(m);

    STORES.forEach(store => {
      const p = STORE_PROFILES[store.id];
      const r = pseudoRandom(monthStr + store.id);
      // 光熱費は季節で変動＋±5%ランダム
      const utilities = Math.round(p.baseUtilities * uFactor * (0.95 + r * 0.1) / 1000) * 1000;
      result.push({
        storeId: store.id,
        month: monthStr,
        rent: p.baseRent,
        utilities,
      });
    });
  }

  return result;
}

const DAILY_SALES = generateDailySales();
const MONTHLY_EXPENSES = generateMonthlyExpenses();

// ===== MF突合用ダミーデータ（直近数ヶ月） =====
const MF_RECONCILIATION = [
  { month: '2026-04', item: '売上',     ourValue: 12450000, mfValue: 12450000, note: '一致' },
  { month: '2026-04', item: '食材仕入', ourValue: 4012500,  mfValue: 4028900,  note: '仕入明細の計上タイミング差' },
  { month: '2026-04', item: '人件費',   ourValue: 3385200,  mfValue: 3385200,  note: '一致' },
  { month: '2026-04', item: '家賃',     ourValue: 2310000,  mfValue: 2310000,  note: '一致' },
  { month: '2026-04', item: '光熱費',   ourValue: 900000,   mfValue: 912450,   note: '検針日ズレ' },
  { month: '2026-03', item: '売上',     ourValue: 38920000, mfValue: 38920000, note: '一致' },
  { month: '2026-03', item: '食材仕入', ourValue: 12680000, mfValue: 12695400, note: '端数調整' },
  { month: '2026-03', item: '人件費',   ourValue: 10540000, mfValue: 10540000, note: '一致' },
  { month: '2026-03', item: '家賃',     ourValue: 2310000,  mfValue: 2310000,  note: '一致' },
  { month: '2026-03', item: '光熱費',   ourValue: 979000,   mfValue: 979000,   note: '一致' },
];

// ===== お知らせ =====
const ANNOUNCEMENTS = [
  { date: '2026-04-10', title: '4月度 月次会議のお知らせ', content: '4/20（月）14:00〜 本部会議室。各店長は3月度実績資料を持参してください。' },
  { date: '2026-04-08', title: '食材原価高騰への対応', content: '和牛カルビの仕入価格が上昇。推奨売価の見直しを検討中です。' },
  { date: '2026-04-05', title: 'GW繁忙期シフト調整', content: '4/29〜5/6の繁忙期シフトを各店長は4/15までに提出ください。' },
  { date: '2026-04-01', title: '新年度FL目標設定', content: '店舗ごとの新年度FL目標を本ダッシュボードに反映済みです。' },
];

// ===== 全体エクスポート =====
const SAMPLE_DATA = {
  stores: STORES,
  dailySales: DAILY_SALES,
  monthlyExpenses: MONTHLY_EXPENSES,
  mfReconciliation: MF_RECONCILIATION,
  announcements: ANNOUNCEMENTS,
};
