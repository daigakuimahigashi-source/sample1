/**
 * Google Sheets 連携モジュール
 *
 * 使い方:
 * 1. Google スプレッドシートを開く
 * 2. ファイル → 共有 → ウェブに公開 → CSV形式で公開
 * 3. 下記の SHEET_CONFIG に各シートの公開URLを設定
 *
 * シート構成例:
 *   - 月次売上シート: month, sales, target
 *   - パイプラインシート: stage, count, amount
 *   - メンバーシート: name, role, sales, target, deals
 *   - お知らせシート: date, title, content
 *   - チームシート: name, role, email, phone, status
 */
const SheetsAPI = (() => {
  // ===== 設定 =====
  // 各シートの公開CSV URLを設定してください
  // 例: 'https://docs.google.com/spreadsheets/d/e/XXXXX/pub?gid=0&single=true&output=csv'
  const SHEET_CONFIG = {
    monthlySales: '',
    pipeline: '',
    members: '',
    announcements: '',
    team: '',
  };

  function isConfigured() {
    return Object.values(SHEET_CONFIG).some(url => url.length > 0);
  }

  /** CSV文字列をオブジェクト配列にパース */
  function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj = {};
      headers.forEach((h, i) => {
        const val = values[i] || '';
        // 数値っぽい場合は数値に変換
        obj[h] = /^\d+$/.test(val) ? parseInt(val, 10) : val;
      });
      return obj;
    });
  }

  /** シートからデータ取得 */
  async function fetchSheet(url) {
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    const csv = await res.text();
    return parseCSV(csv);
  }

  /** 全シートを取得してSAMPLE_DATAと同じ構造で返す */
  async function fetchAll() {
    const results = {};

    if (SHEET_CONFIG.monthlySales) {
      results.monthlySales = await fetchSheet(SHEET_CONFIG.monthlySales);
    }
    if (SHEET_CONFIG.pipeline) {
      results.pipeline = await fetchSheet(SHEET_CONFIG.pipeline);
    }
    if (SHEET_CONFIG.members) {
      results.members = await fetchSheet(SHEET_CONFIG.members);
    }
    if (SHEET_CONFIG.announcements) {
      results.announcements = await fetchSheet(SHEET_CONFIG.announcements);
    }
    if (SHEET_CONFIG.team) {
      results.team = await fetchSheet(SHEET_CONFIG.team);
    }

    // 未設定のシートはSAMPLE_DATAで補完
    return {
      monthlySales: results.monthlySales || SAMPLE_DATA.monthlySales,
      pipeline: results.pipeline || SAMPLE_DATA.pipeline,
      members: results.members || SAMPLE_DATA.members,
      announcements: results.announcements || SAMPLE_DATA.announcements,
      team: results.team || SAMPLE_DATA.team,
    };
  }

  return { isConfigured, fetchAll, SHEET_CONFIG };
})();
