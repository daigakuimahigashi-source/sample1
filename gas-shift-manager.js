/**
 * ===== シフト管理システム バックエンド =====
 * MFクラウド勤怠 / 焼肉ここから
 *
 * 【デプロイ手順】
 * 1. Googleスプレッドシートを新規作成
 * 2. 拡張機能 > Apps Script を開く
 * 3. このコードを貼り付けて保存
 * 4. デプロイ > 新しいデプロイ
 *    - 種類: ウェブアプリ
 *    - 実行者: 自分（daigaku.imahigashi@gmail.com）
 *    - アクセス: 全員
 * 5. デプロイ後に表示される「ウェブアプリURL」を
 *    shift.js の GAS_API_URL に貼り付ける
 */

const SHEET_NAME = 'ShiftData';

// ===== GET：全データ取得 =====
function doGet(e) {
    try {
        const sheet = getOrCreateSheet();
        const allData = readAll(sheet);
        return respond(allData);
    } catch (err) {
        return respond({ error: err.toString() });
    }
}

// ===== POST：データ保存 =====
function doPost(e) {
    try {
        const body = JSON.parse(e.postData.contents);
        const sheet = getOrCreateSheet();
        upsert(sheet, body.key, body.value);
        return respond({ ok: true, key: body.key, savedAt: new Date().toISOString() });
    } catch (err) {
        return respond({ error: err.toString() });
    }
}

// ===== シート取得 or 作成 =====
function getOrCreateSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(['key', 'value', 'updatedAt']);
        // ヘッダー書式
        sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#4a4a4a').setFontColor('#ffffff');
        sheet.setColumnWidth(1, 150);
        sheet.setColumnWidth(2, 600);
        sheet.setColumnWidth(3, 180);
    }
    return sheet;
}

// ===== 全データ読み込み =====
function readAll(sheet) {
    const rows = sheet.getDataRange().getValues();
    const result = {};
    for (let i = 1; i < rows.length; i++) {
        const key = rows[i][0];
        const val = rows[i][1];
        if (!key || !val) continue;
        try {
            result[key] = JSON.parse(val);
        } catch (e) {
            result[key] = val;
        }
    }
    return result;
}

// ===== キーでUPSERT（存在すれば更新、なければ追加）=====
function upsert(sheet, key, value) {
    const rows = sheet.getDataRange().getValues();
    const json = JSON.stringify(value);
    const now = new Date().toISOString();

    for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === key) {
            sheet.getRange(i + 1, 2, 1, 2).setValues([[json, now]]);
            return;
        }
    }
    // 新規追加
    sheet.appendRow([key, json, now]);
}

// ===== レスポンス生成 =====
function respond(data) {
    return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
