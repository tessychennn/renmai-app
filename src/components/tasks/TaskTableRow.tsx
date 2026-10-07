import type { Task } from '../../data/types';
import {
  BLOCKED_STATUS_NAME,
  dueLabel,
  dueState,
  optionName,
  priorityTone,
  type InlinePatch,
  type SplitOptions,
} from '../../lib/tasks';
import { InlineDate, InlineSelect } from './InlineFields';

/** 一列的欄位：✓、項目、負責人、Deadline、狀態。標題列與每一列共用，欄位才對得整齊。 */
export const ROW_GRID =
  'grid grid-cols-[1.5rem_minmax(0,1fr)_3.6rem_3.4rem_3.8rem] items-center gap-x-1 px-2 text-sm @md:grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_6rem_6.5rem] @md:gap-x-2 @md:px-3 @md:text-base';

export function TableHeader() {
  return (
    <div
      aria-hidden="true"
      className={`${ROW_GRID} border-b-[0.5px] border-hairline py-1.5 text-xs text-ink-2`}
    >
      <span />
      <span>項目</span>
      <span>負責人</span>
      <span className="text-center">Deadline</span>
      <span>狀態</span>
    </div>
  );
}

const withCurrent = (list: { id: string; name: string }[], id: string | undefined) =>
  id && !list.some((o) => o.id === id) ? [...list, { id, name: '（已刪除）' }] : list;

/**
 * 待辦看板的一列：所有資訊在同一排，負責人、Deadline、狀態都能直接點開下拉選單修改。
 * 名稱太長時會換行，其他欄位維持固定寬度。
 */
export default function TaskTableRow({
  task,
  options,
  today,
  onToggle,
  onOpen,
  onPatch,
}: {
  task: Task;
  options: SplitOptions;
  today: string;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  onPatch: (task: Task, patch: InlinePatch) => void;
}) {
  const members = withCurrent(options.members, task.ownerId);
  const statuses = withCurrent(options.statuses, task.statusId);
  const ownerName = optionName(members, task.ownerId);
  const statusName = optionName(statuses, task.statusId);
  const tone = priorityTone(options.priorities, task.priorityId);
  const state = dueState(task.dueDate, today);

  return (
    <li className={`${ROW_GRID} border-t-[0.5px] border-hairline py-2 first:border-t-0`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={false}
        aria-label={`完成「${task.name}」`}
        onClick={() => onToggle(task)}
        className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-ink-2/50 bg-white text-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m2.5 6.2 2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className={`min-w-0 break-words text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
          tone === 'high' ? 'font-semibold text-danger' : tone === 'low' ? 'text-ink-2' : ''
        }`}
      >
        {task.name}
        {task.note && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            role="img"
            aria-label="有備註"
            className="ml-1 inline-block align-[-1px] text-ink-2"
          >
            <path d="M2.5 3h7M2.5 6h7M2.5 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <InlineSelect
        ariaLabel={`「${task.name}」的負責人`}
        value={task.ownerId ?? ''}
        options={[{ value: '', label: '未指派' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        text={ownerName ?? '未指派'}
        tone={ownerName ? 'normal' : 'faint'}
        onChange={(ownerId) => onPatch(task, { ownerId })}
      />

      <InlineDate
        ariaLabel={`「${task.name}」的 Deadline`}
        value={task.dueDate ?? ''}
        text={task.dueDate ? dueLabel(task.dueDate, today) : '—'}
        state={state}
        onChange={(dueDate) => onPatch(task, { dueDate })}
      />

      <InlineSelect
        ariaLabel={`「${task.name}」的狀態`}
        value={task.statusId ?? ''}
        options={[{ value: '', label: '未設定' }, ...statuses.map((s) => ({ value: s.id, label: s.name }))]}
        text={statusName ?? '未設定'}
        tone={statusName === BLOCKED_STATUS_NAME ? 'danger' : statusName ? 'normal' : 'faint'}
        onChange={(statusId) => onPatch(task, { statusId })}
      />
    </li>
  );
}
