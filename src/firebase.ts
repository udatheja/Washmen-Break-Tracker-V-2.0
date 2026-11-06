import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  onSnapshot,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  AuthAccount,
  SyncableStaff,
  SyncableActiveBreak,
  SyncableBreakLog,
  KioskSettings,
} from './kioskTypes';

function resolveFirebaseConfig(raw: typeof firebaseConfig) {
  const rawKey = String(raw.apiKey || '').trim();
  const resolvedKey = rawKey.startsWith('rev:')
    ? rawKey.slice(4).split('').reverse().join('')
    : rawKey;
  return {
    ...raw,
    apiKey: resolvedKey,
  };
}

const app = initializeApp(resolveFirebaseConfig(firebaseConfig));
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const STATION_SYNC_COLLECTION = 'station_sync';
export const STATION_SYNC_DOC_ID = 'washmen_wf_main';
export const STATION_SYNC_TOKEN = 'UF-WASHMEN-WF-2026-SYNC';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export interface CloudStationSyncPayload {
  stationId: string;
  syncToken: string;
  authAccounts: AuthAccount[];
  staff: SyncableStaff[];
  activeBreaks: SyncableActiveBreak[];
  logs: SyncableBreakLog[];
  deletedLogs: string[];
  deletedStaff: string[];
  closedBreakIds: string[];
  kioskSettings: KioskSettings;
  updatedByRole: string;
  updatedAtMs: number;
}

function stripUndefinedDeep<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

export function buildBoundedStationPayload(
  raw: Omit<CloudStationSyncPayload, 'stationId' | 'syncToken' | 'updatedAtMs'> & {
    updatedAtMs?: number;
  }
): CloudStationSyncPayload {
  const clean = stripUndefinedDeep(raw);
  return {
    stationId: STATION_SYNC_DOC_ID,
    syncToken: STATION_SYNC_TOKEN,
    authAccounts: Array.isArray(clean.authAccounts) ? clean.authAccounts.slice(0, 10) : [],
    staff: Array.isArray(clean.staff) ? clean.staff.slice(0, 200) : [],
    activeBreaks: Array.isArray(clean.activeBreaks) ? clean.activeBreaks.slice(0, 100) : [],
    logs: Array.isArray(clean.logs) ? clean.logs.slice(0, 1000) : [],
    deletedLogs: Array.isArray(clean.deletedLogs)
      ? clean.deletedLogs.map((id) => String(id).slice(0, 128)).slice(0, 1000)
      : [],
    deletedStaff: Array.isArray(clean.deletedStaff)
      ? clean.deletedStaff.map((id) => String(id).slice(0, 128)).slice(0, 200)
      : [],
    closedBreakIds: Array.isArray(clean.closedBreakIds)
      ? clean.closedBreakIds.map((id) => String(id).slice(0, 128)).slice(0, 1000)
      : [],
    kioskSettings:
      clean.kioskSettings && typeof clean.kioskSettings === 'object'
        ? clean.kioskSettings
        : ({} as KioskSettings),
    updatedByRole: String(clean.updatedByRole || 'system').slice(0, 64) || 'system',
    updatedAtMs: Math.max(1, Math.floor(Number(clean.updatedAtMs) || Date.now())),
  };
}

export async function pushCloudStationSync(
  payload: Omit<CloudStationSyncPayload, 'stationId' | 'syncToken' | 'updatedAtMs'> & {
    updatedAtMs?: number;
  }
): Promise<void> {
  const path = `${STATION_SYNC_COLLECTION}/${STATION_SYNC_DOC_ID}`;
  const bounded = buildBoundedStationPayload(payload);
  try {
    await setDoc(doc(db, STATION_SYNC_COLLECTION, STATION_SYNC_DOC_ID), bounded);
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.WRITE, path);
    } catch {
      // Allow local offline fallback to continue uninterrupted
    }
  }
}

export function subscribeToCloudStationSync(
  onData: (data: CloudStationSyncPayload | null, exists: boolean) => void,
  onSyncStatus?: (connected: boolean) => void
): Unsubscribe {
  const path = `${STATION_SYNC_COLLECTION}/${STATION_SYNC_DOC_ID}`;
  return onSnapshot(
    doc(db, STATION_SYNC_COLLECTION, STATION_SYNC_DOC_ID),
    (snapshot) => {
      onSyncStatus?.(true);
      if (!snapshot.exists()) {
        onData(null, false);
        return;
      }
      const data = snapshot.data() as CloudStationSyncPayload;
      onData(data, true);
    },
    (error) => {
      onSyncStatus?.(false);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Handled so UI remains resilient when offline
      }
    }
  );
}
