import { useSyncExternalStore } from 'react';
import { syncManager, type SyncState } from './manager';

export function useSyncState(): SyncState {
  return useSyncExternalStore(syncManager.subscribe, syncManager.getState);
}
