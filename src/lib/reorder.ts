// 手動拖曳排序（產品進度與待辦共用）：每個項目有一個 sortOrder（小數，小的在上面）。
// 拖曳時只需要改被拖動的那一筆，其他項目完全不動，同步時也只傳一筆。

export interface Orderable {
  id: string;
  sortOrder?: number;
  updatedAt: string;
}

/** 新增項目時放在同一組（同一個大項目、同一個分類）的最後面。傳進來的 items 就是「同一組」。 */
export function nextOrder(items: readonly Orderable[]): number {
  const orders = items.filter((i) => i.sortOrder !== undefined).map((i) => i.sortOrder!);
  return orders.length > 0 ? Math.max(...orders) + 1 : 1;
}

/**
 * 把一個項目拖到另一個項目的位置（同一組、目前畫面上顯示的順序）。回傳需要儲存的項目（已改好位置與更新時間）。
 * - 目前的順序已經是手動排好的（每一個都有位置、而且由小到大）：只改被拖動的那一筆，
 *   位置放在前後兩個鄰居的中間（小數）。
 * - 否則（第一次拖、或是從別的排序方式切過來）：依「目前畫面上的順序」重新編號，之後就是手動排序。
 */
export function moveItem<T extends Orderable>(displayed: T[], activeId: string, overId: string, now = new Date()): T[] {
  const from = displayed.findIndex((i) => i.id === activeId);
  const to = displayed.findIndex((i) => i.id === overId);
  if (from < 0 || to < 0 || from === to) return [];

  const moved = [...displayed];
  const [item] = moved.splice(from, 1);
  moved.splice(to, 0, item);
  const iso = now.toISOString();

  const orders = displayed.map((i) => i.sortOrder);
  const consistent = orders.every((o, k) => o !== undefined && (k === 0 || o > orders[k - 1]!));
  if (consistent) {
    const prev = moved[to - 1]?.sortOrder;
    const next = moved[to + 1]?.sortOrder;
    // 兩個鄰居之間的空隙太小（拖了很多次）就改成重新編號，避免小數精度用完
    if (prev === undefined || next === undefined || next - prev > 1e-9) {
      const value =
        prev !== undefined && next !== undefined
          ? (prev + next) / 2
          : prev !== undefined
            ? prev + 1
            : next !== undefined
              ? next - 1
              : 1;
      return [{ ...item, sortOrder: value, updatedAt: iso }];
    }
  }

  return moved
    .map((it, k) => ({ it, position: k + 1 }))
    .filter(({ it, position }) => it.id === activeId || it.sortOrder !== position)
    .map(({ it, position }) => ({ ...it, sortOrder: position, updatedAt: iso }));
}
