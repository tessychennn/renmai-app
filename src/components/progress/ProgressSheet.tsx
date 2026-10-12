import { useState } from 'react';
import type { OpsPriority, ProgressItem, ProgressStatus, TechLevel } from '../../data/types';
import {
  OPS_PRIORITIES,
  PROGRESS_STATUSES,
  projects,
  TECH_LEVELS,
  type ProgressInput,
} from '../../lib/progress';
import { PROGRESS_TEXT as T } from '../../text/productProgress';

const fieldClass =
  'w-full rounded-xl border-[0.5px] border-hairline bg-white px-3 py-2.5 text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-ink-2">
        {label}
        {hint && <span className="ml-1 text-xs">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * 新增／編輯項目的面板（手機從底部滑出，電腦置中顯示）。
 * 營運備註與技術備註分開兩欄，兩邊各寫各的，不會互相蓋掉。
 * 呼叫端用 key 讓每次開啟都從乾淨的狀態開始。
 */
export default function ProgressSheet({
  item,
  defaults,
  onSave,
  onDelete,
  onClose,
}: {
  item?: ProgressItem;
  defaults?: { projectId?: string };
  onSave: (input: ProgressInput, keepAdding: boolean) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const editing = Boolean(item);
  const [name, setName] = useState(item?.name ?? '');
  const [projectId, setProjectId] = useState(
    item?.projectId ??
      (projects.some((p) => p.id === defaults?.projectId) ? defaults!.projectId! : (projects[0]?.id ?? ''))
  );
  const [opsPriority, setOpsPriority] = useState<OpsPriority | ''>(item?.opsPriority ?? '');
  const [techLevel, setTechLevel] = useState<TechLevel | ''>(item?.techLevel ?? '');
  const [status, setStatus] = useState<ProgressStatus>(item?.status ?? 'proposed');
  const [dueDate, setDueDate] = useState(item?.dueDate ?? '');
  const [opsNote, setOpsNote] = useState(item?.opsNote ?? '');
  const [techNote, setTechNote] = useState(item?.techNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState('');

  // 編輯時，項目的大項目可能已不在清單裡：保留成一個選項，避免儲存時默默改掉
  const projectChoices =
    item && !projects.some((p) => p.id === item.projectId)
      ? [...projects, { id: item.projectId, name: T.deletedOption }]
      : projects;

  const submit = async (keepAdding: boolean) => {
    if (!name.trim()) {
      setError(T.errorNoName);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(
        {
          name,
          projectId,
          opsPriority: opsPriority || undefined,
          techLevel: techLevel || undefined,
          status,
          dueDate,
          opsNote,
          techNote,
        },
        keepAdding
      );
      if (keepAdding) {
        setJustAdded(name.trim());
        setName('');
        setOpsNote('');
        setTechNote('');
        setDueDate('');
        setOpsPriority('');
        setTechLevel('');
        setStatus('proposed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : T.errorSaveFailed);
    } finally {
      setBusy(false);
    }
  };

  const title = editing ? T.sheetEditTitle : T.sheetAddTitle;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={T.buttonCancel} className="absolute inset-0 bg-black/30" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
        className="glass absolute inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl px-5 pt-5 md:inset-auto md:left-1/2 md:top-1/2 md:w-[32rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <p className="text-lg font-semibold">{title}</p>

        <div className="mt-4 flex flex-col gap-3">
          <Field label={T.fieldName}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder={T.fieldNamePlaceholder}
              className={fieldClass}
            />
          </Field>

          <Field label={T.fieldProject}>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={fieldClass}>
              {projectChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={T.fieldOps}>
              <select
                value={opsPriority}
                onChange={(e) => setOpsPriority(e.target.value as OpsPriority | '')}
                className={fieldClass}
              >
                <option value="">{T.unsetOps}</option>
                {OPS_PRIORITIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}　{c.hint}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={T.fieldTech}>
              <select
                value={techLevel}
                onChange={(e) => setTechLevel(e.target.value as TechLevel | '')}
                className={fieldClass}
              >
                <option value="">{T.unsetTech}</option>
                {TECH_LEVELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}　{c.hint}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={T.fieldStatus}>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProgressStatus)}
                className={fieldClass}
              >
                {PROGRESS_STATUSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}　{c.hint}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={T.fieldDue}>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={fieldClass} />
            </Field>
          </div>

          <Field label={T.fieldOpsNote} hint={T.fieldOpsNoteHint}>
            <textarea value={opsNote} onChange={(e) => setOpsNote(e.target.value)} rows={3} className={fieldClass} />
          </Field>
          <Field label={T.fieldTechNote} hint={T.fieldTechNoteHint}>
            <textarea value={techNote} onChange={(e) => setTechNote(e.target.value)} rows={3} className={fieldClass} />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {justAdded && !error && (
          <p role="status" className="mt-3 text-sm text-ink-2">
            {T.justAdded(justAdded)}
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
              {T.buttonDelete}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-[0.5px] border-hairline bg-white px-4 py-2.5 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            {T.buttonCancel}
          </button>
          {!editing && (
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={busy}
              className="rounded-xl border-[0.5px] border-hairline bg-white px-4 py-2.5 font-medium disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            >
              {T.buttonAddAndContinue}
            </button>
          )}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-ink px-5 py-2.5 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {editing ? T.buttonSave : T.buttonAdd}
          </button>
        </div>
      </form>
    </div>
  );
}
