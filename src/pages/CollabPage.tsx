import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountMenu from '../cloud/AccountMenu';
import ChoiceSheet from '../components/ChoiceSheet';
import NoteSheet from '../components/NoteSheet';
import StatusChip from '../components/StatusChip';
import SyncDot from '../components/SyncDot';
import TabBar, { TAB_BAR_PAD } from '../components/TabBar';
import { personRepo } from '../data';
import { usePhotoURL } from '../hooks/usePhotoURL';
import {
  COLLAB_OWNERS,
  COLLAB_STATUSES,
  collabCounts,
  collabList,
  statusLabel,
  withCollab,
  type CollabFilter,
} from '../lib/collab';
import { syncEvents } from '../sync/manager';
import type { CollabOwner, CollabStatus, Person } from '../data/types';

type Editing = { person: Person; field: 'status' | 'owner' | 'note' } | null;

function Thumb({ person }: { person: Person }) {
  const url = usePhotoURL(person.avatarPhotoId ?? person.photoIds[0], 'thumb');
  return url ? (
    <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
  ) : (
    <div
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ground text-lg text-ink-2"
    >
      {person.displayName.slice(0, 1)}
    </div>
  );
}

const chipButton =
  'rounded-full border-[0.5px] px-3 py-1.5 text-sm whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

export default function CollabPage() {
  const [persons, setPersons] = useState<Person[] | null>(null);
  const [filter, setFilter] = useState<CollabFilter>({});
  const [editing, setEditing] = useState<Editing>(null);

  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    const onSynced = () => setReloadTick((t) => t + 1);
    syncEvents.addEventListener('synced', onSynced);
    return () => syncEvents.removeEventListener('synced', onSynced);
  }, []);

  useEffect(() => {
    void personRepo.list().then(setPersons);
  }, [reloadTick]);

  const marked = persons ? collabList(persons) : [];
  const rows = persons ? collabList(persons, filter) : [];
  const counts = persons ? collabCounts(persons) : null;

  const update = async (
    person: Person,
    changes: { status?: CollabStatus | null; owner?: CollabOwner | null; note?: string }
  ) => {
    await personRepo.save(withCollab(person, changes));
    setEditing(null);
    setReloadTick((t) => t + 1);
  };

  const statusChoice = (s: { value: CollabStatus; label: string }, person: Person) => ({
    label: s.label,
    selected: person.collabStatus === s.value,
    onClick: () => void update(person, { status: s.value }),
  });

  return (
    <div className="min-h-dvh">
      <header
        className="glass fixed inset-x-0 top-0 z-10 border-b-[0.5px] border-hairline"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            合作機會
            <SyncDot />
          </h1>
          <AccountMenu />
        </div>
        <div className="flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
          <button
            type="button"
            aria-pressed={!filter.status}
            onClick={() => setFilter((f) => ({ ...f, status: undefined }))}
            className={`${chipButton} ${
              !filter.status ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-ink'
            }`}
          >
            全部 {marked.length}
          </button>
          {COLLAB_STATUSES.map((s) => {
            const active = filter.status === s.value;
            return (
              <button
                key={s.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter((f) => ({ ...f, status: active ? undefined : s.value }))}
                className={`${chipButton} ${
                  active ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-ink'
                }`}
              >
                {s.label} {counts?.[s.value] ?? 0}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none]">
          {(
            [
              { value: undefined, label: '所有負責人' },
              ...COLLAB_OWNERS.map((o) => ({ value: o, label: o })),
              { value: 'unassigned' as const, label: '未指定' },
            ] as { value: CollabFilter['owner']; label: string }[]
          ).map((o) => {
            const active = filter.owner === o.value;
            return (
              <button
                key={o.label}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter((f) => ({ ...f, owner: o.value }))}
                className={`${chipButton} ${
                  active ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-ink-2'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </header>

      <main
        className="px-5"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 156px)',
          paddingBottom: TAB_BAR_PAD,
        }}
      >
        {persons === null ? null : marked.length === 0 ? (
          <div className="mt-24 text-center text-ink-2">
            <p>還沒有合作對象。</p>
            <p className="mt-1">到「人脈記錄」長按人物卡，就能標記狀態。</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-24 text-center text-ink-2">這個條件下沒有人。</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((person) => (
              <li
                key={person.id}
                className="rounded-2xl border-[0.5px] border-hairline bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              >
                {/* 同一行由左至右：頭像＋名稱、負責人、狀態 */}
                <div className="flex items-center gap-2">
                  <Link
                    to={`/person/${person.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    <Thumb person={person} />
                    <span className="min-w-0 truncate font-medium">{person.displayName}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`負責人：${person.collabOwner ?? '未指定'}，點一下修改`}
                    onClick={() => setEditing({ person, field: 'owner' })}
                    className={`shrink-0 whitespace-nowrap rounded-full border-[0.5px] px-2.5 py-0.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
                      person.collabOwner
                        ? 'border-ink/25 bg-white text-ink'
                        : 'border-dashed border-hairline bg-white text-ink-2'
                    }`}
                  >
                    {person.collabOwner ?? '未指定'}
                  </button>
                  <button
                    type="button"
                    aria-label={`狀態：${statusLabel(person.collabStatus!)}，點一下修改`}
                    onClick={() => setEditing({ person, field: 'status' })}
                    className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <StatusChip status={person.collabStatus!} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditing({ person, field: 'note' })}
                  className="mt-3 block w-full rounded-lg bg-ground px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                >
                  {person.collabNote ? (
                    <span className="whitespace-pre-wrap">{person.collabNote}</span>
                  ) : (
                    <span className="text-ink-2">＋ 備註</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <TabBar />

      <ChoiceSheet
        open={editing?.field === 'status'}
        title={editing ? `${editing.person.displayName} 的狀態` : ''}
        choices={editing ? COLLAB_STATUSES.map((s) => statusChoice(s, editing.person)) : []}
        footer={
          editing
            ? { label: '移出合作機會', onClick: () => void update(editing.person, { status: null }) }
            : undefined
        }
        onClose={() => setEditing(null)}
      />

      <ChoiceSheet
        open={editing?.field === 'owner'}
        title={editing ? `${editing.person.displayName} 的負責人` : ''}
        choices={
          editing
            ? [
                ...COLLAB_OWNERS.map((o) => ({
                  label: o,
                  selected: editing.person.collabOwner === o,
                  onClick: () => void update(editing.person, { owner: o }),
                })),
                {
                  label: '未指定',
                  selected: editing.person.collabOwner === undefined,
                  onClick: () => void update(editing.person, { owner: null }),
                },
              ]
            : []
        }
        onClose={() => setEditing(null)}
      />

      {editing?.field === 'note' && (
        <NoteSheet
          key={editing.person.id}
          title={`${editing.person.displayName} 的備註`}
          initial={editing.person.collabNote ?? ''}
          onSave={(note) => void update(editing.person, { note })}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
