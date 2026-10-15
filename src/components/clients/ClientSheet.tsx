import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Client } from '../../data/types';
import type { ClientInput } from '../../lib/clients';
import type { SplitOptions } from '../../lib/tasks';

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

/** 編輯客戶的面板（手機從底部滑出，電腦置中顯示）。呼叫端用 key 讓每次開啟都從乾淨的狀態開始。 */
export default function ClientSheet({
  client,
  name,
  options,
  onSave,
  onRemove,
  onClose,
}: {
  client: Client;
  /** 人物的名字（客戶本身不存名字） */
  name: string;
  options: SplitOptions;
  onSave: (input: ClientInput) => Promise<void>;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [statusId, setStatusId] = useState(client.statusId ?? '');
  const [ownerId, setOwnerId] = useState(client.ownerId ?? '');
  const [dueDate, setDueDate] = useState(client.dueDate ?? '');
  const [note, setNote] = useState(client.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 用到的選項可能已被管理員刪掉：保留成一個選項，避免儲存時默默改掉
  const withCurrent = (list: { id: string; name: string }[], id: string | undefined) =>
    id && !list.some((o) => o.id === id) ? [...list, { id, name: '（已刪除的選項）' }] : list;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave({ statusId, ownerId, dueDate, note });
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`客戶：${name}`}>
      <button type="button" aria-label="關閉" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="glass absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl px-5 pt-5 md:inset-auto md:left-1/2 md:top-1/2 md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <p className="text-lg font-semibold">{name}</p>
        <Link
          to={`/person/${client.personId}`}
          className="mt-1 inline-block text-sm text-ink-2 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          查看人脈資料
        </Link>

        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="狀態">
              <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className={fieldClass}>
                <option value="">未設定</option>
                {withCurrent(options.statuses, client.statusId).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="負責人">
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={fieldClass}>
                <option value="">未指派</option>
                {withCurrent(options.members, client.ownerId).map((o) => (
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
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="mr-auto rounded-xl px-3 py-2.5 font-medium text-danger disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
          >
            移出客戶
          </button>
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
            儲存
          </button>
        </div>
      </form>
    </div>
  );
}
