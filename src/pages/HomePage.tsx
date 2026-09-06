import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PersonCard from '../components/PersonCard';
import Toast from '../components/Toast';
import { groupRepo, personRepo, settingsRepo } from '../data';
import { isBackupStale } from '../lib/backup';
import type { Group, Person, PersonSort } from '../data/types';

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

  useEffect(() => {
    void groupRepo.list().then(setGroups);
    void settingsRepo.get().then((s) => setBackupStale(isBackupStale(s.lastExportAt)));
  }, []);

  useEffect(() => {
    void personRepo
      .list({ search: search || undefined, groupIds: selectedGroupIds, sort: sortKey })
      .then(setPersons);
  }, [search, selectedGroupIds, sortKey]);

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
          <h1 className="text-2xl font-semibold">人脈記錄</h1>
          <Link
            to="/settings"
            aria-label="設定"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 2v2.2M10 15.8V18M18 10h-2.2M4.2 10H2M15.7 4.3l-1.6 1.6M5.9 14.1l-1.6 1.6M15.7 15.7l-1.6-1.6M5.9 5.9 4.3 4.3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Link>
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
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)',
        }}
      >
        {backupStale && persons !== null && persons.length > 0 && (
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
                <PersonCard person={person} groups={groups} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <Link
        to="/new"
        aria-label="新增人物"
        className="fixed right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </Link>

      <Toast message={toast} />
    </div>
  );
}
