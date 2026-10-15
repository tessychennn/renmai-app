import { useCallback, useEffect, useMemo, useState } from 'react';
import { progressOptionRepo, progressRepo, taskOptionRepo } from '../data';
import type { ProgressItem, ProgressOption, TaskOption } from '../data/types';
import { EMPTY_PROGRESS_OPTIONS, splitProgressOptions, type ProgressOptions } from '../lib/progress';
import { syncEvents } from '../sync/manager';

/** 載入產品進度的項目與選項；另一支手機的變動同步進來時自動重新載入。改了資料後呼叫 reload。 */
export function useProgressData(): {
  loading: boolean;
  items: ProgressItem[];
  options: ProgressOptions;
  allOptions: ProgressOption[];
  /** 待辦的選項（成員等），客戶頁用 */
  taskOptions: TaskOption[];
  reload: () => void;
} {
  const [data, setData] = useState<{ items: ProgressItem[]; options: ProgressOption[]; taskOptions: TaskOption[] } | null>(
    null
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([progressRepo.list(), progressOptionRepo.list(), taskOptionRepo.list()]).then(
      ([items, options, taskOptions]) => {
        if (!cancelled) setData({ items, options, taskOptions });
      }
    );
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
  const options = useMemo(() => (data ? splitProgressOptions(data.options) : EMPTY_PROGRESS_OPTIONS), [data]);
  return {
    loading: data === null,
    items: data?.items ?? [],
    options,
    allOptions: data?.options ?? [],
    taskOptions: data?.taskOptions ?? [],
    reload,
  };
}
