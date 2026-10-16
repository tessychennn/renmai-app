import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Client, Person } from '../../data/types';
import type { ClientInput } from '../../lib/clients';
import type { SplitOptions } from '../../lib/tasks';
import { CLIENT_STATUSES } from '../../text/clients';

const fieldClass =
  'w-full rounded-xl border-[0.5px] border-hairline bg-white px-3 py-2.5 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-ink-2">{label}</span>
      {children}
    </label>
  );
}

export interface SheetResult extends ClientInput {
  /** 新增時從人脈記錄挑了一個人 */
  personId?: string;
}

/**
 * 新增或編輯客戶的面板（手機從底部滑出，電腦置中顯示）。呼叫端用 key 讓每次開啟都從乾淨的狀態開始。
 * - 新增（沒有 client）：輸入名字；如果人脈記錄裡有同名的人，可以點選連結，也可以只存名字。
 * - 編輯：自己存名字的客戶可以改名；連結人脈記錄的客戶名字跟著人物，面板上有「查看人脈資料」。
 */
export default function ClientSheet({
  client,
  name,
  persons = [],
  options,
  onSave,
  onRemove,
  onClose,
}: {
  client?: Client;
  /** 編輯時顯示的名字（連結的客戶是人物的名字） */
  name?: string;
  /** 新增時用來比對名字的人脈記錄（已經是客戶的人不要放進來） */
  persons?: Person[];
  options: SplitOptions;
  onSave: (input: SheetResult) => Promise<void>;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const editing = Boolean(client);
  const standalone = !client?.personId;
  const [typedName, setTypedName] = useState(client?.name ?? '');
  const [picked, setPicked] = useState<Person | null>(null);
  const [statusId, setStatusId] = useState(client?.statusId ?? CLIENT_STATUSES[0]?.id ?? '');
  const [ownerId, setOwnerId] = useState(client?.ownerId ?? '');
  const [dueDate, setDueDate] = useState(client?.dueDate ?? '');
  const [note, setNote] = useState(client?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const suggestions = useMemo(() => {
    const q = typedName.trim().toLowerCase();
    if (editing || picked || !q) return [];
    return persons.filter((p) => p.displayName.toLowerCase().includes(q)).slice(0, 5);
  }, [editing, picked, persons, typedName]);

  // 用到的選項可能已被管理員刪掉：保留成一個選項，避免儲存時默默改掉
  const statuses =
    client?.statusId && !CLIENT_STATUSES.some((s) => s.id === client.statusId)
      ? [...CLIENT_STATUSES, { id: client.statusId, name: '（已刪除的選項）' }]
      : CLIENT_STATUSES;
  const members =
    client?.ownerId && !options.members.some((m) => m.id === client.ownerId)
      ? [...options.members, { id: client.ownerId, name: '（已刪除的選項）' }]
      : options.members;

  const title = editing ? (name ?? typedName) : '新增客戶';

  const submit = async () => {
    const finalName = picked ? picked.displayName : typedName.trim();
    if (!editing && !finalName) {
      setError('請輸入名字');
      return;
    }
    if (editing && standalone && !typedName.trim()) {
      setError('請輸入名字');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({
        name: picked ? undefined : typedName,
        personId: picked?.id,
        statusId,
        ownerId,
        dueDate,
        note,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="關閉" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="glass absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl px-5 pt-5 md:inset-auto md:left-1/2 md:top-1/2 md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <p className="text-lg font-semibold">{title}</p>
        {client?.personId && (
          <Link
            to={`/person/${client.personId}`}
            className="mt-1 inline-block text-sm text-ink-2 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            查看人脈資料
          </Link>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {(!editing || standalone) && (
            <div>
              <Field label="名字">
                {picked ? (
                  <span className="flex items-center justify-between gap-2 rounded-xl border-[0.5px] border-hairline bg-white px-3 py-2.5">
                    <span className="min-w-0 truncate">
                      {picked.displayName}
                      <span className="ml-2 text-xs text-ink-2">已連結人脈記錄</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setPicked(null)}
                      aria-label="取消連結人脈記錄"
                      className="shrink-0 text-sm text-ink-2 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      取消
                    </button>
                  </span>
                ) : (
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    autoFocus={!editing}
                    autoComplete="off"
                    placeholder="對方的名字或公司"
                    className={fieldClass}
                  />
                )}
              </Field>
              {suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-xs text-ink-2">人脈記錄裡有同名的人，點選就連結過去（也可以直接存名字）</p>
                  <ul className="flex flex-wrap gap-2">
                    {suggestions.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setPicked(p)}
                          className="rounded-full border-[0.5px] border-hairline bg-white px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                        >
                          {p.displayName}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="狀態">
              <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className={fieldClass}>
                <option value="">未設定</option>
                {statuses.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="負責人">
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={fieldClass}>
                <option value="">未指派</option>
                {members.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="下次聯絡">
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
          </Field>

          <Field label="備註">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              placeholder="聯絡的進度、對方的需求、下一步要做什麼"
              className={fieldClass}
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {editing && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="mr-auto rounded-xl px-3 py-2.5 font-medium text-danger disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
            >
              {client?.personId ? '移出客戶' : '刪除'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-[0.5px] border-hairline bg-white px-4 py-2.5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-ink px-5 py-2.5 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {editing ? '儲存' : '加入'}
          </button>
        </div>
      </form>
    </div>
  );
}
