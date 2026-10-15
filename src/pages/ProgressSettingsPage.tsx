import { useState } from 'react';
import ConfirmSheet from '../components/ConfirmSheet';
import GlassHeader, { HEADER_PAD } from '../components/GlassHeader';
import ProgressOptionSheet, { type OptionValue } from '../components/progress/ProgressOptionSheet';
import { progressOptionRepo } from '../data';
import type { ProgressItem, ProgressOption, ProgressOptionKind } from '../data/types';
import { useProgressData } from '../hooks/useProgressData';
import { useRole } from '../hooks/useRole';
import { parseColor, type ProgressOptions } from '../lib/progress';
import { STATUS_BADGE } from '../lib/statusTone';
import { PROGRESS_TEXT as T } from '../text/productProgress';

const SECTIONS: { kind: ProgressOptionKind; title: string; hint: string }[] = [
  { kind: 'project', ...T.sectionProject },
  { kind: 'priority', ...T.sectionPriority },
  { kind: 'tech', ...T.sectionTech },
  { kind: 'status', ...T.sectionStatus },
];

const cardClass = 'rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]';
const iconButton =
  'flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-ground disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

const listOf = (opts: ProgressOptions, kind: ProgressOptionKind): ProgressOption[] =>
  ({ project: opts.projects, priority: opts.priorities, tech: opts.techLevels, status: opts.statuses })[kind];

/** 有多少未刪除的項目在使用這個選項（刪除前檢查用） */
function usageOf(items: ProgressItem[], option: ProgressOption): number {
  const field = { project: 'projectId', priority: 'opsPriority', tech: 'techLevel', status: 'status' }[
    option.kind
  ] as 'projectId' | 'opsPriority' | 'techLevel' | 'status';
  return items.filter((i) => i[field] === option.id).length;
}

/** 產品進度設定：大項目、營運優先級、技術等級、狀態。只有管理員能修改（伺服器也只認管理員）。 */
export default function ProgressSettingsPage() {
  const { items, options, reload } = useProgressData();
  const role = useRole();
  const [editing, setEditing] = useState<{ kind: ProgressOptionKind; option?: ProgressOption } | null>(null);
  const [deleting, setDeleting] = useState<ProgressOption | null>(null);
  const [message, setMessage] = useState('');

  const save = async (
    kind: ProgressOptionKind,
    existing: ProgressOption | undefined,
    value: OptionValue
  ): Promise<string | null> => {
    const list = listOf(options, kind);
    if (list.some((o) => o.id !== existing?.id && o.name.toLowerCase() === value.name.toLowerCase())) {
      return T.settingsDuplicate;
    }
    // 狀態一定要有一個代表完成的，不然打勾完成沒有地方去
    if (kind === 'status') {
      const othersDone = list.some((o) => o.id !== existing?.id && o.isDone);
      if (!value.isDone && !othersDone) return T.settingsNeedDone;
    }
    const now = new Date().toISOString();
    const fields = {
      name: value.name,
      color: kind === 'project' ? (existing?.color ?? 'gray') : value.color,
      hint: kind === 'project' ? undefined : value.hint || undefined,
      isDone: kind === 'status' && value.isDone ? true : undefined,
    };
    if (existing) {
      await progressOptionRepo.save({ ...existing, ...fields, updatedAt: now });
    } else {
      const order = list.reduce((max, o) => Math.max(max, o.order), -1) + 1;
      await progressOptionRepo.save({ id: crypto.randomUUID(), kind, order, updatedAt: now, ...fields });
    }
    setEditing(null);
    reload();
    return null;
  };

  /** 上移／下移：整份清單重新編號，只存有變動的 */
  const move = async (kind: ProgressOptionKind, index: number, delta: number) => {
    const list = [...listOf(options, kind)];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const now = new Date().toISOString();
    const original = listOf(options, kind);
    const changed = list
      .map((o, i) => ({ ...o, order: i, updatedAt: now }))
      .filter((o, i) => original[i].id !== o.id || original[i].order !== o.order);
    await progressOptionRepo.saveMany(changed);
    reload();
  };

  const askDelete = (option: ProgressOption) => {
    setMessage('');
    const count = usageOf(items, option);
    if (count > 0) {
      setMessage(T.settingsInUse(option.name, count));
      return;
    }
    if (option.kind === 'status' && option.isDone && !options.statuses.some((s) => s.id !== option.id && s.isDone)) {
      setMessage(T.settingsNeedDone);
      return;
    }
    setDeleting(option);
  };

  const doDelete = async () => {
    if (!deleting) return;
    await progressOptionRepo.remove(deleting.id);
    setDeleting(null);
    reload();
  };

  return (
    <div className="min-h-dvh">
      <GlassHeader title={T.settingsTitle} back />
      <main
        className="mx-auto flex max-w-3xl flex-col gap-4 px-5"
        style={{ paddingTop: HEADER_PAD, paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}
      >
        <p className={`${cardClass} px-4 py-3 text-sm text-ink-2`}>
          {role.isAdmin ? T.settingsAdmin : T.settingsReadOnly}
        </p>
        {message && (
          <p role="alert" className={`${cardClass} px-4 py-3 text-sm font-medium text-danger`}>
            {message}
          </p>
        )}

        {SECTIONS.map((section) => {
          const list = listOf(options, section.kind);
          return (
            <section key={section.kind} className={cardClass} aria-label={section.title}>
              <div className="px-4 pt-3">
                <h2 className="font-semibold">{section.title}</h2>
                <p className="mt-0.5 text-sm text-ink-2">{section.hint}</p>
              </div>
              <ul className="mt-2">
                {list.map((o, i) => (
                  <li key={o.id} className="flex items-center gap-1 border-t-[0.5px] border-hairline px-4 py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        {section.kind !== 'project' && (
                          <span
                            aria-hidden="true"
                            className={`inline-block h-4 w-8 shrink-0 rounded ${STATUS_BADGE[parseColor(o.color)]}`}
                          />
                        )}
                        <span className="truncate">{o.name}</span>
                        {o.isDone && <span className="shrink-0 text-xs text-ink-2">{T.settingsMarkedDone}</span>}
                      </span>
                      {o.hint && <span className="block truncate text-xs text-ink-2">{o.hint}</span>}
                    </span>
                    {role.isAdmin && (
                      <>
                        <button type="button" aria-label={`${T.settingsMoveUp}「${o.name}」`} disabled={i === 0} onClick={() => void move(section.kind, i, -1)} className={iconButton}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="m4 10 4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button type="button" aria-label={`${T.settingsMoveDown}「${o.name}」`} disabled={i === list.length - 1} onClick={() => void move(section.kind, i, 1)} className={iconButton}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button type="button" aria-label={`${T.settingsEditButton}「${o.name}」`} onClick={() => setEditing({ kind: section.kind, option: o })} className={iconButton}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="m10.5 3.5 2 2M3 13l.5-2.5 7-7 2 2-7 7L3 13Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button type="button" aria-label={`${T.settingsDelete}「${o.name}」`} onClick={() => askDelete(o)} className={`${iconButton} hover:text-danger`}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </>
                    )}
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="border-t-[0.5px] border-hairline px-4 py-3 text-sm text-ink-2">{T.settingsEmpty}</li>
                )}
              </ul>
              {role.isAdmin && (
                <div className="border-t-[0.5px] border-hairline px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: section.kind })}
                    className="text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    {T.settingsAdd(section.title)}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </main>

      {editing && (
        <ProgressOptionSheet
          key={editing.option?.id ?? `new-${editing.kind}`}
          kind={editing.kind}
          kindLabel={SECTIONS.find((s) => s.kind === editing.kind)!.title}
          initial={
            editing.option && {
              name: editing.option.name,
              color: editing.option.color,
              hint: editing.option.hint,
              isDone: editing.option.isDone,
            }
          }
          onSave={(value) => save(editing.kind, editing.option, value)}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmSheet
        open={deleting !== null}
        title={deleting ? T.settingsConfirmDelete(deleting.name) : ''}
        message={T.settingsConfirmDeleteBody}
        actions={[{ label: T.settingsDelete, danger: true, onClick: () => void doDelete() }]}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
