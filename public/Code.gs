/**
 * WASHMEN LAUNDRY - WASH & FOLD BREAK TRACKER (GOOGLE APPS SCRIPT BACKEND)
 * File: Code.gs
 * Author: Udara Fernando
 *
 * Tabs in Google Sheet:
 *   - Staff
 *   - Active
 *   - Logs
 *   - Settings
 *
 * Script Properties:
 *   - SUPERVISOR_PIN (default: "0000")
 *   - DELETED_LOGS_JSON (soft-deleted log IDs for multi-device sync)
 */

const SH = {
  STAFF: {
    name: 'Staff',
    headers: ['id', 'empId', 'name', 'designation', 'shift', 'department', 'active', 'updatedAt']
  },
  ACTIVE: {
    name: 'Active',
    // Added backward-compatible columns: source, deviceTimestamp
    headers: ['id', 'staffId', 'empId', 'staffName', 'shift', 'breakType', 'startTime', 'allottedMins', 'source', 'deviceTimestamp']
  },
  LOGS: {
    name: 'Logs',
    // Added backward-compatible columns: source, voided, needsReview, deviceTimestamp, activeBreakId
    headers: [
      'id',
      'staffId',
      'empId',
      'staffName',
      'shift',
      'breakType',
      'startTime',
      'endTime',
      'durationMins',
      'allottedMins',
      'varianceMins',
      'exceptionReason',
      'notes',
      'date',
      'source',
      'voided',
      'needsReview',
      'deviceTimestamp',
      'activeBreakId'
    ]
  },
  SETTINGS: {
    name: 'Settings',
    headers: ['key', 'value', 'updatedAt']
  }
};

const DEFAULT_KIOSK_SETTINGS = {
  allowedMins: { Breakfast: 20, Lunch: 20, Tea: 20 },
  warningMins: 5,
  graceMins: 1,
  bigOvertimeMins: 15,
  maxSimultaneousBreaks: 5,
  needsReviewRunningMins: 60,
  autoReturnSecs: 30,
  soundEnabled: true,
  showOtherShift: true,
  timeWindowsEnabled: false,
  timeWindows: {
    Morning: {
      Breakfast: { start: '05:00', end: '10:30' },
      Lunch: { start: '11:30', end: '15:30' },
      Tea: { start: '15:30', end: '18:30' }
    },
    Night: {
      Breakfast: { start: '17:00', end: '22:30' },
      Lunch: { start: '23:30', end: '03:30' },
      Tea: { start: '03:30', end: '06:30' }
    }
  },
  positiveMessages: [
    'Welcome back, NAME! You returned with SPAREMINS min to spare. Thank you!',
    'Great timing, NAME. Back on time, have a good shift!',
    'Thank you, NAME! Right on schedule — appreciate your teamwork.',
    'Awesome job, NAME! Back with SPAREMINS min left. Keep it up!'
  ],
  warningMessages: [
    'Welcome back, NAME. Your break ran OVERMINS min over the ALLOWED minutes. Please try to return on time next time. Your supervisor has been informed.',
    'Hi NAME, you returned OVERMINS min after the ALLOWED-minute break limit. Please be mindful of break times so everyone gets their turn.',
    'Thank you for checking back in, NAME. This break was OVERMINS min over the ALLOWED minutes and has been noted for your supervisor.'
  ]
};

/**
 * Web App Entry Point - Passes URL parameters (e.g. ?mode=kiosk) into Index.html template
 */
function doGet(e) {
  setupSheetsIfMissing_();
  var params = (e && e.parameter) ? e.parameter : {};
  var mode = params.mode ? String(params.mode).toLowerCase() : '';
  var shiftParam = params.shift ? String(params.shift) : '';

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SUPERVISOR_PIN')) {
    props.setProperty('SUPERVISOR_PIN', '0000');
  }

  var template = HtmlService.createTemplateFromFile('Index');
  template.initialMode = mode;
  template.initialShift = shiftParam;
  template.isDefaultPin = (props.getProperty('SUPERVISOR_PIN') === '0000');

  return template
    .evaluate()
    .setTitle('Washmen Laundry - Wash & Fold Break Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

/**
 * Run this function from the Apps Script Editor after updating Code.gs
 * to create or upgrade sheet tabs and headers without losing existing rows.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SH).forEach(function (key) {
    var cfg = SH[key];
    var sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.name);
      sheet.appendRow(cfg.headers);
      sheet.getRange(1, 1, 1, cfg.headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else {
      var lastCol = Math.max(1, sheet.getLastColumn());
      var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      cfg.headers.forEach(function (h, idx) {
        if (currentHeaders[idx] !== h) {
          sheet.getRange(1, idx + 1).setValue(h).setFontWeight('bold');
        }
      });
      sheet.setFrozenRows(1);
    }
  });

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SUPERVISOR_PIN')) {
    props.setProperty('SUPERVISOR_PIN', '0000');
  }
  return { ok: true, message: 'Sheets and headers verified and updated.' };
}

function setupSheetsIfMissing_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss.getSheetByName(SH.STAFF.name) || !ss.getSheetByName(SH.LOGS.name)) {
      setupSheets();
    }
  } catch (e) {}
}

/**
 * Server-side PIN verification (PIN is never sent to the browser)
 */
function verifyPin(pin) {
  var props = PropertiesService.getScriptProperties();
  var storedPin = props.getProperty('SUPERVISOR_PIN') || '0000';
  var cleanPin = String(pin || '').trim();
  return {
    valid: cleanPin === storedPin || cleanPin === 'Admin@123',
    isDefaultPin: storedPin === '0000'
  };
}

/**
 * Change the Kiosk Supervisor PIN (requires current PIN or supervisor password)
 */
function changeSupervisorPin(currentPin, newPin) {
  var check = verifyPin(currentPin);
  if (!check.valid) {
    return { ok: false, error: 'Current PIN or Supervisor Password is incorrect.' };
  }
  var cleanedNew = String(newPin || '').trim();
  if (cleanedNew.length < 4) {
    return { ok: false, error: 'New PIN must be at least 4 digits/characters.' };
  }
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SUPERVISOR_PIN', cleanedNew);
  return {
    ok: true,
    isDefaultPin: cleanedNew === '0000'
  };
}

/**
 * Shared state merge + sheet synchronization
 */
function syncState(clientState) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupSheetsIfMissing_();
    var serverState = readServerState_();
    var merged = mergeStateServer_(serverState, clientState || {});
    writeServerState_(merged);
    return merged;
  } finally {
    lock.releaseLock();
  }
}

function readServerState_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var deletedLogs = [];
  try {
    deletedLogs = JSON.parse(props.getProperty('DELETED_LOGS_JSON') || '[]');
  } catch (e) {
    deletedLogs = [];
  }

  var staff = readTable_(ss.getSheetByName(SH.STAFF.name), SH.STAFF.headers).map(function (r) {
    return {
      id: String(r.id || ''),
      empId: String(r.empId || ''),
      name: String(r.name || ''),
      designation: String(r.designation || ''),
      shift: r.shift === 'Night' ? 'Night' : 'Morning',
      department: String(r.department || 'Wash & Fold'),
      active: r.active !== false && String(r.active).toLowerCase() !== 'false',
      updatedAt: String(r.updatedAt || '')
    };
  }).filter(function (s) { return s.id && s.name; });

  var activeBreaks = readTable_(ss.getSheetByName(SH.ACTIVE.name), SH.ACTIVE.headers).map(function (r) {
    return {
      id: String(r.id || ''),
      staffId: String(r.staffId || ''),
      empId: String(r.empId || ''),
      staffName: String(r.staffName || ''),
      shift: r.shift === 'Night' ? 'Night' : 'Morning',
      breakType: String(r.breakType || 'Breakfast'),
      startTime: String(r.startTime || ''),
      allottedMins: Number(r.allottedMins) || 20,
      source: String(r.source || 'supervisor'),
      deviceTimestamp: String(r.deviceTimestamp || r.startTime || '')
    };
  }).filter(function (b) { return b.id && b.staffId; });

  var logs = readTable_(ss.getSheetByName(SH.LOGS.name), SH.LOGS.headers).map(function (r) {
    return {
      id: String(r.id || ''),
      staffId: String(r.staffId || ''),
      empId: String(r.empId || ''),
      staffName: String(r.staffName || ''),
      shift: r.shift === 'Night' ? 'Night' : 'Morning',
      breakType: String(r.breakType || 'Breakfast'),
      startTime: String(r.startTime || ''),
      endTime: String(r.endTime || ''),
      durationMins: Number(r.durationMins) || 0,
      allottedMins: Number(r.allottedMins) || 20,
      varianceMins: Number(r.varianceMins) || 0,
      exceptionReason: String(r.exceptionReason || 'Normal'),
      notes: r.notes ? String(r.notes) : '',
      date: String(r.date || ''),
      source: String(r.source || 'supervisor'),
      voided: r.voided === true || String(r.voided).toLowerCase() === 'true',
      needsReview: r.needsReview === true || String(r.needsReview).toLowerCase() === 'true',
      deviceTimestamp: String(r.deviceTimestamp || r.endTime || ''),
      activeBreakId: String(r.activeBreakId || '')
    };
  }).filter(function (l) { return l.id && l.staffId; });

  var kioskSettings = DEFAULT_KIOSK_SETTINGS;
  var settingsSheet = ss.getSheetByName(SH.SETTINGS.name);
  if (settingsSheet) {
    var settingsRows = readTable_(settingsSheet, SH.SETTINGS.headers);
    var kioskRow = settingsRows.find(function (r) { return r.key === 'kioskSettings'; });
    if (kioskRow && kioskRow.value) {
      try {
        kioskSettings = Object.assign({}, DEFAULT_KIOSK_SETTINGS, JSON.parse(kioskRow.value));
      } catch (e) {}
    }
  }

  return {
    staff: staff,
    activeBreaks: activeBreaks,
    logs: logs,
    deletedLogs: deletedLogs,
    kioskSettings: kioskSettings,
    isDefaultPin: (props.getProperty('SUPERVISOR_PIN') || '0000') === '0000',
    serverTime: new Date().toISOString()
  };
}

/**
 * Merges server state and incoming client state safely across 3-6 devices.
 * Voided logs still close their corresponding active break so a cancelled break
 * never reappears on another tablet or supervisor phone.
 */
function mergeStateServer_(server, client) {
  var deletedSet = {};
  (server.deletedLogs || []).concat(client.deletedLogs || []).forEach(function (id) {
    if (id) deletedSet[id] = true;
  });
  var deletedLogs = Object.keys(deletedSet);

  // Merge Staff by id
  var staffMap = {};
  (server.staff || []).forEach(function (s) { staffMap[s.id] = s; });
  (client.staff || []).forEach(function (s) {
    if (!s || !s.id) return;
    staffMap[s.id] = Object.assign({}, staffMap[s.id] || {}, s);
  });
  var mergedStaff = Object.keys(staffMap).map(function (k) { return staffMap[k]; });

  // Merge Logs by id (including voided logs so audit trail is preserved and active breaks close)
  var logMap = {};
  (server.logs || []).forEach(function (l) {
    if (l && l.id && !deletedSet[l.id]) logMap[l.id] = l;
  });
  (client.logs || []).forEach(function (l) {
    if (l && l.id && !deletedSet[l.id]) {
      var prev = logMap[l.id];
      logMap[l.id] = prev ? Object.assign({}, prev, l) : l;
    }
  });
  var mergedLogs = Object.keys(logMap).map(function (k) { return logMap[k]; }).sort(function (a, b) {
    return String(b.endTime || '').localeCompare(String(a.endTime || ''));
  });

  // Determine closed active breaks (closed by either normal or voided log, or explicit closedBreakIds)
  var closedBreakIds = {};
  var closedStaffStartKeys = {};
  (client.closedBreakIds || []).forEach(function (id) {
    if (id) closedBreakIds[id] = true;
  });
  mergedLogs.forEach(function (l) {
    if (l.activeBreakId) closedBreakIds[l.activeBreakId] = true;
    if (l.staffId && l.startTime) closedStaffStartKeys[l.staffId + '|' + l.startTime] = true;
  });

  // Merge Active Breaks (prevent double running breaks per staffId)
  var activeById = {};
  (server.activeBreaks || []).concat(client.activeBreaks || []).forEach(function (b) {
    if (!b || !b.id || !b.staffId) return;
    if (closedBreakIds[b.id]) return;
    if (closedStaffStartKeys[b.staffId + '|' + b.startTime]) return;
    activeById[b.id] = b;
  });

  var activeByStaff = {};
  Object.keys(activeById).forEach(function (id) {
    var brk = activeById[id];
    var existing = activeByStaff[brk.staffId];
    if (!existing || String(brk.startTime) > String(existing.startTime)) {
      activeByStaff[brk.staffId] = brk;
    }
  });
  var mergedActive = Object.keys(activeByStaff).map(function (staffId) { return activeByStaff[staffId]; });

  var mergedSettings = Object.assign(
    {},
    DEFAULT_KIOSK_SETTINGS,
    server.kioskSettings || {},
    client.kioskSettings || {}
  );

  var props = PropertiesService.getScriptProperties();
  return {
    staff: mergedStaff,
    activeBreaks: mergedActive,
    logs: mergedLogs,
    deletedLogs: deletedLogs,
    kioskSettings: mergedSettings,
    isDefaultPin: (props.getProperty('SUPERVISOR_PIN') || '0000') === '0000',
    serverTime: new Date().toISOString()
  };
}

function writeServerState_(state) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  writeTable_(ss.getSheetByName(SH.STAFF.name), SH.STAFF.headers, state.staff || []);
  writeTable_(ss.getSheetByName(SH.ACTIVE.name), SH.ACTIVE.headers, state.activeBreaks || []);
  writeTable_(ss.getSheetByName(SH.LOGS.name), SH.LOGS.headers, state.logs || []);

  var settingsSheet = ss.getSheetByName(SH.SETTINGS.name);
  if (settingsSheet) {
    writeTable_(settingsSheet, SH.SETTINGS.headers, [
      {
        key: 'kioskSettings',
        value: JSON.stringify(state.kioskSettings || DEFAULT_KIOSK_SETTINGS),
        updatedAt: new Date().toISOString()
      }
    ]);
  }

  var props = PropertiesService.getScriptProperties();
  props.setProperty('DELETED_LOGS_JSON', JSON.stringify((state.deletedLogs || []).slice(-500)));
}

function readTable_(sheet, headers) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(headers.length, sheet.getLastColumn());
  if (lastRow < 2) return [];
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var sheetHeaders = values[0].map(function (h) { return String(h || '').trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    headers.forEach(function (h, idx) {
      var colIdx = sheetHeaders.indexOf(h);
      if (colIdx === -1) colIdx = idx;
      obj[h] = colIdx < row.length ? row[colIdx] : '';
    });
    rows.push(obj);
  }
  return rows;
}

function writeTable_(sheet, headers, items) {
  if (!sheet) return;
  sheet.clearContents();
  var matrix = [headers];
  (items || []).forEach(function (item) {
    var row = headers.map(function (h) {
      var val = item[h];
      return val === undefined || val === null ? '' : val;
    });
    matrix.push(row);
  });
  sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
}
