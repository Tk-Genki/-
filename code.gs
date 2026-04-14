const SHEET_NAME = 'BathLog';
const ACTIVE_SESSIONS_SHEET_NAME = 'ActiveBathSessions';
const RESIDENTS_SHEET_NAME = 'Residents';
const SPREADSHEET_ID = '1AYaR14LofsdPsx2zCy6cpsS00K7SH8sUDl76sdk1PiA';

const EVENT_OPTIONS = [
  { key: 'undress', label: '脱衣開始', order: 1 },
  { key: 'wash', label: '洗体開始', order: 2 },
  { key: 'bath', label: '入浴開始', order: 3 },
  { key: 'dress', label: '着衣開始', order: 4 },
  { key: 'finish', label: '終了', order: 5 }
];

const WEEKDAY_OPTIONS = [
  { key: 'monday', label: '月曜' },
  { key: 'tuesday', label: '火曜' },
  { key: 'wednesday', label: '水曜' },
  { key: 'thursday', label: '木曜' },
  { key: 'friday', label: '金曜' },
  { key: 'saturday', label: '土曜' },
  { key: 'sunday', label: '日曜' }
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
  'selected_weekday',
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

const ACTIVE_SESSION_HEADERS = [
  'resident_id',
  'resident_name',
  'session_id',
  'status',
  'started_at',
  'updated_at',
  'closed_at',
  'last_event_key',
  'last_event_label'
];

const RESIDENTS_HEADERS = [
  'resident_id',
  'resident_name',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'active'
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
  const spreadsheet = getSpreadsheet_();
  getOrCreateResidentsSheet_(spreadsheet);

  const defaultWeekday = getTodayWeekdayKey_();
  return {
    events: EVENT_OPTIONS,
    weekdays: WEEKDAY_OPTIONS,
    defaultWeekday: defaultWeekday,
    residents: getResidentsByWeekday(defaultWeekday)
  };
}

function getResidentsByWeekday(weekdayKey) {
  if (!isValidWeekdayKey_(weekdayKey)) {
    throw new Error('曜日指定が不正です。');
  }

  const spreadsheet = getSpreadsheet_();
  const sheet = getOrCreateResidentsSheet_(spreadsheet);
  const headers = getSheetHeaders_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  return values
    .map(function(row) {
      return mapRowToObject_(headers, row, null);
    })
    .filter(function(row) {
      return isTruthyCell_(row.active) && isTruthyCell_(row[weekdayKey]);
    })
    .map(function(row) {
      return {
        id: String(row.resident_id || '').trim(),
        name: String(row.resident_name || '').trim()
      };
    })
    .filter(function(row) {
      return row.id && row.name;
    });
}

function saveBathRecord(payload) {
  validatePayload_(payload);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const now = new Date();
    const spreadsheet = getSpreadsheet_();
    const logSheet = getOrCreateLogSheet_(spreadsheet);
    const activeSheet = getOrCreateActiveSessionsSheet_(spreadsheet);
    const sessionInfo = resolveSessionForEvent_(activeSheet, payload, now);
    const recordId = Utilities.getUuid();
    const headers = getSheetHeaders_(logSheet);
    const row = buildLogRow_(headers, recordId, payload, sessionInfo.sessionId, now);

    logSheet.appendRow(row);

    return {
      ok: true,
      recordId: recordId,
      sessionId: sessionInfo.sessionId,
      sessionStatus: sessionInfo.status,
      reusedSession: sessionInfo.reusedSession,
      serverRecordedAt: Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
    };
  } finally {
    lock.releaseLock();
  }
}

function setupSheet() {
  const spreadsheet = getSpreadsheet_();
  getOrCreateLogSheet_(spreadsheet);
  getOrCreateActiveSessionsSheet_(spreadsheet);
  getOrCreateResidentsSheet_(spreadsheet);
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateLogSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    syncHeaders_(sheet, LOG_HEADERS);
  }

  return sheet;
}

function getOrCreateActiveSessionsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(ACTIVE_SESSIONS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ACTIVE_SESSIONS_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, ACTIVE_SESSION_HEADERS.length).setValues([ACTIVE_SESSION_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    syncHeaders_(sheet, ACTIVE_SESSION_HEADERS);
  }

  return sheet;
}

function getOrCreateResidentsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(RESIDENTS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(RESIDENTS_SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, RESIDENTS_HEADERS.length).setValues([RESIDENTS_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    syncHeaders_(sheet, RESIDENTS_HEADERS);
  }

  return sheet;
}

function validatePayload_(payload) {
  if (!payload) {
    throw new Error('送信データがありません。');
  }

  if (!payload.selectedWeekday || !isValidWeekdayKey_(payload.selectedWeekday)) {
    throw new Error('曜日を選択してください。');
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

  if (payload.eventOrder === undefined || payload.eventOrder === null || payload.eventOrder === '') {
    throw new Error('工程順がありません。');
  }
}

function syncHeaders_(sheet, expectedHeaders) {
  const currentHeaders = getSheetHeaders_(sheet);
  const missingHeaders = expectedHeaders.filter(function(header) {
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
    return [];
  }

  const headerValues = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  return headerValues.filter(String);
}

function resolveSessionForEvent_(activeSheet, payload, now) {
  const timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const residentId = payload.residentId;
  const residentName = payload.residentName;
  const existingSession = findSessionRowByResidentId_(activeSheet, residentId);

  if (payload.eventKey === 'undress') {
    if (existingSession && existingSession.status === 'active' && existingSession.session_id) {
      upsertActiveSession_(activeSheet, existingSession, {
        residentId: residentId,
        residentName: residentName,
        sessionId: existingSession.session_id,
        status: 'active',
        startedAt: existingSession.started_at || timestamp,
        updatedAt: timestamp,
        closedAt: '',
        lastEventKey: payload.eventKey,
        lastEventLabel: payload.eventLabel
      });

      return {
        sessionId: existingSession.session_id,
        status: 'active',
        reusedSession: true
      };
    }

    const newSessionId = createSessionId_(residentId);

    upsertActiveSession_(activeSheet, existingSession, {
      residentId: residentId,
      residentName: residentName,
      sessionId: newSessionId,
      status: 'active',
      startedAt: timestamp,
      updatedAt: timestamp,
      closedAt: '',
      lastEventKey: payload.eventKey,
      lastEventLabel: payload.eventLabel
    });

    return {
      sessionId: newSessionId,
      status: 'active',
      reusedSession: false
    };
  }

  if (!existingSession || existingSession.status !== 'active' || !existingSession.session_id) {
    throw new Error('進行中の入浴セッションがありません。先に「脱衣開始」を記録してください。');
  }

  const nextStatus = payload.eventKey === 'finish' ? 'closed' : 'active';

  upsertActiveSession_(activeSheet, existingSession, {
    residentId: residentId,
    residentName: residentName,
    sessionId: existingSession.session_id,
    status: nextStatus,
    startedAt: existingSession.started_at || timestamp,
    updatedAt: timestamp,
    closedAt: payload.eventKey === 'finish' ? timestamp : '',
    lastEventKey: payload.eventKey,
    lastEventLabel: payload.eventLabel
  });

  return {
    sessionId: existingSession.session_id,
    status: nextStatus,
    reusedSession: true
  };
}

function findSessionRowByResidentId_(sheet, residentId) {
  const headers = getSheetHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  const residentIdIndex = headers.indexOf('resident_id');

  if (residentIdIndex === -1 || lastRow < 2) {
    return null;
  }

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  for (let index = 0; index < values.length; index += 1) {
    const rowValues = values[index];
    if (String(rowValues[residentIdIndex]) === String(residentId)) {
      return mapRowToObject_(headers, rowValues, index + 2);
    }
  }

  return null;
}

function mapRowToObject_(headers, rowValues, rowNumber) {
  const result = {};
  if (rowNumber) {
    result.rowNumber = rowNumber;
  }

  headers.forEach(function(header, index) {
    result[header] = rowValues[index];
  });

  return result;
}

function upsertActiveSession_(sheet, existingRow, sessionData) {
  const headers = getSheetHeaders_(sheet);
  const valueMap = {
    resident_id: sessionData.residentId,
    resident_name: sessionData.residentName,
    session_id: sessionData.sessionId,
    status: sessionData.status,
    started_at: sessionData.startedAt,
    updated_at: sessionData.updatedAt,
    closed_at: sessionData.closedAt,
    last_event_key: sessionData.lastEventKey,
    last_event_label: sessionData.lastEventLabel
  };

  const row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(valueMap, header) ? valueMap[header] : '';
  });

  if (existingRow && existingRow.rowNumber) {
    sheet.getRange(existingRow.rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }
}

function buildLogRow_(headers, recordId, payload, sessionId, now) {
  const serverRecordedAt = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const valueMap = {
    record_id: recordId,
    session_id: sessionId,
    event_order: payload.eventOrder,
    event_key: payload.eventKey,
    event_label: payload.eventLabel,
    resident_id: payload.residentId,
    resident_name: payload.residentName,
    staff_name: payload.staffName,
    selected_weekday: payload.selectedWeekday || '',
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

function createSessionId_(residentId) {
  return residentId + '-' + Utilities.getUuid();
}

function getTodayWeekdayKey_() {
  const now = new Date();
  const weekdayIndex = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), 'u'));
  const weekdayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return weekdayKeys[weekdayIndex - 1];
}

function isTruthyCell_(value) {
  return String(value).trim() === '1';
}

function isValidWeekdayKey_(value) {
  return WEEKDAY_OPTIONS.some(function(item) {
    return item.key === value;
  });
}
