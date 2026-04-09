/**
 * Google Drive PDF OCR 自動リネームスクリプト
 *
 * PDFファイルをOCRでテキスト抽出し、請求期日・取引先名・金額を
 * 抽出してファイル名を自動リネームする。
 *
 * リネーム形式: yyyymmdd_取引先名_¥000,000.-.pdf
 */

// ============================================================
// 設定・初期化
// ============================================================

/**
 * 初回セットアップ: 対象フォルダIDをScriptPropertiesに保存する。
 * Google DriveフォルダのURLからフォルダIDをコピーして貼り付ける。
 * 例: https://drive.google.com/drive/folders/XXXXX ← XXXXXがフォルダID
 */
function setup() {
  const folderId = Browser.inputBox(
    'セットアップ',
    '対象フォルダのIDを入力してください:',
    Browser.Buttons.OK_CANCEL
  );
  if (folderId === 'cancel' || !folderId) {
    Logger.log('セットアップがキャンセルされました。');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('TARGET_FOLDER_ID', folderId);
  Logger.log('フォルダIDを保存しました: ' + folderId);
}

/**
 * 対象フォルダIDを取得する。
 */
function getTargetFolderId() {
  const folderId = PropertiesService.getScriptProperties().getProperty('TARGET_FOLDER_ID');
  if (!folderId) {
    throw new Error(
      'フォルダIDが設定されていません。先に setup() を実行してください。'
    );
  }
  return folderId;
}

// ============================================================
// メイン処理
// ============================================================

/**
 * エントリーポイント: フォルダ内の全PDFを処理する。
 */
function main() {
  const folderId = getTargetFolderId();
  const pdfFiles = getPdfFiles(folderId);

  if (pdfFiles.length === 0) {
    Logger.log('処理対象のPDFファイルがありません。');
    return;
  }

  Logger.log('処理対象: ' + pdfFiles.length + ' 件のPDFファイル');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const file of pdfFiles) {
    if (isAlreadyRenamed(file.getName())) {
      Logger.log('スキップ（リネーム済み）: ' + file.getName());
      skipCount++;
      continue;
    }

    try {
      const renamed = processOnePdf(file);
      if (renamed) {
        successCount++;
      } else {
        skipCount++;
      }
    } catch (e) {
      Logger.log('エラー [' + file.getName() + ']: ' + e.message);
      errorCount++;
    }
  }

  Logger.log('--- 処理結果 ---');
  Logger.log('成功: ' + successCount + ' 件');
  Logger.log('スキップ: ' + skipCount + ' 件');
  Logger.log('エラー: ' + errorCount + ' 件');
}

// ============================================================
// PDF取得・判定
// ============================================================

/**
 * フォルダ内のPDFファイルを配列で返す。
 */
function getPdfFiles(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByType('application/pdf');
  const result = [];
  while (files.hasNext()) {
    result.push(files.next());
  }
  return result;
}

/**
 * ファイル名が既にリネーム済みのパターンに一致するか判定する。
 * 正常リネーム: 20260321_株式会社ABC_¥1,234,567.-.pdf
 * プレースホルダー付きは再処理対象とするためfalseを返す。
 */
function isAlreadyRenamed(fileName) {
  // プレースホルダーが含まれている場合はリネーム済みとみなさない（再処理可能）
  if (/yyyymmdd|株式会社〇〇〇〇|￥xxx,xxx\.\-/.test(fileName)) {
    return false;
  }
  return /^\d{8}_.+_[¥￥][\d,]+\.-\.pdf$/u.test(fileName);
}

// ============================================================
// 1ファイルの処理
// ============================================================

/**
 * 1つのPDFを処理する: OCR → 抽出 → リネーム → クリーンアップ
 * @return {boolean} リネームできたらtrue
 */
function processOnePdf(file) {
  let tempDocId = null;

  try {
    Logger.log('処理開始: ' + file.getName());

    // OCRでテキスト抽出
    const ocrResult = ocrPdfToText(file);
    tempDocId = ocrResult.tempDocId;
    const text = ocrResult.text;

    Logger.log('OCRテキスト（先頭500文字）:\n' + text.substring(0, 500));

    // フィールド抽出
    const date = extractDate(text);
    const clientName = extractClientName(text);
    const amount = extractAmount(text);

    Logger.log('抽出結果 - 請求期日: ' + (date || '未検出'));
    Logger.log('抽出結果 - 取引先名: ' + (clientName || '未検出'));
    Logger.log('抽出結果 - 金額: ' + (amount || '未検出'));

    // 抽出できなかったフィールドはプレースホルダーで埋める
    const finalDate = date || 'yyyymmdd';
    const finalClient = clientName || '株式会社〇〇〇〇';
    const finalAmount = amount || '￥xxx,xxx.-';

    renamePdf(file, finalDate, finalClient, finalAmount);
    if (!date || !clientName || !amount) {
      Logger.log('一部フィールドが未検出のためプレースホルダーでリネームしました。');
    }
    return true;
  } finally {
    // 一時Google Docsの削除（必ず実行）
    if (tempDocId) {
      deleteTempDoc(tempDocId);
    }
  }
}

// ============================================================
// OCR処理
// ============================================================

/**
 * PDFをGoogle Docsに変換（OCR付き）してテキストを取得する。
 * @return {{ text: string, tempDocId: string }}
 */
function ocrPdfToText(file) {
  const blob = file.getBlob();
  const resource = {
    title: '_temp_ocr_' + file.getId(),
    mimeType: 'application/pdf',
  };
  const params = {
    ocr: true,
    ocrLanguage: 'ja',
  };

  const docFile = Drive.Files.insert(resource, blob, params);
  const doc = DocumentApp.openById(docFile.id);
  const text = doc.getBody().getText();

  return { text: text, tempDocId: docFile.id };
}

// ============================================================
// テキスト抽出
// ============================================================

/**
 * 請求期日を抽出し yyyymmdd 形式で返す。
 * @return {string|null}
 */
function extractDate(text) {
  // パターン1: 請求日 2024年12月15日 / 請求期日: 2024/12/15 など
  const dateRegex =
    /(?:請求日|請求期日|お支払期限|振込期限|支払期日|支払期限)[：:\s]*(\d{4})\s*[年\/\.\-]\s*(\d{1,2})\s*[月\/\.\-]\s*(\d{1,2})\s*日?/;
  const match = text.match(dateRegex);
  if (match) {
    const yyyy = match[1];
    const mm = match[2].padStart(2, '0');
    const dd = match[3].padStart(2, '0');
    return yyyy + mm + dd;
  }

  // パターン2: 令和N年M月D日 形式（請求日ラベル付き）
  const reiwRegex =
    /(?:請求日|請求期日|お支払期限|振込期限|支払期日|支払期限)[：:\s]*令和\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/;
  const reiwaMatch = text.match(reiwRegex);
  if (reiwaMatch) {
    const yyyy = String(2018 + parseInt(reiwaMatch[1], 10));
    const mm = reiwaMatch[2].padStart(2, '0');
    const dd = reiwaMatch[3].padStart(2, '0');
    return yyyy + mm + dd;
  }

  return null;
}

/**
 * 取引先名を抽出する。
 * @return {string|null}
 */
function extractClientName(text) {
  // パターン1: 「〇〇 御中」の形式
  const gotyuRegex =
    /(.+?)\s*御中/u;
  const lines = text.split(/\n/);
  for (const line of lines) {
    const match = line.match(gotyuRegex);
    if (match) {
      const name = match[1].trim().replace(/^[\s　]+/, '');
      if (name.length > 0 && name.length <= 50) {
        return sanitizeFileName(name);
      }
    }
  }

  // パターン2: 「〇〇 様」の形式
  const samaRegex = /(.+?)\s*様/u;
  for (const line of lines) {
    const match = line.match(samaRegex);
    if (match) {
      const name = match[1].trim().replace(/^[\s　]+/, '');
      if (name.length > 0 && name.length <= 50) {
        return sanitizeFileName(name);
      }
    }
  }

  // パターン3: 「請求先」「取引先」ラベルの後
  const labelRegex = /(?:請求先|取引先)[：:\s]+(.+)/u;
  const labelMatch = text.match(labelRegex);
  if (labelMatch) {
    const name = labelMatch[1].trim();
    if (name.length > 0 && name.length <= 50) {
      return sanitizeFileName(name);
    }
  }

  return null;
}

/**
 * 金額を抽出し ¥N,NNN.- 形式で返す。
 * @return {string|null}
 */
function extractAmount(text) {
  // パターン1: 合計/請求金額ラベル付き
  const labeledRegex =
    /(?:合計金額|ご請求金額|請求金額|お支払金額|合計)[：:\s]*[¥￥]?\s*([\d,]+)(?:\.\-|円)?/;
  const labelMatch = text.match(labeledRegex);
  if (labelMatch) {
    return normalizeAmount(labelMatch[1]);
  }

  // パターン2: ¥マーク付きの金額（ラベルなし、最大値を採用）
  const yenRegex = /[¥￥]\s*([\d,]+)(?:\.\-)?/g;
  let maxAmount = 0;
  let maxRaw = null;
  let match;
  while ((match = yenRegex.exec(text)) !== null) {
    const num = parseInt(match[1].replace(/,/g, ''), 10);
    if (num > maxAmount) {
      maxAmount = num;
      maxRaw = match[1];
    }
  }
  if (maxRaw) {
    return normalizeAmount(maxRaw);
  }

  return null;
}

/**
 * 金額文字列を ¥N,NNN.- 形式に正規化する。
 */
function normalizeAmount(raw) {
  const num = parseInt(raw.replace(/,/g, ''), 10);
  const formatted = num.toLocaleString('ja-JP');
  return '¥' + formatted + '.-';
}

// ============================================================
// リネーム・クリーンアップ
// ============================================================

/**
 * PDFファイルをリネームする。
 */
function renamePdf(file, date, clientName, amount) {
  const newName = date + '_' + clientName + '_' + amount + '.pdf';
  const oldName = file.getName();
  file.setName(newName);
  Logger.log('リネーム完了: ' + oldName + ' → ' + newName);
}

/**
 * 一時的に作成したGoogle Docsを削除（ゴミ箱へ移動）する。
 */
function deleteTempDoc(docId) {
  try {
    DriveApp.getFileById(docId).setTrashed(true);
  } catch (e) {
    Logger.log('警告: 一時ファイルの削除に失敗しました (' + docId + '): ' + e.message);
  }
}

/**
 * ファイル名に使用できない文字を除去する。
 */
function sanitizeFileName(name) {
  return name.replace(/[\/\\?%*:|"<>]/g, '').trim();
}

// ============================================================
// カスタムメニュー（スプレッドシートにバインドした場合）
// ============================================================

/**
 * スプレッドシートを開いた時にカスタムメニューを追加する。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PDF リネーム')
    .addItem('実行', 'main')
    .addItem('フォルダID設定', 'setup')
    .addToUi();
}
