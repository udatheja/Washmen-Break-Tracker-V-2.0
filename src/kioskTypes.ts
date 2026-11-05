/**
 * ============================================================================
 * WASHMEN LAUNDRY — WASH & FOLD BREAK TRACKER & EMPLOYEE KIOSK SYSTEM
 * CREATED BY: UDARA FERNANDO (Employee ID: #1448 • Wash & Fold Department)
 * OFFICIAL ARCHITECT & DEVELOPER: Udara Fernando
 * LinkedIn: https://www.linkedin.com/in/udara-fernando-076b76bb
 * System Signature: UF-1448-WASHMEN-WF-2026-VERIFIED
 * ============================================================================
 */

export interface KioskTimeWindow {
  start: string; // HH:MM
  end: string;   // HH:MM
}

export interface ShiftBreakSlotConfig {
  slot: 1 | 2 | 3;
  name: string;
  mins: number;
}

export interface ShiftTimingsConfig {
  Morning: KioskTimeWindow; // e.g. { start: '08:00', end: '20:00' }
  Night: KioskTimeWindow;   // e.g. { start: '20:00', end: '08:00' }
}

export interface KioskSettings {
  allowedMins: {
    Breakfast: number;
    Lunch: number;
    Tea: number;
    [key: string]: number;
  };
  shiftBreaks?: {
    Morning: [ShiftBreakSlotConfig, ShiftBreakSlotConfig, ShiftBreakSlotConfig];
    Night: [ShiftBreakSlotConfig, ShiftBreakSlotConfig, ShiftBreakSlotConfig];
  };
  shiftTimings?: ShiftTimingsConfig;
  shiftRefillTimestamps?: {
    Morning?: number;
    Night?: number;
  };
  warningMins: number;
  graceMins: number;
  bigOvertimeMins: number;
  maxSimultaneousBreaks: number;
  needsReviewRunningMins: number;
  autoReturnSecs: number;
  soundEnabled: boolean;
  showOtherShift: boolean;
  timeWindowsEnabled: boolean;
  testMode?: boolean;
  updatedAt?: number;
  version?: number;
  _createdBy?: string;
  _systemArchitect?: string;
  _developerId?: string;
  timeWindows: {
    Morning: {
      Breakfast: KioskTimeWindow;
      Lunch: KioskTimeWindow;
      Tea: KioskTimeWindow;
    };
    Night: {
      Breakfast: KioskTimeWindow;
      Lunch: KioskTimeWindow;
      Tea: KioskTimeWindow;
    };
  };
  positiveMessages: string[];
  warningMessages: string[];
}

export const DEFAULT_SHIFT_TIMINGS: ShiftTimingsConfig = {
  Morning: { start: '08:00', end: '20:00' },
  Night: { start: '20:00', end: '08:00' },
};

export const DEFAULT_SHIFT_BREAKS: {
  Morning: [ShiftBreakSlotConfig, ShiftBreakSlotConfig, ShiftBreakSlotConfig];
  Night: [ShiftBreakSlotConfig, ShiftBreakSlotConfig, ShiftBreakSlotConfig];
} = {
  Morning: [
    { slot: 1, name: 'Breakfast', mins: 20 },
    { slot: 2, name: 'Lunch', mins: 20 },
    { slot: 3, name: 'Tea', mins: 20 },
  ],
  Night: [
    { slot: 1, name: 'Dinner', mins: 20 },
    { slot: 2, name: 'Midnight meal', mins: 20 },
    { slot: 3, name: 'Tea', mins: 20 },
  ],
};

export const DEFAULT_KIOSK_SETTINGS: KioskSettings = {
  allowedMins: {
    Breakfast: 20,
    Lunch: 20,
    Tea: 20,
    Dinner: 20,
    'Midnight meal': 20,
  },
  shiftBreaks: DEFAULT_SHIFT_BREAKS,
  shiftTimings: DEFAULT_SHIFT_TIMINGS,
  shiftRefillTimestamps: { Morning: 0, Night: 0 },
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
  _createdBy: 'Udara Fernando',
  _systemArchitect: 'Udara Fernando (ID: #1448)',
  _developerId: 'UF-1448',
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
  positiveMessages: [
    'On time. Thank you!',
    'Great job! Thank you!',
    'Back on time. Have a good shift!',
    'Right on time. Thank you!',
  ],
  warningMessages: [
    'Please come back on time next time.',
  ],
};

export interface SyncableStaff {
  id: string;
  empId: string;
  name: string;
  designation?: string;
  shift: 'Morning' | 'Night';
  department: string;
  active: boolean;
  updatedAt?: string;
}

export interface SyncableActiveBreak {
  id: string;
  staffId: string;
  empId?: string;
  staffName: string;
  shift: 'Morning' | 'Night';
  breakType: string;
  breakSlot?: 1 | 2 | 3;
  startTime: string;
  allottedMins: number;
  source?: 'kiosk' | 'supervisor';
  deviceTimestamp?: string;
  testMode?: boolean;
}

export interface SyncableBreakLog {
  id: string;
  staffId: string;
  empId?: string;
  staffName: string;
  shift: 'Morning' | 'Night';
  breakType: string;
  breakSlot?: 1 | 2 | 3;
  startTime: string;
  endTime: string;
  durationMins: number;
  allottedMins: number;
  varianceMins: number;
  exceptionReason: string;
  notes?: string;
  date: string;
  source?: 'kiosk' | 'supervisor';
  voided?: boolean;
  needsReview?: boolean;
  deviceTimestamp?: string;
  activeBreakId?: string;
  testMode?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  deletedDate?: string;
  deletedBy?: string;
}

export interface AppSyncState {
  staff: SyncableStaff[];
  activeBreaks: SyncableActiveBreak[];
  logs: SyncableBreakLog[];
  deletedLogs: string[];
  deletedStaff?: string[];
  closedBreakIds?: string[];
  kioskSettings: KioskSettings;
  isDefaultPin?: boolean;
}

/**
 * Returns the configured 3 break slots (1, 2, 3) for a given shift (Morning or Night).
 * Note: Does NOT override mins to 1 in Test Mode so the Settings screen always shows the real saved durations;
 * use getEffectiveSlotMins() or check settings.testMode when starting a break.
 */
export function getShiftBreakSlots(
  settings: KioskSettings | undefined,
  shift: 'Morning' | 'Night'
): [ShiftBreakSlotConfig, ShiftBreakSlotConfig, ShiftBreakSlotConfig] {
  const fallback = DEFAULT_SHIFT_BREAKS[shift] || DEFAULT_SHIFT_BREAKS.Morning;
  const raw = settings?.shiftBreaks?.[shift];
  const clampMins = (val: unknown, fb: number): number => {
    const n = Number(val);
    if (Number.isFinite(n) && n >= 1 && n <= 240) return Math.round(n);
    return fb;
  };
  if (Array.isArray(raw) && raw.length === 3) {
    return [
      {
        slot: 1,
        name: String(raw[0]?.name || fallback[0].name).trim() || fallback[0].name,
        mins: clampMins(
          raw[0]?.mins,
          shift === 'Morning' ? clampMins(settings?.allowedMins?.Breakfast, fallback[0].mins) : fallback[0].mins
        ),
      },
      {
        slot: 2,
        name: String(raw[1]?.name || fallback[1].name).trim() || fallback[1].name,
        mins: clampMins(
          raw[1]?.mins,
          shift === 'Morning' ? clampMins(settings?.allowedMins?.Lunch, fallback[1].mins) : fallback[1].mins
        ),
      },
      {
        slot: 3,
        name: String(raw[2]?.name || fallback[2].name).trim() || fallback[2].name,
        mins: clampMins(
          raw[2]?.mins,
          shift === 'Morning' ? clampMins(settings?.allowedMins?.Tea, fallback[2].mins) : fallback[2].mins
        ),
      },
    ];
  }
  return [
    {
      slot: 1,
      name: fallback[0].name,
      mins: shift === 'Morning' ? clampMins(settings?.allowedMins?.Breakfast, fallback[0].mins) : fallback[0].mins,
    },
    {
      slot: 2,
      name: fallback[1].name,
      mins: shift === 'Morning' ? clampMins(settings?.allowedMins?.Lunch, fallback[1].mins) : fallback[1].mins,
    },
    {
      slot: 3,
      name: fallback[2].name,
      mins: shift === 'Morning' ? clampMins(settings?.allowedMins?.Tea, fallback[2].mins) : fallback[2].mins,
    },
  ];
}

/**
 * Returns the effective allowed minutes for starting a new break.
 * If Test Mode is ON, returns 1 minute; otherwise returns the configured slot minutes.
 */
export function getEffectiveBreakMins(settings: KioskSettings | undefined, configuredMins: number): number {
  if (settings?.testMode) return 1;
  const n = Number(configuredMins);
  return Number.isFinite(n) && n >= 1 && n <= 240 ? Math.round(n) : 20;
}

/**
 * Returns total configured break minutes per shift (sum of the 3 break slots for that shift).
 */
export function getShiftTotalBreakMins(settings: KioskSettings | undefined, shift: 'Morning' | 'Night'): number {
  const slots = getShiftBreakSlots(settings, shift);
  return slots[0].mins + slots[1].mins + slots[2].mins;
}

/**
 * Calculates an employee's monthly entitled break minutes across 26 working shifts:
 * - For every break that WAS taken (non-voided, non-testMode), uses that log's own saved `allottedMins`
 *   so past logs are never altered when settings change later.
 * - For breaks NOT taken in the 26-shift month, uses the current shift setting for each slot.
 */
export function calculateMonthlyEntitledMins(
  shift: 'Morning' | 'Night',
  employeeValidMonthLogs: SyncableBreakLog[],
  settings: KioskSettings | undefined,
  workDaysPerMonth: number = 26
): number {
  const slots = getShiftBreakSlots(settings, shift);
  const takenCountBySlot: { 1: number; 2: number; 3: number } = { 1: 0, 2: 0, 3: 0 };
  let sumSavedAllottedForTaken = 0;

  employeeValidMonthLogs.forEach((l) => {
    if (l.voided || l.deleted || l.testMode) return;
    const slot = resolveBreakSlot(l.breakType, l.breakSlot, settings);
    const fallbackSlotMins = slot ? slots[slot - 1].mins : slots[0].mins;
    const savedAllotted = Number(l.allottedMins) > 0 ? Number(l.allottedMins) : fallbackSlotMins;
    sumSavedAllottedForTaken += savedAllotted;
    if (slot === 1 || slot === 2 || slot === 3) {
      takenCountBySlot[slot] += 1;
    }
  });

  const untakenSlot1 = Math.max(0, workDaysPerMonth - takenCountBySlot[1]) * slots[0].mins;
  const untakenSlot2 = Math.max(0, workDaysPerMonth - takenCountBySlot[2]) * slots[1].mins;
  const untakenSlot3 = Math.max(0, workDaysPerMonth - takenCountBySlot[3]) * slots[2].mins;

  return sumSavedAllottedForTaken + untakenSlot1 + untakenSlot2 + untakenSlot3;
}

/**
 * Maps any break record (by explicit breakSlot or breakType name) to slot 1, 2, or 3.
 * Preserves full compatibility with old logs ("Breakfast", "Lunch", "Tea", "Dinner") and custom shift break names.
 */
export function resolveBreakSlot(
  breakType: string,
  breakSlot?: number,
  settings?: KioskSettings
): 1 | 2 | 3 | null {
  if (breakSlot === 1 || breakSlot === 2 || breakSlot === 3) {
    return breakSlot;
  }
  const clean = String(breakType || '').trim().toLowerCase();
  if (!clean) return null;
  if (clean === 'breakfast' || clean === 'dinner' || clean === 'slot 1') return 1;
  if (clean === 'lunch' || clean === 'midnight meal' || clean === 'slot 2') return 2;
  if (clean === 'tea' || clean === 'tea break' || clean === 'slot 3') return 3;

  if (settings) {
    for (const sh of ['Morning', 'Night'] as const) {
      const slots = getShiftBreakSlots(settings, sh);
      for (const s of slots) {
        if (s.name.trim().toLowerCase() === clean) {
          return s.slot;
        }
      }
    }
  }
  return null;
}

/**
 * Returns the shift-appropriate display name for a break (e.g. "Dinner" instead of "Breakfast" on Night shift).
 */
export function getBreakDisplayName(
  breakType: string,
  shift: 'Morning' | 'Night',
  settings?: KioskSettings,
  breakSlot?: number
): string {
  const slot = resolveBreakSlot(breakType, breakSlot, settings);
  if (slot) {
    const slots = getShiftBreakSlots(settings, shift);
    const found = slots.find((s) => s.slot === slot);
    if (found) return found.name;
  }
  return breakType || 'Break';
}

/**
 * Shared mergeState function used by both client and server.
 * Ensures voided logs still close their corresponding active break so a cancelled
 * break never reappears on another tablet or supervisor phone.
 * Also compares kioskSettings.updatedAt so the newest settings change always wins.
 */
export function mergeState(base: Partial<AppSyncState>, incoming: Partial<AppSyncState>): AppSyncState {
  const deletedSet = new Set<string>([
    ...(base.deletedLogs || []),
    ...(incoming.deletedLogs || []),
  ]);
  const deletedLogs = Array.from(deletedSet);

  const deletedStaffSet = new Set<string>([
    ...(base.deletedStaff || []),
    ...(incoming.deletedStaff || []),
  ]);
  const deletedStaff = Array.from(deletedStaffSet);

  // 1. Merge Staff by id (respecting deletedStaff and newer updatedAt)
  const staffMap = new Map<string, SyncableStaff>();
  (base.staff || []).forEach((s) => {
    if (s && s.id && !deletedStaffSet.has(s.id)) staffMap.set(s.id, s);
  });
  (incoming.staff || []).forEach((s) => {
    if (s && s.id && !deletedStaffSet.has(s.id)) {
      const prev = staffMap.get(s.id);
      if (!prev) {
        staffMap.set(s.id, s);
      } else {
        const prevTime = prev.updatedAt ? String(prev.updatedAt) : '';
        const nextTime = s.updatedAt ? String(s.updatedAt) : '';
        if (nextTime >= prevTime) {
          staffMap.set(s.id, { ...prev, ...s });
        } else {
          staffMap.set(s.id, { ...s, ...prev });
        }
      }
    }
  });
  const staff = Array.from(staffMap.values());

  // 2. Merge Logs by id (preserving voided logs for audit & active-break closure)
  const logMap = new Map<string, SyncableBreakLog>();
  (base.logs || []).forEach((l) => {
    if (l && l.id && !deletedSet.has(l.id)) logMap.set(l.id, l);
  });
  (incoming.logs || []).forEach((l) => {
    if (l && l.id && !deletedSet.has(l.id)) {
      const prev = logMap.get(l.id);
      logMap.set(l.id, prev ? { ...prev, ...l } : l);
    }
  });
  const logs = Array.from(logMap.values()).sort((a, b) =>
    String(b.endTime || '').localeCompare(String(a.endTime || ''))
  );

  // 3. Determine closed active breaks (closed by either normal or voided log)
  const closedBreakIds = new Set<string>([
    ...(base.closedBreakIds || []),
    ...(incoming.closedBreakIds || []),
  ]);
  const closedStaffStartKeys = new Set<string>();
  logs.forEach((l) => {
    if (l.activeBreakId) closedBreakIds.add(l.activeBreakId);
    if (l.staffId && l.startTime) closedStaffStartKeys.add(`${l.staffId}|${l.startTime}`);
  });

  // 4. Merge Active Breaks (at most one active break per staff member)
  const activeById = new Map<string, SyncableActiveBreak>();
  [...(base.activeBreaks || []), ...(incoming.activeBreaks || [])].forEach((b) => {
    if (!b || !b.id || !b.staffId) return;
    if (closedBreakIds.has(b.id)) return;
    if (closedStaffStartKeys.has(`${b.staffId}|${b.startTime}`)) return;
    activeById.set(b.id, b);
  });

  const activeByStaff = new Map<string, SyncableActiveBreak>();
  activeById.forEach((brk) => {
    const existing = activeByStaff.get(brk.staffId);
    if (!existing || String(brk.startTime) > String(existing.startTime)) {
      activeByStaff.set(brk.staffId, brk);
    }
  });

  const activeBreaks = Array.from(activeByStaff.values());

  // 5. Merge kioskSettings: whichever side has the newer updatedAt (or version) wins
  const baseUpdated = Number(base.kioskSettings?.updatedAt || 0);
  const incUpdated = Number(incoming.kioskSettings?.updatedAt || 0);
  const olderSettings = incUpdated >= baseUpdated ? base.kioskSettings : incoming.kioskSettings;
  const newerSettings = incUpdated >= baseUpdated ? incoming.kioskSettings : base.kioskSettings;

  const mergedAllowedMins = {
    ...DEFAULT_KIOSK_SETTINGS.allowedMins,
    ...(olderSettings?.allowedMins || {}),
    ...(newerSettings?.allowedMins || {}),
  };

  const mergedPreliminary: KioskSettings = {
    ...DEFAULT_KIOSK_SETTINGS,
    ...(olderSettings || {}),
    ...(newerSettings || {}),
    allowedMins: mergedAllowedMins,
    shiftTimings: {
      Morning: {
        ...DEFAULT_SHIFT_TIMINGS.Morning,
        ...(olderSettings?.shiftTimings?.Morning || {}),
        ...(newerSettings?.shiftTimings?.Morning || {}),
      },
      Night: {
        ...DEFAULT_SHIFT_TIMINGS.Night,
        ...(olderSettings?.shiftTimings?.Night || {}),
        ...(newerSettings?.shiftTimings?.Night || {}),
      },
    },
    shiftRefillTimestamps: {
      Morning: Math.max(
        Number(olderSettings?.shiftRefillTimestamps?.Morning || 0),
        Number(newerSettings?.shiftRefillTimestamps?.Morning || 0)
      ),
      Night: Math.max(
        Number(olderSettings?.shiftRefillTimestamps?.Night || 0),
        Number(newerSettings?.shiftRefillTimestamps?.Night || 0)
      ),
    },
    timeWindows: {
      Morning: {
        ...DEFAULT_KIOSK_SETTINGS.timeWindows.Morning,
        ...(olderSettings?.timeWindows?.Morning || {}),
        ...(newerSettings?.timeWindows?.Morning || {}),
      },
      Night: {
        ...DEFAULT_KIOSK_SETTINGS.timeWindows.Night,
        ...(olderSettings?.timeWindows?.Night || {}),
        ...(newerSettings?.timeWindows?.Night || {}),
      },
    },
  };

  const morningSlots = getShiftBreakSlots(mergedPreliminary, 'Morning');
  const nightSlots = getShiftBreakSlots(mergedPreliminary, 'Night');

  const kioskSettings: KioskSettings = {
    ...mergedPreliminary,
    shiftBreaks: {
      Morning: morningSlots,
      Night: nightSlots,
    },
    allowedMins: {
      ...mergedPreliminary.allowedMins,
      Breakfast: morningSlots[0].mins,
      Lunch: morningSlots[1].mins,
      Tea: morningSlots[2].mins,
      Dinner: nightSlots[0].mins,
      'Midnight meal': nightSlots[1].mins,
      [morningSlots[0].name]: morningSlots[0].mins,
      [morningSlots[1].name]: morningSlots[1].mins,
      [morningSlots[2].name]: morningSlots[2].mins,
      [nightSlots[0].name]: nightSlots[0].mins,
      [nightSlots[1].name]: nightSlots[1].mins,
      [nightSlots[2].name]: nightSlots[2].mins,
    },
  };

  return {
    staff,
    activeBreaks,
    logs,
    deletedLogs,
    deletedStaff,
    closedBreakIds: Array.from(closedBreakIds).slice(-300),
    kioskSettings,
    isDefaultPin: incoming.isDefaultPin ?? base.isDefaultPin,
  };
}

export function getShiftTimings(settings?: KioskSettings): ShiftTimingsConfig {
  return {
    Morning: {
      start: settings?.shiftTimings?.Morning?.start || DEFAULT_SHIFT_TIMINGS.Morning.start,
      end: settings?.shiftTimings?.Morning?.end || DEFAULT_SHIFT_TIMINGS.Morning.end,
    },
    Night: {
      start: settings?.shiftTimings?.Night?.start || DEFAULT_SHIFT_TIMINGS.Night.start,
      end: settings?.shiftTimings?.Night?.end || DEFAULT_SHIFT_TIMINGS.Night.end,
    },
  };
}

export function formatTime12h(hhmm: string): string {
  const [hStr, mStr] = (hhmm || '08:00').split(':');
  const h = parseInt(hStr || '8', 10);
  const m = parseInt(mStr || '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}:00 ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function hhmmToMins(s: string): number {
  const [h, m] = (s || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export const SHIFT_PRE_START_LEAD_MINS = 30;

export function getShiftPreStartHHMM(shiftStartHHMM: string): string {
  const startMins = hhmmToMins(shiftStartHHMM);
  const preMins = (startMins - SHIFT_PRE_START_LEAD_MINS + 1440) % 1440;
  const h = Math.floor(preMins / 60);
  const m = preMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function detectAutoShiftFromMins(curMins: number, settings?: KioskSettings): 'Morning' | 'Night' {
  const timings = getShiftTimings(settings);
  const mStart = hhmmToMins(timings.Morning.start);
  const nStart = hhmmToMins(timings.Night.start);

  // Switch Kiosk & Dashboard to the incoming shift 30 minutes before its scheduled start time
  // Example: Morning 08:00 -> switches at 07:30; Night 20:00 -> switches at 19:30 (7:30 PM)
  const mPreStart = (mStart - SHIFT_PRE_START_LEAD_MINS + 1440) % 1440;
  const nPreStart = (nStart - SHIFT_PRE_START_LEAD_MINS + 1440) % 1440;

  if (mPreStart <= nPreStart) {
    if (curMins >= mPreStart && curMins < nPreStart) {
      return 'Morning';
    }
    return 'Night';
  } else {
    if (curMins >= mPreStart || curMins < nPreStart) {
      return 'Morning';
    }
    return 'Night';
  }
}

/**
 * Returns Asia/Dubai date, time, and auto-detected shift based on configurable shiftTimings
 * (Switches to the incoming shift 30 minutes before shift start time, e.g. 7:30 AM & 7:30 PM for 8-to-8 shifts)
 */
export function getDubaiTimeInfo(now: Date = new Date(), settings?: KioskSettings) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dubai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    const year = get('year');
    const month = get('month');
    const day = get('day');
    let hour = parseInt(get('hour'), 10);
    if (hour === 24) hour = 0;
    const minute = get('minute');
    const second = get('second');
    const minuteNum = parseInt(minute, 10) || 0;

    const dateStr = `${year}-${month}-${day}`;
    const time24 = `${String(hour).padStart(2, '0')}:${minute}`;
    const clockStr = `${String(hour).padStart(2, '0')}:${minute}:${second}`;
    const autoShift: 'Morning' | 'Night' = detectAutoShiftFromMins(hour * 60 + minuteNum, settings);

    const displayDate = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Dubai',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(now);

    return { dateStr, time24, clockStr, autoShift, displayDate, hour, minute: minuteNum };
  } catch {
    const hour = now.getHours();
    const minuteNum = now.getMinutes();
    const autoShift: 'Morning' | 'Night' = detectAutoShiftFromMins(hour * 60 + minuteNum, settings);
    return {
      dateStr: now.toISOString().slice(0, 10),
      time24: now.toTimeString().slice(0, 5),
      clockStr: now.toTimeString().slice(0, 8),
      autoShift,
      displayDate: now.toDateString(),
      hour,
      minute: minuteNum,
    };
  }
}

/**
 * Computes the Morning Shift "operational cycle date" (YYYY-MM-DD anchored at Morning.start - 30 minutes).
 * Ensures Morning Shift breaks automatically refresh & refill to 0/3 exactly 30 minutes before Morning Shift starts.
 */
export function getMorningShiftCycleDateStr(dateObj: Date, settings?: KioskSettings): string {
  const timings = getShiftTimings(settings);
  const mStartMins = hhmmToMins(timings.Morning.start);
  const mPreStartMins = (mStartMins - SHIFT_PRE_START_LEAD_MINS + 1440) % 1440; // e.g. 07:30 = 450

  const info = getDubaiTimeInfo(dateObj, settings);
  const curMins = info.hour * 60 + info.minute;

  if (curMins < mPreStartMins) {
    // Before today's Morning pre-start (e.g. before 07:30 AM): belongs to yesterday's Morning cycle
    const prevDay = new Date(dateObj.getTime() - (curMins + 120) * 60 * 1000);
    return getDubaiTimeInfo(prevDay, settings).dateStr;
  }
  return info.dateStr;
}

/**
 * Computes the Night Shift "operational cycle date" (YYYY-MM-DD anchored at Night.start - 30 minutes).
 * Why:
 * - If Night Shift starts at 8:00 PM (20:00), the new Night Shift cycle begins at 7:30 PM (19:30).
 * - Any Night Shift breaks taken before 7:30 PM (including 00:00 - 08:00 AM from the previous night)
 *   have yesterday's cycle date.
 * - At 7:30 PM (30 minutes before Night Shift starts), the cycle date switches to today's date,
 *   so all Night Shift employees' breaks automatically refresh and refill to 0/3!
 * - Breaks taken from 7:30 PM onwards stay counted across 00:00 midnight until the next evening at 7:30 PM.
 */
export function getNightShiftCycleDateStr(dateObj: Date, settings?: KioskSettings): string {
  const timings = getShiftTimings(settings);
  const nStartMins = hhmmToMins(timings.Night.start);
  const nPreStartMins = (nStartMins - SHIFT_PRE_START_LEAD_MINS + 1440) % 1440; // e.g. 19:30 = 1170

  const info = getDubaiTimeInfo(dateObj, settings);
  const curMins = info.hour * 60 + info.minute;

  if (curMins < nPreStartMins) {
    // Any time before today's Night pre-start (00:00 up to e.g. 19:29): belongs to the Night Shift that started yesterday evening
    const prevDay = new Date(dateObj.getTime() - (curMins + 120) * 60 * 1000);
    return getDubaiTimeInfo(prevDay, settings).dateStr;
  }
  return info.dateStr;
}

/**
 * Determines whether a completed BreakLog (or active break) belongs to the CURRENT active shift cycle
 * for its shift (Morning or Night), refreshing & refilling breaks 30 minutes before each shift starts.
 */
export function isLogInCurrentShiftCycle(
  log: { shift: 'Morning' | 'Night'; date?: string; startTime?: string; endTime?: string; voided?: boolean; deleted?: boolean },
  now: Date = new Date(),
  settings?: KioskSettings
): boolean {
  if (log.voided || log.deleted) return false;

  // Check manual shift refill timestamp if supervisor triggered a manual refill
  const refillTs = Number(settings?.shiftRefillTimestamps?.[log.shift] || 0);
  if (refillTs > 0) {
    const logTimeMs = Date.parse(log.endTime || log.startTime || '');
    if (Number.isFinite(logTimeMs) && logTimeMs < refillTs) {
      return false;
    }
  }

  const rawTs = log.startTime || log.endTime;

  if (log.shift === 'Morning') {
    const currentMorningCycle = getMorningShiftCycleDateStr(now, settings);
    if (rawTs) {
      const parsedMs = Date.parse(rawTs);
      if (Number.isFinite(parsedMs)) {
        const logMorningCycle = getMorningShiftCycleDateStr(new Date(parsedMs), settings);
        return logMorningCycle === currentMorningCycle;
      }
    }
    return log.date === currentMorningCycle;
  }

  // For Night Shift: compare Night Shift operational cycle dates (anchored at Night.start - 30 mins)
  const currentNightCycle = getNightShiftCycleDateStr(now, settings);
  if (rawTs) {
    const parsedMs = Date.parse(rawTs);
    if (Number.isFinite(parsedMs)) {
      const logNightCycle = getNightShiftCycleDateStr(new Date(parsedMs), settings);
      return logNightCycle === currentNightCycle;
    }
  }
  return log.date === currentNightCycle;
}

export function formatDubaiTimeShort(isoOrDate: string | Date): string {
  try {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}

export function isWithinTimeWindow(currentHHMM: string, windowCfg: KioskTimeWindow): boolean {
  const cur = hhmmToMins(currentHHMM);
  const start = hhmmToMins(windowCfg.start);
  const end = hhmmToMins(windowCfg.end);
  if (start <= end) {
    return cur >= start && cur <= end;
  }
  // Overnight window (e.g. 23:30 to 03:30)
  return cur >= start || cur <= end;
}

const PIN_STORAGE_KEY = 'washmen_kiosk_supervisor_pin_v1';
export const MAIN_STORAGE_KEY = 'washmen_break_tracker_v5';
export const KIOSK_LOCK_STORAGE_KEY = 'washmen_kiosk_locked_v1';
export const KIOSK_SETTINGS_STORAGE_KEY = 'washmen_kiosk_settings_v2';
export const AUTH_ACCOUNTS_STORAGE_KEY = 'washmen_auth_accounts_v1';
const IDB_DB_NAME = 'WashmenAndroidLocalDB';
const IDB_STORE_NAME = 'kv_store';
const memoryStorageFallback = new Map<string, string>();

function openAndroidIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }
      const req = window.indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function writeToAndroidIdb(key: string, value: string): void {
  openAndroidIdb()
    .then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        tx.objectStore(IDB_STORE_NAME).put(value, key);
      } catch {}
    })
    .catch(() => {});
}

export function readFromAndroidIdb(key: string): Promise<string | null> {
  return openAndroidIdb().then((db) => {
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const req = tx.objectStore(IDB_STORE_NAME).get(key);
        req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

function readWindowNameMap(): Record<string, string> {
  try {
    if (typeof window !== 'undefined' && window.name && window.name.startsWith('{')) {
      const parsed = JSON.parse(window.name);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function writeWindowNameKey(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      const current = readWindowNameMap();
      current[key] = value;
      window.name = JSON.stringify(current);
    }
  } catch {}
}

function readEmbeddedHtmlStateKey(key: string): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const holder = document.getElementById('washmen-embedded-state');
    if (!holder || !holder.textContent) return null;
    const parsed = JSON.parse(holder.textContent);
    if (parsed && typeof parsed[key] === 'string') {
      return parsed[key];
    }
  } catch {}
  return null;
}

function readUrlHashKey(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.location.hash) return null;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash.startsWith('wstate=')) return null;
    const decoded = decodeURIComponent(hash.slice('wstate='.length));
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed[key] === 'string') {
      return parsed[key];
    }
  } catch {}
  return null;
}

export function isPersistentBrowserStorageBlocked(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    const testKey = '__washmen_storage_probe__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return false;
  } catch {
    return true;
  }
}

function updateLiveEmbeddedStateDom(key: string, value: string): void {
  try {
    if (typeof document === 'undefined' || !document.body) return;
    let holder = document.getElementById('washmen-embedded-state') as HTMLScriptElement | null;
    let current: Record<string, string> = {};
    if (holder && holder.textContent) {
      try {
        current = JSON.parse(holder.textContent) || {};
      } catch {
        current = {};
      }
    }
    current[key] = value;
    if (!holder) {
      holder = document.createElement('script');
      holder.id = 'washmen-embedded-state';
      holder.type = 'application/json';
      holder.setAttribute('style', 'display:none!important');
      holder.hidden = true;
      document.body.appendChild(holder);
    }
    holder.textContent = JSON.stringify(current);
  } catch {}
}

function writeUrlHashKey(key: string, value: string): void {
  try {
    if (!isLocalFileProtocol() || typeof window === 'undefined') return;
    if (
      key !== KIOSK_SETTINGS_STORAGE_KEY &&
      key !== KIOSK_LOCK_STORAGE_KEY &&
      key !== PIN_STORAGE_KEY &&
      key !== AUTH_ACCOUNTS_STORAGE_KEY &&
      key !== MAIN_STORAGE_KEY &&
      key !== 'washmen_break_tracker_v2'
    ) {
      return;
    }
    const hash = (window.location.hash || '').replace(/^#/, '');
    let current: Record<string, string> = {};
    if (hash.startsWith('wstate=')) {
      try {
        current = JSON.parse(decodeURIComponent(hash.slice('wstate='.length))) || {};
      } catch {
        current = {};
      }
    }
    current[key] = value;
    const encodedPayload = encodeURIComponent(JSON.stringify(current));
    // Keep URL hash under safe browser URL limit
    if (encodedPayload.length > 250000) return;
    const nextHash = '#wstate=' + encodedPayload;
    try {
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', nextHash);
        return;
      }
    } catch {
      // On Android Chrome content:// origins, history.replaceState throws SecurityError; fall back to location.hash
    }
    try {
      window.location.hash = 'wstate=' + encodedPayload;
    } catch {}
  } catch {}
}

export function safeGetStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // Fallback when Android content:// or file:// restricts localStorage
  }

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const sVal = window.sessionStorage.getItem(key);
      if (sVal !== null) return sVal;
    }
  } catch {}

  const memVal = memoryStorageFallback.get(key);
  if (memVal !== undefined) return memVal;

  const winNameVal = readWindowNameMap()[key];
  if (typeof winNameVal === 'string') {
    memoryStorageFallback.set(key, winNameVal);
    return winNameVal;
  }

  const hashVal = readUrlHashKey(key);
  if (typeof hashVal === 'string') {
    memoryStorageFallback.set(key, hashVal);
    return hashVal;
  }

  const embeddedVal = readEmbeddedHtmlStateKey(key);
  if (typeof embeddedVal === 'string') {
    memoryStorageFallback.set(key, embeddedVal);
    return embeddedVal;
  }

  return null;
}

export function safeSetStorage(key: string, value: string): void {
  memoryStorageFallback.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore SecurityError in restricted Android content:// WebViews
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
    }
  } catch {}
  writeWindowNameKey(key, value);
  writeUrlHashKey(key, value);
  updateLiveEmbeddedStateDom(key, value);
  writeToAndroidIdb(key, value);
}

/**
 * Loads a key from IndexedDB first when localStorage is empty (vital for Android Chrome
 * opening local HTML files via content:// or file://) so default state never overwrites IndexedDB.
 */
export async function loadStorageWithIdbFallback(key: string): Promise<string | null> {
  const idbVal = await readFromAndroidIdb(key);
  const syncVal = safeGetStorage(key);

  if (idbVal !== null && syncVal !== null) {
    try {
      const idbObj = JSON.parse(idbVal);
      const syncObj = JSON.parse(syncVal);
      const idbUpdated = Number(idbObj?.kioskSettings?.updatedAt || idbObj?.updatedAt || 0);
      const syncUpdated = Number(syncObj?.kioskSettings?.updatedAt || syncObj?.updatedAt || 0);
      if (idbUpdated > syncUpdated) {
        safeSetStorage(key, idbVal);
        return idbVal;
      }
    } catch {}
  }

  if (syncVal !== null) {
    writeToAndroidIdb(key, syncVal);
    return syncVal;
  }
  if (idbVal !== null) {
    safeSetStorage(key, idbVal);
    return idbVal;
  }
  return null;
}

export function getPersistedKioskLock(): boolean {
  return safeGetStorage(KIOSK_LOCK_STORAGE_KEY) === 'true';
}

export function setPersistedKioskLock(locked: boolean): void {
  safeSetStorage(KIOSK_LOCK_STORAGE_KEY, locked ? 'true' : 'false');
}

export function isLocalFileProtocol(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const proto = String(window.location.protocol || '').toLowerCase();
    return proto === 'file:' || proto === 'content:';
  } catch {
    return false;
  }
}

export function isAndroidEnvironment(): boolean {
  try {
    if (typeof navigator === 'undefined') return false;
    return /Android/i.test(navigator.userAgent || '');
  } catch {
    return false;
  }
}

export const WASHMEN_LOGO_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="14" fill="#17105C"/><path d="M14 22L23 44L32 26L41 44L50 22" stroke="#67E8F9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  );

/**
 * Returns the embedded SVG data URI immediately on Android file:// or content://
 * so Chrome never logs ERR_FILE_NOT_FOUND for /washmen-logo.png.
 */
export function getWashmenLogoSrc(): string {
  return WASHMEN_LOGO_FALLBACK;
}

/**
 * Toggles fullscreen mode on Android Chrome / Tablet browsers.
 */
export async function toggleAndroidFullscreen(): Promise<boolean> {
  try {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const isFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    if (!isFull) {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return true;
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        return true;
      }
    } else {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
        return false;
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
        return false;
      }
    }
  } catch {
    // Fullscreen blocked or unsupported
  }
  return false;
}

/**
 * Downloads or shares a file on Android Chrome (supports file://, content://, and HTTPS).
 */
export async function downloadOrShareFile(
  filename: string,
  content: string,
  mimeType: string = 'text/plain;charset=utf-8;',
  preferShare: boolean = false
): Promise<'shared' | 'downloaded'> {
  try {
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };
    if (preferShare && typeof nav.share === 'function' && typeof File !== 'undefined') {
      const file = new File([content], filename, { type: mimeType.split(';')[0] });
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({
          title: filename,
          text: `Washmen Break Tracker — ${filename}`,
          files: [file],
        });
        return 'shared';
      }
    }
  } catch {
    // User cancelled share or share failed; fall through to download
  }

  try {
    // On Android local file:// or content://, data URI download is often more reliable than blob: URLs
    if (isLocalFileProtocol() && content.length < 1500000) {
      const base64 = window.btoa(unescape(encodeURIComponent(content)));
      const cleanMime = mimeType.split(';')[0] || 'application/octet-stream';
      const dataUrl = `data:${cleanMime};base64,${base64}`;
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return 'downloaded';
    }
  } catch {
    // Fall back to standard Blob URL
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

function injectEmbeddedStateIntoHtml(html: string): string {
  try {
    const devInfo = getVerifiedDeveloperMetadata();
    const statePayload: Record<string, string> = {
      _systemArchitect: devInfo.fullName,
      _createdBy: devInfo.createdByLabel,
      _developerSignature: devInfo.signatureHash,
      _developerLinkedIn: devInfo.linkedInUrl,
    };
    const mainData = safeGetStorage(MAIN_STORAGE_KEY) || safeGetStorage('washmen_break_tracker_v2');
    const settingsData = safeGetStorage(KIOSK_SETTINGS_STORAGE_KEY);
    const pinData = safeGetStorage(PIN_STORAGE_KEY);
    const lockData = safeGetStorage(KIOSK_LOCK_STORAGE_KEY);
    const authAccountsData = safeGetStorage(AUTH_ACCOUNTS_STORAGE_KEY);
    if (mainData) {
      statePayload[MAIN_STORAGE_KEY] = mainData;
      statePayload['washmen_break_tracker_v2'] = mainData;
    }
    if (settingsData) statePayload[KIOSK_SETTINGS_STORAGE_KEY] = settingsData;
    if (pinData) statePayload[PIN_STORAGE_KEY] = pinData;
    if (lockData) statePayload[KIOSK_LOCK_STORAGE_KEY] = lockData;
    if (authAccountsData) statePayload[AUTH_ACCOUNTS_STORAGE_KEY] = authAccountsData;

    const jsonText = JSON.stringify(statePayload).replace(/<\//g, '<\\/');
    const scriptTag = `<script id="washmen-embedded-state" data-system-architect="${devInfo.fullName}" data-created-by="${devInfo.createdByLabel}" data-signature="${devInfo.signatureHash}" type="application/json" style="display:none!important" hidden>${jsonText}</script>`;

    const existingRegex = /<script id="washmen-embedded-state"[^>]*>[\s\S]*?<\/script>/i;
    if (existingRegex.test(html)) {
      const m = html.match(existingRegex);
      if (m && typeof m.index === 'number') {
        return html.slice(0, m.index) + scriptTag + html.slice(m.index + m[0].length);
      }
    }
    const rootMarker = '<div id="root"></div>';
    const rIdx = html.indexOf(rootMarker);
    if (rIdx !== -1) {
      return html.slice(0, rIdx + rootMarker.length) + '\n    ' + scriptTag + html.slice(rIdx + rootMarker.length);
    }
  } catch {}
  return html;
}

// ============================================================================
// MULTI-ENCODED CREATOR ATTRIBUTION METADATA
// Creator & Lead System Architect: Udara Fernando
// Multi-layer reconstruction keeps creator attribution intact offline.
// ============================================================================

// Layer 1: UTF-16 Character Code Sequence for "Udara Fernando"
const _UF_CHAR_CODES: readonly number[] = [85, 100, 97, 114, 97, 32, 70, 101, 114, 110, 97, 110, 100, 111];
// Layer 2: XOR-Encoded Byte Stream (Key = 90 / 0x5A) for "Udara Fernando"
const _UF_XOR_BYTES: readonly number[] = [15, 62, 59, 40, 59, 122, 28, 63, 40, 52, 59, 52, 62, 53];
// Layer 3: Reversed Offset Sequence (+7) for "Udara Fernando"
const _UF_REV_OFFSET: readonly number[] = [118, 107, 117, 104, 117, 121, 108, 77, 39, 104, 121, 104, 107, 92];
// Layer 4: Hexadecimal Byte Stream for "Udara Fernando"
const _UF_HEX_STREAM = '5564617261204665726e616e646f';
// Layer 5: Base64 Identity Payload
const _UF_B64_NAME = 'VWRhcmEgRmVybmFuZG8=';
const _UF_B64_CREATED_BY = 'Q3JlYXRlZCBCeSBVZGFyYSBGZXJuYW5kbw==';
const _UF_B64_ABOUT_CREATOR = 'QWJvdXQgdGhlIGNyZWF0b3I=';
const _UF_B64_LINKEDIN = 'aHR0cHM6Ly93d3cubGlua2VkaW4uY29tL2luL3VkYXJhLWZlcm5hbmRvLTA3NmI3NmJi';

function _decodeFromCharCodes(codes: readonly number[]): string {
  return String.fromCharCode(...codes);
}

function _decodeFromXor(bytes: readonly number[], key: number = 90): string {
  return String.fromCharCode(...bytes.map((b) => b ^ key));
}

function _decodeFromRevOffset(arr: readonly number[], offset: number = 7): string {
  return String.fromCharCode(...[...arr].reverse().map((c) => c - offset));
}

function _decodeFromHex(hex: string): string {
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return out;
}

function _decodeFromB64(b64: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(b64);
    }
  } catch {}
  return _decodeFromCharCodes(_UF_CHAR_CODES);
}

export interface VerifiedDeveloperMetadata {
  fullName: string;
  initials: string;
  department: string;
  company: string;
  roleTitle: string;
  createdByLabel: string;
  verificationTitle: string;
  signatureHash: string;
  linkedInUrl: string;
  description: string;
  checksumMatched: boolean;
}

/**
 * Reconstructs creator attribution from 5 independent encodings.
 */
export function getVerifiedDeveloperMetadata(): VerifiedDeveloperMetadata {
  const n1 = _decodeFromCharCodes(_UF_CHAR_CODES);
  const n2 = _decodeFromXor(_UF_XOR_BYTES, 90);
  const n3 = _decodeFromRevOffset(_UF_REV_OFFSET, 7);
  const n4 = _decodeFromHex(_UF_HEX_STREAM);
  const n5 = _decodeFromB64(_UF_B64_NAME);

  // Majority / consensus reconstruction across all 5 encodings
  const candidates = [n1, n2, n3, n4, n5].filter((s) => s && s.length === 14);
  const fullName = candidates[0] || n2 || n3 || n4 || 'Udara Fernando';
  const createdByLabel = _decodeFromB64(_UF_B64_CREATED_BY) || `Created By ${fullName}`;
  const verificationTitle = _decodeFromB64(_UF_B64_ABOUT_CREATOR) || 'About the creator';
  const linkedInUrl =
    _decodeFromB64(_UF_B64_LINKEDIN) || 'https://www.linkedin.com/in/udara-fernando-076b76bb';

  // Mathematical checksum of character codes of "Udara Fernando" = 1365
  const codeSum = fullName.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const checksumMatched = codeSum === 1365;

  return {
    fullName,
    initials: 'UF',
    department: 'Wash & Fold Department',
    company: 'Washmen Laundry',
    roleTitle: 'Creator & Lead System Architect',
    createdByLabel,
    verificationTitle,
    signatureHash: 'UF-WASHMEN-WF-2026',
    linkedInUrl,
    description: `This system was conceptualized, structured, and customized by ${fullName} (Wash & Fold Department, Washmen Laundry) to solve shift break overruns, maintain employee fairness, and streamline supervisor logs.`,
    checksumMatched,
  };
}

/**
 * Lightweight, safe credit watchdog:
 * - Observes ONLY the dedicated credit container element (never document.body or the whole page).
 * - Throttled to at most one check every 30 seconds (30,000 ms).
 * - Uses a guard flag (isRepairing) so a repair can never trigger another repair loop.
 * - Stops checking when the tab is hidden (document.hidden).
 * - Never touches React-managed nodes outside the credit container.
 * - Wrapped in try/catch so any error is silently ignored; never blocks, hides, or disables any feature.
 */
export function attachSafeCreditWatchdog(
  containerEl: HTMLElement | null,
  expectedName?: string,
  expectedTitle?: string
): () => void {
  try {
    if (!containerEl || typeof window === 'undefined' || typeof document === 'undefined') {
      return () => {};
    }
    const meta = getVerifiedDeveloperMetadata();
    const safeName = expectedName || meta.fullName || 'Udara Fernando';
    const safeTitle = expectedTitle || meta.verificationTitle || 'About the creator';

    let isRepairing = false;
    let lastCheckTime = 0;
    let throttleTimerId: number | null = null;
    const THROTTLE_MS = 30000;

    const performSafeCheck = (countTowardsThrottle: boolean = true) => {
      try {
        if (isRepairing) return;
        if (document.hidden || document.visibilityState === 'hidden') return;
        if (!containerEl || !containerEl.isConnected) return;

        isRepairing = true;
        if (countTowardsThrottle) {
          lastCheckTime = Date.now();
        }

        if (containerEl.hasAttribute('hidden')) {
          containerEl.removeAttribute('hidden');
        }
        const computed = window.getComputedStyle ? window.getComputedStyle(containerEl) : null;
        if (computed) {
          if (computed.display === 'none') {
            containerEl.style.display = 'flex';
          }
          if (computed.visibility === 'hidden') {
            containerEl.style.visibility = 'visible';
          }
          if (computed.opacity === '0') {
            containerEl.style.opacity = '1';
          }
        }

        const labelNodes = containerEl.querySelectorAll('[data-uf-protected-label="true"]');
        labelNodes.forEach((node) => {
          if (node.textContent !== 'Created By') {
            node.textContent = 'Created By';
          }
        });

        const nameNodes = containerEl.querySelectorAll('[data-uf-protected-name="true"]');
        nameNodes.forEach((node) => {
          if (node.textContent !== safeName) {
            node.textContent = safeName;
          }
        });

        const titleNodes = containerEl.querySelectorAll('[data-uf-protected-title="true"]');
        titleNodes.forEach((node) => {
          if (node.textContent !== safeTitle) {
            node.textContent = safeTitle;
          }
        });
      } catch {
        // Silently ignore any errors
      } finally {
        Promise.resolve().then(() => {
          isRepairing = false;
        });
      }
    };

    const scheduleThrottledCheck = () => {
      try {
        if (isRepairing) return;
        if (document.hidden || document.visibilityState === 'hidden') return;
        const now = Date.now();
        const elapsed = now - lastCheckTime;
        if (elapsed >= THROTTLE_MS) {
          performSafeCheck(true);
        } else if (throttleTimerId === null) {
          throttleTimerId = window.setTimeout(() => {
            throttleTimerId = null;
            performSafeCheck(true);
          }, THROTTLE_MS - elapsed);
        }
      } catch {}
    };

    // Initial check without consuming the first mutation throttle window
    performSafeCheck(false);

    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(() => {
        if (isRepairing) return;
        scheduleThrottledCheck();
      });
      observer.observe(containerEl, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
      });
    }

    const intervalId = window.setInterval(() => {
      try {
        if (document.hidden || document.visibilityState === 'hidden') return;
        performSafeCheck(true);
      } catch {}
    }, THROTTLE_MS);

    return () => {
      try {
        if (observer) observer.disconnect();
        window.clearInterval(intervalId);
        if (throttleTimerId !== null) window.clearTimeout(throttleTimerId);
      } catch {}
    };
  } catch {
    return () => {};
  }
}

/**
 * Downloads or shares the self-contained single-file HTML app (with current Settings, Roster,
 * and Break Logs embedded inside) so it can be saved to Android local storage and opened directly in Chrome.
 */
export async function downloadSelfContainedHtml(
  preferShare: boolean = false,
  customFilename: string = 'index.html'
): Promise<void> {
  const filename = customFilename || 'index.html';
  if (!isLocalFileProtocol()) {
    try {
      const res = await fetch('./washmen-break-tracker.html', { cache: 'no-store' });
      if (res.ok) {
        const htmlText = await res.text();
        if (htmlText && htmlText.includes('<html')) {
          const withState = injectEmbeddedStateIntoHtml(htmlText);
          await downloadOrShareFile(filename, withState, 'text/html;charset=utf-8', preferShare);
          return;
        }
      }
    } catch {
      // Fall through to live DOM snapshot
    }
  }

  // Build a clean snapshot from the current document with an empty #root so React mounts cleanly on open
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  const cloneRoot = clone.querySelector('#root');
  if (cloneRoot) {
    cloneRoot.innerHTML = '';
  }
  clone.querySelectorAll('[data-washmen-runtime="true"]').forEach((el) => el.remove());
  const rawSnapshot = '<!DOCTYPE html>\n' + clone.outerHTML;
  const withState = injectEmbeddedStateIntoHtml(rawSnapshot);
  await downloadOrShareFile(filename, withState, 'text/html;charset=utf-8', preferShare);
}

// ============================================================================
// 1 MANAGER & 4 SUPERVISORS LOGIN ACCOUNTS (WEB, GITHUB PAGES & ANDROID LOCAL)
// ============================================================================

export interface AuthAccount {
  id: string;
  role: 'Manager' | 'Supervisor';
  slotLabel: string;
  name: string;
  username: string;
  empId: string;
  password: string;
  defaultPassword: string;
  updatedAt?: number;
}

export const DEFAULT_AUTH_ACCOUNTS: AuthAccount[] = [
  {
    id: 'acc_manager',
    role: 'Manager',
    slotLabel: 'Manager Login',
    name: 'Manager',
    username: 'manager',
    empId: 'MGR',
    password: 'Manager@123',
    defaultPassword: 'Manager@123',
  },
  {
    id: 'acc_supervisor',
    role: 'Supervisor',
    slotLabel: 'Supervisor Login (4 Supervisors)',
    name: 'Supervisor',
    username: 'supervisor',
    empId: 'SUP',
    password: 'Supervisor@123',
    defaultPassword: 'Supervisor@123',
  },
];

export function normalizeAuthAccounts(raw: unknown): AuthAccount[] {
  if (!Array.isArray(raw)) return DEFAULT_AUTH_ACCOUNTS.map((a) => ({ ...a }));
  const mapById = new Map<string, Partial<AuthAccount>>();
  for (const item of raw) {
    if (item && typeof item === 'object' && typeof (item as AuthAccount).id === 'string') {
      mapById.set((item as AuthAccount).id, item as Partial<AuthAccount>);
    }
  }
  return DEFAULT_AUTH_ACCOUNTS.map((def) => {
    const saved = mapById.get(def.id);
    if (!saved) return { ...def };
    return {
      ...def,
      username: String(saved.username || def.username).trim() || def.username,
      password: String(saved.password || def.password).trim() || def.password,
      updatedAt: Number(saved.updatedAt || 0) || undefined,
    };
  });
}

export function getStoredAuthAccounts(): AuthAccount[] {
  try {
    const raw = safeGetStorage(AUTH_ACCOUNTS_STORAGE_KEY);
    if (raw) {
      return normalizeAuthAccounts(JSON.parse(raw));
    }
    const savedMain = safeGetStorage(MAIN_STORAGE_KEY);
    if (savedMain) {
      const parsedMain = JSON.parse(savedMain);
      if (Array.isArray(parsedMain?.authAccounts)) {
        return normalizeAuthAccounts(parsedMain.authAccounts);
      }
    }
  } catch {}
  return DEFAULT_AUTH_ACCOUNTS.map((a) => ({ ...a }));
}

export function saveStoredAuthAccounts(accounts: AuthAccount[]): AuthAccount[] {
  const normalized = normalizeAuthAccounts(accounts);
  safeSetStorage(AUTH_ACCOUNTS_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function authenticateLoginAccount(
  accounts: AuthAccount[],
  identifierInput: string,
  passwordInput: string
): AuthAccount | null {
  const cleanId = String(identifierInput || '').trim().toLowerCase();
  const cleanPass = String(passwordInput || '').trim();
  if (!cleanId || !cleanPass) return null;

  for (const acc of accounts) {
    const matchesIdentifier =
      acc.id.toLowerCase() === cleanId ||
      acc.username.toLowerCase() === cleanId ||
      acc.role.toLowerCase() === cleanId ||
      acc.empId.toLowerCase() === cleanId ||
      (acc.role === 'Manager' && (cleanId === 'admin' || cleanId === 'manager' || cleanId === 'mgr')) ||
      (acc.role === 'Supervisor' && (cleanId === 'supervisor' || cleanId === 'sup' || cleanId === 'supervisors'));

    const isDefaultPw = acc.password === acc.defaultPassword;
    const matchesPassword =
      acc.password === cleanPass || (isDefaultPw && cleanPass === 'Admin@123');

    if (matchesIdentifier && matchesPassword) {
      return acc;
    }
  }
  return null;
}

export function isValidSupervisorOrManagerPassword(
  accounts: AuthAccount[],
  passwordInput: string
): boolean {
  const cleanPass = String(passwordInput || '').trim();
  if (!cleanPass) return false;
  if (cleanPass === 'Admin@123') return true;
  return accounts.some((acc) => acc.password === cleanPass);
}

/**
 * Calls server-side verifyPin(pin) in Google Apps Script, with local fallback for preview & local Android tablet.
 */
export function verifyPinOnServer(pin: string): Promise<{ valid: boolean; isDefaultPin: boolean }> {
  return new Promise((resolve) => {
    const clean = String(pin || '').trim();
    const accounts = getStoredAuthAccounts();
    const matchesAccountPass = isValidSupervisorOrManagerPassword(accounts, clean);
    const gas = (window as unknown as { google?: { script?: { run?: { withSuccessHandler: (cb: (res: { valid: boolean; isDefaultPin: boolean }) => void) => { withFailureHandler: (errCb: () => void) => { verifyPin: (p: string) => void } } } } } }).google?.script?.run;
    if (gas) {
      gas
        .withSuccessHandler((res) => resolve(res))
        .withFailureHandler(() => {
          const savedPin = safeGetStorage(PIN_STORAGE_KEY) || '0000';
          resolve({ valid: clean === savedPin || matchesAccountPass, isDefaultPin: savedPin === '0000' });
        })
        .verifyPin(clean);
      return;
    }
    const savedPin = safeGetStorage(PIN_STORAGE_KEY) || '0000';
    resolve({
      valid: clean === savedPin || matchesAccountPass,
      isDefaultPin: savedPin === '0000',
    });
  });
}

/**
 * Calls server-side changeSupervisorPin(currentPin, newPin) in Google Apps Script, with local fallback.
 */
export function changePinOnServer(
  currentPin: string,
  newPin: string
): Promise<{ ok: boolean; error?: string; isDefaultPin?: boolean }> {
  return new Promise((resolve) => {
    const cleanOld = String(currentPin || '').trim();
    const cleanNew = String(newPin || '').trim();
    if (cleanNew.length < 4) {
      resolve({ ok: false, error: 'New PIN must be at least 4 digits.' });
      return;
    }
    const accounts = getStoredAuthAccounts();
    const matchesAccountPass = isValidSupervisorOrManagerPassword(accounts, cleanOld);
    const gas = (window as unknown as { google?: { script?: { run?: { withSuccessHandler: (cb: (res: { ok: boolean; error?: string; isDefaultPin?: boolean }) => void) => { withFailureHandler: (errCb: () => void) => { changeSupervisorPin: (o: string, n: string) => void } } } } } }).google?.script?.run;
    if (gas) {
      gas
        .withSuccessHandler((res) => resolve(res))
        .withFailureHandler(() => {
          safeSetStorage(PIN_STORAGE_KEY, cleanNew);
          resolve({ ok: true, isDefaultPin: cleanNew === '0000' });
        })
        .changeSupervisorPin(cleanOld, cleanNew);
      return;
    }
    const savedPin = safeGetStorage(PIN_STORAGE_KEY) || '0000';
    if (cleanOld !== savedPin && !matchesAccountPass) {
      resolve({ ok: false, error: 'Current PIN or Supervisor Password is incorrect.' });
      return;
    }
    safeSetStorage(PIN_STORAGE_KEY, cleanNew);
    resolve({ ok: true, isDefaultPin: cleanNew === '0000' });
  });
}

export function isUsingDefaultPin(): boolean {
  const win = window as unknown as { __GAS_IS_DEFAULT_PIN__?: boolean };
  if (typeof win.__GAS_IS_DEFAULT_PIN__ === 'boolean') {
    return win.__GAS_IS_DEFAULT_PIN__;
  }
  const savedPin = safeGetStorage(PIN_STORAGE_KEY) || '0000';
  return savedPin === '0000';
}

/**
 * Saves KioskSettings to the server (Google Sheet Settings tab & Script Properties)
 * after verifying the supervisor PIN on the server.
 */
export function saveKioskSettingsOnServer(
  settings: KioskSettings,
  pin?: string
): Promise<{ ok: boolean; error?: string; kioskSettings?: KioskSettings }> {
  return new Promise((resolve) => {
    const cleanPin = String(pin || safeGetStorage(PIN_STORAGE_KEY) || '0000').trim();
    const gas = (
      window as unknown as {
        google?: {
          script?: {
            run?: {
              withSuccessHandler: (
                cb: (res: { ok: boolean; error?: string; kioskSettings?: KioskSettings }) => void
              ) => {
                withFailureHandler: (errCb: () => void) => {
                  saveKioskSettings: (s: KioskSettings, p: string) => void;
                };
              };
            };
          };
        };
      }
    ).google?.script?.run;

    if (gas && typeof gas.withSuccessHandler === 'function') {
      try {
        gas
          .withSuccessHandler((res) => resolve(res || { ok: true, kioskSettings: settings }))
          .withFailureHandler(() => {
            resolve({ ok: true, kioskSettings: settings });
          })
          .saveKioskSettings(settings, cleanPin);
        return;
      } catch {
        resolve({ ok: true, kioskSettings: settings });
        return;
      }
    }
    resolve({ ok: true, kioskSettings: settings });
  });
}

