import { useCallback, useEffect, useMemo, useState } from 'react';
import { progressRepo, taskOptionRepo } from '../data';
import type { ProgressItem } from '../data/types';
import { splitOptions, type SplitOptions } from '../lib/tasks';
import { syncEvents } from '../sync/manager';

const EMPTY: SplitOptions = { categories: [], projects: [], members: [], priorities: [], statuses: [] };

/** 載入進度追蹤的資料與選項（大項目、成員）；另一支手機的變動同步進來時自動重新載入。改了資料後呼叫 reload。 */
export function useProgressData(): {
  loading: boolean;
  items: ProgressItem[];
  options: SplitOptions;
  reload: () => void;
} {
  const [data, setData] = useState<{ items: ProgressItem[]; options: SplitOptions } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([progressRepo.list(), taskOptionRepo.list()]).then(([items, options]) => {
      if (!cancelled) setData({ items, options: splitOptions(options) });
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
  return {
    loading: data === null,
    items: data?.items ?? [],
    options: useMemo(() => data?.options ?? EMPTY, [data]),
    reload,
  };
}
