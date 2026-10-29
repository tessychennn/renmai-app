import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

/**
 * 客戶清單的一列：最左邊是拖曳把手（可以拖曳時），後面是呼叫端放進來的各欄。
 * 呼叫端用 className 提供 grid 欄位（要和標題列對齊）。
 */
export default function SortableRow({
  id,
  draggable,
  label,
  className,
  children,
}: {
  id: string;
  draggable: boolean;
  /** 把手的說明（螢幕閱讀器與提示用） */
  label: string;
  className: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !draggable,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${className} ${isDragging ? 'relative z-10 bg-white shadow-[0_6px_20px_rgba(0,0,0,0.18)]' : ''}`}
    >
      {draggable ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={label}
          {...attributes}
          {...listeners}
          // touch-action: none 才不會在手指拖動把手時變成捲動頁面
          style={{ touchAction: 'none' }}
          className="flex h-8 w-4 cursor-grab items-center justify-center text-ink-2/60 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
            <circle cx="2.5" cy="3" r="1.3" />
            <circle cx="7.5" cy="3" r="1.3" />
            <circle cx="2.5" cy="8" r="1.3" />
            <circle cx="7.5" cy="8" r="1.3" />
            <circle cx="2.5" cy="13" r="1.3" />
            <circle cx="7.5" cy="13" r="1.3" />
          </svg>
        </button>
      ) : (
        <span />
      )}
      {children}
    </li>
  );
}
