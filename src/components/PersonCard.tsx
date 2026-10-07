import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLongPress } from '../hooks/useLongPress';
import { usePhotoURL } from '../hooks/usePhotoURL';
import type { Group, Person } from '../data/types';
import type { ChipTone } from '../lib/prospects';
import StatusChip from './StatusChip';

/** 卡片進入視窗附近才回傳 true（之後維持 true）。人數多時避免一次讀取幾百張縮圖。 */
function useNearViewport<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '800px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near];
}

/** 備註的第一句話（以句號、驚嘆號、問號或換行切分） */
function firstSentence(note?: string): string | undefined {
  return note
    ?.split(/[。！？!?\n]/)
    .map((s) => s.trim())
    .find(Boolean);
}

export default function PersonCard({
  person,
  groups,
  prospect,
  onLongPress,
}: {
  person: Person;
  groups: Group[];
  /** 這個人在業務開發裡的狀態標籤（沒有就是還沒列入） */
  prospect?: { label: string; tone: ChipTone };
  /** 長按人物卡（桌面為右鍵）：首頁用來開啟業務開發選單 */
  onLongPress?: (person: Person) => void;
}) {
  const avatarId = person.avatarPhotoId ?? person.photoIds[0];
  const [cardRef, near] = useNearViewport<HTMLAnchorElement>();
  const press = useLongPress(() => onLongPress?.(person));
  const url = usePhotoURL(near ? avatarId : undefined, 'thumb');
  // 備註第一句優先；沒寫備註就退回顯示場合
  const subtitle = firstSentence(person.note) ?? person.occasion;
  const dots = person.groupIds
    .map((id) => groups.find((g) => g.id === id))
    .filter((g): g is Group => Boolean(g));

  return (
    <Link
      ref={cardRef}
      to={`/person/${person.id}`}
      {...(onLongPress ? press : {})}
      className="no-callout block overflow-hidden rounded-2xl border-[0.5px] border-hairline bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-transform active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
    >
      <div className="relative aspect-square w-full bg-ground">
        {prospect && (
          <StatusChip
            label={prospect.label}
            tone={prospect.tone}
            className="absolute left-2 top-2 z-10 shadow-[0_1px_4px_rgba(0,0,0,0.2)]"
          />
        )}
        {url ? (
          <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-4xl text-ink-2"
          >
            {person.displayName.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 truncate font-medium">{person.displayName}</p>
          {dots.length > 0 && (
            <div className="flex max-w-[55%] shrink-0 gap-1 overflow-hidden">
              {dots.map((g) => (
                <span
                  key={g.id}
                  className="flex items-center gap-1 whitespace-nowrap rounded-full border-[0.5px] border-hairline bg-ground px-1.5 py-0.5 text-xs text-ink-2"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: g.color }} />
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>
        {subtitle && <p className="mt-0.5 truncate text-sm text-ink-2">{subtitle}</p>}
      </div>
    </Link>
  );
}
