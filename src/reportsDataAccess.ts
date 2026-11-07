import {
  KioskSettings,
  SyncableStaff,
  SyncableBreakLog,
  AuditLogEntry,
  EmployeeMonthlyReportMetrics,
  getShiftDate,
  getLogShiftDate,
  getDailyBalance,
  getCountedMins,
  getShiftBreakSlots,
  getShiftDailyAllowanceMins,
  resolveBreakSlot,
  formatDubaiTimeShort,
  addCalendarDays,
  calculateEmployeeDateRangeReport,
  readFromAndroidIdb,
  safeSetStorage,
  safeGetStorage,
} from './kioskTypes';
import { pullCloudStationSync } from './firebase';

export const AUDIT_LOGS_STORAGE_KEY = 'washmen_audit_logs_v1';
const WEEKLY_CACHE_PREFIX = 'washmen_week_cache_v1_';
const WEEKLY_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes cache TTL for past weeks (>2 days old)

interface CachedWeekEntry {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  cachedAtMs: number;
  logs: SyncableBreakLog[];
}

const memoryWeekCache = new Map<string, CachedWeekEntry>();

export interface WeekRangeOption {
  index: number; // 0 = This week, 1 = Last week, ... 12 = 12 weeks ago (13 weeks total)
  weekKey: string; // e.g. "2026-11-02_2026-11-08"
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
  label: string;     // e.g. "Nov 2 – Nov 8, 2026"
  isCurrentWeek: boolean;
  endedMoreThanTwoDaysAgo: boolean;
}

/**
 * Computes the last 13 weeks (about 3 months) anchored at the configured week start day
 * (default 'Monday', or 'Sunday' / 'Saturday') in Asia/Dubai shiftDate calendar terms.
 */
export function getLast13Weeks(
  referenceShiftDateStr: string,
  weekStartDay: 'Monday' | 'Sunday' | 'Saturday' = 'Monday'
): WeekRangeOption[] {
  const [yStr, mStr, dStr] = (referenceShiftDateStr || '2026-11-07').split('-');
  const y = parseInt(yStr || '2026', 10);
  const m = parseInt(mStr || '11', 10);
  const d = parseInt(dStr || '7', 10);
  const refUtc = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = refUtc.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  const targetStartDow =
    weekStartDay === 'Sunday' ? 0 : weekStartDay === 'Saturday' ? 6 : 1;
  const daysSinceWeekStart = (dayOfWeek - targetStartDow + 7) % 7;
  const currentWeekStartStr = addCalendarDays(referenceShiftDateStr, -daysSinceWeekStart);

  const formatShortRange = (startStr: string, endStr: string): string => {
    try {
      const [sy, sm, sd] = startStr.split('-').map((n) => parseInt(n, 10));
      const [ey, em, ed] = endStr.split('-').map((n) => parseInt(n, 10));
      const sDate = new Date(Date.UTC(sy, sm - 1, sd));
      const eDate = new Date(Date.UTC(ey, em - 1, ed));
      const sFmt = sDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
      const eFmt = eDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
      return `${sFmt} – ${eFmt}`;
    } catch {
      return `${startStr} – ${endStr}`;
    }
  };

  const weeks: WeekRangeOption[] = [];
  for (let i = 0; i < 13; i++) {
    const wStart = addCalendarDays(currentWeekStartStr, -i * 7);
    const wEnd = addCalendarDays(wStart, 6);
    const twoDaysAfterEnd = addCalendarDays(wEnd, 2);
    const endedMoreThanTwoDaysAgo = referenceShiftDateStr > twoDaysAfterEnd;
    weeks.push({
      index: i,
      weekKey: `${wStart}_${wEnd}`,
      weekStart: wStart,
      weekEnd: wEnd,
      label: formatShortRange(wStart, wEnd),
      isCurrentWeek: i === 0,
      endedMoreThanTwoDaysAgo,
    });
  }
  return weeks;
}

/**
 * Loads logs for a single week [weekStart, weekEnd] using single-field shiftDate range filtering
 * with 60-minute memory + IndexedDB caching for past weeks that ended > 2 days ago.
 */
export async function loadWeekLogsWithCache(
  week: WeekRangeOption,
  liveLogs: SyncableBreakLog[],
  settings?: KioskSettings,
  forceRefresh: boolean = false
): Promise<{
  logs: SyncableBreakLog[];
  fromCache: boolean;
  cachedAtMs: number;
  estimatedFirestoreReads: number;
}> {
  const filterByRange = (sourceLogs: SyncableBreakLog[]): SyncableBreakLog[] => {
    return (sourceLogs || [])
      .filter((l) => {
        if (!l || l.deleted) return false;
        const sDate = getLogShiftDate(l, settings);
        return sDate >= week.weekStart && sDate <= week.weekEnd;
      })
      .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
  };

  const cacheId = `${WEEKLY_CACHE_PREFIX}${week.weekKey}`;
  const nowMs = Date.now();

  if (!forceRefresh && week.endedMoreThanTwoDaysAgo) {
    const memEntry = memoryWeekCache.get(week.weekKey);
    if (memEntry && nowMs - memEntry.cachedAtMs < WEEKLY_CACHE_TTL_MS) {
      return {
        logs: memEntry.logs,
        fromCache: true,
        cachedAtMs: memEntry.cachedAtMs,
        estimatedFirestoreReads: 0,
      };
    }

    try {
      const rawIdb = (await readFromAndroidIdb(cacheId)) || safeGetStorage(cacheId);
      if (rawIdb) {
        const parsed = JSON.parse(rawIdb) as CachedWeekEntry;
        if (
          parsed &&
          Array.isArray(parsed.logs) &&
          nowMs - Number(parsed.cachedAtMs || 0) < WEEKLY_CACHE_TTL_MS
        ) {
          memoryWeekCache.set(week.weekKey, parsed);
          return {
            logs: parsed.logs,
            fromCache: true,
            cachedAtMs: parsed.cachedAtMs,
            estimatedFirestoreReads: 0,
          };
        }
      }
    } catch {}
  }

  let sourceLogs = liveLogs;
  let firestoreReadsUsed = 1; // 1 station document read or N log docs in range
  if (forceRefresh) {
    try {
      const freshCloud = await pullCloudStationSync();
      if (freshCloud && Array.isArray(freshCloud.logs)) {
        const delSet = new Set(freshCloud.deletedLogs || []);
        sourceLogs = freshCloud.logs.filter((l) => !delSet.has(l.id));
      }
    } catch {}
  }

  const matchedLogs = filterByRange(sourceLogs);
  firestoreReadsUsed = Math.max(1, matchedLogs.length);

  if (week.endedMoreThanTwoDaysAgo) {
    const entry: CachedWeekEntry = {
      weekKey: week.weekKey,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      cachedAtMs: nowMs,
      logs: matchedLogs,
    };
    memoryWeekCache.set(week.weekKey, entry);
    try {
      safeSetStorage(cacheId, JSON.stringify(entry));
    } catch {}
  }

  return {
    logs: matchedLogs,
    fromCache: false,
    cachedAtMs: nowMs,
    estimatedFirestoreReads: firestoreReadsUsed,
  };
}

export interface DailyEmployeeBreakSlotDetail {
  slot: 1 | 2 | 3;
  slotName: string;
  taken: boolean;
  log?: SyncableBreakLog;
  usedMins: number;
  countedMins: number;
  allottedMins: number;
  overSlotMins: number;
  isOverSlotTime: boolean;
  startTimeFormatted: string;
  endTimeFormatted: string;
  reason: string;
  voided: boolean;
  needsReview: boolean;
}

export interface DailyEmployeeReportRow {
  staff: SyncableStaff;
  shiftDate: string;
  slot1: DailyEmployeeBreakSlotDetail;
  slot2: DailyEmployeeBreakSlotDetail;
  slot3: DailyEmployeeBreakSlotDetail;
  allDayLogs: SyncableBreakLog[];
  totalUsedMins: number;
  dailyAllowanceMins: number;
  balanceLeftMins: number;
  dailyOvertimeMins: number;
  savedMins: number;
  isOverAllowance: boolean;
  overSlotMarksCount: number;
  reasonsList: string[];
  voidedCount: number;
  needsReviewCount: number;
  hasAnyActivity: boolean;
}

/**
 * Pure selector building the Selected-Day Report rows for all staff matching shiftFilter.
 */
export function buildSelectedDayReport(
  staffList: SyncableStaff[],
  logs: SyncableBreakLog[],
  selectedShiftDate: string,
  shiftFilter: 'All' | 'Morning' | 'Night',
  settings?: KioskSettings
): {
  rows: DailyEmployeeReportRow[];
  morningTotals: {
    staffWithBreaks: number;
    usedMins: number;
    allowanceMins: number;
    balanceLeftMins: number;
    overtimeMins: number;
    overAllowanceCount: number;
    needsReviewCount: number;
  };
  nightTotals: {
    staffWithBreaks: number;
    usedMins: number;
    allowanceMins: number;
    balanceLeftMins: number;
    overtimeMins: number;
    overAllowanceCount: number;
    needsReviewCount: number;
  };
  grandTotals: {
    staffWithBreaks: number;
    usedMins: number;
    allowanceMins: number;
    balanceLeftMins: number;
    overtimeMins: number;
    overAllowanceCount: number;
    needsReviewCount: number;
  };
} {
  const filteredStaff = (staffList || [])
    .filter((s) => shiftFilter === 'All' || s.shift === shiftFilter)
    .sort((a, b) => a.name.localeCompare(b.name));

  const dayAllLogs = (logs || []).filter(
    (l) => l && !l.deleted && !l.testMode && getLogShiftDate(l, settings) === selectedShiftDate
  );

  const buildSlotDetail = (
    empLogs: SyncableBreakLog[],
    slotNum: 1 | 2 | 3,
    slotName: string,
    defaultMins: number
  ): DailyEmployeeBreakSlotDetail => {
    // Prefer non-voided log for this slot, or show voided log if only voided exists
    const matchingLogs = empLogs.filter(
      (l) => (l.slot || resolveBreakSlot(l.breakType, l.breakSlot, settings)) === slotNum
    );
    const activeLog = matchingLogs.find((l) => !l.voided) || matchingLogs[0];
    if (!activeLog) {
      return {
        slot: slotNum,
        slotName,
        taken: false,
        usedMins: 0,
        countedMins: 0,
        allottedMins: defaultMins,
        overSlotMins: 0,
        isOverSlotTime: false,
        startTimeFormatted: '—',
        endTimeFormatted: '—',
        reason: '',
        voided: false,
        needsReview: false,
      };
    }

    const allotted = Number(activeLog.allottedMins) > 0 ? Number(activeLog.allottedMins) : defaultMins;
    const counted = activeLog.voided ? 0 : getCountedMins(activeLog, settings);
    const grace = Number(settings?.graceMins ?? 1);
    const overSlotMins = activeLog.voided ? 0 : Math.max(0, counted - allotted);
    const isOverSlotTime = !activeLog.voided && counted > allotted + grace;

    return {
      slot: slotNum,
      slotName,
      taken: !activeLog.voided,
      log: activeLog,
      usedMins: activeLog.durationMins,
      countedMins: counted,
      allottedMins: allotted,
      overSlotMins,
      isOverSlotTime,
      startTimeFormatted: formatDubaiTimeShort(activeLog.startTime),
      endTimeFormatted: formatDubaiTimeShort(activeLog.endTime),
      reason: activeLog.exceptionReason || activeLog.reason || 'Normal',
      voided: Boolean(activeLog.voided),
      needsReview: Boolean(activeLog.needsReview),
    };
  };

  const rows: DailyEmployeeReportRow[] = filteredStaff.map((emp) => {
    const empLogs = dayAllLogs
      .filter((l) => l.staffId === emp.id)
      .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
    const slots = getShiftBreakSlots(settings, emp.shift);
    const slot1 = buildSlotDetail(empLogs, 1, slots[0].name, slots[0].mins);
    const slot2 = buildSlotDetail(empLogs, 2, slots[1].name, slots[1].mins);
    const slot3 = buildSlotDetail(empLogs, 3, slots[2].name, slots[2].mins);

    const bal = getDailyBalance(emp.id, selectedShiftDate, dayAllLogs, null, new Date(), settings, emp.shift);

    const nonNormalReasons = empLogs
      .filter((l) => !l.voided && l.exceptionReason && l.exceptionReason !== 'Normal')
      .map((l) => l.exceptionReason);
    const uniqueReasons = Array.from(new Set(nonNormalReasons));

    const voidedCount = empLogs.filter((l) => l.voided).length;
    const needsReviewCount = empLogs.filter((l) => !l.voided && l.needsReview).length;
    const overSlotMarksCount =
      (slot1.isOverSlotTime ? 1 : 0) + (slot2.isOverSlotTime ? 1 : 0) + (slot3.isOverSlotTime ? 1 : 0);

    return {
      staff: emp,
      shiftDate: selectedShiftDate,
      slot1,
      slot2,
      slot3,
      allDayLogs: empLogs,
      totalUsedMins: bal.usedMins,
      dailyAllowanceMins: bal.allowanceMins,
      balanceLeftMins: bal.remainingMins,
      dailyOvertimeMins: bal.overtimeMins,
      savedMins: bal.savedMins,
      isOverAllowance: bal.isOverAllowance,
      overSlotMarksCount,
      reasonsList: uniqueReasons,
      voidedCount,
      needsReviewCount,
      hasAnyActivity: empLogs.length > 0,
    };
  });

  const sumRows = (subset: DailyEmployeeReportRow[]) => {
    // Present employees (with non-voided breaks on this day) contribute to day allowance/balance totals
    const present = subset.filter((r) => r.allDayLogs.some((l) => !l.voided));
    return {
      staffWithBreaks: present.length,
      usedMins: present.reduce((s, r) => s + r.totalUsedMins, 0),
      allowanceMins: present.reduce((s, r) => s + r.dailyAllowanceMins, 0),
      balanceLeftMins: present.reduce((s, r) => s + r.balanceLeftMins, 0),
      overtimeMins: present.reduce((s, r) => s + r.dailyOvertimeMins, 0),
      overAllowanceCount: present.filter((r) => r.isOverAllowance).length,
      needsReviewCount: subset.reduce((s, r) => s + r.needsReviewCount, 0),
    };
  };

  const morningTotals = sumRows(rows.filter((r) => r.staff.shift === 'Morning'));
  const nightTotals = sumRows(rows.filter((r) => r.staff.shift === 'Night'));
  const grandTotals = sumRows(rows);

  return { rows, morningTotals, nightTotals, grandTotals };
}

export interface DaySummaryLine {
  dateStr: string;
  peopleWithBreaks: number;
  totalUsedMins: number;
  totalAllowanceMins: number;
  overtimeMins: number;
  peopleOverAllowance: number;
  exceptionsOrNeedsReviewCount: number;
}

/**
 * Pure selector computing daily summary lines for a list of dates (used by both
 * the Daily Report Month-to-Date section and the Weekly Report Day-by-Day breakdown).
 */
export function buildDailySummaryLinesForDates(
  dateStrings: string[],
  staffList: SyncableStaff[],
  logs: SyncableBreakLog[],
  shiftFilter: 'All' | 'Morning' | 'Night',
  settings?: KioskSettings
): {
  days: DaySummaryLine[];
  totals: {
    peopleDays: number;
    totalUsedMins: number;
    totalAllowanceMins: number;
    overtimeMins: number;
    peopleOverAllowance: number;
    exceptionsOrNeedsReviewCount: number;
  };
} {
  const staffById = new Map<string, SyncableStaff>();
  (staffList || []).forEach((s) => staffById.set(s.id, s));

  const validLogs = (logs || []).filter((l) => l && !l.deleted && !l.voided && !l.testMode);

  const days: DaySummaryLine[] = dateStrings.map((dStr) => {
    const logsOnDate = validLogs.filter((l) => {
      if (shiftFilter !== 'All' && l.shift !== shiftFilter) return false;
      return getLogShiftDate(l, settings) === dStr;
    });

    const staffIdsOnDate = Array.from(new Set(logsOnDate.map((l) => l.staffId)));
    let totalUsedMins = 0;
    let totalAllowanceMins = 0;
    let overtimeMins = 0;
    let peopleOverAllowance = 0;

    for (const staffId of staffIdsOnDate) {
      const st = staffById.get(staffId);
      const shift = st?.shift || logsOnDate.find((l) => l.staffId === staffId)?.shift || 'Morning';
      const bal = getDailyBalance(staffId, dStr, logsOnDate, null, new Date(), settings, shift);
      totalUsedMins += bal.usedMins;
      totalAllowanceMins += bal.allowanceMins;
      overtimeMins += bal.overtimeMins;
      if (bal.isOverAllowance) {
        peopleOverAllowance += 1;
      }
    }

    const exceptionsOrNeedsReviewCount = logsOnDate.filter(
      (l) => l.needsReview || (l.exceptionReason && l.exceptionReason !== 'Normal')
    ).length;

    return {
      dateStr: dStr,
      peopleWithBreaks: staffIdsOnDate.length,
      totalUsedMins,
      totalAllowanceMins,
      overtimeMins,
      peopleOverAllowance,
      exceptionsOrNeedsReviewCount,
    };
  });

  const totals = days.reduce(
    (acc, d) => ({
      peopleDays: acc.peopleDays + d.peopleWithBreaks,
      totalUsedMins: acc.totalUsedMins + d.totalUsedMins,
      totalAllowanceMins: acc.totalAllowanceMins + d.totalAllowanceMins,
      overtimeMins: acc.overtimeMins + d.overtimeMins,
      peopleOverAllowance: acc.peopleOverAllowance + d.peopleOverAllowance,
      exceptionsOrNeedsReviewCount: acc.exceptionsOrNeedsReviewCount + d.exceptionsOrNeedsReviewCount,
    }),
    {
      peopleDays: 0,
      totalUsedMins: 0,
      totalAllowanceMins: 0,
      overtimeMins: 0,
      peopleOverAllowance: 0,
      exceptionsOrNeedsReviewCount: 0,
    }
  );

  return { days, totals };
}

/**
 * Generates all calendar dates (YYYY-MM-DD) from the 1st of the month up to endShiftDateStr.
 */
export function getMonthToDateStrings(selectedMonthPrefix: string, latestShiftDateStr: string): string[] {
  const [yStr, mStr] = (selectedMonthPrefix || '2026-11').split('-');
  const y = parseInt(yStr || '2026', 10);
  const m = parseInt(mStr || '11', 10);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const list: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (dateStr <= latestShiftDateStr) {
      list.push(dateStr);
    }
  }
  return list;
}

export interface RecalculateShiftDateDiff {
  log: SyncableBreakLog;
  oldShiftDate: string;
  newShiftDate: string;
  oldMonth: string;
  newMonth: string;
}

/**
 * Scans all existing logs and returns a preview of logs whose shiftDate (or date) or month
 * would change under the current getShiftDate(shift, startMs, settings) rule.
 * Never alters logs with manual shiftDateOverride unless explicitly included.
 */
export function previewRecalculateShiftDates(
  logs: SyncableBreakLog[],
  settings?: KioskSettings
): {
  totalScanned: number;
  changedLogs: RecalculateShiftDateDiff[];
  estimatedReads: number;
  estimatedWrites: number;
  estimatedBatches: number;
} {
  const changedLogs: RecalculateShiftDateDiff[] = [];
  const activeList = (logs || []).filter((l) => l && !l.deleted);

  for (const log of activeList) {
    if (log.shiftDateOverride) continue;
    const rawStart = log.startMs || log.startTime || log.endTime;
    if (!rawStart) continue;
    const expectedShiftDate = getShiftDate(log.shift, rawStart, settings);
    const expectedMonth = expectedShiftDate.slice(0, 7);
    const currentShiftDate = log.shiftDate || log.date || '';
    const currentMonth = log.month || currentShiftDate.slice(0, 7);

    if (
      currentShiftDate !== expectedShiftDate ||
      log.date !== expectedShiftDate ||
      currentMonth !== expectedMonth
    ) {
      changedLogs.push({
        log,
        oldShiftDate: currentShiftDate,
        newShiftDate: expectedShiftDate,
        oldMonth: currentMonth,
        newMonth: expectedMonth,
      });
    }
  }

  const estimatedBatches = changedLogs.length > 0 ? Math.ceil(changedLogs.length / 400) : 0;
  return {
    totalScanned: activeList.length,
    changedLogs,
    estimatedReads: activeList.length,
    estimatedWrites: changedLogs.length + estimatedBatches,
    estimatedBatches,
  };
}

/**
 * Applies the shiftDate and month recalculation in batches of at most 400 logs per batch,
 * generating one AuditLogEntry per batch. Idempotent and never deletes or alters voided/test flags.
 */
export function applyRecalculateShiftDatesInBatches(
  logs: SyncableBreakLog[],
  actorRole: string,
  settings?: KioskSettings
): {
  updatedLogs: SyncableBreakLog[];
  auditEntries: AuditLogEntry[];
  updatedCount: number;
  batchCount: number;
} {
  const preview = previewRecalculateShiftDates(logs, settings);
  if (preview.changedLogs.length === 0) {
    return {
      updatedLogs: logs,
      auditEntries: [],
      updatedCount: 0,
      batchCount: 0,
    };
  }

  const diffMap = new Map<string, RecalculateShiftDateDiff>();
  preview.changedLogs.forEach((d) => diffMap.set(d.log.id, d));

  const updatedLogs = (logs || []).map((l) => {
    const diff = diffMap.get(l.id);
    if (!diff) return l;
    return {
      ...l,
      date: diff.newShiftDate,
      shiftDate: diff.newShiftDate,
      month: diff.newMonth,
      startMs: l.startMs || Date.parse(l.startTime) || undefined,
      endMs: l.endMs || Date.parse(l.endTime) || undefined,
    };
  });

  const BATCH_SIZE = 400;
  const batchCount = Math.ceil(preview.changedLogs.length / BATCH_SIZE);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const auditEntries: AuditLogEntry[] = [];

  for (let b = 0; b < batchCount; b++) {
    const slice = preview.changedLogs.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    auditEntries.push({
      id: `AUD_RECALC_${nowMs}_${b + 1}`,
      action: 'recalculate_shift_dates_batch',
      actorRole,
      timestampIso: nowIso,
      timestampMs: nowMs,
      details: `Recalculated shiftDate & month for batch ${b + 1}/${batchCount} (${slice.length} logs) using Night cutoff ${
        settings?.nightDayCutoffTime || '12:00'
      } Asia/Dubai`,
      affectedCount: slice.length,
    });
  }

  return {
    updatedLogs,
    auditEntries,
    updatedCount: preview.changedLogs.length,
    batchCount,
  };
}

export function getStoredAuditLogs(): AuditLogEntry[] {
  try {
    const raw = safeGetStorage(AUDIT_LOGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function appendAuditLogEntries(entries: AuditLogEntry[]): AuditLogEntry[] {
  const existing = getStoredAuditLogs();
  const merged = [...entries, ...existing].slice(0, 500);
  try {
    safeSetStorage(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(merged));
  } catch {}
  return merged;
}

/**
 * Self-contained unit test suite verifying getShiftDate (Night shift before/after midnight,
 * Morning shift, month-end crossing), week boundaries, and report totals.
 */
export function runShiftAndReportUnitTests(): {
  passed: boolean;
  totalTests: number;
  results: { name: string; passed: boolean; expected: string; actual: string }[];
} {
  const testSettings: KioskSettings = {
    allowedMins: { Breakfast: 20, Lunch: 20, Tea: 20 },
    dailyAllowanceMins: { Morning: 60, Night: 60 },
    nightDayCutoffTime: '12:00',
    weekStartDay: 'Monday',
    warningMins: 5,
    graceMins: 1,
    bigOvertimeMins: 15,
    maxSimultaneousBreaks: 5,
    needsReviewRunningMins: 90,
    autoReturnSecs: 30,
    soundEnabled: true,
    showOtherShift: false,
    timeWindowsEnabled: false,
    timeWindows: {
      Morning: {
        Breakfast: { start: '05:00', end: '10:30' },
        Lunch: { start: '11:30', end: '15:30' },
        Tea: { start: '15:30', end: '18:30' },
      },
      Night: {
        Breakfast: { start: '17:00', end: '22:30' },
        Lunch: { start: '23:30', end: '03:30' },
        Tea: { start: '03:30', end: '06:30' },
      },
    },
    positiveMessages: [],
    warningMessages: [],
  };

  const results: { name: string; passed: boolean; expected: string; actual: string }[] = [];
  const assertEq = (name: string, actual: string, expected: string) => {
    results.push({ name, passed: actual === expected, expected, actual });
  };

  // Test 1: Night shift break at 22:00 Dubai time on 9 Nov -> 2026-11-09
  const t1 = getShiftDate('Night', '2026-11-09T22:00:00+04:00', testSettings);
  assertEq('Night break at 22:00 on 9 Nov belongs to 2026-11-09', t1, '2026-11-09');

  // Test 2: Night shift break at 01:30 Dubai time on 10 Nov -> 2026-11-09
  const t2 = getShiftDate('Night', '2026-11-10T01:30:00+04:00', testSettings);
  assertEq('Night break at 01:30 on 10 Nov belongs to 2026-11-09', t2, '2026-11-09');

  // Test 3: Night shift break at 04:30 Dubai time on 10 Nov -> 2026-11-09
  const t3 = getShiftDate('Night', '2026-11-10T04:30:00+04:00', testSettings);
  assertEq('Night break at 04:30 on 10 Nov belongs to 2026-11-09', t3, '2026-11-09');

  // Test 4: Morning shift break at 07:00 Dubai time on 10 Nov -> 2026-11-10
  const t4 = getShiftDate('Morning', '2026-11-10T07:00:00+04:00', testSettings);
  assertEq('Morning break at 07:00 on 10 Nov belongs to 2026-11-10', t4, '2026-11-10');

  // Test 5: Night shift crossing end of November (02:15 on 1 Dec -> shiftDate 2026-11-30, month 2026-11)
  const t5 = getShiftDate('Night', '2026-12-01T02:15:00+04:00', testSettings);
  assertEq('Night break at 02:15 on 1 Dec stays in 2026-11-30 (month 2026-11)', `${t5}|${t5.slice(0, 7)}`, '2026-11-30|2026-11');

  // Test 6: All 3 Night breaks (22:00 on 9 Nov, 01:30 & 04:30 on 10 Nov) sum into 2026-11-09 balance
  const sampleNightLogs: SyncableBreakLog[] = [
    {
      id: 'L1',
      staffId: 'N_1',
      staffName: 'Night Worker',
      shift: 'Night',
      breakType: 'Dinner',
      breakSlot: 1,
      startTime: '2026-11-09T22:00:00+04:00',
      endTime: '2026-11-09T22:20:00+04:00',
      durationMins: 20,
      allottedMins: 20,
      varianceMins: 0,
      exceptionReason: 'Normal',
      date: '2026-11-09',
      shiftDate: '2026-11-09',
      month: '2026-11',
    },
    {
      id: 'L2',
      staffId: 'N_1',
      staffName: 'Night Worker',
      shift: 'Night',
      breakType: 'Midnight meal',
      breakSlot: 2,
      startTime: '2026-11-10T01:30:00+04:00',
      endTime: '2026-11-10T01:55:00+04:00',
      durationMins: 25,
      allottedMins: 20,
      varianceMins: 5,
      exceptionReason: 'Returned Late',
      date: '2026-11-09',
      shiftDate: '2026-11-09',
      month: '2026-11',
    },
    {
      id: 'L3',
      staffId: 'N_1',
      staffName: 'Night Worker',
      shift: 'Night',
      breakType: 'Tea',
      breakSlot: 3,
      startTime: '2026-11-10T04:30:00+04:00',
      endTime: '2026-11-10T04:50:00+04:00',
      durationMins: 20,
      allottedMins: 20,
      varianceMins: 0,
      exceptionReason: 'Normal',
      date: '2026-11-09',
      shiftDate: '2026-11-09',
      month: '2026-11',
    },
  ];
  const balAfterMidnight = getDailyBalance(
    'N_1',
    getShiftDate('Night', '2026-11-10T05:00:00+04:00', testSettings),
    sampleNightLogs,
    null,
    new Date('2026-11-10T05:00:00+04:00'),
    testSettings,
    'Night'
  );
  assertEq(
    'Night worker balance at 05:00 on 10 Nov uses 2026-11-09 (used=65, overtime=5)',
    `${balAfterMidnight.shiftDate}|${balAfterMidnight.usedMins}|${balAfterMidnight.overtimeMins}`,
    '2026-11-09|65|5'
  );

  // Test 7: 13-week generator produces 13 Monday-to-Sunday weeks
  const weeks = getLast13Weeks('2026-11-09', 'Monday');
  assertEq(
    '13-week selector starts on Monday 2026-11-09 and lists 13 weeks',
    `${weeks.length}|${weeks[0].weekStart}|${weeks[0].weekEnd}`,
    '13|2026-11-09|2026-11-15'
  );

  return {
    passed: results.every((r) => r.passed),
    totalTests: results.length,
    results,
  };
}
