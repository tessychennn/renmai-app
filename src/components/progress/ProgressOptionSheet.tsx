import { useState } from 'react';
import type { ProgressOptionKind } from '../../data/types';
import { STATUS_COLORS } from '../../lib/progress';
import { STATUS_BADGE } from '../../lib/statusTone';
import { PROGRESS_TEXT as T } from '../../text/productProgress';

const fieldClass =
  'w-full rounded-xl border-[0.5px] border-hairline bg-white px-4 py-3 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

const COLOR_LABEL: Record<(typeof STATUS_COLORS)[number], string> = {
  gray: '灰',
  green: '綠',
  yellow: '黃',
  red: '紅',
  purple: '紫',
  blue: '藍',
};

export interface OptionValue {
  name: string;
  color: string;
  hint: string;
  isDone: boolean;
}

/**
 * 新增／修改一個產品進度的選項（大項目、營運優先級、技術等級、狀態）。
 * 呼叫端用 key 讓每次開啟都從乾淨的狀態開始。
 */
export default function ProgressOptionSheet({
  kind,
  kindLabel,
  initial,
  onSave,
  onClose,
}: {
  kind: ProgressOptionKind;
  kindLabel: string;
  initial?: Partial<OptionValue>;
  /** 回傳錯誤訊息代表不能儲存（例如名稱重複），面板會留著並顯示 */
  onSave: (value: OptionValue) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? 'gray');
  const [hint, setHint] = useState(initial?.hint ?? '');
  const [isDone, setIsDone] = useState(initial?.isDone ?? false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const title = initial?.name !== undefined ? T.settingsEdit(kindLabel) : T.settingsNew(kindLabel);

  const submit = async () => {
    if (!name.trim()) {
      setError(T.settingsErrorNoName);
      return;
    }
    setBusy(true);
    const message = await onSave({ name: name.trim(), color, hint: hint.trim(), isDone });
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={T.settingsCancel} className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="glass absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl px-5 pt-5 md:inset-auto md:left-1/2 md:top-1/2 md:w-[26rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <p className="text-lg font-semibold">{title}</p>
        <div className="mt-4 flex flex-col gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-2">{T.settingsNameLabel}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="off"
              className={fieldClass}
            />
          </label>

          {kind !== 'project' && (
            <label className="block">
              <span className="mb-1 block text-sm text-ink-2">{T.settingsHintLabel}</span>
              <input
                type="text"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder={T.settingsHintPlaceholder}
                className={fieldClass}
              />
            </label>
          )}

          {kind !== 'project' && (
            <div>
              <span className="mb-1 block text-sm text-ink-2">{T.settingsColorLabel}</span>
              <div role="radiogroup" aria-label={T.settingsColorLabel} className="flex flex-wrap gap-2">
                {STATUS_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    onClick={() => setColor(c)}
                    className={`rounded-lg border-[1.5px] px-3 py-1.5 text-sm ${STATUS_BADGE[c]} ${
                      color === c ? '!border-ink' : ''
                    } focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink`}
                  >
                    {COLOR_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind === 'status' && (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isDone}
                onChange={(e) => setIsDone(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0"
              />
              <span>
                <span className="block">{T.settingsDoneLabel}</span>
                <span className="block text-sm text-ink-2">{T.settingsDoneHelp}</span>
              </span>
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
            {T.settingsCancel}
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-xl bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {T.settingsSave}
          </button>
        </div>
      </form>
    </div>
  );
}
