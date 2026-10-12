import { useCallback, useEffect, useState } from 'react';
import { progressRepo } from '../data';
import type { ProgressItem } from '../data/types';
import { syncEvents } from '../sync/manager';

/** 載入產品進度的項目；另一支手機的變動同步進來時自動重新載入。改了資料後呼叫 reload。 */
export function useProgressData(): {
  loading: boolean;
  items: ProgressItem[];
  reload: () => void;
} {
  const [items, setItems] = useState<ProgressItem[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void progressRepo.list().then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    const onSynced = () => setTick((t) => t + 1);
    syncEvents.addEventListener('synced', onSynced);
    return () => syncEvents.removeEventListener('synced', onSynced);
  }, []);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { loading: items === null, items: items ?? [], reload };
}
