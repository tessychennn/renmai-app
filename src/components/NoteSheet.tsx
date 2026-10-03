import { useState } from 'react';

/** 編輯合作備註的底部面板。呼叫端用 key 讓每次開啟都從最新內容開始。 */
export default function NoteSheet({
  title,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  initial: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="關閉"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        className="glass absolute inset-x-0 bottom-0 rounded-t-2xl px-5 pt-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <p className="text-lg font-semibold">{title}</p>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          autoFocus
          placeholder="例：下週三 14:00 視訊，先準備報價"
          className="mt-4 w-full rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave(value)}
            className="flex-1 rounded-xl bg-ink px-4 py-3 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
