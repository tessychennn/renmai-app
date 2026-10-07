import { useState } from 'react';
import ConfirmSheet from '../components/ConfirmSheet';
import GlassHeader, { HEADER_PAD } from '../components/GlassHeader';
import OptionSheet from '../components/tasks/OptionSheet';
import { taskOptionRepo, taskRepo } from '../data';
import type { TaskOption, TaskOptionKind } from '../data/types';
import { useRole } from '../hooks/useRole';
import { useTaskData } from '../hooks/useTaskData';
import { planLegacyImport } from '../lib/legacyImport';
import { parseLegacyJson } from '../lib/parseLegacyJson';
import { optionUsage } from '../lib/tasks';

const SECTIONS: { kind: TaskOptionKind; title: string; hint: string }[] = [
  { kind: 'category', title: '分類', hint: '待辦依分類分成一個個區塊。' },
  { kind: 'member', title: '成員', hint: '負責人的選項。填了登入信箱，才能辨識「是誰完成的」。' },
  { kind: 'priority', title: '優先級', hint: '第一個是最高（名稱標紅），最後一個是最低（淡灰）。' },
  { kind: 'status', title: '狀態', hint: '名稱叫「卡住」的狀態會標紅。' },
];

const cardClass =
  'rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]';
const iconButton =
  'flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-ground disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink';

export default function TaskSettingsPage() {
  const { tasks, allOptions, options, reload } = useTaskData();
  const role = useRole();
  const [editing, setEditing] = useState<{ kind: TaskOptionKind; option?: TaskOption } | null>(null);
  const [deleting, setDeleting] = useState<TaskOption | null>(null);
  const [inUse, setInUse] = useState<{ option: TaskOption; count: number } | null>(null);
  const [importText, setImportText] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importing, setImporting] = useState(false);

  const listOf = (kind: TaskOptionKind): TaskOption[] =>
    ({
      category: options.categories,
      member: options.members,
      priority: options.priorities,
      status: options.statuses,
    })[kind];

  const saveOption = async (
    kind: TaskOptionKind,
    existing: TaskOption | undefined,
    value: { name: string; email: string }
  ): Promise<string | null> => {
    const dup = listOf(kind).some(
      (o) => o.id !== existing?.id && o.name.toLowerCase() === value.name.toLowerCase()
    );
    if (dup) return '已經有同名的選項了。';
    const now = new Date().toISOString();
    const email = kind === 'member' && value.email ? value.email : undefined;
    if (existing) {
      await taskOptionRepo.save({ ...existing, name: value.name, email, updatedAt: now });
    } else {
      const order = listOf(kind).reduce((max, o) => Math.max(max, o.order), -1) + 1;
      await taskOptionRepo.save({
        id: crypto.randomUUID(),
        kind,
        name: value.name,
        order,
        email,
        updatedAt: now,
      });
    }
    setEditing(null);
    reload();
    return null;
  };

  /** 上移／下移：整份清單重新編號，只存有變動的 */
  const move = async (kind: TaskOptionKind, index: number, delta: number) => {
    const list = [...listOf(kind)];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const now = new Date().toISOString();
    const changed = list
      .map((o, i) => ({ ...o, order: i, updatedAt: now }))
      .filter((o, i) => list[i].order !== o.order || listOf(kind)[i].id !== o.id);
    await taskOptionRepo.saveMany(changed);
    reload();
  };

  const askDelete = (option: TaskOption) => {
    const count = optionUsage(tasks, option);
    if (count > 0) setInUse({ option, count });
    else setDeleting(option);
  };

  const doImport = async () => {
    setImporting(true);
    setImportMessage('');
    try {
      const raw = parseLegacyJson(importText);
      const existingIds = new Set((await taskRepo.list()).map((t) => t.id));
      const plan = planLegacyImport(raw, allOptions, existingIds);
      await taskOptionRepo.saveMany(plan.newOptions);
      await taskRepo.saveMany(plan.newTasks);
      reload();
      setImportText('');
      setImportMessage(
        `已匯入 ${plan.newTasks.length} 筆任務、新增 ${plan.newOptions.length} 個選項` +
          (plan.skippedExisting ? `，略過 ${plan.skippedExisting} 筆已存在的` : '') +
          (plan.warnings.length ? `。注意：${plan.warnings.join(' ')}` : '。')
      );
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : '匯入失敗。');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <GlassHeader title="待辦設定" back />
      <main
        className="mx-auto flex max-w-3xl flex-col gap-4 px-5"
        style={{ paddingTop: HEADER_PAD, paddingBottom: 'calc(env(safe-area-inset-bottom) + 40px)' }}
      >
        <p className={`${cardClass} px-4 py-3 text-sm ${role.isAdmin ? 'text-ink-2' : ''}`}>
          {role.isAdmin ? (
            <>
              你是<span className="font-medium text-ink">管理員</span>，可以修改下面的設定。
            </>
          ) : (
            <>
              你是<span className="font-medium text-ink">一般成員</span>，只能查看設定。需要修改請找管理員。
            </>
          )}
        </p>

        {SECTIONS.map((section) => {
          const list = listOf(section.kind);
          return (
            <section key={section.kind} className={cardClass} aria-label={section.title}>
              <div className="px-4 pt-3">
                <h2 className="font-semibold">{section.title}</h2>
                <p className="mt-0.5 text-sm text-ink-2">{section.hint}</p>
              </div>
              <ul className="mt-2">
                {list.map((o, i) => (
                  <li
                    key={o.id}
                    className="flex items-center gap-1 border-t-[0.5px] border-hairline px-4 py-1.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.name}</span>
                      {o.email && <span className="block truncate text-xs text-ink-2">{o.email}</span>}
                    </span>
                    {role.isAdmin && (
                      <>
                        <button type="button" aria-label={`上移「${o.name}」`} disabled={i === 0} onClick={() => void move(section.kind, i, -1)} className={iconButton}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="m4 10 4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button type="button" aria-label={`下移「${o.name}」`} disabled={i === list.length - 1} onClick={() => void move(section.kind, i, 1)} className={iconButton}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button type="button" aria-label={`修改「${o.name}」`} onClick={() => setEditing({ kind: section.kind, option: o })} className={iconButton}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="m10.5 3.5 2 2M3 13l.5-2.5 7-7 2 2-7 7L3 13Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button type="button" aria-label={`刪除「${o.name}」`} onClick={() => askDelete(o)} className={`${iconButton} hover:text-danger`}>
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </>
                    )}
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="border-t-[0.5px] border-hairline px-4 py-3 text-sm text-ink-2">還沒有選項。</li>
                )}
              </ul>
              {role.isAdmin && (
                <div className="border-t-[0.5px] border-hairline px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: section.kind })}
                    className="text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
                  >
                    ＋ 新增{section.title}
                  </button>
                </div>
              )}
            </section>
          );
        })}

        {role.isAdmin && (
          <section className={`${cardClass} p-4`} aria-label="匯入舊資料">
            <h2 className="font-semibold">匯入原本試算表的資料</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              貼上試算表匯出的內容，或選擇匯出的檔案。可以重複匯入，已經匯入過的項目不會重複建立，也不會蓋掉你之後的修改。
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              placeholder='{"categories": [...], "tasks": [...]}'
              className="mt-3 w-full rounded-xl border-[0.5px] border-hairline bg-ground px-3 py-2.5 font-mono text-ink placeholder:text-ink-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void doImport()}
                disabled={importing || !importText.trim()}
                className="rounded-xl bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {importing ? '匯入中⋯' : '匯入'}
              </button>
              {/* 內容很長時，貼上可能被截斷；選擇檔案可以繞過剪貼簿 */}
              <label className="cursor-pointer rounded-xl border-[0.5px] border-hairline bg-white px-4 py-2.5 font-medium focus-within:outline focus-within:outline-2 focus-within:outline-ink">
                選擇檔案
                <input
                  type="file"
                  accept=".json,.txt,application/json,text/plain"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    void file.text().then((text) => {
                      setImportText(text);
                      setImportMessage(`已讀入「${file.name}」（${text.length} 字），按「匯入」開始。`);
                    });
                  }}
                />
              </label>
            </div>
            {importMessage && (
              <p role="status" className="mt-3 text-sm text-ink-2">
                {importMessage}
              </p>
            )}
          </section>
        )}
      </main>

      {editing && (
        <OptionSheet
          key={editing.option?.id ?? `new-${editing.kind}`}
          kind={editing.kind}
          initial={editing.option && { name: editing.option.name, email: editing.option.email }}
          onSave={(value) => saveOption(editing.kind, editing.option, value)}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmSheet
        open={deleting !== null}
        title={deleting ? `刪除「${deleting.name}」？` : ''}
        message="刪除後無法復原。"
        actions={[
          {
            label: '刪除',
            danger: true,
            onClick: () => {
              if (!deleting) return;
              void taskOptionRepo.remove(deleting.id).then(() => {
                setDeleting(null);
                reload();
              });
            },
          },
        ]}
        onClose={() => setDeleting(null)}
      />

      <ConfirmSheet
        open={inUse !== null}
        title="還不能刪除"
        message={
          inUse
            ? `還有 ${inUse.count} 個項目在使用「${inUse.option.name}」。請先把它們改到別的選項，再回來刪除。`
            : ''
        }
        actions={[]}
        cancelLabel="知道了"
        onClose={() => setInUse(null)}
      />
    </div>
  );
}
