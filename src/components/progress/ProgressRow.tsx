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
import { dueLabel, dueState, optionName, type SplitOptions } from '../../lib/tasks';
import { InlineDate, InlineSelect } from '../tasks/InlineFields';

/**
 * 一列的欄位：項目、營運優先級、技術等級、狀態；寬一點的畫面再多負責人與目標日期。
 * 窄的時候負責人與目標日期改放在項目名稱下面一行小字。
 * 標題列與每一列共用，欄位才對得整齊。
 */
export const PROGRESS_GRID =
  'grid grid-cols-[minmax(0,1fr)_2.7rem_3.1rem_4rem] items-center gap-x-1 px-2 text-sm @md:grid-cols-[minmax(0,1fr)_5rem_5.5rem_5.5rem_5.5rem_5.5rem] @md:gap-x-2 @md:px-3 @md:text-base';

export function ProgressHeader() {
  return (
    <div aria-hidden="true" className={`${PROGRESS_GRID} border-b-[0.5px] border-hairline py-1.5 text-xs text-ink-2`}>
      <span>項目</span>
      <span>營運</span>
      <span>技術</span>
      <span>狀態</span>
      <span className="hidden @md:block">負責人</span>
      <span className="hidden text-center @md:block">目標日</span>
    </div>
  );
}

function choiceOptions<T extends string>(list: readonly Choice<T>[], unsetLabel: string) {
  return [{ value: '', label: unsetLabel }, ...list.map((c) => ({ value: c.value, label: `${c.label}　${c.hint}` }))];
}

export default function ProgressRow({
  item,
  options,
  today,
  onOpen,
  onPatch,
}: {
  item: ProgressItem;
  options: SplitOptions;
  today: string;
  onOpen: (item: ProgressItem) => void;
  onPatch: (item: ProgressItem, patch: ProgressPatch) => void;
}) {
  const members =
    item.ownerId && !options.members.some((m) => m.id === item.ownerId)
      ? [...options.members, { id: item.ownerId, name: '（已刪除）' }]
      : options.members;
  const ownerName = optionName(members, item.ownerId);
  const due = item.dueDate ? dueLabel(item.dueDate, today) : undefined;
  const state = item.status === 'done' ? 'none' : dueState(item.dueDate, today);
  const meta = [ownerName, due].filter(Boolean).join(' · ');
  const opsColor = colorOf(OPS_PRIORITIES, item.opsPriority);
  const techColor = colorOf(TECH_LEVELS, item.techLevel);
  const statusColor = colorOf(PROGRESS_STATUSES, item.status);
  const hasNote = Boolean(item.opsNote || item.techNote);

  return (
    <li className={`${PROGRESS_GRID} border-t-[0.5px] border-hairline py-2 first:border-t-0`}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="min-w-0 break-words text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
      >
        <span className={item.status === 'done' || item.status === 'paused' ? 'text-ink-2' : ''}>{item.name}</span>
        {hasNote && (
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
        {meta && <span className="mt-0.5 block text-xs text-ink-2 @md:hidden">{meta}</span>}
      </button>

      <InlineSelect
        ariaLabel={`「${item.name}」的營運優先級`}
        value={item.opsPriority ?? ''}
        options={choiceOptions(OPS_PRIORITIES, '未設定')}
        text={labelOf(OPS_PRIORITIES, item.opsPriority) ?? '—'}
        tone={item.opsPriority ? 'normal' : 'faint'}
        badge={opsColor && STATUS_BADGE[opsColor]}
        onChange={(v) => onPatch(item, { opsPriority: v as ProgressPatch['opsPriority'] })}
      />

      <InlineSelect
        ariaLabel={`「${item.name}」的技術等級`}
        value={item.techLevel ?? ''}
        options={choiceOptions(TECH_LEVELS, '未設定（技術端還沒評估）')}
        text={labelOf(TECH_LEVELS, item.techLevel) ?? '—'}
        tone={item.techLevel ? 'normal' : 'faint'}
        badge={techColor && STATUS_BADGE[techColor]}
        onChange={(v) => onPatch(item, { techLevel: v as ProgressPatch['techLevel'] })}
      />

      <InlineSelect
        ariaLabel={`「${item.name}」的狀態`}
        value={item.status}
        options={PROGRESS_STATUSES.map((c) => ({ value: c.value, label: `${c.label}　${c.hint}` }))}
        text={labelOf(PROGRESS_STATUSES, item.status) ?? item.status}
        badge={statusColor && STATUS_BADGE[statusColor]}
        onChange={(v) => onPatch(item, { status: v as ProgressPatch['status'] })}
      />

      {/* 寬的畫面才有這兩欄；窄的畫面改放在項目名稱下面（點項目開面板也能改） */}
      <span className="hidden min-w-0 @md:block">
        <InlineSelect
          ariaLabel={`「${item.name}」的負責人`}
          value={item.ownerId ?? ''}
          options={[{ value: '', label: '未指派' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
          text={ownerName ?? '未指派'}
          tone={ownerName ? 'normal' : 'faint'}
          onChange={(ownerId) => onPatch(item, { ownerId })}
        />
      </span>
      <span className="hidden min-w-0 @md:block">
        <InlineDate
          ariaLabel={`「${item.name}」的目標日期`}
          value={item.dueDate ?? ''}
          text={due ?? '—'}
          state={state}
          onChange={(dueDate) => onPatch(item, { dueDate })}
        />
      </span>
    </li>
  );
}
