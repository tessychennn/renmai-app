import { useEffect, useMemo, useState } from 'react';
import ClientSheet from '../components/clients/ClientSheet';
import ConfirmSheet from '../components/ConfirmSheet';
import HeaderActions from '../components/HeaderActions';
import SyncDot from '../components/SyncDot';
import TabBar from '../components/TabBar';
import { InlineDate, InlineSelect } from '../components/tasks/InlineFields';
import Toast from '../components/Toast';
import { clientRepo } from '../data';
import type { Client } from '../data/types';
import { useClientData } from '../hooks/useClientData';
import {
  editClient,
  filterClients,
  patchClient,
  sortClients,
  toggleClientDone,
  UNASSIGNED,
  type ClientFilter,
  type ClientInput,
  type ClientPatch,
} from '../lib/clients';
import { STATUS_BADGE, statusColor } from '../lib/statusTone';
import { dueLabel, dueState, optionName, todayStr } from '../lib/tasks';

type View = 'open' | 'done';

const GRID =
  'grid grid-cols-[1.5rem_minmax(0,1fr)_3.6rem_4rem] items-center gap-x-1 px-2 text-sm md:grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_6rem_6.5rem] md:gap-x-2 md:px-3 md:text-base';

const chip =
  'shrink-0 whitespace-nowrap rounded-full border-[0.5px] px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${chip} ${active ? 'border-ink bg-ink text-white' : 'border-hairline bg-white text-ink'}`}
    >
      {children}
    </button>
  );
}

export default function ClientsPage() {
  const { loading, clients, persons, options, reload } = useClientData();
  const [view, setView] = useState<View>('open');
  const [filter, setFilter] = useState<ClientFilter>({});
  const [sheet, setSheet] = useState<Client | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Client | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // 直接在列上改過的客戶，暫時沿用修改前的值排序，列不會立刻跳位置；切換畫面或篩選時清掉
  const [frozen, setFrozen] = useState<Map<string, Client>>(() => new Map());

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const today = todayStr();
  const nameOf = (c: Client) => persons.get(c.personId)?.displayName ?? '（已刪除的人）';

  const filtered = useMemo(() => filterClients(clients, filter), [clients, filter]);
  const open = useMemo(() => {
    const current = new Map(filtered.map((c) => [c.id, c]));
    return sortClients(
      filtered.filter((c) => !c.done).map((c) => frozen.get(c.id) ?? c),
      options.statuses
    ).map((c) => current.get(c.id)!);
  }, [filtered, frozen, options.statuses]);
  const done = useMemo(
    () =>
      filtered
        .filter((c) => c.done)
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '') || b.updatedAt.localeCompare(a.updatedAt)),
    [filtered]
  );

  const changeFilter = (patch: Partial<ClientFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
    setFrozen(new Map());
  };

  const patch = async (client: Client, change: ClientPatch) => {
    setFrozen((prev) => (prev.has(client.id) ? prev : new Map(prev).set(client.id, client)));
    await clientRepo.save(patchClient(client, change));
    reload();
  };

  const toggle = async (client: Client) => {
    await clientRepo.save(toggleClientDone(client));
    reload();
  };

  const save = async (input: ClientInput) => {
    if (!sheet) return;
    await clientRepo.save(editClient(sheet, input));
    setSheet(null);
    reload();
  };

  const remove = async () => {
    if (!confirmRemove) return;
    await clientRepo.remove(confirmRemove.id);
    setConfirmRemove(null);
    setSheet(null);
    setToast(`已把「${nameOf(confirmRemove)}」移出客戶`);
    reload();
  };

  const list = view === 'open' ? open : done;
  const hasFilter = Boolean(filter.ownerId || filter.statusId);
  const emptyText =
    clients.length === 0
      ? '還沒有客戶。到「人脈記錄」長按一個人，就能把他列入客戶。'
      : hasFilter
        ? '這個篩選條件下沒有客戶。'
        : view === 'open'
          ? '目前沒有聯絡中的客戶。'
          : '還沒有完成的客戶。';

  const tabs: { value: View; label: string; count: number }[] = [
    { value: 'open', label: '聯絡中', count: clients.filter((c) => !c.done).length },
    { value: 'done', label: '完成', count: clients.filter((c) => c.done).length },
  ];

  return (
    <div className="min-h-dvh">
      <header
        className="glass sticky top-0 z-10 border-b-[0.5px] border-hairline"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto max-w-4xl px-5">
          <div className="flex items-center justify-between pt-3 pb-2">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              客戶
              <SyncDot />
            </h1>
            <HeaderActions />
          </div>

          <div role="tablist" aria-label="客戶" className="mb-3 flex w-full rounded-full bg-ground p-1 md:w-fit">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={view === t.value}
                onClick={() => {
                  setFrozen(new Map());
                  setView(t.value);
                }}
                className={`flex-1 rounded-full px-5 py-1.5 text-sm font-medium whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink md:flex-none ${
                  view === t.value ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-ink-2'
                }`}
              >
                {t.label}
                <span className="ml-1 font-normal text-ink-2">{t.count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 pb-3">
            <div role="group" aria-label="依負責人篩選" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              <Chip active={!filter.ownerId} onClick={() => changeFilter({ ownerId: undefined })}>
                所有負責人
              </Chip>
              {options.members.map((m) => (
                <Chip
                  key={m.id}
                  active={filter.ownerId === m.id}
                  onClick={() => changeFilter({ ownerId: filter.ownerId === m.id ? undefined : m.id })}
                >
                  {m.name}
                </Chip>
              ))}
              <Chip
                active={filter.ownerId === UNASSIGNED}
                onClick={() => changeFilter({ ownerId: filter.ownerId === UNASSIGNED ? undefined : UNASSIGNED })}
              >
                未指派
              </Chip>
            </div>
            <div role="group" aria-label="依狀態篩選" className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
              <Chip active={!filter.statusId} onClick={() => changeFilter({ statusId: undefined })}>
                所有狀態
              </Chip>
              {options.statuses.map((s) => (
                <Chip
                  key={s.id}
                  active={filter.statusId === s.id}
                  onClick={() => changeFilter({ statusId: filter.statusId === s.id ? undefined : s.id })}
                >
                  {s.name}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
        {loading ? null : list.length === 0 ? (
          <p className="mt-24 text-center text-ink-2">{emptyText}</p>
        ) : (
          <section className="overflow-hidden rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <div aria-hidden="true" className={`${GRID} border-b-[0.5px] border-hairline py-1.5 text-xs text-ink-2`}>
              <span />
              <span>名稱</span>
              <span>負責人</span>
              <span>狀態</span>
              <span className="hidden text-center md:block">下次聯絡</span>
            </div>
            <ul>
              {list.map((c) => {
                const status = optionName(options.statuses, c.statusId);
                const color = statusColor(status);
                const owner = optionName(options.members, c.ownerId);
                const name = nameOf(c);
                const members =
                  c.ownerId && !options.members.some((m) => m.id === c.ownerId)
                    ? [...options.members, { id: c.ownerId, name: '（已刪除）' }]
                    : options.members;
                const statuses =
                  c.statusId && !options.statuses.some((s) => s.id === c.statusId)
                    ? [...options.statuses, { id: c.statusId, name: '（已刪除）' }]
                    : options.statuses;
                const due = c.dueDate ? dueLabel(c.dueDate, today) : undefined;
                return (
                  <li key={c.id} className={`${GRID} border-t-[0.5px] border-hairline py-2 first:border-t-0`}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={c.done}
                      aria-label={c.done ? `還原「${name}」` : `完成「${name}」`}
                      onClick={() => void toggle(c)}
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                        c.done ? 'border-ink bg-ink text-white' : 'border-ink-2/50 bg-white text-transparent'
                      }`}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="m2.5 6.2 2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSheet(c)}
                      className="min-w-0 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      <span className={`block break-words ${c.done ? 'text-ink-2 line-through' : ''}`}>{name}</span>
                      {(c.note || due) && (
                        <span className="mt-0.5 block truncate text-xs text-ink-2">
                          {due && <span className="md:hidden">{due}　</span>}
                          {c.note}
                        </span>
                      )}
                    </button>

                    <InlineSelect
                      ariaLabel={`「${name}」的負責人`}
                      value={c.ownerId ?? ''}
                      options={[{ value: '', label: '未指派' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
                      text={owner ?? '未指派'}
                      tone={owner ? 'normal' : 'faint'}
                      onChange={(ownerId) => void patch(c, { ownerId })}
                    />

                    <InlineSelect
                      ariaLabel={`「${name}」的狀態`}
                      value={c.statusId ?? ''}
                      options={[{ value: '', label: '未設定' }, ...statuses.map((s) => ({ value: s.id, label: s.name }))]}
                      text={status ?? '未設定'}
                      tone={status ? 'normal' : 'faint'}
                      badge={color && STATUS_BADGE[color]}
                      onChange={(statusId) => void patch(c, { statusId })}
                    />

                    <span className="hidden min-w-0 md:block">
                      <InlineDate
                        ariaLabel={`「${name}」的下次聯絡`}
                        value={c.dueDate ?? ''}
                        text={due ?? '—'}
                        state={c.done ? 'none' : dueState(c.dueDate, today)}
                        onChange={(dueDate) => void patch(c, { dueDate })}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      <TabBar />

      {sheet && (
        <ClientSheet
          key={sheet.id}
          client={sheet}
          name={nameOf(sheet)}
          options={options}
          onSave={save}
          onRemove={() => setConfirmRemove(sheet)}
          onClose={() => setSheet(null)}
        />
      )}

      <ConfirmSheet
        open={confirmRemove !== null}
        title={confirmRemove ? `把「${nameOf(confirmRemove)}」移出客戶？` : ''}
        message="這個人還在人脈記錄裡，只是不再列在客戶，備註也會一併清掉。"
        actions={[{ label: '移出客戶', danger: true, onClick: () => void remove() }]}
        onClose={() => setConfirmRemove(null)}
      />

      <Toast message={toast} />
    </div>
  );
}
