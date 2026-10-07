import { useCallback, useEffect, useMemo, useState } from 'react';
import { taskOptionRepo, taskRepo } from '../data';
import type { Task, TaskOption } from '../data/types';
import { splitOptions, type SplitOptions } from '../lib/tasks';
import { syncEvents } from '../sync/manager';

const EMPTY: SplitOptions = { categories: [], members: [], priorities: [], statuses: [] };

/** 載入待辦資料；另一支手機的變動同步進來時自動重新載入。改了資料後呼叫 reload。 */
export function useTaskData(): {
  loading: boolean;
  tasks: Task[];
  allOptions: TaskOption[];
  options: SplitOptions;
  reload: () => void;
} {
  const [data, setData] = useState<{ tasks: Task[]; options: TaskOption[] } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([taskRepo.list(), taskOptionRepo.list()]).then(([tasks, options]) => {
      if (!cancelled) setData({ tasks, options });
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
  const options = useMemo(() => (data ? splitOptions(data.options) : EMPTY), [data]);

  return {
    loading: data === null,
    tasks: data?.tasks ?? [],
    allOptions: data?.options ?? [],
    options,
    reload,
  };
}
