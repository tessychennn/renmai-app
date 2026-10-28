import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '../../data/types';
import { groupByCategory, type InlinePatch, type SplitOptions } from '../../lib/tasks';
import TaskRow from './TaskRow';
import TaskTableRow, { TableHeader } from './TaskTableRow';

// 分類的小圓點顏色：低飽和，沿用原本試算表分頁的色調。依分類在清單中的位置固定配色。
const DOTS = ['#8FA3B5', '#9DB09A', '#C9A98C', '#B7A9BD', '#7FA5A1', '#B5B0A8', '#C79A94', '#A3A57F'];

/** 選項在清單中的位置決定圓點顏色（分類、進度的大項目共用） */
export function optionDot(list: { id: string }[], id: string): string {
  const i = list.findIndex((o) => o.id === id);
  return i < 0 ? '#B5B0A8' : DOTS[i % DOTS.length];
}

export function categoryDot(options: SplitOptions, categoryId: string): string {
  return optionDot(options.categories, categoryId);
}

/**
 * 依分類分區塊的看板。
 * - variant "table"（待辦）：每項一排，✓、項目、負責人、Deadline、狀態在同一列，後三者可直接下拉修改。
 * - variant "list"（完成區）：保持原本的列表樣式，顯示完成日期與完成者。
 * 手機一欄；平板兩欄；電腦三欄，和原本試算表「每排 3 個分類」一致。
 */
export default function TaskBoard({
  tasks,
  options,
  today,
  emptyText,
  variant = 'list',
  draggable = false,
  onToggle,
  onOpen,
  onPatch,
  onReorder,
}: {
  tasks: Task[];
  options: SplitOptions;
  today: string;
  emptyText: string;
  variant?: 'table' | 'list';
  /** 可以拖曳調整順序（待辦看板才有） */
  draggable?: boolean;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  onPatch?: (task: Task, patch: InlinePatch) => void;
  /** 把 activeId 拖到 overId 的位置；tasks 是那個分類目前畫面上的順序 */
  onReorder?: (tasks: Task[], activeId: string, overId: string) => void;
}) {
  // 拖曳把手在手機上用手指、電腦用滑鼠，也可以用鍵盤（把手上按空白鍵再用方向鍵）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const groups = groupByCategory(tasks, options.categories);
  if (groups.length === 0) {
    return <p className="mt-24 text-center text-ink-2">{emptyText}</p>;
  }
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <section
          key={g.category?.id ?? 'orphan'}
          aria-label={g.category?.name ?? '分類已刪除'}
          // @container：欄位寬度依「這個區塊」的寬度調整，不是依整個視窗
          className="@container overflow-hidden rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        >
          <h2 className="flex items-center gap-2 border-b-[0.5px] border-hairline bg-ground/60 px-3 py-2 text-sm font-semibold">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: g.category ? categoryDot(options, g.category.id) : '#B5B0A8' }}
            />
            {g.category?.name ?? '（分類已刪除）'}
            <span className="font-normal text-ink-2">{g.tasks.length}</span>
          </h2>
          {variant === 'table' && <TableHeader />}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={(e: DragEndEvent) => {
              if (e.over && e.active.id !== e.over.id) onReorder?.(g.tasks, String(e.active.id), String(e.over.id));
            }}
          >
            <SortableContext items={g.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <ul>
                {g.tasks.map((t) =>
                  variant === 'table' && onPatch ? (
                    <TaskTableRow
                      key={t.id}
                      task={t}
                      options={options}
                      today={today}
                      draggable={draggable && Boolean(onReorder)}
                      onToggle={onToggle}
                      onOpen={onOpen}
                      onPatch={onPatch}
                    />
                  ) : (
                    <TaskRow key={t.id} task={t} options={options} today={today} onToggle={onToggle} onOpen={onOpen} />
                  )
                )}
              </ul>
            </SortableContext>
          </DndContext>
        </section>
      ))}
    </div>
  );
}
