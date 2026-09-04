export interface SheetAction {
  label: string;
  danger?: boolean;
  onClick: () => void;
}

export default function ConfirmSheet({
  open,
  title,
  message,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  message?: string;
  actions: SheetAction[];
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
        {message && <p className="mt-1 text-sm text-ink-2">{message}</p>}
        <div className="mt-4 flex flex-col gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={`w-full rounded-xl px-4 py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                action.danger ? 'bg-danger text-white' : 'bg-ink text-white'
              }`}
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-white px-4 py-3 font-medium text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
