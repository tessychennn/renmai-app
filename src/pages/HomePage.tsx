import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ChoiceSheet from '../components/ChoiceSheet';
import HeaderActions from '../components/HeaderActions';
import PersonCard from '../components/PersonCard';
import SyncDot from '../components/SyncDot';
import TabBar from '../components/TabBar';
import Toast from '../components/Toast';
import { cloudEnabled } from '../cloud/config';
import { groupRepo, personRepo, settingsRepo, taskOptionRepo, taskRepo } from '../data';
import { isBackupStale } from '../lib/backup';
import {
  prospectChip,
  prospectsByPerson,
  removeProspect,
  setProspect,
  type ProspectChoice,
} from '../lib/prospects';
import { syncEvents } from '../sync/manager';
import type { Group, Person, PersonSort, Task, TaskOption } from '../data/types';

const SORT_OPTIONS: { value: PersonSort; label: string }[] = [
  { value: 'createdAt-desc', label: '最近加入' },
  { value: 'createdAt-asc', label: '最早加入' },
  { value: 'metDate-desc', label: '最近認識' },
  { value: 'metDate-asc', label: '最早認識' },
  { value: 'name', label: '名稱' },
];

function loadSort(): PersonSort {
  try {
    const saved = localStorage.getItem('personSort');
    if (SORT_OPTIONS.some((o) => o.value === saved)) return saved as PersonSort;
  } catch {
    // 私密瀏覽等情況拿不到就用預設
  }
  return 'createdAt-desc';
}

export default function HomePage() {
  const location = useLocation();
  const [toast, setToast] = useState<string | null>(
    (location.state as { toast?: string } | null)?.toast ?? null
  );
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<PersonSort>(loadSort);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [persons, setPersons] = useState<Person[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [backupStale, setBackupStale] = useState(false);

  useEffect(() => {
    if (!toast) return;
    window.history.replaceState({}, '');
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  // 另一支手機的變動同步進來、或在這頁改了業務開發狀態後，重新載入列表
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    const onSynced = () => setReloadTick((t) => t + 1);
    syncEvents.addEventListener('synced', onSynced);
    return () => syncEvents.removeEventListener('synced', onSynced);
  }, []);

  useEffect(() => {
    void groupRepo.list().then(setGroups);
    void settingsRepo.get().then((s) => setBackupStale(isBackupStale(s.lastExportAt)));
  }, [reloadTick]);

  useEffect(() => {
    void personRepo
      .list({ search: search || undefined, groupIds: selectedGroupIds, sort: sortKey })
      .then(setPersons);
  }, [search, selectedGroupIds, sortKey, reloadTick]);

  // 業務開發：被標記為可合作的人，對應業務開發分類裡的一筆待辦
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskOption[]>([]);
  useEffect(() => {
    void Promise.all([taskRepo.list(), taskOptionRepo.list('status')]).then(([t, s]) => {
      setTasks(t);
      setStatuses(s);
    });
  }, [reloadTick]);
  const prospects = prospectsByPerson(tasks);

  // 長按人物卡：選一個狀態，把這個人列入業務開發
  const [prospectTarget, setProspectTarget] = useState<Person | null>(null);
  const applyProspect = async (person: Person, choice: ProspectChoice | null) => {
    try {
      if (choice === null) await removeProspect(person.id);
      else await setProspect(person, choice);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '儲存失敗，請再試一次。');
      return;
    }
    setProspectTarget(null);
    setReloadTick((t) => t + 1);
    const statusName = choice?.done ? '完成' : statuses.find((s) => s.id === choice?.statusId)?.name;
    setToast(
      choice === null
        ? `已將 ${person.displayName} 移出業務開發`
        : `${person.displayName}：${statusName ?? '已列入業務開發'}`
    );
  };
  const targetTask = prospectTarget ? prospects.get(prospectTarget.id) : undefined;

  const changeSort = (value: PersonSort) => {
    setSortKey(value);
    try {
      localStorage.setItem('personSort', value);
    } catch {
      // 存不了就只在本次生效
    }
  };

  const toggleGroup = (id: string) =>
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );

  const hasFilter = search !== '' || selectedGroupIds.length > 0;

  return (
    <div className="min-h-dvh">
      <header
        className="glass fixed inset-x-0 top-0 z-10 border-b-[0.5px] border-hairline"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            人脈記錄
            <SyncDot />
          </h1>
          <HeaderActions />
        </div>
        <div className="px-5 pb-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋暱稱、場合、備註⋯"
            className="w-full rounded-xl border-[0.5px] border-hairline bg-white px-4 py-2.5 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none]">
          <select
            value={sortKey}
            onChange={(e) => changeSort(e.target.value as PersonSort)}
            aria-label="排序方式"
            className="shrink-0 appearance-none rounded-full border-[0.5px] border-hairline bg-white px-3 py-1 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {groups.map((group) => {
              const active = selectedGroupIds.includes(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border-[0.5px] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
                    active ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-ink'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: group.color }} />
                  {group.name}
                </button>
              );
          })}
        </div>
      </header>

      <main
        className="px-5"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 178px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 144px)',
        }}
      >
        {/* 開了雲端同步，資料本來就在雲端，不需要催備份 */}
        {!cloudEnabled && backupStale && persons !== null && persons.length > 0 && (
          <Link
            to="/settings"
            className="mb-3 block rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 text-sm shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            <span className="font-medium text-danger">超過 14 天未備份。</span>
            <span className="text-ink-2">到設定頁匯出一份，資料只存在這支手機上。</span>
          </Link>
        )}

        {persons === null ? null : persons.length === 0 ? (
          <div className="mt-24 text-center text-ink-2">
            {hasFilter ? (
              <p>找不到符合的人。</p>
            ) : (
              <>
                <p>還沒有人。</p>
                <p className="mt-1">按右下角的 + 記下第一個。</p>
              </>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {persons.map((person) => (
              <li key={person.id}>
                <PersonCard
                  person={person}
                  groups={groups}
                  prospect={
                    prospects.has(person.id) ? prospectChip(prospects.get(person.id)!, statuses) : undefined
                  }
                  onLongPress={setProspectTarget}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <Link
        to="/new"
        aria-label="新增人物"
        className="fixed right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </Link>

      <TabBar />

      <ChoiceSheet
        open={prospectTarget !== null}
        title={prospectTarget ? `${prospectTarget.displayName} 的業務開發` : ''}
        choices={[
          ...statuses.map((s) => ({
            label: s.name,
            selected: Boolean(targetTask && !targetTask.done && targetTask.statusId === s.id),
            onClick: () => prospectTarget && void applyProspect(prospectTarget, { statusId: s.id }),
          })),
          {
            label: '完成',
            selected: Boolean(targetTask?.done),
            onClick: () => prospectTarget && void applyProspect(prospectTarget, { done: true }),
          },
        ]}
        footer={
          targetTask
            ? { label: '移出業務開發', onClick: () => prospectTarget && void applyProspect(prospectTarget, null) }
            : undefined
        }
        onClose={() => setProspectTarget(null)}
      />

      <Toast message={toast} />
    </div>
  );
}
