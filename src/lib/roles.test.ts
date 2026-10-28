import { beforeEach, describe, expect, it } from 'vitest';
import {
  accessOf,
  cacheAccess,
  cachedAccess,
  clearCachedRole,
  FULL_ACCESS,
  homeRoute,
  NO_ACCESS,
  syncScopeOf,
} from './roles';

const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

beforeEach(() => store.clear());

describe('群組 → 能用的頁面', () => {
  it('admin 與 team 能用全部（只有 admin 能改設定）', () => {
    expect(accessOf(['admin'])).toEqual(FULL_ACCESS);
    expect(accessOf(['team'])).toEqual({ admin: false, people: true, todo: true, progress: true });
  });

  it('tech 能用產品進度與待辦，看不到人脈與客戶；todo 只有待辦', () => {
    expect(accessOf(['tech'])).toEqual({ ...NO_ACCESS, progress: true, todo: true });
    expect(accessOf(['tech', 'todo'])).toEqual(accessOf(['tech'])); // 再加 todo 也一樣
    expect(accessOf(['todo'])).toEqual({ ...NO_ACCESS, todo: true });
  });

  it('沒有任何群組：什麼都不能用（伺服器也不給資料）', () => {
    expect(accessOf([])).toEqual(NO_ACCESS);
  });

  it('同時屬於多個群組，取較大的權限', () => {
    expect(accessOf(['tech', 'team']).people).toBe(true);
  });
});

describe('身分快取', () => {
  it('寫了讀得回來；登出會清掉', () => {
    expect(cachedAccess()).toBeUndefined();
    cacheAccess(['tech']);
    expect(cachedAccess()).toEqual({ ...NO_ACCESS, progress: true, todo: true });
    clearCachedRole();
    expect(cachedAccess()).toBeUndefined();
  });

  it('沿用舊版留下的記號：管理員＝全部，只能用產品進度＝只有產品進度', () => {
    store.set('renmai.isAdmin', '1');
    expect(cachedAccess()).toEqual(FULL_ACCESS);
    store.clear();
    store.set('renmai.limited', '1');
    expect(cachedAccess()).toEqual({ ...NO_ACCESS, progress: true });
    store.clear();
    store.set('renmai.isAdmin', '0');
    expect(cachedAccess()).toBeUndefined();
  });
});

describe('同步範圍與首頁', () => {
  it('同步範圍就是有權限的資料；首頁導到第一個能進的頁面', () => {
    expect(syncScopeOf(accessOf(['tech']))).toEqual({ people: false, todo: true, progress: true });
    // 打開 App 的第一個頁面是待辦；沒有待辦權限的人依序是產品進度、人脈記錄
    expect(homeRoute(accessOf(['team']))).toBe('/tasks');
    expect(homeRoute(accessOf(['admin']))).toBe('/tasks');
    expect(homeRoute(accessOf(['tech']))).toBe('/tasks');
    expect(homeRoute(accessOf(['todo']))).toBe('/tasks');
    expect(homeRoute({ admin: false, people: false, todo: false, progress: true })).toBe('/progress');
    expect(homeRoute({ admin: false, people: true, todo: false, progress: false })).toBe('/people');
  });
});
