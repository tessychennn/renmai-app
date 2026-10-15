import { useCallback, useEffect, useMemo, useState } from 'react';
import { clientRepo, personRepo, taskOptionRepo } from '../data';
import type { Client, Person } from '../data/types';
import { splitOptions, type SplitOptions } from '../lib/tasks';
import { syncEvents } from '../sync/manager';

const EMPTY: SplitOptions = { categories: [], members: [], priorities: [], statuses: [] };

/** 載入客戶與對應的人物、待辦選項（狀態、負責人）；同步進來新資料時自動重新載入。改了資料後呼叫 reload。 */
export function useClientData(): {
  loading: boolean;
  clients: Client[];
  persons: Map<string, Person>;
  options: SplitOptions;
  reload: () => void;
} {
  const [data, setData] = useState<{ clients: Client[]; persons: Person[]; options: SplitOptions } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([clientRepo.list(), personRepo.list(), taskOptionRepo.list()]).then(
      ([clients, persons, options]) => {
        if (!cancelled) setData({ clients, persons, options: splitOptions(options) });
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
  const persons = useMemo(() => new Map((data?.persons ?? []).map((p) => [p.id, p])), [data]);
  return {
    loading: data === null,
    clients: data?.clients ?? [],
    persons,
    options: data?.options ?? EMPTY,
    reload,
  };
}
