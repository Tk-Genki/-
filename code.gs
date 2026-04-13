const SHEET_NAME = 'BathLog';
const SPREADSHEET_ID = '1AYaR14LofsdPsx2zCy6cpsS00K7SH8sUDl76sdk1PiA';

const RESIDENT_OPTIONS = [
  { id: 'A001', name: '山田 太郎' },
  { id: 'A002', name: '鈴木 花子' },
  { id: 'A003', name: '佐藤 次郎' }
];

const EVENT_OPTIONS = [
  { key: 'undress', label: '脱衣開始', order: 1 },
  { key: 'wash', label: '洗体開始', order: 2 },
  { key: 'bath', label: '入浴開始', order: 3 },
  { key: 'finish', label: '終了', order: 4 }
];

const LOG_HEADERS = [
  'record_id',
  'session_id',
  'event_order',
  'event_key',
  'event_label',
  'resident_id',
  'resident_name',
  'staff_name',
  'recorded_at_iso',
  'recorded_at_epoch_ms',
  'recorded_date',
  'recorded_time',
  'weekday',
  'hour',
  'recorded_at_client',
  'recorded_at_server',
  'device_info',
  'memo'
];

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('入浴タイムスタンプ記録')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppConfig() {
  return {
    residents: RESIDENT_OPTIONS,
    events: EVENT_OPTIONS
  };
}

function saveBathRecord(payload) {
  validatePayload_(payload);

  const sheet = getOrCreateLogSheet_();
  const recordId = Utilities.getUuid();
  const now = new Date();
  const headers = getSheetHeaders_(sheet);
  const row = buildRow_(headers, recordId, payload, now);

  sheet.appendRow(row);

  return {
    ok: true,
    recordId: recordId,
    sessionId: payload.sessionId,
    serverRecordedAt: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
  };
}

function setupSheet() {
  getOrCreateLogSheet_();
}

function getOrCreateLogSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    syncHeaders_(sheet);
  }

  return sheet;
}

function validatePayload_(payload) {
  if (!payload) {
    throw new Error('送信データがありません。');
  }

  if (!payload.residentId || !payload.residentName) {
    throw new Error('利用者を選択してください。');
  }

  if (!payload.staffName) {
    throw new Error('担当者名を入力してください。');
  }

  if (!payload.eventKey || !payload.eventLabel) {
    throw new Error('記録種別が不正です。');
  }

  if (!payload.recordedAt) {
    throw new Error('記録時刻がありません。');
  }

  if (!payload.sessionId) {
    throw new Error('sessionId がありません。');
  }

  if (payload.eventOrder === undefined || payload.eventOrder === null || payload.eventOrder === '') {
    throw new Error('工程順がありません。');
  }
}

function syncHeaders_(sheet) {
  const currentHeaders = getSheetHeaders_(sheet);
  const missingHeaders = LOG_HEADERS.filter(function(header) {
    return currentHeaders.indexOf(header) === -1;
  });

  if (missingHeaders.length === 0) {
    return;
  }

  const startColumn = currentHeaders.length + 1;
  sheet.getRange(1, startColumn, 1, missingHeaders.length).setValues([missingHeaders]);
}

function getSheetHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    return LOG_HEADERS.slice();
  }

  const headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  return headerValues.filter(String);
}

function buildRow_(headers, recordId, payload, now) {
  const serverRecordedAt = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const valueMap = {
    record_id: recordId,
    session_id: payload.sessionId,
    event_order: payload.eventOrder,
    event_key: payload.eventKey,
    event_label: payload.eventLabel,
    resident_id: payload.residentId,
    resident_name: payload.residentName,
    staff_name: payload.staffName,
    recorded_at_iso: payload.recordedAtIso || payload.recordedAt,
    recorded_at_epoch_ms: payload.recordedAtEpochMs || '',
    recorded_date: payload.recordedDate || '',
    recorded_time: payload.recordedTime || '',
    weekday: payload.weekday || '',
    hour: payload.hour,
    recorded_at_client: payload.recordedAt,
    recorded_at_server: serverRecordedAt,
    device_info: payload.deviceInfo || '',
    memo: payload.memo || ''
  };

  return headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(valueMap, header) ? valueMap[header] : '';
  });
}
