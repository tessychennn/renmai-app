import { useState } from 'react';
import { Link } from 'react-router-dom';
import { personIdOfTask } from '../../data/prospectId';
import type { Task } from '../../data/types';
import type { SplitOptions, TaskInput } from '../../lib/tasks';

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

/**
 * 新增／編輯待辦的面板（手機從底部滑出，電腦置中顯示）。
 * 呼叫端用 key 讓每次開啟都從乾淨的狀態開始。
 */
export default function TaskSheet({
  task,
  options,
  defaults,
  onSave,
  onDelete,
  onClose,
}: {
  /** 有值＝編輯這筆；沒有＝新增 */
  task?: Task;
  options: SplitOptions;
  /** 新增時的預設值（上次用的分類、目前篩選的負責人） */
  defaults?: { categoryId?: string; ownerId?: string };
  /** keepAdding：按「加入並繼續新增」，存完面板不關、清空名稱 */
  onSave: (input: TaskInput, keepAdding: boolean) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const editing = Boolean(task);
  // 從人脈記錄列入業務開發的待辦，可以連回那個人
  const personId = task ? personIdOfTask(task.id) : undefined;
  const firstCategory = options.categories[0]?.id ?? '';
  const [name, setName] = useState(task?.name ?? '');
  const [categoryId, setCategoryId] = useState(
    task?.categoryId ??
      (options.categories.some((c) => c.id === defaults?.categoryId) ? defaults!.categoryId! : firstCategory)
  );
  const [ownerId, setOwnerId] = useState(task?.ownerId ?? defaults?.ownerId ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [priorityId, setPriorityId] = useState(
    task?.priorityId ?? options.priorities.find((p) => p.name === '中')?.id ?? ''
  );
  const [statusId, setStatusId] = useState(task?.statusId ?? '');
  const [note, setNote] = useState(task?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState('');

  // 編輯時，任務用到的選項可能已被管理員刪掉：保留成一個選項，避免儲存時默默改掉
  const withCurrent = (list: { id: string; name: string }[], id: string | undefined) =>
    id && !list.some((o) => o.id === id) ? [...list, { id, name: '（已刪除的選項）' }] : list;

  const submit = async (keepAdding: boolean) => {
    if (!name.trim()) {
      setError('請輸入項目名稱');
      return;
    }
    if (!categoryId) {
      setError('請先選擇分類（還沒有分類的話，到「待辦設定」新增）');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave({ name, categoryId, ownerId, dueDate, priorityId, statusId, note }, keepAdding);
      if (keepAdding) {
        setJustAdded(name.trim());
        setName('');
        setNote('');
        setDueDate('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '儲存失敗，請再試一次。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? '編輯待辦' : '新增待辦'}
    >
      <button type="button" aria-label="關閉" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
        className="glass absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl px-5 pt-5 md:inset-auto md:left-1/2 md:top-1/2 md:w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <p className="text-lg font-semibold">{editing ? '編輯待辦' : '新增待辦'}</p>
        {personId && (
          <Link
            to={`/person/${personId}`}
            className="mt-1 inline-block text-sm text-ink-2 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            查看人脈資料
          </Link>
        )}

        <div className="mt-4 flex flex-col gap-3">
          <Field label="項目名稱">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="要做什麼"
              className={fieldClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="分類">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldClass}>
                {withCurrent(options.categories, task?.categoryId).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="負責人">
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={fieldClass}>
                <option value="">未指派</option>
                {withCurrent(options.members, task?.ownerId).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Deadline">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
            </Field>
            <Field label="優先級">
              <select value={priorityId} onChange={(e) => setPriorityId(e.target.value)} className={fieldClass}>
                <option value="">未設定</option>
                {withCurrent(options.priorities, task?.priorityId).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="狀態">
            <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className={fieldClass}>
              <option value="">未設定</option>
              {withCurrent(options.statuses, task?.statusId).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="備註">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={fieldClass} />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {justAdded && !error && (
          <p role="status" className="mt-3 text-sm text-ink-2">
            已加入「{justAdded}」，可以繼續新增。
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {editing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="mr-auto rounded-xl px-3 py-2.5 font-medium text-danger disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
            >
              刪除
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-[0.5px] border-hairline bg-white px-4 py-2.5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            取消
          </button>
          {!editing && (
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={busy}
              className="rounded-xl border-[0.5px] border-hairline bg-white px-4 py-2.5 font-medium disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            >
              加入並繼續
            </button>
          )}
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
