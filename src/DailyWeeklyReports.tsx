import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  RefreshCw,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Check,
  X,
  Info,
  Sun,
  Moon,
} from 'lucide-react';
import {
  KioskSettings,
  SyncableStaff,
  SyncableBreakLog,
  AuditLogEntry,
  getShiftDate,
  getLogShiftDate,
  getCountedMins,
  getShiftBreakSlots,
  resolveBreakSlot,
  formatDubaiTimeShort,
  subtractOneCalendarDay,
  addCalendarDays,
  calculateEmployeeDateRangeReport,
  sanitizeCsvCell,
  downloadOrShareFile,
  getVerifiedDeveloperMetadata,
} from './kioskTypes';
import {
  buildSelectedDayReport,
  buildDailySummaryLinesForDates,
  getMonthToDateStrings,
  getLast13Weeks,
  loadWeekLogsWithCache,
  previewRecalculateShiftDates,
  applyRecalculateShiftDatesInBatches,
  DailyEmployeeReportRow,
  WeekRangeOption,
} from './reportsDataAccess';

const _REPORTS_DEV_META = getVerifiedDeveloperMetadata();

function formatMinsToHoursMins(mins: number): string {
  const isNeg = mins < 0;
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${isNeg ? '-' : ''}${h}h ${String(m).padStart(2, '0')}m`;
}

interface DailyReportTabProps {
  staff: SyncableStaff[];
  logs: SyncableBreakLog[];
  kioskSettings: KioskSettings;
  currentShift: 'Morning' | 'Night';
  currentTime: Date;
  loggedInRole: 'Manager' | 'Supervisor' | 'Display';
  onUpdateLogFromSupervisorFix: (
    logId: string,
    updates: {
      exceptionReason?: string;
      notes?: string;
      voided?: boolean;
      needsReview?: boolean;
      newShiftDate?: string;
    },
    auditEntry?: AuditLogEntry
  ) => void;
  onNavigateToMonthlyTab?: () => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export function DailyReportTab({
  staff,
  logs,
  kioskSettings,
  currentShift,
  currentTime,
  loggedInRole,
  onUpdateLogFromSupervisorFix,
  showToast,
}: DailyReportTabProps) {
  const todayShiftDate = useMemo(
    () => getShiftDate(currentShift, currentTime, kioskSettings),
    [currentShift, currentTime, kioskSettings]
  );
  const yesterdayShiftDate = useMemo(
    () => subtractOneCalendarDay(todayShiftDate),
    [todayShiftDate]
  );

  const [selectedDate, setSelectedDate] = useState<string>(todayShiftDate);
  const [calendarMonthPrefix, setCalendarMonthPrefix] = useState<string>(() =>
    todayShiftDate.slice(0, 7)
  );
  const [shiftFilter, setShiftFilter] = useState<'All' | 'Morning' | 'Night'>('All');
  const [selectedEmployeeRow, setSelectedEmployeeRow] = useState<DailyEmployeeReportRow | null>(null);

  // Supervisor Fix modal states inside employee row detail
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [fixReason, setFixReason] = useState<string>('Normal');
  const [fixNotes, setFixNotes] = useState<string>('');
  const [fixShiftDate, setFixShiftDate] = useState<string>('');
  const [fixVoided, setFixVoided] = useState<boolean>(false);

  // Set of all shiftDates that have at least one non-deleted, non-test record (for calendar dots)
  const datesWithRecordsSet = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs || []) {
      if (!l || l.deleted || l.testMode) continue;
      set.add(getLogShiftDate(l, kioskSettings));
    }
    return set;
  }, [logs, kioskSettings]);

  // Build calendar grid for calendarMonthPrefix (YYYY-MM)
  const calendarDays = useMemo(() => {
    const [yStr, mStr] = (calendarMonthPrefix || '2026-11').split('-');
    const y = parseInt(yStr || '2026', 10);
    const m = parseInt(mStr || '11', 10);
    const firstDayUtc = new Date(Date.UTC(y, m - 1, 1));
    const startWeekday = firstDayUtc.getUTCDay(); // 0 (Sun) .. 6 (Sat)
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

    const cells: { dateStr: string | null; dayNum: number | null; hasRecords: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ dateStr: null, dayNum: null, hasRecords: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dateStr: dStr,
        dayNum: d,
        hasRecords: datesWithRecordsSet.has(dStr),
      });
    }
    return {
      year: y,
      month: m,
      monthLabel: firstDayUtc.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      cells,
    };
  }, [calendarMonthPrefix, datesWithRecordsSet]);

  const handlePrevCalendarMonth = () => {
    const [y, m] = calendarMonthPrefix.split('-').map((n) => parseInt(n, 10));
    const prev = new Date(Date.UTC(y, m - 2, 1));
    setCalendarMonthPrefix(
      `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
    );
  };

  const handleNextCalendarMonth = () => {
    const [y, m] = calendarMonthPrefix.split('-').map((n) => parseInt(n, 10));
    const next = new Date(Date.UTC(y, m, 1));
    setCalendarMonthPrefix(
      `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
    );
  };

  // Selected-Day Report calculation
  const dayReport = useMemo(
    () => buildSelectedDayReport(staff, logs, selectedDate, shiftFilter, kioskSettings),
    [staff, logs, selectedDate, shiftFilter, kioskSettings]
  );

  // Month-to-Date (MTD) calculation from 1st of selectedDate's month up to todayShiftDate (or end of selected month)
  const selectedMonthPrefix = selectedDate.slice(0, 7);
  const mtdEndDateStr =
    selectedMonthPrefix === todayShiftDate.slice(0, 7)
      ? todayShiftDate
      : `${selectedMonthPrefix}-31`;
  const mtdDateStrings = useMemo(
    () => getMonthToDateStrings(selectedMonthPrefix, mtdEndDateStr),
    [selectedMonthPrefix, mtdEndDateStr]
  );

  const mtdSummary = useMemo(
    () => buildDailySummaryLinesForDates(mtdDateStrings, staff, logs, shiftFilter, kioskSettings),
    [mtdDateStrings, staff, logs, shiftFilter, kioskSettings]
  );

  // Check if Night shift after midnight is showing yesterday's calendar date as active shiftDate
  const dubaiCalToday = useMemo(
    () => getShiftDate('Morning', currentTime, kioskSettings),
    [currentTime, kioskSettings]
  );
  const isNightPostMidnightActive = currentShift === 'Night' && todayShiftDate !== dubaiCalToday;

  // CSV Export for Selected Day
  const handleExportSelectedDayCsv = async () => {
    let csv =
      'Shift Date,Employee ID,Employee Name,Shift,Break 1 (Mins & Time),Break 2 (Mins & Time),Break 3 (Mins & Time),Total Used (Mins),Daily Allowance (Mins),Balance Left (Mins),Daily Overtime (Mins),Over Break Slot Marks,Reasons,Voided Count,Needs Review\n';
    dayReport.rows.forEach((r) => {
      const b1 = r.slot1.taken
        ? `${r.slot1.countedMins}m (${r.slot1.startTimeFormatted}-${r.slot1.endTimeFormatted})`
        : r.slot1.voided
        ? 'Voided'
        : '—';
      const b2 = r.slot2.taken
        ? `${r.slot2.countedMins}m (${r.slot2.startTimeFormatted}-${r.slot2.endTimeFormatted})`
        : r.slot2.voided
        ? 'Voided'
        : '—';
      const b3 = r.slot3.taken
        ? `${r.slot3.countedMins}m (${r.slot3.startTimeFormatted}-${r.slot3.endTimeFormatted})`
        : r.slot3.voided
        ? 'Voided'
        : '—';
      csv += `${sanitizeCsvCell(r.shiftDate)},${sanitizeCsvCell(r.staff.empId)},${sanitizeCsvCell(
        r.staff.name
      )},${sanitizeCsvCell(r.staff.shift)},${sanitizeCsvCell(b1)},${sanitizeCsvCell(
        b2
      )},${sanitizeCsvCell(b3)},${r.totalUsedMins},${r.dailyAllowanceMins},${r.balanceLeftMins},${
        r.dailyOvertimeMins
      },${r.overSlotMarksCount},${sanitizeCsvCell(r.reasonsList.join('; ') || 'Normal')},${
        r.voidedCount
      },${r.needsReviewCount > 0 ? 'Yes' : 'No'}\n`;
    });
    csv += `${sanitizeCsvCell('GRAND TOTAL (Present)')},"","",${sanitizeCsvCell(
      shiftFilter
    )},"","","",${dayReport.grandTotals.usedMins},${dayReport.grandTotals.allowanceMins},${
      dayReport.grandTotals.balanceLeftMins
    },${dayReport.grandTotals.overtimeMins},"","",0,${dayReport.grandTotals.needsReviewCount}\n`;

    await downloadOrShareFile(
      `Washmen_Daily_Report_${selectedDate}.csv`,
      csv,
      'text/csv;charset=utf-8;',
      false
    );
    showToast(`Exported Daily Report CSV for ${selectedDate}`, 'success');
  };

  // CSV Export for Month-to-Date
  const handleExportMtdCsv = async () => {
    let csv =
      'Shift Date,People With Breaks,Total Minutes Used,Total Allowance (Mins),Daily Overtime (Mins),People Over Allowance,Exceptions or Needs Review\n';
    mtdSummary.days.forEach((d) => {
      csv += `${sanitizeCsvCell(d.dateStr)},${d.peopleWithBreaks},${d.totalUsedMins},${
        d.totalAllowanceMins
      },${d.overtimeMins},${d.peopleOverAllowance},${d.exceptionsOrNeedsReviewCount}\n`;
    });
    csv += `${sanitizeCsvCell('MONTH-TO-DATE TOTAL')},${mtdSummary.totals.peopleDays},${
      mtdSummary.totals.totalUsedMins
    },${mtdSummary.totals.totalAllowanceMins},${mtdSummary.totals.overtimeMins},${
      mtdSummary.totals.peopleOverAllowance
    },${mtdSummary.totals.exceptionsOrNeedsReviewCount}\n`;

    await downloadOrShareFile(
      `Washmen_Month_To_Date_${selectedMonthPrefix}.csv`,
      csv,
      'text/csv;charset=utf-8;',
      false
    );
    showToast(`Exported Month-to-Date CSV for ${selectedMonthPrefix}`, 'success');
  };

  const openEditLogFix = (log: SyncableBreakLog) => {
    setEditingLogId(log.id);
    setFixReason(log.exceptionReason || 'Normal');
    setFixNotes(log.notes || '');
    setFixShiftDate(getLogShiftDate(log, kioskSettings));
    setFixVoided(Boolean(log.voided));
  };

  const handleSaveLogFix = (log: SyncableBreakLog) => {
    const oldShiftDate = getLogShiftDate(log, kioskSettings);
    const cleanNewDate =
      /^\d{4}-\d{2}-\d{2}$/.test(fixShiftDate.trim()) ? fixShiftDate.trim() : oldShiftDate;
    const nowMs = Date.now();
    const auditEntry: AuditLogEntry = {
      id: `AUD_FIX_${nowMs}`,
      action: cleanNewDate !== oldShiftDate ? 'shiftDate_fix' : 'supervisor_fix',
      actorRole: loggedInRole,
      timestampIso: new Date(nowMs).toISOString(),
      timestampMs: nowMs,
      details: `Supervisor fix on ${log.staffName} (${log.breakType}): reason=${fixReason}, voided=${fixVoided}, shiftDate ${oldShiftDate} -> ${cleanNewDate}`,
      affectedCount: 1,
      logId: log.id,
      oldShiftDate,
      newShiftDate: cleanNewDate,
    };

    onUpdateLogFromSupervisorFix(
      log.id,
      {
        exceptionReason: fixReason,
        notes: fixNotes.trim() || undefined,
        voided: fixVoided,
        needsReview: false,
        newShiftDate: cleanNewDate,
      },
      auditEntry
    );
    setEditingLogId(null);
    showToast(`Saved Supervisor Fix for ${log.staffName}`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Calendar Picker Card */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E4E7F2] shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-[#EEECFB] text-[#4D3FDC] text-xs font-extrabold mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Daily Report &amp; Month-to-Date (Asia/Dubai Shift Date)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#171262]">
              Daily Break Report — {selectedDate}
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5A85] font-medium mt-0.5">
              Every Night-shift break taken before{' '}
              <strong className="text-[#171262]">
                {kioskSettings.nightDayCutoffTime || '12:00'}
              </strong>{' '}
              belongs to the date the Night shift started. Voided and test breaks are excluded.
            </p>
            {isNightPostMidnightActive && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs font-bold">
                <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Night shift after midnight is active: today&apos;s active shiftDate is{' '}
                  <strong>{todayShiftDate}</strong> (the evening the shift started).
                </span>
              </div>
            )}
          </div>

          {/* Quick Date & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => {
                setSelectedDate(todayShiftDate);
                setCalendarMonthPrefix(todayShiftDate.slice(0, 7));
              }}
              className={`min-h-[44px] px-4 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer border ${
                selectedDate === todayShiftDate
                  ? 'bg-[#251B7C] text-white border-[#251B7C]'
                  : 'bg-[#F8F9FE] text-[#171262] border-[#D5D0F9] hover:bg-[#EEECFB]'
              }`}
            >
              Today ({todayShiftDate})
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDate(yesterdayShiftDate);
                setCalendarMonthPrefix(yesterdayShiftDate.slice(0, 7));
              }}
              className={`min-h-[44px] px-4 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer border ${
                selectedDate === yesterdayShiftDate
                  ? 'bg-[#251B7C] text-white border-[#251B7C]'
                  : 'bg-[#F8F9FE] text-[#171262] border-[#D5D0F9] hover:bg-[#EEECFB]'
              }`}
            >
              Yesterday ({yesterdayShiftDate})
            </button>
            <button
              type="button"
              onClick={handleExportSelectedDayCsv}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download Day CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Custom In-Page Month Calendar with Dots on Days with Records */}
        <div className="bg-[#F8F9FE] p-4 sm:p-5 rounded-2xl border border-[#E4E7F2] print:hidden">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevCalendarMonth}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#D5D0F9] text-[#171262] hover:bg-[#EEECFB] font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev Month</span>
            </button>
            <div className="text-center">
              <span className="text-base sm:text-lg font-black text-[#171262]">
                {calendarDays.monthLabel}
              </span>
              <span className="block text-[11px] font-semibold text-[#5C5A85]">
                Tap any date to inspect its full shift report • Dot = has break records
              </span>
            </div>
            <button
              type="button"
              onClick={handleNextCalendarMonth}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#D5D0F9] text-[#171262] hover:bg-[#EEECFB] font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Next Month</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-extrabold uppercase text-[#5C5A85] mb-1.5">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.cells.map((cell, idx) => {
              if (!cell.dateStr || cell.dayNum === null) {
                return <div key={`empty_${idx}`} className="min-h-[48px]" />;
              }
              const isSelected = cell.dateStr === selectedDate;
              const isTodayShift = cell.dateStr === todayShiftDate;
              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr!)}
                  className={`min-h-[48px] sm:min-h-[54px] rounded-xl border flex flex-col items-center justify-center p-1 transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#251B7C] text-white border-[#251B7C] shadow-md font-black'
                      : isTodayShift
                      ? 'bg-amber-50 text-[#171262] border-amber-400 font-black'
                      : cell.hasRecords
                      ? 'bg-white text-[#171262] border-[#D5D0F9] hover:bg-[#EEECFB] font-bold'
                      : 'bg-white/60 text-[#5C5A85] border-[#E4E7F2] hover:bg-white font-semibold'
                  }`}
                >
                  <span className="text-sm leading-none">{cell.dayNum}</span>
                  <div className="h-2.5 flex items-center justify-center mt-1">
                    {cell.hasRecords && (
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-cyan-300' : 'bg-[#4D3FDC]'
                        }`}
                        title="Has break logs"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Shift Filter & Selected Day Summary KPI Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 print:hidden">
            <span className="text-xs font-extrabold text-[#5C5A85] uppercase">Shift Filter:</span>
            {(['All', 'Morning', 'Night'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setShiftFilter(f)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                  shiftFilter === f
                    ? 'bg-[#4D3FDC] text-white border-[#4D3FDC]'
                    : 'bg-white text-[#5C5A85] border-[#E4E7F2] hover:text-[#171262]'
                }`}
              >
                {f === 'All' ? 'All Shifts' : `${f} Shift`}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] font-bold text-[#171262]">
              Present with breaks: <strong>{dayReport.grandTotals.staffWithBreaks}</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] font-bold text-[#171262]">
              Total Used: <strong>{dayReport.grandTotals.usedMins} min</strong> (
              {formatMinsToHoursMins(dayReport.grandTotals.usedMins)})
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] font-bold text-[#171262]">
              Total Allowance (Present): <strong>{dayReport.grandTotals.allowanceMins} min</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-300 font-black text-amber-950">
              Daily Overtime: <strong>{dayReport.grandTotals.overtimeMins} min</strong> (
              {dayReport.grandTotals.overAllowanceCount} over allowance)
            </span>
          </div>
        </div>

        {/* Selected-Day Employee Table (Sticky name column on phones) */}
        <div className="overflow-x-auto rounded-2xl border border-[#E4E7F2]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#251B7C] text-white uppercase text-[11px] font-extrabold">
                <th className="py-3 px-3 sticky left-0 z-10 bg-[#251B7C] min-w-[165px]">
                  Employee
                </th>
                <th className="py-3 px-2.5">Shift</th>
                <th className="py-3 px-3 min-w-[130px]">Break 1</th>
                <th className="py-3 px-3 min-w-[130px]">Break 2</th>
                <th className="py-3 px-3 min-w-[130px]">Break 3</th>
                <th className="py-3 px-2.5 text-right">Total Used</th>
                <th className="py-3 px-2.5 text-right">Allowance</th>
                <th className="py-3 px-2.5 text-right">Balance Left</th>
                <th className="py-3 px-2.5 text-right">Daily Overtime</th>
                <th className="py-3 px-3">Marks &amp; Reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7F2] bg-white">
              {dayReport.rows.map((r) => {
                const renderSlotCell = (s: DailyEmployeeReportRow['slot1']) => {
                  if (s.voided && !s.taken) {
                    return (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[11px]">
                        Voided
                      </span>
                    );
                  }
                  if (!s.taken) {
                    return <span className="text-slate-400 font-medium">—</span>;
                  }
                  return (
                    <div className="space-y-0.5">
                      <div className="font-black text-[#171262]">
                        {s.countedMins} min{' '}
                        <span className="font-mono text-[11px] font-semibold text-[#5C5A85]">
                          ({s.startTimeFormatted}–{s.endTimeFormatted})
                        </span>
                      </div>
                      {s.isOverSlotTime && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-extrabold">
                          <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>+{s.overSlotMins}m over this break&apos;s time</span>
                        </span>
                      )}
                    </div>
                  );
                };

                return (
                  <tr
                    key={r.staff.id}
                    onClick={() => setSelectedEmployeeRow(r)}
                    className="hover:bg-[#F8F9FE] transition cursor-pointer"
                    title="Tap row to inspect or fix break logs for this employee"
                  >
                    <td className="py-3 px-3 sticky left-0 z-10 bg-white hover:bg-[#F8F9FE] border-r border-[#E4E7F2]">
                      <div className="font-black text-[#171262] text-xs sm:text-sm">
                        {r.staff.name}
                      </div>
                      <div className="text-[11px] font-mono text-[#5C5A85]">
                        ID: #{r.staff.empId}
                      </div>
                    </td>
                    <td className="py-3 px-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          r.staff.shift === 'Morning'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-indigo-100 text-indigo-900'
                        }`}
                      >
                        {r.staff.shift === 'Morning' ? (
                          <Sun className="w-3 h-3" />
                        ) : (
                          <Moon className="w-3 h-3" />
                        )}
                        <span>{r.staff.shift}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3">{renderSlotCell(r.slot1)}</td>
                    <td className="py-3 px-3">{renderSlotCell(r.slot2)}</td>
                    <td className="py-3 px-3">{renderSlotCell(r.slot3)}</td>
                    <td className="py-3 px-2.5 text-right font-mono font-black text-[#171262]">
                      {r.totalUsedMins} min
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono font-semibold text-[#5C5A85]">
                      {r.dailyAllowanceMins} min
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono font-bold">
                      {r.isOverAllowance ? (
                        <span className="text-amber-900 font-black">0 min</span>
                      ) : (
                        <span className="text-emerald-700">{r.balanceLeftMins} min</span>
                      )}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono">
                      {r.dailyOvertimeMins > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-300 font-black">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                          <span>+{r.dailyOvertimeMins} min</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold">0 min</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {r.overSlotMarksCount > 0 && r.dailyOvertimeMins === 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold">
                            Over break slot ({r.overSlotMarksCount}), within day allowance
                          </span>
                        )}
                        {r.needsReviewCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black">
                            Needs Review ({r.needsReviewCount})
                          </span>
                        )}
                        {r.voidedCount > 0 && (
                          <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">
                            Voided ({r.voidedCount})
                          </span>
                        )}
                        {r.reasonsList.map((rsn, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-[#EEECFB] text-[#4D3FDC] text-[10px] font-bold"
                          >
                            {rsn}
                          </span>
                        ))}
                        {r.hasAnyActivity && (
                          <span className="text-[11px] font-bold text-[#4D3FDC] underline ml-1 print:hidden">
                            Inspect / Fix
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#F8F9FE] border-t-2 border-[#D5D0F9] font-black text-xs">
              {shiftFilter === 'All' && (
                <>
                  <tr className="text-[#171262] border-b border-[#E4E7F2]">
                    <td className="py-2.5 px-3 sticky left-0 bg-[#F8F9FE]">
                      Morning Shift Total (Present: {dayReport.morningTotals.staffWithBreaks})
                    </td>
                    <td colSpan={4} className="py-2.5 px-3 text-[#5C5A85]">
                      Morning Shift Summary
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {dayReport.morningTotals.usedMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {dayReport.morningTotals.allowanceMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-emerald-700">
                      {dayReport.morningTotals.balanceLeftMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-amber-900">
                      {dayReport.morningTotals.overtimeMins} min
                    </td>
                    <td className="py-2.5 px-3">
                      {dayReport.morningTotals.overAllowanceCount} over allowance
                    </td>
                  </tr>
                  <tr className="text-[#171262] border-b border-[#E4E7F2]">
                    <td className="py-2.5 px-3 sticky left-0 bg-[#F8F9FE]">
                      Night Shift Total (Present: {dayReport.nightTotals.staffWithBreaks})
                    </td>
                    <td colSpan={4} className="py-2.5 px-3 text-[#5C5A85]">
                      Night Shift Summary
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {dayReport.nightTotals.usedMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {dayReport.nightTotals.allowanceMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-emerald-700">
                      {dayReport.nightTotals.balanceLeftMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-amber-900">
                      {dayReport.nightTotals.overtimeMins} min
                    </td>
                    <td className="py-2.5 px-3">
                      {dayReport.nightTotals.overAllowanceCount} over allowance
                    </td>
                  </tr>
                </>
              )}
              <tr className="bg-[#EEECFB] text-[#171262]">
                <td className="py-3 px-3 sticky left-0 bg-[#EEECFB]">
                  GRAND TOTAL (Present: {dayReport.grandTotals.staffWithBreaks})
                </td>
                <td colSpan={4} className="py-3 px-3">
                  {selectedDate} ({shiftFilter})
                </td>
                <td className="py-3 px-2.5 text-right font-mono">
                  {dayReport.grandTotals.usedMins} min
                </td>
                <td className="py-3 px-2.5 text-right font-mono">
                  {dayReport.grandTotals.allowanceMins} min
                </td>
                <td className="py-3 px-2.5 text-right font-mono text-emerald-800">
                  {dayReport.grandTotals.balanceLeftMins} min
                </td>
                <td className="py-3 px-2.5 text-right font-mono text-amber-950">
                  {dayReport.grandTotals.overtimeMins} min
                </td>
                <td className="py-3 px-3">
                  {dayReport.grandTotals.overAllowanceCount} over allowance •{' '}
                  {dayReport.grandTotals.needsReviewCount} needs review
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Month-to-Date (MTD) Section */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E4E7F2] shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-[#171262]">
              Month-to-Date Summary ({selectedMonthPrefix}-01 to {mtdEndDateStr})
            </h3>
            <p className="text-xs text-[#5C5A85]">
              One line per shiftDate from the 1st of the month up to today • Updates live and matches the sum of daily reports.
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleExportMtdCsv}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download MTD CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print MTD</span>
            </button>
          </div>
        </div>

        {/* Visual Bar Chart of Minutes Used vs Allowance per Day (with text values) */}
        <div className="bg-[#F8F9FE] p-4 rounded-2xl border border-[#E4E7F2] space-y-2.5">
          <div className="text-xs font-extrabold text-[#171262] flex items-center justify-between">
            <span>Daily Minutes Used vs. Allowance (Text + Bar Chart)</span>
            <span className="text-[#5C5A85]">
              MTD Used: {mtdSummary.totals.totalUsedMins}m / Allowance:{' '}
              {mtdSummary.totals.totalAllowanceMins}m
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {mtdSummary.days
              .filter((d) => d.peopleWithBreaks > 0 || d.dateStr === selectedDate)
              .map((d) => {
                const pct =
                  d.totalAllowanceMins > 0
                    ? Math.min(100, Math.round((d.totalUsedMins / d.totalAllowanceMins) * 100))
                    : 0;
                const isOver = d.overtimeMins > 0;
                return (
                  <div key={d.dateStr} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="font-mono text-[#171262]">
                        {d.dateStr} ({d.peopleWithBreaks} staff)
                      </span>
                      <span className="font-mono text-[#171262]">
                        Used: <strong>{d.totalUsedMins}m</strong> / Allowance:{' '}
                        <strong>{d.totalAllowanceMins}m</strong>
                        {isOver ? ` • Overtime: +${d.overtimeMins}m` : ' • Overtime: 0m'}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className={`h-full rounded-full ${
                          isOver ? 'bg-amber-500' : 'bg-[#4D3FDC]'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Month-to-Date Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#E4E7F2]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#251B7C] text-white uppercase text-[11px] font-extrabold">
                <th className="py-3 px-3">Shift Date</th>
                <th className="py-3 px-3 text-right">People With Breaks</th>
                <th className="py-3 px-3 text-right">Total Minutes Used</th>
                <th className="py-3 px-3 text-right">Total Allowance</th>
                <th className="py-3 px-3 text-right">Overtime Minutes</th>
                <th className="py-3 px-3 text-right">People Over Allowance</th>
                <th className="py-3 px-3 text-right">Exceptions / Needs Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7F2] bg-white">
              {mtdSummary.days.map((d) => (
                <tr
                  key={d.dateStr}
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`hover:bg-[#F8F9FE] cursor-pointer ${
                    d.dateStr === selectedDate ? 'bg-[#EEECFB]/60 font-bold' : ''
                  }`}
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-[#171262]">{d.dateStr}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{d.peopleWithBreaks}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                    {d.totalUsedMins} min
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#5C5A85]">
                    {d.totalAllowanceMins} min
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {d.overtimeMins > 0 ? (
                      <span className="font-black text-amber-900">+{d.overtimeMins} min</span>
                    ) : (
                      <span className="text-slate-400">0 min</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{d.peopleOverAllowance}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {d.exceptionsOrNeedsReviewCount}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#EEECFB] font-black text-xs text-[#171262] border-t-2 border-[#D5D0F9]">
              <tr>
                <td className="py-3 px-3">MONTH-TO-DATE TOTAL ({mtdSummary.days.length} days)</td>
                <td className="py-3 px-3 text-right font-mono">{mtdSummary.totals.peopleDays}</td>
                <td className="py-3 px-3 text-right font-mono">
                  {mtdSummary.totals.totalUsedMins} min
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  {mtdSummary.totals.totalAllowanceMins} min
                </td>
                <td className="py-3 px-3 text-right font-mono text-amber-950">
                  {mtdSummary.totals.overtimeMins} min
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  {mtdSummary.totals.peopleOverAllowance}
                </td>
                <td className="py-3 px-3 text-right font-mono">
                  {mtdSummary.totals.exceptionsOrNeedsReviewCount}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Print Credit Line */}
        <div className="hidden print:block pt-4 border-t border-slate-300 text-xs text-slate-700 font-bold">
          Washmen Laundry — Wash &amp; Fold Break Station • {_REPORTS_DEV_META.createdByLabel} (
          {_REPORTS_DEV_META.verificationTitle})
        </div>
      </div>

      {/* Modal: Employee Break Details & Supervisor Fix (including shiftDate Calendar Picker) */}
      {selectedEmployeeRow && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-[#E4E7F2] max-h-[90vh] flex flex-col">
            <div className="bg-[#251B7C] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg text-white">
                  {selectedEmployeeRow.staff.name} (ID: #{selectedEmployeeRow.staff.empId})
                </h3>
                <p className="text-xs text-indigo-200 font-semibold">
                  {selectedEmployeeRow.staff.shift} Shift • Shift Date: {selectedEmployeeRow.shiftDate}{' '}
                  • Used {selectedEmployeeRow.totalUsedMins}m / {selectedEmployeeRow.dailyAllowanceMins}
                  m
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedEmployeeRow(null);
                  setEditingLogId(null);
                }}
                className="text-indigo-200 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {selectedEmployeeRow.allDayLogs.length === 0 ? (
                <div className="p-6 text-center bg-[#F8F9FE] rounded-2xl border border-[#E4E7F2] text-[#5C5A85] font-semibold">
                  No break logs recorded for {selectedEmployeeRow.staff.name} on{' '}
                  {selectedEmployeeRow.shiftDate}.
                </div>
              ) : (
                selectedEmployeeRow.allDayLogs.map((log) => {
                  const isEditingThis = editingLogId === log.id;
                  const counted = getCountedMins(log, kioskSettings);
                  const logSDate = getLogShiftDate(log, kioskSettings);
                  return (
                    <div
                      key={log.id}
                      className="p-4 rounded-2xl border border-[#D5D0F9] bg-[#F8F9FE] space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-black text-sm text-[#171262]">
                            {log.breakType} (Slot #{log.breakSlot || 1})
                          </span>
                          <span className="ml-2 font-mono text-xs text-[#5C5A85]">
                            {formatDubaiTimeShort(log.startTime)} –{' '}
                            {formatDubaiTimeShort(log.endTime)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-[#E4E7F2] font-mono font-bold text-[#171262]">
                            Actual: {log.durationMins}m • Counted: {counted}m
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              isEditingThis ? setEditingLogId(null) : openEditLogFix(log)
                            }
                            className="px-3 py-1.5 rounded-xl bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>{isEditingThis ? 'Cancel' : 'Supervisor Fix'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5C5A85]">
                        <span>
                          Shift Date: <strong className="font-mono text-[#171262]">{logSDate}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Reason: <strong className="text-[#171262]">{log.exceptionReason}</strong>
                        </span>
                        {log.voided && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                            VOIDED
                          </span>
                        )}
                      </div>

                      {isEditingThis && (
                        <div className="pt-3 border-t border-[#D5D0F9] grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-bold text-[#171262] mb-1">
                              Fix Reason (Updates Counted Mins &amp; Balance)
                            </label>
                            <select
                              value={fixReason}
                              onChange={(e) => setFixReason(e.target.value)}
                              className="w-full bg-white border border-[#D5D0F9] rounded-xl px-3 py-2 font-bold text-[#171262]"
                            >
                              <option value="Normal">Normal</option>
                              <option value="I forgot to stop earlier">
                                I forgot to stop earlier (Counts Allotted Mins)
                              </option>
                              <option value="Supervisor Forgot">
                                Supervisor Forgot (Counts Allotted Mins)
                              </option>
                              <option value="Approved Extended">Approved Extended</option>
                              <option value="Returned Late">Returned Late</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-bold text-[#171262] mb-1">
                              Fix Shift Date (YYYY-MM-DD Calendar Picker)
                            </label>
                            <input
                              type="date"
                              value={fixShiftDate}
                              onChange={(e) => setFixShiftDate(e.target.value)}
                              className="w-full bg-white border border-[#D5D0F9] rounded-xl px-3 py-2 font-mono font-bold text-[#171262]"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block font-bold text-[#171262] mb-1">
                              Supervisor Notes
                            </label>
                            <input
                              type="text"
                              value={fixNotes}
                              onChange={(e) => setFixNotes(e.target.value)}
                              placeholder="Optional audit note..."
                              className="w-full bg-white border border-[#D5D0F9] rounded-xl px-3 py-2 text-[#171262]"
                            />
                          </div>

                          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pt-1">
                            <label className="inline-flex items-center gap-2 font-bold text-rose-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={fixVoided}
                                onChange={(e) => setFixVoided(e.target.checked)}
                                className="w-4 h-4 rounded"
                              />
                              <span>Void this break (returns minutes to daily balance)</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleSaveLogFix(log)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                              <span>Save Fix &amp; Write Audit Record</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface WeeklyReportTabProps {
  staff: SyncableStaff[];
  logs: SyncableBreakLog[];
  kioskSettings: KioskSettings;
  currentShift: 'Morning' | 'Night';
  currentTime: Date;
  onNavigateToMonthlyTab: () => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export function WeeklyReportTab({
  staff,
  logs,
  kioskSettings,
  currentShift,
  currentTime,
  onNavigateToMonthlyTab,
  showToast,
}: WeeklyReportTabProps) {
  const todayShiftDate = useMemo(
    () => getShiftDate(currentShift, currentTime, kioskSettings),
    [currentShift, currentTime, kioskSettings]
  );
  const weekStartDay = kioskSettings.weekStartDay || 'Monday';

  const weeks13 = useMemo(
    () => getLast13Weeks(todayShiftDate, weekStartDay),
    [todayShiftDate, weekStartDay]
  );

  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [shiftFilter, setShiftFilter] = useState<'All' | 'Morning' | 'Night'>('All');
  const [weekLogsState, setWeekLogsState] = useState<{
    logs: SyncableBreakLog[];
    fromCache: boolean;
    cachedAtMs: number;
    estimatedFirestoreReads: number;
  }>({
    logs: [],
    fromCache: false,
    cachedAtMs: 0,
    estimatedFirestoreReads: 0,
  });

  // 3-Month (13-Week) Trend on-demand state
  const [trendConfirmOpen, setTrendConfirmOpen] = useState<boolean>(false);
  const [trendLoaded, setTrendLoaded] = useState<boolean>(false);

  const selectedWeek: WeekRangeOption = weeks13[selectedWeekIdx] || weeks13[0];

  useEffect(() => {
    let active = true;
    loadWeekLogsWithCache(selectedWeek, logs, kioskSettings, false).then((res) => {
      if (active) setWeekLogsState(res);
    });
    return () => {
      active = false;
    };
  }, [selectedWeek, logs, kioskSettings]);

  const handleRefreshWeek = async () => {
    const res = await loadWeekLogsWithCache(selectedWeek, logs, kioskSettings, true);
    setWeekLogsState(res);
    showToast(`Refreshed records for week ${selectedWeek.label}`, 'info');
  };

  // Filtered staff for selected week
  const filteredStaff = useMemo(() => {
    return (staff || [])
      .filter((s) => shiftFilter === 'All' || s.shift === shiftFilter)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, shiftFilter]);

  const validWeekLogs = useMemo(
    () => (weekLogsState.logs || []).filter((l) => !l.voided && !l.deleted && !l.testMode),
    [weekLogsState.logs]
  );

  const weeklyEmployeeRows = useMemo(() => {
    return filteredStaff.map((st) => ({
      staff: st,
      metrics: calculateEmployeeDateRangeReport(
        st.id,
        st.shift,
        selectedWeek.weekStart,
        selectedWeek.weekEnd,
        validWeekLogs,
        kioskSettings
      ),
    }));
  }, [filteredStaff, selectedWeek.weekStart, selectedWeek.weekEnd, validWeekLogs, kioskSettings]);

  const sumMetrics = (rows: typeof weeklyEmployeeRows) =>
    rows.reduce(
      (acc, r) => ({
        daysPresent: acc.daysPresent + r.metrics.daysPresent,
        breaksCount: acc.breaksCount + r.metrics.breaksCount,
        entitledMins: acc.entitledMins + r.metrics.entitledMins,
        usedMins: acc.usedMins + r.metrics.usedMins,
        differenceMins: acc.differenceMins + r.metrics.differenceMins,
        overtimeMins: acc.overtimeMins + r.metrics.overtimeMins,
        daysOverAllowance: acc.daysOverAllowance + r.metrics.daysOverAllowance,
        savedMins: acc.savedMins + r.metrics.savedMins,
      }),
      {
        daysPresent: 0,
        breaksCount: 0,
        entitledMins: 0,
        usedMins: 0,
        differenceMins: 0,
        overtimeMins: 0,
        daysOverAllowance: 0,
        savedMins: 0,
      }
    );

  const morningWeekTotals = useMemo(
    () => sumMetrics(weeklyEmployeeRows.filter((r) => r.staff.shift === 'Morning')),
    [weeklyEmployeeRows]
  );
  const nightWeekTotals = useMemo(
    () => sumMetrics(weeklyEmployeeRows.filter((r) => r.staff.shift === 'Night')),
    [weeklyEmployeeRows]
  );
  const grandWeekTotals = useMemo(() => sumMetrics(weeklyEmployeeRows), [weeklyEmployeeRows]);

  // Top 5 employees by overtime in selected week
  const top5Overtime = useMemo(() => {
    return [...weeklyEmployeeRows]
      .filter((r) => r.metrics.overtimeMins > 0)
      .sort((a, b) => b.metrics.overtimeMins - a.metrics.overtimeMins)
      .slice(0, 5);
  }, [weeklyEmployeeRows]);

  // 7-Day breakdown for selected week
  const weekDateStrings = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < 7; i++) {
      list.push(addCalendarDays(selectedWeek.weekStart, i));
    }
    return list;
  }, [selectedWeek.weekStart]);

  const weekDailyBreakdown = useMemo(
    () =>
      buildDailySummaryLinesForDates(
        weekDateStrings,
        staff,
        validWeekLogs,
        shiftFilter,
        kioskSettings
      ),
    [weekDateStrings, staff, validWeekLogs, shiftFilter, kioskSettings]
  );

  // 13-Week Trend data (computed ONLY when trendLoaded === true)
  const trend13WeeksData = useMemo(() => {
    if (!trendLoaded) return [];
    const allValid = (logs || []).filter((l) => l && !l.voided && !l.deleted && !l.testMode);
    return [...weeks13].reverse().map((w) => {
      const dates: string[] = [];
      for (let i = 0; i < 7; i++) {
        dates.push(addCalendarDays(w.weekStart, i));
      }
      const summary = buildDailySummaryLinesForDates(
        dates,
        staff,
        allValid,
        shiftFilter,
        kioskSettings
      );
      return {
        week: w,
        ...summary.totals,
      };
    });
  }, [trendLoaded, weeks13, logs, staff, shiftFilter, kioskSettings]);

  const handleExportWeekCsv = async () => {
    let csv =
      'Week Range,Employee ID,Employee Name,Shift,Days Present,Entitled (Mins),Used (Mins),Difference (Entitled - Used Mins),Overtime (Daily Rule Mins),Days Over Allowance,Saved Minutes\n';
    weeklyEmployeeRows.forEach((r) => {
      const m = r.metrics;
      csv += `${sanitizeCsvCell(selectedWeek.label)},${sanitizeCsvCell(
        r.staff.empId
      )},${sanitizeCsvCell(r.staff.name)},${sanitizeCsvCell(r.staff.shift)},${m.daysPresent},${
        m.entitledMins
      },${m.usedMins},${m.differenceMins},${m.overtimeMins},${m.daysOverAllowance},${
        m.savedMins
      }\n`;
    });
    csv += `${sanitizeCsvCell('WEEK GRAND TOTAL')},"","",${sanitizeCsvCell(shiftFilter)},${
      grandWeekTotals.daysPresent
    },${grandWeekTotals.entitledMins},${grandWeekTotals.usedMins},${
      grandWeekTotals.differenceMins
    },${grandWeekTotals.overtimeMins},${grandWeekTotals.daysOverAllowance},${
      grandWeekTotals.savedMins
    }\n`;

    await downloadOrShareFile(
      `Washmen_Weekly_Report_${selectedWeek.weekStart}_to_${selectedWeek.weekEnd}.csv`,
      csv,
      'text/csv;charset=utf-8;',
      false
    );
    showToast(`Exported Weekly Report CSV (${selectedWeek.label})`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Week Selector & Cost-Control Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E4E7F2] shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-[#EEECFB] text-[#4D3FDC] text-xs font-extrabold mb-1">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Weekly Report (Last 13 Weeks • Starts on {weekStartDay})</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#171262]">
              Weekly Break Summary — {selectedWeek.label}
            </h2>
            <p className="text-xs text-[#5C5A85] mt-0.5">
              Range: <strong className="font-mono text-[#171262]">{selectedWeek.weekStart}</strong>{' '}
              to <strong className="font-mono text-[#171262]">{selectedWeek.weekEnd}</strong> • Need
              records older than 13 weeks?{' '}
              <button
                type="button"
                onClick={onNavigateToMonthlyTab}
                className="text-[#4D3FDC] font-extrabold underline cursor-pointer"
              >
                Open Monthly Report tab
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              disabled={selectedWeekIdx >= weeks13.length - 1}
              onClick={() => setSelectedWeekIdx((i) => Math.min(weeks13.length - 1, i + 1))}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[#F8F9FE] border border-[#D5D0F9] text-[#171262] disabled:opacity-40 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Older Week</span>
            </button>
            <select
              value={selectedWeekIdx}
              onChange={(e) => setSelectedWeekIdx(Number(e.target.value))}
              className="min-h-[42px] bg-[#F8F9FE] border-2 border-[#D5D0F9] rounded-xl px-3 py-2 text-xs font-black text-[#171262]"
            >
              {weeks13.map((w) => (
                <option key={w.weekKey} value={w.index}>
                  {w.index === 0 ? `This Week (${w.label})` : `Week -${w.index}: ${w.label}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={selectedWeekIdx <= 0}
              onClick={() => setSelectedWeekIdx((i) => Math.max(0, i - 1))}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[#F8F9FE] border border-[#D5D0F9] text-[#171262] disabled:opacity-40 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Newer Week</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedWeekIdx(0)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#251B7C] text-white font-bold text-xs cursor-pointer"
            >
              This week
            </button>
            <button
              type="button"
              onClick={handleRefreshWeek}
              className="min-h-[42px] px-3 py-2 rounded-xl bg-white border border-[#D5D0F9] text-[#4D3FDC] font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleExportWeekCsv}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Cost Control & Cache Status Bar */}
        <div className="bg-[#F8F9FE] px-4 py-2.5 rounded-2xl border border-[#E4E7F2] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-[#171262]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Records loaded: {weekLogsState.logs.length}</span>
            <span>•</span>
            <span className="text-[#4D3FDC]">
              {weekLogsState.fromCache
                ? 'Served from 60-min local/IndexedDB cache (0 Firestore reads)'
                : selectedWeek.isCurrentWeek
                ? 'Live current-week data merged'
                : 'Loaded & cached for 60 minutes'}
            </span>
          </div>
          <span className="text-[11px] text-[#5C5A85] font-medium">
            Data-use note: Past weeks (&gt;2 days old) cache in IndexedDB for 60 mins to keep daily
            Firestore reads well within the 50,000 free-tier limit.
          </span>
        </div>

        {/* Filter & Top 5 Overtime */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 print:hidden">
            <span className="text-xs font-extrabold text-[#5C5A85] uppercase">Shift Filter:</span>
            {(['All', 'Morning', 'Night'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setShiftFilter(f)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                  shiftFilter === f
                    ? 'bg-[#4D3FDC] text-white border-[#4D3FDC]'
                    : 'bg-white text-[#5C5A85] border-[#E4E7F2]'
                }`}
              >
                {f === 'All' ? 'All Shifts' : `${f} Shift`}
              </button>
            ))}
          </div>

          {top5Overtime.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-amber-50 px-3.5 py-2 rounded-2xl border border-amber-300 text-xs">
              <span className="font-black text-amber-950 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Top 5 by Overtime this week:</span>
              </span>
              {top5Overtime.map((item, idx) => (
                <span
                  key={item.staff.id}
                  className="px-2.5 py-0.5 rounded-lg bg-white border border-amber-300 font-bold text-amber-950"
                >
                  #{idx + 1} {item.staff.name}: +{item.metrics.overtimeMins}m
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Selected Week Employee Table */}
        <div className="overflow-x-auto rounded-2xl border border-[#E4E7F2]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#251B7C] text-white uppercase text-[11px] font-extrabold">
                <th className="py-3 px-3 sticky left-0 z-10 bg-[#251B7C] min-w-[165px]">
                  Employee
                </th>
                <th className="py-3 px-2.5">Shift</th>
                <th className="py-3 px-2.5 text-right">Days Present</th>
                <th className="py-3 px-2.5 text-right">Entitled Mins</th>
                <th className="py-3 px-2.5 text-right">Used Mins</th>
                <th className="py-3 px-2.5 text-right">Difference (Entitled − Used)</th>
                <th className="py-3 px-2.5 text-right">Overtime Mins</th>
                <th className="py-3 px-2.5 text-right">Days Over Allowance</th>
                <th className="py-3 px-2.5 text-right">Saved Minutes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7F2] bg-white">
              {weeklyEmployeeRows.map(({ staff: st, metrics: m }) => (
                <tr key={st.id} className="hover:bg-[#F8F9FE]">
                  <td className="py-2.5 px-3 sticky left-0 z-10 bg-white border-r border-[#E4E7F2]">
                    <div className="font-black text-[#171262]">{st.name}</div>
                    <div className="text-[11px] font-mono text-[#5C5A85]">ID: #{st.empId}</div>
                  </td>
                  <td className="py-2.5 px-2.5 font-bold">{st.shift}</td>
                  <td className="py-2.5 px-2.5 text-right font-mono font-bold">{m.daysPresent}</td>
                  <td className="py-2.5 px-2.5 text-right font-mono">{m.entitledMins} min</td>
                  <td className="py-2.5 px-2.5 text-right font-mono font-black text-[#171262]">
                    {m.usedMins} min
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono font-bold">
                    {m.differenceMins >= 0 ? `+${m.differenceMins} min` : `${m.differenceMins} min`}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono">
                    {m.overtimeMins > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 font-black">
                        +{m.overtimeMins} min
                      </span>
                    ) : (
                      <span className="text-slate-400">0 min</span>
                    )}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono">{m.daysOverAllowance}</td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-emerald-700 font-bold">
                    {m.savedMins} min
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#F8F9FE] border-t-2 border-[#D5D0F9] font-black text-xs">
              {shiftFilter === 'All' && (
                <>
                  <tr className="border-b border-[#E4E7F2]">
                    <td className="py-2.5 px-3 sticky left-0 bg-[#F8F9FE]">Morning Shift Total</td>
                    <td className="py-2.5 px-2.5">Morning</td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {morningWeekTotals.daysPresent}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {morningWeekTotals.entitledMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {morningWeekTotals.usedMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {morningWeekTotals.differenceMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-amber-900">
                      {morningWeekTotals.overtimeMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {morningWeekTotals.daysOverAllowance}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-emerald-700">
                      {morningWeekTotals.savedMins} min
                    </td>
                  </tr>
                  <tr className="border-b border-[#E4E7F2]">
                    <td className="py-2.5 px-3 sticky left-0 bg-[#F8F9FE]">Night Shift Total</td>
                    <td className="py-2.5 px-2.5">Night</td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {nightWeekTotals.daysPresent}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {nightWeekTotals.entitledMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {nightWeekTotals.usedMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {nightWeekTotals.differenceMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-amber-900">
                      {nightWeekTotals.overtimeMins} min
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono">
                      {nightWeekTotals.daysOverAllowance}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono text-emerald-700">
                      {nightWeekTotals.savedMins} min
                    </td>
                  </tr>
                </>
              )}
              <tr className="bg-[#EEECFB] text-[#171262]">
                <td className="py-3 px-3 sticky left-0 bg-[#EEECFB]">WEEK GRAND TOTAL</td>
                <td className="py-3 px-2.5">{shiftFilter}</td>
                <td className="py-3 px-2.5 text-right font-mono">{grandWeekTotals.daysPresent}</td>
                <td className="py-3 px-2.5 text-right font-mono">
                  {grandWeekTotals.entitledMins} min
                </td>
                <td className="py-3 px-2.5 text-right font-mono">{grandWeekTotals.usedMins} min</td>
                <td className="py-3 px-2.5 text-right font-mono">
                  {grandWeekTotals.differenceMins} min
                </td>
                <td className="py-3 px-2.5 text-right font-mono text-amber-950">
                  {grandWeekTotals.overtimeMins} min
                </td>
                <td className="py-3 px-2.5 text-right font-mono">
                  {grandWeekTotals.daysOverAllowance}
                </td>
                <td className="py-3 px-2.5 text-right font-mono text-emerald-800">
                  {grandWeekTotals.savedMins} min
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Day-by-Day Breakdown for Selected Week */}
        <div className="pt-2 space-y-3">
          <h3 className="text-base font-black text-[#171262]">
            Day-by-Day Breakdown ({selectedWeek.label})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
            {weekDailyBreakdown.days.map((d) => {
              const pct =
                d.totalAllowanceMins > 0
                  ? Math.min(100, Math.round((d.totalUsedMins / d.totalAllowanceMins) * 100))
                  : 0;
              return (
                <div
                  key={d.dateStr}
                  className="p-3 rounded-2xl bg-[#F8F9FE] border border-[#E4E7F2] space-y-1.5 text-xs"
                >
                  <div className="font-mono font-black text-[#171262]">{d.dateStr}</div>
                  <div className="text-[11px] text-[#5C5A85] font-semibold">
                    Staff present: <strong>{d.peopleWithBreaks}</strong>
                  </div>
                  <div className="text-[11px] font-bold text-[#171262]">
                    Used: {d.totalUsedMins}m / {d.totalAllowanceMins}m
                  </div>
                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full ${
                        d.overtimeMins > 0 ? 'bg-amber-500' : 'bg-[#4D3FDC]'
                      }`}
                    />
                  </div>
                  <div className="text-[11px] font-bold text-amber-900">
                    Overtime: {d.overtimeMins}m
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3-Month (13-Week) Trend Section (Loaded ONLY on demand after Confirm Card) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#E4E7F2] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-[#171262] flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#4D3FDC]" />
              <span>13-Week (3-Month) Trend</span>
            </h3>
            <p className="text-xs text-[#5C5A85]">
              Compares weekly used minutes, entitled allowance, and daily overtime across all 13
              weeks.
            </p>
          </div>
          {!trendLoaded && !trendConfirmOpen && (
            <button
              type="button"
              onClick={() => setTrendConfirmOpen(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#251B7C] hover:bg-[#1C1466] text-white font-black text-xs cursor-pointer"
            >
              Load 3-month trend
            </button>
          )}
        </div>

        {trendConfirmOpen && !trendLoaded && (
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3 text-xs">
            <div className="font-black text-amber-950 text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-700" />
              <span>Confirm Loading 13-Week (3-Month) Trend</span>
            </div>
            <p className="text-amber-900 font-medium">
              Estimated reads for ~40 employees across 13 weeks: <strong>0 to 1 station sync read</strong> (or ~
              <strong>{Math.max(1, logs.length)} cached log records</strong> in single-field range mode; past weeks reuse the 60-minute IndexedDB cache).
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrendConfirmOpen(false);
                  setTrendLoaded(true);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer"
              >
                Confirm &amp; Load 13-Week Trend
              </button>
              <button
                type="button"
                onClick={() => setTrendConfirmOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-amber-950 font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {trendLoaded && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-[#E4E7F2]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#251B7C] text-white uppercase text-[11px] font-extrabold">
                    <th className="py-2.5 px-3">Week Range</th>
                    <th className="py-2.5 px-3 text-right">Staff-Days</th>
                    <th className="py-2.5 px-3 text-right">Used Mins</th>
                    <th className="py-2.5 px-3 text-right">Allowance Mins</th>
                    <th className="py-2.5 px-3 text-right">Overtime Mins</th>
                    <th className="py-2.5 px-3">Used vs Allowance Bar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7F2]">
                  {trend13WeeksData.map((row) => {
                    const pct =
                      row.totalAllowanceMins > 0
                        ? Math.min(
                            100,
                            Math.round((row.totalUsedMins / row.totalAllowanceMins) * 100)
                          )
                        : 0;
                    return (
                      <tr key={row.week.weekKey} className="hover:bg-[#F8F9FE]">
                        <td className="py-2.5 px-3 font-bold text-[#171262]">
                          {row.week.label} ({row.week.weekStart})
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{row.peopleDays}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {row.totalUsedMins} min
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {row.totalAllowanceMins} min
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-900 font-bold">
                          {row.overtimeMins} min
                        </td>
                        <td className="py-2.5 px-3 min-w-[160px]">
                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full rounded-full ${
                                row.overtimeMins > 0 ? 'bg-amber-500' : 'bg-[#4D3FDC]'
                              }`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Print Credit Line */}
        <div className="hidden print:block pt-4 border-t border-slate-300 text-xs text-slate-700 font-bold">
          Washmen Laundry — Wash &amp; Fold Break Station • {_REPORTS_DEV_META.createdByLabel} (
          {_REPORTS_DEV_META.verificationTitle})
        </div>
      </div>
    </div>
  );
}

interface RecalculateShiftDatesToolCardProps {
  logs: SyncableBreakLog[];
  kioskSettings: KioskSettings;
  loggedInRole: string;
  onApplyRecalculatedLogs: (updatedLogs: SyncableBreakLog[], auditEntries: AuditLogEntry[]) => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export function RecalculateShiftDatesToolCard({
  logs,
  kioskSettings,
  loggedInRole,
  onApplyRecalculatedLogs,
  showToast,
}: RecalculateShiftDatesToolCardProps) {
  const [previewResult, setPreviewResult] = useState<ReturnType<
    typeof previewRecalculateShiftDates
  > | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const handleScanPreview = () => {
    const res = previewRecalculateShiftDates(logs, kioskSettings);
    setPreviewResult(res);
    setConfirmOpen(false);
  };

  const handleConfirmApply = () => {
    const applied = applyRecalculateShiftDatesInBatches(logs, loggedInRole, kioskSettings);
    onApplyRecalculatedLogs(applied.updatedLogs, applied.auditEntries);
    const afterPreview = previewRecalculateShiftDates(applied.updatedLogs, kioskSettings);
    setPreviewResult(afterPreview);
    setConfirmOpen(false);
    showToast(
      `Updated ${applied.updatedCount} log(s) across ${applied.batchCount} batch(es) with audit record`,
      'success'
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-[#D5D0F9] space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-[#171262] text-sm sm:text-base flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#4D3FDC]" />
            <span>Supervisor Tool: Recalculate Shift Dates &amp; Months</span>
          </h3>
          <p className="text-xs text-[#5C5A85] mt-0.5">
            Scans existing logs using <code className="font-mono">getShiftDate(shift, startMs, settings)</code>{' '}
            (Night cut-off: <strong>{kioskSettings.nightDayCutoffTime || '12:00'}</strong> Asia/Dubai).
            Idempotent, batches at most 400 writes per batch, and never deletes or alters voided/test flags.
          </p>
        </div>

        <button
          type="button"
          onClick={handleScanPreview}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#251B7C] hover:bg-[#1C1466] text-white font-black text-xs cursor-pointer"
        >
          Scan &amp; Preview Logs
        </button>
      </div>

      {previewResult && (
        <div className="p-4 rounded-2xl bg-[#F8F9FE] border border-[#E4E7F2] space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-bold text-[#171262]">
              Scanned: <strong>{previewResult.totalScanned}</strong> logs • Would change:{' '}
              <strong className="text-[#4D3FDC]">{previewResult.changedLogs.length}</strong> log(s)
            </div>
            <div className="text-[#5C5A85] font-mono">
              Est. Reads: {previewResult.estimatedReads} • Est. Writes:{' '}
              {previewResult.estimatedWrites} ({previewResult.estimatedBatches} batch
              {previewResult.estimatedBatches === 1 ? '' : 'es'} of ≤400)
            </div>
          </div>

          {previewResult.changedLogs.length === 0 ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                All {previewResult.totalScanned} logs already match the Night shift day rule (0 changes
                needed).
              </span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-[#E4E7F2] max-h-52">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#251B7C] text-white uppercase">
                      <th className="py-2 px-2.5">Employee</th>
                      <th className="py-2 px-2.5">Shift</th>
                      <th className="py-2 px-2.5">Start Time (Dubai)</th>
                      <th className="py-2 px-2.5">Old shiftDate (Month)</th>
                      <th className="py-2 px-2.5">New shiftDate (Month)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7F2] bg-white">
                    {previewResult.changedLogs.slice(0, 15).map((item) => (
                      <tr key={item.log.id}>
                        <td className="py-1.5 px-2.5 font-bold">{item.log.staffName}</td>
                        <td className="py-1.5 px-2.5">{item.log.shift}</td>
                        <td className="py-1.5 px-2.5 font-mono">
                          {formatDubaiTimeShort(item.log.startTime)}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-rose-700">
                          {item.oldShiftDate} ({item.oldMonth})
                        </td>
                        <td className="py-1.5 px-2.5 font-mono font-bold text-emerald-700">
                          {item.newShiftDate} ({item.newMonth})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!confirmOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black cursor-pointer"
                >
                  Review &amp; Apply {previewResult.changedLogs.length} Change(s)...
                </button>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 space-y-2">
                  <div className="font-black text-amber-950">
                    Confirm Batch Update ({previewResult.changedLogs.length} logs in{' '}
                    {previewResult.estimatedBatches} batch(es) of at most 400 writes)
                  </div>
                  <p className="text-amber-900">
                    Estimated reads: {previewResult.estimatedReads} • Estimated writes:{' '}
                    {previewResult.estimatedWrites}. One audit record will be written per batch.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmApply}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer"
                    >
                      Confirm &amp; Apply Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(false)}
                      className="px-3 py-2 rounded-xl bg-white border border-amber-300 text-amber-950 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
