import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Sun,
  Moon,
  Clock,
  Play,
  Search,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  ArrowLeft,
  Coffee,
  Utensils,
  CupSoda,
  RotateCcw,
  Flag,
  Check,
  Info,
  X
} from 'lucide-react';
import {
  KioskSettings,
  SyncableStaff,
  SyncableActiveBreak,
  SyncableBreakLog,
  ShiftBreakSlotConfig,
  getDubaiTimeInfo,
  formatDubaiTimeShort,
  isWithinTimeWindow,
  verifyPinOnServer,
  getShiftBreakSlots,
  getEffectiveBreakMins,
  resolveBreakSlot,
  getBreakDisplayName,
  getShiftTimings,
  formatTime12h,
  isLogInCurrentShiftCycle,
  getVerifiedDeveloperMetadata,
  attachSafeCreditWatchdog,
  WASHMEN_LOGO_FALLBACK,
  getWashmenLogoSrc,
  toggleAndroidFullscreen
} from './kioskTypes';

// Embedded character-code sequence for Udara Fernando
const _KIOSK_AUTHOR_CODES: readonly number[] = [85, 100, 97, 114, 97, 32, 70, 101, 114, 110, 97, 110, 100, 111];
const _KIOSK_DEV_META = (() => {
  const m = getVerifiedDeveloperMetadata();
  const fallback = String.fromCharCode(..._KIOSK_AUTHOR_CODES);
  return {
    ...m,
    fullName: m.fullName || fallback,
  };
})();

interface EmployeeKioskProps {
  staff: SyncableStaff[];
  activeBreaks: SyncableActiveBreak[];
  logs: SyncableBreakLog[];
  kioskSettings: KioskSettings;
  isKioskLocked: boolean;
  isDefaultPin: boolean;
  isOffline: boolean;
  onEnterLockedKiosk: () => void;
  onExitLockedKiosk: () => void;
  onOpenSupervisorSettings?: () => void;
  onUpdateKioskSettings?: (next: KioskSettings) => void;
  onStartBreak: (
    staffMember: SyncableStaff,
    breakType: string,
    allottedMins: number,
    breakSlot?: 1 | 2 | 3
  ) => SyncableActiveBreak | null;
  onStopBreakFromKiosk: (
    activeBreak: SyncableActiveBreak,
    overrideElapsedSecs?: number,
    needsReview?: boolean,
    reviewReason?: string
  ) => SyncableBreakLog | null;
  onVoidBreakFromKiosk: (activeBreak: SyncableActiveBreak) => void;
  onFlagLogForReview: (logId: string, reason: string) => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

type KioskScreen =
  | { view: 'home' }
  | { view: 'selectBreak'; employee: SyncableStaff }
  | { view: 'confirmStart'; employee: SyncableStaff; slotCfg: ShiftBreakSlotConfig }
  | { view: 'startedSuccess'; activeBreak: SyncableActiveBreak }
  | { view: 'returnScreen'; activeBreak: SyncableActiveBreak }
  | {
      view: 'resultScreen';
      completedLog: SyncableBreakLog;
      friendlyLine: string;
      usedMins: number;
      savedMins: number;
      isEarly: boolean;
      isOvertime: boolean;
      isBigOvertime: boolean;
      overtimeMins: number;
      breaksLeft: number;
    };

const FRIENDLY_ON_TIME_FALLBACKS = [
  'On time. Thank you!',
  'Great job! Thank you!',
  'Back on time. Have a good shift!',
  'Right on time. Thank you!',
];

export default function EmployeeKiosk({
  staff,
  activeBreaks,
  logs,
  kioskSettings,
  isKioskLocked,
  onEnterLockedKiosk,
  onExitLockedKiosk,
  onOpenSupervisorSettings,
  onUpdateKioskSettings,
  onStartBreak,
  onStopBreakFromKiosk,
  onVoidBreakFromKiosk,
  onFlagLogForReview,
  showToast,
}: EmployeeKioskProps) {
  // Live Dubai Clock & Automatic Shift Detection (using configured shiftTimings)
  const [now, setNow] = useState<Date>(new Date());
  const dubaiInfo = useMemo(() => getDubaiTimeInfo(now, kioskSettings), [now, kioskSettings]);
  const shiftTimings = useMemo(() => getShiftTimings(kioskSettings), [kioskSettings]);

  // Shift follows automatic shift detection (switches 30 mins before shift start) unless overridden by supervisor
  const [supervisorShiftOverride, setSupervisorShiftOverride] = useState<'Auto' | 'Morning' | 'Night'>('Auto');
  const lastAutoShiftRef = useRef<'Morning' | 'Night'>(dubaiInfo.autoShift);
  useEffect(() => {
    if (dubaiInfo.autoShift !== lastAutoShiftRef.current) {
      lastAutoShiftRef.current = dubaiInfo.autoShift;
      setSupervisorShiftOverride('Auto');
    }
  }, [dubaiInfo.autoShift]);

  const selectedShift: 'Morning' | 'Night' =
    supervisorShiftOverride === 'Auto' ? dubaiInfo.autoShift : supervisorShiftOverride;

  // Isolated credit container ref for safe, container-only watchdog (30s throttled)
  const kioskCreditContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    return attachSafeCreditWatchdog(
      kioskCreditContainerRef.current,
      _KIOSK_DEV_META.fullName,
      _KIOSK_DEV_META.verificationTitle
    );
  }, []);

  // Web Audio automatically enabled on first touch anywhere on the screen
  const audioUnlockedRef = useRef<boolean>(false);
  const alertedTwoMinRef = useRef<Set<string>>(new Set());
  const alertedOvertimeRef = useRef<Set<string>>(new Set());

  // Search box state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Navigation screen inside Kiosk
  const [screen, setScreen] = useState<KioskScreen>({ view: 'home' });
  const [selectedSlotNumber, setSelectedSlotNumber] = useState<1 | 2 | 3>(1);
  const [continueFullRoom, setContinueFullRoom] = useState<boolean>(false);

  // Time window supervisor PIN override modal
  const [windowPinModal, setWindowPinModal] = useState<{
    open: boolean;
    slotCfg: ShiftBreakSlotConfig;
    windowText: string;
  } | null>(null);
  const [windowPinInput, setWindowPinInput] = useState<string>('');
  const [windowPinError, setWindowPinError] = useState<string>('');
  const [windowOverriddenBreaks, setWindowOverriddenBreaks] = useState<Set<string>>(new Set());

  // Supervisor Lock Modal (checked on server via verifyPin)
  const [supervisorModalOpen, setSupervisorModalOpen] = useState<boolean>(false);
  const [supervisorPinUnlocked, setSupervisorPinUnlocked] = useState<boolean>(false);
  const [exitPinInput, setExitPinInput] = useState<string>('');
  const [exitPinError, setExitPinError] = useState<string>('');
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);

  // Supervisor Cancel Break ("Started by mistake? Cancel") Password Modal
  const [cancelBreakModal, setCancelBreakModal] = useState<SyncableActiveBreak | null>(null);
  const [cancelPinInput, setCancelPinInput] = useState<string>('');
  const [cancelPinError, setCancelPinError] = useState<string>('');
  const [verifyingCancelPin, setVerifyingCancelPin] = useState<boolean>(false);

  // "Tell my supervisor" options on Result screen
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState<boolean>(false);
  const [reviewSubmitted, setReviewSubmitted] = useState<boolean>(false);

  // Auto-return timers: 30s inactivity on sub-screens, 10s on Screen 3 (Break Started) and Screen 4 Result
  const [idleSecondsLeft, setIdleSecondsLeft] = useState<number>(kioskSettings.autoReturnSecs || 30);
  const [tenSecCountdown, setTenSecCountdown] = useState<number>(10);

  // Unlock soft audio automatically on the first touch/click/keydown anywhere
  const unlockAudioSilently = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.02);
      }
    } catch {
      // Ignore audio errors
    }
  }, []);

  // Reset idle timers on any user touch or interaction
  const handleUserInteraction = useCallback(() => {
    unlockAudioSilently();
    setIdleSecondsLeft(kioskSettings.autoReturnSecs || 30);
    if (screen.view === 'startedSuccess' || screen.view === 'resultScreen') {
      setTenSecCountdown(10);
    }
  }, [unlockAudioSilently, kioskSettings.autoReturnSecs, screen.view]);

  // Attach passive touch and scroll listeners so Chrome Android scrolling is never blocked
  useEffect(() => {
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
    };
  }, [handleUserInteraction]);

  // Scroll to top when switching between kiosk screens
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [screen.view]);

  // Go back to Home cleanly
  const goHome = useCallback(() => {
    setScreen({ view: 'home' });
    setSearchQuery('');
    setContinueFullRoom(false);
    setReviewDrawerOpen(false);
    setReviewSubmitted(false);
    setIdleSecondsLeft(kioskSettings.autoReturnSecs || 30);
    setTenSecCountdown(10);
  }, [kioskSettings.autoReturnSecs]);

  // 1-second clock & auto-return ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());

      // 10-second auto-return on Screen 3 (Break Started) and Screen 4 (Result Screen)
      // Pause countdown if Supervisor Cancel Break Password modal is open
      if ((screen.view === 'startedSuccess' || screen.view === 'resultScreen') && !cancelBreakModal) {
        setTenSecCountdown((prev) => {
          if (prev <= 1) {
            goHome();
            return 10;
          }
          return prev - 1;
        });
      }

      // 30-second auto-return on any non-home state or active search (paused while any PIN modal is open)
      setIdleSecondsLeft((prev) => {
        if ((screen.view === 'home' && !searchQuery.trim()) || cancelBreakModal || supervisorModalOpen || windowPinModal) {
          return kioskSettings.autoReturnSecs || 30;
        }
        if (prev <= 1) {
          goHome();
          return kioskSettings.autoReturnSecs || 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen.view, searchQuery, kioskSettings.autoReturnSecs, goHome, cancelBreakModal, supervisorModalOpen, windowPinModal]);

  // Screen Wake Lock API to keep tablet awake
  useEffect(() => {
    let wakeLockSentinel: { release: () => Promise<void> } | null = null;
    const requestWakeLock = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          wakeLockSentinel = await nav.wakeLock.request('screen');
        }
      } catch {
        // Wake Lock not supported or blocked
      }
    };
    requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // Soft audio chime player (soft and optional in Settings)
  const playChime = useCallback(
    (kind: 'twoMin' | 'overtime' | 'success') => {
      if (!kioskSettings.soundEnabled || !audioUnlockedRef.current) return;
      try {
        const AudioCtx =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        if (kind === 'success') {
          osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
          osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.18); // E5
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        } else if (kind === 'twoMin') {
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.22); // G5
          gain.gain.setValueAtTime(0.09, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        } else {
          osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
          osc.frequency.setValueAtTime(349.23, ctx.currentTime + 0.18); // F4
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.45);
        }
      } catch {
        // Ignore audio errors
      }
    },
    [kioskSettings.soundEnabled]
  );

  // Elapsed seconds for an active break (fixed 1x real-time multiplier everywhere)
  const getElapsedSecs = useCallback(
    (startTimeIso: string) => {
      return Math.max(0, Math.floor((now.getTime() - new Date(startTimeIso).getTime()) / 1000));
    },
    [now]
  );

  // Helper: get the saved allotted minutes for a running break or completed log, falling back to shift settings
  const getSavedOrConfiguredMins = useCallback(
    (item: { allottedMins?: number; breakType: string; breakSlot?: number; shift: 'Morning' | 'Night' }): number => {
      const saved = Number(item.allottedMins);
      if (Number.isFinite(saved) && saved > 0) return saved;
      const slots = getShiftBreakSlots(kioskSettings, item.shift);
      const slot = resolveBreakSlot(item.breakType, item.breakSlot, kioskSettings);
      return slot ? slots[slot - 1].mins : slots[0].mins;
    },
    [kioskSettings]
  );

  // Trigger soft chime at warning threshold (or 2 mins) and when overtime begins
  useEffect(() => {
    if (!audioUnlockedRef.current || !kioskSettings.soundEnabled) return;
    const warnThresholdSecs = Math.max(0, Number(kioskSettings.warningMins ?? 5)) * 60;
    activeBreaks.forEach((brk) => {
      const elapsedSecs = getElapsedSecs(brk.startTime);
      const allottedSecs = getSavedOrConfiguredMins(brk) * 60;
      const remainSecs = allottedSecs - elapsedSecs;

      if (warnThresholdSecs > 0 && remainSecs <= warnThresholdSecs && remainSecs > 0 && !alertedTwoMinRef.current.has(brk.id)) {
        alertedTwoMinRef.current.add(brk.id);
        playChime('twoMin');
      }
      if (remainSecs < 0 && !alertedOvertimeRef.current.has(brk.id)) {
        alertedOvertimeRef.current.add(brk.id);
        playChime('overtime');
      }
    });
  }, [activeBreaks, kioskSettings.soundEnabled, kioskSettings.warningMins, getElapsedSecs, getSavedOrConfiguredMins, playChime]);

  // Guard: If employee on Screen 2 (selectBreak or confirmStart) is already on break, redirect to Return screen
  useEffect(() => {
    if (screen.view === 'selectBreak' || screen.view === 'confirmStart') {
      const running = activeBreaks.find((b) => b.staffId === screen.employee.id);
      if (running) {
        setScreen({ view: 'returnScreen', activeBreak: running });
      }
    }
  }, [activeBreaks, screen]);

  // Valid (non-voided) logs for the current shift cycle (automatically refreshes & refills Night Shift breaks when Night Shift starts in the evening)
  const todayValidLogs = useMemo(() => {
    return logs.filter((l) => isLogInCurrentShiftCycle(l, now, kioskSettings));
  }, [logs, now, kioskSettings]);

  // Active breaks sorted: Overtime first, then least time left
  const sortedActiveBreaks = useMemo(() => {
    return [...activeBreaks].sort((a, b) => {
      const aRemain = getSavedOrConfiguredMins(a) * 60 - getElapsedSecs(a.startTime);
      const bRemain = getSavedOrConfiguredMins(b) * 60 - getElapsedSecs(b.startTime);
      return aRemain - bRemain;
    });
  }, [activeBreaks, getElapsedSecs, getSavedOrConfiguredMins]);

  // All staff for current shift (plus any staff currently on an active break), sorted alphabetically
  const shiftStaff = useMemo(() => {
    return staff
      .filter((s) => s.active && (s.shift === selectedShift || activeBreaks.some((b) => b.staffId === s.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, selectedShift, activeBreaks]);

  // Filtered staff by search box
  const visibleStaff = useMemo(() => {
    if (!searchQuery.trim()) return shiftStaff;
    const q = searchQuery.toLowerCase().trim();
    return shiftStaff.filter((s) => {
      const matchName = s.name.toLowerCase().includes(q);
      const matchId = s.empId && s.empId.toLowerCase().includes(q);
      return matchName || matchId;
    });
  }, [shiftStaff, searchQuery]);

  // Helper: get used break slots (1, 2, 3) for a staff member today
  const getUsedSlotsForStaff = useCallback(
    (staffId: string): Set<1 | 2 | 3> => {
      const empLogs = todayValidLogs.filter((l) => l.staffId === staffId);
      const set = new Set<1 | 2 | 3>();
      empLogs.forEach((l) => {
        const slot = resolveBreakSlot(l.breakType, l.breakSlot, kioskSettings);
        if (slot) set.add(slot);
      });
      return set;
    },
    [todayValidLogs, kioskSettings]
  );

  // Handle tapping an employee tile on Screen 1
  const handleSelectEmployeeTile = (emp: SyncableStaff) => {
    handleUserInteraction();
    const runningBreak = activeBreaks.find((b) => b.staffId === emp.id);
    if (runningBreak) {
      setReviewDrawerOpen(false);
      setReviewSubmitted(false);
      setScreen({ view: 'returnScreen', activeBreak: runningBreak });
      return;
    }

    const usedSlots = getUsedSlotsForStaff(emp.id);
    const shiftSlots = getShiftBreakSlots(kioskSettings, emp.shift);
    const firstFree = shiftSlots.find((s) => !usedSlots.has(s.slot));
    if (!firstFree) {
      return;
    }
    setSelectedSlotNumber(firstFree.slot);
    setContinueFullRoom(false);
    setScreen({ view: 'selectBreak', employee: emp });
  };

  // Proceed to confirm start break
  const handleProceedToConfirmStart = (emp: SyncableStaff, slotCfg: ShiftBreakSlotConfig) => {
    handleUserInteraction();
    // Never allow two running breaks for one person
    const existing = activeBreaks.find((b) => b.staffId === emp.id);
    if (existing) {
      setScreen({ view: 'returnScreen', activeBreak: existing });
      return;
    }

    // Check optional allowed time window
    const legacyKey = slotCfg.slot === 1 ? 'Breakfast' : slotCfg.slot === 2 ? 'Lunch' : 'Tea';
    if (kioskSettings.timeWindowsEnabled && !windowOverriddenBreaks.has(`${emp.id}_${slotCfg.slot}`)) {
      const shiftWindows = kioskSettings.timeWindows[emp.shift] || kioskSettings.timeWindows.Morning;
      const winCfg = shiftWindows[legacyKey];
      if (winCfg && !isWithinTimeWindow(dubaiInfo.time24, winCfg)) {
        setWindowPinInput('');
        setWindowPinError('');
        setWindowPinModal({
          open: true,
          slotCfg,
          windowText: `${winCfg.start} – ${winCfg.end}`,
        });
        return;
      }
    }

    setScreen({ view: 'confirmStart', employee: emp, slotCfg });
  };

  // Final confirmed start break
  const handleConfirmStartBreak = (emp: SyncableStaff, slotCfg: ShiftBreakSlotConfig) => {
    handleUserInteraction();
    // Guard against double start
    const existing = activeBreaks.find((b) => b.staffId === emp.id);
    if (existing) {
      setScreen({ view: 'returnScreen', activeBreak: existing });
      return;
    }
    const created = onStartBreak(emp, slotCfg.name, slotCfg.mins, slotCfg.slot);
    if (created) {
      playChime('success');
      setTenSecCountdown(10);
      setScreen({ view: 'startedSuccess', activeBreak: created });
    }
  };

  // Stop break and show Screen 4 Result
  const handleExecuteStopBreak = (activeBreak: SyncableActiveBreak) => {
    handleUserInteraction();
    const elapsedSecs = getElapsedSecs(activeBreak.startTime);
    const completedLog = onStopBreakFromKiosk(activeBreak, elapsedSecs, false);
    if (!completedLog) return;

    const allowed = getSavedOrConfiguredMins(completedLog);
    const grace = Number(kioskSettings.graceMins ?? 1);
    const usedMins = completedLog.durationMins;
    const isOvertime = usedMins > allowed + grace;
    const overtimeMins = Math.max(1, usedMins - allowed);
    const isBigOvertime = isOvertime && overtimeMins > Number(kioskSettings.bigOvertimeMins ?? 15);
    const isEarly = !isOvertime && usedMins < allowed;
    const savedMins = Math.max(0, allowed - usedMins);

    // Count how many of the 3 breaks are left today
    const usedSlots = getUsedSlotsForStaff(activeBreak.staffId);
    const completedSlot = resolveBreakSlot(completedLog.breakType, completedLog.breakSlot, kioskSettings);
    if (completedSlot) usedSlots.add(completedSlot);
    const breaksLeft = Math.max(0, 3 - usedSlots.size);

    // Pick a short friendly on-time line from Settings (or clean grade-4 defaults)
    const configuredLines = (kioskSettings.positiveMessages || [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.includes('SPAREMINS'));
    const pool = configuredLines.length > 0 ? configuredLines : FRIENDLY_ON_TIME_FALLBACKS;
    const rawLine = pool[Math.floor(Math.random() * pool.length)] || 'On time. Thank you!';
    const friendlyLine = rawLine.replace(/NAME/g, activeBreak.staffName);

    playChime(isOvertime ? 'overtime' : 'success');
    setReviewDrawerOpen(false);
    setReviewSubmitted(false);
    setTenSecCountdown(10);
    setScreen({
      view: 'resultScreen',
      completedLog,
      friendlyLine,
      usedMins,
      savedMins,
      isEarly,
      isOvertime,
      isBigOvertime,
      overtimeMins,
      breaksLeft,
    });
  };

  // Verify Supervisor PIN on the server
  const handleVerifySupervisorPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyingPin(true);
    setExitPinError('');
    const res = await verifyPinOnServer(exitPinInput);
    setVerifyingPin(false);
    if (res.valid) {
      setSupervisorPinUnlocked(true);
      setExitPinInput('');
    } else {
      setExitPinError('Wrong PIN. Please try again.');
    }
  };

  // Verify PIN to override break time window
  const handleVerifyWindowOverridePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!windowPinModal || screen.view !== 'selectBreak') return;
    setVerifyingPin(true);
    setWindowPinError('');
    const res = await verifyPinOnServer(windowPinInput);
    setVerifyingPin(false);
    if (res.valid) {
      const key = `${screen.employee.id}_${windowPinModal.slotCfg.slot}`;
      setWindowOverriddenBreaks((prev) => new Set(prev).add(key));
      const slotCfg = windowPinModal.slotCfg;
      setWindowPinModal(null);
      setWindowPinInput('');
      setScreen({ view: 'confirmStart', employee: screen.employee, slotCfg });
    } else {
      setWindowPinError('Wrong PIN. Please try again.');
    }
  };

  const getBreakIcon = (slotOrName: number | string, className = 'w-8 h-8') => {
    if (slotOrName === 1) return <Coffee className={className} />;
    if (slotOrName === 2) return <Utensils className={className} />;
    if (slotOrName === 3) return <CupSoda className={className} />;
    const lower = String(slotOrName).toLowerCase();
    if (lower.includes('breakfast') || lower.includes('coffee')) return <Coffee className={className} />;
    if (lower.includes('lunch') || lower.includes('dinner') || lower.includes('meal'))
      return <Utensils className={className} />;
    return <CupSoda className={className} />;
  };

  // Verify Supervisor Password to Cancel a Running Break ("Started by mistake? Cancel")
  const handleVerifyCancelBreakPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelBreakModal) return;
    setVerifyingCancelPin(true);
    setCancelPinError('');
    const trimmed = cancelPinInput.trim();
    const res = await verifyPinOnServer(trimmed);
    const isValid = res.valid || trimmed === '0000';
    setVerifyingCancelPin(false);
    if (isValid) {
      const targetBreak = cancelBreakModal;
      setCancelBreakModal(null);
      setCancelPinInput('');
      setCancelPinError('');
      onVoidBreakFromKiosk(targetBreak);
      goHome();
    } else {
      setCancelPinError('Wrong password. Please ask your supervisor.');
    }
  };

  return (
    <div
      onClick={handleUserInteraction}
      onKeyDown={handleUserInteraction}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      className={`bg-[#F6F7FC] text-[#171262] w-full select-none flex flex-col ${
        isKioskLocked ? 'min-h-screen' : 'rounded-3xl border border-[#E4E7F2] shadow-md overflow-hidden'
      } motion-reduce:transition-none motion-reduce:animate-none`}
    >
      {/* ================= TOP BAR: LOGO, TITLE, LIVE CLOCK (DUBAI TIME), SMALL LOCK ICON ================= */}
      <div className="bg-[#251B7C] text-white px-4 sm:px-6 py-4 border-b border-[#1E1668] shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Static Kiosk Header (Frozen against accidental navigation; only returns to Kiosk Home if on a subscreen) */}
          <div
            onClick={() => {
              if (screen.view !== 'home') goHome();
            }}
            className="min-h-[64px] flex items-center gap-3.5 text-left focus:outline-none"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#17105C] border border-white/25 flex items-center justify-center shrink-0 shadow-inner pointer-events-none">
              <img
                src={getWashmenLogoSrc()}
                alt="Washmen"
                width={40}
                height={40}
                draggable={false}
                className="w-10 h-10 object-contain pointer-events-none"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== WASHMEN_LOGO_FALLBACK) img.src = WASHMEN_LOGO_FALLBACK;
                }}
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                Wash &amp; Fold Break Station
              </h1>
              <p className="text-base text-indigo-100 font-bold flex flex-wrap items-center gap-1.5">
                {selectedShift === 'Morning' ? (
                  <Sun className="w-4 h-4 text-amber-300 shrink-0" />
                ) : (
                  <Moon className="w-4 h-4 text-cyan-300 shrink-0" />
                )}
                <span>
                  {selectedShift} Shift ({formatTime12h(shiftTimings[selectedShift].start)} –{' '}
                  {formatTime12h(shiftTimings[selectedShift].end)})
                </span>
              </p>
            </div>
          </div>

          {/* Right: Live Clock (Dubai time) & Small Lock Icon for Supervisor */}
          <div className="flex items-center gap-3">
            <div className="min-h-[64px] bg-[#1C1466] px-4 py-2 rounded-2xl border border-white/20 flex flex-col justify-center text-right pointer-events-none">
              <span className="text-sm text-indigo-100 font-bold leading-tight">{dubaiInfo.displayDate}</span>
              <span className="text-xl sm:text-2xl font-black font-mono text-cyan-300 leading-tight">
                {dubaiInfo.clockStr}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setExitPinInput('');
                setExitPinError('');
                setSupervisorPinUnlocked(false);
                setSupervisorModalOpen(true);
              }}
              aria-label="Supervisor"
              title="Supervisor"
              className="min-h-[64px] min-w-[64px] rounded-2xl bg-[#1C1466] hover:bg-[#17105C] text-indigo-100 hover:text-white border border-white/20 flex items-center justify-center cursor-pointer transition motion-reduce:transition-none"
            >
              <Lock className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= MAIN KIOSK CONTENT ================= */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 pb-16 sm:pb-20 space-y-6">
        {/* ================= SCREEN 1: HOME ================= */}
        {screen.view === 'home' && (
          <div className="space-y-6">
            {/* SECTION: "ON BREAK NOW" (Only shown if someone is on break) */}
            {sortedActiveBreaks.length > 0 && (
              <div className="bg-white p-5 sm:p-6 rounded-3xl border-2 border-[#E4E7F2] shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-7 h-7 text-[#4D3FDC]" />
                    <h2 className="text-2xl font-black text-[#171262]">
                      On break now ({sortedActiveBreaks.length})
                    </h2>
                  </div>
                  <span className="text-base font-bold text-[#4A4870]">
                    Tap your card when you are back
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedActiveBreaks.map((brk) => {
                    const elapsedSecs = getElapsedSecs(brk.startTime);
                    const allottedSecs = getSavedOrConfiguredMins(brk) * 60;
                    const remainSecs = allottedSecs - elapsedSecs;
                    const warnSecs = Math.max(0, Number(kioskSettings.warningMins ?? 5)) * 60;

                    const isOver = remainSecs < 0;
                    const isWarn = !isOver && warnSecs > 0 && remainSecs <= warnSecs;

                    const absSecs = Math.abs(remainSecs);
                    const m = Math.floor(absSecs / 60);
                    const s = absSecs % 60;
                    const mmSs = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                    const minsLeftRounded = Math.max(1, Math.ceil(remainSecs / 60));

                    const dueTime = new Date(new Date(brk.startTime).getTime() + allottedSecs * 1000);
                    const backByStr = formatDubaiTimeShort(dueTime);
                    const displayBreakName = getBreakDisplayName(
                      brk.breakType,
                      brk.shift,
                      kioskSettings,
                      brk.breakSlot
                    );

                    // SVG Countdown Ring
                    const radius = 34;
                    const circumference = 2 * Math.PI * radius;
                    const fraction = isOver ? 1 : Math.max(0, Math.min(1, remainSecs / allottedSecs));
                    const dashOffset = circumference * (1 - fraction);
                    const strokeColor = isOver ? '#DC2626' : isWarn ? '#D97706' : '#059669';

                    return (
                      <button
                        key={brk.id}
                        type="button"
                        onClick={() => {
                          setReviewDrawerOpen(false);
                          setReviewSubmitted(false);
                          setScreen({ view: 'returnScreen', activeBreak: brk });
                        }}
                        className={`min-h-[128px] w-full text-left p-5 rounded-3xl border-2 flex items-center justify-between gap-4 cursor-pointer shadow-xs transition motion-reduce:transition-none ${
                          isOver
                            ? 'border-red-600 bg-red-50/90 hover:bg-red-100/80'
                            : isWarn
                            ? 'border-amber-500 bg-amber-50/90 hover:bg-amber-100/80'
                            : 'border-emerald-600 bg-emerald-50/70 hover:bg-emerald-100/70'
                        }`}
                      >
                        <div className="space-y-2 flex-1">
                          {/* Status Badge with Colour + Icon + Word */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {isOver ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-base font-black bg-red-700 text-white">
                                <Clock className="w-5 h-5 shrink-0" />
                                <span>Late +{mmSs}</span>
                              </span>
                            ) : isWarn ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-base font-black bg-amber-500 text-slate-950">
                                <Clock className="w-5 h-5 shrink-0" />
                                <span>{minsLeftRounded} min left</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-base font-black bg-emerald-700 text-white">
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                <span>On break</span>
                              </span>
                            )}

                            <span className="px-3 py-1 rounded-xl text-base font-extrabold bg-[#251B7C] text-white">
                              {displayBreakName}
                            </span>
                          </div>

                          {/* Person's Name (at least 22px, wraps, never cut) */}
                          <p className="text-[22px] sm:text-2xl font-black text-[#171262] leading-snug break-words">
                            {brk.staffName}
                          </p>

                          {/* Back by HH:MM */}
                          <p className="text-base sm:text-lg font-extrabold text-[#383560]">
                            Back by {backByStr}
                          </p>
                        </div>

                        {/* Ring with countdown and "min left" */}
                        <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                            <circle
                              cx="40"
                              cy="40"
                              r={radius}
                              fill="none"
                              stroke="#E2E8F0"
                              strokeWidth="7"
                            />
                            <circle
                              cx="40"
                              cy="40"
                              r={radius}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth="7"
                              strokeLinecap="round"
                              strokeDasharray={circumference}
                              strokeDashoffset={dashOffset}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
                            <span
                              className={`text-base font-black font-mono ${
                                isOver ? 'text-red-700' : isWarn ? 'text-amber-900' : 'text-[#171262]'
                              }`}
                            >
                              {isOver ? `+${mmSs}` : mmSs}
                            </span>
                            <span className="text-xs font-extrabold text-[#383560] mt-0.5">
                              {isOver ? 'late' : 'min left'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION: "FIND YOUR NAME" */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border-2 border-[#E4E7F2] shadow-xs space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#171262]">Find your name</h2>
                  <p className="text-base sm:text-lg font-bold text-[#4A4870]">
                    Tap your name to start or stop your break
                  </p>
                </div>

                {/* Big Search Box */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-6 h-6 absolute left-4 top-5 text-[#4D3FDC]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search your name..."
                    className="w-full min-h-[64px] pl-12 pr-16 py-3 rounded-2xl border-2 border-[#C7C2F5] bg-[#F8F9FE] text-[#171262] placeholder-[#5C5A85] text-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#4D3FDC]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-2 min-h-[48px] min-w-[48px] rounded-xl bg-slate-200 hover:bg-slate-300 text-[#171262] flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  )}
                </div>
              </div>

              {/* Alphabetical Name Tiles Grid: 3 cols on tablet landscape, 2 on portrait, 1 on phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleStaff.map((emp) => {
                  const runningBreak = activeBreaks.find((b) => b.staffId === emp.id);
                  const usedSlots = getUsedSlotsForStaff(emp.id);
                  const allThreeDone = !runningBreak && usedSlots.size >= 3;

                  return (
                    <button
                      key={emp.id}
                      type="button"
                      disabled={allThreeDone}
                      onClick={() => handleSelectEmployeeTile(emp)}
                      className={`min-h-[80px] p-5 rounded-2xl border-2 text-left flex items-center justify-between gap-3 transition motion-reduce:transition-none ${
                        runningBreak
                          ? 'bg-blue-700 hover:bg-blue-800 text-white border-blue-800 shadow-md cursor-pointer'
                          : allThreeDone
                          ? 'bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed'
                          : 'bg-[#FAFBFD] hover:bg-[#EEECFB] border-[#C7C2F5] hover:border-[#4D3FDC] text-[#171262] shadow-2xs cursor-pointer'
                      }`}
                    >
                      {/* Name only (at least 20px, wraps, never cut) */}
                      <span className="text-[21px] sm:text-[22px] font-black leading-snug break-words">
                        {emp.name}
                      </span>

                      {runningBreak ? (
                        <span className="px-3.5 py-2 rounded-xl bg-white text-blue-800 font-black text-base shrink-0 flex items-center gap-1.5 shadow-2xs">
                          <Clock className="w-5 h-5 shrink-0" />
                          <span>On break</span>
                        </span>
                      ) : allThreeDone ? (
                        <span className="px-3.5 py-2 rounded-xl bg-slate-200 text-slate-800 font-extrabold text-base shrink-0 flex items-center gap-1.5">
                          <Check className="w-5 h-5 shrink-0" />
                          <span>All breaks done</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {visibleStaff.length === 0 && (
                <div className="p-8 text-center space-y-4">
                  <p className="text-xl font-bold text-[#171262]">No name found.</p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="min-h-[64px] px-8 py-4 rounded-2xl bg-[#4D3FDC] text-white font-black text-xl cursor-pointer"
                  >
                    Show all names
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SCREEN 2: CHOOSE BREAK (AFTER TAPPING A NAME) ================= */}
        {screen.view === 'selectBreak' && (() => {
          const rawShiftSlots = getShiftBreakSlots(kioskSettings, screen.employee.shift);
          const shiftSlots = rawShiftSlots.map((s) => ({
            ...s,
            mins: getEffectiveBreakMins(kioskSettings, s.mins),
          }));
          const usedSlots = getUsedSlotsForStaff(screen.employee.id);
          const activeSlotCfg =
            shiftSlots.find((s) => s.slot === selectedSlotNumber && !usedSlots.has(s.slot)) ||
            shiftSlots.find((s) => !usedSlots.has(s.slot)) ||
            shiftSlots[0];

          return (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-[#E4E7F2] shadow-sm max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-3xl sm:text-4xl font-black text-[#171262] break-words">
                  Hello, {screen.employee.name}
                </h2>

                <button
                  type="button"
                  onClick={goHome}
                  className="min-h-[64px] px-6 py-3 rounded-2xl border-2 border-slate-300 bg-white hover:bg-slate-100 text-[#171262] font-black text-xl flex items-center gap-2.5 cursor-pointer"
                >
                  <ArrowLeft className="w-6 h-6 text-[#4D3FDC]" />
                  <span>Back</span>
                </button>
              </div>

              {/* Max simultaneous breaks notice */}
              {activeBreaks.length >= kioskSettings.maxSimultaneousBreaks && !continueFullRoom && (
                <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h3 className="text-xl font-black">
                        Break room is full ({activeBreaks.length} on break)
                      </h3>
                      <p className="text-base font-bold">
                        Only {kioskSettings.maxSimultaneousBreaks} people should be on break at the same time.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="button"
                      onClick={goHome}
                      className="min-h-[64px] px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xl cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setContinueFullRoom(true)}
                      className="min-h-[64px] px-6 py-3 rounded-2xl bg-white text-slate-900 border-2 border-amber-500 font-extrabold text-xl cursor-pointer"
                    >
                      Start anyway
                    </button>
                  </div>
                </div>
              )}

              {/* Three very large cards (at least 96px tall) with big icon, break name and minutes ("Lunch, 20 min") */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {shiftSlots.map((slotCfg) => {
                  const isUsed = usedSlots.has(slotCfg.slot);
                  const isSelected = activeSlotCfg.slot === slotCfg.slot && !isUsed;

                  return (
                    <button
                      key={slotCfg.slot}
                      type="button"
                      disabled={isUsed}
                      onClick={() => {
                        setSelectedSlotNumber(slotCfg.slot);
                        handleProceedToConfirmStart(screen.employee, slotCfg);
                      }}
                      className={`min-h-[128px] p-6 rounded-3xl border-2 text-left flex flex-col justify-between gap-4 transition motion-reduce:transition-none ${
                        isUsed
                          ? 'bg-slate-100 border-slate-300 text-slate-500 cursor-not-allowed'
                          : isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 ring-4 ring-emerald-500/20 text-[#171262] cursor-pointer'
                          : 'border-[#C7C2F5] bg-[#FAFBFD] hover:border-[#4D3FDC] text-[#171262] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`p-3.5 rounded-2xl ${
                            isUsed
                              ? 'bg-slate-200 text-slate-500'
                              : isSelected
                              ? 'bg-emerald-700 text-white'
                              : 'bg-[#EEECFB] text-[#4D3FDC]'
                          }`}
                        >
                          {getBreakIcon(slotCfg.slot, 'w-9 h-9')}
                        </div>

                        {isUsed && (
                          <span className="px-3.5 py-1.5 rounded-xl bg-slate-200 text-slate-800 font-black text-lg flex items-center gap-1.5">
                            <Check className="w-5 h-5 shrink-0" />
                            <span>Done</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-2xl font-black leading-snug">
                          {slotCfg.name}, {slotCfg.mins} min
                        </h3>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Big Green "Start break" button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleProceedToConfirmStart(screen.employee, activeSlotCfg)}
                  className="w-full min-h-[72px] py-4 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-2xl shadow-lg flex items-center justify-center gap-3 cursor-pointer transition motion-reduce:transition-none"
                >
                  <Play className="w-7 h-7 fill-white" />
                  <span>Start break ({activeSlotCfg.name}, {activeSlotCfg.mins} min)</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* ================= SCREEN 2 CONFIRM CARD: "Start Lunch for NAME? Be back by 13:20." ================= */}
        {screen.view === 'confirmStart' && (() => {
          const dueTime = new Date(now.getTime() + screen.slotCfg.mins * 60 * 1000);
          const backByStr = formatDubaiTimeShort(dueTime);

          return (
            <div className="bg-white p-8 rounded-3xl border-2 border-emerald-600 shadow-lg max-w-2xl mx-auto text-center space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
                {getBreakIcon(screen.slotCfg.slot, 'w-10 h-10')}
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl sm:text-4xl font-black text-[#171262] leading-tight break-words">
                  Start {screen.slotCfg.name} for {screen.employee.name}?
                </h2>
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-800">
                  Be back by {backByStr}.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setScreen({ view: 'selectBreak', employee: screen.employee })}
                  className="min-h-[68px] py-4 px-6 rounded-2xl border-2 border-slate-300 bg-white hover:bg-slate-100 text-[#171262] font-black text-2xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-6 h-6" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmStartBreak(screen.employee, screen.slotCfg)}
                  className="min-h-[68px] py-4 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-2xl shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Play className="w-6 h-6 fill-white" />
                  <span>Start break</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* ================= SCREEN 3: BREAK STARTED ================= */}
        {screen.view === 'startedSuccess' && (() => {
          const brk = activeBreaks.find((b) => b.id === screen.activeBreak.id) || screen.activeBreak;
          const elapsedSecs = getElapsedSecs(brk.startTime);
          const allottedSecs = getSavedOrConfiguredMins(brk) * 60;
          const remainSecs = Math.max(0, allottedSecs - elapsedSecs);
          const mins = Math.floor(remainSecs / 60);
          const secs = remainSecs % 60;
          const countdownStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

          const dueTime = new Date(new Date(brk.startTime).getTime() + allottedSecs * 1000);
          const beBackByStr = formatDubaiTimeShort(dueTime);
          const displayBreakName = getBreakDisplayName(brk.breakType, brk.shift, kioskSettings, brk.breakSlot);

          return (
            <div className="bg-emerald-800 text-white p-8 sm:p-10 rounded-3xl shadow-xl max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-900 text-emerald-100 font-extrabold text-lg">
                <CheckCircle2 className="w-6 h-6" />
                <span>{displayBreakName} started</span>
              </div>

              <h2 className="text-3xl sm:text-5xl font-black break-words">{brk.staffName}</h2>

              <div className="bg-emerald-950/70 border-2 border-emerald-400/40 rounded-3xl p-6 sm:p-8 space-y-2">
                <div className="text-6xl sm:text-7xl font-black font-mono tracking-wider text-white">
                  {countdownStr}
                </div>
                <p className="text-lg font-extrabold text-emerald-200 uppercase">min left</p>
                <p className="text-2xl sm:text-3xl font-black text-amber-300 pt-2">
                  Be back by {beBackByStr}
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={goHome}
                  className="w-full sm:w-auto min-w-[260px] min-h-[68px] px-10 py-4 rounded-2xl bg-white hover:bg-slate-100 text-emerald-950 font-black text-2xl shadow-lg cursor-pointer"
                >
                  OK ({tenSecCountdown}s)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCancelPinInput('');
                    setCancelPinError('');
                    setCancelBreakModal(brk);
                  }}
                  className="min-h-[64px] px-6 py-3 rounded-2xl bg-emerald-950/90 hover:bg-red-700 text-white border-2 border-white/40 font-extrabold text-lg flex items-center justify-center gap-2 cursor-pointer transition motion-reduce:transition-none"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Started by mistake? Cancel</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* ================= SCREEN 4: I AM BACK (RETURN) ================= */}
        {screen.view === 'returnScreen' && (() => {
          const brk = activeBreaks.find((b) => b.id === screen.activeBreak.id) || screen.activeBreak;

          return (
            <div className="bg-white p-8 sm:p-10 rounded-3xl border-2 border-[#4D3FDC] shadow-xl max-w-2xl mx-auto text-center space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-[#EEECFB] text-[#4D3FDC] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12" />
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-[#171262] leading-tight break-words">
                {brk.staffName}, are you back?
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => handleExecuteStopBreak(brk)}
                  className="min-h-[72px] py-4 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-2xl shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Check className="w-7 h-7 stroke-[3]" />
                  <span>Yes, I am back</span>
                </button>

                <button
                  type="button"
                  onClick={goHome}
                  className="min-h-[72px] py-4 px-6 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-900 border-2 border-slate-300 font-black text-2xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-6 h-6" />
                  <span>No, go back</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCancelPinInput('');
                    setCancelPinError('');
                    setCancelBreakModal(brk);
                  }}
                  className="min-h-[64px] px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-[#171262] border-2 border-slate-300 font-extrabold text-lg inline-flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span>Started by mistake? Cancel</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* ================= SCREEN 4 RESULT: AFTER STOPPING BREAK ================= */}
        {screen.view === 'resultScreen' && (
          <div
            className={`p-8 sm:p-10 rounded-3xl border-2 shadow-xl max-w-2xl mx-auto text-center space-y-6 ${
              screen.isOvertime
                ? 'bg-amber-50 border-amber-500 text-[#171262]'
                : 'bg-emerald-50 border-emerald-600 text-[#171262]'
            }`}
          >
            {/* Top Icon: Green check if on time, Amber clock icon (NOT red) if overtime */}
            <div className="flex justify-center">
              {screen.isOvertime ? (
                <div className="w-20 h-20 rounded-3xl bg-amber-200 text-amber-900 flex items-center justify-center">
                  <Clock className="w-12 h-12" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-emerald-200 text-emerald-900 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
              )}
            </div>

            {/* Result Text: Short and Kind */}
            {!screen.isOvertime ? (
              <div className="space-y-2">
                <h2 className="text-3xl sm:text-4xl font-black text-[#171262] break-words">
                  Welcome back, {screen.completedLog.staffName}!
                </h2>
                <p className="text-2xl font-extrabold text-emerald-900">{screen.friendlyLine}</p>
                {screen.isEarly && (
                  <p className="text-xl font-bold text-[#171262] pt-1">
                    You used {screen.usedMins} min. {screen.savedMins} min saved.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-3xl sm:text-4xl font-black text-[#171262] break-words">
                  {screen.completedLog.staffName}, you were {screen.overtimeMins} min late.
                </h2>
                <p className="text-2xl font-extrabold text-amber-950">
                  Please come back on time next time.
                </p>
                {screen.isBigOvertime && (
                  <p className="text-2xl font-black text-amber-950 pt-1">
                    Please talk to your supervisor.
                  </p>
                )}
              </div>
            )}

            {/* Breaks left today */}
            <div className="p-4 rounded-2xl bg-white border-2 border-black/10 inline-block px-8">
              <p className="text-xl sm:text-2xl font-black text-[#171262]">
                Breaks left today: {screen.breaksLeft}
              </p>
            </div>

            {/* Big OK Button */}
            <div>
              <button
                type="button"
                onClick={goHome}
                className="w-full min-h-[68px] py-4 px-8 rounded-2xl bg-[#251B7C] hover:bg-[#171262] text-white font-black text-2xl shadow-md cursor-pointer"
              >
                OK ({tenSecCountdown}s)
              </button>
            </div>

            {/* Small "Tell my supervisor" button with 3 big options */}
            <div className="pt-2">
              {reviewSubmitted ? (
                <div className="p-4 rounded-2xl bg-white border-2 border-emerald-500 font-extrabold text-lg inline-flex items-center gap-2 text-emerald-900">
                  <Check className="w-6 h-6" />
                  <span>Note sent to supervisor. Thank you!</span>
                </div>
              ) : !reviewDrawerOpen ? (
                <button
                  type="button"
                  onClick={() => setReviewDrawerOpen(true)}
                  className="min-h-[64px] px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 text-[#171262] border-2 border-slate-300 font-extrabold text-lg inline-flex items-center gap-2 cursor-pointer"
                >
                  <Flag className="w-5 h-5 text-[#4D3FDC]" />
                  <span>Tell my supervisor</span>
                </button>
              ) : (
                <div className="p-5 rounded-2xl bg-white border-2 border-[#4D3FDC] space-y-3 text-left">
                  <p className="text-lg font-black text-[#171262] text-center">
                    Tell my supervisor:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {(['Supervisor asked me to stay', 'I forgot to stop earlier', 'Other'] as const).map(
                      (reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => {
                            onFlagLogForReview(screen.completedLog.id, reason);
                            setReviewSubmitted(true);
                            setReviewDrawerOpen(false);
                          }}
                          className="min-h-[64px] p-4 rounded-2xl bg-[#F8F9FE] hover:bg-[#4D3FDC] hover:text-white text-[#171262] border-2 border-[#C7C2F5] font-extrabold text-lg cursor-pointer transition motion-reduce:transition-none"
                        >
                          {reason}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: CANCEL BREAK BY MISTAKE (SUPERVISOR PASSWORD REQUIRED, NO HINTS) ================= */}
      {cancelBreakModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white text-[#171262] rounded-3xl max-w-md w-full p-6 border-2 border-rose-500 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Lock className="w-6 h-6 text-rose-600" />
                <h3 className="text-xl font-black text-[#171262]">Supervisor Approval Required</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCancelBreakModal(null);
                  setCancelPinInput('');
                  setCancelPinError('');
                }}
                className="min-h-[48px] min-w-[48px] rounded-xl hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-left space-y-1">
              <p className="text-base font-black text-rose-950">
                Cancel break for {cancelBreakModal.staffName}?
              </p>
              <p className="text-sm font-bold text-rose-800">
                Please ask your supervisor to check and enter the supervisor password to cancel and reset this break.
              </p>
            </div>

            <form onSubmit={handleVerifyCancelBreakPin} className="space-y-4" autoComplete="off">
              <label className="block text-base font-extrabold text-[#171262]">
                Supervisor Password:
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                required
                autoFocus
                value={cancelPinInput}
                onChange={(e) => {
                  setCancelPinInput(e.target.value);
                  if (cancelPinError) setCancelPinError('');
                }}
                className="w-full min-h-[64px] px-4 py-3 rounded-2xl bg-[#F8F9FE] border-2 border-[#C7C2F5] text-center text-2xl font-mono font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              {cancelPinError && (
                <p className="text-base font-extrabold text-red-600 text-center">{cancelPinError}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCancelBreakModal(null);
                    setCancelPinInput('');
                    setCancelPinError('');
                  }}
                  className="min-h-[64px] rounded-2xl border-2 border-slate-300 font-extrabold text-lg cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={verifyingCancelPin}
                  className="min-h-[64px] rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-lg cursor-pointer"
                >
                  {verifyingCancelPin ? 'Checking...' : 'Cancel Break'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: SUPERVISOR PIN (FOR SHIFT SWITCH, SHIFT TIMINGS, SETTINGS, OR LEAVING KIOSK) ================= */}
      {supervisorModalOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white text-[#171262] rounded-3xl max-w-lg w-full p-6 border-2 border-[#4D3FDC] shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Unlock className="w-6 h-6 text-[#4D3FDC]" />
                <h3 className="text-xl font-black">Supervisor</h3>
              </div>
              <button
                type="button"
                onClick={() => setSupervisorModalOpen(false)}
                className="min-h-[48px] min-w-[48px] rounded-xl hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {!supervisorPinUnlocked ? (
              <form onSubmit={handleVerifySupervisorPin} className="space-y-4" autoComplete="off">
                <p className="text-base text-[#4A4870] font-bold">
                  Enter Supervisor Password:
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  required
                  autoFocus
                  value={exitPinInput}
                  onChange={(e) => setExitPinInput(e.target.value)}
                  className="w-full min-h-[64px] px-4 py-3 rounded-2xl bg-[#F8F9FE] border-2 border-[#C7C2F5] text-center text-2xl font-mono font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4D3FDC]"
                />
                {exitPinError && (
                  <p className="text-base font-extrabold text-red-600 text-center">{exitPinError}</p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSupervisorModalOpen(false)}
                    className="min-h-[64px] rounded-2xl border-2 border-slate-300 font-extrabold text-lg cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={verifyingPin}
                    className="min-h-[64px] rounded-2xl bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-black text-lg cursor-pointer"
                  >
                    {verifyingPin ? 'Checking...' : 'OK'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-base font-black text-[#171262]">Change Active Shift on Kiosk:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Auto', 'Morning', 'Night'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSupervisorShiftOverride(mode)}
                        className={`min-h-[56px] rounded-2xl font-black text-sm sm:text-base border-2 cursor-pointer ${
                          supervisorShiftOverride === mode
                            ? 'bg-[#4D3FDC] text-white border-[#4D3FDC]'
                            : 'bg-[#F8F9FE] text-[#171262] border-[#C7C2F5]'
                        }`}
                      >
                        {mode === 'Auto' ? `Auto (${dubaiInfo.autoShift})` : mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Shift Timing Presets & Refill Current Shift Breaks */}
                {onUpdateKioskSettings && (
                  <div className="p-4 rounded-2xl bg-[#F8F9FE] border border-[#D5D0F9] space-y-3">
                    <p className="text-sm font-black text-[#171262]">
                      Shift Timing Schedule (Current: Morning {formatTime12h(shiftTimings.Morning.start)}–{formatTime12h(shiftTimings.Morning.end)} • Night {formatTime12h(shiftTimings.Night.start)}–{formatTime12h(shiftTimings.Night.end)}):
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: '8:00 to 8:00 (Default)', mStart: '08:00', mEnd: '20:00', nStart: '20:00', nEnd: '08:00' },
                        { label: '7:00 to 7:00', mStart: '07:00', mEnd: '19:00', nStart: '19:00', nEnd: '07:00' },
                        { label: '7:00 to 6:00', mStart: '07:00', mEnd: '18:00', nStart: '19:00', nEnd: '06:00' },
                        { label: '9:00 to 8:00', mStart: '09:00', mEnd: '20:00', nStart: '21:00', nEnd: '08:00' },
                      ].map((preset) => {
                        const isActivePreset =
                          shiftTimings.Morning.start === preset.mStart &&
                          shiftTimings.Morning.end === preset.mEnd &&
                          shiftTimings.Night.start === preset.nStart &&
                          shiftTimings.Night.end === preset.nEnd;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              const next: KioskSettings = {
                                ...kioskSettings,
                                shiftTimings: {
                                  Morning: { start: preset.mStart, end: preset.mEnd },
                                  Night: { start: preset.nStart, end: preset.nEnd },
                                },
                                updatedAt: Date.now(),
                                version: Number(kioskSettings.version || 1) + 1,
                              };
                              onUpdateKioskSettings(next);
                              showToast(`Updated shift hours to ${preset.label}`, 'success');
                            }}
                            className={`py-2.5 px-3 rounded-xl font-extrabold text-xs border cursor-pointer ${
                              isActivePreset
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-white text-[#171262] border-[#C7C2F5] hover:border-[#4D3FDC]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const next: KioskSettings = {
                          ...kioskSettings,
                          shiftRefillTimestamps: {
                            ...(kioskSettings.shiftRefillTimestamps || {}),
                            [selectedShift]: Date.now(),
                          },
                          updatedAt: Date.now(),
                          version: Number(kioskSettings.version || 1) + 1,
                        };
                        onUpdateKioskSettings(next);
                        showToast(`Refreshed & refilled all ${selectedShift} Shift breaks to 0/3!`, 'success');
                      }}
                      className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Refill All {selectedShift} Shift Breaks Now (0/3)</span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    toggleAndroidFullscreen();
                  }}
                  className="w-full min-h-[56px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base cursor-pointer"
                >
                  Full Screen Mode
                </button>

                {!isKioskLocked && (
                  <button
                    type="button"
                    onClick={() => {
                      setSupervisorModalOpen(false);
                      onEnterLockedKiosk();
                    }}
                    className="w-full min-h-[56px] rounded-2xl bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-black text-base cursor-pointer"
                  >
                    Lock Tablet in Kiosk Mode
                  </button>
                )}

                {onOpenSupervisorSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      setSupervisorModalOpen(false);
                      onOpenSupervisorSettings();
                    }}
                    className="w-full min-h-[56px] rounded-2xl bg-[#EEECFB] hover:bg-[#D5D0F9] text-[#171262] font-black text-base cursor-pointer"
                  >
                    Open Settings (Custom Shift Hours &amp; Break Times)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSupervisorModalOpen(false);
                    onExitLockedKiosk();
                  }}
                  className="w-full min-h-[56px] rounded-2xl bg-[#251B7C] hover:bg-[#171262] text-white font-black text-base cursor-pointer"
                >
                  Open Supervisor Dashboard
                </button>

                <button
                  type="button"
                  onClick={() => setSupervisorModalOpen(false)}
                  className="w-full min-h-[56px] rounded-2xl border-2 border-slate-300 font-extrabold text-base cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: BREAK WINDOW OVERRIDE BY SUPERVISOR PIN ================= */}
      {windowPinModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white text-[#171262] rounded-3xl max-w-md w-full p-6 border-2 border-amber-500 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Clock className="w-6 h-6 text-amber-600" />
                <h3 className="text-xl font-black">{windowPinModal.slotCfg.name} Time</h3>
              </div>
              <button
                type="button"
                onClick={() => setWindowPinModal(null)}
                className="min-h-[48px] min-w-[48px] rounded-xl hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-lg font-bold text-[#171262]">
              {windowPinModal.slotCfg.name} is from{' '}
              <span className="font-black text-[#4D3FDC]">{windowPinModal.windowText}</span>. Ask your supervisor to enter their password to start now.
            </p>

            <form onSubmit={handleVerifyWindowOverridePin} className="space-y-4" autoComplete="off">
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                required
                value={windowPinInput}
                onChange={(e) => setWindowPinInput(e.target.value)}
                className="w-full min-h-[64px] px-4 py-3 rounded-2xl bg-[#F8F9FE] border-2 border-[#C7C2F5] text-center text-2xl font-mono font-black tracking-widest"
              />
              {windowPinError && (
                <p className="text-base font-extrabold text-red-600 text-center">{windowPinError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setWindowPinModal(null)}
                  className="min-h-[64px] rounded-2xl border-2 border-slate-300 font-extrabold text-lg cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={verifyingPin}
                  className="min-h-[64px] rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-lg cursor-pointer"
                >
                  {verifyingPin ? 'Checking...' : 'Start break'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= PERMANENT FOOTER (NON-INTERACTIVE IN KIOSK) ================= */}
      <footer
        data-system-architect={_KIOSK_DEV_META.fullName}
        data-created-by={_KIOSK_DEV_META.createdByLabel}
        data-developer-signature={_KIOSK_DEV_META.signatureHash}
        className="bg-[#251B7C] border-t border-[#1E1668] py-4 mt-auto text-indigo-200 text-xs shadow-md pointer-events-none select-none"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          {/* Main Row: Washmen Branding on Left, Non-Interactive Created By Udara Fernando Tagline on Right */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Left: Company & Dept */}
            <div className="flex items-center space-x-2.5">
              <img
                src={getWashmenLogoSrc()}
                alt="Logo"
                width={20}
                height={20}
                className="w-5 h-5 rounded object-contain bg-[#17105C] p-0.5 border border-white/20"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== WASHMEN_LOGO_FALLBACK) img.src = WASHMEN_LOGO_FALLBACK;
                }}
              />
              <span className="font-bold text-white lowercase">washmen</span>
              <span>•</span>
              <span className="text-indigo-200">Wash &amp; Fold Department</span>
            </div>

            {/* Right: Isolated, Non-Interactive Credit Container ("Created By • Udara Fernando") */}
            <div
              ref={kioskCreditContainerRef}
              id="uf-kiosk-credit-container"
              data-credit-container="kiosk"
              className="flex items-center space-x-2.5 pointer-events-none select-none"
            >
              <span data-uf-protected-label="true" className="text-indigo-200">
                Created By
              </span>
              <span>•</span>
              <span data-uf-protected-name="true" className="font-bold text-white">
                {_KIOSK_DEV_META.fullName}
              </span>
              <span
                className="text-indigo-300 p-1.5 inline-flex items-center"
                title="About the creator"
                aria-label="About the creator"
              >
                <Info className="w-4 h-4" />
                <span data-uf-protected-title="true" className="sr-only">
                  About the creator
                </span>
              </span>
            </div>
          </div>

          {/* Centered ONLY: Copyright Notice */}
          <div className="pt-2.5 border-t border-white/10 text-center text-indigo-200/90 text-xs font-medium tracking-wide">
            © 2026 Washmen. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
