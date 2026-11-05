/**
 * ============================================================================
 * WASHMEN LAUNDRY - WASH & FOLD BREAK TRACKER (GOOGLE APPS SCRIPT BACKEND)
 * File: Code.gs
 * Created & Architected By: Udara Fernando (Emp ID: #1448 • Wash & Fold Dept)
 * LinkedIn: https://www.linkedin.com/in/udara-fernando-076b76bb
 * System Developer Verification Signature: UF-1448-WASHMEN-WF-2026-VERIFIED
 * ============================================================================
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
 *   - SYSTEM_CREATOR ("Udara Fernando")
 */

const _GAS_AUTHOR_CODES = [85, 100, 97, 114, 97, 32, 70, 101, 114, 110, 97, 110, 100, 111];
const SYSTEM_DEVELOPER_VERIFICATION = {
  creator: String.fromCharCode.apply(null, _GAS_AUTHOR_CODES),
  empId: '1448',
  department: 'Wash & Fold Department',
  company: 'Washmen Laundry',
  createdBy: 'Created By ' + String.fromCharCode.apply(null, _GAS_AUTHOR_CODES),
  signature: 'UF-1448-WASHMEN-WF-2026-VERIFIED',
  linkedIn: 'https://www.linkedin.com/in/udara-fernando-076b76bb'
};

const SH = {
  STAFF: {
    name: 'Staff',
    headers: ['id', 'empId', 'name', 'designation', 'shift', 'department', 'active', 'updatedAt']
  },
  ACTIVE: {
    name: 'Active',
    // Added backward-compatible columns: source, deviceTimestamp, breakSlot, testMode
    headers: ['id', 'staffId', 'empId', 'staffName', 'shift', 'breakType', 'startTime', 'allottedMins', 'source', 'deviceTimestamp', 'breakSlot', 'testMode']
  },
  LOGS: {
    name: 'Logs',
    // Added backward-compatible columns: source, voided, needsReview, deviceTimestamp, activeBreakId, breakSlot, testMode
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
      'activeBreakId',
      'breakSlot',
      'testMode'
    ]
  },
  SETTINGS: {
    name: 'Settings',
    headers: ['key', 'value', 'updatedAt']
  }
};

const DEFAULT_KIOSK_SETTINGS = {
  allowedMins: { Breakfast: 20, Lunch: 20, Tea: 20 },
  shiftBreaks: {
    Morning: [
      { slot: 1, name: 'Breakfast', mins: 20 },
      { slot: 2, name: 'Lunch', mins: 20 },
      { slot: 3, name: 'Tea', mins: 20 }
    ],
    Night: [
      { slot: 1, name: 'Dinner', mins: 20 },
      { slot: 2, name: 'Midnight meal', mins: 20 },
      { slot: 3, name: 'Tea', mins: 20 }
    ]
  },
  warningMins: 5,
  graceMins: 1,
  bigOvertimeMins: 15,
  maxSimultaneousBreaks: 5,
  needsReviewRunningMins: 90,
  autoReturnSecs: 30,
  soundEnabled: true,
  showOtherShift: false,
  timeWindowsEnabled: false,
  testMode: false,
  updatedAt: 0,
  version: 1,
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
    'On time. Thank you!',
    'Great job! Thank you!',
    'Back on time. Have a good shift!',
    'Right on time. Thank you!'
  ],
  warningMessages: [
    'Please come back on time next time.'
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
      if (cfg.name === SH.SETTINGS.name) {
        sheet.appendRow([
          'kioskSettings',
          JSON.stringify(DEFAULT_KIOSK_SETTINGS),
          new Date().toISOString()
        ]);
      }
    } else {
      var lastCol = Math.max(1, sheet.getLastColumn());
      var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      cfg.headers.forEach(function (h, idx) {
        if (currentHeaders[idx] !== h) {
          sheet.getRange(1, idx + 1).setValue(h).setFontWeight('bold');
        }
      });
      sheet.setFrozenRows(1);
      if (cfg.name === SH.SETTINGS.name && sheet.getLastRow() < 2) {
        sheet.appendRow([
          'kioskSettings',
          JSON.stringify(DEFAULT_KIOSK_SETTINGS),
          new Date().toISOString()
        ]);
      }
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
    if (
      !ss.getSheetByName(SH.STAFF.name) ||
      !ss.getSheetByName(SH.ACTIVE.name) ||
      !ss.getSheetByName(SH.LOGS.name) ||
      !ss.getSheetByName(SH.SETTINGS.name)
    ) {
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
 * Save Kiosk Settings with Server-side Supervisor PIN Verification
 */
function saveKioskSettings(newSettings, pin) {
  var check = verifyPin(pin);
  if (!check.valid) {
    return { ok: false, error: 'Supervisor PIN required to save settings.' };
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupSheetsIfMissing_();
    var nowMs = Date.now();
    var cleanSettings = Object.assign({}, DEFAULT_KIOSK_SETTINGS, newSettings || {}, {
      updatedAt: Number((newSettings && newSettings.updatedAt) || nowMs),
      version: Number((newSettings && newSettings.version) || 1)
    });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var settingsSheet = ss.getSheetByName(SH.SETTINGS.name);
    if (settingsSheet) {
      writeTable_(settingsSheet, SH.SETTINGS.headers, [
        {
          key: 'kioskSettings',
          value: JSON.stringify(cleanSettings),
          updatedAt: new Date(cleanSettings.updatedAt).toISOString()
        }
      ]);
    }
    var props = PropertiesService.getScriptProperties();
    props.setProperty('KIOSK_SETTINGS_JSON', JSON.stringify(cleanSettings));
    return { ok: true, kioskSettings: cleanSettings };
  } finally {
    lock.releaseLock();
  }
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

function inferSlotServer_(breakType, rawSlot) {
  var s = Number(rawSlot);
  if (s === 1 || s === 2 || s === 3) return s;
  var clean = String(breakType || '').trim().toLowerCase();
  if (clean === 'breakfast' || clean === 'dinner' || clean === 'slot 1') return 1;
  if (clean === 'lunch' || clean === 'midnight meal' || clean === 'slot 2') return 2;
  if (clean === 'tea' || clean === 'tea break' || clean === 'slot 3') return 3;
  return '';
}

function resolveConfiguredMinsServer_(shift, breakType, slotVal, kioskSettings) {
  var cfg = kioskSettings || DEFAULT_KIOSK_SETTINGS;
  var shiftKey = shift === 'Night' ? 'Night' : 'Morning';
  var slots = (cfg.shiftBreaks && cfg.shiftBreaks[shiftKey]) || DEFAULT_KIOSK_SETTINGS.shiftBreaks[shiftKey];
  if (slotVal === 1 || slotVal === 2 || slotVal === 3) {
    var bySlot = slots.find(function (s) { return Number(s.slot) === Number(slotVal); });
    if (bySlot && Number(bySlot.mins) > 0) return Number(bySlot.mins);
  }
  var cleanName = String(breakType || '').trim().toLowerCase();
  var byName = slots.find(function (s) { return String(s.name || '').trim().toLowerCase() === cleanName; });
  if (byName && Number(byName.mins) > 0) return Number(byName.mins);
  return Number(slots[0] && slots[0].mins) || 20;
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

  var kioskSettings = Object.assign({}, DEFAULT_KIOSK_SETTINGS);
  var propSettingsRaw = props.getProperty('KIOSK_SETTINGS_JSON');
  if (propSettingsRaw) {
    try {
      kioskSettings = Object.assign({}, DEFAULT_KIOSK_SETTINGS, JSON.parse(propSettingsRaw));
    } catch (e) {}
  }
  var settingsSheet = ss.getSheetByName(SH.SETTINGS.name);
  if (settingsSheet) {
    var settingsRows = readTable_(settingsSheet, SH.SETTINGS.headers);
    var kioskRow = settingsRows.find(function (r) { return r.key === 'kioskSettings'; });
    if (kioskRow && kioskRow.value) {
      try {
        var sheetSettings = JSON.parse(kioskRow.value);
        if (Number(sheetSettings.updatedAt || 0) >= Number(kioskSettings.updatedAt || 0)) {
          kioskSettings = Object.assign({}, DEFAULT_KIOSK_SETTINGS, sheetSettings);
        }
      } catch (e) {}
    }
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
    var shiftVal = r.shift === 'Night' ? 'Night' : 'Morning';
    var slotVal = inferSlotServer_(r.breakType, r.breakSlot);
    var savedAllotted = Number(r.allottedMins);
    var resolvedAllotted = (savedAllotted > 0)
      ? savedAllotted
      : resolveConfiguredMinsServer_(shiftVal, r.breakType, slotVal, kioskSettings);
    var item = {
      id: String(r.id || ''),
      staffId: String(r.staffId || ''),
      empId: String(r.empId || ''),
      staffName: String(r.staffName || ''),
      shift: shiftVal,
      breakType: String(r.breakType || 'Breakfast'),
      startTime: String(r.startTime || ''),
      allottedMins: resolvedAllotted,
      source: String(r.source || 'supervisor'),
      deviceTimestamp: String(r.deviceTimestamp || r.startTime || ''),
      testMode: r.testMode === true || String(r.testMode).toLowerCase() === 'true'
    };
    if (slotVal) item.breakSlot = slotVal;
    return item;
  }).filter(function (b) { return b.id && b.staffId; });

  var logs = readTable_(ss.getSheetByName(SH.LOGS.name), SH.LOGS.headers).map(function (r) {
    var shiftVal = r.shift === 'Night' ? 'Night' : 'Morning';
    var slotVal = inferSlotServer_(r.breakType, r.breakSlot);
    var savedAllotted = Number(r.allottedMins);
    var resolvedAllotted = (savedAllotted > 0)
      ? savedAllotted
      : resolveConfiguredMinsServer_(shiftVal, r.breakType, slotVal, kioskSettings);
    var item = {
      id: String(r.id || ''),
      staffId: String(r.staffId || ''),
      empId: String(r.empId || ''),
      staffName: String(r.staffName || ''),
      shift: shiftVal,
      breakType: String(r.breakType || 'Breakfast'),
      startTime: String(r.startTime || ''),
      endTime: String(r.endTime || ''),
      durationMins: Number(r.durationMins) || 0,
      allottedMins: resolvedAllotted,
      varianceMins: Number(r.varianceMins) || 0,
      exceptionReason: String(r.exceptionReason || 'Normal'),
      notes: r.notes ? String(r.notes) : '',
      date: String(r.date || ''),
      source: String(r.source || 'supervisor'),
      voided: r.voided === true || String(r.voided).toLowerCase() === 'true',
      needsReview: r.needsReview === true || String(r.needsReview).toLowerCase() === 'true',
      deviceTimestamp: String(r.deviceTimestamp || r.endTime || ''),
      activeBreakId: String(r.activeBreakId || ''),
      testMode: r.testMode === true || String(r.testMode).toLowerCase() === 'true'
    };
    if (slotVal) item.breakSlot = slotVal;
    return item;
  }).filter(function (l) { return l.id && l.staffId; });

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

  // Merge KioskSettings by updatedAt timestamp so the newest saved setting always wins
  var serverSettings = Object.assign({}, DEFAULT_KIOSK_SETTINGS, server.kioskSettings || {});
  var clientSettings = client.kioskSettings ? Object.assign({}, DEFAULT_KIOSK_SETTINGS, client.kioskSettings) : null;
  var serverUpdatedAt = Number(serverSettings.updatedAt || 0);
  var clientUpdatedAt = clientSettings ? Number(clientSettings.updatedAt || 0) : -1;
  var winningSettings = (clientSettings && clientUpdatedAt >= serverUpdatedAt)
    ? Object.assign({}, serverSettings, clientSettings)
    : Object.assign({}, clientSettings || {}, serverSettings);

  var props = PropertiesService.getScriptProperties();
  return {
    staff: mergedStaff,
    activeBreaks: mergedActive,
    logs: mergedLogs,
    deletedLogs: deletedLogs,
    kioskSettings: winningSettings,
    isDefaultPin: (props.getProperty('SUPERVISOR_PIN') || '0000') === '0000',
    serverTime: new Date().toISOString()
  };
}

function writeServerState_(state) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  writeTable_(ss.getSheetByName(SH.STAFF.name), SH.STAFF.headers, state.staff || []);
  writeTable_(ss.getSheetByName(SH.ACTIVE.name), SH.ACTIVE.headers, state.activeBreaks || []);
  writeTable_(ss.getSheetByName(SH.LOGS.name), SH.LOGS.headers, state.logs || []);

  var settingsToSave = state.kioskSettings || DEFAULT_KIOSK_SETTINGS;
  var settingsSheet = ss.getSheetByName(SH.SETTINGS.name);
  if (settingsSheet) {
    writeTable_(settingsSheet, SH.SETTINGS.headers, [
      {
        key: 'kioskSettings',
        value: JSON.stringify(settingsToSave),
        updatedAt: new Date(Number(settingsToSave.updatedAt || Date.now())).toISOString()
      }
    ]);
  }

  var props = PropertiesService.getScriptProperties();
  props.setProperty('KIOSK_SETTINGS_JSON', JSON.stringify(settingsToSave));
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
