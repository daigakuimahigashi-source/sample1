/**
 * 焼肉店 5店舗 Daily FL管理ダッシュボード用 ダミーデータ
 *
 * 将来的にはレジPOS・MF勤怠・MFクラウド会計からデータ取得する前提。
 * 当面はこのファイルで開発・検証を行う。
 */

// ===== 店舗マスタ =====
const STORES = [
  { id: 'matsuyama',   name: '那覇松山店',   targetF: 32, targetL: 28 },
  { id: 'kumoji',      name: '那覇久茂地店', targetF: 33, targetL: 27 },
  { id: 'miebashi',    name: '美栄橋店',     targetF: 32, targetL: 28 },
  { id: 'misato',      name: '美里店',       targetF: 30, targetL: 26 },
  { id: 'isshokenmei', name: '一所懸命',     targetF: 34, targetL: 26 },
];

// ===== 月次固定費（家賃・光熱費） =====
const MONTHLY_EXPENSES = [
  { storeId: 'matsuyama',   month: '2026-04', rent: 520000, utilities: 195000 },
  { storeId: 'kumoji',      month: '2026-04', rent: 480000, utilities: 180000 },
  { storeId: 'miebashi',    month: '2026-04', rent: 510000, utilities: 185000 },
  { storeId: 'misato',      month: '2026-04', rent: 380000, utilities: 165000 },
  { storeId: 'isshokenmei', month: '2026-04', rent: 420000, utilities: 175000 },
  { storeId: 'matsuyama',   month: '2026-03', rent: 520000, utilities: 210000 },
  { storeId: 'kumoji',      month: '2026-03', rent: 480000, utilities: 198000 },
  { storeId: 'miebashi',    month: '2026-03', rent: 510000, utilities: 205000 },
  { storeId: 'misato',      month: '2026-03', rent: 380000, utilities: 178000 },
  { storeId: 'isshokenmei', month: '2026-03', rent: 420000, utilities: 188000 },
];

// ===== 日次売上データを生成（過去45日分×5店舗） =====
// 店舗ごとの売上規模・ばらつき特性を定義
const STORE_PROFILES = {
  matsuyama:   { base: 520000, variance: 120000, fRate: 0.325, lRate: 0.275, weekendBoost: 1.35 },
  kumoji:      { base: 480000, variance: 110000, fRate: 0.335, lRate: 0.270, weekendBoost: 1.40 },
  miebashi:    { base: 430000, variance: 100000, fRate: 0.320, lRate: 0.285, weekendBoost: 1.30 },
  misato:      { base: 380000, variance: 85000,  fRate: 0.295, lRate: 0.260, weekendBoost: 1.25 },
  isshokenmei: { base: 410000, variance: 95000,  fRate: 0.345, lRate: 0.258, weekendBoost: 1.32 },
};

function generateDailySales() {
  const result = [];
  const today = new Date('2026-04-10'); // 今日
  const DAYS = 45;

  // 決定論的な疑似乱数（日付＋店舗IDから計算 → リロードしても同じ値）
  const pseudoRandom = (seed) => {
    let x = 0;
    for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) >>> 0;
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };

  for (let d = DAYS - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${dd}`;
    const isWeekend = date.getDay() === 5 || date.getDay() === 6; // 金土

    STORES.forEach(store => {
      const p = STORE_PROFILES[store.id];
      const r1 = pseudoRandom(dateStr + store.id + '1');
      const r2 = pseudoRandom(dateStr + store.id + '2');
      const r3 = pseudoRandom(dateStr + store.id + '3');

      const weekendMul = isWeekend ? p.weekendBoost : 1;
      const sales = Math.round((p.base + (r1 - 0.5) * 2 * p.variance) * weekendMul / 1000) * 1000;
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

const DAILY_SALES = generateDailySales();

// ===== MF突合用ダミーデータ（月次） =====
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

// ===== お知らせ（管理タブ用） =====
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
