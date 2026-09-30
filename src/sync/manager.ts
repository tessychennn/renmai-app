import { onLocalChange } from '../data/changeSignal';
import { runSync } from './engine';
import { AuthRequiredError } from './errors';
import type { RemoteStore, SyncLocal } from './types';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'auth-required';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt?: string;
  error?: string;
}

/** 同步拉到新資料時發出，首頁據此重新載入列表 */
export const syncEvents = new EventTarget();

const LAST_SYNC_KEY = 'renmai.lastSyncAt';
const PUSH_DEBOUNCE_MS = 3_000;
const FOREGROUND_THROTTLE_MS = 20_000;
const POLL_INTERVAL_MS = 5 * 60_000;

function loadLastSync(): string | undefined {
  try {
    return localStorage.getItem(LAST_SYNC_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function looksOffline(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return e instanceof TypeError || /network|failed to fetch|load failed/i.test(String((e as Error)?.message));
}

class SyncManager {
  private state: SyncState = { status: 'idle', lastSyncAt: loadLastSync() };
  private listeners = new Set<() => void>();
  private local: SyncLocal | null = null;
  private remote: RemoteStore | null = null;
  private running = false;
  private queued = false;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private cleanups: Array<() => void> = [];
  private lastForegroundSync = 0;

  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }

  start(local: SyncLocal, remote: RemoteStore): void {
    this.stop();
    this.local = local;
    this.remote = remote;

    this.cleanups.push(
      onLocalChange(() => this.requestSync(PUSH_DEBOUNCE_MS))
    );

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - this.lastForegroundSync < FOREGROUND_THROTTLE_MS) return;
      this.lastForegroundSync = Date.now();
      this.requestSync(0);
    };
    document.addEventListener('visibilitychange', onVisible);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisible));

    const onOnline = () => this.requestSync(0);
    window.addEventListener('online', onOnline);
    this.cleanups.push(() => window.removeEventListener('online', onOnline));

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') this.requestSync(0);
    }, POLL_INTERVAL_MS);
    this.cleanups.push(() => clearInterval(poll));

    this.lastForegroundSync = Date.now();
    this.requestSync(0);
  }

  stop(): void {
    for (const c of this.cleanups) c();
    this.cleanups = [];
    clearTimeout(this.debounce);
    this.local = null;
    this.remote = null;
    this.setState({ status: 'idle', error: undefined });
  }

  requestSync(delayMs = 0): void {
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.sync(), delayMs);
  }

  async sync(): Promise<void> {
    if (!this.local || !this.remote) return;
    if (this.running) {
      this.queued = true;
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState({ status: 'offline' });
      return;
    }

    this.running = true;
    this.setState({ status: 'syncing', error: undefined });
    try {
      const result = await runSync(this.local, this.remote);
      const lastSyncAt = new Date().toISOString();
      try {
        localStorage.setItem(LAST_SYNC_KEY, lastSyncAt);
      } catch {
        // 存不了只影響「上次同步時間」的顯示
      }
      if (result.errors.length > 0) {
        this.setState({ status: 'error', error: result.errors[0], lastSyncAt });
      } else {
        this.setState({ status: 'idle', lastSyncAt });
      }
      if (result.pulled > 0 || result.photosDownloaded > 0) {
        syncEvents.dispatchEvent(new Event('synced'));
      }
    } catch (e) {
      if (e instanceof AuthRequiredError) {
        this.setState({ status: 'auth-required', error: e.message });
      } else if (looksOffline(e)) {
        this.setState({ status: 'offline' });
      } else {
        this.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      this.running = false;
      if (this.queued) {
        this.queued = false;
        this.requestSync(0);
      }
    }
  }
}

export const syncManager = new SyncManager();
