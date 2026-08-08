/**
 * スマレジ GAS API 連携モジュール
 * daily_summary シートのデータを取得し、SAMPLE_DATA 形式に変換する
 */
const SheetsAPI = (() => {
  const GAS_URL       = 'https://script.google.com/macros/s/AKfycbxTNT5mAzNsPenb_D3tI19oO4ziPg8Fc7L4hXTSn5QNxHhcrIe4VzvHST0hmZFoPsDX/exec';
  const LABOR_API_URL = 'https://script.google.com/macros/s/AKfycbyshjsL_IXWMia1n3pg0SbQVhJgzoBpA65ywfNVM2tzVKRSp1sVc6fn02NbhZQq0TOI/exec';

  // スマレジ店舗ID → ダッシュボード storeId
  const STORE_ID_MAP = {
    '1': 'matsuyama',
    '2': 'kumoji',
    '3': 'misato',
    '4': 'miebashi',
  };

  async function fetchDailySummary() {
    // 売上データとMF勤怠データを並列取得
    const [salesRes, laborRes] = await Promise.allSettled([
      fetch(GAS_URL),
      fetch(LABOR_API_URL),
    ]);

    if (salesRes.status === 'rejected' || !salesRes.value.ok) {
      throw new Error('GAS fetch failed');
    }
    const json = await salesRes.value.json();

    // MF勤怠データを日付+店舗IDでマップ化
    const laborMap = {};
    if (laborRes.status === 'fulfilled' && laborRes.value.ok) {
      const laborJson = await laborRes.value.json();
      if (Array.isArray(laborJson.laborData)) {
        laborJson.laborData.forEach(row => {
          const key = row.date + '_' + row.storeId;
          laborMap[key] = (laborMap[key] || 0) + (Number(row.laborCost) || 0);
        });
      }
    }

    return json.data
      .filter(row => row['売上合計'] > 0)
      .map(row => {
        const date    = String(row['日付']).substring(0, 10);
        const storeId = STORE_ID_MAP[String(row['店舗ID'])] || String(row['店舗ID']);
        const key     = date + '_' + storeId;
        return {
          date,
          storeId,
          sales:             Number(row['売上合計'])   || 0,
          estimatedFoodCost: Number(row['原価合計'])   || 0,
          laborCost:         laborMap[key] || 0,   // MF勤怠の実績を反映
          guestCount:        Number(row['客数'])       || 0,
          transactionCount:  Number(row['取引件数'])   || 0,
        };
      });
  }

  return { fetchDailySummary };
})();
