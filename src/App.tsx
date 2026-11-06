import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Sun,
  Moon,
  Clock,
  Play,
  Square,
  Users,
  FileSpreadsheet,
  BarChart3,
  Settings,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Search,
  ExternalLink,
  Check,
  RefreshCw,
  Info,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
  RotateCcw,
  KeyRound,
  Lock,
  BadgeCheck,
  LayoutGrid,
  Calendar,
  Tablet,
  WifiOff,
  Flag,
  LogOut,
  UserCheck
} from 'lucide-react';
import EmployeeKiosk from './EmployeeKiosk';
import KioskSettingsCard from './KioskSettingsCard';
import { LoginPage, AccountPasswordManagerCard } from './LoginPage';
import {
  pushCloudStationSync,
  pullCloudStationSync,
  subscribeToCloudStationSync,
  CloudStationSyncPayload,
} from './firebase';
import {
  KioskSettings,
  DEFAULT_KIOSK_SETTINGS,
  AuthAccount,
  AUTH_ACCOUNTS_STORAGE_KEY,
  AUTH_SESSION_STORAGE_KEY,
  AUTH_SCHEMA_VERSION,
  ACTIVE_TAB_STORAGE_KEY,
  getStoredAuthAccounts,
  saveStoredAuthAccounts,
  mergeAuthAccounts,
  getStoredAuthSession,
  saveStoredAuthSession,
  clearStoredAuthSession,
  normalizeAuthAccounts,
  isValidSupervisorOrManagerPassword,
  mergeState,
  syncEmbeddedHtmlStateToLocalStorage,
  getDubaiTimeInfo,
  isUsingDefaultPin,
  verifyPinOnServer,
  getShiftBreakSlots,
  getEffectiveBreakMins,
  getShiftTotalBreakMins,
  calculateMonthlyEntitledMins,
  saveKioskSettingsOnServer,
  resolveBreakSlot,
  safeGetStorage,
  safeSetStorage,
  loadStorageWithIdbFallback,
  MAIN_STORAGE_KEY,
  KIOSK_LOCK_STORAGE_KEY,
  KIOSK_SETTINGS_STORAGE_KEY,
  isLocalFileProtocol,
  getPersistedKioskLock,
  setPersistedKioskLock,
  getWashmenLogoSrc,
  downloadOrShareFile,
  downloadSelfContainedHtml,
  isLogInCurrentShiftCycle,
  getVerifiedDeveloperMetadata,
  attachSafeCreditWatchdog,
  WASHMEN_LOGO_FALLBACK
} from './kioskTypes';

// Secondary independent character-code sequence for Udara Fernando
const _APP_DEV_CODES: readonly number[] = [85, 100, 97, 114, 97, 32, 70, 101, 114, 110, 97, 110, 100, 111];
const _APP_VERIFIED_DEV = (() => {
  const meta = getVerifiedDeveloperMetadata();
  const fallbackName = String.fromCharCode(..._APP_DEV_CODES);
  return {
    ...meta,
    fullName: meta.fullName || fallbackName,
    createdByLabel: meta.createdByLabel || `Created By ${fallbackName}`,
  };
})();

// --- INITIAL ROSTER DATA WITH OFFICIAL EMPLOYEE IDS (EXCLUDING MANAGER & SUPERVISORS: VENKATESH, SHIVA, PREM, AQEEB) ---
const EXCLUDED_EMP_IDS = ['1177', '1137', '1135', '1131'];
const INITIAL_STAFF: { empId: string; name: string; designation: string; shift: 'Morning' | 'Night' }[] = [
  // Morning Shift (15 staff)
  { empId: '1379', name: 'Sharif Chowdhury', designation: 'Quality control - 2', shift: 'Morning' },
  { empId: '1870', name: 'Adarsh Nirmal', designation: 'Sorter - 1', shift: 'Morning' },
  { empId: '2030', name: 'Ezra Opondo', designation: 'Sorter - 2', shift: 'Morning' },
  { empId: '1448', name: 'Udara Fernando', designation: 'Sorter - 4', shift: 'Morning' },
  { empId: '1705', name: 'Jitendra Teli', designation: 'Sorter - 6', shift: 'Morning' },
  { empId: '1294', name: 'Ziyaurrahman', designation: 'Washerman - 2', shift: 'Morning' },
  { empId: '1856', name: 'Sandip Kumar', designation: 'Washerman - 6', shift: 'Morning' },
  { empId: '1845', name: 'Abdulah Liaquat', designation: 'Dryerman - 3', shift: 'Morning' },
  { empId: '1783', name: 'Suman BK', designation: 'Packer - 3', shift: 'Morning' },
  { empId: '1848', name: 'Pallabi Mitra', designation: 'Folder - 2', shift: 'Morning' },
  { empId: '1308', name: 'Neelas kumar', designation: 'Folder - 3', shift: 'Morning' },
  { empId: '1387', name: 'Vittu Kumar', designation: 'Folder - 6', shift: 'Morning' },
  { empId: '1524', name: 'Ajith Kumar', designation: 'Folder - 7', shift: 'Morning' },
  { empId: '1717', name: 'Anita Karki', designation: 'Folder - 9', shift: 'Morning' },
  { empId: '1829', name: 'Binita Lama', designation: 'Folder - 10', shift: 'Morning' },
  // Night Shift (17 staff)
  { empId: '1230', name: 'Raymart Isit Adolfo', designation: 'Quality control - 1', shift: 'Night' },
  { empId: '2031', name: 'Jack', designation: 'Sorter - 3', shift: 'Night' },
  { empId: '1977', name: 'Narayan bhandri', designation: 'Sorter - 5', shift: 'Night' },
  { empId: '1801', name: 'Bhavesh Kumar', designation: 'Washerman - 1', shift: 'Night' },
  { empId: '1687', name: 'Chok Bahadur', designation: 'Washerman - 3', shift: 'Night' },
  { empId: '1479', name: 'Shekar Chitlapally', designation: 'Washerman - 4', shift: 'Night' },
  { empId: '1599', name: 'Sujit jana', designation: 'Washerman - 5', shift: 'Night' },
  { empId: '1786', name: 'Srikanth Chakali', designation: 'Dryerman - 1', shift: 'Night' },
  { empId: '1810', name: 'Nikhil', designation: 'Dryerman - 2', shift: 'Night' },
  { empId: '1904', name: 'Gokul Kumar', designation: 'Dryerman - 4', shift: 'Night' },
  { empId: '1837', name: 'Aman Kumar', designation: 'Packer - 1', shift: 'Night' },
  { empId: '1242', name: 'Harish Ahmed', designation: 'Packer - 2', shift: 'Night' },
  { empId: '1478', name: 'Anand Kumar', designation: 'Packer - 4', shift: 'Night' },
  { empId: '1895', name: 'Nichale', designation: 'Folder - 1', shift: 'Night' },
  { empId: '1317', name: 'Carine Ngeum', designation: 'Folder - 4', shift: 'Night' },
  { empId: '1727', name: 'Rita Rijal', designation: 'Folder - 5', shift: 'Night' },
  { empId: '2027', name: 'Manoj Lankadasari', designation: 'Folder - 8', shift: 'Night' },
];

export interface StaffMember {
  id: string;
  empId: string;
  name: string;
  designation?: string;
  shift: 'Morning' | 'Night';
  department: string;
  active: boolean;
  updatedAt?: string;
}

export interface ActiveBreak {
  id: string;
  staffId: string;
  empId?: string;
  staffName: string;
  shift: 'Morning' | 'Night';
  breakType: string;
  breakSlot?: 1 | 2 | 3;
  startTime: string; // ISO
  allottedMins: number;
  source?: 'kiosk' | 'supervisor';
  deviceTimestamp?: string;
  testMode?: boolean;
}

export interface BreakLog {
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
  date: string; // YYYY-MM-DD
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

const STORAGE_KEY = MAIN_STORAGE_KEY;

function detectInitialKioskMode(): boolean {
  const win = window as unknown as { __GAS_INITIAL_MODE__?: string };
  if (win.__GAS_INITIAL_MODE__ && win.__GAS_INITIAL_MODE__.toLowerCase() === 'kiosk') {
    return true;
  }
  try {
    const href = String(window.location.href || '');
    if (href.includes('mode=kiosk')) return true;
  } catch {}
  if (getPersistedKioskLock()) {
    return true;
  }
  return false;
}

export default function App() {
  // Navigation & Shift (auto-detect Morning/Night from Asia/Dubai time)
  const [currentShift, setCurrentShift] = useState<'Morning' | 'Night'>(() => getDubaiTimeInfo(new Date()).autoShift);
  const [isKioskLocked, setIsKioskLockedState] = useState<boolean>(() => detectInitialKioskMode());
  const [currentTab, setCurrentTabState] = useState<'dashboard' | 'kiosk' | 'roster' | 'logs' | 'report' | 'settings'>(() => {
    if (detectInitialKioskMode()) return 'kiosk';
    const savedTab = safeGetStorage(ACTIVE_TAB_STORAGE_KEY);
    if (
      savedTab === 'dashboard' ||
      savedTab === 'kiosk' ||
      savedTab === 'roster' ||
      savedTab === 'logs' ||
      savedTab === 'report' ||
      savedTab === 'settings'
    ) {
      return savedTab;
    }
    return 'dashboard';
  });

  const setCurrentTab = useCallback((tab: 'dashboard' | 'kiosk' | 'roster' | 'logs' | 'report' | 'settings') => {
    setCurrentTabState(tab);
    safeSetStorage(ACTIVE_TAB_STORAGE_KEY, tab);
  }, []);

  const setIsKioskLocked = useCallback((locked: boolean) => {
    setIsKioskLockedState(locked);
    setPersistedKioskLock(locked);
  }, []);

  // Core State
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activeBreaks, setActiveBreaks] = useState<ActiveBreak[]>([]);
  const [logs, setLogs] = useState<BreakLog[]>([]);
  const [deletedLogs, setDeletedLogs] = useState<string[]>([]);
  const [deletedStaff, setDeletedStaff] = useState<string[]>([]);
  const [closedBreakIds, setClosedBreakIds] = useState<string[]>([]);
  const [kioskSettings, setKioskSettings] = useState<KioskSettings>(() => {
    try {
      const dedicatedRaw = safeGetStorage(KIOSK_SETTINGS_STORAGE_KEY);
      if (dedicatedRaw) {
        const parsedDedicated = JSON.parse(dedicatedRaw);
        if (parsedDedicated && typeof parsedDedicated === 'object') {
          return { ...DEFAULT_KIOSK_SETTINGS, ...parsedDedicated };
        }
      }
      const savedMain = safeGetStorage(STORAGE_KEY);
      if (savedMain) {
        const parsedMain = JSON.parse(savedMain);
        if (parsedMain?.kioskSettings) {
          return { ...DEFAULT_KIOSK_SETTINGS, ...parsedMain.kioskSettings };
        }
      }
    } catch {}
    return DEFAULT_KIOSK_SETTINGS;
  });
  const [isDefaultPin, setIsDefaultPin] = useState<boolean>(() => isUsingDefaultPin());
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    isLocalFileProtocol() ? false : typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const isStorageHydratedRef = useRef<boolean>(false);
  const hasReceivedCloudSnapshotRef = useRef<boolean>(false);

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Restore Default Roster In-Page Confirmation Modal (replaces confirm())
  const [restoreRosterModalOpen, setRestoreRosterModalOpen] = useState<boolean>(false);

  // 1 Manager & 4 Supervisors Login Accounts + Active Session State (persists across page refresh until Logout button clicked)
  const [authAccounts, setAuthAccounts] = useState<AuthAccount[]>(() => getStoredAuthAccounts());
  const [loggedInAccount, setLoggedInAccount] = useState<AuthAccount | null>(() =>
    getStoredAuthSession(getStoredAuthAccounts())
  );
  const [logDeleteWarning, setLogDeleteWarning] = useState<string>('');

  const handleUpdateAuthAccounts = useCallback(
    (nextAccounts: AuthAccount[]) => {
      const normalized = saveStoredAuthAccounts(nextAccounts);
      setAuthAccounts(normalized);
      stateRef.current = {
        ...stateRef.current,
        authAccounts: normalized,
      };
      if (loggedInAccount) {
        const updatedCurrent = normalized.find((a) => a.id === loggedInAccount.id);
        if (updatedCurrent) {
          setLoggedInAccount(updatedCurrent);
          saveStoredAuthSession(updatedCurrent);
        }
      }
      void pushCloudStationSync({
        authAccounts: normalized,
        staff: stateRef.current.staff,
        activeBreaks: stateRef.current.activeBreaks,
        logs: stateRef.current.logs,
        deletedLogs: stateRef.current.deletedLogs,
        deletedStaff: stateRef.current.deletedStaff,
        closedBreakIds: stateRef.current.closedBreakIds,
        kioskSettings: stateRef.current.kioskSettings,
        updatedByRole: loggedInAccount?.role || 'Manager',
        updatedAtMs: Date.now(),
      });
    },
    [loggedInAccount]
  );

  // Settings Tab Server PIN Protection
  const [settingsPinUnlocked, setSettingsPinUnlocked] = useState<boolean>(() =>
    Boolean(getStoredAuthSession(getStoredAuthAccounts()))
  );
  const [verifiedSupervisorPin, setVerifiedSupervisorPin] = useState<string>('0000');
  const [settingsPinInput, setSettingsPinInput] = useState<string>('');
  const [settingsPinError, setSettingsPinError] = useState<string>('');
  const [verifyingSettingsPin, setVerifyingSettingsPin] = useState<boolean>(false);

  // Quick Start Form
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedBreakType, setSelectedBreakType] = useState<string>('Breakfast');

  // Stop Modal State
  const [stopModalBreak, setStopModalBreak] = useState<ActiveBreak | null>(null);
  const [exceptionReason, setExceptionReason] = useState<string>('Normal');
  const [customMinutesStr, setCustomMinutesStr] = useState<string>('');
  const [supervisorNotes, setSupervisorNotes] = useState<string>('');

  // Staff Add/Edit Modal State
  const [staffModalOpen, setStaffModalOpen] = useState<boolean>(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffFormEmpId, setStaffFormEmpId] = useState<string>('');
  const [staffFormName, setStaffFormName] = useState<string>('');
  const [staffFormDesignation, setStaffFormDesignation] = useState<string>('');
  const [staffFormShift, setStaffFormShift] = useState<'Morning' | 'Night'>('Morning');

  // Staff Delete Confirmation Modal State
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);

  // Supervisor Password-Protected Break Reset Modal State
  const [resetModalStaff, setResetModalStaff] = useState<StaffMember | null>(null);
  const [supervisorPasswordInput, setSupervisorPasswordInput] = useState<string>('');
  const [supervisorPasswordError, setSupervisorPasswordError] = useState<string>('');
  const [supervisorUnlocked, setSupervisorUnlocked] = useState<boolean>(false);
  const [resetActionType, setResetActionType] = useState<'zero' | 'custom' | 'clearBreak'>('zero');
  const [resetCustomHoursStr, setResetCustomHoursStr] = useState<string>('');
  const [resetCustomMinsStr, setResetCustomMinsStr] = useState<string>('');
  const resetHoursInputRef = useRef<HTMLInputElement | null>(null);
  const resetMinsInputRef = useRef<HTMLInputElement | null>(null);
  const [targetBreakToClear, setTargetBreakToClear] = useState<string>('Breakfast');
  const [continueFromBreak, setContinueFromBreak] = useState<string>('Breakfast');
  const [autoStartTimer, setAutoStartTimer] = useState<boolean>(false);
  const [supervisorResetNotes, setSupervisorResetNotes] = useState<string>('');

  // Roster Filters
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [rosterShiftFilter, setRosterShiftFilter] = useState<'Current' | 'All' | 'Morning' | 'Night'>('Current');

  // Log Filters
  const [logDateFilter, setLogDateFilter] = useState<string>(() => getDubaiTimeInfo(new Date()).dateStr);
  const [logShiftFilter, setLogShiftFilter] = useState<string>('All');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('All');
  const [logSearch, setLogSearch] = useState<string>('');

  // Monthly Report Filters
  const [reportMonth, setReportMonth] = useState<string>(() => getDubaiTimeInfo(new Date()).dateStr.slice(0, 7));
  const [reportShiftFilter, setReportShiftFilter] = useState<string>('All');

  // Toast System
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'warning' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Developer Profile Modal
  const [devModalOpen, setDevModalOpen] = useState<boolean>(false);

  // Master Dashboard Reset with Password Modal
  const [dashboardResetModalOpen, setDashboardResetModalOpen] = useState<boolean>(false);
  const [dashboardResetPassword, setDashboardResetPassword] = useState<string>('');
  const [dashboardResetError, setDashboardResetError] = useState<string>('');
  const [dashboardResetAction, setDashboardResetAction] = useState<'today' | 'factory'>('today');

  const showToast = useCallback((message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Sound alert using Web Audio API
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // AudioContext might be restricted until user gesture
    }
  }, [soundEnabled]);

  // Ref holding latest state for serverSync and cloud sync
  const stateRef = useRef({
    staff,
    activeBreaks,
    logs,
    deletedLogs,
    deletedStaff,
    closedBreakIds,
    kioskSettings,
    authAccounts,
  });
  useEffect(() => {
    stateRef.current = {
      staff,
      activeBreaks,
      logs,
      deletedLogs,
      deletedStaff,
      closedBreakIds,
      kioskSettings,
      authAccounts,
    };
  }, [staff, activeBreaks, logs, deletedLogs, deletedStaff, closedBreakIds, kioskSettings, authAccounts]);

  // Helper to apply incoming cloud snapshot cleanly as authoritative state into local state & storage
  const applyCloudSnapshotToLocal = useCallback((cloudData: CloudStationSyncPayload) => {
    try {
      hasReceivedCloudSnapshotRef.current = true;
      isStorageHydratedRef.current = true;

      const localAccounts = stateRef.current.authAccounts;
      const mergedAccounts = saveStoredAuthAccounts(
        mergeAuthAccounts(localAccounts, cloudData.authAccounts)
      );
      setAuthAccounts(mergedAccounts);
      setLoggedInAccount((prevLogged) => {
        if (!prevLogged) return null;
        const updatedCurrent = mergedAccounts.find((a) => a.id === prevLogged.id);
        if (updatedCurrent) {
          saveStoredAuthSession(updatedCurrent);
          return updatedCurrent;
        }
        return prevLogged;
      });

      const delStaffSet = new Set<string>(
        Array.isArray(cloudData.deletedStaff) ? cloudData.deletedStaff : []
      );
      const delLogSet = new Set<string>(
        Array.isArray(cloudData.deletedLogs) ? cloudData.deletedLogs : []
      );
      const closedBreakSet = new Set<string>(
        Array.isArray(cloudData.closedBreakIds) ? cloudData.closedBreakIds : []
      );

      const rawCloudStaff =
        Array.isArray(cloudData.staff) && cloudData.staff.length > 0
          ? (cloudData.staff as StaffMember[])
          : stateRef.current.staff;
      const cleanedStaff = rawCloudStaff.filter(
        (s) => !EXCLUDED_EMP_IDS.includes(String(s.empId)) && !delStaffSet.has(s.id)
      );

      const nextActiveBreaks = Array.isArray(cloudData.activeBreaks)
        ? (cloudData.activeBreaks as ActiveBreak[]).filter((b) => !closedBreakSet.has(b.id))
        : stateRef.current.activeBreaks;

      const nextLogs = Array.isArray(cloudData.logs)
        ? (cloudData.logs as BreakLog[]).filter((l) => !delLogSet.has(l.id))
        : stateRef.current.logs;

      const nextSettings: KioskSettings = cloudData.kioskSettings
        ? { ...DEFAULT_KIOSK_SETTINGS, ...cloudData.kioskSettings }
        : stateRef.current.kioskSettings;

      const nextDeletedLogs = Array.from(delLogSet);
      const nextDeletedStaff = Array.from(delStaffSet);
      const nextClosedBreakIds = Array.from(closedBreakSet);

      stateRef.current = {
        staff: cleanedStaff,
        activeBreaks: nextActiveBreaks,
        logs: nextLogs,
        deletedLogs: nextDeletedLogs,
        deletedStaff: nextDeletedStaff,
        closedBreakIds: nextClosedBreakIds,
        kioskSettings: nextSettings,
        authAccounts: mergedAccounts,
      };

      if (cleanedStaff.length > 0) {
        setStaff(cleanedStaff);
      }
      setActiveBreaks(nextActiveBreaks);
      setLogs(nextLogs);
      setDeletedLogs(nextDeletedLogs);
      setDeletedStaff(nextDeletedStaff);
      setClosedBreakIds(nextClosedBreakIds);
      setKioskSettings(nextSettings);

      safeSetStorage(
        STORAGE_KEY,
        JSON.stringify({
          staff: cleanedStaff,
          activeBreaks: nextActiveBreaks,
          logs: nextLogs,
          deletedLogs: nextDeletedLogs,
          deletedStaff: nextDeletedStaff,
          closedBreakIds: nextClosedBreakIds,
          kioskSettings: nextSettings,
          authAccounts: mergedAccounts,
        })
      );
      safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
      safeSetStorage(AUTH_ACCOUNTS_STORAGE_KEY, JSON.stringify(mergedAccounts));
    } catch (err) {
      console.error('Failed to apply cloud sync snapshot:', err);
    }
  }, []);

  // Shared serverSync function (pushes authoritative state on explicit user actions; pulls read-only when called from background interval)
  const serverSync = useCallback(
    (overridePartial?: Partial<typeof stateRef.current>) => {
      if (!overridePartial) {
        // Read-only pull from Firestore when invoked by background polling/online listener
        void pullCloudStationSync().then((cloudData) => {
          if (cloudData) {
            setIsOffline(false);
            applyCloudSnapshotToLocal(cloudData);
          }
        });
      } else {
        // Authoritative mutation: never merge stale localStorage back into overridePartial
        const payload = {
          ...stateRef.current,
          ...overridePartial,
        };
        isStorageHydratedRef.current = true;
        try {
          const delStaffSet = new Set<string>(payload.deletedStaff || []);
          const nextStaffCleaned = (payload.staff || []).filter(
            (s) => !EXCLUDED_EMP_IDS.includes(String(s.empId)) && !delStaffSet.has(s.id)
          );
          const nextAccounts = normalizeAuthAccounts(payload.authAccounts);
          const nextSettings = { ...DEFAULT_KIOSK_SETTINGS, ...payload.kioskSettings };

          stateRef.current = {
            staff: nextStaffCleaned,
            activeBreaks: payload.activeBreaks || [],
            logs: payload.logs || [],
            deletedLogs: payload.deletedLogs || [],
            deletedStaff: payload.deletedStaff || [],
            closedBreakIds: payload.closedBreakIds || [],
            kioskSettings: nextSettings,
            authAccounts: nextAccounts,
          };

          safeSetStorage(
            STORAGE_KEY,
            JSON.stringify({
              ...stateRef.current,
              _updatedAtMs: Date.now(),
            })
          );
          safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
          saveStoredAuthAccounts(nextAccounts);

          setStaff(nextStaffCleaned);
          setActiveBreaks(stateRef.current.activeBreaks);
          setLogs(stateRef.current.logs);
          setDeletedLogs(stateRef.current.deletedLogs);
          setDeletedStaff(stateRef.current.deletedStaff);
          setClosedBreakIds(stateRef.current.closedBreakIds);
          setKioskSettings(nextSettings);
          setAuthAccounts(nextAccounts);

          // Write authoritative state directly to Firebase Firestore so all devices worldwide receive updates immediately
          void pushCloudStationSync(
            {
              authAccounts: nextAccounts,
              staff: nextStaffCleaned,
              activeBreaks: stateRef.current.activeBreaks,
              logs: stateRef.current.logs,
              deletedLogs: stateRef.current.deletedLogs,
              deletedStaff: stateRef.current.deletedStaff,
              closedBreakIds: stateRef.current.closedBreakIds,
              kioskSettings: nextSettings,
              updatedByRole: 'station',
              updatedAtMs: Date.now(),
            },
            false
          );
        } catch {}
      }

    // If running inside Google Apps Script, sync with Google Sheet
    const gas = (window as unknown as {
      google?: {
        script?: {
          run?: {
            withSuccessHandler: (cb: (serverRes: unknown) => void) => {
              withFailureHandler: (errCb: () => void) => {
                syncState: (p: unknown) => void;
              };
            };
          };
        };
      };
    }).google?.script?.run;

    if (gas) {
      gas
        .withSuccessHandler((serverRes: unknown) => {
          setIsOffline(false);
          if (serverRes && typeof serverRes === 'object') {
            const merged = mergeState(stateRef.current, serverRes as Partial<typeof stateRef.current>);
            setStaff(merged.staff.filter((s) => !EXCLUDED_EMP_IDS.includes(String(s.empId))));
            setActiveBreaks(merged.activeBreaks);
            setLogs(merged.logs);
            setDeletedLogs(merged.deletedLogs);
            setDeletedStaff(merged.deletedStaff || []);
            setKioskSettings(merged.kioskSettings);
            if (typeof (serverRes as { isDefaultPin?: boolean }).isDefaultPin === 'boolean') {
              setIsDefaultPin(Boolean((serverRes as { isDefaultPin?: boolean }).isDefaultPin));
            }
            safeSetStorage(STORAGE_KEY, JSON.stringify(merged));
          }
        })
        .withFailureHandler(() => {
          setIsOffline(true);
        })
        .syncState(overridePartial ? { ...stateRef.current, ...overridePartial } : stateRef.current);
    }
  }, [applyCloudSnapshotToLocal]);

  // 1. Initial Load & Persistence (Embedded HTML State -> localStorage -> IndexedDB fallback)
  useEffect(() => {
    // First, check if this index.html file has a newer embedded state (from "Save Updated index.html")
    syncEmbeddedHtmlStateToLocalStorage();

    const applyLoadedJson = (rawJson: string): boolean => {
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed.staff && parsed.staff.length > 0) {
          const delStaffSet = new Set<string>(Array.isArray(parsed.deletedStaff) ? parsed.deletedStaff : []);
          const cleanedStaff = (parsed.staff as StaffMember[]).filter(
            (s) => !EXCLUDED_EMP_IDS.includes(String(s.empId)) && !delStaffSet.has(s.id)
          );
          if (cleanedStaff.length > 0) {
            setStaff(cleanedStaff);
            setActiveBreaks(parsed.activeBreaks || []);
            setLogs(parsed.logs || []);
            setDeletedLogs(parsed.deletedLogs || []);
            setDeletedStaff(Array.from(delStaffSet));
            setClosedBreakIds(parsed.closedBreakIds || []);
            let bestSettings = parsed.kioskSettings
              ? { ...DEFAULT_KIOSK_SETTINGS, ...parsed.kioskSettings }
              : null;
            try {
              const dedicatedRaw = safeGetStorage(KIOSK_SETTINGS_STORAGE_KEY);
              if (dedicatedRaw) {
                const dedicatedParsed = JSON.parse(dedicatedRaw);
                if (
                  dedicatedParsed &&
                  (!bestSettings ||
                    Number(dedicatedParsed.updatedAt || 0) >= Number(bestSettings.updatedAt || 0))
                ) {
                  bestSettings = { ...DEFAULT_KIOSK_SETTINGS, ...dedicatedParsed };
                }
              }
            } catch {}
            if (bestSettings) {
              setKioskSettings(bestSettings);
              safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(bestSettings));
            }
            if (Array.isArray(parsed.authAccounts)) {
              const normAcc = saveStoredAuthAccounts(parsed.authAccounts);
              setAuthAccounts(normAcc);
            }
            return true;
          }
        }
      } catch (err) {
        console.error('Failed to parse storage', err);
      }
      return false;
    };

    loadStorageWithIdbFallback(AUTH_ACCOUNTS_STORAGE_KEY).then((idbAuthRaw) => {
      let latestAccounts = getStoredAuthAccounts();
      if (!hasReceivedCloudSnapshotRef.current && idbAuthRaw) {
        try {
          const parsedAcc = JSON.parse(idbAuthRaw);
          if (Array.isArray(parsedAcc)) {
            latestAccounts = normalizeAuthAccounts(parsedAcc);
            setAuthAccounts(latestAccounts);
          }
        } catch {}
      }
      loadStorageWithIdbFallback(AUTH_SESSION_STORAGE_KEY).then((idbSessionRaw) => {
        if (idbSessionRaw && idbSessionRaw !== 'null' && idbSessionRaw !== '') {
          try {
            const parsedSession = JSON.parse(idbSessionRaw);
            if (
              parsedSession &&
              typeof parsedSession === 'object' &&
              parsedSession.loggedOut !== true &&
              parsedSession.id
            ) {
              const matched = latestAccounts.find(
                (a) =>
                  a.id === parsedSession.id ||
                  a.role.toLowerCase() === String(parsedSession.role || '').toLowerCase() ||
                  a.username.toLowerCase() === String(parsedSession.username || '').toLowerCase()
              );
              if (matched) {
                setLoggedInAccount(matched);
                setSettingsPinUnlocked(matched.role !== 'Display');
              }
            }
          } catch {}
        }
      });
    });

    const saved = safeGetStorage(STORAGE_KEY) || safeGetStorage('washmen_break_tracker_v2');
    if (saved && applyLoadedJson(saved)) {
      isStorageHydratedRef.current = true;
      // Only use IndexedDB fallback if localStorage was empty and cloud hasn't responded yet
      loadStorageWithIdbFallback(KIOSK_LOCK_STORAGE_KEY).then((lockVal) => {
        if (lockVal === 'true') {
          setIsKioskLockedState(true);
          setCurrentTab('kiosk');
        }
      });
      return;
    }

    // Default Initialization first, then check IndexedDB asynchronously BEFORE enabling auto-save
    const defaultStaff: StaffMember[] = INITIAL_STAFF.map((s, idx) => ({
      id: `${s.shift[0]}_${s.empId}_${idx + 1}`,
      empId: s.empId,
      name: s.name,
      designation: s.designation,
      shift: s.shift,
      department: 'Wash & Fold',
      active: true,
    }));
    setStaff(defaultStaff);
    setActiveBreaks([]);
    setLogs([]);

    Promise.all([
      loadStorageWithIdbFallback(STORAGE_KEY),
      loadStorageWithIdbFallback(KIOSK_SETTINGS_STORAGE_KEY),
    ])
      .then(([idbRaw, idbSettingsRaw]) => {
        if (hasReceivedCloudSnapshotRef.current) return;
        if (idbRaw) {
          applyLoadedJson(idbRaw);
        }
        if (idbSettingsRaw) {
          try {
            const parsedS = JSON.parse(idbSettingsRaw);
            if (parsedS && typeof parsedS === 'object') {
              setKioskSettings((prev) =>
                Number(parsedS.updatedAt || 0) >= Number(prev.updatedAt || 0)
                  ? { ...DEFAULT_KIOSK_SETTINGS, ...parsedS }
                  : prev
              );
            }
          } catch {}
        }
      })
      .finally(() => {
        isStorageHydratedRef.current = true;
      });

    loadStorageWithIdbFallback(KIOSK_LOCK_STORAGE_KEY).then((lockVal) => {
      if (lockVal === 'true') {
        setIsKioskLockedState(true);
        setCurrentTab('kiosk');
      }
    });
  }, []);

  // 1b. Real-time Firebase Firestore subscription across all devices worldwide (runs unconditionally on boot)
  useEffect(() => {
    const embeddedTs = syncEmbeddedHtmlStateToLocalStorage();

    const unsubscribeCloud = subscribeToCloudStationSync(
      (cloudData, exists) => {
        if (!exists || !cloudData) {
          const seedToCloud = () => {
            if (stateRef.current.staff.length > 0) {
              void pushCloudStationSync(
                {
                  authAccounts: stateRef.current.authAccounts,
                  staff: stateRef.current.staff,
                  activeBreaks: stateRef.current.activeBreaks,
                  logs: stateRef.current.logs,
                  deletedLogs: stateRef.current.deletedLogs,
                  deletedStaff: stateRef.current.deletedStaff,
                  closedBreakIds: stateRef.current.closedBreakIds,
                  kioskSettings: stateRef.current.kioskSettings,
                  updatedByRole: 'seed',
                  updatedAtMs: Date.now(),
                },
                false
              );
            }
          };
          if (isStorageHydratedRef.current && stateRef.current.staff.length > 0) {
            seedToCloud();
          } else {
            window.setTimeout(seedToCloud, 600);
          }
          return;
        }

        // If this HTML file has a newly embedded state (from "Save Updated index.html") newer than cloudData, push embedded state to Cloud!
        if (embeddedTs > 0 && embeddedTs > Number(cloudData.updatedAtMs || 0)) {
          void pushCloudStationSync(
            {
              authAccounts: stateRef.current.authAccounts,
              staff: stateRef.current.staff,
              activeBreaks: stateRef.current.activeBreaks,
              logs: stateRef.current.logs,
              deletedLogs: stateRef.current.deletedLogs,
              deletedStaff: stateRef.current.deletedStaff || [],
              closedBreakIds: stateRef.current.closedBreakIds || [],
              kioskSettings: stateRef.current.kioskSettings,
              updatedByRole: 'embedded-html-sync',
              updatedAtMs: embeddedTs,
            },
            false
          );
          return;
        }

        const localAccounts = stateRef.current.authAccounts;
        const localSettingsUpdated = Number(stateRef.current.kioskSettings?.updatedAt || 0);
        applyCloudSnapshotToLocal(cloudData);

        // If this browser had a newer password/settings or cloud was missing the 3rd Display account / had older schemaVersion, push updated accounts to Firestore
        const hasLocalNewerPassword = localAccounts.some((lAcc) => {
          const cAcc = (cloudData.authAccounts || []).find((c) => c.id === lAcc.id);
          return (
            Number(lAcc.schemaVersion || 0) >= AUTH_SCHEMA_VERSION &&
            Number(lAcc.updatedAt || 0) > Number(cAcc?.updatedAt || 0)
          );
        });
        const cloudNeedsAccountUpgrade =
          !Array.isArray(cloudData.authAccounts) ||
          cloudData.authAccounts.length < 3 ||
          cloudData.authAccounts.some(
            (c) => Number(c.schemaVersion || 0) < AUTH_SCHEMA_VERSION
          );
        const hasLocalNewerSettings =
          localSettingsUpdated > Number(cloudData.kioskSettings?.updatedAt || 0);
        if (hasLocalNewerPassword || cloudNeedsAccountUpgrade || hasLocalNewerSettings) {
          void pushCloudStationSync(
            {
              authAccounts: stateRef.current.authAccounts,
              staff: stateRef.current.staff,
              activeBreaks: stateRef.current.activeBreaks,
              logs: stateRef.current.logs,
              deletedLogs: stateRef.current.deletedLogs,
              deletedStaff: stateRef.current.deletedStaff || [],
              closedBreakIds: stateRef.current.closedBreakIds || [],
              kioskSettings: stateRef.current.kioskSettings,
              updatedByRole: 'merge-sync',
              updatedAtMs: Date.now(),
            },
            false
          );
        }
      },
      (connected) => {
        if (connected) setIsOffline(false);
      }
    );

    return () => {
      unsubscribeCloud();
    };
  }, [applyCloudSnapshotToLocal]);

  // Save to LocalStorage / IndexedDB / window.name whenever state changes (after initial hydration)
  useEffect(() => {
    if (staff.length > 0 && isStorageHydratedRef.current) {
      safeSetStorage(
        STORAGE_KEY,
        JSON.stringify({
          staff,
          activeBreaks,
          logs,
          deletedLogs,
          deletedStaff,
          closedBreakIds,
          kioskSettings,
          authAccounts,
          _systemArchitect: _APP_VERIFIED_DEV.fullName,
          _createdBy: _APP_VERIFIED_DEV.createdByLabel,
          _developerSignature: _APP_VERIFIED_DEV.signatureHash,
        })
      );
      safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(kioskSettings));
      safeSetStorage(AUTH_ACCOUNTS_STORAGE_KEY, JSON.stringify(authAccounts));
    }
  }, [staff, activeBreaks, logs, deletedLogs, deletedStaff, closedBreakIds, kioskSettings, authAccounts]);

  // Isolated credit container ref & lightweight 30-second throttled watchdog
  const dashboardCreditContainerRef = useRef<HTMLDivElement | null>(null);
  const modalCreditContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-system-architect', _APP_VERIFIED_DEV.fullName);
      document.documentElement.setAttribute('data-created-by', _APP_VERIFIED_DEV.createdByLabel);
      document.documentElement.setAttribute('data-developer-id', _APP_VERIFIED_DEV.signatureHash);
    } catch {}
    return attachSafeCreditWatchdog(
      dashboardCreditContainerRef.current,
      _APP_VERIFIED_DEV.fullName,
      _APP_VERIFIED_DEV.verificationTitle
    );
  }, [currentTab, isKioskLocked]);

  useEffect(() => {
    if (!devModalOpen) return;
    return attachSafeCreditWatchdog(
      modalCreditContainerRef.current,
      _APP_VERIFIED_DEV.fullName,
      _APP_VERIFIED_DEV.verificationTitle
    );
  }, [devModalOpen]);

  // Listen to online/offline/focus events & storage events across tabs/windows + immediate & 4-second Kiosk/Dashboard cloud pull
  useEffect(() => {
    // Immediately pull freshest cloud state whenever tab, kiosk mode, or logged-in account changes
    serverSync();

    const handleOnline = () => {
      setIsOffline(false);
      serverSync();
    };
    const handleOffline = () => {
      if (!isLocalFileProtocol()) setIsOffline(true);
    };
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        serverSync();
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const incoming = JSON.parse(e.newValue);
          if (incoming && typeof incoming === 'object') {
            applyCloudSnapshotToLocal(incoming as CloudStationSyncPayload);
          }
        } catch {}
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('storage', handleStorage);

    // Pull latest server state every 4 seconds in kiosk mode (or every 6 seconds in dashboard mode) alongside real-time onSnapshot
    const syncInterval = setInterval(
      () => {
        serverSync();
      },
      currentTab === 'kiosk' || isKioskLocked ? 4000 : 6000
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('storage', handleStorage);
      clearInterval(syncInterval);
    };
  }, [currentTab, isKioskLocked, loggedInAccount, serverSync]);

  // Clock ticker every second & automatic shift transition 30 minutes before new shift starts
  const lastDetectedAutoShiftRef = useRef<'Morning' | 'Night'>(
    getDubaiTimeInfo(new Date(), kioskSettings).autoShift
  );
  useEffect(() => {
    const detected = getDubaiTimeInfo(currentTime, kioskSettings).autoShift;
    if (detected !== lastDetectedAutoShiftRef.current) {
      lastDetectedAutoShiftRef.current = detected;
      setCurrentShift(detected);
      // Clear any stale active breaks from the previous cycle of the incoming shift so all incoming staff start at 0/3
      setActiveBreaks((prev) => {
        const cleaned = prev.filter(
          (b) => b.shift !== detected || isLogInCurrentShiftCycle(b, currentTime, kioskSettings)
        );
        return cleaned.length === prev.length ? prev : cleaned;
      });
    }
  }, [currentTime, kioskSettings]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Quick staff selection list
  const availableStaffForQuickStart = useMemo(() => {
    return staff
      .filter((s) => s.shift === currentShift && s.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, currentShift]);

  // Statistics (Using Asia/Dubai date & shift-cycle refresh so Night Shift breaks refresh when Night Shift starts in the evening)
  const todayStr = useMemo(() => getDubaiTimeInfo(currentTime, kioskSettings).dateStr, [currentTime, kioskSettings]);
  const validLogs = useMemo(() => logs.filter((l) => !l.voided && !l.deleted && !l.testMode), [logs]);
  const activeBreaksInShift = activeBreaks.filter((b) => b.shift === currentShift);
  const todayLogsInShift = useMemo(
    () =>
      validLogs.filter(
        (l) => l.shift === currentShift && isLogInCurrentShiftCycle(l, currentTime, kioskSettings)
      ),
    [validLogs, currentShift, currentTime, kioskSettings]
  );
  const overtimeCountToday = todayLogsInShift.filter(
    (l) => l.varianceMins > Number(kioskSettings.graceMins ?? 1)
  ).length;

  // Helper: resolve the saved allotted minutes on an active break or log, falling back to current shift settings
  const resolveAllottedMins = useCallback(
    (item: { allottedMins?: number; breakType: string; breakSlot?: number; shift: 'Morning' | 'Night' }): number => {
      const saved = Number(item.allottedMins);
      if (Number.isFinite(saved) && saved > 0) return saved;
      const slots = getShiftBreakSlots(kioskSettings, item.shift);
      const slot = resolveBreakSlot(item.breakType, item.breakSlot, kioskSettings);
      return slot ? slots[slot - 1].mins : slots[0].mins;
    },
    [kioskSettings]
  );

  // Shared Start Break Helper (reused by both Supervisor Dashboard & Employee Kiosk)
  const startBreakForStaff = useCallback(
    (
      employee: StaffMember,
      breakType: string,
      requestedMins?: number,
      source: 'kiosk' | 'supervisor' = 'supervisor',
      explicitSlot?: 1 | 2 | 3
    ): ActiveBreak | null => {
      const existing = activeBreaks.find((b) => b.staffId === employee.id);
      if (existing) {
        showToast(`${employee.name} is ALREADY on active ${existing.breakType} break!`, 'danger');
        return null;
      }

      const shiftSlots = getShiftBreakSlots(kioskSettings, employee.shift);
      const resolvedSlot = explicitSlot || resolveBreakSlot(breakType, undefined, kioskSettings) || undefined;
      const configuredMins =
        typeof requestedMins === 'number' && requestedMins > 0
          ? requestedMins
          : resolvedSlot
          ? shiftSlots[resolvedSlot - 1].mins
          : Number(kioskSettings.allowedMins[breakType]) || shiftSlots[0].mins;

      const effectiveAllottedMins = getEffectiveBreakMins(kioskSettings, configuredMins);
      const isTestBreak = Boolean(kioskSettings.testMode);
      const nowIso = new Date().toISOString();
      const newBreak: ActiveBreak = {
        id: 'BRK_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        staffId: employee.id,
        empId: employee.empId,
        staffName: employee.name,
        shift: employee.shift,
        breakType,
        breakSlot: resolvedSlot,
        startTime: nowIso,
        allottedMins: effectiveAllottedMins,
        source,
        deviceTimestamp: nowIso,
        testMode: isTestBreak,
      };

      const nextActive = [...activeBreaks, newBreak];
      setActiveBreaks(nextActive);
      serverSync({ activeBreaks: nextActive });
      return newBreak;
    },
    [activeBreaks, kioskSettings, serverSync, showToast]
  );

  // Handle Supervisor Start Break Form
  const handleStartBreak = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      showToast('Please select a staff member', 'warning');
      return;
    }

    const employee = staff.find((s) => s.id === selectedStaffId);
    if (!employee) return;

    const shiftSlots = getShiftBreakSlots(kioskSettings, employee.shift);
    const matchingSlot =
      shiftSlots.find((s) => s.name === selectedBreakType) ||
      shiftSlots.find((s) => s.slot === resolveBreakSlot(selectedBreakType, undefined, kioskSettings));
    const configuredMins = matchingSlot
      ? matchingSlot.mins
      : Number(kioskSettings.allowedMins[selectedBreakType]) || shiftSlots[0].mins;
    const effectiveMins = getEffectiveBreakMins(kioskSettings, configuredMins);

    const created = startBreakForStaff(
      employee,
      matchingSlot ? matchingSlot.name : selectedBreakType,
      effectiveMins,
      'supervisor',
      matchingSlot?.slot
    );
    if (created) {
      setSelectedStaffId('');
      showToast(
        `Started ${created.allottedMins}m ${created.breakType} break for ${employee.name} (ID: ${employee.empId})`,
        'success'
      );
    }
  };

  // Open Stop Break Modal (Supervisor)
  const openStopBreakModal = (brk: ActiveBreak) => {
    setStopModalBreak(brk);
    setExceptionReason('Normal');
    setSupervisorNotes('');
    const rawElapsed = Math.floor((new Date().getTime() - new Date(brk.startTime).getTime()) / 1000);
    const approxMins = Math.max(1, Math.round(rawElapsed / 60));
    setCustomMinutesStr(String(approxMins));
  };

  // Shared Stop & Save Completed Break Logic (reused by Supervisor Modal & Kiosk Return)
  const completeAndSaveBreak = useCallback(
    (
      brk: ActiveBreak,
      options: {
        durationMins: number;
        exceptionReason: string;
        notes?: string;
        source: 'kiosk' | 'supervisor';
        voided?: boolean;
        needsReview?: boolean;
      }
    ): BreakLog => {
      const now = new Date();
      const nowIso = now.toISOString();
      const dubaiDate = getDubaiTimeInfo(now).dateStr;
      const allotted = resolveAllottedMins(brk);
      const variance = options.voided ? 0 : options.durationMins - allotted;
      const resolvedSlot = brk.breakSlot || resolveBreakSlot(brk.breakType, undefined, kioskSettings) || undefined;
      const isTestBreak = Boolean(brk.testMode || kioskSettings.testMode);

      const newLog: BreakLog = {
        id: 'LOG_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        staffId: brk.staffId,
        empId: brk.empId,
        staffName: brk.staffName,
        shift: brk.shift,
        breakType: brk.breakType,
        breakSlot: resolvedSlot,
        startTime: brk.startTime,
        endTime: nowIso,
        durationMins: options.voided ? 0 : options.durationMins,
        allottedMins: allotted,
        varianceMins: variance,
        exceptionReason: options.exceptionReason,
        notes: options.notes,
        date: dubaiDate,
        source: options.source,
        voided: Boolean(options.voided),
        needsReview: Boolean(options.needsReview),
        deviceTimestamp: nowIso,
        activeBreakId: brk.id,
        testMode: isTestBreak,
      };

      const nextActive = activeBreaks.filter((b) => b.id !== brk.id && b.staffId !== brk.staffId);
      const nextLogs = [newLog, ...logs];
      const nextClosed = [...closedBreakIds, brk.id];

      setActiveBreaks(nextActive);
      setLogs(nextLogs);
      setClosedBreakIds(nextClosed);
      serverSync({
        activeBreaks: nextActive,
        logs: nextLogs,
        closedBreakIds: nextClosed,
      });

      return newLog;
    },
    [activeBreaks, logs, closedBreakIds, kioskSettings, resolveAllottedMins, serverSync]
  );

  // Save Stop Break from Supervisor Modal
  const saveCompletedBreak = () => {
    if (!stopModalBreak) return;

    const now = new Date();
    const rawElapsedSeconds = Math.floor((now.getTime() - new Date(stopModalBreak.startTime).getTime()) / 1000);
    let finalDurationMins = Math.max(1, Math.round(rawElapsedSeconds / 60));
    const parsedCustom = parseInt(customMinutesStr, 10);
    const savedAllotted = resolveAllottedMins(stopModalBreak);

    if (exceptionReason === 'Supervisor Forgot') {
      finalDurationMins = !isNaN(parsedCustom) && parsedCustom > 0 ? parsedCustom : savedAllotted;
    } else if (['Interrupted Early', 'Manual Override', 'Approved Extended'].includes(exceptionReason)) {
      finalDurationMins = !isNaN(parsedCustom) && parsedCustom > 0 ? parsedCustom : finalDurationMins;
    }

    completeAndSaveBreak(stopModalBreak, {
      durationMins: finalDurationMins,
      exceptionReason,
      notes: supervisorNotes.trim() || undefined,
      source: 'supervisor',
      voided: false,
      needsReview: false,
    });

    setStopModalBreak(null);
    showToast(`Break completed for ${stopModalBreak.staffName} (${finalDurationMins}m)`, 'success');
  };

  // Stop Break from Employee Kiosk
  const handleStopBreakFromKiosk = useCallback(
    (
      brk: ActiveBreak,
      overrideElapsedSecs?: number,
      needsReview: boolean = false,
      reviewReason?: string
    ): BreakLog | null => {
      const elapsedSecs =
        typeof overrideElapsedSecs === 'number'
          ? overrideElapsedSecs
          : Math.max(0, Math.floor((Date.now() - new Date(brk.startTime).getTime()) / 1000));
      const durationMins = Math.max(1, Math.round(elapsedSecs / 60));
      const allowed = resolveAllottedMins(brk);
      const grace = Number(kioskSettings.graceMins ?? 1);
      const isOvertime = durationMins > allowed + grace;

      const reason = needsReview
        ? reviewReason || 'Employee Requested Review'
        : isOvertime
        ? 'Returned Late'
        : 'Normal';

      return completeAndSaveBreak(brk, {
        durationMins,
        exceptionReason: reason,
        notes: reviewReason ? `Kiosk note: ${reviewReason}` : 'Stopped at Employee Kiosk',
        source: 'kiosk',
        voided: false,
        needsReview: needsReview || durationMins > allowed + Number(kioskSettings.bigOvertimeMins ?? 15),
      });
    },
    [completeAndSaveBreak, resolveAllottedMins, kioskSettings.graceMins, kioskSettings.bigOvertimeMins]
  );

  // Void Break within 60 seconds ("Started by mistake? Cancel")
  const handleVoidBreakFromKiosk = useCallback(
    (brk: ActiveBreak) => {
      completeAndSaveBreak(brk, {
        durationMins: 0,
        exceptionReason: 'Voided (Started by mistake <60s)',
        notes: 'Cancelled by employee within 60 seconds of start',
        source: 'kiosk',
        voided: true,
        needsReview: false,
      });
      showToast(`Cancelled ${brk.breakType} break for ${brk.staffName} (Voided)`, 'info');
    },
    [completeAndSaveBreak, showToast]
  );

  // Flag an already-completed break log for supervisor review from Kiosk Result screen
  const handleFlagLogForReview = useCallback(
    (logId: string, reason: string) => {
      const nextLogs = logs.map((l) =>
        l.id === logId
          ? {
              ...l,
              needsReview: true,
              exceptionReason: reason,
              notes: l.notes ? `${l.notes} • Employee flagged: ${reason}` : `Employee flagged: ${reason}`,
            }
          : l
      );
      setLogs(nextLogs);
      serverSync({ logs: nextLogs });
      showToast('Flagged for supervisor review', 'info');
    },
    [logs, serverSync, showToast]
  );

  // Add/Edit Staff Handler
  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffFormName.trim()) return;
    const nowIso = new Date().toISOString();

    if (editingStaffId) {
      const nextStaff = staff.map((s) =>
        s.id === editingStaffId
          ? {
              ...s,
              empId: staffFormEmpId.trim() || s.empId,
              name: staffFormName.trim(),
              designation: staffFormDesignation.trim() || s.designation,
              shift: staffFormShift,
              updatedAt: nowIso,
            }
          : s
      );
      setStaff(nextStaff);
      serverSync({ staff: nextStaff });
      showToast('Staff member updated and saved permanently', 'success');
    } else {
      const newStaff: StaffMember = {
        id: 'STF_' + Date.now(),
        empId: staffFormEmpId.trim() || String(Math.floor(1000 + Math.random() * 9000)),
        name: staffFormName.trim(),
        designation: staffFormDesignation.trim() || 'Team Member',
        shift: staffFormShift,
        department: 'Wash & Fold',
        active: true,
        updatedAt: nowIso,
      };
      const nextStaff = [...staff, newStaff];
      setStaff(nextStaff);
      serverSync({ staff: nextStaff });
      showToast(`Added ${newStaff.name} (ID: ${newStaff.empId}) to ${newStaff.shift} Shift`, 'success');
    }

    setStaffModalOpen(false);
    setEditingStaffId(null);
    setStaffFormEmpId('');
    setStaffFormName('');
    setStaffFormDesignation('');
  };

  // Open Reset & Adjustment Modal for individual person
  const openResetModal = (st: StaffMember) => {
    const shiftSlots = getShiftBreakSlots(kioskSettings, st.shift);
    const firstSlotName = shiftSlots[0]?.name || 'Breakfast';
    setResetModalStaff(st);
    setSupervisorPasswordInput('');
    setSupervisorPasswordError('');
    setSupervisorUnlocked(false);
    setResetActionType('zero');
    setResetCustomHoursStr('');
    setResetCustomMinsStr('');
    setTargetBreakToClear(firstSlotName);
    setContinueFromBreak(firstSlotName);
    setAutoStartTimer(false);
    setSupervisorResetNotes('');
  };

  // Verify Supervisor Password (accepts any of the 4 Supervisor / 1 Manager passwords or Admin@123)
  const verifySupervisorPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidSupervisorOrManagerPassword(authAccounts, supervisorPasswordInput)) {
      setSupervisorUnlocked(true);
      setSupervisorPasswordError('');
    } else {
      setSupervisorPasswordError('Incorrect supervisor or manager password. Please try again.');
    }
  };

  // Computed total custom consumed minutes from 00:00 (hours:minutes) inputs
  const totalCustomConsumedMins = useMemo(() => {
    const h = parseInt(resetCustomHoursStr || '0', 10) || 0;
    const m = parseInt(resetCustomMinsStr || '0', 10) || 0;
    return Math.max(0, h * 60 + m);
  }, [resetCustomHoursStr, resetCustomMinsStr]);

  // Apply Supervisor Reset & Continuity
  const applySupervisorReset = () => {
    if (!resetModalStaff) return;
    const staffId = resetModalStaff.id;
    const today = todayStr;
    const shiftSlots = getShiftBreakSlots(kioskSettings, resetModalStaff.shift);

    // Stop active running timer for this employee if any
    const removedActiveIds = activeBreaks.filter((b) => b.staffId === staffId).map((b) => b.id);
    const nextClosedBreakIds = Array.from(new Set([...closedBreakIds, ...removedActiveIds]));
    let nextActiveBreaks = activeBreaks.filter((b) => b.staffId !== staffId);
    let nextLogs = [...logs];
    let nextDeletedLogs = [...deletedLogs];

    if (resetActionType === 'zero') {
      const removedIds = nextLogs
        .filter((l) => l.staffId === staffId && (l.date === today || isLogInCurrentShiftCycle(l, currentTime, kioskSettings)))
        .map((l) => l.id);
      nextDeletedLogs = Array.from(new Set([...nextDeletedLogs, ...removedIds]));
      nextLogs = nextLogs.filter(
        (l) => !(l.staffId === staffId && (l.date === today || isLogInCurrentShiftCycle(l, currentTime, kioskSettings)))
      );
      showToast(`Reset total break time to 00:00 for ${resetModalStaff.name} (ID: ${resetModalStaff.empId})`, 'info');
    } else if (resetActionType === 'clearBreak') {
      const removedIds = nextLogs
        .filter(
          (l) =>
            l.staffId === staffId &&
            (l.date === today || isLogInCurrentShiftCycle(l, currentTime, kioskSettings)) &&
            l.breakType === targetBreakToClear
        )
        .map((l) => l.id);
      nextDeletedLogs = Array.from(new Set([...nextDeletedLogs, ...removedIds]));
      nextLogs = nextLogs.filter(
        (l) =>
          !(
            l.staffId === staffId &&
            (l.date === today || isLogInCurrentShiftCycle(l, currentTime, kioskSettings)) &&
            l.breakType === targetBreakToClear
          )
      );
      showToast(`Cleared ${targetBreakToClear} break for ${resetModalStaff.name}`, 'info');
    } else if (resetActionType === 'custom') {
      const hhMmFormatted = `${String(Math.floor(totalCustomConsumedMins / 60)).padStart(2, '0')}:${String(
        totalCustomConsumedMins % 60
      ).padStart(2, '0')}`;

      const removedIds = nextLogs
        .filter((l) => l.staffId === staffId && (l.date === today || isLogInCurrentShiftCycle(l, currentTime, kioskSettings)))
        .map((l) => l.id);
      nextDeletedLogs = Array.from(new Set([...nextDeletedLogs, ...removedIds]));

      if (totalCustomConsumedMins === 0) {
        nextLogs = nextLogs.filter(
          (l) => !(l.staffId === staffId && (l.date === today || isLogInCurrentShiftCycle(l, currentTime, kioskSettings)))
        );
        showToast(`Set consumed break time to 00:00 (0m) for ${resetModalStaff.name}`, 'info');
      } else {
        const matchedSlot = shiftSlots.find((s) => s.name.toLowerCase() === targetBreakToClear.toLowerCase()) || shiftSlots[0];
        const allottedForCustom = matchedSlot.mins;
        const customLog: BreakLog = {
          id: 'LOG_ADJ_' + Date.now(),
          staffId: resetModalStaff.id,
          empId: resetModalStaff.empId,
          staffName: resetModalStaff.name,
          shift: resetModalStaff.shift,
          breakType: matchedSlot.name,
          breakSlot: matchedSlot.slot,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMins: totalCustomConsumedMins,
          allottedMins: allottedForCustom,
          varianceMins: totalCustomConsumedMins - allottedForCustom,
          exceptionReason: 'Supervisor Adjustment & Reset',
          notes: supervisorResetNotes.trim()
            ? `Supervisor override (${hhMmFormatted}): ${supervisorResetNotes.trim()}`
            : `Custom duration (${hhMmFormatted}) set by supervisor`,
          date: today,
          source: 'supervisor',
          testMode: Boolean(kioskSettings.testMode),
        };
        nextLogs = [
          customLog,
          ...nextLogs.filter(
            (l) => !(l.staffId === staffId && (l.date === today || isLogInCurrentShiftCycle(l, currentTime, kioskSettings)))
          ),
        ];
        showToast(
          `Set total consumed break time to ${hhMmFormatted} (${totalCustomConsumedMins}m) for ${resetModalStaff.name}`,
          'info'
        );
      }
    }

    // Start timer immediately if requested
    if (autoStartTimer && continueFromBreak !== 'None') {
      const matchedContinueSlot =
        shiftSlots.find((s) => s.name.toLowerCase() === continueFromBreak.toLowerCase()) || shiftSlots[0];
      const effectiveMins = getEffectiveBreakMins(kioskSettings, matchedContinueSlot.mins);
      const newActive: ActiveBreak = {
        id: 'BRK_' + Date.now(),
        staffId: resetModalStaff.id,
        empId: resetModalStaff.empId,
        staffName: resetModalStaff.name,
        shift: resetModalStaff.shift,
        breakType: matchedContinueSlot.name,
        breakSlot: matchedContinueSlot.slot,
        startTime: new Date().toISOString(),
        allottedMins: effectiveMins,
        source: 'supervisor',
        testMode: Boolean(kioskSettings.testMode),
      };
      nextActiveBreaks = [...nextActiveBreaks, newActive];
      showToast(`Launched active ${effectiveMins}m ${matchedContinueSlot.name} timer for ${resetModalStaff.name}`, 'success');
    } else if (continueFromBreak !== 'None') {
      showToast(`Employee scheduled to resume with ${continueFromBreak} break`, 'info');
    }

    setActiveBreaks(nextActiveBreaks);
    setLogs(nextLogs);
    setDeletedLogs(nextDeletedLogs);
    setClosedBreakIds(nextClosedBreakIds);
    serverSync({
      activeBreaks: nextActiveBreaks,
      logs: nextLogs,
      deletedLogs: nextDeletedLogs,
      closedBreakIds: nextClosedBreakIds,
    });
    setResetModalStaff(null);
  };

  // Confirm and permanently delete staff
  const confirmDeleteStaff = () => {
    if (!staffToDelete) return;
    const memberName = staffToDelete.name;
    const memberId = staffToDelete.id;

    // Remove from staff, record in deletedStaff so mergeState never resurrects it, and clear any running active breaks
    const nextStaff = staff.filter((s) => s.id !== memberId);
    const removedBreakIds = activeBreaks.filter((b) => b.staffId !== memberId).map((b) => b.id);
    const nextClosedBreakIds = Array.from(new Set([...closedBreakIds, ...removedBreakIds]));
    const nextActiveBreaks = activeBreaks.filter((b) => b.staffId !== memberId);
    const nextDeletedStaff = Array.from(new Set([...deletedStaff, memberId]));

    setStaff(nextStaff);
    setActiveBreaks(nextActiveBreaks);
    setDeletedStaff(nextDeletedStaff);
    setClosedBreakIds(nextClosedBreakIds);
    serverSync({
      staff: nextStaff,
      activeBreaks: nextActiveBreaks,
      deletedStaff: nextDeletedStaff,
      closedBreakIds: nextClosedBreakIds,
    });

    showToast(`Permanently deleted ${memberName} from the staff roster`, 'info');
    setStaffToDelete(null);
  };

  // Reset to initial 32 staff with official IDs (in-page modal, no confirm())
  const handleResetToDefaultRoster = () => {
    setRestoreRosterModalOpen(true);
  };

  const confirmRestoreDefaultRoster = () => {
    const nowIso = new Date().toISOString();
    const defaultStaff: StaffMember[] = INITIAL_STAFF.map((s, idx) => ({
      id: `${s.shift[0]}_${s.empId}_${idx + 1}`,
      empId: s.empId,
      name: s.name,
      designation: s.designation,
      shift: s.shift,
      department: 'Wash & Fold',
      active: true,
      updatedAt: nowIso,
    }));
    const defaultIds = new Set(defaultStaff.map((s) => s.id));
    const removedCustomIds = staff.filter((s) => !defaultIds.has(s.id)).map((s) => s.id);
    const nextDeletedStaff = removedCustomIds;

    setStaff(defaultStaff);
    setActiveBreaks([]);
    setDeletedStaff(nextDeletedStaff);
    const resetState = {
      ...stateRef.current,
      staff: defaultStaff,
      activeBreaks: [],
      deletedStaff: nextDeletedStaff,
    };
    stateRef.current = resetState;
    safeSetStorage(STORAGE_KEY, JSON.stringify(resetState));
    serverSync({ staff: defaultStaff, activeBreaks: [], deletedStaff: nextDeletedStaff });
    setRestoreRosterModalOpen(false);
    showToast('Roster reset to standard 32 employees with Employee IDs', 'success');
  };

  // Export Daily Logs to CSV (Android Chrome & Local File compatible)
  const exportLogsToCSV = async () => {
    if (logs.length === 0) {
      showToast('No logs recorded yet to export', 'warning');
      return;
    }
    let csv = 'Log ID,Employee ID,Date,Shift,Employee Name,Break Type,Start Time,End Time,Actual Duration (Mins),Allotted (Mins),Variance (Mins),Supervisor Exception,Notes,Source,Voided,Needs Review,Test Mode,Deleted,Deleted At,Deleted By\n';
    logs.forEach((l) => {
      const allotted = resolveAllottedMins(l);
      csv += `${l.id},${l.empId || ''},${l.date},${l.shift},"${l.staffName}",${l.breakType},${new Date(l.startTime).toLocaleTimeString()},${new Date(l.endTime).toLocaleTimeString()},${l.durationMins},${allotted},${l.varianceMins},"${l.exceptionReason}","${l.notes || ''}",${l.source || 'supervisor'},${Boolean(l.voided)},${Boolean(l.needsReview)},${Boolean(l.testMode)},${Boolean(l.deleted)},"${l.deletedAt ? `${l.deletedAt} (${l.deletedDate || l.date})` : ''}","${l.deletedBy || ''}"\n`;
    });
    await downloadOrShareFile(`Washmen_Break_Logs_${todayStr}.csv`, csv, 'text/csv;charset=utf-8;', false);
    showToast('Exported Daily Break Logs CSV', 'success');
  };

  // Export Monthly Report to CSV (excludes voided and testMode breaks, uses per-log allottedMins + current setting for untaken breaks)
  const exportMonthlyReportToCSV = async () => {
    const logsInMonth = validLogs.filter((l) => l.date.startsWith(reportMonth));
    let csv = 'Month,Employee ID,Employee Name,Shift,Department,Breaks Taken,Monthly Entitled (Hours & Mins),Monthly Entitled (Mins),Total Consumed (Hours & Mins),Total Consumed (Mins),Net Variance,Status,Critical Warning\n';
    staff.forEach((st) => {
      const userLogs = logsInMonth.filter((l) => l.staffId === st.id);
      const count = userLogs.length;
      const consumedMins = userLogs.reduce((acc, l) => acc + l.durationMins, 0);
      const entitledMins = calculateMonthlyEntitledMins(st.shift, userLogs, kioskSettings, 26);
      const criticalMins = entitledMins + 240; // 4 hours above monthly entitled allowance
      const netVarianceMins = consumedMins - entitledMins;
      const isOverCritical = consumedMins > criticalMins;
      const isOverEntitled = consumedMins > entitledMins;
      const entitledFormatted = `${Math.floor(entitledMins / 60)}h ${String(entitledMins % 60).padStart(2, '0')}m`;
      const statusStr = isOverCritical
        ? 'CRITICAL EXCEEDED'
        : isOverEntitled
        ? 'Overtime'
        : consumedMins === entitledMins
        ? 'Exact Target'
        : 'Compliant';
      const warningStr = isOverCritical
        ? `YES (+${Math.floor((consumedMins - criticalMins) / 60)}h ${(consumedMins - criticalMins) % 60}m over critical limit)`
        : 'NO';
      const consumedFormatted = `${Math.floor(consumedMins / 60)}h ${consumedMins % 60}m`;
      const netFormatted =
        netVarianceMins > 0
          ? `+${Math.floor(netVarianceMins / 60)}h ${netVarianceMins % 60}m`
          : netVarianceMins < 0
          ? `-${Math.floor(Math.abs(netVarianceMins) / 60)}h ${Math.abs(netVarianceMins) % 60}m`
          : '0h 00m';

      csv += `${reportMonth},${st.empId},"${st.name}",${st.shift},${st.department},${count},"${entitledFormatted}",${entitledMins},"${consumedFormatted}",${consumedMins},"${netFormatted}","${statusStr}","${warningStr}"\n`;
    });
    await downloadOrShareFile(
      `Washmen_Monthly_Summary_${reportMonth}.csv`,
      csv,
      'text/csv;charset=utf-8;',
      false
    );
    showToast('Exported Monthly Summary CSV', 'success');
  };

  // Export Full JSON Backup (with optional Android Share sheet)
  const exportJSONBackup = async (preferShare: boolean = false) => {
    const data = JSON.stringify(
      {
        staff,
        activeBreaks,
        logs,
        deletedLogs,
        deletedStaff,
        kioskSettings,
        authAccounts,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    await downloadOrShareFile(
      `Washmen_Break_Tracker_Backup_${todayStr}.json`,
      data,
      'application/json;charset=utf-8;',
      preferShare
    );
    showToast('Exported JSON Database Backup', 'success');
  };

  // Import JSON Backup
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.staff)) {
          const nextStaff = parsed.staff;
          const nextActive = parsed.activeBreaks || [];
          const nextLogs = parsed.logs || [];
          const nextDelLogs = Array.isArray(parsed.deletedLogs) ? parsed.deletedLogs : [];
          const nextDelStaff = Array.isArray(parsed.deletedStaff) ? parsed.deletedStaff : [];
          const nextSettings = parsed.kioskSettings
            ? { ...DEFAULT_KIOSK_SETTINGS, ...parsed.kioskSettings, updatedAt: Date.now() }
            : kioskSettings;
          const nextAccounts = Array.isArray(parsed.authAccounts)
            ? saveStoredAuthAccounts(parsed.authAccounts)
            : authAccounts;
          setStaff(nextStaff);
          setActiveBreaks(nextActive);
          setLogs(nextLogs);
          setDeletedLogs(nextDelLogs);
          setDeletedStaff(nextDelStaff);
          setKioskSettings(nextSettings);
          setAuthAccounts(nextAccounts);
          const fullRestored = {
            staff: nextStaff,
            activeBreaks: nextActive,
            logs: nextLogs,
            deletedLogs: nextDelLogs,
            deletedStaff: nextDelStaff,
            closedBreakIds,
            kioskSettings: nextSettings,
            authAccounts: nextAccounts,
          };
          stateRef.current = fullRestored;
          safeSetStorage(STORAGE_KEY, JSON.stringify(fullRestored));
          safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
          showToast('Database & login accounts successfully restored from JSON backup', 'success');
        } else {
          showToast('Invalid backup file structure', 'danger');
        }
      } catch {
        showToast('Error reading backup file', 'danger');
      }
    };
    reader.readAsText(file);
  };

  // Helper function to format exact hours and minutes
  const formatHoursMins = (totalMinutes: number): string => {
    const isNegative = totalMinutes < 0;
    const abs = Math.abs(totalMinutes);
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    const prefix = isNegative ? '-' : '';
    return `${prefix}${hours}h ${String(mins).padStart(2, '0')}m`;
  };

  // Scroll smoothly up and down to section (no slide)
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Download standalone HTML file for Android Local File Storage & GitHub Pages
  const downloadStandaloneHTML = async (
    preferShare: boolean = false,
    filename: string = 'index.html'
  ) => {
    // Ensure current live state is flushed to storage and cloud before embedding into index.html
    try {
      safeSetStorage(
        STORAGE_KEY,
        JSON.stringify({
          ...stateRef.current,
          _updatedAtMs: Date.now(),
        })
      );
      safeSetStorage(KIOSK_SETTINGS_STORAGE_KEY, JSON.stringify(stateRef.current.kioskSettings));
      safeSetStorage(AUTH_ACCOUNTS_STORAGE_KEY, JSON.stringify(stateRef.current.authAccounts));
      void pushCloudStationSync(
        {
          authAccounts: stateRef.current.authAccounts,
          staff: stateRef.current.staff,
          activeBreaks: stateRef.current.activeBreaks,
          logs: stateRef.current.logs,
          deletedLogs: stateRef.current.deletedLogs || [],
          deletedStaff: stateRef.current.deletedStaff || [],
          closedBreakIds: stateRef.current.closedBreakIds || [],
          kioskSettings: stateRef.current.kioskSettings,
          updatedByRole: loggedInAccount?.role || 'Manager',
          updatedAtMs: Date.now(),
        },
        false
      );
    } catch {}
    await downloadSelfContainedHtml(preferShare, filename);
    showToast(`Saved ${filename} (with your latest updates, settings & roster) for GitHub Pages & Android!`, 'success');
  };

  // Filtered Roster for Table
  const filteredRoster = useMemo(() => {
    let list = staff;
    if (rosterShiftFilter === 'Current') {
      list = list.filter((s) => s.shift === currentShift);
    } else if (rosterShiftFilter !== 'All') {
      list = list.filter((s) => s.shift === rosterShiftFilter);
    }
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || (s.empId && s.empId.toLowerCase().includes(q)));
    }
    return [...list].sort((a, b) => a.shift.localeCompare(b.shift) || a.name.localeCompare(b.name));
  }, [staff, rosterShiftFilter, currentShift, rosterSearch]);

  // Filtered Logs (includes voided logs in audit trail with a VOIDED badge)
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (logDateFilter && l.date !== logDateFilter) return false;
      if (logShiftFilter !== 'All' && l.shift !== logShiftFilter) return false;
      if (logTypeFilter !== 'All' && l.breakType !== logTypeFilter) return false;
      if (logSearch.trim()) {
        const q = logSearch.toLowerCase();
        const matchesName = l.staffName.toLowerCase().includes(q);
        const matchesId = l.empId && l.empId.toLowerCase().includes(q);
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });
  }, [logs, logDateFilter, logShiftFilter, logTypeFilter, logSearch]);

  // Monthly Report Calculations (Uses each log's saved allottedMins where taken + current shift settings for untaken breaks across 26 working days; excludes voided & testMode breaks)
  const monthlyLogs = useMemo(() => {
    return validLogs.filter((l) => {
      if (!l.date.startsWith(reportMonth)) return false;
      if (reportShiftFilter !== 'All' && l.shift !== reportShiftFilter) return false;
      return true;
    });
  }, [validLogs, reportMonth, reportShiftFilter]);

  const monthlyReportStaff = useMemo(() => {
    let list = staff;
    if (reportShiftFilter !== 'All') {
      list = list.filter((s) => s.shift === reportShiftFilter);
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, reportShiftFilter]);

  // Baseline monthly entitled minutes for the active filter (26 working shifts * shift daily total)
  const defaultShiftForHeader: 'Morning' | 'Night' =
    reportShiftFilter === 'Night' ? 'Night' : reportShiftFilter === 'Morning' ? 'Morning' : currentShift;
  const baselineShiftDailyMins = getShiftTotalBreakMins(kioskSettings, defaultShiftForHeader);
  const baselineMonthlyEntitledMins = 26 * baselineShiftDailyMins;

  const totalMonthlyAllottedMins = useMemo(() => {
    return monthlyReportStaff.reduce((sum, st) => {
      const userLogs = monthlyLogs.filter((l) => l.staffId === st.id);
      return sum + calculateMonthlyEntitledMins(st.shift, userLogs, kioskSettings, 26);
    }, 0);
  }, [monthlyReportStaff, monthlyLogs, kioskSettings]);

  const totalMonthlyUsed = monthlyLogs.reduce((acc, l) => acc + l.durationMins, 0);

  // Counts of employees exceeding their entitled monthly allowance and critical threshold (+4h above entitled)
  const staffOver26Count = monthlyReportStaff.filter((st) => {
    const userLogs = monthlyLogs.filter((l) => l.staffId === st.id);
    const userUsed = userLogs.reduce((acc, l) => acc + l.durationMins, 0);
    const entitled = calculateMonthlyEntitledMins(st.shift, userLogs, kioskSettings, 26);
    return userUsed > entitled;
  }).length;

  const staffOver30Count = monthlyReportStaff.filter((st) => {
    const userLogs = monthlyLogs.filter((l) => l.staffId === st.id);
    const userUsed = userLogs.reduce((acc, l) => acc + l.durationMins, 0);
    const entitled = calculateMonthlyEntitledMins(st.shift, userLogs, kioskSettings, 26);
    return userUsed > entitled + 240;
  }).length;

  // Human-readable formatted month (e.g. November 2026) for clear visibility
  const formattedReportMonth = useMemo(() => {
    try {
      const [year, month] = reportMonth.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return reportMonth;
    }
  }, [reportMonth]);

  // Handle Supervisor Password Protected Dashboard Reset
  const handleConfirmDashboardReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidSupervisorOrManagerPassword(authAccounts, dashboardResetPassword)) {
      setDashboardResetError('Incorrect supervisor or manager password. Authorization denied.');
      return;
    }
    setDashboardResetError('');

    if (dashboardResetAction === 'today') {
      const removedTodayIds = logs.filter((l) => l.date === todayStr).map((l) => l.id);
      const nextDeletedLogs = Array.from(new Set([...deletedLogs, ...removedTodayIds]));
      const nextClosedBreakIds = Array.from(new Set([...closedBreakIds, ...activeBreaks.map((b) => b.id)]));
      const nextLogs = logs.filter((l) => l.date !== todayStr);
      setActiveBreaks([]);
      setLogs(nextLogs);
      setDeletedLogs(nextDeletedLogs);
      setClosedBreakIds(nextClosedBreakIds);
      serverSync({
        activeBreaks: [],
        logs: nextLogs,
        deletedLogs: nextDeletedLogs,
        closedBreakIds: nextClosedBreakIds,
      });
      showToast("Today's dashboard & active break timers reset to zero", 'success');
    } else if (dashboardResetAction === 'factory') {
      const nowIso = new Date().toISOString();
      const factoryStaff: StaffMember[] = INITIAL_STAFF.map((s, idx) => ({
        id: `${s.shift[0]}_${s.empId}_${idx + 1}`,
        empId: s.empId,
        name: s.name,
        designation: s.designation,
        shift: s.shift,
        department: 'Wash & Fold',
        active: true,
        updatedAt: nowIso,
      }));
      const allOldLogIds = logs.map((l) => l.id);
      const nextDeletedLogs = Array.from(new Set([...deletedLogs, ...allOldLogIds]));
      const nextClosedBreakIds = Array.from(new Set([...closedBreakIds, ...activeBreaks.map((b) => b.id)]));
      setStaff(factoryStaff);
      setActiveBreaks([]);
      setLogs([]);
      setDeletedLogs(nextDeletedLogs);
      setDeletedStaff([]);
      setClosedBreakIds(nextClosedBreakIds);
      const factoryState = {
        staff: factoryStaff,
        activeBreaks: [],
        logs: [],
        deletedLogs: nextDeletedLogs,
        deletedStaff: [],
        closedBreakIds: nextClosedBreakIds,
        kioskSettings,
        authAccounts,
      };
      stateRef.current = factoryState;
      safeSetStorage(STORAGE_KEY, JSON.stringify(factoryState));
      serverSync(factoryState);
      showToast('Master Factory Reset: Restored standard 32 staff & cleared all data', 'success');
    }

    setDashboardResetPassword('');
    setDashboardResetModalOpen(false);
  };

  // Sort active breaks so breaks running longer than needsReviewRunningMins (default 90m) appear on top
  const sortedActiveBreaks = useMemo(() => {
    const thresholdSec = Number(kioskSettings.needsReviewRunningMins ?? 90) * 60;
    return [...activeBreaks].sort((a, b) => {
      const aElapsed = (currentTime.getTime() - new Date(a.startTime).getTime()) / 1000;
      const bElapsed = (currentTime.getTime() - new Date(b.startTime).getTime()) / 1000;
      const aNeedsReview = aElapsed >= thresholdSec ? 1 : 0;
      const bNeedsReview = bElapsed >= thresholdSec ? 1 : 0;
      if (aNeedsReview !== bNeedsReview) return bNeedsReview - aNeedsReview;
      return bElapsed - aElapsed;
    });
  }, [activeBreaks, currentTime, kioskSettings.needsReviewRunningMins]);

  // ================= LOGIN GATE (MANAGER, SUPERVISOR & DISPLAY KIOSK LOGIN) =================
  if (!loggedInAccount) {
    return (
      <>
        <LoginPage
          accounts={authAccounts}
          currentTime={currentTime}
          onLoginSuccess={(acc) => {
            saveStoredAuthSession(acc);
            setLoggedInAccount(acc);
            if (acc.role === 'Display') {
              setIsKioskLocked(true);
              setCurrentTab('kiosk');
              setSettingsPinUnlocked(false);
              serverSync();
              showToast('Signed in as Display (Employee Kiosk Only)', 'success');
            } else {
              setIsKioskLocked(false);
              setCurrentTab('dashboard');
              setSettingsPinUnlocked(true);
              serverSync();
              showToast(`Signed in as ${acc.role}`, 'success');
            }
          }}
        />
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
            <div
              className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl text-xs font-bold text-white flex items-center space-x-2.5 ${
                toast.type === 'success'
                  ? 'bg-emerald-600'
                  : toast.type === 'danger'
                  ? 'bg-rose-600'
                  : toast.type === 'warning'
                  ? 'bg-amber-600'
                  : 'bg-[#251B7C]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </>
    );
  }

  // ================= FROZEN KIOSK MODE (Always enforced for Display login, or when on Kiosk tab / locked tablet) =================
  if (loggedInAccount.role === 'Display' || isKioskLocked || currentTab === 'kiosk') {
    return (
      <div
        onContextMenu={(e) => e.preventDefault()}
        className="min-h-screen flex flex-col bg-[#F6F7FC] text-[#171262] font-sans antialiased select-none"
      >
        <EmployeeKiosk
          staff={staff}
          activeBreaks={activeBreaks}
          logs={logs}
          kioskSettings={kioskSettings}
          isKioskLocked={true}
          isDefaultPin={isDefaultPin}
          isOffline={isOffline}
          loggedInRole={loggedInAccount.role}
          onLogout={() => {
            clearStoredAuthSession();
            setLoggedInAccount(null);
            setIsKioskLocked(false);
            setSettingsPinUnlocked(false);
            showToast('Logged out successfully', 'info');
          }}
          onEnterLockedKiosk={() => setIsKioskLocked(true)}
          onExitLockedKiosk={() => {
            if (loggedInAccount.role === 'Display') {
              showToast(
                'Access Prohibited: Display login is restricted to Employee Kiosk only.',
                'danger'
              );
              return;
            }
            setIsKioskLocked(false);
            setCurrentTab('dashboard');
          }}
          onOpenSupervisorSettings={() => {
            if (loggedInAccount.role === 'Display') {
              showToast(
                'Access Prohibited: Display login cannot open Settings or Reports.',
                'danger'
              );
              return;
            }
            setIsKioskLocked(false);
            setSettingsPinUnlocked(true);
            setCurrentTab('settings');
          }}
          onUpdateKioskSettings={
            loggedInAccount.role === 'Display'
              ? undefined
              : (next: KioskSettings) => {
                  setKioskSettings(next);
                  serverSync({ kioskSettings: next });
                  saveKioskSettingsOnServer(next, verifiedSupervisorPin);
                }
          }
          onStartBreak={(staffMember, breakType, allottedMins, breakSlot) =>
            startBreakForStaff(staffMember, breakType, allottedMins, 'kiosk', breakSlot)
          }
          onStopBreakFromKiosk={handleStopBreakFromKiosk}
          onVoidBreakFromKiosk={handleVoidBreakFromKiosk}
          onFlagLogForReview={handleFlagLogForReview}
          showToast={showToast}
        />
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
            <div
              className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl text-xs font-bold text-white flex items-center space-x-2.5 ${
                toast.type === 'success'
                  ? 'bg-emerald-600'
                  : toast.type === 'danger'
                  ? 'bg-rose-600'
                  : toast.type === 'warning'
                  ? 'bg-amber-600'
                  : 'bg-[#251B7C]'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC] text-[#171262] font-sans antialiased selection:bg-[#4D3FDC] selection:text-white">
      {/* ================= TOP BRANDING & SHIFT HEADER ================= */}
      <header className="bg-[#251B7C] text-white border-b border-[#1E1668] sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Company Title */}
          <div className="flex items-center space-x-3.5">
            <div className="relative group cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
              <img
                src={getWashmenLogoSrc()}
                alt="Washmen Laundry Logo"
                width={44}
                height={44}
                className="w-11 h-11 rounded-xl object-contain bg-[#17105C] p-1 border border-white/20 shadow-inner group-hover:scale-105 transition-transform"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== WASHMEN_LOGO_FALLBACK) img.src = WASHMEN_LOGO_FALLBACK;
                }}
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#251B7C]" title="System Live"></div>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-wider text-white font-sans lowercase">
                  washmen
                </span>
                <span className="px-2.5 py-0.5 text-[11px] uppercase tracking-widest font-extrabold bg-[#4D3FDC] text-white rounded-md shadow-sm">
                  WASH & FOLD
                </span>
                {isOffline && (
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold bg-amber-400 text-slate-950 rounded-md flex items-center gap-1">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>Offline, will sync</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-indigo-200/80 font-medium">
                Break Time Tracker & Overtime Governance
              </p>
            </div>
          </div>

          {/* Shift Switcher, Sound, Active User Badge, Logout & Live Clock */}
          <div className="flex items-center flex-wrap gap-3">
            {/* Shift Switcher */}
            <div className="bg-[#1C1466] p-1 rounded-xl border border-white/10 flex items-center space-x-1 shadow-inner">
              <button
                onClick={() => {
                  setCurrentShift('Morning');
                  showToast('Switched to Morning Shift', 'info');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center space-x-1.5 ${
                  currentShift === 'Morning'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-indigo-200 hover:text-white'
                }`}
              >
                <Sun className={`w-3.5 h-3.5 ${currentShift === 'Morning' ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>Morning Shift</span>
              </button>

              <button
                onClick={() => {
                  setCurrentShift('Night');
                  showToast('Switched to Night Shift', 'info');
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center space-x-1.5 ${
                  currentShift === 'Night'
                    ? 'bg-[#4D3FDC] text-white shadow-md'
                    : 'text-indigo-200 hover:text-white'
                }`}
              >
                <Moon className={`w-3.5 h-3.5 ${currentShift === 'Night' ? 'text-white' : 'text-indigo-300'}`} />
                <span>Night Shift</span>
              </button>
            </div>

            {/* Sound Mute Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                showToast(soundEnabled ? 'Alarm sound muted' : 'Alarm sound enabled', 'info');
              }}
              title={soundEnabled ? 'Mute Alert Chimes' : 'Enable Alert Chimes'}
              className="p-2 bg-[#1C1466] hover:bg-[#17105C] text-indigo-200 hover:text-white border border-white/10 rounded-xl transition cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-300" /> : <VolumeX className="w-4 h-4 text-indigo-400" />}
            </button>

            {/* Live Clock */}
            <div className="bg-[#1C1466] px-3.5 py-1.5 rounded-xl border border-white/10 text-right min-w-[130px]">
              <div className="text-[10px] text-indigo-200 font-medium uppercase tracking-wider">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="text-xs font-black font-mono text-cyan-300">
                {currentTime.toLocaleTimeString('en-US', { hour12: true })}
              </div>
            </div>

            {/* Logged-in User Badge & Logout Button */}
            <div className="bg-[#1C1466] px-3 py-1.5 rounded-xl border border-white/15 flex items-center space-x-2.5">
              <div className="flex items-center space-x-1.5">
                <UserCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                <div className="text-left">
                  <span className="block text-[9px] uppercase tracking-wider font-extrabold text-indigo-300 leading-none">
                    Active Session
                  </span>
                  <span className="block text-xs font-black text-white leading-tight">
                    {loggedInAccount.role}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearStoredAuthSession();
                  setLoggedInAccount(null);
                  setSettingsPinUnlocked(false);
                  showToast('Logged out successfully', 'info');
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500/90 hover:bg-rose-600 text-white font-bold text-[11px] transition flex items-center space-x-1 cursor-pointer"
                title="Logout and return to Login Page"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ================= NAVIGATION TABS ================= */}
      <nav className="bg-white border-b border-[#E4E7F2] sticky top-[65px] z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 sm:space-x-2 py-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-2 shrink-0 cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9] shadow-xs'
                  : 'text-[#5C5A85] hover:bg-[#F6F7FC] hover:text-[#171262]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Live Dashboard</span>
              {activeBreaks.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-[#4D3FDC] text-white rounded-full">
                  {activeBreaks.length}
                </span>
              )}
            </button>

            {/* NEW TAB: EMPLOYEE KIOSK (Immediately freezes into Full-Screen Kiosk Mode) */}
            <button
              onClick={() => {
                setSettingsPinUnlocked(false);
                setIsKioskLocked(true);
                setCurrentTab('kiosk');
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-2 shrink-0 cursor-pointer bg-emerald-50/80 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
            >
              <Tablet className="w-4 h-4" />
              <span>Employee Kiosk</span>
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-emerald-600 text-white rounded-full uppercase">
                Tablet
              </span>
            </button>

            <button
              onClick={() => setCurrentTab('roster')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-2 shrink-0 cursor-pointer ${
                currentTab === 'roster'
                  ? 'bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9] shadow-xs'
                  : 'text-[#5C5A85] hover:bg-[#F6F7FC] hover:text-[#171262]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Staff Roster ({staff.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('logs')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-2 shrink-0 cursor-pointer ${
                currentTab === 'logs'
                  ? 'bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9] shadow-xs'
                  : 'text-[#5C5A85] hover:bg-[#F6F7FC] hover:text-[#171262]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Daily Break Logs ({validLogs.length})</span>
            </button>

            <button
              onClick={() => setCurrentTab('report')}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-2 shrink-0 cursor-pointer ${
                currentTab === 'report'
                  ? 'bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9] shadow-xs'
                  : 'text-[#5C5A85] hover:bg-[#F6F7FC] hover:text-[#171262]'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Monthly Report (26h)</span>
            </button>

            <button
              onClick={() => {
                setSettingsPinInput('');
                setSettingsPinError('');
                setCurrentTab('settings');
              }}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-2 shrink-0 cursor-pointer ${
                currentTab === 'settings'
                  ? 'bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9] shadow-xs'
                  : 'text-[#5C5A85] hover:bg-[#F6F7FC] hover:text-[#171262]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings & Backup</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ================= MAIN CONTENT (SUPERVISOR TABS) ================= */}
      {(
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
          {/* VISIBLE ORANGE BANNER WHEN TEST MODE IS ON (Supervisor dashboard only, never on Kiosk) */}
          {kioskSettings.testMode && (
            <div className="mb-6 bg-amber-500 text-slate-950 px-5 py-3.5 rounded-2xl border-2 border-amber-700 shadow-md flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-slate-950 shrink-0" />
                <div>
                  <p className="text-sm sm:text-base font-black tracking-wide uppercase">
                    TEST MODE: breaks are 1 minute
                  </p>
                  <p className="text-xs font-bold text-slate-900">
                    All newly started breaks run for 1 minute and are marked as Test Breaks (excluded from monthly reports).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated: KioskSettings = {
                    ...kioskSettings,
                    testMode: false,
                    updatedAt: Date.now(),
                    version: Number(kioskSettings.version || 0) + 1,
                  };
                  setKioskSettings(updated);
                  serverSync({ kioskSettings: updated });
                  saveKioskSettingsOnServer(updated, verifiedSupervisorPin);
                  showToast('Test mode turned OFF. Normal break durations restored.', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs cursor-pointer transition shrink-0"
              >
                Turn OFF Test Mode
              </button>
            </div>
          )}

        {/* ================= TAB 1: LIVE DASHBOARD ================= */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6">

            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Active Breaks */}
              <div className="bg-white p-5 rounded-2xl border border-[#E4E7F2] shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#5C5A85] uppercase tracking-wider">Active Breaks Now</p>
                  <h3 className="text-2xl font-black text-[#171262]">{activeBreaksInShift.length}</h3>
                  <p className="text-[11px] text-[#5C5A85]">{currentShift} Shift Staff</p>
                </div>
              </div>

              {/* Breaks Taken Today */}
              <div className="bg-white p-5 rounded-2xl border border-[#E4E7F2] shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#5C5A85] uppercase tracking-wider">Completed Today</p>
                  <h3 className="text-2xl font-black text-[#171262]">{todayLogsInShift.length}</h3>
                  <p className="text-[11px] text-[#5C5A85]">{currentShift} Shift Logs</p>
                </div>
              </div>

              {/* Overtime Alerts */}
              <div className="bg-white p-5 rounded-2xl border border-[#E4E7F2] shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#5C5A85] uppercase tracking-wider">Overtime Breaches</p>
                  <h3 className="text-2xl font-black text-rose-600">{overtimeCountToday}</h3>
                  <p className="text-[11px] text-[#5C5A85]">Exceeded allowed break time</p>
                </div>
              </div>

              {/* Staff On Duty */}
              <div className="bg-white p-5 rounded-2xl border border-[#E4E7F2] shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-[#EEECFB] text-[#4D3FDC] rounded-xl border border-[#D5D0F9]">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#5C5A85] uppercase tracking-wider">Department Roster</p>
                  <h3 className="text-2xl font-black text-[#171262]">{availableStaffForQuickStart.length}</h3>
                  <p className="text-[11px] text-[#4D3FDC] font-semibold">{currentShift} Shift</p>
                </div>
              </div>
            </div>

            {/* QUICK START BREAK LAUNCHER */}
            {(() => {
              const currentShiftSlots = getShiftBreakSlots(kioskSettings, currentShift);
              const totalShiftMins = getShiftTotalBreakMins(kioskSettings, currentShift);
              return (
                <div className="bg-gradient-to-r from-[#251B7C] via-[#2F239E] to-[#4D3FDC] p-6 rounded-2xl border border-[#1E1668] shadow-md text-white">
                  <div className="flex items-center space-x-2.5 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white font-bold">
                      <Play className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">Start Break Countdown Timer</h2>
                      <p className="text-xs text-indigo-100">
                        Select an employee on {currentShift} Shift to launch their break timer ({totalShiftMins} minutes total break time per shift).
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleStartBreak} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    {/* Employee select with Employee ID */}
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-semibold text-indigo-100 mb-1">
                        Select Staff Member ({currentShift} Shift - {availableStaffForQuickStart.length} Available)
                      </label>
                      <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        required
                        className="w-full bg-[#1A1258] border border-white/20 text-white rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-white focus:outline-none"
                      >
                        <option value="">-- Choose Employee ({currentShift}) --</option>
                        {availableStaffForQuickStart.map((st) => (
                          <option key={st.id} value={st.id}>
                            #{st.empId} - {st.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Break Type select */}
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-indigo-100 mb-1">
                        Select Break ({kioskSettings.testMode ? 'Test Mode: 1 min' : `${currentShift} Shift Settings`})
                      </label>
                      <select
                        value={selectedBreakType}
                        onChange={(e) => setSelectedBreakType(e.target.value)}
                        required
                        className="w-full bg-[#1A1258] border border-white/20 text-white rounded-xl px-3.5 py-2.5 text-xs focus:ring-2 focus:ring-white focus:outline-none"
                      >
                        {currentShiftSlots.map((slot) => (
                          <option key={slot.slot} value={slot.name}>
                            {slot.name} ({getEffectiveBreakMins(kioskSettings, slot.mins)} min)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Submit button */}
                    <div className="sm:col-span-3">
                      <button
                        type="submit"
                        className="w-full bg-white hover:bg-slate-100 text-[#251B7C] font-extrabold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 text-xs"
                      >
                        <Play className="w-4 h-4 fill-[#251B7C]" />
                        <span>Launch Break Timer</span>
                      </button>
                    </div>
                  </form>
                </div>
              );
            })()}

            {/* LIVE ACTIVE BREAK TIMERS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <h2 className="text-base font-bold text-[#171262]">Live Active Break Timers</h2>
                  <span className="text-xs px-2.5 py-0.5 bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9] rounded-full font-bold">
                    {activeBreaks.length} Running
                  </span>
                </div>
                <span className="text-xs text-[#5C5A85]">Automatic live countdown updates</span>
              </div>

              {sortedActiveBreaks.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-[#E4E7F2] rounded-2xl p-10 text-center text-[#5C5A85]">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-[#B0B3C9]" />
                  <p className="font-semibold text-[#171262] text-sm">No employees currently on break.</p>
                  <p className="text-xs text-[#5C5A85] mt-1">Use the quick start bar above or the Employee Kiosk tab to start a break.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {sortedActiveBreaks.map((brk) => {
                    const elapsedSeconds = Math.floor((currentTime.getTime() - new Date(brk.startTime).getTime()) / 1000);
                    const allowedMins = resolveAllottedMins(brk);
                    const allottedSeconds = allowedMins * 60;
                    const remainingSeconds = allottedSeconds - elapsedSeconds;
                    const isOvertime = remainingSeconds < 0;
                    const warningSecs = Number(kioskSettings.warningMins ?? 5) * 60;
                    const isWarning = !isOvertime && warningSecs > 0 && remainingSeconds <= warningSecs;
                    const needsReviewLimitMins = Number(kioskSettings.needsReviewRunningMins ?? 90);
                    const needsReviewRunning = elapsedSeconds >= needsReviewLimitMins * 60;

                    let displayTime = '';
                    if (!isOvertime) {
                      const mins = Math.floor(remainingSeconds / 60);
                      const secs = remainingSeconds % 60;
                      displayTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                    } else {
                      const over = Math.abs(remainingSeconds);
                      const mins = Math.floor(over / 60);
                      const secs = over % 60;
                      displayTime = `+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                    }

                    const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / Math.max(1, allottedSeconds)) * 100));

                    return (
                      <div
                        key={brk.id}
                        className={`bg-white p-3.5 rounded-xl border transition-all shadow-xs space-y-2.5 ${
                          needsReviewRunning
                            ? 'border-rose-600 bg-rose-50/40 ring-2 ring-rose-600/30'
                            : isOvertime
                            ? 'border-rose-400 shadow-rose-100 ring-2 ring-rose-500/20'
                            : isWarning
                            ? 'border-amber-400 bg-amber-50/20'
                            : 'border-[#E4E7F2]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 pr-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#4D3FDC] block">
                              {brk.shift} Shift {brk.empId ? `• ID: #${brk.empId}` : ''} {brk.source === 'kiosk' ? '• Kiosk' : ''}
                            </span>
                            <h4 className="font-bold text-[#171262] text-sm leading-tight break-words">{brk.staffName}</h4>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {brk.testMode && (
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-amber-500 text-slate-950">
                                TEST (1m)
                              </span>
                            )}
                            {needsReviewRunning && (
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-rose-600 text-white shadow-xs">
                                NEEDS REVIEW (&gt;{needsReviewLimitMins}m)
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md shrink-0 ${
                                isOvertime
                                  ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse'
                                  : isWarning
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isOvertime ? 'OVERTIME!' : isWarning ? 'Ending Soon' : 'On Track'}
                            </span>
                          </div>
                        </div>

                        <div className="bg-[#F8F9FE] px-3 py-2 rounded-lg border border-[#E9ECF5] text-center space-y-1">
                          <div className="flex items-center justify-center space-x-2 text-[11px] text-[#5C5A85]">
                            <span className="font-semibold text-[#171262]">
                              {brk.breakType} ({allowedMins}m allowed)
                            </span>
                            <span>•</span>
                            <span>Started: {new Date(brk.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div
                            className={`text-2xl font-black font-mono tracking-wider ${
                              isOvertime ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-[#251B7C]'
                            }`}
                          >
                            {displayTime}
                          </div>

                          <div className="w-full bg-[#E5E8F3] h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full transition-all duration-1000 ${
                                isOvertime ? 'bg-rose-500 w-full' : isWarning ? 'bg-amber-500' : 'bg-[#4D3FDC]'
                              }`}
                              style={{ width: `${isOvertime ? 100 : progressPercent}%` }}
                            ></div>
                          </div>
                        </div>

                        <button
                          onClick={() => openStopBreakModal(brk)}
                          className="w-full bg-[#F6F7FC] hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-400 font-bold py-1.5 px-3 rounded-lg text-xs transition flex items-center justify-center space-x-1.5 shadow-2xs cursor-pointer"
                        >
                          <Square className="w-3 h-3 fill-rose-500" />
                          <span>Stop Break & Log Exception</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SHIFT BREAK MATRIX WITH SUPERVISOR RESET BUTTONS */}
            <div id="sec-matrix" className="bg-white rounded-2xl border border-[#E4E7F2] shadow-sm overflow-hidden scroll-mt-28">
              {(() => {
                const shiftSlotConfigs = getShiftBreakSlots(kioskSettings, currentShift);
                const shiftTotalConfiguredMins = getShiftTotalBreakMins(kioskSettings, currentShift);
                return (
                  <>
                    <div className="p-4 sm:p-5 border-b border-[#E4E7F2] flex flex-wrap items-center justify-between gap-3 bg-[#FAFBFD]">
                      <div>
                        <h3 className="font-bold text-[#171262] text-base">Today's Shift Break Matrix</h3>
                        <p className="text-xs text-[#5C5A85]">
                          Track {shiftSlotConfigs[0].name} ({shiftSlotConfigs[0].mins}m), {shiftSlotConfigs[1].name} ({shiftSlotConfigs[1].mins}m) &amp; {shiftSlotConfigs[2].name} ({shiftSlotConfigs[2].mins}m) — {shiftTotalConfiguredMins}m total per shift
                        </p>
                      </div>
                      <div className="flex items-center space-x-3 text-xs">
                        <span className="flex items-center text-emerald-700 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block mr-1.5"></span> Taken
                        </span>
                        <span className="flex items-center text-amber-700 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block mr-1.5"></span> In Progress
                        </span>
                        <span className="flex items-center text-[#5C5A85] font-medium">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block mr-1.5"></span> Pending
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8F9FE] text-[#5C5A85] uppercase font-bold border-b border-[#E4E7F2]">
                          <tr>
                            <th className="px-3.5 py-3">Emp ID</th>
                            <th className="px-4 py-3">Employee Name</th>
                            <th className="px-3 py-3">Shift</th>
                            <th className="px-3 py-3 text-center">
                              {shiftSlotConfigs[0].name} ({shiftSlotConfigs[0].mins}m)
                            </th>
                            <th className="px-3 py-3 text-center">
                              {shiftSlotConfigs[1].name} ({shiftSlotConfigs[1].mins}m)
                            </th>
                            <th className="px-3 py-3 text-center">
                              {shiftSlotConfigs[2].name} ({shiftSlotConfigs[2].mins}m)
                            </th>
                            <th className="px-3 py-3 text-center">Total Used</th>
                            <th className="px-4 py-3 text-right">Actions & Reset</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EAEFF8]">
                          {availableStaffForQuickStart.map((st) => {
                            const staffLogs = validLogs.filter(
                              (l) => l.staffId === st.id && isLogInCurrentShiftCycle(l, currentTime, kioskSettings)
                            );
                            const activeBreak = activeBreaks.find((b) => b.staffId === st.id);

                            const slot1Log = staffLogs.find(
                              (l) => resolveBreakSlot(l.breakType, l.breakSlot, kioskSettings) === 1
                            );
                            const slot2Log = staffLogs.find(
                              (l) => resolveBreakSlot(l.breakType, l.breakSlot, kioskSettings) === 2
                            );
                            const slot3Log = staffLogs.find(
                              (l) => resolveBreakSlot(l.breakType, l.breakSlot, kioskSettings) === 3
                            );

                            const totalMins = staffLogs.reduce((acc, l) => acc + l.durationMins, 0);
                            // Daily entitled minutes uses each taken break's saved allottedMins + current setting for untaken breaks
                            const entitledTodayMins =
                              (slot1Log ? resolveAllottedMins(slot1Log) : shiftSlotConfigs[0].mins) +
                              (slot2Log ? resolveAllottedMins(slot2Log) : shiftSlotConfigs[1].mins) +
                              (slot3Log ? resolveAllottedMins(slot3Log) : shiftSlotConfigs[2].mins);

                            const renderBadge = (slotNum: 1 | 2 | 3, log?: BreakLog) => {
                              if (
                                activeBreak &&
                                resolveBreakSlot(activeBreak.breakType, activeBreak.breakSlot, kioskSettings) === slotNum
                              ) {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse tracking-wide">
                                    In Progress ({resolveAllottedMins(activeBreak)}m)
                                  </span>
                                );
                              }
                              if (log) {
                                return (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 tracking-wide">
                                    ✓ {log.durationMins}m / {resolveAllottedMins(log)}m
                                  </span>
                                );
                              }
                              return <span className="text-slate-300 font-bold">—</span>;
                            };

                            return (
                              <tr key={st.id} className="hover:bg-[#F9FAFE] transition">
                                <td className="px-3.5 py-3.5 font-mono font-bold text-[#4D3FDC] tracking-wider">
                                  #{st.empId}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span className="font-bold text-[#171262] text-sm block tracking-normal break-words">{st.name}</span>
                                </td>
                                <td className="px-3 py-3.5 text-[#5C5A85]">
                                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide ${st.shift === 'Morning' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9]'}`}>
                                    {st.shift}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-center">{renderBadge(1, slot1Log)}</td>
                                <td className="px-3 py-3 text-center">{renderBadge(2, slot2Log)}</td>
                                <td className="px-3 py-3 text-center">{renderBadge(3, slot3Log)}</td>
                                <td className={`px-3 py-3 text-center font-mono font-bold ${totalMins > entitledTodayMins ? 'text-rose-600' : 'text-[#171262]'}`}>
                                  {totalMins} / {entitledTodayMins} mins
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end space-x-1.5">
                                    {activeBreak ? (
                                      <button
                                        onClick={() => openStopBreakModal(activeBreak)}
                                        className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg transition border border-rose-300 cursor-pointer"
                                      >
                                        Stop
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          const nextSlotCfg = !slot1Log
                                            ? shiftSlotConfigs[0]
                                            : !slot2Log
                                            ? shiftSlotConfigs[1]
                                            : shiftSlotConfigs[2];
                                          startBreakForStaff(
                                            st,
                                            nextSlotCfg.name,
                                            nextSlotCfg.mins,
                                            'supervisor',
                                            nextSlotCfg.slot
                                          );
                                        }}
                                        className="px-2.5 py-1 text-[11px] font-semibold bg-[#EEECFB] hover:bg-[#4D3FDC] text-[#4D3FDC] hover:text-white rounded-lg transition border border-[#D5D0F9] cursor-pointer flex items-center space-x-1"
                                      >
                                        <Play className="w-2.5 h-2.5 fill-current" />
                                        <span>Start</span>
                                      </button>
                                    )}

                                    {/* Dedicated Supervisor Reset & Continuity Button */}
                                    <button
                                      onClick={() => openResetModal(st)}
                                      className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-50 text-[#171262] border border-[#E4E7F2] rounded-lg transition flex items-center space-x-1 shadow-xs"
                                      title="Password Protected Supervisor Reset & Adjustment"
                                    >
                                      <RotateCcw className="w-3 h-3 text-[#4D3FDC]" />
                                      <span>Reset</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>

          </div>
        )}

        {/* ================= TAB 2: STAFF ROSTER ================= */}
        {currentTab === 'roster' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#171262]">Wash & Fold Department Staff Roster</h2>
                <p className="text-xs text-[#5C5A85]">
                  Department Employee ID numbers, designations, and shifts ({staff.length} Active Staff)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleResetToDefaultRoster}
                  className="bg-white hover:bg-slate-50 text-[#171262] border border-[#E4E7F2] font-semibold px-3.5 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#5C5A85]" />
                  <span>Restore Default List</span>
                </button>
                <button
                  onClick={() => downloadStandaloneHTML(false, 'index.html')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                  title="Download updated index.html file with your latest roster, break settings, and logs embedded inside"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save Roster to index.html</span>
                </button>
                <button
                  onClick={() => {
                    setEditingStaffId(null);
                    setStaffFormEmpId('');
                    setStaffFormName('');
                    setStaffFormDesignation('');
                    setStaffFormShift(currentShift);
                    setStaffModalOpen(true);
                  }}
                  className="bg-[#4D3FDC] hover:bg-[#3E30CE] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Employee</span>
                </button>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E4E7F2] flex flex-wrap gap-3 justify-between items-center shadow-xs">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#5C5A85]" />
                <input
                  type="text"
                  placeholder="Search by Employee ID or Name..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl text-[#171262] focus:outline-none focus:ring-2 focus:ring-[#4D3FDC]"
                />
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-xs text-[#5C5A85] font-semibold">Filter Shift:</label>
                <select
                  value={rosterShiftFilter}
                  onChange={(e) => setRosterShiftFilter(e.target.value as 'Current' | 'All' | 'Morning' | 'Night')}
                  className="bg-[#F8F9FE] border border-[#E4E7F2] text-[#171262] text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#4D3FDC]"
                >
                  <option value="Current">Current Active Shift ({currentShift})</option>
                  <option value="All">All Shifts ({staff.length})</option>
                  <option value="Morning">Morning Shift Only ({staff.filter((s) => s.shift === 'Morning').length})</option>
                  <option value="Night">Night Shift Only ({staff.filter((s) => s.shift === 'Night').length})</option>
                </select>
              </div>
            </div>

            {/* Roster Table with Employee ID Column */}
            <div className="bg-white rounded-2xl border border-[#E4E7F2] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FE] text-[#5C5A85] uppercase font-bold border-b border-[#E4E7F2]">
                    <tr>
                      <th className="px-3.5 py-3.5 whitespace-nowrap">#</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Employee ID</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">Employee Name</th>
                      <th className="px-3 py-3.5 whitespace-nowrap text-center">Shift</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Department</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">Breaks Today</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEFF8]">
                    {filteredRoster.map((st, idx) => {
                      const staffLogs = validLogs.filter(
                        (l) => l.staffId === st.id && isLogInCurrentShiftCycle(l, currentTime, kioskSettings)
                      );
                      return (
                        <tr key={st.id} className="hover:bg-[#F9FAFE] transition">
                          <td className="px-3.5 py-3.5 text-slate-400 font-mono whitespace-nowrap">{idx + 1}</td>
                          <td className="px-4 py-3.5 font-mono font-bold text-[#4D3FDC] whitespace-nowrap tracking-wider">
                            <span className="px-2.5 py-1 bg-[#EEECFB] rounded-lg border border-[#D5D0F9]">
                              #{st.empId}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-[#171262] text-sm tracking-normal break-words">{st.name}</td>
                          <td className="px-3 py-3.5 whitespace-nowrap text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-md whitespace-nowrap tracking-wide ${
                                st.shift === 'Morning'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9]'
                              }`}
                            >
                              {st.shift}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-[#5C5A85] whitespace-nowrap tracking-wide">{st.department}</td>
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className={`font-semibold tracking-wide ${staffLogs.length === 3 ? 'text-emerald-600' : 'text-[#5C5A85]'}`}>
                              {staffLogs.length} / 3 Completed
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end space-x-1.5">
                              {/* Edit Staff */}
                              <button
                                onClick={() => {
                                  setEditingStaffId(st.id);
                                  setStaffFormEmpId(st.empId);
                                  setStaffFormName(st.name);
                                  setStaffFormShift(st.shift);
                                  setStaffModalOpen(true);
                                }}
                                className="text-[#5C5A85] hover:text-[#4D3FDC] p-1.5 transition rounded-lg hover:bg-slate-100"
                                title="Edit Employee"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Individual Reset with Password */}
                              <button
                                onClick={() => openResetModal(st)}
                                className="text-[#5C5A85] hover:text-[#4D3FDC] p-1.5 transition rounded-lg hover:bg-slate-100"
                                title="Password Protected Break Reset"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-[#4D3FDC]" />
                              </button>

                              {/* Delete Staff */}
                              <button
                                onClick={() => setStaffToDelete(st)}
                                className="text-[#5C5A85] hover:text-rose-600 p-1.5 transition rounded-lg hover:bg-rose-50"
                                title="Delete Employee"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ================= TAB 3: DAILY BREAK LOGS ================= */}
        {currentTab === 'logs' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#171262]">Daily Break Logs & Audit Trail</h2>
                <p className="text-xs text-[#5C5A85]">Complete record of every break taken with supervisor exception tracking (voided breaks are excluded from totals)</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => downloadStandaloneHTML(false, 'index.html')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                  title="Download updated index.html file with your latest logs, break settings, and roster embedded inside"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save Logs to index.html</span>
                </button>
                <button
                  onClick={exportLogsToCSV}
                  className="bg-[#4D3FDC] hover:bg-[#3E30CE] text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition flex items-center space-x-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV for Google Sheets</span>
                </button>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E4E7F2] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 shadow-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#5C5A85] mb-1">Filter Date</label>
                <input
                  type="date"
                  value={logDateFilter}
                  onChange={(e) => setLogDateFilter(e.target.value)}
                  className="w-full bg-[#F8F9FE] border border-[#E4E7F2] text-[#171262] text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#4D3FDC]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5C5A85] mb-1">Filter Shift</label>
                <select
                  value={logShiftFilter}
                  onChange={(e) => setLogShiftFilter(e.target.value)}
                  className="w-full bg-[#F8F9FE] border border-[#E4E7F2] text-[#171262] text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#4D3FDC]"
                >
                  <option value="All">All Shifts</option>
                  <option value="Morning">Morning Shift</option>
                  <option value="Night">Night Shift</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5C5A85] mb-1">Break Type</label>
                <select
                  value={logTypeFilter}
                  onChange={(e) => setLogTypeFilter(e.target.value)}
                  className="w-full bg-[#F8F9FE] border border-[#E4E7F2] text-[#171262] text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#4D3FDC]"
                >
                  <option value="All">All Break Types</option>
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Tea">Tea</option>
                  <option value="Dinner">Dinner</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5C5A85] mb-1">Search Staff / ID</label>
                <input
                  type="text"
                  placeholder="Search name or ID..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full bg-[#F8F9FE] border border-[#E4E7F2] text-[#171262] text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#4D3FDC]"
                />
              </div>
            </div>

            {/* Warning Banner if Supervisor Login tries to delete a Daily Break Log */}
            {logDeleteWarning && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-amber-900 text-xs font-bold shadow-xs">
                <div className="flex items-center space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{logDeleteWarning}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLogDeleteWarning('')}
                  className="text-amber-700 hover:text-amber-950 p-1 cursor-pointer shrink-0"
                  title="Dismiss warning"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-2xl border border-[#E4E7F2] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FE] text-[#5C5A85] uppercase font-bold border-b border-[#E4E7F2]">
                    <tr>
                      <th className="px-3.5 py-3.5">Emp ID</th>
                      <th className="px-4 py-3.5">Employee Name</th>
                      <th className="px-3 py-3.5">Shift</th>
                      <th className="px-3.5 py-3.5">Date</th>
                      <th className="px-3.5 py-3.5">Break Type</th>
                      <th className="px-3.5 py-3.5">Start - End</th>
                      <th className="px-3.5 py-3.5 text-center">Actual Duration</th>
                      <th className="px-3.5 py-3.5 text-center">Variance (+/-)</th>
                      <th className="px-4 py-3.5">Supervisor Exception & Status</th>
                      <th className="px-3 py-3.5 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEFF8]">
                    {filteredLogs.map((log) => {
                      const startStr = new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const endStr = new Date(log.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <tr
                          key={log.id}
                          className={`hover:bg-[#F9FAFE] transition ${
                            log.deleted
                              ? 'opacity-75 bg-rose-50/40'
                              : log.voided
                              ? 'opacity-60 bg-slate-50'
                              : log.needsReview
                              ? 'bg-rose-50/40'
                              : ''
                          }`}
                        >
                          <td className="px-3.5 py-3 font-mono font-bold text-[#4D3FDC]">
                            #{log.empId || '---'}
                          </td>
                          <td className="px-4 py-3 font-bold text-[#171262] break-words">
                            {log.staffName}
                            {log.source === 'kiosk' && (
                              <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-black uppercase bg-indigo-50 text-[#4D3FDC] border border-indigo-200 rounded">
                                Kiosk
                              </span>
                            )}
                            {log.testMode && (
                              <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-black uppercase bg-amber-500 text-slate-950 rounded">
                                Test Mode
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-semibold text-[#5C5A85]">{log.shift}</td>
                          <td className="px-3.5 py-3 font-mono text-[#5C5A85]">{log.date}</td>
                          <td className="px-3.5 py-3 text-[#4D3FDC] font-semibold">{log.breakType}</td>
                          <td className="px-3.5 py-3 font-mono text-[#5C5A85]">{startStr} - {endStr}</td>
                          <td className="px-3.5 py-3 text-center font-mono font-bold text-[#171262]">
                            {log.voided || log.deleted ? (
                              <span className="line-through text-slate-400">{log.durationMins} mins</span>
                            ) : (
                              <span>
                                {log.durationMins}m{' '}
                                <span className="text-[10px] font-normal text-[#5C5A85]">(of {resolveAllottedMins(log)}m)</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 text-center">
                            {log.deleted ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 uppercase">
                                DELETED
                              </span>
                            ) : log.voided ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 uppercase">
                                VOIDED
                              </span>
                            ) : log.testMode ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 uppercase">
                                TEST (Excluded)
                              </span>
                            ) : log.varianceMins > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                +{log.varianceMins}m late
                              </span>
                            ) : log.varianceMins < 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                {log.varianceMins}m early
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                On Time
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {log.needsReview && !log.voided && !log.deleted && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white uppercase">
                                  NEEDS REVIEW
                                </span>
                              )}
                              <span className="text-[11px] text-[#171262] font-semibold">{log.exceptionReason}</span>
                            </div>
                            {log.notes && <p className="text-[10px] text-[#5C5A85] italic mt-0.5">{log.notes}</p>}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {log.deleted ? (
                              <div className="inline-flex flex-col items-end text-right bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1 text-[10px] leading-tight">
                                <span className="font-black text-rose-700">
                                  Deleted at {log.deletedAt}
                                </span>
                                <span className="font-semibold text-rose-600">
                                  by <strong className="font-mono text-[#171262]">{log.deletedBy || 'manager'}</strong> ({log.deletedDate || log.date})
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  if (loggedInAccount?.role !== 'Manager') {
                                    const warnMsg =
                                      'Warning: Supervisor login cannot delete daily break logs. Only Manager login has access to delete logs.';
                                    setLogDeleteWarning(warnMsg);
                                    showToast(warnMsg, 'warning');
                                    return;
                                  }
                                  setLogDeleteWarning('');
                                  const deletedTimeStr = new Date().toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true,
                                  });
                                  const deletedByUser = loggedInAccount.username || 'manager';
                                  const nextLogs = logs.map((l) =>
                                    l.id === log.id
                                      ? {
                                          ...l,
                                          deleted: true,
                                          deletedAt: deletedTimeStr,
                                          deletedDate: todayStr,
                                          deletedBy: deletedByUser,
                                        }
                                      : l
                                  );
                                  setLogs(nextLogs);
                                  serverSync({ logs: nextLogs });
                                  showToast(`Log deleted at ${deletedTimeStr} by ${deletedByUser}`, 'info');
                                }}
                                className={`p-1 cursor-pointer transition ${
                                  loggedInAccount?.role === 'Manager'
                                    ? 'text-slate-400 hover:text-rose-600'
                                    : 'text-slate-300 hover:text-amber-600'
                                }`}
                                title={
                                  loggedInAccount?.role === 'Manager'
                                    ? 'Delete Log (Manager Only)'
                                    : 'Supervisor login cannot delete logs (Manager Only)'
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredLogs.length === 0 && (
                <div className="p-8 text-center text-[#5C5A85] text-xs">
                  No break logs recorded matching your filter parameters.
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================= TAB 4: MONTHLY REPORT ================= */}
        {currentTab === 'report' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-[#171262]">Monthly Adherence & Variance Report</h2>
                <p className="text-xs text-[#5C5A85]">
                  Monthly entitled minutes use each taken break&apos;s saved allowed time and the current shift settings for breaks not taken (voided &amp; test mode breaks excluded)
                </p>
              </div>
            </div>

            {/* 1. Spacious Month Selection & Filter Controls Card */}
            <div className="bg-white p-6 rounded-2xl border border-[#E4E7F2] shadow-sm">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
                
                {/* Left: Prominent Month Picker with Large Clear Display */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                  <div className="p-3 bg-[#EEECFB] text-[#4D3FDC] rounded-xl border border-[#D5D0F9] shrink-0 hidden sm:flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 w-full sm:w-auto">
                    <label className="block text-xs font-bold text-[#5C5A85] uppercase tracking-wider">
                      Reporting Month
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="month"
                        value={reportMonth}
                        onChange={(e) => setReportMonth(e.target.value)}
                        className="bg-[#F8F9FE] hover:bg-white border-2 border-[#D5D0F9] text-[#171262] font-black text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#4D3FDC] shadow-xs transition cursor-pointer min-w-[190px]"
                      />
                      <button
                        type="button"
                        onClick={() => setReportMonth(todayStr.slice(0, 7))}
                        title="Jump to Current Month"
                        className="px-3.5 py-2.5 bg-white hover:bg-[#EEECFB] text-[#4D3FDC] font-bold text-xs rounded-xl border border-[#D5D0F9] transition shadow-xs cursor-pointer shrink-0"
                      >
                        Current Month
                      </button>
                    </div>
                  </div>

                  {/* Active Month Title Badge (Ensures user ALWAYS sees full month name clearly) */}
                  <div className="sm:border-l sm:border-[#E4E7F2] sm:pl-4 space-y-0.5">
                    <p className="text-[11px] font-medium text-[#5C5A85]">Active Period</p>
                    <p className="text-base font-black text-[#171262] tracking-wide">{formattedReportMonth}</p>
                  </div>
                </div>

                {/* Right: Shift Filter & Export CSV */}
                <div className="flex flex-wrap items-center gap-3 border-t lg:border-t-0 pt-4 lg:pt-0 border-[#E4E7F2]">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#5C5A85] uppercase tracking-wider">
                      Shift View
                    </label>
                    <select
                      value={reportShiftFilter}
                      onChange={(e) => setReportShiftFilter(e.target.value)}
                      className="bg-[#F8F9FE] border-2 border-[#E4E7F2] text-[#171262] font-bold text-xs rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#4D3FDC] shadow-xs cursor-pointer min-w-[140px]"
                    >
                      <option value="All">All Shifts ({staff.length})</option>
                      <option value="Morning">Morning Shift Only ({staff.filter((s) => s.shift === 'Morning').length})</option>
                      <option value="Night">Night Shift Only ({staff.filter((s) => s.shift === 'Night').length})</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-[#5C5A85] uppercase tracking-wider opacity-0 pointer-events-none">
                      Export
                    </label>
                    <button
                      onClick={exportMonthlyReportToCSV}
                      className="bg-[#4D3FDC] hover:bg-[#3E30CE] text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition flex items-center space-x-2 cursor-pointer shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Monthly CSV</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* 2. Spacious Aggregates KPI Grid (4 Distinct Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Staff Monitored */}
              <div className="bg-white p-5 rounded-2xl border border-[#E4E7F2] shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-[#EEECFB] text-[#4D3FDC] rounded-xl border border-[#D5D0F9]">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#5C5A85] uppercase tracking-wider">Staff Monitored</p>
                  <h3 className="text-2xl font-black text-[#171262]">{monthlyReportStaff.length} Employees</h3>
                  <p className="text-[11px] text-[#5C5A85]">{reportShiftFilter === 'All' ? 'All Shifts' : `${reportShiftFilter} Shift`}</p>
                </div>
              </div>

              {/* Standard Allotment */}
              <div className="bg-white p-5 rounded-2xl border border-[#E4E7F2] shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-indigo-50 text-[#4D3FDC] rounded-xl border border-indigo-200">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#5C5A85] uppercase tracking-wider">Monthly Entitled</p>
                  <h3 className="text-2xl font-black text-[#4D3FDC]">
                    {String(Math.floor(baselineMonthlyEntitledMins / 60)).padStart(2, '0')}:
                    {String(baselineMonthlyEntitledMins % 60).padStart(2, '0')} Hours
                  </h3>
                  <p className="text-[11px] text-[#5C5A85]">{baselineMonthlyEntitledMins} mins / 26 shifts ({baselineShiftDailyMins}m/shift)</p>
                </div>
              </div>

              {/* Total Break Exceed Staff Count */}
              <div className={`p-5 rounded-2xl border shadow-sm flex items-center space-x-4 ${staffOver26Count > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-[#E4E7F2]'}`}>
                <div className={`p-3 rounded-xl border ${staffOver26Count > 0 ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#5C5A85] uppercase tracking-wider">Total Break Exceed Staff Count</p>
                  <h3 className={`text-2xl font-black ${staffOver26Count > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {staffOver26Count} {staffOver26Count === 1 ? 'Staff' : 'Staff'}
                  </h3>
                  <p className="text-[11px] font-semibold text-[#5C5A85]">Exceeded Monthly Entitled</p>
                </div>
              </div>

              {/* Critical Overrun */}
              <div className={`p-5 rounded-2xl border shadow-sm flex items-center space-x-4 ${staffOver30Count > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-[#E4E7F2]'}`}>
                <div className={`p-3 rounded-xl border ${staffOver30Count > 0 ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#5C5A85]">Critical Overrun (+4h Over)</p>
                  <h3 className={`text-2xl font-black ${staffOver30Count > 0 ? 'text-rose-600' : 'text-[#171262]'}`}>
                    {staffOver30Count} {staffOver30Count === 1 ? 'Breach' : 'Breaches'}
                  </h3>
                  <p className="text-[11px] text-[#5C5A85]">{staffOver30Count > 0 ? 'Urgent attention required' : 'No critical violations'}</p>
                </div>
              </div>
            </div>

            {/* Monthly Report Table */}
            <div className="bg-white rounded-2xl border border-[#E4E7F2] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8F9FE] text-[#5C5A85] uppercase font-bold border-b border-[#E4E7F2]">
                    <tr>
                      <th className="px-3.5 py-3.5 whitespace-nowrap">Emp ID</th>
                      <th className="px-4 py-3.5 whitespace-nowrap">Employee Name</th>
                      <th className="px-3 py-3.5 whitespace-nowrap text-center">Shift</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">Monthly Entitled</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">Total Consumed</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">Net Variance (vs Entitled)</th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">Adherence Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEFF8]">
                    {monthlyReportStaff.map((st) => {
                      const userLogs = monthlyLogs.filter((l) => l.staffId === st.id);
                      const breaksCount = userLogs.length;
                      const consumedMins = userLogs.reduce((acc, l) => acc + l.durationMins, 0);
                      const entitledMins = calculateMonthlyEntitledMins(st.shift, userLogs, kioskSettings, 26);
                      const criticalMins = entitledMins + 240; // +4h above entitled
                      const netVarianceMins = consumedMins - entitledMins;

                      const isOverEntitled = consumedMins > entitledMins;
                      const isUnderEntitled = consumedMins < entitledMins;
                      const isOverCritical = consumedMins > criticalMins;

                      const entitledHours = Math.floor(entitledMins / 60);
                      const entitledRemMins = entitledMins % 60;
                      const entitledDigital = `${String(entitledHours).padStart(2, '0')}:${String(entitledRemMins).padStart(2, '0')} Hrs`;

                      // Format Consumed time as exact hours and minutes
                      const consumedHours = Math.floor(consumedMins / 60);
                      const consumedMinutes = consumedMins % 60;
                      const consumedFormatted = `${consumedHours}h ${String(consumedMinutes).padStart(2, '0')}m`;
                      const consumedDigital = `${String(consumedHours).padStart(2, '0')}:${String(consumedMinutes).padStart(2, '0')} Hrs`;

                      // Format Net Hours vs Entitled
                      const netDiffAbs = Math.abs(netVarianceMins);
                      const netDiffHours = Math.floor(netDiffAbs / 60);
                      const netDiffMinutes = netDiffAbs % 60;
                      const netDiffDigital = `${String(netDiffHours).padStart(2, '0')}:${String(netDiffMinutes).padStart(2, '0')} Hrs`;

                      return (
                        <tr
                          key={st.id}
                          className={`hover:bg-[#F9FAFE] transition ${
                            isOverCritical
                              ? 'bg-rose-50/70 border-l-4 border-l-rose-500'
                              : isOverEntitled
                              ? 'border-l-4 border-l-amber-400'
                              : ''
                          }`}
                        >
                          <td className="px-3.5 py-3.5 font-mono font-bold text-[#4D3FDC] whitespace-nowrap">
                            #{st.empId}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-bold text-[#171262] text-sm block tracking-normal break-words">{st.name}</span>
                            <span className="text-[11px] text-[#5C5A85] tracking-wide">{breaksCount} {breaksCount === 1 ? 'break' : 'breaks'} recorded</span>
                          </td>
                          <td className="px-3 py-3.5 text-center whitespace-nowrap">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold tracking-wide ${st.shift === 'Morning' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9]'}`}>
                              {st.shift}
                            </span>
                          </td>

                          {/* 1. Monthly Entitled: Uses log's saved allottedMins where taken + current setting where untaken */}
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className="font-mono font-bold text-[#171262] text-xs px-2.5 py-1 rounded-lg bg-[#F6F7FC] border border-[#E4E7F2] inline-block shadow-2xs tracking-wider">
                              {entitledDigital}
                            </span>
                            <span className="text-[11px] text-[#5C5A85] font-medium block mt-0.5">
                              ({entitledMins} mins)
                            </span>
                          </td>

                          {/* 2. Total Consumed: Exact digital hours & minutes */}
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            <span className="font-mono font-black text-[#171262] text-sm block tracking-wider">
                              {consumedDigital}
                            </span>
                            <span className="text-[11px] text-[#5C5A85] font-medium block tracking-wide">
                              {consumedFormatted} ({consumedMins} mins)
                            </span>
                          </td>

                          {/* 3. Net Hours vs Entitled */}
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {isOverEntitled ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="font-mono font-black text-rose-600 text-sm px-2.5 py-0.5 rounded-lg bg-rose-50 border border-rose-200 inline-block tracking-wider">
                                  +{netDiffDigital}
                                </span>
                                <span className="text-[11px] font-bold text-rose-600 mt-0.5 tracking-wide">
                                  +{netDiffHours}h {netDiffMinutes}m Over Entitled
                                </span>
                              </div>
                            ) : isUnderEntitled ? (
                              <div className="inline-flex flex-col items-center">
                                <span className="font-mono font-black text-emerald-600 text-sm px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 inline-block tracking-wider">
                                  -{netDiffDigital}
                                </span>
                                <span className="text-[11px] font-bold text-emerald-600 mt-0.5 tracking-wide">
                                  {netDiffHours}h {netDiffMinutes}m Remaining
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex flex-col items-center">
                                <span className="font-mono font-bold text-slate-600 text-sm px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 inline-block tracking-wider">
                                  00:00 Hrs
                                </span>
                                <span className="text-[11px] font-medium text-slate-500 mt-0.5 tracking-wide">
                                  Exact Entitled Target
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 4. Adherence Status */}
                          <td className="px-4 py-3.5 text-center whitespace-nowrap">
                            {isOverCritical ? (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className="px-3 py-1 text-[11px] font-black uppercase rounded-full bg-rose-600 text-white animate-pulse shadow-md flex items-center gap-1.5 tracking-wide">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>CRITICAL OVERRUN!</span>
                                </span>
                                <span className="text-[11px] text-rose-600 font-bold font-mono tracking-wider">
                                  +{formatHoursMins(consumedMins - criticalMins)} over critical limit
                                </span>
                              </div>
                            ) : isOverEntitled ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-amber-50 text-amber-800 border border-amber-300 inline-block tracking-wide">
                                Overtime (+{netDiffHours}h {netDiffMinutes}m)
                              </span>
                            ) : isUnderEntitled ? (
                              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block tracking-wide">
                                Within Allotment (Compliant)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9] inline-block tracking-wide">
                                Exact Target
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ================= TAB 5: SETTINGS & BACKUP (SUPERVISOR PIN CHECKED ON SERVER) ================= */}
        {currentTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-black text-[#171262]">System Settings & Data Management</h2>
              <p className="text-xs text-[#5C5A85]">Manage Employee Kiosk settings, database backups, audio notifications, and roster configurations</p>
            </div>

            {!settingsPinUnlocked ? (
              <div className="bg-white p-8 rounded-2xl border-2 border-[#4D3FDC] shadow-md max-w-md mx-auto space-y-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#EEECFB] text-[#4D3FDC] mx-auto flex items-center justify-center">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-[#171262]">Supervisor PIN Required</h3>
                  <p className="text-xs text-[#5C5A85]">
                    Enter the Supervisor PIN to open Settings &amp; Kiosk Configuration
                  </p>
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setVerifyingSettingsPin(true);
                    setSettingsPinError('');
                    const res = await verifyPinOnServer(settingsPinInput);
                    setVerifyingSettingsPin(false);
                    if (res.valid) {
                      setVerifiedSupervisorPin(settingsPinInput.trim());
                      setSettingsPinUnlocked(true);
                      setSettingsPinInput('');
                    } else {
                      setSettingsPinError('Incorrect Supervisor PIN. Please try again.');
                    }
                  }}
                  className="space-y-3"
                >
                  <input
                    type="password"
                    inputMode="numeric"
                    required
                    autoFocus
                    placeholder="Enter Supervisor PIN..."
                    value={settingsPinInput}
                    onChange={(e) => setSettingsPinInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F8F9FE] border-2 border-[#D5D0F9] text-center text-lg font-mono font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4D3FDC]"
                  />
                  {settingsPinError && (
                    <p className="text-xs font-bold text-rose-600">{settingsPinError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={verifyingSettingsPin}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-bold text-xs cursor-pointer transition"
                  >
                    {verifyingSettingsPin ? 'Checking on server...' : 'Unlock Settings'}
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* 1 MANAGER & 4 SUPERVISORS LOGIN ACCOUNTS & PASSWORD RESET SECTION */}
                <AccountPasswordManagerCard
                  accounts={authAccounts}
                  currentUser={loggedInAccount}
                  onUpdateAccounts={handleUpdateAuthAccounts}
                  onDownloadUpdatedHtml={() => downloadStandaloneHTML(false, 'index.html')}
                  showToast={showToast}
                />

                {/* KIOSK SETTINGS SECTION (Supervisor & Manager Only) */}
                <KioskSettingsCard
                  kioskSettings={kioskSettings}
                  isDefaultPin={isDefaultPin}
                  onUpdateKioskSettings={(next: KioskSettings) => {
                    setKioskSettings(next);
                    serverSync({ kioskSettings: next });
                    saveKioskSettingsOnServer(next, verifiedSupervisorPin);
                  }}
                  onPinChanged={(isDef: boolean) => setIsDefaultPin(isDef)}
                  onEnterLockedKiosk={() => {
                    setIsKioskLocked(true);
                    setCurrentTab('kiosk');
                  }}
                  showToast={showToast}
                />

            {/* Backup and restore */}
            <div className="bg-white p-6 rounded-2xl border border-[#E4E7F2] space-y-4 shadow-sm">
              <h3 className="font-bold text-[#171262] flex items-center space-x-2 text-sm">
                <FileSpreadsheet className="w-4 h-4 text-[#4D3FDC]" />
                <span>Backup &amp; Data Portability (GitHub Pages, PC &amp; Android Local Storage)</span>
              </h3>
              <p className="text-xs text-[#5C5A85]">
                Export or share a full JSON backup or download an updated self-contained index.html file with your latest roster, break settings, and login passwords embedded inside.
              </p>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => downloadStandaloneHTML(false, 'index.html')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition flex items-center space-x-2 shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>Download index.html (GitHub Pages / Android Local)</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportJSONBackup(false)}
                  className="bg-[#251B7C] hover:bg-[#1E1668] text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition flex items-center space-x-2 shadow-sm cursor-pointer"
                >
                  <Download className="w-4 h-4 text-cyan-300" />
                  <span>Download JSON Backup</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportJSONBackup(true)}
                  className="bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition flex items-center space-x-2 shadow-sm cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 text-white" />
                  <span>Share Backup (Android Share / Drive / WhatsApp)</span>
                </button>

                <label className="bg-white hover:bg-slate-50 text-[#171262] border border-[#E4E7F2] font-semibold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center space-x-2 shadow-xs">
                  <Upload className="w-4 h-4 text-[#4D3FDC]" />
                  <span>Restore from JSON Backup</span>
                  <input type="file" accept=".json,application/json" onChange={handleImportJSON} className="hidden" />
                </label>
              </div>
            </div>

            {/* Sound alert test */}
            <div className="bg-white p-6 rounded-2xl border border-[#E4E7F2] space-y-4 shadow-sm">
              <h3 className="font-bold text-[#171262] flex items-center space-x-2 text-sm">
                <Volume2 className="w-4 h-4 text-amber-500" />
                <span>Audio Alert Settings</span>
              </h3>
              <p className="text-xs text-[#5C5A85]">
                Play an audible alert tone when an active employee&apos;s break exceeds the allowed break time.
              </p>

              <div className="flex items-center space-x-3 pt-1">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
                    soundEnabled
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                      : 'bg-slate-100 text-slate-500 border border-slate-300'
                  }`}
                >
                  {soundEnabled ? <Check className="w-4 h-4 text-emerald-600" /> : <X className="w-4 h-4" />}
                  <span>{soundEnabled ? 'Alert Sounds Enabled' : 'Alert Sounds Muted'}</span>
                </button>

                <button
                  onClick={playBeep}
                  className="bg-white hover:bg-slate-50 text-[#171262] border border-[#E4E7F2] px-3.5 py-2 rounded-xl text-xs font-medium transition shadow-xs"
                >
                  Test Alarm Tone
                </button>
              </div>
            </div>

            {/* Card 3: Reset Dashboard with Password */}
            <div className="bg-white p-6 rounded-2xl border border-rose-200 space-y-3 shadow-sm">
              <div className="flex items-center space-x-2 text-rose-600">
                <Lock className="w-4 h-4" />
                <h3 className="font-bold text-sm">Reset Dashboard (Password Protected)</h3>
              </div>
              <p className="text-xs text-[#5C5A85] leading-relaxed">
                Supervisors can reset today's active break timers and daily counters for a fresh shift start, or perform a full factory roster restore. Protected by supervisor authorization password.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setDashboardResetPassword('');
                    setDashboardResetError('');
                    setDashboardResetAction('today');
                    setDashboardResetModalOpen(true);
                  }}
                  className="bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center space-x-2 shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Dashboard with Password</span>
                </button>
              </div>
            </div>
              </>
            )}

          </div>
        )}

      </main>
      )}

      {/* ================= PERMANENT FOOTER ================= */}
      <footer
        id="uf-permanent-footer-credit"
        data-system-architect={_APP_VERIFIED_DEV.fullName}
        data-created-by={_APP_VERIFIED_DEV.createdByLabel}
        className="bg-[#251B7C] border-t border-[#1E1668] py-4 mt-auto text-indigo-200 text-xs shadow-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          
          {/* Main Row: Washmen Branding on Left, Created By Udara Fernando on Right */}
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
              <span className="text-indigo-200">Wash & Fold Department</span>
            </div>

            {/* Right: Isolated Credit Container ("Created By • Udara Fernando") + Info (i) button */}
            <div className="flex items-center space-x-2.5">
              <div
                ref={dashboardCreditContainerRef}
                id="uf-dashboard-credit-container"
                data-credit-container="dashboard"
                className="flex items-center space-x-2.5"
              >
                <span data-uf-protected-label="true" className="text-indigo-200">
                  Created By
                </span>
                <span>•</span>
                <span data-uf-protected-name="true" className="font-bold text-white">
                  {_APP_VERIFIED_DEV.fullName}
                </span>
                <span data-uf-protected-title="true" className="sr-only">
                  About the creator
                </span>
              </div>
              <button
                onClick={() => setDevModalOpen(true)}
                className="text-indigo-300 hover:text-white p-1.5 transition cursor-pointer"
                title="About the creator"
                aria-label="About the creator"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Centered ONLY: Copyright Notice */}
          <div className="pt-2.5 border-t border-white/10 text-center text-indigo-200/90 text-xs font-medium tracking-wide">
            © 2026 Washmen. All rights reserved.
          </div>

        </div>
      </footer>

      {/* ================= MODAL 1: STOP BREAK & SUPERVISOR OVERRIDE ================= */}
      {stopModalBreak && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#E4E7F2]">
            <div className="bg-[#251B7C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-500 text-white rounded-lg">
                  <Square className="w-4 h-4 fill-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Stop Break & Log Reason</h3>
                  <p className="text-xs text-indigo-200">
                    {stopModalBreak.staffName} {stopModalBreak.empId ? `(ID: ${stopModalBreak.empId})` : ''} • {stopModalBreak.shift} Shift
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStopModalBreak(null)}
                className="text-indigo-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Summary stat box */}
              {(() => {
                const elapsedSeconds = Math.floor(
                  (currentTime.getTime() - new Date(stopModalBreak.startTime).getTime()) / 1000
                );
                const mins = Math.floor(elapsedSeconds / 60);
                const secs = elapsedSeconds % 60;
                const elapsedFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                const modalAllottedMins = resolveAllottedMins(stopModalBreak);
                return (
                  <div className="bg-[#F8F9FE] p-4 rounded-xl border border-[#E4E7F2] grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <span className="block text-[10px] text-[#5C5A85] uppercase font-semibold">Break Type</span>
                      <span className="font-bold text-[#4D3FDC]">{stopModalBreak.breakType}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#5C5A85] uppercase font-semibold">Raw Elapsed</span>
                      <span className="font-bold text-[#171262] font-mono">{elapsedFormatted}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#5C5A85] uppercase font-semibold">Allotted</span>
                      <span className="font-bold text-[#5C5A85]">{modalAllottedMins} mins</span>
                    </div>
                  </div>
                );
              })()}

              {/* Exception reason dropdown */}
              <div>
                <label className="block text-xs font-semibold text-[#171262] mb-1.5">
                  Supervisor Exception / Return Scenario <span className="text-rose-500">*</span>
                </label>
                  <select
                  value={exceptionReason}
                  onChange={(e) => {
                    const val = e.target.value;
                    setExceptionReason(val);
                    if (val === 'Supervisor Forgot') {
                      setCustomMinutesStr(String(resolveAllottedMins(stopModalBreak)));
                    }
                  }}
                  className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl px-3.5 py-2.5 text-xs text-[#171262] font-medium focus:ring-2 focus:ring-[#4D3FDC] focus:outline-none"
                >
                  <option value="Normal">Normal (Returned on time)</option>
                  <option value="Supervisor Forgot">
                    Employee returned on time, but supervisor forgot to stop timer
                  </option>
                  <option value="Returned Late">Employee returned late</option>
                  <option value="Approved Extended">
                    Approved extended break (operational / wash floor delay)
                  </option>
                  <option value="Interrupted Early">Break interrupted early (recalled to floor)</option>
                  <option value="Manual Override">Manual duration override</option>
                </select>
              </div>

              {/* Custom duration adjustment if supervisor correction needed */}
              {['Supervisor Forgot', 'Interrupted Early', 'Manual Override', 'Approved Extended'].includes(
                exceptionReason
              ) && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <label className="block text-xs font-semibold text-amber-800">
                    Adjusted Duration to Record (Minutes):
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={String(resolveAllottedMins(stopModalBreak))}
                      value={customMinutesStr}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setCustomMinutesStr(clean);
                      }}
                      className="w-24 bg-white border border-amber-300 text-[#171262] text-sm font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <span className="text-xs font-semibold text-amber-800">minutes</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    {exceptionReason === 'Supervisor Forgot'
                      ? `Defaults to ${resolveAllottedMins(stopModalBreak)} minutes allotment so employee is not penalized for supervisor delay.`
                      : 'This duration will replace the raw timer in daily break logs.'}
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#171262] mb-1">
                  Supervisor Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={supervisorNotes}
                  onChange={(e) => setSupervisorNotes(e.target.value)}
                  placeholder="Reason or operational context..."
                  className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl p-2.5 text-xs text-[#171262] focus:ring-2 focus:ring-[#4D3FDC] focus:outline-none"
                ></textarea>
              </div>
            </div>

            <div className="bg-[#FAFBFD] px-6 py-4 border-t border-[#E4E7F2] flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setStopModalBreak(null)}
                className="px-4 py-2 text-xs font-semibold text-[#5C5A85] hover:text-[#171262] rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCompletedBreak}
                className="px-5 py-2 text-xs font-bold bg-[#4D3FDC] hover:bg-[#3E30CE] text-white rounded-xl shadow-md transition"
              >
                Confirm & Log Break
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: ADD / EDIT STAFF MEMBER (WITH EMPLOYEE ID & DESIGNATION) ================= */}
      {staffModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#E4E7F2]">
            <div className="bg-[#251B7C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">
                  {editingStaffId ? 'Edit Employee Details' : 'Add New Employee to Roster'}
                </h3>
              </div>
              <button onClick={() => setStaffModalOpen(false)} className="text-indigo-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="p-6 space-y-4">
              {/* Employee ID Input */}
              <div>
                <label className="block text-xs font-semibold text-[#171262] mb-1">
                  Employee ID Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1448"
                  value={staffFormEmpId}
                  onChange={(e) => setStaffFormEmpId(e.target.value)}
                  className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl px-3.5 py-2.5 text-xs text-[#171262] font-mono font-bold focus:ring-2 focus:ring-[#4D3FDC] focus:outline-none"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-[#171262] mb-1">
                  Full Employee Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Udara Fernando"
                  value={staffFormName}
                  onChange={(e) => setStaffFormName(e.target.value)}
                  className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl px-3.5 py-2.5 text-xs text-[#171262] focus:ring-2 focus:ring-[#4D3FDC] focus:outline-none"
                />
              </div>

              {/* Shift */}
              <div>
                <label className="block text-xs font-semibold text-[#171262] mb-1">Assigned Shift</label>
                <select
                  value={staffFormShift}
                  onChange={(e) => setStaffFormShift(e.target.value as 'Morning' | 'Night')}
                  className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl px-3.5 py-2.5 text-xs text-[#171262] focus:ring-2 focus:ring-[#4D3FDC] focus:outline-none"
                >
                  <option value="Morning">Morning Shift</option>
                  <option value="Night">Night Shift</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#5C5A85] hover:text-[#171262] rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-[#4D3FDC] hover:bg-[#3E30CE] text-white rounded-xl shadow-md transition"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: PASSWORD-PROTECTED SUPERVISOR RESET & BREAK EDIT ================= */}
      {resetModalStaff && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#E4E7F2] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-[#251B7C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-400 text-slate-950 rounded-lg">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Supervisor Break Time Reset & Edit</h3>
                  <p className="text-xs text-indigo-200">
                    {resetModalStaff.name} (Emp ID: #{resetModalStaff.empId}) • {resetModalStaff.shift} Shift
                  </p>
                </div>
              </div>
              <button onClick={() => setResetModalStaff(null)} className="text-indigo-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content: Step 1 Password Check if not unlocked */}
            {!supervisorUnlocked ? (
              <form onSubmit={verifySupervisorPassword} className="p-6 space-y-4">
                <div className="p-3.5 bg-[#EEECFB] border border-[#D5D0F9] rounded-xl flex items-start space-x-2.5 text-xs text-[#171262]">
                  <Lock className="w-4 h-4 text-[#4D3FDC] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Supervisor Authorization Required</p>
                    <p className="text-[#5C5A85] text-[11px] mt-0.5">
                      Resetting or modifying an individual employee's break records requires the supervisor password.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171262] mb-1">
                    Enter Supervisor Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter password..."
                    value={supervisorPasswordInput}
                    onChange={(e) => setSupervisorPasswordInput(e.target.value)}
                    className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl px-3.5 py-2.5 text-sm text-[#171262] focus:ring-2 focus:ring-[#4D3FDC] focus:outline-none"
                    autoFocus
                  />
                  {supervisorPasswordError && (
                    <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {supervisorPasswordError}
                    </p>
                  )}
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setResetModalStaff(null)}
                    className="px-4 py-2 text-xs font-semibold text-[#5C5A85] hover:text-[#171262] rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-[#4D3FDC] hover:bg-[#3E30CE] text-white rounded-xl shadow-md transition flex items-center space-x-1.5"
                  >
                    <BadgeCheck className="w-3.5 h-3.5" />
                    <span>Authorize & Unlock</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: Supervisor Adjustment & Reset Options */
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* Current status banner */}
                <div className="bg-[#FAFBFD] p-3.5 rounded-xl border border-[#E4E7F2] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#5C5A85] text-[10px] uppercase font-bold block">Current Today's Total Consumed</span>
                    <span className="font-mono font-black text-sm text-[#171262]">
                      {logs.filter((l) => l.staffId === resetModalStaff.id && l.date === todayStr).reduce((acc, l) => acc + l.durationMins, 0)} mins used today
                    </span>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                    Supervisor Unlocked ✓
                  </span>
                </div>

                {/* 1. What would you like to reset? */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-[#171262]">
                    1. Select Reset Action:
                  </label>
                  <div className="space-y-2 text-xs text-[#171262]">
                    <div
                      onClick={() => setResetActionType('zero')}
                      className={`flex items-center space-x-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                        resetActionType === 'zero'
                          ? 'border-[#4D3FDC] bg-[#F8F9FE]'
                          : 'border-[#E4E7F2] hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resetOpt"
                        checked={resetActionType === 'zero'}
                        onChange={() => setResetActionType('zero')}
                        className="text-[#4D3FDC] focus:ring-[#4D3FDC]"
                      />
                      <div>
                        <span className="font-bold text-[#171262] block">Reset Total Break Time to Zero (00:00)</span>
                        <span className="text-[11px] text-[#5C5A85]">Clears all consumed break logs for today so employee starts completely fresh.</span>
                      </div>
                    </div>

                    <div
                      onClick={() => setResetActionType('custom')}
                      className={`flex items-start space-x-2.5 p-3 rounded-xl border cursor-pointer transition ${
                        resetActionType === 'custom'
                          ? 'border-[#4D3FDC] bg-[#F8F9FE]'
                          : 'border-[#E4E7F2] hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resetOpt"
                        checked={resetActionType === 'custom'}
                        onChange={() => setResetActionType('custom')}
                        className="text-[#4D3FDC] focus:ring-[#4D3FDC] mt-1"
                      />
                      <div className="flex-1">
                        <span className="font-bold text-[#171262] block">Set Custom Consumed Duration (00:00 Hours:Minutes)</span>
                        <span className="text-[11px] text-[#5C5A85]">Manually overwrite today's consumed break time in Hours : Minutes (00:00) format.</span>
                        {resetActionType === 'custom' && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-3 p-3 bg-white rounded-xl border border-[#D5D0F9] space-y-2.5 cursor-default"
                          >
                            <div className="flex flex-wrap items-center gap-2.5">
                              {/* 00:00 (Hours : Minutes) Input Box */}
                              <div className="inline-flex items-center bg-[#F8F9FE] border-2 border-[#4D3FDC] rounded-xl px-2.5 py-1.5 shadow-2xs">
                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#5C5A85]">
                                    Hours
                                  </span>
                                  <input
                                    ref={resetHoursInputRef}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="00"
                                    value={resetCustomHoursStr}
                                    onFocus={() => {
                                      if (resetCustomHoursStr === '0' || resetCustomHoursStr === '00') {
                                        setResetCustomHoursStr('');
                                      }
                                    }}
                                    onBlur={() => {
                                      const num = parseInt(resetCustomHoursStr || '0', 10) || 0;
                                      if (num === 0) {
                                        setResetCustomHoursStr('');
                                      } else {
                                        setResetCustomHoursStr(String(num).padStart(2, '0'));
                                      }
                                    }}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (raw.includes(':')) {
                                        const [hPart, mPart] = raw.split(':');
                                        const cleanH = hPart.replace(/\D/g, '').slice(0, 2);
                                        const cleanM = (mPart || '').replace(/\D/g, '').slice(0, 2);
                                        setResetCustomHoursStr(cleanH);
                                        if (cleanM) setResetCustomMinsStr(cleanM);
                                        resetMinsInputRef.current?.focus();
                                        return;
                                      }
                                      const clean = raw.replace(/\D/g, '').slice(0, 2);
                                      setResetCustomHoursStr(clean);
                                      if (clean.length === 2) {
                                        resetMinsInputRef.current?.focus();
                                      }
                                    }}
                                    aria-label="Hours (00)"
                                    className="w-12 text-center bg-white border border-[#E4E7F2] rounded-lg py-1 text-base font-mono font-black text-[#171262] placeholder:text-slate-300 focus:border-[#4D3FDC] focus:ring-2 focus:ring-[#4D3FDC]/20 focus:outline-none"
                                  />
                                </div>

                                <span className="mx-1.5 text-lg font-mono font-black text-[#4D3FDC] mt-3">:</span>

                                <div className="flex flex-col items-center">
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#5C5A85]">
                                    Minutes
                                  </span>
                                  <input
                                    ref={resetMinsInputRef}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="00"
                                    value={resetCustomMinsStr}
                                    onFocus={() => {
                                      if (resetCustomMinsStr === '0' || resetCustomMinsStr === '00') {
                                        setResetCustomMinsStr('');
                                      }
                                    }}
                                    onBlur={() => {
                                      const num = parseInt(resetCustomMinsStr || '0', 10) || 0;
                                      if (num === 0) {
                                        setResetCustomMinsStr('');
                                      } else {
                                        setResetCustomMinsStr(String(num).padStart(2, '0'));
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Backspace' && resetCustomMinsStr === '') {
                                        resetHoursInputRef.current?.focus();
                                      }
                                    }}
                                    onChange={(e) => {
                                      const clean = e.target.value.replace(/\D/g, '').slice(0, 3);
                                      setResetCustomMinsStr(clean);
                                    }}
                                    aria-label="Minutes (00)"
                                    className="w-12 text-center bg-white border border-[#E4E7F2] rounded-lg py-1 text-base font-mono font-black text-[#171262] placeholder:text-slate-300 focus:border-[#4D3FDC] focus:ring-2 focus:ring-[#4D3FDC]/20 focus:outline-none"
                                  />
                                </div>
                              </div>

                              {/* Clear to 00:00 button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setResetCustomHoursStr('');
                                  setResetCustomMinsStr('');
                                  resetMinsInputRef.current?.focus();
                                }}
                                className="px-2.5 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                              >
                                Clear (00:00)
                              </button>

                              {/* Live Total Badge */}
                              <div className="px-2.5 py-1.5 bg-[#EEECFB] border border-[#D5D0F9] rounded-lg text-[11px] font-mono font-bold text-[#171262]">
                                Total:{' '}
                                <span className="text-[#4D3FDC] font-black">
                                  {String(Math.floor(totalCustomConsumedMins / 60)).padStart(2, '0')}:
                                  {String(totalCustomConsumedMins % 60).padStart(2, '0')}
                                </span>{' '}
                                ({totalCustomConsumedMins} mins)
                              </div>
                            </div>

                            {/* Quick Preset 00:00 Buttons */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              <span className="text-[10px] font-bold text-[#5C5A85] mr-1">Quick set:</span>
                              {[
                                { label: '00:10', h: '', m: '10' },
                                { label: '00:15', h: '', m: '15' },
                                { label: '00:20', h: '', m: '20' },
                                { label: '00:30', h: '', m: '30' },
                                { label: '00:40', h: '', m: '40' },
                                { label: '01:00', h: '01', m: '' },
                                { label: '01:20', h: '01', m: '20' },
                              ].map((preset) => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() => {
                                    setResetCustomHoursStr(preset.h);
                                    setResetCustomMinsStr(preset.m);
                                  }}
                                  className="px-2 py-1 rounded-md text-[11px] font-mono font-bold bg-[#F8F9FE] hover:bg-[#EEECFB] text-[#171262] border border-[#E4E7F2] hover:border-[#4D3FDC] transition cursor-pointer"
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      onClick={() => setResetActionType('clearBreak')}
                      className={`flex items-center space-x-2.5 p-2.5 rounded-xl border cursor-pointer transition ${
                        resetActionType === 'clearBreak'
                          ? 'border-[#4D3FDC] bg-[#F8F9FE]'
                          : 'border-[#E4E7F2] hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resetOpt"
                        checked={resetActionType === 'clearBreak'}
                        onChange={() => setResetActionType('clearBreak')}
                        className="text-[#4D3FDC] focus:ring-[#4D3FDC]"
                      />
                      <div className="flex-1">
                        <span className="font-bold text-[#171262] block">Clear Single Break Only</span>
                        <span className="text-[11px] text-[#5C5A85]">Keep other breaks and only delete/reset one specific break.</span>
                        {resetActionType === 'clearBreak' && (
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={targetBreakToClear}
                              onChange={(e) => setTargetBreakToClear(e.target.value)}
                              className="bg-white border border-[#4D3FDC] rounded-lg px-3 py-1 text-xs font-bold text-[#171262]"
                            >
                              {getShiftBreakSlots(kioskSettings, resetModalStaff.shift).map((s) => (
                                <option key={s.slot} value={s.name}>
                                  {s.name} ({s.mins}m)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. From where it needs to start / continue */}
                {(() => {
                  const modalShiftSlots = getShiftBreakSlots(kioskSettings, resetModalStaff.shift);
                  const selectedContinueSlot =
                    modalShiftSlots.find((s) => s.name === continueFromBreak) || modalShiftSlots[0];
                  const continueEffectiveMins = getEffectiveBreakMins(kioskSettings, selectedContinueSlot.mins);
                  return (
                    <div className="space-y-2 pt-2 border-t border-[#E4E7F2]">
                      <label className="block text-xs font-bold text-[#171262]">
                        2. From which break should the employee start / continue next?
                      </label>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[...modalShiftSlots.map((s) => s.name), 'None'].map((b) => (
                          <label
                            key={b}
                            className={`p-2.5 rounded-xl border flex items-center space-x-2 cursor-pointer transition ${
                              continueFromBreak === b
                                ? 'bg-[#EEECFB] border-[#4D3FDC] text-[#4D3FDC] font-bold'
                                : 'border-[#E4E7F2] hover:bg-slate-50 text-[#171262]'
                            }`}
                          >
                            <input
                              type="radio"
                              name="continueBreak"
                              checked={continueFromBreak === b}
                              onChange={() => setContinueFromBreak(b)}
                              className="text-[#4D3FDC] focus:ring-[#4D3FDC]"
                            />
                            <span>{b === 'None' ? 'None (Shift Complete)' : `${b} Break`}</span>
                          </label>
                        ))}
                      </div>

                      {/* Immediate Timer Trigger Checkbox */}
                      {continueFromBreak !== 'None' && (
                        <label className="flex items-center space-x-2 text-xs font-semibold text-[#171262] pt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoStartTimer}
                            onChange={(e) => setAutoStartTimer(e.target.checked)}
                            className="rounded text-[#4D3FDC] focus:ring-[#4D3FDC] w-4 h-4"
                          />
                          <span>
                            Launch active {continueEffectiveMins}m timer for {continueFromBreak} break immediately now
                          </span>
                        </label>
                      )}
                    </div>
                  );
                })()}

                {/* 3. Reason & Notes */}
                <div className="pt-2 border-t border-[#E4E7F2]">
                  <label className="block text-xs font-semibold text-[#171262] mb-1">
                    Supervisor Reason / Context (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Timer started accidentally by colleague, floor recall..."
                    value={supervisorResetNotes}
                    onChange={(e) => setSupervisorResetNotes(e.target.value)}
                    className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl px-3 py-2 text-xs text-[#171262] focus:ring-2 focus:ring-[#4D3FDC]"
                  />
                </div>

                {/* Actions */}
                <div className="bg-[#FAFBFD] -mx-6 -mb-6 p-4 border-t border-[#E4E7F2] flex justify-end space-x-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setResetModalStaff(null)}
                    className="px-4 py-2 text-xs font-semibold text-[#5C5A85] hover:text-[#171262] rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applySupervisorReset}
                    className="px-5 py-2 text-xs font-bold bg-[#4D3FDC] hover:bg-[#3E30CE] text-white rounded-xl shadow-md transition flex items-center space-x-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Apply Supervisor Reset</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL 4: CONFIRM DELETE STAFF WARNING ================= */}
      {staffToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-300 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-600 p-5 flex items-center justify-between text-white">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/20 text-white rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Delete Employee Confirmation</h3>
                  <p className="text-xs text-rose-100">Permanent Roster Removal</p>
                </div>
              </div>
              <button onClick={() => setStaffToDelete(null)} className="text-white hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-[#171262]">
                Are you sure you want to permanently delete{' '}
                <strong className="text-rose-600 font-black underline decoration-rose-500 underline-offset-2">
                  {staffToDelete.name} (Emp ID: #{staffToDelete.empId})
                </strong>{' '}
                from the <strong>{staffToDelete.shift} Shift</strong> roster?
              </p>

              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Warning:</strong> This action <u>cannot be undone</u>! The employee will be completely removed from the department roster and any active break timers will be cancelled immediately.
                </p>
              </div>
            </div>

            <div className="bg-[#FAFBFD] px-6 py-4 border-t border-[#E4E7F2] flex justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-[#5C5A85] hover:text-[#171262] bg-white border border-[#E4E7F2] rounded-xl transition shadow-xs"
              >
                No, Keep Employee
              </button>
              <button
                type="button"
                onClick={confirmDeleteStaff}
                className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 5: ABOUT THE CREATOR (UDARA FERNANDO) ================= */}
      {devModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            ref={modalCreditContainerRef}
            data-credit-container="modal"
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#E4E7F2]"
          >
            <div className="bg-[#251B7C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-cyan-300" />
                <h3 data-uf-protected-title="true" className="font-bold text-base text-white">
                  About the creator
                </h3>
              </div>
              <button onClick={() => setDevModalOpen(false)} className="text-indigo-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-[#4D3FDC] mx-auto flex items-center justify-center shadow-md text-white font-black text-2xl">
                UF
              </div>

              <div>
                <h4 data-uf-protected-name="true" className="text-lg font-black text-[#171262]">
                  {_APP_VERIFIED_DEV.fullName}
                </h4>
                <p className="text-xs text-[#4D3FDC] font-bold">Wash & Fold Department • Washmen Laundry</p>
                <p className="text-xs text-[#5C5A85] mt-1">Creator & Lead Architect of this Break Management System</p>
              </div>

              <div className="bg-[#F8F9FE] p-4 rounded-xl border border-[#E4E7F2] text-left text-xs space-y-2 text-[#5C5A85]">
                <p className="text-[11px] text-[#5C5A85]">
                  This system was conceptualized, structured, and customized by{' '}
                  <strong data-uf-protected-name="true">{_APP_VERIFIED_DEV.fullName}</strong> to solve shift break overruns,
                  maintain employee fairness, and streamline supervisor logs.
                </p>
                <div className="pt-1 flex items-center text-[#4D3FDC] font-medium text-xs">
                  <Check className="w-4 h-4 text-emerald-600 mr-1.5" />
                  <span>Project Creator &amp; Author</span>
                </div>
              </div>

              <a
                href="https://www.linkedin.com/in/udara-fernando-076b76bb"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#0077b5] hover:bg-[#006396] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-md"
              >
                <span>Visit Udara Fernando&apos;s LinkedIn Profile</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: MASTER DASHBOARD RESET WITH PASSWORD ================= */}
      {dashboardResetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-300 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#251B7C] p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm text-white">Supervisor Reset Authorization</h3>
              </div>
              <button
                onClick={() => setDashboardResetModalOpen(false)}
                className="text-indigo-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDashboardReset} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-[#171262] mb-1">
                  Supervisor Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#5C5A85] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="Enter password..."
                    value={dashboardResetPassword}
                    onChange={(e) => {
                      setDashboardResetPassword(e.target.value);
                      if (dashboardResetError) setDashboardResetError('');
                    }}
                    className="w-full bg-[#F8F9FE] border border-[#E4E7F2] rounded-xl pl-9 pr-3 py-2 text-xs text-[#171262] focus:ring-2 focus:ring-[#4D3FDC]"
                  />
                </div>
                {dashboardResetError && (
                  <p className="text-rose-600 font-bold text-[11px] mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{dashboardResetError}</span>
                  </p>
                )}
              </div>

              {/* Reset Scope Selection */}
              <div className="p-3 bg-[#F8F9FE] rounded-xl border border-[#E4E7F2] space-y-2.5">
                <label className="block font-bold text-[#171262]">Select Reset Scope:</label>
                
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dashboardResetScope"
                    value="today"
                    checked={dashboardResetAction === 'today'}
                    onChange={() => setDashboardResetAction('today')}
                    className="mt-0.5 text-[#4D3FDC]"
                  />
                  <div>
                    <strong className="text-[#171262] block">Reset Today's Dashboard & Active Breaks</strong>
                    <span className="text-[11px] text-[#5C5A85]">Clears running break timers and today's logs for a fresh shift. Keeps all 32 employee roster entries intact.</span>
                  </div>
                </label>

                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dashboardResetScope"
                    value="factory"
                    checked={dashboardResetAction === 'factory'}
                    onChange={() => setDashboardResetAction('factory')}
                    className="mt-0.5 text-[#4D3FDC]"
                  />
                  <div>
                    <strong className="text-rose-600 block">Master Factory Reset</strong>
                    <span className="text-[11px] text-[#5C5A85]">Restores the standard 32 employees (15 Morning, 17 Night) with default Employee IDs and clears all break logs.</span>
                  </div>
                </label>
              </div>

              <div className="bg-[#FAFBFD] -mx-6 -mb-6 p-4 border-t border-[#E4E7F2] flex justify-end space-x-2 mt-4">
                <button
                  type="button"
                  onClick={() => setDashboardResetModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#5C5A85] hover:text-[#171262] bg-white border border-[#E4E7F2] rounded-xl transition shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md transition flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirm & Execute Reset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RESTORE DEFAULT ROSTER (IN-PAGE MODAL, NO confirm()) ================= */}
      {restoreRosterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#E4E7F2] animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#251B7C] p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 text-cyan-300" />
                <h3 className="font-bold text-sm text-white">Restore Default 32 Staff Roster</h3>
              </div>
              <button
                onClick={() => setRestoreRosterModalOpen(false)}
                className="text-indigo-200 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-[#171262] font-semibold leading-relaxed">
                Are you sure you want to reset all staff back to the default Wash &amp; Fold roster (32 employees: 15 Morning, 17 Night) provided by the company?
              </p>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRestoreRosterModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#5C5A85] hover:text-[#171262] bg-white border border-[#E4E7F2] rounded-xl transition shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRestoreDefaultRoster}
                  className="px-5 py-2 text-xs font-bold bg-[#4D3FDC] hover:bg-[#3E30CE] text-white rounded-xl shadow-md transition"
                >
                  Restore Roster
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST NOTIFICATION CONTAINER ================= */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none">
          <div
            className={`pointer-events-auto px-4 py-3 rounded-xl shadow-2xl text-xs font-bold text-white flex items-center space-x-2.5 transition-all transform animate-in slide-in-from-bottom-5 duration-200 ${
              toast.type === 'success'
                ? 'bg-emerald-600'
                : toast.type === 'danger'
                ? 'bg-rose-600'
                : toast.type === 'warning'
                ? 'bg-amber-600'
                : 'bg-[#251B7C]'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : toast.type === 'danger' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
