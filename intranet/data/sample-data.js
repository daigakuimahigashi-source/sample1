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

// ===== スタッフマスタ =====
// type: 'fulltime'=正社員, 'parttime'=アルバイト
const STAFF = [
  // 那覇松山店（6名：正社員2、バイト4）
  { id: 's01', name: '比嘉 太郎',   hourlyRate: 1050, stores: ['matsuyama'],          type: 'fulltime' },
  { id: 's02', name: '仲村 花子',   hourlyRate: 1000, stores: ['matsuyama'],          type: 'fulltime' },
  { id: 's03', name: '上原 健一',   hourlyRate: 1100, stores: ['matsuyama'],          type: 'parttime' },
  { id: 's04', name: '新垣 美咲',   hourlyRate:  980, stores: ['matsuyama'],          type: 'parttime' },
  { id: 's05', name: '金城 翔',     hourlyRate: 1020, stores: ['matsuyama', 'kumoji'], type: 'parttime' },
  { id: 's06', name: '宮城 真由美', hourlyRate: 1000, stores: ['matsuyama'],          type: 'parttime' },
  // 那覇久茂地店（5名：正社員2、バイト3）
  { id: 's07', name: '島袋 大輔',   hourlyRate: 1080, stores: ['kumoji'],              type: 'fulltime' },
  { id: 's08', name: '平良 さくら', hourlyRate: 1000, stores: ['kumoji'],              type: 'fulltime' },
  { id: 's09', name: '城間 裕太',   hourlyRate:  980, stores: ['kumoji'],              type: 'parttime' },
  { id: 's10', name: '赤嶺 えみ',   hourlyRate: 1050, stores: ['kumoji', 'miebashi'],  type: 'parttime' },
  { id: 's11', name: '仲間 優',     hourlyRate: 1020, stores: ['kumoji'],              type: 'parttime' },
  // 美栄橋店（4名：正社員1、バイト3）
  { id: 's12', name: '玉城 拓也',   hourlyRate: 1100, stores: ['miebashi'],            type: 'fulltime' },
  { id: 's13', name: '照屋 美穂',   hourlyRate: 1000, stores: ['miebashi'],            type: 'parttime' },
  { id: 's14', name: '知念 将太',   hourlyRate:  980, stores: ['miebashi', 'misato'],  type: 'parttime' },
  { id: 's15', name: '大城 あおい', hourlyRate: 1020, stores: ['miebashi'],            type: 'parttime' },
  // 美里店（3名：正社員1、バイト2 ※小規模＋掛持ちでカバー）
  { id: 's16', name: '具志堅 光',   hourlyRate: 1050, stores: ['misato'],              type: 'fulltime' },
  { id: 's17', name: '喜屋武 琴音', hourlyRate:  980, stores: ['misato'],              type: 'parttime' },
  // 一所懸命（8名：正社員2、バイト6）
  { id: 's18', name: '安里 修',     hourlyRate: 1080, stores: ['isshokenmei'],             type: 'fulltime' },
  { id: 's19', name: '伊波 凛',     hourlyRate: 1000, stores: ['isshokenmei'],             type: 'fulltime' },
  { id: 's20', name: '嘉手納 大地', hourlyRate: 1050, stores: ['isshokenmei'],             type: 'parttime' },
  { id: 's21', name: '當山 ひなの', hourlyRate:  980, stores: ['isshokenmei'],             type: 'parttime' },
  { id: 's22', name: '友寄 聡',     hourlyRate: 1020, stores: ['isshokenmei'],             type: 'parttime' },
  { id: 's23', name: '屋比久 千夏', hourlyRate: 1000, stores: ['isshokenmei', 'matsuyama'], type: 'parttime' },
  { id: 's24', name: '桃原 翼',     hourlyRate:  980, stores: ['isshokenmei'],             type: 'parttime' },
  { id: 's25', name: '与那嶺 まりな', hourlyRate: 1050, stores: ['isshokenmei'],           type: 'parttime' },
];

// ===== シフト（日次出勤データ）を生成 =====
function generateDailyShifts() {
  const result = [];
  const startDate = new Date(TODAY);
  startDate.setMonth(startDate.getMonth() - MONTHS_BACK);
  startDate.setDate(1);
  const totalDays = Math.ceil((TODAY - startDate) / (24 * 60 * 60 * 1000));

  // 開店パターン（焼肉屋は午後〜夜）
  const SHIFT_PATTERNS = [
    { start: 11, end: 15, hours: 4 },   // ランチ
    { start: 15, end: 22, hours: 7 },   // 通し午後
    { start: 17, end: 22, hours: 5 },   // ディナー短
    { start: 17, end: 23, hours: 6 },   // ディナー長
    { start: 11, end: 22, hours: 10 },  // フル（休憩1h込み→実質9h）
  ];

  for (let offset = 0; offset <= totalDays; offset++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    if (date > TODAY) break;

    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const dd = date.getDate();
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const dow = date.getDay();
    const isWeekend = dow === 5 || dow === 6;

    STAFF.forEach(staff => {
      staff.stores.forEach((storeId, storeIdx) => {
        const seed = dateStr + staff.id + storeId;
        const r = pseudoRandom(seed);

        // 出勤確率: メイン店舗は週5、掛持ち先は週2〜3
        const isMain = storeIdx === 0;
        const workProb = isMain
          ? (isWeekend ? 0.85 : 0.72)       // メイン: 金土は高確率
          : (isWeekend ? 0.40 : 0.25);       // サブ: 週2〜3日
        // 両方出勤は避ける（掛持ち先の日はメイン店舗は休み）
        if (!isMain) {
          const mainSeed = dateStr + staff.id + staff.stores[0];
          const mainR = pseudoRandom(mainSeed);
          const mainWork = (isWeekend ? 0.85 : 0.72);
          if (mainR < mainWork) return; // メイン出勤日なのでサブは休み
        }

        if (r >= workProb) return; // 休み

        // シフトパターン選択
        const patIdx = Math.floor(pseudoRandom(seed + 'pat') * SHIFT_PATTERNS.length);
        const pat = SHIFT_PATTERNS[patIdx];
        // 週末は少し長め
        const extraHour = isWeekend && pat.hours < 8 ? 1 : 0;
        const hours = pat.hours + extraHour;
        const endHour = Math.min(pat.start + hours + (hours >= 8 ? 1 : 0), 24); // 8h以上は休憩1h込み
        const breakMin = hours >= 6 ? 60 : (hours >= 4.5 ? 30 : 0);
        const actualHours = hours; // 休憩除いた実労働

        // 深夜割増計算（22時以降 ×1.25）
        const lateNightHours = endHour > 22 ? endHour - 22 : 0;
        const normalHours = actualHours - lateNightHours;
        const laborCost = Math.round(
          normalHours * staff.hourlyRate + lateNightHours * staff.hourlyRate * 1.25
        );

        result.push({
          date: dateStr,
          staffId: staff.id,
          storeId,
          startHour: pat.start,
          endHour,
          hours: actualHours,
          lateNightHours,
          breakMinutes: breakMin,
          laborCost,
        });
      });
    });
  }
  return result;
}

const DAILY_SALES = generateDailySales();
const MONTHLY_EXPENSES = generateMonthlyExpenses();
const DAILY_SHIFTS = generateDailyShifts();

// ===== 全体エクスポート =====
const SAMPLE_DATA = {
  stores: STORES,
  staff: STAFF,
  dailySales: DAILY_SALES,
  dailyShifts: DAILY_SHIFTS,
  monthlyExpenses: MONTHLY_EXPENSES,
};
