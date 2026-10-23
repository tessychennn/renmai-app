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
import type { ProgressItem } from '../../data/types';
import { groupByProject, type ProgressOptions, type ProgressPatch } from '../../lib/progress';
import { PROGRESS_TEXT as T } from '../../text/productProgress';
import { optionDot } from '../tasks/TaskBoard';
import ProgressRow, { ProgressHeader } from './ProgressRow';

/**
 * 依大項目分區塊的清單。每個項目一排，可以打勾完成，營運優先級、技術等級、狀態都能直接下拉修改，
 * 進行中的清單可以拖曳左邊的把手，在同一個大項目裡調整上下順序。
 * 手機一欄；平板兩欄；電腦三欄（和待辦看板一致）。
 */
export default function ProgressBoard({
  items,
  opts,
  today,
  emptyText,
  draggable = false,
  onToggle,
  onOpen,
  onPatch,
  onReorder,
}: {
  items: ProgressItem[];
  opts: ProgressOptions;
  today: string;
  emptyText: string;
  /** 可以拖曳調整順序（進行中的清單才有） */
  draggable?: boolean;
  onToggle: (item: ProgressItem) => void;
  onOpen: (item: ProgressItem) => void;
  onPatch: (item: ProgressItem, patch: ProgressPatch) => void;
  /** 把 activeId 拖到 overId 的位置；items 是那個大項目目前畫面上的順序 */
  onReorder?: (items: ProgressItem[], activeId: string, overId: string) => void;
}) {
  // 拖曳把手在手機上用手指、電腦用滑鼠，也可以用鍵盤（把手上按空白鍵再用方向鍵）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const groups = groupByProject(items, opts.projects);
  if (groups.length === 0) {
    return <p className="mt-24 text-center text-ink-2">{emptyText}</p>;
  }
  return (
    <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <section
          key={g.project?.id ?? 'orphan'}
          aria-label={g.project?.name ?? T.orphanProject}
          className="@container overflow-hidden rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
        >
          <h2 className="flex items-center gap-2 border-b-[0.5px] border-hairline bg-ground/60 px-3 py-2 text-sm font-semibold">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: g.project ? optionDot(opts.projects, g.project.id) : '#B5B0A8' }}
            />
            {g.project?.name ?? T.orphanProject}
            <span className="font-normal text-ink-2">{g.items.length}</span>
          </h2>
          <ProgressHeader />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={(e: DragEndEvent) => {
              if (e.over && e.active.id !== e.over.id) onReorder?.(g.items, String(e.active.id), String(e.over.id));
            }}
          >
            <SortableContext items={g.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul>
                {g.items.map((i) => (
                  <ProgressRow
                    key={i.id}
                    item={i}
                    opts={opts}
                    today={today}
                    draggable={draggable && Boolean(onReorder)}
                    onToggle={onToggle}
                    onOpen={onOpen}
                    onPatch={onPatch}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </section>
      ))}
    </div>
  );
}
