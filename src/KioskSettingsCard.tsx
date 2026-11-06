import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Lock,
  Clock,
  Check,
  AlertTriangle,
  KeyRound,
  Save,
  RotateCcw,
  ExternalLink,
  Sun,
  Moon,
  FlaskConical
} from 'lucide-react';
import {
  KioskSettings,
  DEFAULT_KIOSK_SETTINGS,
  DEFAULT_SHIFT_BREAKS,
  DEFAULT_SHIFT_TIMINGS,
  getShiftBreakSlots,
  getShiftDailyAllowanceMins,
  getShiftTimings,
  formatTime12h,
  changePinOnServer,
  ShiftBreakSlotConfig,
  safeSetStorage,
  getVerifiedDeveloperMetadata,
  KIOSK_SETTINGS_STORAGE_KEY
} from './kioskTypes';

// Embedded character-code verification for Udara Fernando (Emp ID: #1448)
const _SETTINGS_AUTHOR_CODES: readonly number[] = [85, 100, 97, 114, 97, 32, 70, 101, 114, 110, 97, 110, 100, 111];
const _SETTINGS_DEV_META = (() => {
  const m = getVerifiedDeveloperMetadata();
  const fallback = String.fromCharCode(..._SETTINGS_AUTHOR_CODES);
  return {
    ...m,
    fullName: m.fullName || fallback,
  };
})();

interface KioskSettingsCardProps {
  kioskSettings: KioskSettings;
  isDefaultPin: boolean;
  onUpdateKioskSettings: (next: KioskSettings) => void;
  onPinChanged: (isDefault: boolean) => void;
  onEnterLockedKiosk: () => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

const QUICK_MINUTE_PRESETS = [10, 15, 20, 30, 45, 60] as const;

export default function KioskSettingsCard({
  kioskSettings,
  isDefaultPin,
  onUpdateKioskSettings,
  onPinChanged,
  onEnterLockedKiosk,
  showToast,
}: KioskSettingsCardProps) {
  const initialMorning = getShiftBreakSlots(kioskSettings, 'Morning');
  const initialNight = getShiftBreakSlots(kioskSettings, 'Night');
  const initialTimings = getShiftTimings(kioskSettings);

  const [draft, setDraft] = useState<KioskSettings>(() => ({
    ...kioskSettings,
    shiftBreaks: {
      Morning: initialMorning,
      Night: initialNight,
    },
    shiftTimings: initialTimings,
  }));

  // Raw string states for every number input so the user can freely clear/backspace and type any characters
  // before validation runs on Save.
  const [morningNames, setMorningNames] = useState<[string, string, string]>([
    initialMorning[0].name,
    initialMorning[1].name,
    initialMorning[2].name,
  ]);
  const [morningMinsStr, setMorningMinsStr] = useState<[string, string, string]>([
    String(initialMorning[0].mins),
    String(initialMorning[1].mins),
    String(initialMorning[2].mins),
  ]);

  const [nightNames, setNightNames] = useState<[string, string, string]>([
    initialNight[0].name,
    initialNight[1].name,
    initialNight[2].name,
  ]);
  const [nightMinsStr, setNightMinsStr] = useState<[string, string, string]>([
    String(initialNight[0].mins),
    String(initialNight[1].mins),
    String(initialNight[2].mins),
  ]);

  const [morningAllowanceStr, setMorningAllowanceStr] = useState<string>(
    String(getShiftDailyAllowanceMins(kioskSettings, 'Morning'))
  );
  const [nightAllowanceStr, setNightAllowanceStr] = useState<string>(
    String(getShiftDailyAllowanceMins(kioskSettings, 'Night'))
  );

  const [warningMinsStr, setWarningMinsStr] = useState<string>(String(kioskSettings.warningMins ?? 5));
  const [graceMinsStr, setGraceMinsStr] = useState<string>(String(kioskSettings.graceMins ?? 1));
  const [bigOvertimeMinsStr, setBigOvertimeMinsStr] = useState<string>(String(kioskSettings.bigOvertimeMins ?? 15));
  const [needsReviewMinsStr, setNeedsReviewMinsStr] = useState<string>(
    String(kioskSettings.needsReviewRunningMins ?? 90)
  );
  const [maxSimulStr, setMaxSimulStr] = useState<string>(String(kioskSettings.maxSimultaneousBreaks ?? 5));
  const [autoReturnStr, setAutoReturnStr] = useState<string>(String(kioskSettings.autoReturnSecs ?? 30));

  const [positiveText, setPositiveText] = useState<string>(
    (kioskSettings.positiveMessages || DEFAULT_KIOSK_SETTINGS.positiveMessages).join('\n')
  );
  const [warningText, setWarningText] = useState<string>(
    (kioskSettings.warningMessages || DEFAULT_KIOSK_SETTINGS.warningMessages).join('\n')
  );
  const [calmMessageStr, setCalmMessageStr] = useState<string>(
    kioskSettings.calmWithinAllowanceMessage ||
      DEFAULT_KIOSK_SETTINGS.calmWithinAllowanceMessage ||
      'Please try to return on time. Your day total is still within your break time.'
  );
  const [dailyOverMessageStr, setDailyOverMessageStr] = useState<string>(
    kioskSettings.dailyOverAllowanceMessage ||
      DEFAULT_KIOSK_SETTINGS.dailyOverAllowanceMessage ||
      'Your breaks today are N min over your daily break time.'
  );
  const [bigOverSupervisorMessageStr, setBigOverSupervisorMessageStr] = useState<string>(
    kioskSettings.bigOvertimeSupervisorMessage ||
      DEFAULT_KIOSK_SETTINGS.bigOvertimeSupervisorMessage ||
      'Please talk to your supervisor.'
  );

  // Plain-English validation error & saved status banner inside the page
  const [validationError, setValidationError] = useState<string | null>(null);
  const [invalidSlotKeys, setInvalidSlotKeys] = useState<Set<string>>(new Set());
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Track last synced updatedAt so background 10-second polling never wipes out what the user is typing
  const lastSyncedUpdatedAtRef = useRef<number>(Number(kioskSettings.updatedAt || 0));

  useEffect(() => {
    const incomingUpdated = Number(kioskSettings.updatedAt || 0);
    if (incomingUpdated > lastSyncedUpdatedAtRef.current) {
      lastSyncedUpdatedAtRef.current = incomingUpdated;
      const mSlots = getShiftBreakSlots(kioskSettings, 'Morning');
      const nSlots = getShiftBreakSlots(kioskSettings, 'Night');
      const sTimings = getShiftTimings(kioskSettings);
      setDraft({
        ...kioskSettings,
        shiftBreaks: {
          Morning: mSlots,
          Night: nSlots,
        },
        shiftTimings: sTimings,
      });
      setMorningNames([mSlots[0].name, mSlots[1].name, mSlots[2].name]);
      setMorningMinsStr([String(mSlots[0].mins), String(mSlots[1].mins), String(mSlots[2].mins)]);
      setNightNames([nSlots[0].name, nSlots[1].name, nSlots[2].name]);
      setNightMinsStr([String(nSlots[0].mins), String(nSlots[1].mins), String(nSlots[2].mins)]);
      setMorningAllowanceStr(String(getShiftDailyAllowanceMins(kioskSettings, 'Morning')));
      setNightAllowanceStr(String(getShiftDailyAllowanceMins(kioskSettings, 'Night')));
      setWarningMinsStr(String(kioskSettings.warningMins ?? 5));
      setGraceMinsStr(String(kioskSettings.graceMins ?? 1));
      setBigOvertimeMinsStr(String(kioskSettings.bigOvertimeMins ?? 15));
      setNeedsReviewMinsStr(String(kioskSettings.needsReviewRunningMins ?? 90));
      setMaxSimulStr(String(kioskSettings.maxSimultaneousBreaks ?? 5));
      setAutoReturnStr(String(kioskSettings.autoReturnSecs ?? 30));
      setPositiveText((kioskSettings.positiveMessages || DEFAULT_KIOSK_SETTINGS.positiveMessages).join('\n'));
      setWarningText((kioskSettings.warningMessages || DEFAULT_KIOSK_SETTINGS.warningMessages).join('\n'));
      setCalmMessageStr(
        kioskSettings.calmWithinAllowanceMessage ||
          DEFAULT_KIOSK_SETTINGS.calmWithinAllowanceMessage ||
          'Please try to return on time. Your day total is still within your break time.'
      );
      setDailyOverMessageStr(
        kioskSettings.dailyOverAllowanceMessage ||
          DEFAULT_KIOSK_SETTINGS.dailyOverAllowanceMessage ||
          'Your breaks today are N min over your daily break time.'
      );
      setBigOverSupervisorMessageStr(
        kioskSettings.bigOvertimeSupervisorMessage ||
          DEFAULT_KIOSK_SETTINGS.bigOvertimeSupervisorMessage ||
          'Please talk to your supervisor.'
      );
    }
  }, [kioskSettings]);

  // PIN change form
  const [currentPin, setCurrentPin] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [pinMsg, setPinMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [savingPin, setSavingPin] = useState<boolean>(false);

  // Helper to check if a string is a valid whole number within [min, max]
  const parseWholeNumberInRange = (raw: string, min: number, max: number): number | null => {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return null;
    if (!/^-?\d+$/.test(trimmed)) return null;
    const num = Number(trimmed);
    if (!Number.isInteger(num) || num < min || num > max) return null;
    return num;
  };

  // Compute live shift totals (using valid typed numbers or 0 while empty)
  const getLiveMins = (raw: string): number => {
    const n = parseWholeNumberInRange(raw, 1, 240);
    return n !== null ? n : 0;
  };

  const morningTotalMins =
    getLiveMins(morningMinsStr[0]) + getLiveMins(morningMinsStr[1]) + getLiveMins(morningMinsStr[2]);
  const nightTotalMins =
    getLiveMins(nightMinsStr[0]) + getLiveMins(nightMinsStr[1]) + getLiveMins(nightMinsStr[2]);

  const handleSlotNameChange = (shift: 'Morning' | 'Night', idx: 0 | 1 | 2, val: string) => {
    setSavedNotice(null);
    if (shift === 'Morning') {
      setMorningNames((prev) => {
        const next = [...prev] as [string, string, string];
        next[idx] = val;
        return next;
      });
    } else {
      setNightNames((prev) => {
        const next = [...prev] as [string, string, string];
        next[idx] = val;
        return next;
      });
    }
  };

  const handleSlotMinsChange = (shift: 'Morning' | 'Night', idx: 0 | 1 | 2, val: string) => {
    setSavedNotice(null);
    setValidationError(null);
    const key = `${shift}-${idx}`;
    setInvalidSlotKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    if (shift === 'Morning') {
      setMorningMinsStr((prev) => {
        const next = [...prev] as [string, string, string];
        next[idx] = val;
        const oldSum =
          getLiveMins(prev[0]) + getLiveMins(prev[1]) + getLiveMins(prev[2]);
        const newSum =
          getLiveMins(next[0]) + getLiveMins(next[1]) + getLiveMins(next[2]);
        setMorningAllowanceStr((curAllow) =>
          Number(curAllow) === oldSum && newSum >= 1 ? String(newSum) : curAllow
        );
        return next;
      });
    } else {
      setNightMinsStr((prev) => {
        const next = [...prev] as [string, string, string];
        next[idx] = val;
        const oldSum =
          getLiveMins(prev[0]) + getLiveMins(prev[1]) + getLiveMins(prev[2]);
        const newSum =
          getLiveMins(next[0]) + getLiveMins(next[1]) + getLiveMins(next[2]);
        setNightAllowanceStr((curAllow) =>
          Number(curAllow) === oldSum && newSum >= 1 ? String(newSum) : curAllow
        );
        return next;
      });
    }
  };

  const handleToggleTestMode = (enabled: boolean) => {
    const nowTs = Date.now();
    const nextVersion = (draft.version || kioskSettings.version || 1) + 1;
    lastSyncedUpdatedAtRef.current = nowTs;
    const nextSettings: KioskSettings = {
      ...kioskSettings,
      ...draft,
      testMode: enabled,
      updatedAt: nowTs,
      version: nextVersion,
    };
    setDraft(nextSettings);
    safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    onUpdateKioskSettings(nextSettings);
    setSavedNotice('Saved. Applies to new breaks');
    showToast(
      enabled
        ? 'Test mode ON: new breaks are 1 minute and excluded from reports.'
        : 'Test mode OFF: breaks returned to saved settings.',
      enabled ? 'warning' : 'success'
    );
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSavedNotice(null);

    // 1. Validate all 6 shift break durations (must be whole numbers from 1 to 240)
    const badSlots = new Set<string>();
    const mMins: [number, number, number] = [20, 20, 20];
    const nMins: [number, number, number] = [20, 20, 20];

    ([0, 1, 2] as const).forEach((idx) => {
      const mVal = parseWholeNumberInRange(morningMinsStr[idx], 1, 240);
      if (mVal === null) {
        badSlots.add(`Morning-${idx}`);
      } else {
        mMins[idx] = mVal;
      }

      const nVal = parseWholeNumberInRange(nightMinsStr[idx], 1, 240);
      if (nVal === null) {
        badSlots.add(`Night-${idx}`);
      } else {
        nMins[idx] = nVal;
      }
    });

    if (badSlots.size > 0) {
      setInvalidSlotKeys(badSlots);
      setValidationError('Please enter a number from 1 to 240');
      showToast('Please enter a number from 1 to 240', 'danger');
      return;
    }
    setInvalidSlotKeys(new Set());

    // 1b. Validate Daily Break Allowance per shift (1 to 480)
    const parsedMorningAllowance = parseWholeNumberInRange(morningAllowanceStr, 1, 480);
    if (parsedMorningAllowance === null) {
      setValidationError('Please enter a Morning daily break allowance from 1 to 480 minutes');
      showToast('Please enter a Morning daily break allowance from 1 to 480 minutes', 'danger');
      return;
    }

    const parsedNightAllowance = parseWholeNumberInRange(nightAllowanceStr, 1, 480);
    if (parsedNightAllowance === null) {
      setValidationError('Please enter a Night daily break allowance from 1 to 480 minutes');
      showToast('Please enter a Night daily break allowance from 1 to 480 minutes', 'danger');
      return;
    }

    // 2. Validate other editable times in Settings with sensible limits
    const parsedWarning = parseWholeNumberInRange(warningMinsStr, 0, 30);
    if (parsedWarning === null) {
      setValidationError('Please enter a warning time from 0 to 30 minutes');
      showToast('Please enter a warning time from 0 to 30 minutes', 'danger');
      return;
    }

    const parsedGrace = parseWholeNumberInRange(graceMinsStr, 0, 15);
    if (parsedGrace === null) {
      setValidationError('Please enter a grace time from 0 to 15 minutes');
      showToast('Please enter a grace time from 0 to 15 minutes', 'danger');
      return;
    }

    const parsedBigOvertime = parseWholeNumberInRange(bigOvertimeMinsStr, 1, 120);
    if (parsedBigOvertime === null) {
      setValidationError('Please enter a big-overtime limit from 1 to 120 minutes');
      showToast('Please enter a big-overtime limit from 1 to 120 minutes', 'danger');
      return;
    }

    const parsedNeedsReview = parseWholeNumberInRange(needsReviewMinsStr, 5, 480);
    if (parsedNeedsReview === null) {
      setValidationError('Please enter a "Needs review" limit from 5 to 480 minutes');
      showToast('Please enter a "Needs review" limit from 5 to 480 minutes', 'danger');
      return;
    }

    const parsedMaxSimul = parseWholeNumberInRange(maxSimulStr, 1, 40) ?? 5;
    const parsedAutoReturn = parseWholeNumberInRange(autoReturnStr, 10, 300) ?? 30;

    const morningSlots: [ShiftBreakSlotConfig, ShiftBreakSlotConfig, ShiftBreakSlotConfig] = [
      {
        slot: 1,
        name: morningNames[0].trim() || DEFAULT_SHIFT_BREAKS.Morning[0].name,
        mins: mMins[0],
      },
      {
        slot: 2,
        name: morningNames[1].trim() || DEFAULT_SHIFT_BREAKS.Morning[1].name,
        mins: mMins[1],
      },
      {
        slot: 3,
        name: morningNames[2].trim() || DEFAULT_SHIFT_BREAKS.Morning[2].name,
        mins: mMins[2],
      },
    ];

    const nightSlots: [ShiftBreakSlotConfig, ShiftBreakSlotConfig, ShiftBreakSlotConfig] = [
      {
        slot: 1,
        name: nightNames[0].trim() || DEFAULT_SHIFT_BREAKS.Night[0].name,
        mins: nMins[0],
      },
      {
        slot: 2,
        name: nightNames[1].trim() || DEFAULT_SHIFT_BREAKS.Night[1].name,
        mins: nMins[1],
      },
      {
        slot: 3,
        name: nightNames[2].trim() || DEFAULT_SHIFT_BREAKS.Night[2].name,
        mins: nMins[2],
      },
    ];

    const posLines = positiveText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const warnLines = warningText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const nowTs = Date.now();
    const nextVersion = (draft.version || kioskSettings.version || 1) + 1;
    lastSyncedUpdatedAtRef.current = nowTs;

    const updated: KioskSettings = {
      ...draft,
      warningMins: parsedWarning,
      graceMins: parsedGrace,
      bigOvertimeMins: parsedBigOvertime,
      needsReviewRunningMins: parsedNeedsReview,
      maxSimultaneousBreaks: parsedMaxSimul,
      autoReturnSecs: parsedAutoReturn,
      dailyAllowanceMins: {
        Morning: parsedMorningAllowance,
        Night: parsedNightAllowance,
      },
      showLiveBalanceOnBreak: draft.showLiveBalanceOnBreak !== false,
      calmWithinAllowanceMessage:
        calmMessageStr.trim() ||
        DEFAULT_KIOSK_SETTINGS.calmWithinAllowanceMessage ||
        'Please try to return on time. Your day total is still within your break time.',
      dailyOverAllowanceMessage:
        dailyOverMessageStr.trim() ||
        DEFAULT_KIOSK_SETTINGS.dailyOverAllowanceMessage ||
        'Your breaks today are N min over your daily break time.',
      bigOvertimeSupervisorMessage:
        bigOverSupervisorMessageStr.trim() ||
        DEFAULT_KIOSK_SETTINGS.bigOvertimeSupervisorMessage ||
        'Please talk to your supervisor.',
      updatedAt: nowTs,
      version: nextVersion,
      shiftBreaks: {
        Morning: morningSlots,
        Night: nightSlots,
      },
      shiftTimings: getShiftTimings(draft),
      allowedMins: {
        ...draft.allowedMins,
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
      positiveMessages: posLines.length > 0 ? posLines : DEFAULT_KIOSK_SETTINGS.positiveMessages,
      warningMessages: warnLines.length > 0 ? warnLines : DEFAULT_KIOSK_SETTINGS.warningMessages,
    };

    setDraft(updated);
    safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    onUpdateKioskSettings(updated);
    setSavedNotice('Saved. Applies to new breaks');
    showToast('Saved. Applies to new breaks', 'success');
  };

  const handleResetDefaults = () => {
    const nowTs = Date.now();
    const nextVersion = (draft.version || kioskSettings.version || 1) + 1;
    lastSyncedUpdatedAtRef.current = nowTs;
    const restored: KioskSettings = {
      ...DEFAULT_KIOSK_SETTINGS,
      updatedAt: nowTs,
      version: nextVersion,
    };
    setDraft(restored);
    setMorningNames([
      DEFAULT_SHIFT_BREAKS.Morning[0].name,
      DEFAULT_SHIFT_BREAKS.Morning[1].name,
      DEFAULT_SHIFT_BREAKS.Morning[2].name,
    ]);
    setMorningMinsStr(['20', '20', '20']);
    setNightNames([
      DEFAULT_SHIFT_BREAKS.Night[0].name,
      DEFAULT_SHIFT_BREAKS.Night[1].name,
      DEFAULT_SHIFT_BREAKS.Night[2].name,
    ]);
    setNightMinsStr(['20', '20', '20']);
    setMorningAllowanceStr('60');
    setNightAllowanceStr('60');
    setWarningMinsStr('5');
    setGraceMinsStr('1');
    setBigOvertimeMinsStr('15');
    setNeedsReviewMinsStr('90');
    setMaxSimulStr('5');
    setAutoReturnStr('30');
    setPositiveText(DEFAULT_KIOSK_SETTINGS.positiveMessages.join('\n'));
    setWarningText(DEFAULT_KIOSK_SETTINGS.warningMessages.join('\n'));
    setCalmMessageStr(
      DEFAULT_KIOSK_SETTINGS.calmWithinAllowanceMessage ||
        'Please try to return on time. Your day total is still within your break time.'
    );
    setDailyOverMessageStr(
      DEFAULT_KIOSK_SETTINGS.dailyOverAllowanceMessage ||
        'Your breaks today are N min over your daily break time.'
    );
    setBigOverSupervisorMessageStr(
      DEFAULT_KIOSK_SETTINGS.bigOvertimeSupervisorMessage || 'Please talk to your supervisor.'
    );
    setValidationError(null);
    setInvalidSlotKeys(new Set());
    safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(restored));
    onUpdateKioskSettings(restored);
    setSavedNotice('Saved. Applies to new breaks');
    showToast('Default break times (20 minutes each) restored', 'info');
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPin(true);
    setPinMsg(null);
    const res = await changePinOnServer(currentPin, newPin);
    setSavingPin(false);
    if (res.ok) {
      setCurrentPin('');
      setNewPin('');
      onPinChanged(Boolean(res.isDefaultPin));
      setPinMsg({ text: 'Supervisor Kiosk PIN updated on server!', isError: false });
      showToast('Supervisor Kiosk PIN updated!', 'success');
    } else {
      setPinMsg({ text: res.error || 'Failed to update PIN', isError: true });
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-[#E4E7F2] space-y-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E7F2] pb-4">
        <div>
          <h3 className="font-black text-[#171262] flex items-center space-x-2 text-base">
            <Settings className="w-5 h-5 text-[#4D3FDC]" />
            <span>Break Durations &amp; Employee Kiosk Settings</span>
          </h3>
          <p className="text-xs text-[#5C5A85] mt-0.5">
            Synced automatically to the Google Sheet (Settings tab) so all tablets and supervisor phones use the same values within seconds.
          </p>
        </div>

        <button
          type="button"
          onClick={onEnterLockedKiosk}
          className="px-4 py-2 rounded-xl bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Open Locked Kiosk Mode (?mode=kiosk)</span>
        </button>
      </div>

      {/* Default PIN Reminder Banner */}
      {isDefaultPin && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Default Kiosk Supervisor PIN is currently active</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Please change the Kiosk Supervisor PIN below so employees cannot exit locked tablet kiosk mode.
            </p>
          </div>
        </div>
      )}

      {/* TEST MODE SWITCH (Supervisor Only, Default OFF) */}
      <div
        className={`p-4 rounded-2xl border-2 transition ${
          draft.testMode
            ? 'bg-orange-50 border-orange-500 text-orange-950'
            : 'bg-[#F8F9FE] border-[#E4E7F2] text-[#171262]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                draft.testMode ? 'bg-orange-500 text-white' : 'bg-[#EEECFB] text-[#4D3FDC]'
              }`}
            >
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm">Test mode (1-minute breaks for testing)</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                    draft.testMode ? 'bg-orange-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {draft.testMode ? 'ON — 1 MIN BREAKS' : 'OFF'}
                </span>
              </div>
              <p className="text-xs text-[#5C5A85] mt-0.5">
                When ON, all newly started breaks are shortened to 1 minute so you can test the late warning without waiting. Test breaks are marked in the logs and excluded from reports. Turn OFF to return to your saved break times.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={Boolean(draft.testMode)}
            onClick={() => handleToggleTestMode(!draft.testMode)}
            className={`px-4 py-2.5 rounded-xl font-black text-xs transition cursor-pointer shadow-xs shrink-0 ${
              draft.testMode
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-white hover:bg-slate-100 text-[#171262] border border-[#D5D0F9]'
            }`}
          >
            {draft.testMode ? 'Turn OFF Test Mode' : 'Turn ON Test Mode (1 min)'}
          </button>
        </div>
      </div>

      {/* Validation Error or Saved Notice Banner in Plain English */}
      {validationError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-800 flex items-center gap-2.5 text-sm font-black"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {savedNotice && !validationError && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-900 flex items-center gap-2.5 text-sm font-black"
        >
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} noValidate className="space-y-6 text-xs">
        {/* 0. SHIFT TIMING ADJUSTMENTS (Morning & Night Shift Start/End Times + Quick Presets + Break Refill) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#F8F9FE] border-2 border-[#D5D0F9] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-black text-[#171262] text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#4D3FDC]" />
                <span>Shift Timing Adjustments (Morning &amp; Night Shift Hours)</span>
              </h4>
              <p className="text-xs text-[#5C5A85] mt-0.5">
                Adjust shift start and end times depending on daily orders (e.g. 8 to 8, 7 to 7, 7 to 6, or 9 to 8). The Employee Kiosk automatically switches employee names and refills breaks (0/3) <strong>30 minutes before</strong> the new shift starts (e.g. at 7:30 PM for an 8:00 PM Night Shift, and 7:30 AM for an 8:00 AM Morning Shift).
              </p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#EEECFB] border border-[#D5D0F9] font-black text-[#4D3FDC] text-xs">
              Active Schedule: {formatTime12h(getShiftTimings(draft).Morning.start)} – {formatTime12h(getShiftTimings(draft).Morning.end)} / {formatTime12h(getShiftTimings(draft).Night.start)} – {formatTime12h(getShiftTimings(draft).Night.end)}
            </span>
          </div>

          {/* Quick Shift Presets */}
          <div>
            <span className="text-[11px] font-bold text-[#5C5A85] block mb-1.5">
              Quick Shift Schedule Presets (Tap to apply):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {[
                { label: '8:00 AM – 8:00 PM (8 to 8)', sub: 'Morning 08:00–20:00 • Night 20:00–08:00', mStart: '08:00', mEnd: '20:00', nStart: '20:00', nEnd: '08:00' },
                { label: '7:00 AM – 7:00 PM (7 to 7)', sub: 'Morning 07:00–19:00 • Night 19:00–07:00', mStart: '07:00', mEnd: '19:00', nStart: '19:00', nEnd: '07:00' },
                { label: '7:00 AM – 6:00 PM (7 to 6)', sub: 'Morning 07:00–18:00 • Night 19:00–06:00', mStart: '07:00', mEnd: '18:00', nStart: '19:00', nEnd: '06:00' },
                { label: '9:00 AM – 8:00 PM (9 to 8)', sub: 'Morning 09:00–20:00 • Night 21:00–08:00', mStart: '09:00', mEnd: '20:00', nStart: '21:00', nEnd: '08:00' },
              ].map((preset) => {
                const curT = getShiftTimings(draft);
                const isSelected =
                  curT.Morning.start === preset.mStart &&
                  curT.Morning.end === preset.mEnd &&
                  curT.Night.start === preset.nStart &&
                  curT.Night.end === preset.nEnd;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setSavedNotice(null);
                      setDraft((prev) => ({
                        ...prev,
                        shiftTimings: {
                          Morning: { start: preset.mStart, end: preset.mEnd },
                          Night: { start: preset.nStart, end: preset.nEnd },
                        },
                      }));
                    }}
                    className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#251B7C] text-white border-[#251B7C] shadow-xs'
                        : 'bg-white text-[#171262] border-[#D5D0F9] hover:border-[#4D3FDC]'
                    }`}
                  >
                    <span className="font-black text-xs block">{preset.label}</span>
                    <span className={`text-[10px] block mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-[#5C5A85]'}`}>
                      {preset.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Start & End Time Pickers for Morning & Night Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Morning Shift Hours */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-amber-950 flex items-center gap-1.5 text-xs">
                  <Sun className="w-4 h-4 text-amber-600" />
                  <span>Morning Shift Timing</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nowTs = Date.now();
                    const updated: KioskSettings = {
                      ...draft,
                      shiftRefillTimestamps: {
                        ...(draft.shiftRefillTimestamps || {}),
                        Morning: nowTs,
                      },
                      updatedAt: nowTs,
                      version: Number(draft.version || 1) + 1,
                    };
                    setDraft(updated);
                    safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
                    onUpdateKioskSettings(updated);
                    showToast('Refreshed & refilled Morning Shift breaks to 0/3!', 'success');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Refill Morning Breaks</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-amber-900 block mb-0.5">Start Time</label>
                  <input
                    type="time"
                    value={getShiftTimings(draft).Morning.start}
                    onChange={(e) => {
                      setSavedNotice(null);
                      const cur = getShiftTimings(draft);
                      setDraft((prev) => ({
                        ...prev,
                        shiftTimings: {
                          ...cur,
                          Morning: { ...cur.Morning, start: e.target.value || DEFAULT_SHIFT_TIMINGS.Morning.start },
                        },
                      }));
                    }}
                    className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-xs text-[#171262]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-900 block mb-0.5">End Time</label>
                  <input
                    type="time"
                    value={getShiftTimings(draft).Morning.end}
                    onChange={(e) => {
                      setSavedNotice(null);
                      const cur = getShiftTimings(draft);
                      setDraft((prev) => ({
                        ...prev,
                        shiftTimings: {
                          ...cur,
                          Morning: { ...cur.Morning, end: e.target.value || DEFAULT_SHIFT_TIMINGS.Morning.end },
                        },
                      }));
                    }}
                    className="w-full bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-xs text-[#171262]"
                  />
                </div>
              </div>
            </div>

            {/* Night Shift Hours */}
            <div className="p-3.5 rounded-xl bg-[#EEECFB]/70 border border-[#C7C2F5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#171262] flex items-center gap-1.5 text-xs">
                  <Moon className="w-4 h-4 text-[#4D3FDC]" />
                  <span>Night Shift Timing (Overnight)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nowTs = Date.now();
                    const updated: KioskSettings = {
                      ...draft,
                      shiftRefillTimestamps: {
                        ...(draft.shiftRefillTimestamps || {}),
                        Night: nowTs,
                      },
                      updatedAt: nowTs,
                      version: Number(draft.version || 1) + 1,
                    };
                    setDraft(updated);
                    safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
                    onUpdateKioskSettings(updated);
                    showToast('Refreshed & refilled Night Shift breaks to 0/3!', 'success');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-black text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Refill Night Breaks</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-[#4D3FDC] block mb-0.5">Start Time (Evening)</label>
                  <input
                    type="time"
                    value={getShiftTimings(draft).Night.start}
                    onChange={(e) => {
                      setSavedNotice(null);
                      const cur = getShiftTimings(draft);
                      setDraft((prev) => ({
                        ...prev,
                        shiftTimings: {
                          ...cur,
                          Night: { ...cur.Night, start: e.target.value || DEFAULT_SHIFT_TIMINGS.Night.start },
                        },
                      }));
                    }}
                    className="w-full bg-white border border-[#C7C2F5] rounded-lg px-2.5 py-1.5 font-mono font-bold text-xs text-[#171262]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#4D3FDC] block mb-0.5">End Time (Next Morning)</label>
                  <input
                    type="time"
                    value={getShiftTimings(draft).Night.end}
                    onChange={(e) => {
                      setSavedNotice(null);
                      const cur = getShiftTimings(draft);
                      setDraft((prev) => ({
                        ...prev,
                        shiftTimings: {
                          ...cur,
                          Night: { ...cur.Night, end: e.target.value || DEFAULT_SHIFT_TIMINGS.Night.end },
                        },
                      }));
                    }}
                    className="w-full bg-white border border-[#C7C2F5] rounded-lg px-2.5 py-1.5 font-mono font-bold text-xs text-[#171262]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Shift-Specific Break Names & Allowed Minutes (Slots 1, 2, 3) */}
        <div className="space-y-4">
          <div>
            <label className="block font-black text-[#171262] text-sm">
              1. Break Names &amp; Allowed Minutes (1 to 240 minutes per break)
            </label>
            <p className="text-xs text-[#5C5A85] mt-0.5">
              Enter any whole number from 1 to 240 minutes, or tap a quick button (10, 15, 20, 30, 45, 60). Running breaks keep the minutes they started with; changes apply to new breaks.
            </p>
          </div>

          {/* MORNING SHIFT BREAKS */}
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border-2 border-amber-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-black text-amber-950 text-sm">
                <Sun className="w-4 h-4 text-amber-600" />
                <span>Morning Shift Breaks (Default: Breakfast, Lunch, Tea)</span>
              </div>
              <div className="px-3 py-1 rounded-xl bg-amber-100 border border-amber-300 font-black text-amber-950 text-xs">
                Total break time per shift: {morningTotalMins} minutes
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {([0, 1, 2] as const).map((idx) => {
                const slotNum = (idx + 1) as 1 | 2 | 3;
                const isInvalid = invalidSlotKeys.has(`Morning-${idx}`);
                const currentNum = parseWholeNumberInRange(morningMinsStr[idx], 1, 240);

                return (
                  <div
                    key={`morning-slot-${slotNum}`}
                    className={`p-3.5 rounded-xl bg-white border-2 space-y-3 ${
                      isInvalid ? 'border-rose-500 bg-rose-50/30' : 'border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-amber-900 uppercase">
                        Morning Break {slotNum}
                      </span>
                      <span className="text-[11px] font-bold text-[#5C5A85]">1 – 240 mins</span>
                    </div>

                    {/* Break Name */}
                    <div>
                      <label className="text-[11px] font-bold text-[#5C5A85] block mb-1">
                        Break Name
                      </label>
                      <input
                        type="text"
                        value={morningNames[idx]}
                        onChange={(e) => handleSlotNameChange('Morning', idx, e.target.value)}
                        placeholder={DEFAULT_SHIFT_BREAKS.Morning[idx].name}
                        className="w-full bg-[#F8F9FE] border border-[#D5D0F9] rounded-lg px-2.5 py-2 font-bold text-xs text-[#171262] focus:outline-none focus:ring-2 focus:ring-[#4D3FDC]"
                      />
                    </div>

                    {/* Allowed Minutes Number Box + "minutes" label */}
                    <div>
                      <label className="text-[11px] font-bold text-[#5C5A85] block mb-1">
                        Allowed Time (custom entry)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={morningMinsStr[idx]}
                          onChange={(e) => handleSlotMinsChange('Morning', idx, e.target.value)}
                          placeholder="20"
                          aria-label={`Morning Break ${slotNum} minutes`}
                          className={`w-24 bg-[#F8F9FE] border-2 rounded-lg px-3 py-2 font-mono font-black text-sm text-[#171262] focus:outline-none focus:ring-2 ${
                            isInvalid
                              ? 'border-rose-500 focus:ring-rose-500'
                              : 'border-[#4D3FDC] focus:ring-[#4D3FDC]'
                          }`}
                        />
                        <span className="text-xs font-extrabold text-[#171262]">minutes</span>
                      </div>
                      {isInvalid && (
                        <p className="text-[11px] font-bold text-rose-600 mt-1">
                          Please enter a number from 1 to 240
                        </p>
                      )}
                    </div>

                    {/* Quick Preset Buttons: 10, 15, 20, 30, 45, 60 */}
                    <div>
                      <span className="text-[10px] font-bold text-[#5C5A85] block mb-1">
                        Quick buttons (minutes):
                      </span>
                      <div className="grid grid-cols-6 gap-1">
                        {QUICK_MINUTE_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleSlotMinsChange('Morning', idx, String(preset))}
                            className={`py-1.5 rounded-lg font-mono font-black text-[11px] border cursor-pointer transition ${
                              currentNum === preset
                                ? 'bg-[#4D3FDC] text-white border-[#4D3FDC]'
                                : 'bg-[#F8F9FE] hover:bg-[#EEECFB] text-[#171262] border-[#D5D0F9]'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-amber-950 block">
                  Daily break allowance (minutes) — Morning Shift (1 to 480)
                </span>
                <span className="text-[11px] text-amber-900/80 block">
                  Total daily break minutes allowed per person before daily overtime starts (default = sum of the 3 breaks: {morningTotalMins} min).
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={morningAllowanceStr}
                  onChange={(e) => {
                    setSavedNotice(null);
                    setValidationError(null);
                    setMorningAllowanceStr(e.target.value);
                  }}
                  aria-label="Morning Shift Daily break allowance (minutes)"
                  className="w-24 bg-white border-2 border-amber-400 rounded-lg px-3 py-1.5 font-mono font-black text-sm text-[#171262]"
                />
                <span className="text-xs font-extrabold text-amber-950">minutes</span>
                <button
                  type="button"
                  onClick={() => {
                    setSavedNotice(null);
                    setValidationError(null);
                    setMorningAllowanceStr(String(Math.max(1, morningTotalMins)));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] cursor-pointer transition shadow-2xs"
                >
                  Use total of the 3 breaks ({morningTotalMins}m)
                </button>
              </div>
            </div>
          </div>

          {/* NIGHT SHIFT BREAKS */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F4F3FF] border-2 border-[#D5D0F9] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-black text-[#251B7C] text-sm">
                <Moon className="w-4 h-4 text-[#4D3FDC]" />
                <span>Night Shift Breaks (Default: Dinner, Midnight meal, Tea)</span>
              </div>
              <div className="px-3 py-1 rounded-xl bg-[#EEECFB] border border-[#C7C2F5] font-black text-[#251B7C] text-xs">
                Total break time per shift: {nightTotalMins} minutes
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {([0, 1, 2] as const).map((idx) => {
                const slotNum = (idx + 1) as 1 | 2 | 3;
                const isInvalid = invalidSlotKeys.has(`Night-${idx}`);
                const currentNum = parseWholeNumberInRange(nightMinsStr[idx], 1, 240);

                return (
                  <div
                    key={`night-slot-${slotNum}`}
                    className={`p-3.5 rounded-xl bg-white border-2 space-y-3 ${
                      isInvalid ? 'border-rose-500 bg-rose-50/30' : 'border-[#D5D0F9]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-[#4D3FDC] uppercase">
                        Night Break {slotNum}
                      </span>
                      <span className="text-[11px] font-bold text-[#5C5A85]">1 – 240 mins</span>
                    </div>

                    {/* Break Name */}
                    <div>
                      <label className="text-[11px] font-bold text-[#5C5A85] block mb-1">
                        Break Name
                      </label>
                      <input
                        type="text"
                        value={nightNames[idx]}
                        onChange={(e) => handleSlotNameChange('Night', idx, e.target.value)}
                        placeholder={DEFAULT_SHIFT_BREAKS.Night[idx].name}
                        className="w-full bg-[#F8F9FE] border border-[#D5D0F9] rounded-lg px-2.5 py-2 font-bold text-xs text-[#171262] focus:outline-none focus:ring-2 focus:ring-[#4D3FDC]"
                      />
                    </div>

                    {/* Allowed Minutes Number Box + "minutes" label */}
                    <div>
                      <label className="text-[11px] font-bold text-[#5C5A85] block mb-1">
                        Allowed Time (custom entry)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={nightMinsStr[idx]}
                          onChange={(e) => handleSlotMinsChange('Night', idx, e.target.value)}
                          placeholder="20"
                          aria-label={`Night Break ${slotNum} minutes`}
                          className={`w-24 bg-[#F8F9FE] border-2 rounded-lg px-3 py-2 font-mono font-black text-sm text-[#171262] focus:outline-none focus:ring-2 ${
                            isInvalid
                              ? 'border-rose-500 focus:ring-rose-500'
                              : 'border-[#4D3FDC] focus:ring-[#4D3FDC]'
                          }`}
                        />
                        <span className="text-xs font-extrabold text-[#171262]">minutes</span>
                      </div>
                      {isInvalid && (
                        <p className="text-[11px] font-bold text-rose-600 mt-1">
                          Please enter a number from 1 to 240
                        </p>
                      )}
                    </div>

                    {/* Quick Preset Buttons: 10, 15, 20, 30, 45, 60 */}
                    <div>
                      <span className="text-[10px] font-bold text-[#5C5A85] block mb-1">
                        Quick buttons (minutes):
                      </span>
                      <div className="grid grid-cols-6 gap-1">
                        {QUICK_MINUTE_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleSlotMinsChange('Night', idx, String(preset))}
                            className={`py-1.5 rounded-lg font-mono font-black text-[11px] border cursor-pointer transition ${
                              currentNum === preset
                                ? 'bg-[#4D3FDC] text-white border-[#4D3FDC]'
                                : 'bg-[#F8F9FE] hover:bg-[#EEECFB] text-[#171262] border-[#D5D0F9]'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#D5D0F9] flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-[#251B7C] block">
                  Daily break allowance (minutes) — Night Shift (1 to 480)
                </span>
                <span className="text-[11px] text-[#5C5A85] block">
                  Total daily break minutes allowed per person before daily overtime starts (default = sum of the 3 breaks: {nightTotalMins} min).
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={nightAllowanceStr}
                  onChange={(e) => {
                    setSavedNotice(null);
                    setValidationError(null);
                    setNightAllowanceStr(e.target.value);
                  }}
                  aria-label="Night Shift Daily break allowance (minutes)"
                  className="w-24 bg-white border-2 border-[#4D3FDC] rounded-lg px-3 py-1.5 font-mono font-black text-sm text-[#171262]"
                />
                <span className="text-xs font-extrabold text-[#251B7C]">minutes</span>
                <button
                  type="button"
                  onClick={() => {
                    setSavedNotice(null);
                    setValidationError(null);
                    setNightAllowanceStr(String(Math.max(1, nightTotalMins)));
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-black text-[11px] cursor-pointer transition shadow-2xs"
                >
                  Use total of the 3 breaks ({nightTotalMins}m)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Warning, Grace, Overtime & "Needs review" Thresholds */}
        <div className="space-y-3">
          <label className="block font-black text-[#171262] text-sm">
            2. Warning, Grace &amp; Supervisor Review Times
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Warning minutes before the end (0 to 30, default 5) */}
            <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] space-y-1.5">
              <span className="text-xs font-bold text-[#171262] block">
                Warning minutes before the end (0 to 30, default 5)
              </span>
              <span className="text-[11px] text-[#5C5A85] block">
                Turns the countdown ring amber when this many minutes are left.
              </span>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={warningMinsStr}
                  onChange={(e) => {
                    setSavedNotice(null);
                    setValidationError(null);
                    setWarningMinsStr(e.target.value);
                  }}
                  className="w-24 bg-white border-2 border-[#D5D0F9] rounded-lg px-3 py-1.5 font-mono font-black text-sm text-[#171262]"
                />
                <span className="text-xs font-bold text-[#171262]">minutes</span>
              </div>
            </div>

            {/* Grace minutes after the end before it counts as overtime (0 to 15, default 1) */}
            <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] space-y-1.5">
              <span className="text-xs font-bold text-[#171262] block">
                Grace minutes after the end before overtime (0 to 15, default 1)
              </span>
              <span className="text-[11px] text-[#5C5A85] block">
                Extra minutes allowed after the timer ends before a break counts as late.
              </span>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={graceMinsStr}
                  onChange={(e) => {
                    setSavedNotice(null);
                    setValidationError(null);
                    setGraceMinsStr(e.target.value);
                  }}
                  className="w-24 bg-white border-2 border-[#D5D0F9] rounded-lg px-3 py-1.5 font-mono font-black text-sm text-[#171262]"
                />
                <span className="text-xs font-bold text-[#171262]">minutes</span>
              </div>
            </div>

            {/* Big-overtime threshold for "speak to your supervisor" (default 15) */}
            <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] space-y-1.5">
              <span className="text-xs font-bold text-[#171262] block">
                Big-overtime threshold for &quot;Please talk to your supervisor&quot; (1 to 120, default 15)
              </span>
              <span className="text-[11px] text-[#5C5A85] block">
                Shows &quot;Please talk to your supervisor&quot; if an employee is late by more than this many minutes.
              </span>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={bigOvertimeMinsStr}
                  onChange={(e) => {
                    setSavedNotice(null);
                    setValidationError(null);
                    setBigOvertimeMinsStr(e.target.value);
                  }}
                  className="w-24 bg-white border-2 border-[#D5D0F9] rounded-lg px-3 py-1.5 font-mono font-black text-sm text-[#171262]"
                />
                <span className="text-xs font-bold text-[#171262]">minutes</span>
              </div>
            </div>

            {/* "Needs review" limit for a break still running (5 to 480 minutes, default 90) */}
            <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] space-y-1.5">
              <span className="text-xs font-bold text-[#171262] block">
                &quot;Needs review&quot; alert for a forgotten running timer (5 to 480, default 90)
              </span>
              <span className="text-[11px] text-[#5C5A85] block">
                Flags a break still running on the supervisor dashboard if someone forgot to stop it (this is NOT the break duration).
              </span>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={needsReviewMinsStr}
                  onChange={(e) => {
                    setSavedNotice(null);
                    setValidationError(null);
                    setNeedsReviewMinsStr(e.target.value);
                  }}
                  className="w-24 bg-white border-2 border-[#D5D0F9] rounded-lg px-3 py-1.5 font-mono font-black text-sm text-[#171262]"
                />
                <span className="text-xs font-bold text-[#171262]">minutes</span>
              </div>
            </div>

            {/* Max Simultaneous Breaks */}
            <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] space-y-1.5">
              <span className="text-xs font-bold text-[#171262] block">
                Maximum people on break at the same time (default 5)
              </span>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxSimulStr}
                  onChange={(e) => {
                    setSavedNotice(null);
                    setMaxSimulStr(e.target.value);
                  }}
                  className="w-24 bg-white border-2 border-[#D5D0F9] rounded-lg px-3 py-1.5 font-mono font-black text-sm text-[#171262]"
                />
                <span className="text-xs font-bold text-[#171262]">people</span>
              </div>
            </div>

            {/* Auto-Return Timeout (seconds) */}
            <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] space-y-1.5">
              <span className="text-xs font-bold text-[#171262] block">
                Kiosk idle return to home screen (10 to 300, default 30)
              </span>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  value={autoReturnStr}
                  onChange={(e) => {
                    setSavedNotice(null);
                    setAutoReturnStr(e.target.value);
                  }}
                  className="w-24 bg-white border-2 border-[#D5D0F9] rounded-lg px-3 py-1.5 font-mono font-black text-sm text-[#171262]"
                />
                <span className="text-xs font-bold text-[#171262]">seconds</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Toggles: Live Balance, Soft Sound & Allowed Time Windows */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="p-3 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] flex items-center space-x-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.showLiveBalanceOnBreak !== false}
              onChange={(e) => {
                setSavedNotice(null);
                setDraft((prev) => ({ ...prev, showLiveBalanceOnBreak: e.target.checked }));
              }}
              className="w-4 h-4 rounded text-[#4D3FDC]"
            />
            <div>
              <span className="font-bold text-[#171262] block">Show live balance during a break</span>
              <span className="text-[11px] text-[#5C5A85]">Shows &quot;Balance now: X min left&quot; on On Break cards</span>
            </div>
          </label>

          <label className="p-3 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] flex items-center space-x-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.soundEnabled}
              onChange={(e) => {
                setSavedNotice(null);
                setDraft((prev) => ({ ...prev, soundEnabled: e.target.checked }));
              }}
              className="w-4 h-4 rounded text-[#4D3FDC]"
            />
            <div>
              <span className="font-bold text-[#171262] block">Soft Kiosk Sound Chimes (Auto-Enabled on First Touch)</span>
              <span className="text-[11px] text-[#5C5A85]">Gentle chimes when starting/stopping &amp; 2m left</span>
            </div>
          </label>

          <label className="p-3 rounded-xl bg-[#F8F9FE] border border-[#E4E7F2] flex items-center space-x-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.timeWindowsEnabled}
              onChange={(e) => {
                setSavedNotice(null);
                setDraft((prev) => ({ ...prev, timeWindowsEnabled: e.target.checked }));
              }}
              className="w-4 h-4 rounded text-[#4D3FDC]"
            />
            <div>
              <span className="font-bold text-[#171262] block">Enforce Break Time Windows</span>
              <span className="text-[11px] text-[#5C5A85]">Require Supervisor PIN outside scheduled window</span>
            </div>
          </label>
        </div>

        {/* Optional Time Window Configuration */}
        {draft.timeWindowsEnabled && (
          <div className="p-4 rounded-xl bg-[#F8F9FE] border border-[#D5D0F9] space-y-3">
            <h4 className="font-bold text-[#171262] flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#4D3FDC]" />
              <span>Allowed Time Windows per Shift (Asia/Dubai 24h)</span>
            </h4>
            {(['Morning', 'Night'] as const).map((sh) => {
              const names = sh === 'Morning' ? morningNames : nightNames;
              const legacyKeys = ['Breakfast', 'Lunch', 'Tea'] as const;
              return (
                <div key={sh} className="space-y-2">
                  <span className="text-[11px] font-black uppercase text-[#4D3FDC]">{sh} Shift</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {legacyKeys.map((bKey, idx) => (
                      <div key={bKey} className="bg-white p-2.5 rounded-lg border border-[#E4E7F2] space-y-1">
                        <span className="font-bold text-[#171262] block">
                          Break {idx + 1}: {names[idx]}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={draft.timeWindows[sh][bKey].start}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                timeWindows: {
                                  ...prev.timeWindows,
                                  [sh]: {
                                    ...prev.timeWindows[sh],
                                    [bKey]: { ...prev.timeWindows[sh][bKey], start: e.target.value },
                                  },
                                },
                              }))
                            }
                            className="bg-[#F8F9FE] border border-[#E4E7F2] rounded px-1.5 py-1 text-[11px] font-mono"
                          />
                          <span>to</span>
                          <input
                            type="time"
                            value={draft.timeWindows[sh][bKey].end}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                timeWindows: {
                                  ...prev.timeWindows,
                                  [sh]: {
                                    ...prev.timeWindows[sh],
                                    [bKey]: { ...prev.timeWindows[sh][bKey], end: e.target.value },
                                  },
                                },
                              }))
                            }
                            className="bg-[#F8F9FE] border border-[#E4E7F2] rounded px-1.5 py-1 text-[11px] font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 4. Editable Friendly & Overtime Messages */}
        <div className="space-y-3 p-4 rounded-2xl bg-[#F8F9FE] border border-[#E4E7F2]">
          <h4 className="font-black text-[#171262] text-sm">
            4. Kiosk Return &amp; Daily Balance Messages (Editable)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#171262] mb-1">
                Friendly On-Time Return Lines (One per line)
              </label>
              <textarea
                rows={3}
                value={positiveText}
                onChange={(e) => {
                  setSavedNotice(null);
                  setPositiveText(e.target.value);
                }}
                className="w-full bg-white border border-[#D5D0F9] rounded-xl p-2.5 text-[11px] text-[#171262] font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-[#171262] mb-1">
                Soft Warning Line When a Single Break Runs Late (One per line)
              </label>
              <textarea
                rows={3}
                value={warningText}
                onChange={(e) => {
                  setSavedNotice(null);
                  setWarningText(e.target.value);
                }}
                className="w-full bg-white border border-[#D5D0F9] rounded-xl p-2.5 text-[11px] text-[#171262] font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block font-bold text-[#171262] mb-1">
                Calm Line (Late on break, but within daily allowance)
              </label>
              <input
                type="text"
                value={calmMessageStr}
                onChange={(e) => {
                  setSavedNotice(null);
                  setCalmMessageStr(e.target.value);
                }}
                className="w-full bg-white border border-[#D5D0F9] rounded-xl px-3 py-2 text-[11px] text-[#171262] font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-[#171262] mb-1">
                Over Daily Allowance Line (Use &quot;N&quot; for minutes over)
              </label>
              <input
                type="text"
                value={dailyOverMessageStr}
                onChange={(e) => {
                  setSavedNotice(null);
                  setDailyOverMessageStr(e.target.value);
                }}
                className="w-full bg-white border border-[#D5D0F9] rounded-xl px-3 py-2 text-[11px] text-[#171262] font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-[#171262] mb-1">
                Big Overtime Supervisor Line
              </label>
              <input
                type="text"
                value={bigOverSupervisorMessageStr}
                onChange={(e) => {
                  setSavedNotice(null);
                  setBigOverSupervisorMessageStr(e.target.value);
                }}
                className="w-full bg-white border border-[#D5D0F9] rounded-xl px-3 py-2 text-[11px] text-[#171262] font-medium"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2.5 rounded-xl border border-[#E4E7F2] text-[#5C5A85] hover:text-[#171262] font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Default Times (20 mins)</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-[#251B7C] hover:bg-[#171262] text-white font-black text-sm flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Save className="w-4 h-4 text-cyan-300" />
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      </form>

      {/* 5. Supervisor PIN Change (Stored in Script Properties SUPERVISOR_PIN) */}
      <div className="pt-4 border-t border-[#E4E7F2]">
        <form onSubmit={handlePinSubmit} className="space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#4D3FDC]" />
            <h4 className="font-bold text-sm text-[#171262]">
              Change Supervisor PIN
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-[#5C5A85] mb-1">
                Current Supervisor PIN
              </label>
              <input
                type="password"
                required
                placeholder="Current PIN..."
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl px-3 py-2 text-xs font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#5C5A85] mb-1">
                New Supervisor PIN (4+ digits)
              </label>
              <input
                type="password"
                required
                placeholder="New PIN..."
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl px-3 py-2 text-xs font-mono font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={savingPin}
              className="bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-bold py-2 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer h-[36px]"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{savingPin ? 'Updating...' : 'Update Kiosk PIN'}</span>
            </button>
          </div>
          {pinMsg && (
            <p className={`text-xs font-bold flex items-center gap-1 ${pinMsg.isError ? 'text-rose-600' : 'text-emerald-600'}`}>
              {pinMsg.isError ? <AlertTriangle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
              <span>{pinMsg.text}</span>
            </p>
          )}
        </form>
      </div>
      <span
        hidden
        data-system-architect={_SETTINGS_DEV_META.fullName}
        data-created-by={_SETTINGS_DEV_META.createdByLabel}
        data-signature={_SETTINGS_DEV_META.signatureHash}
      />
    </div>
  );
}
