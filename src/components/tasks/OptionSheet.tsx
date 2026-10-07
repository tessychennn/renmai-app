import { useState } from 'react';
import type { TaskOptionKind } from '../../data/types';

const fieldClass =
  'w-full rounded-xl border-[0.5px] border-hairline bg-white px-3 py-2.5 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

const KIND_LABEL: Record<TaskOptionKind, string> = {
  category: '分類',
  member: '成員',
  priority: '優先級',
  status: '狀態',
};

/** 新增／修改一個選項（分類、成員、優先級、狀態）。呼叫端用 key 讓每次開啟都從乾淨的狀態開始。 */
export default function OptionSheet({
  kind,
  initial,
  onSave,
  onClose,
}: {
  kind: TaskOptionKind;
  initial?: { name: string; email?: string };
  /** 回傳錯誤訊息代表不能儲存（例如名稱重複），面板會留著並顯示 */
  onSave: (value: { name: string; email: string }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const title = `${initial ? '修改' : '新增'}${KIND_LABEL[kind]}`;

  const submit = async () => {
    if (!name.trim()) {
      setError('請輸入名稱');
      return;
    }
    setBusy(true);
    const message = await onSave({ name: name.trim(), email: email.trim() });
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="關閉" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="glass absolute inset-x-0 bottom-0 rounded-t-2xl px-5 pt-5 md:inset-auto md:left-1/2 md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <p className="text-lg font-semibold">{title}</p>
        <div className="mt-4 flex flex-col gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">名稱</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="off"
              className={fieldClass}
            />
          </label>
          {kind === 'member' && (
            <label className="block">
              <span className="mb-1 block text-sm text-ink-2">登入信箱（選填）</span>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="填了才能辨識是誰完成的"
                className={fieldClass}
              />
            </label>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border-[0.5px] border-hairline bg-white px-4 py-2.5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            儲存
          </button>
        </div>
      </form>
    </div>
  );
}
