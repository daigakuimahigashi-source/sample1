/**
 * ダミーデータ（Google Sheets未接続時に使用）
 */
const SAMPLE_DATA = {
  // 月次売上データ（2025年4月〜2026年3月）
  monthlySales: [
    { month: '2025-04', sales: 4200000, target: 5000000 },
    { month: '2025-05', sales: 5100000, target: 5000000 },
    { month: '2025-06', sales: 4800000, target: 5000000 },
    { month: '2025-07', sales: 5500000, target: 5500000 },
    { month: '2025-08', sales: 3900000, target: 5500000 },
    { month: '2025-09', sales: 6200000, target: 5500000 },
    { month: '2025-10', sales: 5800000, target: 6000000 },
    { month: '2025-11', sales: 6500000, target: 6000000 },
    { month: '2025-12', sales: 7100000, target: 6000000 },
    { month: '2026-01', sales: 5400000, target: 6500000 },
    { month: '2026-02', sales: 6800000, target: 6500000 },
    { month: '2026-03', sales: 7500000, target: 6500000 },
  ],

  // 案件パイプライン
  pipeline: [
    { stage: '商談', count: 24, amount: 18500000 },
    { stage: '提案', count: 15, amount: 12000000 },
    { stage: '交渉', count: 8,  amount: 7200000 },
    { stage: '成約', count: 5,  amount: 4800000 },
  ],

  // 担当者別成績（今期累計）
  members: [
    { name: '田中 太郎', role: '営業部長',   sales: 18500000, target: 18000000, deals: 12 },
    { name: '佐藤 花子', role: 'シニア営業', sales: 15200000, target: 15000000, deals: 10 },
    { name: '鈴木 一郎', role: '営業',       sales: 12800000, target: 14000000, deals: 8 },
    { name: '高橋 美咲', role: '営業',       sales: 11500000, target: 12000000, deals: 7 },
    { name: '伊藤 健太', role: 'ジュニア営業', sales: 9800000, target: 10000000, deals: 6 },
  ],

  // お知らせ
  announcements: [
    { date: '2026-04-09', title: '4月度全体ミーティング', content: '4/15（水）14:00〜 会議室Aにて実施します。' },
    { date: '2026-04-07', title: '新規取引先リスト更新', content: '営業共有フォルダに最新リストをアップしました。' },
    { date: '2026-04-03', title: 'GW休暇について', content: '4/29〜5/6は全社休業です。事前に顧客対応を完了してください。' },
    { date: '2026-04-01', title: '新年度目標設定', content: '各自の目標シートを4/10までに提出してください。' },
  ],

  // チームメンバー一覧（管理ページ用）
  team: [
    { name: '田中 太郎', role: '営業部長', email: 'tanaka@example.com', phone: '090-1234-5678', status: 'active' },
    { name: '佐藤 花子', role: 'シニア営業', email: 'sato@example.com', phone: '090-2345-6789', status: 'active' },
    { name: '鈴木 一郎', role: '営業', email: 'suzuki@example.com', phone: '090-3456-7890', status: 'active' },
    { name: '高橋 美咲', role: '営業', email: 'takahashi@example.com', phone: '090-4567-8901', status: 'active' },
    { name: '伊藤 健太', role: 'ジュニア営業', email: 'ito@example.com', phone: '090-5678-9012', status: 'active' },
    { name: '山本 理恵', role: '事務', email: 'yamamoto@example.com', phone: '090-6789-0123', status: 'active' },
  ],
};
