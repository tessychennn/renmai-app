export interface Choice {
  label: string;
  selected?: boolean;
  onClick: () => void;
}

/** 單選底部選單：目前選中的那項反白。footer 放不屬於選項的動作（例如「移出列表」）。 */
export default function ChoiceSheet({
  open,
  title,
  choices,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  choices: Choice[];
  footer?: { label: string; onClick: () => void };
  onClose: () => void;
}) {
  if (!open) return null;
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
        <div className="mt-4 flex flex-col gap-2">
          {choices.map((choice) => (
            <button
              key={choice.label}
              type="button"
              aria-pressed={choice.selected}
              onClick={choice.onClick}
              className={`w-full rounded-xl border-[0.5px] px-4 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                choice.selected
                  ? 'border-ink bg-ink text-white'
                  : 'border-hairline bg-white text-ink'
              }`}
            >
              {choice.label}
            </button>
          ))}
          {footer && (
            <button
              type="button"
              onClick={footer.onClick}
              className="w-full rounded-xl px-4 py-3 font-medium text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
            >
              {footer.label}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl px-4 py-3 font-medium text-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
