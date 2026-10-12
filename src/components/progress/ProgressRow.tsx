import type { ProgressItem } from '../../data/types';
import {
  colorOf,
  labelOf,
  OPS_PRIORITIES,
  PROGRESS_STATUSES,
  TECH_LEVELS,
  type Choice,
  type ProgressPatch,
} from '../../lib/progress';
import { STATUS_BADGE } from '../../lib/statusTone';
import { dueLabel, dueState } from '../../lib/tasks';
import { PROGRESS_TEXT as T } from '../../text/productProgress';
import { InlineDate, InlineSelect } from '../tasks/InlineFields';

/**
 * 一列的欄位：✓、項目、營運優先級、技術等級、狀態；寬一點的畫面再多目標日期。
 * 窄的時候目標日期改放在項目名稱下面一行小字。
 * 標題列與每一列共用，欄位才對得整齊。
 */
export const PROGRESS_GRID =
  'grid grid-cols-[1.5rem_minmax(0,1fr)_2.7rem_3.1rem_4rem] items-center gap-x-1 px-2 text-sm @md:grid-cols-[1.5rem_minmax(0,1fr)_5rem_5.5rem_5.5rem_5.5rem] @md:gap-x-2 @md:px-3 @md:text-base';

export function ProgressHeader() {
  return (
    <div aria-hidden="true" className={`${PROGRESS_GRID} border-b-[0.5px] border-hairline py-1.5 text-xs text-ink-2`}>
      <span />
      <span>{T.colName}</span>
      <span>{T.colOps}</span>
      <span>{T.colTech}</span>
      <span>{T.colStatus}</span>
      <span className="hidden text-center @md:block">{T.colDue}</span>
    </div>
  );
}

function choiceOptions<T extends string>(list: readonly Choice<T>[], unsetLabel?: string) {
  const choices = list.map((c) => ({ value: c.value as string, label: `${c.label}　${c.hint}` }));
  return unsetLabel ? [{ value: '', label: unsetLabel }, ...choices] : choices;
}

export default function ProgressRow({
  item,
  today,
  onToggle,
  onOpen,
  onPatch,
}: {
  item: ProgressItem;
  today: string;
  onToggle: (item: ProgressItem) => void;
  onOpen: (item: ProgressItem) => void;
  onPatch: (item: ProgressItem, patch: ProgressPatch) => void;
}) {
  const done = item.status === 'done';
  const due = item.dueDate ? dueLabel(item.dueDate, today) : undefined;
  const state = done ? 'none' : dueState(item.dueDate, today);
  const opsColor = colorOf(OPS_PRIORITIES, item.opsPriority);
  const techColor = colorOf(TECH_LEVELS, item.techLevel);
  const statusColor = colorOf(PROGRESS_STATUSES, item.status);
  const hasNote = Boolean(item.opsNote || item.techNote);

  return (
    <li className={`${PROGRESS_GRID} border-t-[0.5px] border-hairline py-2 first:border-t-0`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? T.reopenLabel(item.name) : T.markDoneLabel(item.name)}
        onClick={() => onToggle(item)}
        className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
          done ? 'border-ink bg-ink text-white' : 'border-ink-2/50 bg-white text-transparent'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m2.5 6.2 2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => onOpen(item)}
        className="min-w-0 break-words text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
      >
        <span className={done || item.status === 'paused' ? 'text-ink-2' : ''}>
          <span className={done ? 'line-through' : ''}>{item.name}</span>
        </span>
        {hasNote && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            role="img"
            aria-label={T.hasNoteLabel}
            className="ml-1 inline-block align-[-1px] text-ink-2"
          >
            <path d="M2.5 3h7M2.5 6h7M2.5 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
        {due && <span className="mt-0.5 block text-xs text-ink-2 @md:hidden">{due}</span>}
      </button>

      <InlineSelect
        ariaLabel={T.ariaOps(item.name)}
        value={item.opsPriority ?? ''}
        options={choiceOptions(OPS_PRIORITIES, T.unsetOps)}
        text={labelOf(OPS_PRIORITIES, item.opsPriority) ?? '—'}
        tone={item.opsPriority ? 'normal' : 'faint'}
        badge={opsColor && STATUS_BADGE[opsColor]}
        onChange={(v) => onPatch(item, { opsPriority: v as ProgressPatch['opsPriority'] })}
      />

      <InlineSelect
        ariaLabel={T.ariaTech(item.name)}
        value={item.techLevel ?? ''}
        options={choiceOptions(TECH_LEVELS, T.unsetTech)}
        text={labelOf(TECH_LEVELS, item.techLevel) ?? '—'}
        tone={item.techLevel ? 'normal' : 'faint'}
        badge={techColor && STATUS_BADGE[techColor]}
        onChange={(v) => onPatch(item, { techLevel: v as ProgressPatch['techLevel'] })}
      />

      <InlineSelect
        ariaLabel={T.ariaStatus(item.name)}
        value={item.status}
        options={choiceOptions(PROGRESS_STATUSES)}
        text={labelOf(PROGRESS_STATUSES, item.status) ?? item.status}
        badge={statusColor && STATUS_BADGE[statusColor]}
        onChange={(v) => onPatch(item, { status: v as ProgressPatch['status'] })}
      />

      {/* 寬的畫面才有這一欄；窄的畫面改放在項目名稱下面（點項目開面板也能改） */}
      <span className="hidden min-w-0 @md:block">
        <InlineDate
          ariaLabel={T.ariaDue(item.name)}
          value={item.dueDate ?? ''}
          text={due ?? '—'}
          state={state}
          onChange={(dueDate) => onPatch(item, { dueDate })}
        />
      </span>
    </li>
  );
}
