import type { Task } from '../../data/types';
import {
  BLOCKED_STATUS_NAME,
  dueLabel,
  dueState,
  optionName,
  priorityTone,
  type DueState,
  type SplitOptions,
} from '../../lib/tasks';

const DUE_STYLES: Record<DueState, string> = {
  overdue: 'bg-danger/10 text-danger',
  today: 'bg-warn-soft text-ink',
  soon: 'bg-soon text-ink',
  later: 'text-ink-2',
  none: '',
};

const chip = 'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs';

export default function TaskRow({
  task,
  options,
  today,
  onToggle,
  onOpen,
}: {
  task: Task;
  options: SplitOptions;
  today: string;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
}) {
  const owner = optionName(options.members, task.ownerId);
  const status = optionName(options.statuses, task.statusId);
  const tone = priorityTone(options.priorities, task.priorityId);
  const state = task.done ? 'none' : dueState(task.dueDate, today);
  const blocked = !task.done && status === BLOCKED_STATUS_NAME;

  return (
    <li className="flex items-start gap-3 border-t-[0.5px] border-hairline px-3 py-2.5 first:border-t-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `還原「${task.name}」到待辦` : `完成「${task.name}」`}
        onClick={() => onToggle(task)}
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
          task.done ? 'border-ink bg-ink text-white' : 'border-ink-2/50 bg-white text-transparent'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m2.5 6.2 2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
      >
        <span
          className={`block break-words ${
            task.done
              ? 'text-ink-2 line-through'
              : tone === 'high'
                ? 'font-semibold text-danger'
                : tone === 'low'
                  ? 'text-ink-2'
                  : ''
          }`}
        >
          {task.name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {owner && <span className={`${chip} border-[0.5px] border-ink/20 text-ink`}>{owner}</span>}
          {task.done ? (
            <span className={`${chip} px-0 text-ink-2`}>
              {task.doneAt ? `完成於 ${dueLabel(task.doneAt, today)}` : '已完成'}
              {task.doneBy ? ` ${task.doneBy}` : ''}
            </span>
          ) : (
            task.dueDate && (
              <span className={`${chip} ${DUE_STYLES[state]} ${state === 'later' ? 'px-0' : ''}`}>
                {state === 'overdue' ? '逾期 ' : ''}
                {dueLabel(task.dueDate, today)}
              </span>
            )
          )}
          {status && !task.done && (
            <span
              className={`${chip} border-[0.5px] ${
                blocked ? 'border-danger/40 font-semibold text-danger' : 'border-hairline text-ink-2'
              }`}
            >
              {status}
            </span>
          )}
        </span>
        {task.note && <span className="mt-1 block truncate text-xs text-ink-2">{task.note}</span>}
      </button>
    </li>
  );
}
