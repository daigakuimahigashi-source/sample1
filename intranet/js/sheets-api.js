/**
 * スマレジ GAS API 連携モジュール
 * daily_summary シートのデータを取得し、SAMPLE_DATA 形式に変換する
 */
const SheetsAPI = (() => {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbykLuUaDsP2vbsSh73Vm1Kh70nuxsZMoC5_U9m7p0WyTtIaGshNy98rmmsStH46xoA/exec';

  // スマレジ店舗ID → ダッシュボード storeId
  const STORE_ID_MAP = {
    '1': 'matsuyama',
    '2': 'kumoji',
    '3': 'misato',
    '4': 'miebashi',
  };

  async function fetchDailySummary() {
    const res = await fetch(GAS_URL);
    if (!res.ok) throw new Error('GAS fetch failed: ' + res.status);
    const json = await res.json();

    return json.data
      .filter(row => row['売上合計'] > 0)
      .map(row => ({
        date:              String(row['日付']).substring(0, 10),
        storeId:           STORE_ID_MAP[String(row['店舗ID'])] || String(row['店舗ID']),
        sales:             Number(row['売上合計'])   || 0,
        estimatedFoodCost: Number(row['原価合計'])   || 0,
        laborCost:         0,  // MF勤怠連携後に更新
        guestCount:        Number(row['客数'])       || 0,
        transactionCount:  Number(row['取引件数'])   || 0,
      }));
  }

  return { fetchDailySummary };
})();
